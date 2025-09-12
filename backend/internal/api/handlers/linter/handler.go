package linter

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/linter"
	"github.com/prasad/kaptivan/backend/internal/linter/wrapper"
)

// Handler handles linter API requests
type Handler struct {
	linter *wrapper.Linter
}

// NewHandler creates a new linter handler
func NewHandler(linter *wrapper.Linter) *Handler {
	return &Handler{linter: linter}
}

// LintManifest lints a Kubernetes manifest
func (h *Handler) LintManifest(c *gin.Context) {
	var req linter.LintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	results, err := h.linter.LintYAML(c.Request.Context(), req.YAML)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate summary
	summary := linter.LintSummary{
		Total: len(results),
	}
	for _, result := range results {
		switch result.Severity {
		case "error":
			summary.Errors++
		case "warning":
			summary.Warnings++
		case "info":
			summary.Info++
		}
	}

	c.JSON(http.StatusOK, linter.LintResponse{
		Results: results,
		Summary: summary,
	})
}

// GetAvailableChecks returns all available checks
func (h *Handler) GetAvailableChecks(c *gin.Context) {
	checks := h.linter.GetAvailableChecks()
	c.JSON(http.StatusOK, gin.H{"checks": checks})
}

// GetCustomChecks returns custom checks
func (h *Handler) GetCustomChecks(c *gin.Context) {
	checks := h.linter.GetCustomChecks()
	c.JSON(http.StatusOK, gin.H{"checks": checks})
}

// GetCheckDetails returns details for a specific check
func (h *Handler) GetCheckDetails(c *gin.Context) {
	checkName := c.Param("check")

	// Get all checks
	allChecks := h.linter.GetAvailableChecks()
	customChecks := h.linter.GetCustomChecks()

	// Search for the check
	var check *linter.CheckInfo
	for _, c := range allChecks {
		if c.Name == checkName {
			check = &c
			break
		}
	}

	if check == nil {
		for _, c := range customChecks {
			if c.Name == checkName {
				check = &c
				break
			}
		}
	}

	if check == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Check not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"check": check})
}

// GetLintSummary returns a summary of lint results
func (h *Handler) GetLintSummary(c *gin.Context) {
	// This could be enhanced to return statistics about linting
	// For now, return basic information
	availableChecks := h.linter.GetAvailableChecks()
	customChecks := h.linter.GetCustomChecks()

	summary := gin.H{
		"available_checks": len(availableChecks),
		"custom_checks":    len(customChecks),
		"total_checks":     len(availableChecks) + len(customChecks),
	}

	c.JSON(http.StatusOK, summary)
}

// LintMultipleManifests lints multiple manifests at once
func (h *Handler) LintMultipleManifests(c *gin.Context) {
	var req struct {
		Manifests []struct {
			YAML      string `json:"yaml" binding:"required"`
			Namespace string `json:"namespace,omitempty"`
			Kind      string `json:"kind,omitempty"`
			Name      string `json:"name,omitempty"`
		} `json:"manifests" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var results []struct {
		Name    string              `json:"name"`
		Kind    string              `json:"kind"`
		Results []linter.LintResult `json:"results"`
		Summary linter.LintSummary  `json:"summary"`
	}

	for _, manifest := range req.Manifests {
		lintResults, err := h.linter.LintYAML(c.Request.Context(), manifest.YAML)
		if err != nil {
			// Continue with other manifests even if one fails
			continue
		}

		// Calculate summary for this manifest
		summary := linter.LintSummary{
			Total: len(lintResults),
		}
		for _, result := range lintResults {
			switch result.Severity {
			case "error":
				summary.Errors++
			case "warning":
				summary.Warnings++
			case "info":
				summary.Info++
			}
		}

		results = append(results, struct {
			Name    string              `json:"name"`
			Kind    string              `json:"kind"`
			Results []linter.LintResult `json:"results"`
			Summary linter.LintSummary  `json:"summary"`
		}{
			Name:    manifest.Name,
			Kind:    manifest.Kind,
			Results: lintResults,
			Summary: summary,
		})
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

// GetLintStatistics returns linting statistics
func (h *Handler) GetLintStatistics(c *gin.Context) {
	// This could be enhanced to return actual statistics from a database
	// For now, return mock statistics
	stats := gin.H{
		"total_manifests_linted": 0,
		"total_issues_found":     0,
		"error_count":            0,
		"warning_count":          0,
		"info_count":             0,
		"most_common_issues":     []string{},
		"linter_uptime":          "0s",
	}

	c.JSON(http.StatusOK, stats)
}
