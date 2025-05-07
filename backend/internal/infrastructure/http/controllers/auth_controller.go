package controllers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/noymaxx/backend/internal/domain/entities"
	"github.com/noymaxx/backend/internal/infrastructure/logs"
	"github.com/noymaxx/backend/internal/infrastructure/repositories"
	"github.com/noymaxx/backend/internal/infrastructure/security"
)

type AuthController struct {
	userRepo repositories.IUserRepository
	logger   *logs.Logger
}

func NewAuthController(userRepo repositories.IUserRepository, logger *logs.Logger) *AuthController {
	return &AuthController{
		userRepo: userRepo,
		logger:   logger,
	}
}

func (ac *AuthController) AuthenticateUser(c *fiber.Ctx) error {
	input := new(struct {
		WalletAddress string `json:"wallet_address"`
	})

	if err := c.BodyParser(input); err != nil {
		ac.logger.Warnf("Invalid request payload: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request payload",
		})
	}

	user, err := ac.userRepo.GetUserByWalletAddress(input.WalletAddress)
	if err != nil {
		ac.logger.Errorf("Database error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Internal server error",
		})
	}

	if user == nil {
		user = &entities.User{
			WalletAddress: input.WalletAddress,
			CreatedAt:     time.Now().Unix(),
		}
		if err := ac.userRepo.CreateUser(*user); err != nil {
			ac.logger.Errorf("Failed to create user: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to create user",
			})
		}
	}

	token, err := security.GenerateToken(user.WalletAddress)
	if err != nil {
		ac.logger.Errorf("Token generation failed: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Token generation failed",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"token": token})
}

func (ac *AuthController) LogoutUser(c *fiber.Ctx) error {
    c.Locals("user", nil) 
    return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Successfully logged out"})
}