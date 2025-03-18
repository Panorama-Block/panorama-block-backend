package controllers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/noymaxx/backend/internal/application/services"
	"github.com/noymaxx/backend/internal/infrastructure/logs"
)

type WalletController struct {
	walletService services.IWalletService
	logger        *logs.Logger
}

// NewWalletController creates a new WalletController instance.
func NewWalletController(ws services.IWalletService, logger *logs.Logger) *WalletController {
	return &WalletController{
		walletService: ws,
		logger:        logger,
	}
}

// GetBalanceAndStore fetches and stores wallet details.
func (wc *WalletController) GetBalanceAndStore(c *fiber.Ctx) error {
	userID := c.Locals("user").(string)
	addressParam := c.Query("address", "")
	if addressParam == "" {
		wc.logger.Warnf("Missing query param 'address'")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing query param 'address'",
		})
	}

	wallets, err := wc.walletService.FetchAndStoreBalance(userID, addressParam)
	if err != nil {
		wc.logger.Errorf("Error fetching/storing wallet for user %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(wallets)
}

// GetAllAddresses returns all wallet addresses for a user.
func (wc *WalletController) GetAllAddresses(c *fiber.Ctx) error {
	userID := c.Locals("user").(string)
	addresses, err := wc.walletService.GetAllAddresses(userID)
	if err != nil {
		wc.logger.Errorf("Error getting addresses for user %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusOK).JSON(addresses)
}

// GetWalletTokens retrieves wallet tokens with pagination and optional symbol filtering.
func (wc *WalletController) GetWalletTokens(c *fiber.Ctx) error {
	userID := c.Locals("user").(string)
	addressParam := c.Query("address", "")
	if addressParam == "" {
		wc.logger.Warnf("Missing query param 'address'")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Missing query param 'address'",
		})
	}

	// Parse pagination parameters with defaults.
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	symbol := c.Query("symbol", "")

	// Call the service method with the userID.
	tokens, err := wc.walletService.GetWalletTokens(userID, addressParam, page, limit, symbol)
	if err != nil {
		wc.logger.Errorf("Error getting wallet tokens for user %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if tokens == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "No wallet found or no tokens",
		})
	}

	return c.Status(fiber.StatusOK).JSON(tokens)
}
