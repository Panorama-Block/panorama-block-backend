package main

import (
    "log"
    "time"
    "strings"

    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/cors"
    "github.com/gofiber/fiber/v2/middleware/recover"
    "github.com/joho/godotenv"
    "github.com/robfig/cron/v3"
    "github.com/noymaxx/backend/internal/infrastructure/config"
    "github.com/noymaxx/backend/internal/infrastructure/database/dbmongo"
    "github.com/noymaxx/backend/internal/infrastructure/http/routes"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
    "github.com/noymaxx/backend/internal/infrastructure/security"
    "github.com/noymaxx/backend/internal/infrastructure/repositories"
    "github.com/noymaxx/backend/internal/application/services"
)

func main() {
    // Carrega variáveis de ambiente
    if err := godotenv.Load(); err != nil {
        log.Println("Warning: .env file not found or couldn't be loaded.")
    }

    // Inicia logger
    logger := logs.NewLogger()

    // Lê config
    conf := config.LoadConfig()

    // Conecta ao MongoDB
    mongoClient, err := dbmongo.ConnectMongo(conf.MongoURI)
    if err != nil {
        logger.Fatalf("Error connecting to MongoDB: %v", err)
    }

    // Opcional: Conecta ao Redis (para caching)
    redisClient, err := config.ConnectRedis(conf)
    if err != nil {
        logger.Warnf("Redis not connected: %v", err)
        // Segue sem cache se falhar
    }

    // Cria uma nova instância do Fiber
    app := fiber.New(fiber.Config{
        DisableStartupMessage: true,
    })

    // Middleware de recuperação de panics
    app.Use(recover.New())
    
    // Lista de origens permitidas
    allowedOrigins := []string{
        "*",
    }

    app.Use(cors.New(cors.Config{
        AllowOrigins:     strings.Join(allowedOrigins, ","),
        AllowMethods:     "GET,POST,HEAD,PUT,DELETE,PATCH,OPTIONS",
        AllowHeaders:     "Origin, Content-Type, Accept, X-Rango-Id, Authorization",
        ExposeHeaders:    "Content-Length",
        MaxAge:           3600,
    }))

    // Middleware de Rate Limiting (exemplo)
    app.Use(security.NewRateLimiter())

    // Seta rotas
    routes.SetupRoutes(app, logger, mongoClient, redisClient, conf)

    // Scheduler para atualizar wallets periodicamente
    c := cron.New()
    // "0 * * * *" => a cada hora
    c.AddFunc("@every 30m", func() {
        // Exemplo: Atualiza todos endereços a cada 30 minutos
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

    // Inicia o servidor
    if conf.Fullchain != "" && conf.Privkey != "" {
        logger.Infof("Starting server on port %s with HTTPS", conf.ServerPort)
        if err := app.ListenTLS(":"+conf.ServerPort, conf.Fullchain, conf.Privkey); err != nil {
            logger.Fatalf("Server failed to start: %v", err)
        }
    } else {
        logger.Infof("Starting server on port %s", conf.ServerPort)
        if err := app.Listen(":"+conf.ServerPort); err != nil {
            logger.Fatalf("Server failed to start: %v", err)
        }
    }
}
