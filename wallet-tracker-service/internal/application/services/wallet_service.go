package services

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/avast/retry-go"
	"github.com/panoramablock/wallet-tracker-service/internal/application/usecases"
	"github.com/panoramablock/wallet-tracker-service/internal/domain/entities"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/logs"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/repositories"
	"github.com/redis/go-redis/v9"
)

var SupportedBlockchains = map[string]bool{
	"BSC":         true,
	"ETH":         true,
	"POLYGON":     true,
	"SOLANA":      true,
	"AVAX_CCHAIN": true,
	"OPTIMISM":    true,
	"ARBITRUM":    true,
	"FANTOM":      true,
	"TRON":        true,
	"BASE":        true,
	"CELO":        true,
	"BTC":         true,
}

type IWalletService interface {
	FetchAndStoreBalance(addressParam string) ([]entities.Wallet, error)
	GetAllAddresses() ([]string, error)
	GetWalletTokens(addressParam string, page, limit int, symbol string) ([]entities.Balance, error)
	GetWalletBalances(bc, addr string) (*entities.WalletBalances, error)
}

type WalletService struct {
	logger      *logs.Logger
	walletRepo  repositories.IWalletRepository
	balanceRepo repositories.IBalanceRepository
	redisClient *redis.Client
}

func NewWalletService(
	logger *logs.Logger,
	walletRepo repositories.IWalletRepository,
	balanceRepo repositories.IBalanceRepository,
	redisClient *redis.Client,
) *WalletService {
	return &WalletService{
		logger:      logger,
		walletRepo:  walletRepo,
		balanceRepo: balanceRepo,
		redisClient: redisClient,
	}
}

// ValidateAddress validates blockchain and address
func ValidateAddress(blockchain, address string) error {
	if !SupportedBlockchains[blockchain] {
		return fmt.Errorf("blockchain '%s' not supported", blockchain)
	}
	// Simple example for BSC and ETH
	matched, _ := regexp.MatchString(`(?i)^0x[0-9a-fA-F]{40}$`, address)
	if (blockchain == "BSC" || blockchain == "ETH") && !matched {
		return fmt.Errorf("invalid address for %s: %s", blockchain, address)
	}
	// Additional rules for other blockchains can be added here
	return nil
}

// FetchAndStoreBalance calls external API, saves to Mongo and Redis (cache) if enabled
func (ws *WalletService) FetchAndStoreBalance(addressParam string) ([]entities.Wallet, error) {
	ws.logger.Infof("Fetching wallet details for: %s", addressParam)

	bc, addr, parseErr := usecases.ParseBlockchainAndAddress(addressParam)
	if parseErr != nil {
		return nil, parseErr
	}
	if err := ValidateAddress(bc, addr); err != nil {
		return nil, err
	}

	// 1) Try to fetch from cache
	redisKey := fmt.Sprintf("balance:%s:%s", bc, addr)
	if ws.redisClient != nil {
		cached, cacheErr := ws.redisClient.Get(context.Background(), redisKey).Result()
		if cacheErr == nil && cached != "" {
			var cachedRes []entities.Wallet
			if err := json.Unmarshal([]byte(cached), &cachedRes); err == nil {
				ws.logger.Infof("Returning data from Redis cache for %s", addressParam)
				return cachedRes, nil
			}
		}
	}

	// 2) Call external API with retry
	var apiResponse *usecases.WalletAPIResponse
	err := retry.Do(
		func() error {
			res, callErr := usecases.GetWalletBalance(addressParam, ws.logger)
			if callErr != nil {
				return callErr
			}
			apiResponse = res
			return nil
		},
		retry.Attempts(3),  // tries up to 3x
		retry.Delay(2*time.Second),
	)

	if err != nil {
		ws.logger.Errorf("Failed to fetch wallet data after retries: %v", err)
		return nil, fmt.Errorf("failed to fetch wallet data: %w", err)
	}

	// 3) Process and save to MongoDB
	wallets := apiResponse.Wallets
	for i := range wallets {
		wallets[i].CreatedAt = time.Now()
		wallets[i].LastUpdated = time.Now()

		// Save wallet data
		if err := ws.walletRepo.SaveWallet(&wallets[i]); err != nil {
			ws.logger.Errorf("Error saving wallet: %v", err)
			// Continue, don't fail the whole operation for one wallet
		}

		// Save balance data
		balances := &entities.WalletBalances{
			Blockchain: wallets[i].Blockchain,
			Address:    wallets[i].Address,
			Balances:   wallets[i].Balances,
			UpdatedAt:  time.Now(),
		}
		if err := ws.balanceRepo.SaveBalances(balances); err != nil {
			ws.logger.Errorf("Error saving balances: %v", err)
		}
	}

	// 4) Cache in Redis if available
	if ws.redisClient != nil && len(wallets) > 0 {
		jsonData, jsonErr := json.Marshal(wallets)
		if jsonErr == nil {
			ws.redisClient.Set(context.Background(), redisKey, jsonData, 5*time.Minute)
		}
	}

	return wallets, nil
}

// GetAllAddresses returns all wallet addresses tracked by the service
func (ws *WalletService) GetAllAddresses() ([]string, error) {
	addresses, err := ws.walletRepo.GetAllAddresses()
	if err != nil {
		ws.logger.Errorf("Error fetching addresses: %v", err)
		return nil, err
	}
	return addresses, nil
}

// GetWalletBalances gets the balances for a wallet
func (ws *WalletService) GetWalletBalances(bc, addr string) (*entities.WalletBalances, error) {
	if err := ValidateAddress(bc, addr); err != nil {
		return nil, err
	}
	wb, err := ws.balanceRepo.GetBalancesByWallet(bc, addr)
	return wb, err
}

// GetWalletTokens gets wallet tokens with pagination and filtering
func (ws *WalletService) GetWalletTokens(addressParam string, page, limit int, symbol string) ([]entities.Balance, error) {
	bc, addr, err := usecases.ParseBlockchainAndAddress(addressParam)
	if err != nil {
		return nil, err
	}
	if errVal := ValidateAddress(bc, addr); errVal != nil {
		return nil, errVal
	}

	wb, err := ws.balanceRepo.GetBalancesByWallet(bc, addr)
	if err != nil {
		return nil, err
	}
	if wb == nil {
		return nil, nil
	}

	// Filter by symbol if needed
	var filtered []entities.Balance
	for _, bal := range wb.Balances {
		if symbol == "" || bal.Asset.Symbol == symbol {
			filtered = append(filtered, bal)
		}
	}

	// Pagination
	start := (page - 1) * limit
	if start > len(filtered) {
		return []entities.Balance{}, nil
	}
	end := start + limit
	if end > len(filtered) {
		end = len(filtered)
	}

	return filtered[start:end], nil
} 