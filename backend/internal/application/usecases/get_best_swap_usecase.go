package usecases

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"

    "github.com/noymaxx/backend/internal/domain/interfaces"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
)

func GetBestSwapRoute(swapReq interfaces.SwapRequest, logger logs.Logger) (*interfaces.SwapResponse, error) {
    apiKey := os.Getenv("X_RANGO_ID")
    if apiKey == "" {
        return nil, fmt.Errorf("API key not found in environment")
    }

    apiURL := fmt.Sprintf("https://api.rango.exchange/routing/best?apiKey=%s", apiKey)
    payloadBytes, err := json.Marshal(swapReq)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal payload: %w", err)
    }

    req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(payloadBytes))
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }
    req.Header.Set("Content-Type", "application/json")

    logger.Infof("Sending request to Rango: %s", apiURL)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to call API: %w", err)
    }
    defer resp.Body.Close()

    logger.Infof("HTTP status code from Rango: %d", resp.StatusCode)

    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("Rango API error: %s", string(body))
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("failed to read response body: %w", err)
    }

    logger.Infof("Raw response from Rango: %s", string(body))

    var swapRes interfaces.SwapResponse
    if err := json.Unmarshal(body, &swapRes); err != nil {
        return nil, fmt.Errorf("failed to unmarshal response: %w", err)
    }

    return &swapRes, nil
}
