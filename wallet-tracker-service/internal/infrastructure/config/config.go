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
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3002" // Default port for Wallet Tracker service
	}

	authServiceURL := os.Getenv("AUTH_SERVICE_URL")
	if authServiceURL == "" {
		authServiceURL = "http://auth-service:3001" // Default URL for Auth service
	}

	return &Config{
		ServerPort:     port,
		RangoAPIKey:    os.Getenv("X_RANGO_ID"),
		MongoURI:       os.Getenv("MONGO_URI"),
		MongoDBName:    os.Getenv("MONGO_DB_NAME"),
		RedisHost:      os.Getenv("REDIS_HOST"),
		RedisPort:      os.Getenv("REDIS_PORT"),
		RedisPassword:  os.Getenv("REDIS_PASS"),
		AuthServiceURL: authServiceURL,
	}
}

// Conexão simples com Redis
func ConnectRedis(conf *Config) (*redis.Client, error) {
	if conf.RedisHost == "" {
		return nil, fmt.Errorf("Redis not configured")
	}
	client := redis.NewClient(&redis.Options{
		Addr:        fmt.Sprintf("%s:%s", conf.RedisHost, conf.RedisPort),
		Password:    conf.RedisPassword,
		DB:          0,
		DialTimeout: 5 * time.Second,
	})
	// teste de conexão
	_, err := client.Ping(context.Background()).Result()
	if err != nil {
		return nil, err
	}
	return client, nil
} 