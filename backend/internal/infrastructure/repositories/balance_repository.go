package repositories

import (
	"context"
	"time"

	"github.com/noymaxx/backend/internal/domain/entities"
	"github.com/noymaxx/backend/internal/infrastructure/database/dbmongo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type IBalanceRepository interface {
    InsertOrUpdateBalances(bal entities.WalletBalances) error
    GetBalancesByWallet(blockchain, address string) (*entities.WalletBalances, error)
}

type BalanceRepository struct {
    collection *mongo.Collection
}

func NewBalanceRepository(dbClient *dbmongo.MongoClient, dbName string) *BalanceRepository {
    coll := dbClient.Client.Database(dbName).Collection("wallet_balances")

    // create composite index
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    indexModel := mongo.IndexModel{
        Keys: bson.D{{Key: "blockchain", Value: 1}, {Key: "address", Value: 1}},
        Options: options.Index().SetUnique(true),
    }
    coll.Indexes().CreateOne(ctx, indexModel)

    return &BalanceRepository{collection: coll}
}

func (br *BalanceRepository) InsertOrUpdateBalances(bal entities.WalletBalances) error {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    filter := bson.M{
        "blockchain": bal.Blockchain,
        "address":    bal.Address,
    }
    update := bson.M{"$set": bal}
    opts := options.Update().SetUpsert(true)

    _, err := br.collection.UpdateOne(ctx, filter, update, opts)
    return err
}

func (br *BalanceRepository) GetBalancesByWallet(blockchain, address string) (*entities.WalletBalances, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    filter := bson.M{"blockchain": blockchain, "address": address}
    var wb entities.WalletBalances
    err := br.collection.FindOne(ctx, filter).Decode(&wb)
    if err != nil {
        if err == mongo.ErrNoDocuments {
            return nil, nil
        }
        return nil, err
    }
    return &wb, nil
}
