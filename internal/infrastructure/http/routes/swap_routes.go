package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/noymaxx/backend/internal/infrastructure/http/controllers"
)

func SetupSwapRoutes(app *fiber.App) {
	api := app.Group("/api")
	api.Post("/swap/best-route", controllers.BestSwapRoute)
}
