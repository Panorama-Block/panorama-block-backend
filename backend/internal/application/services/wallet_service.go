package services

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"time"
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/avast/retry-go"
	"github.com/redis/go-redis/v9"
	"github.com/noymaxx/backend/internal/application/usecases"
	"github.com/noymaxx/backend/internal/domain/entities"
	"github.com/noymaxx/backend/internal/infrastructure/logs"
	"github.com/noymaxx/backend/internal/infrastructure/repositories"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"github.com/avast/retry-go"
	"github.com/noymaxx/backend/internal/application/usecases"
	"github.com/noymaxx/backend/internal/domain/entities"
	"github.com/noymaxx/backend/internal/infrastructure/logs"
	"github.com/noymaxx/backend/internal/infrastructure/repositories"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SupportedBlockchains defines which blockchains are supported
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

// IWalletService interface now includes new methods for tokens and balances with user validation.
type IWalletService interface {
	FetchAndStoreBalance(userID, addressParam string) ([]entities.Wallet, error)
	GetAllAddresses(userID string) ([]string, error)
	// New method to get paginated wallet tokens for a user
	GetWalletTokens(userID, addressParam string, page, limit int, symbol string) ([]entities.Balance, error)
	// New method to get wallet balances for a given blockchain and address (with user check)
	GetWalletBalances(userID, blockchain, address string) (*entities.WalletBalances, error)
}

// WalletService implements IWalletService
type WalletService struct {
	logger      *logs.Logger
	walletRepo  repositories.IWalletRepository
	balanceRepo repositories.IBalanceRepository
	redisClient *redis.Client
}

// NewWalletService creates a new WalletService instance.
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

// ValidateAddress validates the blockchain and address format.
// Validates blockchain and address
func ValidateAddress(blockchain, address string) error {
	if !SupportedBlockchains[blockchain] {
		return fmt.Errorf("blockchain '%s' not supported", blockchain)
	}
	// Simple regex example for BSC and ETH addresses
	matched, _ := regexp.MatchString(`(?i)^0x[0-9a-fA-F]{40}$`, address)
	if (blockchain == "BSC" || blockchain == "ETH") && !matched {
		return fmt.Errorf("invalid address for %s: %s", blockchain, address)
	}
	// Additional rules for other blockchains can be added here
	return nil
    if !SupportedBlockchains[blockchain] {
        return fmt.Errorf("blockchain '%s' not supported", blockchain)
    }
    // Simple example for BSC and ETH
    matched, _ := regexp.MatchString(`(?i)^0x[0-9a-fA-F]{40}$`, address)
    if (blockchain == "BSC" || blockchain == "ETH") && !matched {
        return fmt.Errorf("invalid address for %s: %s", blockchain, address)
    }
    // if needed, other rules for other blockchains
    return nil
}

