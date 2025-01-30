package services

import (
	"github.com/noymaxx/backend/internal/application/usecases"
	"github.com/noymaxx/backend/internal/domain/entities"
)

func FindBestSwap(from entities.Asset, to entities.Asset, amount string, slippage int, connectedWallets []map[string]interface{}) (*usecases.SwapResponse, error) {
	swapReq := usecases.SwapRequest{
		From:              from,
		To:                to,
		Amount:            amount,
		Slippage:          slippage,
		CheckPrerequisites: false,
		ConnectedWallets:  connectedWallets,
	}

	return usecases.GetBestSwapRoute(swapReq)
}
