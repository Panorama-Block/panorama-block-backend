package entities

import (
    "go.mongodb.org/mongo-driver/bson/primitive"
)

type Wallet struct {
    ID          primitive.ObjectID `bson:"_id,omitempty"    json:"id,omitempty"`
    Blockchain  string             `bson:"blockchain"       json:"blockchain"`
    Address     string             `bson:"address"          json:"address"`
    Failed      bool               `bson:"failed"           json:"failed"`
    ExplorerUrl string             `bson:"explorerUrl"      json:"explorerUrl"`

    Balances []Balance `json:"balances,omitempty" bson:"-"`
}