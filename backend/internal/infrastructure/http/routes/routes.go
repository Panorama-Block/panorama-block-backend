package routes

import (
    "github.com/gofiber/fiber/v2"
    "github.com/redis/go-redis/v9"
    "github.com/noymaxx/backend/internal/application/services"
    "github.com/noymaxx/backend/internal/infrastructure/config"
    "github.com/noymaxx/backend/internal/infrastructure/database/dbmongo"
    "github.com/noymaxx/backend/internal/infrastructure/http/controllers"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
    "github.com/noymaxx/backend/internal/infrastructure/repositories"
)

func SetupRoutes(
    app *fiber.App,
    logger *logs.Logger,
    mongoClient *dbmongo.MongoClient,
    redisClient *redis.Client,
    conf *config.Config,
) {
    // Repositórios
    walletRepo := repositories.NewWalletRepository(mongoClient, conf.MongoDBName)
    balanceRepo := repositories.NewBalanceRepository(mongoClient, conf.MongoDBName)

    // Serviços
    walletService := services.NewWalletService(logger, walletRepo, balanceRepo, redisClient)
    swapService := services.NewSwapService(*logger)

    // Controllers
    walletController := controllers.NewWalletController(walletService, logger)
    swapController := controllers.NewSwapController(swapService, *logger)

    // Rotas Wallet
    walletAPI := app.Group("/api/wallets")
    walletAPI.Get("/details", walletController.GetBalanceAndStore)
    walletAPI.Get("/addresses", walletController.GetAllAddresses)
    walletAPI.Get("/tokens", walletController.GetAllTokensByAddress)

    // Rotas Swap
    swapAPI := app.Group("/api/swap")
    swapAPI.Post("/best-route", swapController.BestSwapRoute)
}
