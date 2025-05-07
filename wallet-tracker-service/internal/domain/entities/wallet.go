package entities

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Wallet represents a blockchain wallet
type Wallet struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Blockchain    string             `bson:"blockchain" json:"blockchain"`
	Address       string             `bson:"address" json:"address"`
	Balance       float64            `bson:"balance" json:"balance"`
	Balances      []Balance          `bson:"balances" json:"balances,omitempty"`
	LastUpdated   time.Time          `bson:"lastUpdated" json:"lastUpdated"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
}

// Asset represents a token/coin in a wallet
type Asset struct {
	Symbol      string  `bson:"symbol" json:"symbol"`
	Name        string  `bson:"name" json:"name"`
	Decimals    int     `bson:"decimals" json:"decimals"`
	LogoURI     string  `bson:"logoURI,omitempty" json:"logoURI,omitempty"`
	CoingeckoID string  `bson:"coingeckoId,omitempty" json:"coingeckoId,omitempty"`
	USDPrice    float64 `bson:"usdPrice,omitempty" json:"usdPrice,omitempty"`
}

// Balance represents a token balance in a wallet
type Balance struct {
	Asset        Asset   `bson:"asset" json:"asset"`
	Amount       string  `bson:"amount" json:"amount"`
	FormattedAmount string  `bson:"formattedAmount" json:"formattedAmount"`
	USDValue     float64 `bson:"usdValue" json:"usdValue"`
}

// WalletBalances represents all balances for a wallet
type WalletBalances struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Blockchain string            `bson:"blockchain" json:"blockchain"`
	Address    string            `bson:"address" json:"address"`
	Balances   []Balance         `bson:"balances" json:"balances"`
	UpdatedAt  time.Time         `bson:"updatedAt" json:"updatedAt"`
} 