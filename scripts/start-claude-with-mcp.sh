#!/bin/bash

# Script to start Claude Code with MCP server environment variables

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo -e "${YELLOW}Please create a .env file with your GitHub API key${NC}"
    exit 1
fi

# Load environment variables from .env
set -a
source .env
set +a

# Check if GITHUB_API_KEY is set
if [ -z "$GITHUB_API_KEY" ]; then
    echo -e "${RED}Error: GITHUB_API_KEY not found in .env file!${NC}"
    exit 1
fi

echo -e "${GREEN}Starting Claude Code with MCP servers enabled...${NC}"
echo -e "${YELLOW}GitHub API Key loaded from .env${NC}"

# Export the key for Claude to use
export GITHUB_API_KEY

# Start Claude Code
# Note: You may need to adjust this command based on how you start Claude Code
claude