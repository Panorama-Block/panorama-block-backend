package usecases

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/panoramablock/wallet-tracker-service/internal/domain/entities"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/logs"
)

type WalletAPIResponse struct {
	Wallets []entities.Wallet `json:"wallets"`
}

// GetWalletBalance fetches wallet balance data from an external API
func GetWalletBalance(addressParam string, logger *logs.Logger) (*WalletAPIResponse, error) {
	apiKey := os.Getenv("WALLET_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("wallet API key not found in environment")
	}

	apiURL := fmt.Sprintf("https://api.example.com/wallets/details?address=%s&apiKey=%s", addressParam, apiKey)
	logger.Infof("GET: %s", apiURL)

	resp, err := http.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("failed calling wallet API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %s", string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	var apiRes WalletAPIResponse
	if err := json.Unmarshal(bodyBytes, &apiRes); err != nil {
		return nil, fmt.Errorf("failed to unmarshal WalletAPIResponse: %w", err)
	}

	return &apiRes, nil
}

// ParseBlockchainAndAddress parses an address param in the format "BLOCKCHAIN.ADDRESS"
func ParseBlockchainAndAddress(addressParam string) (string, string, error) {
	parts := strings.Split(addressParam, ".")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid address format, expect BLOCKCHAIN.ADDRESS")
	}
	return parts[0], parts[1], nil
} 