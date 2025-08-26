# MCP Server Setup Guide

## Overview
This guide explains how to set up MCP (Model Context Protocol) servers for the Kaptivan project.

## Security First
**NEVER commit API keys or tokens to version control!**

## Setup Steps

### 1. Create Your Environment File
```bash
# Copy the example environment file
cp .env.example .env
```

### 2. Get a GitHub Personal Access Token
1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name like "shadcn-ui-mcp"
4. Select the following scopes:
   - `repo` (full control of private repositories)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again!)

### 3. Add Token to .env
Edit your `.env` file and replace the placeholder:
```bash
GITHUB_API_KEY=ghp_your_actual_token_here
```

### 4. Run the MCP Server
Use the provided script:
```bash
./scripts/setup-mcp.sh
```

Or run directly with environment variable:
```bash
source .env
npx @jpisnice/shadcn-ui-mcp-server --github-api-key "$GITHUB_API_KEY"
```

## Security Best Practices

1. **Never share your tokens** - Treat them like passwords
2. **Use minimal scopes** - Only grant necessary permissions
3. **Rotate tokens regularly** - Replace tokens periodically
4. **Monitor token usage** - Check GitHub's security log
5. **Revoke compromised tokens immediately** - If exposed, delete and recreate

## Troubleshooting

### Token not working?
- Verify the token hasn't expired
- Check that you have the correct scopes
- Ensure no extra spaces in the .env file

### Environment variable not loading?
- Make sure .env file exists in project root
- Check file permissions
- Verify no syntax errors in .env

## Additional MCP Servers

To add more MCP servers, update your configuration:

```json
{
  "mcpServers": {
    "shadcn-ui": {
      "command": "bash",
      "args": ["./scripts/setup-mcp.sh"]
    },
    // Add more servers here
  }
}
```

## Resources
- [MCP Documentation](https://modelcontextprotocol.io/)
- [GitHub Token Management](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)