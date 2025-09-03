package services

import (
	"time"
)

// TimestampParser handles parsing of various timestamp formats
type TimestampParser struct {
	formats []string
}

// NewTimestampParser creates a new timestamp parser
func NewTimestampParser() *TimestampParser {
	return &TimestampParser{
		formats: []string{
			time.RFC3339,
			time.RFC3339Nano,
			"2006-01-02 15:04:05",
			"2006-01-02 15:04:05.000",
			"2006-01-02 15:04:05.000000",
			"Jan _2 15:04:05",
			"Jan 02 15:04:05",
			"2006/01/02 15:04:05",
		},
	}
}

// Parse attempts to parse various timestamp formats
func (t *TimestampParser) Parse(ts string) (time.Time, error) {
	for _, format := range t.formats {
		if parsed, err := time.Parse(format, ts); err == nil {
			return parsed, nil
		}
	}
	
	// Return current time if parsing fails
	return time.Now(), nil
}

// ExtractTimestamp finds and parses timestamp from log line
func (t *TimestampParser) ExtractTimestamp(line string, patterns []*LogPatterns) time.Time {
	if patterns == nil {
		return time.Now()
	}
	
	p := patterns[0]
	for _, pattern := range p.TimestampPatterns {
		if match := pattern.FindString(line); match != "" {
			if parsed, _ := t.Parse(match); !parsed.IsZero() {
				return parsed
			}
		}
	}
	
	return time.Now()
}