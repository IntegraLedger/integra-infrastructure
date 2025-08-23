# GitHub Actions Workflow Audit

## Current State Analysis

### Two Different Patterns (Both Correct)

#### 1. Frontend Apps (Need secrets at BUILD time)
**Repos:** integra-trust-app, integra-admin-app, integra-developer-app, integra-explorer-app, integra-docs-app

**Approach:**
- Install Infisical CLI in GitHub Actions
- Fetch VITE_* variables from Infisical during workflow
- Pass as build-args to Docker
- Dockerfile receives them as ARG and sets as ENV before `pnpm build`

**Example (integra-trust-app):**
```yaml
# In workflow
- name: Setup Infisical CLI
  run: |
    curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.alpine.sh' | sh
    
- name: Build and push Docker image
  run: |
    export $(infisical export --env=dev --path=/apps/integra-trust-app/ --format=dotenv | grep '^VITE_' | xargs)
    docker buildx build \
      --build-arg VITE_PRIVY_APP_ID="$VITE_PRIVY_APP_ID" \
      --build-arg VITE_ABLY_API_KEY="$VITE_ABLY_API_KEY" \
      ...
```

#### 2. Backend Services (Need secrets at RUNTIME)
**Repos:** integra-blockchain-api, integra-rpc-service, integra-bridge-service, etc.

**Approach:**
- No Infisical in GitHub Actions
- Simple build with just GITHUB_TOKEN for npm packages
- Kubernetes InfisicalSecret CRD injects secrets at runtime

**Example (integra-blockchain-api):**
```yaml
# In workflow - much simpler
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    build-args: |
      GITHUB_TOKEN=${{ secrets.NPM_GITHUB_TOKEN }}
      VERSION=${{ steps.version.outputs.version }}
```

## The REAL Problem: Empty Docker Images

### Issue Found
Looking at registry:
- Images show 0 bytes or 4.18 KB (manifest only)
- `latest` tag exists but is also empty
- Build "succeeds" but produces no layers

### Likely Causes

1. **Build Cache Corruption**
   - Using `type=registry,ref=...buildcache`
   - If cache is corrupted, builds might skip all steps
   - Evidence: buildcache is 103MB but actual images are 0B

2. **Multi-stage Build Issues**
   - FROM node:20-alpine AS builder
   - COPY --from=builder ...
   - If builder stage fails silently, final stage is empty

3. **Platform Mismatch**
   - Building for `linux/amd64`
   - Some services specify `--platform=linux/amd64` in FROM
   - Others don't specify platform

## Inconsistencies Found

### 1. Cache Strategy
- **integra-trust-app:** Uses GitHub Actions cache (`type=gha`)
- **Others:** Use registry cache (`type=registry,ref=...buildcache`)

### 2. Infisical Secrets Handling
- **integra-admin-app:** Tries to pass INFISICAL_CLIENT_ID/SECRET as build args (WRONG - these are for runtime)
- **integra-trust-app:** Correctly uses Infisical service token to fetch VITE vars

### 3. Version Tagging
- All use similar version generation
- But images are empty so versions don't matter

### 4. Platform Specification
- Some Dockerfiles: `FROM --platform=linux/amd64 node:20-alpine`
- Others: `FROM node:20-alpine`
- All workflows: `platforms: linux/amd64`

## What Needs Fixing

### Immediate Actions

1. **Clear ALL build caches**
   ```bash
   for repo in $(doctl registry repository list --no-header | awk '{print $1}'); do
     doctl registry repository delete-tag $repo buildcache --force
   done
   ```

2. **Standardize Dockerfiles**
   - Frontend: Keep current approach (build-time secrets)
   - Backend: Ensure no Infisical in Dockerfile

3. **Fix Multi-stage Builds**
   - Add verification after builder stage
   - Use `--progress=plain` to see what's happening
   - Add `|| exit 1` to catch failures

4. **Remove Registry Cache**
   - Switch all to GitHub Actions cache (`type=gha`)
   - Or disable cache temporarily to ensure fresh builds

5. **Add Build Verification**
   - After docker build, verify image size
   - `docker image inspect $IMAGE | jq '.[0].Size'`
   - Fail if size < 10MB

## Recommended Workflow Template

### Frontend Service
```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    platforms: linux/amd64
    cache-from: type=gha
    cache-to: type=gha,mode=max
    build-args: |
      GITHUB_TOKEN=${{ secrets.NPM_GITHUB_TOKEN }}
      VERSION=${{ steps.version.outputs.version }}
      VITE_*=(fetched from Infisical)
```

### Backend Service
```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    platforms: linux/amd64
    cache-from: type=gha
    cache-to: type=gha,mode=max
    build-args: |
      GITHUB_TOKEN=${{ secrets.NPM_GITHUB_TOKEN }}
      VERSION=${{ steps.version.outputs.version }}
```

## Version Management

Current versions.yaml has everyone on "latest" because:
1. Builds are producing empty images
2. The "latest" tag happens to work (maybe from old builds?)
3. New version tags are empty

We need to:
1. Fix the build process
2. Build working images with version tags
3. Update versions.yaml with real versions
4. Deploy with VersionManager (no fallback to latest)