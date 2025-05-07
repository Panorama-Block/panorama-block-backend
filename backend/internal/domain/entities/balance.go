package entities

type Balance struct {
    Asset  Asset      `bson:"asset" json:"asset"`
    Amount AmountInfo `bson:"amount" json:"amount"`
    Price  float64    `bson:"price" json:"price"`
}

type AmountInfo struct {
    Amount   string `bson:"amount" json:"amount"`
    Decimals int    `bson:"decimals" json:"decimals"`
}
