package security

import (
	"errors"
	"github.com/golang-jwt/jwt/v4"
	"time"
)

type WalletClaims struct {
	WalletAddress string `json:"wallet_address"`
	jwt.StandardClaims
}

var jwtKey = []byte("your_secret_key")

// Generate a JWT token for the wallet address
func GenerateToken(walletAddress string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &WalletClaims{
		WalletAddress: walletAddress,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

// Verifies the JWT token and returns the wallet address
func VerifyWalletToken(tokenStr string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &WalletClaims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil {
		return "", errors.New("invalid token")
	}

	if claims, ok := token.Claims.(*WalletClaims); ok && token.Valid {
		return claims.WalletAddress, nil
	}

	return "", errors.New("invalid token claims")
}
