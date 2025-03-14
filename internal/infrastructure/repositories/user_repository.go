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

type IUserRepository interface {
	CreateUser(user entities.User) error
	GetUserByWalletAddress(walletAddress string) (*entities.User, error)
}

type UserRepository struct {
	collection *mongo.Collection
}

func NewUserRepository(dbClient *dbmongo.MongoClient, dbName string) *UserRepository {
	coll := dbClient.Client.Database(dbName).Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	indexModel := mongo.IndexModel{
		Keys: bson.D{{Key: "wallet_address", Value: 1}},
		Options: options.Index().SetUnique(true),
	}
	coll.Indexes().CreateOne(ctx, indexModel)

	return &UserRepository{collection: coll}
}

func (ur *UserRepository) CreateUser(user entities.User) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := ur.collection.InsertOne(ctx, user)
	return err
}

func (ur *UserRepository) GetUserByWalletAddress(walletAddress string) (*entities.User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"wallet_address": walletAddress}
	var user entities.User
	if err := ur.collection.FindOne(ctx, filter).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}
