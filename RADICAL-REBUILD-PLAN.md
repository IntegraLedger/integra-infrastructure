# 🔥 RADICAL DEPLOYMENT REBUILD - Clean Slate Approach

## ✅ Access Confirmed
- **GitHub CLI**: Authenticated as dafisher2000
- **DigitalOcean CLI**: Active (dfisher@integraledger.com)
- **Pulumi CLI**: Authenticated as dafisher2000
- **Infisical CLI**: Working (can export secrets)
- **Repository Secrets**: All present (NPM_GITHUB_TOKEN, DIGITALOCEAN_TOKEN, etc.)

## 🎯 Core Principles
1. **ONE pattern for everything** - No exceptions
2. **NO legacy code** - Delete everything, start fresh
3. **NO manual overrides** - Everything automated
4. **NO "latest" tags** - Ever
5. **NO Infisical in Docker** - Only in GitHub Actions

## 📐 The New Architecture

### Single Workflow Pattern (ALL Services)
```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: registry.digitalocean.com/integra-container-registry

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # 1. Setup
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.DIGITALOCEAN_TOKEN }}
          password: ${{ secrets.DIGITALOCEAN_TOKEN }}

      # 2. Version Generation (CONSISTENT)
      - id: version
        run: |
          echo "tag=main-${GITHUB_SHA:0:8}-$(date +%Y%m%d%H%M%S)" >> $GITHUB_OUTPUT

      # 3. Build Variables (Frontend Only)
      - id: buildvars
        if: contains(github.repository, '-app')
        run: |
          export INFISICAL_CLIENT_ID=${{ secrets.INFISICAL_CLIENT_ID }}
          export INFISICAL_CLIENT_SECRET=${{ secrets.INFISICAL_CLIENT_SECRET }}
          # Fetch and export VITE vars
          
      # 4. Build & Push (SINGLE APPROACH)
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ env.REGISTRY }}/${{ github.event.repository.name }}:${{ steps.version.outputs.tag }}
          build-args: |
            GITHUB_TOKEN=${{ secrets.NPM_GITHUB_TOKEN }}
            VERSION=${{ steps.version.outputs.tag }}
            # Frontend-specific VITE args added conditionally

      # 5. Trigger Deployment (CONSISTENT)
      - uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.PULUMI_TRIGGER_TOKEN }}
          repository: IntegraLedger/integra-infrastructure
          event-type: deploy
          client-payload: |
            {
              "service": "${{ github.event.repository.name }}",
              "version": "${{ steps.version.outputs.tag }}"
            }
```

### Single Dockerfile Pattern

#### TypeScript Services (Backend & Frontend)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# GitHub token for private packages
ARG GITHUB_TOKEN
ARG VERSION

# Setup npm auth
COPY .npmrc ./
RUN sed -i "s/\${GITHUB_TOKEN}/${GITHUB_TOKEN}/g" .npmrc

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build (Frontend gets VITE vars as build args)
ARG VITE_PRIVY_APP_ID
ARG VITE_ABLY_API_KEY
ARG VITE_AI_GATEWAY_URL
RUN pnpm build

# Runtime
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini

# Copy built app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

#### Python Services
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
USER nobody
EXPOSE 3000
CMD ["python", "-m", "src.main"]
```

### New Pulumi Structure
```typescript
// ONE component, ONE pattern
export class IntegraMicroservice extends pulumi.ComponentResource {
  constructor(name: string, args: ServiceArgs, opts?: pulumi.ComponentResourceOptions) {
    // Standard deployment for ALL services
    // No special cases, no overrides
  }
}

// Simple service registry
export const services = [
  { name: "integra-trust-app", type: "frontend", namespace: "apps" },
  { name: "integra-bridge-service", type: "backend", namespace: "apps" },
  // ... all services with CONSISTENT naming
];