// FetchAndStoreBalance calls Rango, saves data in MongoDB and caches in Redis if enabled.
// Note: It now receives a userID and uses it when upserting wallet details.
func (ws *WalletService) FetchAndStoreBalance(userID, addressParam string) ([]entities.Wallet, error) {
	ws.logger.Infof("Fetching wallet details for user %s: %s", userID, addressParam)
// FetchAndStoreBalance calls Rango, saves to Mongo and Redis (cache) if enabled
func (ws *WalletService) FetchAndStoreBalance(addressParam string) ([]entities.Wallet, error) {
    ws.logger.Infof("Fetching wallet details for: %s", addressParam)

	// Parse the blockchain and address from the provided parameter.
	bc, addr, parseErr := usecases.ParseBlockchainAndAddress(addressParam)
	if parseErr != nil {
		return nil, parseErr
	}
	if err := ValidateAddress(bc, addr); err != nil {
		return nil, err
	}

	// Attempt to fetch from Redis cache.
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

	// Call Rango API with retry logic.
	var rangoRes *usecases.RangoWalletResponse
	err := retry.Do(
		func() error {
			res, callErr := usecases.GetBalanceFromRango(addressParam, ws.logger)
			if callErr != nil {
				return callErr
			}
			rangoRes = res
			return nil
		},
		retry.Attempts(3), // Retry up to 3 times
		retry.Delay(2*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get balance from Rango after retries: %w", err)
	}
    // 2) Call Rango with retry
    var rangoRes *usecases.RangoWalletResponse
    err := retry.Do(
        func() error {
            res, callErr := usecases.GetBalanceFromRango(addressParam, ws.logger)
            if callErr != nil {
                return callErr
            }
            rangoRes = res
            return nil
        },
        retry.Attempts(3),  // tries up to 3x
        retry.Delay(2*time.Second),
    )
    if err != nil {
        return nil, fmt.Errorf("failed to get balance from Rango after retries: %w", err)
    }

	var updated []entities.Wallet
	// Iterate over wallets returned from Rango.
	for _, w := range rangoRes.Wallets {
		// Build the Wallet structure.
		basicWallet := entities.Wallet{
			UserID:      userID, // Associate wallet with the user
			Blockchain:  w.Blockchain,
			Address:     w.Address,
			Failed:      w.Failed,
			ExplorerUrl: w.ExplorerUrl,
		}
		if insertErr := ws.walletRepo.InsertOrUpdateWallet(basicWallet); insertErr != nil {
			ws.logger.Errorf("Error upserting wallet %s.%s for user %s: %v", w.Blockchain, w.Address, userID, insertErr)
			continue
		}
		updated = append(updated, basicWallet)
    var updated []entities.Wallet
    // Rango returns a "Wallets" array
    for _, w := range rangoRes.Wallets {
        // Build the "Wallet" struct
        basicWallet := entities.Wallet{
            Blockchain:  w.Blockchain,
            Address:     w.Address,
            Failed:      w.Failed,
            ExplorerUrl: w.ExplorerUrl,
        }
        if insertErr := ws.walletRepo.InsertOrUpdateWallet(basicWallet); insertErr != nil {
            ws.logger.Errorf("Error upserting wallet %s.%s: %v", w.Blockchain, w.Address, insertErr)
            continue
        }
        updated = append(updated, basicWallet)

		// Build the WalletBalances structure.
		wb := entities.WalletBalances{
			Blockchain: w.Blockchain,
			Address:    w.Address,
			Balances:   w.Balances,
			UpdatedAt:  time.Now(),
		}
		// Retrieve the wallet record for the given user.
		if found, _ := ws.walletRepo.GetWalletByBlockchainAddress(userID, bc, addr); found != nil {
			wb.WalletID = found.ID
		} else {
			wb.WalletID = primitive.NilObjectID
		}
        // Build "WalletBalances"
        wb := entities.WalletBalances{
            Blockchain: w.Blockchain,
            Address:    w.Address,
            Balances:   w.Balances,
            UpdatedAt:  time.Now(),
        }
        // If the Wallet already exists, get the ID for reference
        if found, _ := ws.walletRepo.GetWalletByBlockchainAddress(bc, addr); found != nil {
            wb.WalletID = found.ID
        } else {
            wb.WalletID = primitive.NilObjectID
        }

		if insertErr := ws.balanceRepo.InsertOrUpdateBalances(wb); insertErr != nil {
			ws.logger.Errorf("Error upserting balances %s.%s: %v", w.Blockchain, w.Address, insertErr)
			continue
		}
	}

	// Cache the updated wallet data in Redis.
	if ws.redisClient != nil && len(updated) > 0 {
		dataBytes, _ := json.Marshal(updated)
		ws.redisClient.Set(context.Background(), redisKey, string(dataBytes), 1*time.Minute)
	}
    // 3) Save to Redis
    if ws.redisClient != nil && len(updated) > 0 {
        dataBytes, _ := json.Marshal(updated)
        ws.redisClient.Set(context.Background(), redisKey, string(dataBytes), 1*time.Minute)
    }

	return updated, nil
}

// GetAllAddresses returns all wallet addresses associated with a user.
func (ws *WalletService) GetAllAddresses(userID string) ([]string, error) {
	return ws.walletRepo.GetAllAddressesByUser(userID)
}

// GetWalletBalances retrieves the balances for a given blockchain and address after validating user ownership.
func (ws *WalletService) GetWalletBalances(userID, blockchain, address string) (*entities.WalletBalances, error) {
	// Validate address format.
	if err := ValidateAddress(blockchain, address); err != nil {
		return nil, err
	}
	// Ensure that the wallet belongs to the user.
	wallet, err := ws.walletRepo.GetWalletByBlockchainAddress(userID, blockchain, address)
	if err != nil {
		return nil, err
	}
	if wallet == nil {
		return nil, fmt.Errorf("wallet not found for user")
	}
	// Retrieve balances from the balance repository.
	wb, err := ws.balanceRepo.GetBalancesByWallet(blockchain, address)
	return wb, err
}

// GetWalletTokens retrieves tokens for a given wallet with pagination and optional symbol filtering.
// It verifies that the wallet belongs to the user.
func (ws *WalletService) GetWalletTokens(userID, addressParam string, page, limit int, symbol string) ([]entities.Balance, error) {
	// Parse the blockchain and address.
	bc, addr, err := usecases.ParseBlockchainAndAddress(addressParam)
	if err != nil {
		return nil, err
	}
	// Validate the address.
	if errVal := ValidateAddress(bc, addr); errVal != nil {
		return nil, errVal
	}
// GetWalletTokens with pagination and filtering
func (ws *WalletService) GetWalletTokens(addressParam string, page, limit int, symbol string) ([]entities.Balance, error) {
    bc, addr, err := usecases.ParseBlockchainAndAddress(addressParam)
    if err != nil {
        return nil, err
    }
    if errVal := ValidateAddress(bc, addr); errVal != nil {
        return nil, errVal
    }

	// Check that the wallet belongs to the user.
	wallet, err := ws.walletRepo.GetWalletByBlockchainAddress(userID, bc, addr)
	if err != nil {
		return nil, err
	}
	if wallet == nil {
		return nil, fmt.Errorf("wallet not found for user")
	}

	// Retrieve the wallet balances.
	wb, err := ws.balanceRepo.GetBalancesByWallet(bc, addr)
	if err != nil {
		return nil, err
	}
	if wb == nil {
		return nil, nil
	}

	// Filter tokens by symbol if provided.
	var filtered []entities.Balance
	for _, bal := range wb.Balances {
		if symbol == "" || bal.Asset.Symbol == symbol {
			filtered = append(filtered, bal)
		}
	}

	// Apply simple pagination.
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
