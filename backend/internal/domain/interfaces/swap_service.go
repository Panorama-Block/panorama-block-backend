package interfaces

import "github.com/noymaxx/backend/internal/domain/entities"

type SwapResponse struct {
    From          entities.Asset `json:"from"`
    To            entities.Asset `json:"to"`
    RequestAmount string         `json:"requestAmount"`
    RequestID     string         `json:"requestId"`
    Result        Result         `json:"result"`
}

type Result struct {
    OutputAmount string `json:"outputAmount"`
    Swaps        []Swap `json:"swaps"`
}

type Swap struct {
    SwapperID   string         `json:"swapperId"`
    SwapperLogo string         `json:"swapperLogo"`
    SwapperType string         `json:"swapperType"`
    From        entities.Asset `json:"from"`
    To          entities.Asset `json:"to"`
    FromAmount  string         `json:"fromAmount"`
    ToAmount    string         `json:"toAmount"`
}

type SwapRequest struct {
    From               entities.Asset           `json:"from"`
    To                 entities.Asset           `json:"to"`
    Amount             string                   `json:"amount,omitempty"`
    Slippage           int                      `json:"slippage,omitempty"`
    CheckPrerequisites bool                     `json:"checkPrerequisites"`
    ConnectedWallets   []map[string]interface{} `json:"connectedWallets,omitempty"`
}

type ISwapService interface {
    FindBestSwap(swapReq SwapRequest) (*SwapResponse, error)
}
