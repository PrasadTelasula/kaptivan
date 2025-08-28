package kubernetes

import (
	"testing"
)

func TestNormalizeContextName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "URL encoded EKS ARN",
			input:    "arn%3Aaws%3Aeks%3Aus-west-2%3A123456%3Acluster%2Fmy-cluster",
			expected: "arn:aws:eks:us-west-2:123456:cluster/my-cluster",
		},
		{
			name:     "Already decoded EKS ARN",
			input:    "arn:aws:eks:us-west-2:123456:cluster/my-cluster",
			expected: "arn:aws:eks:us-west-2:123456:cluster/my-cluster",
		},
		{
			name:     "eksctl format context",
			input:    "kaptivan@kaptivan-int.us-west-2.eksctl.io",
			expected: "kaptivan@kaptivan-int.us-west-2.eksctl.io",
		},
		{
			name:     "Simple context name",
			input:    "docker-desktop",
			expected: "docker-desktop",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeContextName(tt.input)
			if result != tt.expected {
				t.Errorf("normalizeContextName(%s) = %s; want %s", tt.input, result, tt.expected)
			}
		})
	}
}

func TestFindContextCaseInsensitive(t *testing.T) {
	// Create a test cluster manager
	cm := &ClusterManager{
		connections: map[string]*ClusterConnection{
			"arn:aws:eks:us-west-2:123456:cluster/my-cluster": {
				Name:      "my-cluster",
				Context:   "arn:aws:eks:us-west-2:123456:cluster/my-cluster",
				Connected: false,
			},
			"kaptivan@kaptivan-int.us-west-2.eksctl.io": {
				Name:      "kaptivan-int",
				Context:   "kaptivan@kaptivan-int.us-west-2.eksctl.io",
				Connected: false,
			},
			"docker-desktop": {
				Name:      "docker-desktop",
				Context:   "docker-desktop",
				Connected: false,
			},
		},
	}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Exact match with EKS ARN",
			input:    "arn:aws:eks:us-west-2:123456:cluster/my-cluster",
			expected: "arn:aws:eks:us-west-2:123456:cluster/my-cluster",
		},
		{
			name:     "URL encoded EKS ARN",
			input:    "arn%3Aaws%3Aeks%3Aus-west-2%3A123456%3Acluster%2Fmy-cluster",
			expected: "arn:aws:eks:us-west-2:123456:cluster/my-cluster",
		},
		{
			name:     "Case insensitive match",
			input:    "DOCKER-DESKTOP",
			expected: "docker-desktop",
		},
		{
			name:     "Non-existent context",
			input:    "non-existent",
			expected: "",
		},
		{
			name:     "eksctl format exact match",
			input:    "kaptivan@kaptivan-int.us-west-2.eksctl.io",
			expected: "kaptivan@kaptivan-int.us-west-2.eksctl.io",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := cm.findContextCaseInsensitive(tt.input)
			if result != tt.expected {
				t.Errorf("findContextCaseInsensitive(%s) = %s; want %s", tt.input, result, tt.expected)
			}
		})
	}
}