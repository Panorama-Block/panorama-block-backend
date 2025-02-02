package entities

// Wallet represents a user's wallet balance data as returned by Rango
type Wallet struct {
    Blockchain  string     `bson:"blockchain" json:"blockchain"`
    Address     string     `bson:"address" json:"address"`
    Failed      bool       `bson:"failed" json:"failed"`
    ExplorerUrl string     `bson:"explorerUrl" json:"explorerUrl"`
    Balances    []Balance  `bson:"balances" json:"balances"`
}

// Balance is a single token balance
type Balance struct {
    Asset  Asset      `bson:"asset" json:"asset"`
    Amount AmountInfo `bson:"amount" json:"amount"`
    Price  float64    `bson:"price" json:"price"`
}

// AmountInfo holds the token amount and decimals
type AmountInfo struct {
    Amount   string `bson:"amount" json:"amount"`
    Decimals int    `bson:"decimals" json:"decimals"`
}
