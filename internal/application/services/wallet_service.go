package services

import (
    "fmt"

    "github.com/noymaxx/backend/internal/application/usecases"
    "github.com/noymaxx/backend/internal/domain/entities"
    "github.com/noymaxx/backend/internal/infrastructure/repositories"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
)

type IWalletService interface {
    FetchAndStoreBalance(addressParam string) ([]entities.Wallet, error)
    GetAllAddresses() ([]string, error)
    GetWalletTokens(addressParam string) (*entities.Wallet, error)
}

type WalletService struct {
    logger     *logs.Logger
    repository repositories.IWalletRepository
}

func NewWalletService(logger *logs.Logger, repo repositories.IWalletRepository) *WalletService {
    return &WalletService{
        logger:     logger,
        repository: repo,
    }
}

// FetchAndStoreBalance calls Rango to get wallet data, upserts into Mongo
func (ws *WalletService) FetchAndStoreBalance(addressParam string) ([]entities.Wallet, error) {
    ws.logger.Infof("Fetching wallet details for: %s", addressParam)

    // Call Rango
    rangoRes, err := usecases.GetBalanceFromRango(addressParam, ws.logger)
    if err != nil {
        return nil, fmt.Errorf("failed to get balance from Rango: %w", err)
    }

    var updated []entities.Wallet

    // Rango returns "Wallets" array
    for _, w := range rangoRes.Wallets {
        err := ws.repository.InsertOrUpdateWallet(w)
        if err != nil {
            ws.logger.Errorf("Error upserting wallet %s.%s: %v", w.Blockchain, w.Address, err)
            continue
        }
        updated = append(updated, w)
    }

    return updated, nil
}

// GetAllAddresses returns "BLOCKCHAIN.ADDRESS" from DB
func (ws *WalletService) GetAllAddresses() ([]string, error) {
    return ws.repository.GetAllAddresses()
}

// GetWalletTokens returns a single wallet doc from DB
func (ws *WalletService) GetWalletTokens(addressParam string) (*entities.Wallet, error) {
    bc, addr, err := usecases.ParseBlockchainAndAddress(addressParam)
    if err != nil {
        return nil, err
    }

    wallet, dbErr := ws.repository.GetWalletByBlockchainAddress(bc, addr)
    if dbErr != nil {
        return nil, dbErr
    }
    return wallet, nil
}
