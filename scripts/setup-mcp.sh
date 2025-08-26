#!/bin/bash

# Setup script for MCP servers with environment variables
# This script loads environment variables from .env file

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo -e "${YELLOW}Please create a .env file with your GitHub API key:${NC}"
    echo ""
    echo "1. Copy .env.example to .env:"
    echo "   cp .env.example .env"
    echo ""
    echo "2. Edit .env and add your GitHub Personal Access Token"
    echo ""
    echo "3. Get a new token from: https://github.com/settings/tokens"
    echo "   Required scopes: repo (for accessing shadcn-ui components)"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check if GITHUB_API_KEY is set
if [ -z "$GITHUB_API_KEY" ]; then
    echo -e "${RED}Error: GITHUB_API_KEY not found in .env file!${NC}"
    echo -e "${YELLOW}Please add your GitHub API key to .env file${NC}"
    exit 1
fi

echo -e "${GREEN}Environment variables loaded successfully!${NC}"
echo ""
echo "Starting shadcn-ui MCP server..."

# Run the MCP server with the environment variable
npx @jpisnice/shadcn-ui-mcp-server --github-api-key "$GITHUB_API_KEY"