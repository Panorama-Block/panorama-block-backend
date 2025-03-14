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
	"github.com/noymaxx/backend/internal/infrastructure/middleware"
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
	userRepo := repositories.NewUserRepository(mongoClient, conf.MongoDBName)

	// Serviços
	walletService := services.NewWalletService(logger, walletRepo, balanceRepo, redisClient)

	// Controllers
	authController := controllers.NewAuthController(userRepo, logger)
	walletController := controllers.NewWalletController(walletService, logger)

	// Rotas de autenticação
	authAPI := app.Group("/api/auth")
	authAPI.Post("/login", authController.AuthenticateUser)

	// Rotas Wallet (Protegidas por autenticação)
	walletAPI := app.Group("/api/wallets", middleware.AuthMiddleware())
	walletAPI.Get("/details", walletController.GetBalanceAndStore)
	walletAPI.Get("/addresses", walletController.GetAllAddresses)
}
