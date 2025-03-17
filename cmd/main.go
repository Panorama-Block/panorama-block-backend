package main

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
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
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found or couldn't be loaded.")
	}

	logger := logs.NewLogger()
	conf := config.LoadConfig()

	mongoClient, err := dbmongo.ConnectMongo(conf.MongoURI)
	if err != nil {
		logger.Fatalf("Error connecting to MongoDB: %v", err)
	}

	redisClient, err := config.ConnectRedis(conf)
	if err != nil {
		logger.Warnf("Redis not connected: %v", err)
	}

	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	app.Use(recover.New())
	allowedOrigins := "http://localhost:3000, http://localhost:8000, https://api.panoramablock.com, https://panoramablock.com"

	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     "GET,POST,HEAD,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders:     "Origin, Content-Type, Accept, X-Rango-Id, Authorization",
		ExposeHeaders:    "Content-Length",
		AllowCredentials: false,
		MaxAge:           3600,
	}))

	app.Use(security.NewRateLimiter())
	routes.SetupRoutes(app, logger, mongoClient, redisClient, conf)

    c := cron.New()
    c.AddFunc("@every 30m", func() {
        repo := repositories.NewWalletRepository(mongoClient, conf.MongoDBName)
        balanceRepo := repositories.NewBalanceRepository(mongoClient, conf.MongoDBName)
        walletService := services.NewWalletService(logger, repo, balanceRepo, redisClient)
        userRepo := repositories.NewUserRepository(mongoClient, conf.MongoDBName)
        users, err := userRepo.GetAllUsers()
        if err != nil {
            logger.Errorf("Cron job error fetching users: %v", err)
            return
        }

        for _, user := range users {
            addresses, err := repo.GetAllAddressesByUser(user.ID.Hex())
            if err != nil {
                logger.Errorf("Cron job error fetching addresses for user %s: %v", user.ID.Hex(), err)
                continue
            }

            for _, addr := range addresses {
                if _, err := walletService.FetchAndStoreBalance(user.ID.Hex(), addr); err != nil {
                    logger.Errorf("Cron update for user %s, address %s: %v", user.ID.Hex(), addr, err)
                }
                time.Sleep(1 * time.Second)
            }
        }
    })
    c.Start()

	if conf.Fullchain != "" && conf.Privkey != "" {
		logger.Infof("Starting server on port %s with HTTPS", conf.ServerPort)
		if err := app.ListenTLS(":"+conf.ServerPort, conf.Fullchain, conf.Privkey); err != nil {
			logger.Fatalf("Server failed to start: %v", err)
		}
	} else {
		logger.Infof("Starting server on port %s", conf.ServerPort)
		if err := app.Listen(":" + conf.ServerPort); err != nil {
			logger.Fatalf("Server failed to start: %v", err)
		}
	}
}