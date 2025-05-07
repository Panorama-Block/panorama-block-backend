package security

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// NewJWTMiddleware creates a middleware for JWT validation
func NewJWTMiddleware(authServiceURL string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get the Authorization header
		authHeader := c.Get("Authorization")
		
		// Check if Authorization header exists and has the Bearer scheme
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Authorization token required",
			})
		}
		
		// Extract the token
		token := strings.TrimPrefix(authHeader, "Bearer ")
		
		// Create the request payload
		payload := map[string]interface{}{
			"token": token,
		}
		
		// Marshal the payload to JSON
		jsonPayload, err := json.Marshal(payload)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to create auth request",
			})
		}
		
		// Make a request to the Auth service to validate the token
		resp, err := http.Post(
			fmt.Sprintf("%s/auth/validate", authServiceURL),
			"application/json",
			bytes.NewBuffer(jsonPayload),
		)
		
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to communicate with auth service",
			})
		}
		defer resp.Body.Close()
		
		// Check the response status code
		if resp.StatusCode != http.StatusOK {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}
		
		// Decode the response
		var authResponse struct {
			IsValid bool                   `json:"isValid"`
			Payload map[string]interface{} `json:"payload"`
		}
		
		if err := json.NewDecoder(resp.Body).Decode(&authResponse); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to parse auth response",
			})
		}
		
		// If the token is invalid, return an error
		if !authResponse.IsValid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid token",
			})
		}
		
		// If the token is valid, set the user data in the context
		// The address is in the payload
		if address, ok := authResponse.Payload["address"].(string); ok {
			c.Locals("user", map[string]interface{}{
				"address": address,
			})
		}
		
		// Continue to the next middleware/handler
		return c.Next()
	}
} 