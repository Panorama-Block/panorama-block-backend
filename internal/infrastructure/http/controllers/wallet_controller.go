package controllers

import (
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

// GetBalanceAndStore => GET /api/wallets/details?address=BSC.0x123...
// Calls Rango, stores data in Mongo, returns the wallet doc(s)
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

// GetAllTokensByAddress => GET /api/wallets/tokens?address=BSC.0x123...
func (wc *WalletController) GetAllTokensByAddress(c *fiber.Ctx) error {
    addressParam := c.Query("address", "")
    if addressParam == "" {
        wc.logger.Warnf("Missing query param 'address'")
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": "Missing query param 'address'",
        })
    }

    wallet, err := wc.walletService.GetWalletTokens(addressParam)
    if err != nil {
        wc.logger.Errorf("Error getting wallet tokens: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
    }
    if wallet == nil {
        return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
            "error": "No wallet found for given address",
        })
    }

    // Return only the "balances" array
    return c.Status(fiber.StatusOK).JSON(wallet.Balances)
}
