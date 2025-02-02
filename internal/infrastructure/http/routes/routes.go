package routes

import (
    "github.com/gofiber/fiber/v2"
    "github.com/noymaxx/backend/internal/application/services"
    "github.com/noymaxx/backend/internal/infrastructure/repositories"
    "github.com/noymaxx/backend/internal/infrastructure/config"
    "github.com/noymaxx/backend/internal/infrastructure/database/dbmongo"
    "github.com/noymaxx/backend/internal/infrastructure/http/controllers"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
)

// SetupRoutes sets up all routes
func SetupRoutes(
    app *fiber.App,
    logger *logs.Logger,
    mongoClient *dbmongo.MongoClient,
    conf *config.Config,
) {
    // --- Swap Setup ---
    swapService := services.NewSwapService(*logger)
    swapController := controllers.NewSwapController(swapService, *logger)

    swapAPI := app.Group("/api/swap")
    swapAPI.Post("/best-route", swapController.BestSwapRoute)

    // --- Wallet Setup ---
    walletRepo := repositories.NewWalletRepository(mongoClient, conf.MongoDBName)
    walletService := services.NewWalletService(logger, walletRepo)
    walletController := controllers.NewWalletController(walletService, logger)

    walletAPI := app.Group("/api/wallets")
    // 1) GET /api/wallets/details?address=BSC.0x123
    walletAPI.Get("/details", walletController.GetBalanceAndStore)
    // 2) GET /api/wallets/addresses
    walletAPI.Get("/addresses", walletController.GetAllAddresses)
    // 3) GET /api/wallets/tokens?address=BSC.0x123
    walletAPI.Get("/tokens", walletController.GetAllTokensByAddress)
}
