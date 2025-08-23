# Integra Infrastructure Deployment Strategy

## Core Principles
1. **Immutable Infrastructure** - Never modify running resources
2. **GitOps** - Git as single source of truth
3. **Versioned Everything** - No "latest" tags in production
4. **Automated Rollbacks** - Failed deployments auto-revert
5. **Zero Manual Intervention** - Everything through automation

## Image Versioning Strategy

### Build Pipeline
1. **Every commit** generates a unique, immutable image tag:
   - Format: `{branch}-{sha}-{timestamp}`
   - Example: `main-a1b2c3d-20250823143022`

2. **Promotion Strategy**:
   ```
   Development: main-{sha}-{timestamp}
   Staging: staging-{version}
   Production: v{semver}
   ```

### Version Management
- **versions.yaml** - Single source of truth for deployed versions
- **Automatic Updates** - CI/CD updates versions.yaml on successful build
- **Rollback** - Revert versions.yaml commit to rollback

## Deployment Architecture

### 1. Service Registry (service-registry.ts)
```typescript
interface ServiceConfig {
  name: string;
  namespace: string;
  image: string;  // Base image name only
  replicas: {
    min: number;
    max: number;
    targetCPU: number;
  };
  resources: ResourceProfile;
  healthCheck: HealthCheckConfig;
  dependencies: string[];
}
```

### 2. Version Manifest (versions.yaml)
```yaml
services:
  integra-trust-app:
    version: main-a1b2c3d-20250823143022
    deployed: 2025-08-23T14:30:22Z
    commit: a1b2c3d
    build: https://github.com/IntegraLedger/integra-trust-app/actions/runs/12345
```

### 3. Deployment Controller
- Reads service-registry.ts for configuration
- Reads versions.yaml for image tags
- Validates image exists in registry
- Performs health checks before marking ready

## CI/CD Pipeline

### Service Build (GitHub Actions)
```yaml
1. Build & Test
2. Generate version tag
3. Build Docker image
4. Push to registry
5. Update versions.yaml via PR
6. Trigger Pulumi deployment
```

### Infrastructure Deploy (Pulumi)
```yaml
1. Pull latest versions.yaml
2. Validate all images exist
3. Preview changes
4. Apply with health checks
5. Monitor for 5 minutes
6. Auto-rollback if unhealthy
```

## Health Checks & Rollbacks

### Multi-Level Health Checks
1. **Container** - Liveness/Readiness probes
2. **Service** - Endpoint availability
3. **Application** - Business logic health
4. **Dependencies** - External service checks

### Automatic Rollback Triggers
- Pod crash loops (>3 restarts)
- Failed health checks (>2 minutes)
- Error rate spike (>5% 5xx responses)
- Missing dependencies

## Secret Management

### Infisical Integration
- **No secrets in code** - Everything from Infisical
- **Service-specific tokens** - Each service has own token
- **Automatic rotation** - 30-day rotation policy
- **Audit logging** - All secret access logged

## Monitoring & Observability

### Metrics Collection
- Prometheus metrics from all services
- Custom business metrics
- Infrastructure metrics (CPU, memory, network)

### Logging
- Structured JSON logging
- Centralized in Elasticsearch
- Correlation IDs for tracing

### Alerting
- PagerDuty for critical issues
- Slack for warnings
- Auto-remediation for known issues

## Implementation Plan

### Phase 1: Fix Image Building (Immediate)
- Fix Docker builds producing 0-byte images
- Implement proper multi-stage builds
- Add build verification

### Phase 2: Version Management (Week 1)
- Create versions.yaml
- Update CI/CD to manage versions
- Remove hardcoded tags

### Phase 3: Health & Rollbacks (Week 2)
- Implement comprehensive health checks
- Add automatic rollback logic
- Test failure scenarios

### Phase 4: Monitoring (Week 3)
- Deploy Prometheus/Grafana
- Configure alerts
- Create dashboards

### Phase 5: Documentation (Week 4)
- Runbooks for common issues
- Architecture diagrams
- Deployment guides