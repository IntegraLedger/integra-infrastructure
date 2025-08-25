# Infisical Service Token Setup

## Why Service Tokens?

Service tokens are MUCH simpler than machine identity:
- No complex authentication flow
- Just set `INFISICAL_TOKEN` environment variable
- Token starts with "st." prefix
- Works immediately with `infisical export`

## Setup Steps

### 1. Create Service Token in Infisical

1. Log into Infisical dashboard
2. Go to your project
3. Navigate to "Access Control" > "Service Tokens"
4. Click "Create token"
5. Configure:
   - **Name**: `github-actions-dev`
   - **Environment**: `dev`
   - **Secret Path**: `/` (or specific paths like `/apps`)
   - **Permissions**: `Read` only
   - **Expiration**: Set as needed (e.g., 1 year)
6. Copy the token (starts with `st.`)

### 2. Add to GitHub Repository Secrets

For EACH repository that needs Infisical:

```bash
gh secret set INFISICAL_SERVICE_TOKEN --repo IntegraLedger/<repo-name>
# Paste the service token when prompted
```

Or via GitHub UI:
1. Go to Settings > Secrets and variables > Actions
2. Add secret named `INFISICAL_SERVICE_TOKEN`
3. Paste the service token value

### 3. Workflow Usage

The workflow is now simplified:

```yaml
- name: Get build variables (Frontend only)
  if: contains(github.repository, '-app')
  env:
    INFISICAL_TOKEN: ${{ secrets.INFISICAL_SERVICE_TOKEN }}
  run: |
    # Install Infisical CLI
    curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash
    sudo apt-get update && sudo apt-get install -y infisical
    
    # Export VITE variables for frontend builds
    export $(infisical export --env=dev --path=/apps/${{ github.event.repository.name }} --format=dotenv | grep '^VITE_' | xargs)
    
    # Pass to next steps
    echo "VITE_PRIVY_APP_ID=${VITE_PRIVY_APP_ID}" >> $GITHUB_ENV
```

## Required GitHub Secrets

Each repository needs:
- `DIGITALOCEAN_TOKEN` - For registry access
- `NPM_GITHUB_TOKEN` - For private npm packages  
- `PULUMI_TRIGGER_TOKEN` - To trigger infrastructure updates
- `INFISICAL_SERVICE_TOKEN` - **NEW** - For fetching secrets from Infisical

## Remove Old Secrets

You can remove these from GitHub Secrets:
- `INFISICAL_CLIENT_ID` - No longer needed
- `INFISICAL_CLIENT_SECRET` - No longer needed
- `INFISICAL_TOKEN` (if it exists) - Replaced by service token

## Testing

To test locally:
```bash
export INFISICAL_TOKEN="st.your-service-token-here"
infisical export --env=dev --path=/apps/integra-trust-app --format=dotenv | grep VITE_
```

## Important Notes

1. **Service tokens are being deprecated** by Infisical in favor of machine identities, but they still work and are MUCH simpler for CI/CD
2. **Token rotation**: Set a reminder to rotate tokens before expiration
3. **Least privilege**: Only grant read access to paths that are needed
4. **One token per environment**: Consider separate tokens for dev/staging/prod

## Rollout Plan

1. Create service token in Infisical
2. Add `INFISICAL_SERVICE_TOKEN` to integra-trust-app repository
3. Push updated workflow and verify VITE variables are populated
4. If successful, roll out to all frontend apps
5. Backend services don't need build-time secrets (they use runtime InfisicalSecret CRDs)