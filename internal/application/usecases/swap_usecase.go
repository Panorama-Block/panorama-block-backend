package usecases

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	"github.com/noymaxx/backend/internal/domain/entities"
)

// Estrutura completa para a resposta da API da Rango Exchange
type SwapResponse struct {
	From          entities.Asset `json:"from"`
	To            entities.Asset `json:"to"`
	RequestAmount string        `json:"requestAmount"`
	RequestID     string         `json:"requestId"`
	Result        Result         `json:"result"`
}

type Result struct {
	OutputAmount string `json:"outputAmount"`
	Swaps        []Swap  `json:"swaps"`
}

type Swap struct {
	SwapperID   string  `json:"swapperId"`
	SwapperLogo string  `json:"swapperLogo"`
	SwapperType string  `json:"swapperType"`
	From        entities.Asset `json:"from"`
	To          entities.Asset `json:"to"`
	FromAmount  string `json:"fromAmount"`
	ToAmount    string `json:"toAmount"`
}

// Estrutura da requisição para a API da Rango
type SwapRequest struct {
	From              entities.Asset       `json:"from"`
	To                entities.Asset       `json:"to"`
	Amount            string               `json:"amount,omitempty"`
	Slippage          int              `json:"slippage,omitempty"`
	CheckPrerequisites bool                `json:"checkPrerequisites"`
	ConnectedWallets  []map[string]interface{} `json:"connectedWallets,omitempty"`
}

// Função para buscar a melhor rota na API da Rango Exchange
func GetBestSwapRoute(swapReq SwapRequest) (*SwapResponse, error) {
	apiKey := os.Getenv("X_RANGO_ID")

	if apiKey == "" {
		return nil, fmt.Errorf("API Key não foi encontrada no ambiente")
	}

	apiURL := fmt.Sprintf("https://api.rango.exchange/routing/best?apiKey=%s", apiKey)

	payloadBytes, err := json.Marshal(swapReq)
	if err != nil {
		return nil, fmt.Errorf("erro ao serializar payload: %v", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar requisição: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro ao chamar API: %v", err)
	}
	defer resp.Body.Close()

	fmt.Println("🔹 Código de resposta HTTP:", resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("erro da API: %s", string(body))
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler resposta: %v", err)
	}

	fmt.Println("🔹 Resposta bruta da API:", string(body))

	var swapRes SwapResponse
	err = json.Unmarshal(body, &swapRes)
	if err != nil {
		return nil, fmt.Errorf("erro ao desserializar resposta: %v", err)
	}

	return &swapRes, nil
}
