# Frontend Apps Infisical Integration

## Working Solution Summary

After extensive testing, the working solution for injecting VITE environment variables into frontend builds uses:

1. **Machine Identity** authentication (not OIDC)
2. **Infisical CLI** directly in GitHub Actions
3. **Token-based export** to fetch secrets

## Prerequisites

### 1. GitHub Secrets Required

Each frontend repository needs these secrets:
- `DIGITALOCEAN_TOKEN` - For registry access
- `NPM_GITHUB_TOKEN` - For private npm packages  
- `PULUMI_TRIGGER_TOKEN` - To trigger infrastructure updates
- `INFISICAL_CLIENT_ID` - Machine identity client ID
- `INFISICAL_CLIENT_SECRET` - Machine identity client secret
- `INFISICAL_IDENTITY_ID` - Machine identity ID (currently: 4c1e90b4-10e5-4ef3-a48d-56010028be11)

### 2. Infisical Configuration

Each frontend app needs secrets at path `/apps/<app-name>` with at least:
- `VITE_PRIVY_APP_ID` - Privy application ID
- `VITE_ABLY_API_KEY` - Ably API key for realtime features
- `VITE_AI_GATEWAY_URL` - AI gateway WebSocket URL
- `VITE_API_URL` - Backend API URL

## The Working GitHub Actions Workflow

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

permissions:
  id-token: write  # Required for OIDC auth with Infisical
  contents: read   # For checking out code

env:
  REGISTRY: registry.digitalocean.com/integra-container-registry

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Login to DigitalOcean Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.DIGITALOCEAN_TOKEN }}
          password: ${{ secrets.DIGITALOCEAN_TOKEN }}
          
      - name: Generate version
        id: version
        run: |
          VERSION="main-${GITHUB_SHA:0:8}-$(date +%Y%m%d%H%M%S)"
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "Generated version: $VERSION"
          
      - name: Get build variables from Infisical (Frontend only)
        if: contains(github.repository, '-app')
        env:
          INFISICAL_CLIENT_ID: ${{ secrets.INFISICAL_CLIENT_ID }}
          INFISICAL_CLIENT_SECRET: ${{ secrets.INFISICAL_CLIENT_SECRET }}
        run: |
          # Install Infisical CLI
          curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash
          sudo apt-get update && sudo apt-get install -y infisical
          
          # Authenticate and get token
          TOKEN=$(infisical login --method=universal-auth \
            --client-id="$INFISICAL_CLIENT_ID" \
            --client-secret="$INFISICAL_CLIENT_SECRET" \
            --plain --silent)
          
          # Export secrets using the token
          INFISICAL_TOKEN="$TOKEN" infisical export --projectId=acd53ca1-6365-4874-874f-15d62453c34f --env=dev --path=/apps/${{ github.event.repository.name }} --format=dotenv > /tmp/secrets.env
          
          # Debug - check if secrets were exported
          echo "Exported secrets count: $(wc -l < /tmp/secrets.env)"
          echo "VITE variables found:"
          grep '^VITE_' /tmp/secrets.env | cut -d= -f1 || echo "No VITE variables found"
          
          # Source the secrets file and export to GitHub env
          set -a
          source /tmp/secrets.env
          set +a
          
          # Pass VITE variables to GitHub env for next steps
          grep '^VITE_' /tmp/secrets.env | while IFS='=' read -r key value; do
            echo "${key}=${value}" >> $GITHUB_ENV
          done
          
          rm /tmp/secrets.env
          
      - name: Verify VITE variables are injected
        if: contains(github.repository, '-app')
        run: |
          echo "Checking VITE variables..."
          echo "VITE_PRIVY_APP_ID is set: ${{ env.VITE_PRIVY_APP_ID != '' }}"
          echo "VITE_ABLY_API_KEY is set: ${{ env.VITE_ABLY_API_KEY != '' }}"
          echo "VITE_AI_GATEWAY_URL is set: ${{ env.VITE_AI_GATEWAY_URL != '' }}"
          if [ -z "$VITE_PRIVY_APP_ID" ]; then
            echo "ERROR: VITE_PRIVY_APP_ID is empty!"
            exit 1
          fi
          echo "✅ VITE variables successfully injected"
          
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ github.event.repository.name }}:${{ steps.version.outputs.version }}
          build-args: |
            GITHUB_TOKEN=${{ secrets.NPM_GITHUB_TOKEN }}
            VERSION=${{ steps.version.outputs.version }}
            VITE_PRIVY_APP_ID=${{ env.VITE_PRIVY_APP_ID }}
            VITE_ABLY_API_KEY=${{ env.VITE_ABLY_API_KEY }}
            VITE_AI_GATEWAY_URL=${{ env.VITE_AI_GATEWAY_URL }}
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ github.event.repository.name }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ github.event.repository.name }}:buildcache,mode=max
          platforms: linux/amd64
          
      - name: Trigger deployment
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.PULUMI_TRIGGER_TOKEN }}
          repository: IntegraLedger/integra-infrastructure
          event-type: service-updated
          client-payload: |
            {
              "service": "${{ github.event.repository.name }}",
              "version": "${{ steps.version.outputs.version }}"
            }
```

## Why Machine Identity Works (and OIDC Doesn't)

1. **OIDC Issues**:
   - Despite correct configuration, keeps failing with "OIDC subject not allowed"
   - Complex subject/audience matching requirements
   - Difficult to debug when it fails

2. **Machine Identity Success**:
   - Simple client-id/secret authentication
   - Works reliably with the CLI
   - Use `--plain` flag to get auth token
   - Pass token via `INFISICAL_TOKEN` env var to export command

## Key Implementation Details

1. **Token Extraction**: Use `--plain` flag to get just the token:
   ```bash
   TOKEN=$(infisical login --method=universal-auth \
     --client-id="$INFISICAL_CLIENT_ID" \
     --client-secret="$INFISICAL_CLIENT_SECRET" \
     --plain --silent)
   ```

2. **Export with Token**: Pass token to export command:
   ```bash
   INFISICAL_TOKEN="$TOKEN" infisical export --projectId=acd53ca1-6365-4874-874f-15d62453c34f --env=dev --path=/apps/${{ github.event.repository.name }} --format=dotenv > /tmp/secrets.env
   ```

3. **GitHub Env Export**: Use a while loop to properly export each VITE variable:
   ```bash
   grep '^VITE_' /tmp/secrets.env | while IFS='=' read -r key value; do
     echo "${key}=${value}" >> $GITHUB_ENV
   done
   ```

## Current Status

✅ **Working Apps**:
- `integra-trust-app` - Successfully building and deploying with VITE variables

⚠️ **Apps Needing Infisical Secrets**:
- `integra-admin-app` - Workflow deployed, needs VITE secrets in Infisical
- `integra-explorer-app` - Workflow deployed, needs VITE secrets in Infisical
- `integra-docs-app` - Workflow deployed, needs VITE secrets in Infisical
- `integra-developer-app` - Workflow deployed, needs VITE secrets in Infisical

## Troubleshooting

### "ERROR: VITE_PRIVY_APP_ID is empty!"
- Check that secrets exist at `/apps/<app-name>` in Infisical
- Verify the machine identity has access to that path
- Check "Exported secrets count" in the logs

### "Project not connected to Infisical"
- Make sure to use the token from login with export command
- Use `INFISICAL_TOKEN="$TOKEN"` prefix

### Wrong event type for deployment trigger
- Use `service-updated` not `deploy` as the event type
- The infrastructure workflow expects this specific event type