package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Mock authentication - accept demo credentials
	if req.Email == "demo@kaptivan.io" && req.Password == "demo123" {
		user := User{
			ID:    "user-123",
			Email: req.Email,
			Name:  "Demo User",
			Role:  "admin",
		}

		// Generate a mock token (in production, use JWT)
		token := "mock-token-" + time.Now().Format("20060102150405")

		c.JSON(http.StatusOK, LoginResponse{
			Token: token,
			User:  user,
		})
		return
	}

	c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
}