package usecases

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "strings"

    "github.com/noymaxx/backend/internal/domain/entities"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
)

type RangoWalletResponse struct {
    Wallets []entities.Wallet `json:"wallets"`
}

// GetBalanceFromRango calls https://api.rango.exchange/wallets/details?address=XXX&apiKey=YYY
func GetBalanceFromRango(addressParam string, logger *logs.Logger) (*RangoWalletResponse, error) {
    apiKey := os.Getenv("X_RANGO_ID")
    if apiKey == "" {
        return nil, fmt.Errorf("Rango API key not found in environment")
    }

    url := fmt.Sprintf("https://api.rango.exchange/wallets/details?address=%s&apiKey=%s", addressParam, apiKey)
    logger.Infof("GET: %s", url)

    resp, err := http.Get(url)
    if err != nil {
        return nil, fmt.Errorf("failed calling Rango wallets/details: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        bodyBytes, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("Rango error: %s", string(bodyBytes))
    }

    bodyBytes, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("failed to read body: %w", err)
    }

    var rangoRes RangoWalletResponse
    if err := json.Unmarshal(bodyBytes, &rangoRes); err != nil {
        return nil, fmt.Errorf("failed to unmarshal RangoWalletResponse: %w", err)
    }

    return &rangoRes, nil
}

// ParseBlockchainAndAddress splits "BSC.0x123..." into ("BSC", "0x123...")
func ParseBlockchainAndAddress(addressParam string) (string, string, error) {
    parts := strings.Split(addressParam, ".")
    if len(parts) != 2 {
        return "", "", fmt.Errorf("invalid address format, expect BLOCKCHAIN.ADDRESS")
    }
    return parts[0], parts[1], nil
}
