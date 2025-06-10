package config

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type Config struct {
	ServerPort  string
	RangoAPIKey string
	MongoURI    string
	MongoDBName string

	// Redis
	RedisHost     string
	RedisPort     string
	RedisPassword string

	// Auth Service
	AuthServiceURL string

	// Debug
	Debug bool
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("WALLET_TRACKER_PORT")
		if port == "" {
			port = "3000" // Default port based on .env
		}
	}

	authServiceURL := os.Getenv("AUTH_SERVICE_URL")
	if authServiceURL == "" {
		authPort := os.Getenv("AUTH_PORT")
		if authPort == "" {
			authPort = "3001"
		}
		authServiceURL = fmt.Sprintf("http://auth_service:%s", authPort)
	}

	debug := os.Getenv("DEBUG") == "true"

	config := &Config{
		ServerPort:     port,
		RangoAPIKey:    os.Getenv("X_RANGO_ID"),
		MongoURI:       os.Getenv("MONGO_URI"),
		MongoDBName:    os.Getenv("MONGO_DB_NAME"),
		RedisHost:      os.Getenv("REDIS_HOST"),
		RedisPort:      os.Getenv("REDIS_PORT"),
		RedisPassword:  os.Getenv("REDIS_PASS"),
		AuthServiceURL: authServiceURL,
		Debug:          debug,
	}

	if config.Debug {
		fmt.Printf("[Config] Loaded configuration:\n")
		fmt.Printf("- ServerPort: %s\n", config.ServerPort)
		fmt.Printf("- MongoURI: %s\n", config.MongoURI)
		fmt.Printf("- MongoDBName: %s\n", config.MongoDBName)
		fmt.Printf("- RedisHost: %s\n", config.RedisHost)
		fmt.Printf("- RedisPort: %s\n", config.RedisPort)
		fmt.Printf("- AuthServiceURL: %s\n", config.AuthServiceURL)
		fmt.Printf("- RangoAPIKey: %s\n", config.RangoAPIKey)
	}

	return config
}

// ConnectRedis connects to Redis with proper configuration
func ConnectRedis(conf *Config) (*redis.Client, error) {
	if conf.RedisHost == "" {
		return nil, fmt.Errorf("Redis not configured - REDIS_HOST is empty")
	}

	client := redis.NewClient(&redis.Options{
		Addr:        fmt.Sprintf("%s:%s", conf.RedisHost, conf.RedisPort),
		Password:    conf.RedisPassword,
		DB:          0,
		DialTimeout: 5 * time.Second,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := client.Ping(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	if conf.Debug {
		fmt.Printf("[Redis] Connected successfully to %s:%s\n", conf.RedisHost, conf.RedisPort)
	}

	return client, nil
} 