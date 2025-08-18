# Integra Infrastructure

Centralized infrastructure management for the entire Integra ecosystem using Pulumi.

## Architecture

This repository implements a **monolithic Pulumi stack** that manages all services, deployments, and configurations for the Integra platform.

### Key Principles
- **Single Source of Truth**: All infrastructure is defined in this repository
- **Atomic Deployments**: All services deploy together for consistency
- **Clean Separation**: Service code lives in service repos, infrastructure here
- **Standardized Patterns**: Every service follows the same deployment pattern

## Structure

```
integra-infrastructure/
├── index.ts                    # Main Pulumi program
├── service-registry.ts         # Service configurations
├── components/
│   ├── IntegraService.ts      # Service deployment component
│   ├── apisix.ts              # APISIX gateway setup
│   └── infisical.ts           # Secret management setup
├── scripts/
│   ├── setup-infisical-auth.sh
│   └── setup-service-workflows.sh
└── .github/workflows/
    └── deploy.yml              # CI/CD pipeline
```

## Services

The infrastructure manages 23 services across 5 namespaces:

### Frontend Applications (4)
- `integra-trust-app` - Main customer portal
- `integra-admin-app` - Admin dashboard
- `integra-explorer-app` - Blockchain explorer
- `integra-docs-app` - Documentation site

### Core Services (4)
- `integra-bridge-service` - Central API bridge
- `integra-admin-service` - Admin backend
- `integra-ai-help-service` - AI assistance
- `integra-dev-assistant-service` - Developer tools

### Blockchain Services (6)
- `integra-blockchain-api` - Main blockchain API
- `integra-gateway-service` - Blockchain gateway
- `integra-rpc-service` - RPC interface
- `integra-indexer-service` - Chain indexer
- `integra-proof-service` - ZK proof service
- `integra-hogan-api` - Partner integration

### Executor Services (4)
- `integra-polygon-executor`
- `integra-arbitrum-executor`
- `integra-avalanche-executor`
- `integra-base-executor`

### Workflow Services (4)
- `integra-temporal-orchestrator-service`
- `integra-temporal-messaging-service`
- `integra-messaging-service`
- `integra-workflow-service`

### Gateway (1)
- `integra-ai-gateway-service`

## Prerequisites

1. **Pulumi CLI**: `curl -fsSL https://get.pulumi.com | sh`
2. **kubectl**: `brew install kubectl`
3. **doctl**: `brew install doctl`
4. **Node.js 20+**: `brew install node@20`

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/IntegraLedger/integra-infrastructure.git
cd integra-infrastructure
npm install
```

### 2. Configure Pulumi

```bash
pulumi login
pulumi stack init production
```

### 3. Set Configuration

```bash
pulumi config set environment production
pulumi config set infisicalProjectId acd53ca1-6365-4874-874f-15d62453c34f
pulumi config set containerRegistry registry.digitalocean.com/integra-container-registry
pulumi config set --secret digitalOceanToken YOUR_DO_TOKEN
```

### 4. Setup Infisical Authentication

```bash
export INFISICAL_CLIENT_ID="your-client-id"
export INFISICAL_CLIENT_SECRET="your-client-secret"
./scripts/setup-infisical-auth.sh
```

### 5. Deploy

```bash
./deploy.sh
```

## Service Repository Setup

Each service repository needs a standardized GitHub Actions workflow:

```bash
./scripts/setup-service-workflows.sh
```

This creates `.github/workflows/build-and-push.yml` in each service repo that:
1. Builds Docker image on push to main
2. Pushes to DigitalOcean registry
3. Triggers infrastructure deployment

## Deployment Pipeline

### Manual Deployment
```bash
pulumi up --yes
```

### Automated Deployment
Push to main branch triggers GitHub Actions which:
1. Validates configuration
2. Previews changes
3. Deploys to production
4. Updates all services

### Service Updates
When a service repo pushes new code:
1. Service workflow builds new Docker image
2. Pushes image with tag `main-{sha}`
3. Triggers infrastructure repo
4. Infrastructure updates service with new image

## Managing Secrets

All secrets are managed through Infisical:
- Service secrets: `/apps/{service-name}`
- Infrastructure secrets: `/infrastructure/*`
- Database credentials: `/databases/*`
- Blockchain keys: `/blockchain/*`

## Monitoring

View deployment status:
```bash
pulumi stack
pulumi stack output
```

Check service health:
```bash
kubectl get deployments --all-namespaces
kubectl get pods --all-namespaces
```

## Rollback

To rollback to previous version:
```bash
pulumi stack history
pulumi stack rollback <version>
```

## Destroy

To tear down all infrastructure:
```bash
pulumi destroy --yes
```

## Troubleshooting

### Check logs
```bash
kubectl logs -n <namespace> deployment/<service-name>
```

### Refresh state
```bash
pulumi refresh --yes
```

### Force update
```bash
pulumi up --yes --refresh
```

## Important Notes

1. **Never** add infrastructure code to service repositories
2. **Always** update service configurations in `service-registry.ts`
3. **All** deployments go through this repository
4. **No** manual kubectl commands in production

## Support

For issues or questions:
- Create issue in this repository
- Contact DevOps team
- Check documentation at docs.trustwithintegra.com