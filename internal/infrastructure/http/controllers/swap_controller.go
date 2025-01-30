package controllers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/noymaxx/backend/internal/application/services"
	"github.com/noymaxx/backend/internal/domain/entities"
)

func BestSwapRoute(c *fiber.Ctx) error {
	req := new(struct {
		From             entities.Asset       `json:"from"`
		To               entities.Asset       `json:"to"`
		Amount           string               `json:"amount"`
		Slippage         int              `json:"slippage"`
		ConnectedWallets []map[string]interface{} `json:"connectedWallets"`
	})

	if err := c.BodyParser(req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	swapRes, err := services.FindBestSwap(req.From, req.To, req.Amount, req.Slippage, req.ConnectedWallets)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(swapRes)
}
