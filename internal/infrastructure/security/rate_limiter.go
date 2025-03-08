package security

import (
    "time"

    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/limiter"
)

// NewRateLimiter exemplo simples
func NewRateLimiter() fiber.Handler {
    return limiter.New(limiter.Config{
        Max:        100,              // 100 req
        Expiration: 1 * time.Minute,  // por minuto
        KeyGenerator: func(c *fiber.Ctx) string {
            // Usa IP p/ rate limit. Personalize se quiser tokens de usuário, etc.
            return c.IP()
        },
        LimitReached: func(c *fiber.Ctx) error {
            return c.Status(fiber.StatusTooManyRequests).
                JSON(fiber.Map{"error": "Rate limit exceeded"})
        },
    })
}
