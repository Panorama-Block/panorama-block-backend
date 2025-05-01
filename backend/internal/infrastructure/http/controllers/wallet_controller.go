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

func NewWalletController(ws services.IWalletService, logger *logs.Logger) *WalletController {
    return &WalletController{
        walletService: ws,
        logger:        logger,
    }
}

// GetBalanceAndStore (ex.: GET /api/wallets/details?address=BSC.0x123)
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

// GetAllAddresses => GET /api/wallets/addresses
func (wc *WalletController) GetAllAddresses(c *fiber.Ctx) error {
    addresses, err := wc.walletService.GetAllAddresses()
    if err != nil {
        wc.logger.Errorf("Error getting addresses: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
    }
    return c.Status(fiber.StatusOK).JSON(addresses)
}

// GetAllTokensByAddress => GET /api/wallets/tokens?address=BSC.0x123&page=1&limit=50&symbol=BNB
func (wc *WalletController) GetAllTokensByAddress(c *fiber.Ctx) error {
    addressParam := c.Query("address", "")
    if addressParam == "" {
        wc.logger.Warnf("Missing query param 'address'")
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": "Missing query param 'address'",
        })
    }

    page, _ := strconv.Atoi(c.Query("page", "1"))
    limit, _ := strconv.Atoi(c.Query("limit", "50"))
    symbol := c.Query("symbol", "")

    tokens, err := wc.walletService.GetWalletTokens(addressParam, page, limit, symbol)
    if err != nil {
        wc.logger.Errorf("Error getting wallet tokens: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
    }
    if tokens == nil {
        return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
            "error": "No wallet found or no tokens",
        })
    }

    return c.Status(fiber.StatusOK).JSON(tokens)
}
