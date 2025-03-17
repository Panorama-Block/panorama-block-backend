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

func (wc *WalletController) GetBalanceAndStore(c *fiber.Ctx) error {
    userID := c.Locals("user").(string) 
    addressParam := c.Query("address", "")
    if addressParam == "" {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": "Missing query param 'address'",
        })
    }

    wallets, err := wc.walletService.FetchAndStoreBalance(userID, addressParam)
    if err != nil {
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
    }

    return c.Status(fiber.StatusOK).JSON(wallets)
}

func (wc *WalletController) GetAllAddresses(c *fiber.Ctx) error {
    userID := c.Locals("user").(string) 
    addresses, err := wc.walletService.GetAllAddresses(userID)
    if err != nil {
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
    }
    return c.Status(fiber.StatusOK).JSON(addresses)
}


