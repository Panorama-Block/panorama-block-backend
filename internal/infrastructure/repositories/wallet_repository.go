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

type IWalletRepository interface {
    InsertOrUpdateWallet(wallet entities.Wallet) error
    GetWalletByBlockchainAddress(userID, blockchain, address string) (*entities.Wallet, error)
    GetAllAddressesByUser(userID string) ([]string, error)
}

type WalletRepository struct {
    collection *mongo.Collection
}

func NewWalletRepository(dbClient *dbmongo.MongoClient, dbName string) *WalletRepository {
    coll := dbClient.Client.Database(dbName).Collection("wallets")

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    indexModel := mongo.IndexModel{
        Keys: bson.D{
            {Key: "user_id", Value: 1},
            {Key: "blockchain", Value: 1},
            {Key: "address", Value: 1},
        },
        Options: options.Index().SetUnique(true),
    }
    coll.Indexes().CreateOne(ctx, indexModel)

    return &WalletRepository{collection: coll}
}



func (wr *WalletRepository) GetWalletByBlockchainAddress(userID, blockchain, address string) (*entities.Wallet, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    filter := bson.M{
        "user_id":    userID,
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

func (wr *WalletRepository) InsertOrUpdateWallet(wallet entities.Wallet) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"user_id":    wallet.UserID, // Agora é o wallet_address
		"blockchain": wallet.Blockchain,
		"address":    wallet.Address,
	}
	update := bson.M{"$set": wallet}
	opts := options.Update().SetUpsert(true)

	_, err := wr.collection.UpdateOne(ctx, filter, update, opts)
	return err
}

func (wr *WalletRepository) GetAllAddressesByUser(walletAddress string) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"user_id": walletAddress}
	cursor, err := wr.collection.Find(ctx, filter)
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
		addresses = append(addresses, w.Blockchain+"."+w.Address)
	}

	return addresses, nil
}
