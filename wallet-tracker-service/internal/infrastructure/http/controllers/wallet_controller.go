package controllers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/panoramablock/wallet-tracker-service/internal/application/services"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/logs"
)

type WalletController struct {
	walletService services.IWalletService
	logger        *logs.Logger
}

func NewWalletController(ws services.IWalletService, logger *logs.Logger) *WalletController {
	return &WalletController{
		walletService: ws,
		logger:        logger,
	}
}

// GetBalanceAndStore handles GET /api/wallets/details?address=BSC.0x123
func (wc *WalletController) GetBalanceAndStore(c *fiber.Ctx) error {
	addressParam := c.Query("address", "")
	if addressParam == "" {
		wc.logger.Warnf("Missing query param 'address'")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing query param 'address'",
		})
	}

	wallets, err := wc.walletService.FetchAndStoreBalance(addressParam)
	if err != nil {
		wc.logger.Errorf("Error fetching/storing wallet: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(wallets)
}

// GetAllAddresses handles GET /api/wallets/addresses
func (wc *WalletController) GetAllAddresses(c *fiber.Ctx) error {
	addresses, err := wc.walletService.GetAllAddresses()
	if err != nil {
		wc.logger.Errorf("Error getting addresses: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusOK).JSON(addresses)
}

// GetAllTokensByAddress handles GET /api/wallets/tokens?address=BSC.0x123&page=1&limit=50&symbol=BNB
func (wc *WalletController) GetAllTokensByAddress(c *fiber.Ctx) error {
	addressParam := c.Query("address", "")
	if addressParam == "" {
		wc.logger.Warnf("Missing query param 'address'")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing query param 'address'",
		})
	}

	// Get pagination params
	page, err := strconv.Atoi(c.Query("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(c.Query("limit", "50"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 50
	}

	// Get optional symbol filter
	symbol := c.Query("symbol", "")

	tokens, err := wc.walletService.GetWalletTokens(addressParam, page, limit, symbol)
	if err != nil {
		wc.logger.Errorf("Error getting tokens: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Return response
	return c.JSON(fiber.Map{
		"tokens": tokens,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"count": len(tokens),
		},
	})
} 