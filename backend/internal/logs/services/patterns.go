package services

import (
	"regexp"
	"strings"
)

// LogPatterns holds compiled regex patterns for log parsing
type LogPatterns struct {
	TimestampPatterns []*regexp.Regexp
	LogLevelPatterns  map[string]*regexp.Regexp
}

// NewLogPatterns creates patterns for log parsing
func NewLogPatterns() *LogPatterns {
	return &LogPatterns{
		TimestampPatterns: []*regexp.Regexp{
			// ISO 8601
			regexp.MustCompile(`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?`),
			// Common log4j pattern
			regexp.MustCompile(`\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?`),
			// Syslog
			regexp.MustCompile(`\w{3}\s+\d{1,2} \d{2}:\d{2}:\d{2}`),
		},
		LogLevelPatterns: map[string]*regexp.Regexp{
			"ERROR": regexp.MustCompile(`(?i)\b(ERROR|ERR|FATAL|CRITICAL)\b`),
			"WARN":  regexp.MustCompile(`(?i)\b(WARN|WARNING)\b`),
			"INFO":  regexp.MustCompile(`(?i)\b(INFO|INFORMATION)\b`),
			"DEBUG": regexp.MustCompile(`(?i)\b(DEBUG|DBG)\b`),
			"TRACE": regexp.MustCompile(`(?i)\b(TRACE|TRC)\b`),
		},
	}
}

// ExtractLogLevel extracts the log level from a log line
func (p *LogPatterns) ExtractLogLevel(line string) string {
	upperLine := strings.ToUpper(line)
	
	// Check patterns in order of severity
	levels := []string{"ERROR", "WARN", "INFO", "DEBUG", "TRACE"}
	for _, level := range levels {
		if pattern, ok := p.LogLevelPatterns[level]; ok {
			if pattern.MatchString(upperLine) {
				return level
			}
		}
	}
	
	return "INFO" // Default level
}