// Version from GitHub dispatch ONLY
services.forEach(service => {
  new IntegraMicroservice(service.name, {
    image: `${registry}/${service.name}:${getVersion(service.name)}`,
    // Standard config for all
  });
});
```

## 🔨 Execution Plan

### Phase 1: Prepare Clean Infrastructure (30 min)
```bash
# 1. Backup current state
pulumi stack export > backup-$(date +%Y%m%d).json

# 2. Create new Pulumi project
mkdir integra-infrastructure-v2
cd integra-infrastructure-v2
pulumi new typescript --force

# 3. Single service component
# Write ONE IntegraMicroservice class
# No special cases
```

### Phase 2: Standardize ALL Repositories (2 hours)
```bash
# Script to update all repos at once
for repo in $(find /Users/davidfisher/AAA-LAUNCH/repos -name ".git" -type d | xargs dirname); do
  cd $repo
  
  # 1. Delete old workflows
  rm -rf .github/workflows/*
  
  # 2. Copy standard workflow
  cp /template/workflow.yml .github/workflows/deploy.yml
  
  # 3. Replace Dockerfile
  cp /template/Dockerfile ./Dockerfile
  
  # 4. Update .npmrc
  echo "@integraledger:registry=https://npm.pkg.github.com" > .npmrc
  echo "//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}" >> .npmrc
  
  # 5. Commit
  git add -A
  git commit -m "chore: standardize deployment infrastructure"
  git push
done
```

### Phase 3: Update Repository Secrets (30 min)
```bash
# Remove old, add standard set
for repo in $(gh repo list IntegraLedger --json name -q '.[].name'); do
  # Delete deprecated
  gh secret delete INFISICAL_TOKEN --repo IntegraLedger/$repo || true
  gh secret delete NPM_TOKEN --repo IntegraLedger/$repo || true
  
  # Ensure standard set
  gh secret set NPM_GITHUB_TOKEN --repo IntegraLedger/$repo
  gh secret set DIGITALOCEAN_TOKEN --repo IntegraLedger/$repo
  gh secret set INFISICAL_CLIENT_ID --repo IntegraLedger/$repo
  gh secret set INFISICAL_CLIENT_SECRET --repo IntegraLedger/$repo
  gh secret set PULUMI_TRIGGER_TOKEN --repo IntegraLedger/$repo
done
```

### Phase 4: Deploy New Infrastructure (1 hour)
```bash
# 1. Deploy fresh Pulumi stack
cd integra-infrastructure-v2
pulumi up --yes

# 2. Verify all services running
kubectl get pods -A

# 3. Update DNS/LoadBalancer
doctl compute load-balancer list

# 4. Smoke test each service
```

### Phase 5: Cleanup Old Infrastructure (30 min)
```bash
# 1. Destroy old Pulumi stack
cd integra-infrastructure
pulumi destroy --yes

# 2. Archive old code
mv integra-infrastructure integra-infrastructure-old

# 3. Rename new to production
mv integra-infrastructure-v2 integra-infrastructure
```

## 🚀 Benefits of Radical Approach

1. **ONE workflow file** - Copy/paste to all repos
2. **ONE Dockerfile template** - TypeScript or Python, that's it
3. **ONE Pulumi component** - No special cases
4. **ZERO legacy code** - Complete fresh start
5. **ZERO manual steps** - Full automation

## ⏱️ Timeline
- Total Time: ~4 hours
- Downtime: ~15 minutes (during DNS switch)
- Rollback: Keep old stack for 24 hours

## 🎯 Success Criteria
- [ ] All 30 services using identical workflow
- [ ] All services versioned as `main-{sha}-{timestamp}`
- [ ] Zero "latest" tags in registry
- [ ] Single Pulumi component handles everything
- [ ] No special cases or overrides

## 🔥 Nuclear Options
If we hit ANY resistance:
1. Delete the entire DO Kubernetes cluster and recreate
2. Delete all GitHub repos and recreate from template
3. Clear entire Docker registry
4. Start with single service, replicate 30 times

This is greenfield - we can be BRUTAL about standardization.