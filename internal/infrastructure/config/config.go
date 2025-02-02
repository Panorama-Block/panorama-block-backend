package config

import (
    "os"
)

type Config struct {
    ServerPort string
    RangoAPIKey string
    MongoURI    string
    MongoDBName string
}

func LoadConfig() *Config {
    port := os.Getenv("PORT")
    if port == "" {
        port = "3000"
    }

    return &Config{
        ServerPort:  port,
        RangoAPIKey: os.Getenv("X_RANGO_ID"),
        MongoURI:    os.Getenv("MONGO_URI"),
        MongoDBName: os.Getenv("MONGO_DB_NAME"),
    }
}
