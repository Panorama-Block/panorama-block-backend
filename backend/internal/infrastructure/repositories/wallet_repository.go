package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/noymaxx/backend/internal/domain/entities"
	"github.com/noymaxx/backend/internal/infrastructure/database/dbmongo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type IWalletRepository interface {
    InsertOrUpdateWallet(wallet entities.Wallet) error
    GetWalletByBlockchainAddress(blockchain, address string) (*entities.Wallet, error)
    GetAllAddresses() ([]string, error)
}

type WalletRepository struct {
    collection *mongo.Collection
}

func NewWalletRepository(dbClient *dbmongo.MongoClient, dbName string) *WalletRepository {
    coll := dbClient.Client.Database(dbName).Collection("wallets")

    // create composite index
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    indexModel := mongo.IndexModel{
        Keys: bson.D{{Key: "blockchain", Value: 1}, {Key: "address", Value: 1}},
        Options: options.Index().SetUnique(true),
    }
    coll.Indexes().CreateOne(ctx, indexModel)

    return &WalletRepository{collection: coll}
}

func (wr *WalletRepository) InsertOrUpdateWallet(wallet entities.Wallet) error {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    filter := bson.M{
        "blockchain": wallet.Blockchain,
        "address":    wallet.Address,
    }
    update := bson.M{"$set": wallet}
    opts := options.Update().SetUpsert(true)

    _, err := wr.collection.UpdateOne(ctx, filter, update, opts)
    return err
}

func (wr *WalletRepository) GetWalletByBlockchainAddress(blockchain, address string) (*entities.Wallet, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    filter := bson.M{
        "blockchain": blockchain,
        "address":    address,
    }

    var wallet entities.Wallet
    err := wr.collection.FindOne(ctx, filter).Decode(&wallet)
    if err != nil {
        if err == mongo.ErrNoDocuments {
            return nil, nil
        }
        return nil, err
    }
    return &wallet, nil
}

func (wr *WalletRepository) GetAllAddresses() ([]string, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    cursor, err := wr.collection.Find(ctx, bson.D{})
    if err != nil {
        return nil, err
    }
    defer cursor.Close(ctx)

    var addresses []string
    for cursor.Next(ctx) {
        var w entities.Wallet
        if err := cursor.Decode(&w); err != nil {
            return nil, err
        }
        addresses = append(addresses, fmt.Sprintf("%s.%s", w.Blockchain, w.Address))
    }

    return addresses, nil
}
