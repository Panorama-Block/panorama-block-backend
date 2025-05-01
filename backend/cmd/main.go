package main

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"github.com/noymaxx/backend/internal/application/services"
	"github.com/noymaxx/backend/internal/infrastructure/config"
	"github.com/noymaxx/backend/internal/infrastructure/database/dbmongo"
	"github.com/noymaxx/backend/internal/infrastructure/http/routes"
	"github.com/noymaxx/backend/internal/infrastructure/logs"
	"github.com/noymaxx/backend/internal/infrastructure/repositories"
	"github.com/noymaxx/backend/internal/infrastructure/security"
	"github.com/robfig/cron/v3"
)

func main() {
    // Load environment variables
    if err := godotenv.Load(); err != nil {
        log.Println("Warning: .env file not found or couldn't be loaded.")
    }

    // Initialize logger
    logger := logs.NewLogger()

    // Read config
    conf := config.LoadConfig()

    // Connect to MongoDB
    mongoClient, err := dbmongo.ConnectMongo(conf.MongoURI)
    if err != nil {
        logger.Fatalf("Error connecting to MongoDB: %v", err)
    }

    // Optional: Connect to Redis (for caching)
    redisClient, err := config.ConnectRedis(conf)
    if err != nil {
        logger.Warnf("Redis not connected: %v", err)
        // Continue without cache if it fails
    }

    // Create a new instance of Fiber
    app := fiber.New()

    // Middleware for panic recovery
    app.Use(recover.New())

    // Rate Limiting middleware (example)
    app.Use(security.NewRateLimiter())

    // Set up routes
    routes.SetupRoutes(app, logger, mongoClient, redisClient, conf)

    // Scheduler to update wallets periodically
    c := cron.New()
    // "0 * * * *" => every hour
    c.AddFunc("@every 30m", func() {
        // Example: Update all addresses every 30 minutes
        repo := repositories.NewWalletRepository(mongoClient, conf.MongoDBName)
        addresses, err := repo.GetAllAddresses()
        if err != nil {
            logger.Errorf("Cron job error: %v", err)
            return
        }

        balanceRepo := repositories.NewBalanceRepository(mongoClient, conf.MongoDBName)
        walletService := services.NewWalletService(logger, repo, balanceRepo, redisClient)
        for _, addr := range addresses {
            if _, err := walletService.FetchAndStoreBalance(addr); err != nil {
                logger.Errorf("Cron update for address %s: %v", addr, err)
            }
            time.Sleep(1 * time.Second) 
        }
    })
    c.Start()

    // Start the server
    logger.Infof("Starting server on port %s", conf.ServerPort)
    if err := app.Listen(":" + conf.ServerPort); err != nil {
        logger.Fatalf("Server failed to start: %v", err)
    }
}
