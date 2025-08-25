# Infisical OIDC Setup for GitHub Actions

## Why OIDC?

OIDC (OpenID Connect) is the **BEST** approach for GitHub Actions:
- **No long-lived credentials** - Uses GitHub's short-lived ID tokens
- **Secure** - No secrets stored in GitHub (except the identity ID)
- **Simple** - The Infisical Secrets Action handles everything
- **Official** - Recommended by Infisical

## Setup Steps

### 1. Create Machine Identity in Infisical

1. Log into Infisical dashboard
2. Go to your project settings
3. Navigate to "Access Control" > "Machine Identities"
4. Click "Create identity"
5. Configure:
   - **Name**: `github-actions-oidc`
   - **Authentication Method**: Select "OIDC Auth"
   - **Issuer**: `https://token.actions.githubusercontent.com`
   - **Audiences**: Leave default or add `https://github.com/IntegraLedger`
   - **Subject**: Can use wildcard like `repo:IntegraLedger/*:*` for all repos
   - Or specific: `repo:IntegraLedger/integra-trust-app:ref:refs/heads/main`
6. Copy the **Identity ID** (e.g., `24be0d94-b43a-41c4-812c-1e8654d9ce1e`)
7. Grant access to the identity:
   - Add to project with appropriate role (e.g., "Viewer" for read-only)
   - Set environment access (e.g., `dev`, `staging`, `prod`)
   - Set secret path access (e.g., `/apps` or `/*`)

### 2. Add Identity ID to GitHub Secrets

For EACH repository:

```bash
gh secret set INFISICAL_IDENTITY_ID --repo IntegraLedger/<repo-name>
# Paste the identity ID when prompted
```

### 3. Update Workflow

The workflow now uses the official Infisical Secrets Action:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

permissions:
  id-token: write  # Required for OIDC
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Inject Infisical secrets (Frontend only)
        if: contains(github.repository, '-app')
        uses: Infisical/secrets-action@v1.0.9
        with:
          method: oidc
          identity-id: ${{ secrets.INFISICAL_IDENTITY_ID }}
          domain: 'https://app.infisical.com'
          env-slug: 'dev'
          project-slug: 'integra-platform-7w8'  # Your project slug
          export-type: env
          secret-path: '/apps/${{ github.event.repository.name }}'
          include-imports: true
          recursive: false
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          build-args: |
            VITE_PRIVY_APP_ID=${{ env.VITE_PRIVY_APP_ID }}
            VITE_ABLY_API_KEY=${{ env.VITE_ABLY_API_KEY }}
```

## Required GitHub Configuration

### Repository Secrets Needed:
- `DIGITALOCEAN_TOKEN` - For registry access
- `NPM_GITHUB_TOKEN` - For private npm packages  
- `PULUMI_TRIGGER_TOKEN` - To trigger infrastructure updates
- `INFISICAL_IDENTITY_ID` - The machine identity ID from Infisical

### Workflow Permissions:
```yaml
permissions:
  id-token: write  # CRITICAL - Required for OIDC
  contents: read
```

## How It Works

1. GitHub Actions requests an OIDC token from GitHub
2. The Infisical action exchanges this token for Infisical access
3. Secrets are fetched and injected as environment variables
4. Docker build receives these via build-args
5. Vite inlines VITE_* variables during build

## Testing OIDC Connection

To verify OIDC is working, add a debug step:

```yaml
- name: Debug - Check injected secrets
  if: contains(github.repository, '-app')
  run: |
    echo "VITE_PRIVY_APP_ID is set: ${{ env.VITE_PRIVY_APP_ID != '' }}"
    echo "VITE_ABLY_API_KEY is set: ${{ env.VITE_ABLY_API_KEY != '' }}"
```

## Advantages Over Other Methods

| Method | Pros | Cons |
|--------|------|------|
| **OIDC** | ✅ No long-lived tokens<br>✅ Automatic rotation<br>✅ Secure | Requires identity setup |
| Service Token | Simple setup | ❌ Long-lived token<br>❌ Manual rotation<br>❌ Being deprecated |
| Machine Identity | Programmatic access | ❌ Complex auth flow<br>❌ Client ID/Secret management |

## Rollout Plan

1. Create OIDC machine identity in Infisical
2. Add `INFISICAL_IDENTITY_ID` to integra-trust-app
3. Push updated workflow
4. Verify VITE variables are populated in build
5. Roll out to all frontend apps
6. Backend services use runtime InfisicalSecret CRDs (no build-time secrets)

## Troubleshooting

### "Error: Unable to get OIDC token"
- Check `id-token: write` permission is set
- Verify workflow is running on correct branch

### "Invalid identity"
- Check identity ID is correct
- Verify subject/audience claims match your repo

### "Access denied"
- Check identity has access to the project
- Verify environment and path permissions

### Empty environment variables
- Check secrets exist in Infisical at the specified path
- Verify they're prefixed with `VITE_` for frontend exposure
- Check `export-type: env` is set

## Important Notes

1. **VITE prefix required** - Only `VITE_*` variables are exposed to client
2. **Path matters** - Use `/apps/${{ github.event.repository.name }}`
3. **Environment slug** - Use `dev`, `staging`, `prod` (not full names)
4. **Project slug** - Find in Infisical project settings URL

## Migration from Service Tokens

1. Create OIDC identity
2. Update workflows to use Secrets Action
3. Add `INFISICAL_IDENTITY_ID` to secrets
4. Remove old secrets:
   - `INFISICAL_SERVICE_TOKEN`
   - `INFISICAL_CLIENT_ID`
   - `INFISICAL_CLIENT_SECRET`
   - `INFISICAL_TOKEN`

This is the **official, recommended approach** by Infisical for GitHub Actions!