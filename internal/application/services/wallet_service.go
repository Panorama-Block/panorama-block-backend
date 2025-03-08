package services

import (
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
)

var SupportedBlockchains = map[string]bool{
    "BSC":     true,
    "ETH":     true,
    "POLYGON": true,
    "SOLANA":  true,
    "AVAX_CCHAIN":    true,
    "OPTIMISM": true,
    "ARBITRUM": true,
    "FANTOM":  true,
    "TRON":    true,
    "BASE":    true,
    "CELO":    true,
    "BTC":     true,
}

type IWalletService interface {
    FetchAndStoreBalance(addressParam string) ([]entities.Wallet, error)
    GetAllAddresses() ([]string, error)
    GetWalletTokens(addressParam string, page, limit int, symbol string) ([]entities.Balance, error)
    GetWalletBalances(bc, addr string) (*entities.WalletBalances, error)
}

type WalletService struct {
    logger        *logs.Logger
    walletRepo    repositories.IWalletRepository
    balanceRepo   repositories.IBalanceRepository
    redisClient   *redis.Client
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

// Valida blockchain e endereço
func ValidateAddress(blockchain, address string) error {
    if !SupportedBlockchains[blockchain] {
        return fmt.Errorf("blockchain '%s' não suportada", blockchain)
    }
    // Exemplo simples p/ BSC e ETH
    matched, _ := regexp.MatchString(`(?i)^0x[0-9a-fA-F]{40}$`, address)
    if (blockchain == "BSC" || blockchain == "ETH") && !matched {
        return fmt.Errorf("endereço inválido para %s: %s", blockchain, address)
    }
    // se precisar, outras regras para outras blockchains
    return nil
}

// FetchAndStoreBalance chama Rango, salva no Mongo e no Redis (cache) se habilitado
func (ws *WalletService) FetchAndStoreBalance(addressParam string) ([]entities.Wallet, error) {
    ws.logger.Infof("Fetching wallet details for: %s", addressParam)

    bc, addr, parseErr := usecases.ParseBlockchainAndAddress(addressParam)
    if parseErr != nil {
        return nil, parseErr
    }
    if err := ValidateAddress(bc, addr); err != nil {
        return nil, err
    }

    // 1) Tenta buscar no cache
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

    // 2) Chama Rango com retry
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
        retry.Attempts(3),  // tenta até 3x
        retry.Delay(2*time.Second),
    )
    if err != nil {
        return nil, fmt.Errorf("failed to get balance from Rango after retries: %w", err)
    }

    var updated []entities.Wallet
    // Rango retorna um array "Wallets"
    for _, w := range rangoRes.Wallets {
        // Monta a struct de "Wallet"
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

        // Monta "WalletBalances"
        wb := entities.WalletBalances{
            Blockchain: w.Blockchain,
            Address:    w.Address,
            Balances:   w.Balances,
            UpdatedAt:  time.Now(),
        }
        // Se já existir a Wallet, pegue o ID para referenciar
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

    // 3) Salva no Redis
    if ws.redisClient != nil && len(updated) > 0 {
        dataBytes, _ := json.Marshal(updated)
        ws.redisClient.Set(context.Background(), redisKey, string(dataBytes), 1*time.Minute)
    }

    return updated, nil
}

func (ws *WalletService) GetAllAddresses() ([]string, error) {
    return ws.walletRepo.GetAllAddresses()
}

func (ws *WalletService) GetWalletBalances(bc, addr string) (*entities.WalletBalances, error) {
    if err := ValidateAddress(bc, addr); err != nil {
        return nil, err
    }
    wb, err := ws.balanceRepo.GetBalancesByWallet(bc, addr)
    return wb, err
}

// GetWalletTokens com paginação e filtro
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

    // Filtra por symbol se necessário
    var filtered []entities.Balance
    for _, bal := range wb.Balances {
        if symbol == "" || bal.Asset.Symbol == symbol {
            filtered = append(filtered, bal)
        }
    }

    // Paginação simples
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
