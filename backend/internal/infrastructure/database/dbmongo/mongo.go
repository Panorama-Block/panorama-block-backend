package dbmongo

import (
    "context"
    "fmt"
    "sync"
    "time"

    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

type MongoClient struct {
    Client *mongo.Client
}

var (
    instance *MongoClient
    once     sync.Once
)

func ConnectMongo(uri string) (*MongoClient, error) {
    var err error

    once.Do(func() {
        clientOpts := options.Client().ApplyURI(uri)
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()

        client, connErr := mongo.Connect(ctx, clientOpts)
        if connErr != nil {
            err = connErr
            return
        }
        // Ping
        if pingErr := client.Ping(ctx, nil); pingErr != nil {
            err = pingErr
            return
        }
        fmt.Println("Connected to MongoDB at:", uri)
        instance = &MongoClient{Client: client}
    })

    return instance, err
}

func GetClient() *MongoClient {
    return instance
}
