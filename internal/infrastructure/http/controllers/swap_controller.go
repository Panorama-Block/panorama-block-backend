package controllers

import (
    "github.com/gofiber/fiber/v2"
    "github.com/noymaxx/backend/internal/domain/entities"
    "github.com/noymaxx/backend/internal/domain/interfaces"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
)

type SwapController struct {
    SwapService interfaces.ISwapService
    Logger      logs.Logger
}

// NewSwapController constructor
func NewSwapController(svc interfaces.ISwapService, logger logs.Logger) *SwapController {
    return &SwapController{
        SwapService: svc,
        Logger:      logger,
    }
}

func (s *SwapController) BestSwapRoute(c *fiber.Ctx) error {
    req := new(struct {
        From             entities.Asset          `json:"from"`
        To               entities.Asset          `json:"to"`
        Amount           string                  `json:"amount"`
        Slippage         int                     `json:"slippage"`
        ConnectedWallets []map[string]interface{} `json:"connectedWallets"`
    })

    if err := c.BodyParser(req); err != nil {
        s.Logger.Warnf("Invalid request payload: %v", err)
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
            "error": "Invalid request payload",
        })
    }

    // Build SwapRequest from the payload
    swapRequest := interfaces.SwapRequest{
        From:               req.From,
        To:                 req.To,
        Amount:             req.Amount,
        Slippage:           req.Slippage,
        CheckPrerequisites: false,
        ConnectedWallets:   req.ConnectedWallets,
    }

    // Call the SwapService to get the best route
    swapRes, err := s.SwapService.FindBestSwap(swapRequest)
    if err != nil {
        s.Logger.Errorf("Error finding best swap: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
            "error": err.Error(),
        })
    }

    return c.Status(fiber.StatusOK).JSON(swapRes)
}
