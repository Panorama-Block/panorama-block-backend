package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/noymaxx/backend/internal/infrastructure/security"
)

// Verify if the request has a valid token
func AuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Get("Authorization")
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing authorization token",
			})
		}

		user, err := security.VerifyWalletToken(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		c.Locals("user", user)
		return c.Next()
	}
}
