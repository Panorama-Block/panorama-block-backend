package entities

import (
    "time"

    "go.mongodb.org/mongo-driver/bson/primitive"
)

type WalletBalances struct {
    ID         primitive.ObjectID `bson:"_id,omitempty"    json:"id,omitempty"`
    WalletID   primitive.ObjectID `bson:"walletId"         json:"walletId"`
    Blockchain string             `bson:"blockchain"       json:"blockchain"`
    Address    string             `bson:"address"          json:"address"`
    Balances   []Balance          `bson:"balances"         json:"balances"`
    UpdatedAt  time.Time          `bson:"updatedAt"        json:"updatedAt"`
}
