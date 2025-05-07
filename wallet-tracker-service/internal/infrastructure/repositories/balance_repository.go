package repositories

import (
	"context"
	"time"

	"github.com/panoramablock/wallet-tracker-service/internal/domain/entities"
	"github.com/panoramablock/wallet-tracker-service/internal/infrastructure/database/dbmongo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type IBalanceRepository interface {
	SaveBalances(balances *entities.WalletBalances) error
	GetBalancesByWallet(blockchain, address string) (*entities.WalletBalances, error)
}

type BalanceRepository struct {
	mongoClient *dbmongo.MongoClient
	dbName      string
	collection  string
}

func NewBalanceRepository(mongoClient *dbmongo.MongoClient, dbName string) *BalanceRepository {
	return &BalanceRepository{
		mongoClient: mongoClient,
		dbName:      dbName,
		collection:  "balances",
	}
}

func (r *BalanceRepository) SaveBalances(balances *entities.WalletBalances) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	balances.UpdatedAt = time.Now()
	
	collection := r.mongoClient.Client.Database(r.dbName).Collection(r.collection)
	
	filter := bson.M{
		"blockchain": balances.Blockchain,
		"address":    balances.Address,
	}
	
	opts := options.Replace().SetUpsert(true)
	
	_, err := collection.ReplaceOne(ctx, filter, balances, opts)
	return err
}

func (r *BalanceRepository) GetBalancesByWallet(blockchain, address string) (*entities.WalletBalances, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	collection := r.mongoClient.Client.Database(r.dbName).Collection(r.collection)
	
	filter := bson.M{
		"blockchain": blockchain,
		"address":    address,
	}
	
	var balances entities.WalletBalances
	err := collection.FindOne(ctx, filter).Decode(&balances)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	
	return &balances, nil
} 