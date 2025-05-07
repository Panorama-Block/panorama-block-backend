package entities

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	WalletAddress string             `bson:"wallet_address" json:"wallet_address"`
	CreatedAt     int64              `bson:"created_at" json:"created_at"`
}
