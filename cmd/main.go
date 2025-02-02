package main

import (
    "log"

    "github.com/gofiber/fiber/v2"
    "github.com/joho/godotenv"
    "github.com/noymaxx/backend/internal/infrastructure/config"
    "github.com/noymaxx/backend/internal/infrastructure/database/dbmongo"
    "github.com/noymaxx/backend/internal/infrastructure/http/routes"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
)

func main() {
    // Load environment variables from .env
    if err := godotenv.Load(); err != nil {
        log.Println("Warning: .env file not found or couldn't be loaded.")
    }

    // Create logger (pointer)
    logger := logs.NewLogger()

    // Load config (e.g. Rango API key, DB name, port, etc.)
    conf := config.LoadConfig()

    // Connect to MongoDB
    mongoClient, err := dbmongo.ConnectMongo(conf.MongoURI)
    if err != nil {
        logger.Fatalf("Error connecting to MongoDB: %v", err)
    }

    // Create a new Fiber instance
    app := fiber.New()

    // Setup all routes (swap + wallet)
    routes.SetupRoutes(app, logger, mongoClient, conf)

    logger.Infof("Starting server on port %s", conf.ServerPort)
    if err := app.Listen(":" + conf.ServerPort); err != nil {
        logger.Fatalf("Server failed to start: %v", err)
    }
}
