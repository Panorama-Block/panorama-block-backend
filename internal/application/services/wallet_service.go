package services

import (
	"fmt"
	"time"

	"github.com/avast/retry-go"
	"github.com/noymaxx/backend/internal/application/usecases"
	"github.com/noymaxx/backend/internal/domain/entities"
	"github.com/noymaxx/backend/internal/infrastructure/logs"
	"github.com/noymaxx/backend/internal/infrastructure/repositories"
	"github.com/redis/go-redis/v9"
)

type IWalletService interface {
	FetchAndStoreBalance(userID, addressParam string) ([]entities.Wallet, error)
	GetAllAddresses(userID string) ([]string, error)
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

func (ws *WalletService) FetchAndStoreBalance(walletAddress, addressParam string) ([]entities.Wallet, error) {
    ws.logger.Infof("Fetching wallet details for user %s: %s", walletAddress, addressParam)

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
        retry.Attempts(3),
        retry.Delay(2*time.Second),
    )
    if err != nil {
        return nil, fmt.Errorf("failed to get balance from Rango after retries: %w", err)
    }

    var updated []entities.Wallet
    for _, w := range rangoRes.Wallets {
        basicWallet := entities.Wallet{
            UserID:      walletAddress, // Cada usuário tem suas próprias carteiras
            Blockchain:  w.Blockchain,
            Address:     w.Address,
            Failed:      w.Failed,
            ExplorerUrl: w.ExplorerUrl,
        }
        if insertErr := ws.walletRepo.InsertOrUpdateWallet(basicWallet); insertErr != nil {
            ws.logger.Errorf("Error upserting wallet %s.%s for user %s: %v", w.Blockchain, w.Address, walletAddress, insertErr)
            continue
        }
        updated = append(updated, basicWallet)
    }

    return updated, nil
}


func (ws *WalletService) GetAllAddresses(walletAddress string) ([]string, error) {
	return ws.walletRepo.GetAllAddressesByUser(walletAddress)
}
