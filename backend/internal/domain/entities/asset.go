package entities

type Asset struct {
    Blockchain string `json:"blockchain"`
    Symbol     string `json:"symbol"`
    Address    string `json:"address"`
}
