package security

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// NewRateLimiter creates a rate limiting middleware
func NewRateLimiter() fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        100,              // 100 requests
		Expiration: 1 * time.Minute,  // per minute
		KeyGenerator: func(c *fiber.Ctx) string {
			// Uses IP for rate limiting. Customize if you want user tokens, etc.
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).
				JSON(fiber.Map{"error": "Rate limit exceeded"})
		},
	})
} 