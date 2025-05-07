package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/panoramablock/wallet-tracker-service/internal/application/services"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/config"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/database/dbmongo"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/http/controllers"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/logs"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/repositories"
)

func SetupRoutes(
	app *fiber.App,
	logger *logs.Logger,
	mongoClient *dbmongo.MongoClient,
	redisClient *redis.Client,
	conf *config.Config,
) {
	// Repositories
	walletRepo := repositories.NewWalletRepository(mongoClient, conf.MongoDBName)
	balanceRepo := repositories.NewBalanceRepository(mongoClient, conf.MongoDBName)

	// Services
	walletService := services.NewWalletService(logger, walletRepo, balanceRepo, redisClient)

	// Controllers
	walletController := controllers.NewWalletController(walletService, logger)

	// API version group
	api := app.Group("/api")

	// Health check endpoint
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"service": "wallet-tracker",
		})
	})

	// Wallet Routes
	walletAPI := api.Group("/wallets")
	walletAPI.Get("/details", walletController.GetBalanceAndStore)
	walletAPI.Get("/addresses", walletController.GetAllAddresses)
	walletAPI.Get("/tokens", walletController.GetAllTokensByAddress)
} 