package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/panoramablock/wallet-tracker-service/internal/domain/entities"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/database/dbmongo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type IWalletRepository interface {
	SaveWallet(wallet *entities.Wallet) error
	GetWallet(blockchain, address string) (*entities.Wallet, error)
	GetAllAddresses() ([]string, error)
	GetAllWallets() ([]entities.Wallet, error)
}

type WalletRepository struct {
	mongoClient *dbmongo.MongoClient
	dbName      string
	collection  string
}

func NewWalletRepository(mongoClient *dbmongo.MongoClient, dbName string) *WalletRepository {
	return &WalletRepository{
		mongoClient: mongoClient,
		dbName:      dbName,
		collection:  "wallets",
	}
}

func (r *WalletRepository) SaveWallet(wallet *entities.Wallet) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	wallet.LastUpdated = time.Now()
	
	collection := r.mongoClient.Client.Database(r.dbName).Collection(r.collection)
	
	filter := bson.M{
		"blockchain": wallet.Blockchain,
		"address":    wallet.Address,
	}
	
	opts := options.Replace().SetUpsert(true)
	
	_, err := collection.ReplaceOne(ctx, filter, wallet, opts)
	return err
}

func (r *WalletRepository) GetWallet(blockchain, address string) (*entities.Wallet, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	collection := r.mongoClient.Client.Database(r.dbName).Collection(r.collection)
	
	filter := bson.M{
		"blockchain": blockchain,
		"address":    address,
	}
	
	var wallet entities.Wallet
	err := collection.FindOne(ctx, filter).Decode(&wallet)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	
	return &wallet, nil
}

func (r *WalletRepository) GetAllAddresses() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	collection := r.mongoClient.Client.Database(r.dbName).Collection(r.collection)
	
	pipeline := mongo.Pipeline{
		{{Key: "$project", Value: bson.M{"fullAddress": bson.M{"$concat": []string{"$blockchain", ".", "$address"}}}}},
		{{Key: "$group", Value: bson.M{"_id": nil, "addresses": bson.M{"$addToSet": "$fullAddress"}}}},
	}
	
	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("aggregate error: %w", err)
	}
	defer cursor.Close(ctx)
	
	var results []map[string][]string
	if err = cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("cursor error: %w", err)
	}
	
	if len(results) == 0 {
		return []string{}, nil
	}
	
	return results[0]["addresses"], nil
}

func (r *WalletRepository) GetAllWallets() ([]entities.Wallet, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	collection := r.mongoClient.Client.Database(r.dbName).Collection(r.collection)
	
	opts := options.Find().SetSort(bson.D{{Key: "lastUpdated", Value: -1}})
	
	cursor, err := collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	
	var wallets []entities.Wallet
	if err = cursor.All(ctx, &wallets); err != nil {
		return nil, err
	}
	
	return wallets, nil
} 