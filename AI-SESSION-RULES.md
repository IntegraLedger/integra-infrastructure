# AI Session Rules - MANDATORY READING

## 🚨 CRITICAL: Field Manager Conflicts

### The Problem
Multiple AI sessions running Pulumi have created field manager conflicts. Different sessions create different field manager IDs, causing Kubernetes to reject updates with "Server-Side Apply field conflict detected" errors.

### The Solution
We've added `pulumi.com/patchForce: "true"` to all resources in IntegraService.ts. This forces Pulumi to take ownership regardless of existing field managers.

## ✅ Rules for ALL AI Sessions

### 1. NEVER Run kubectl on Managed Resources
- **DO NOT** use `kubectl set image`
- **DO NOT** use `kubectl edit`
- **DO NOT** use `kubectl apply` on Pulumi-managed resources
- **DO NOT** use `kubectl patch` on Pulumi-managed resources
- **OK TO USE**: `kubectl get`, `kubectl describe`, `kubectl logs`

### 2. ALWAYS Use Pulumi for Updates
- All deployments go through Pulumi
- All configuration changes go through Pulumi
- All scaling goes through Pulumi

### 3. Version Management
- Versions are in `versions.yaml`
- Never use `latest` tag for production services
- Always use specific version tags like `main-abc123-20250823163529`

### 4. If You See Field Conflicts
The fix is already in place: `pulumi.com/patchForce: "true"` in IntegraService.ts

If you still see conflicts:
```bash
# Force Pulumi to take ownership
PULUMI_K8S_ENABLE_PATCH_FORCE=true pulumi up --yes
```

### 5. Current State (as of 2025-08-23)
- ✅ integra-blockchain-api: Using `main-242b71ee-20250823163529` (real 58MB image)
- ⚠️ All other services: Still using `latest` (need new builds)
- ✅ Pulumi has ownership of all resources via patchForce

## 📝 For New Services

When adding a new service:
1. Build and push a real Docker image (not 0 bytes!)
2. Update versions.yaml with the specific version
3. Let Pulumi deploy it (through GitHub Actions or `pulumi up`)
4. NEVER manually adjust with kubectl

## 🔍 Debugging Commands (READ-ONLY)

```bash
# Check what image is deployed
kubectl get deployment SERVICE_NAME -n NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}'

# Check pod health
kubectl get pods -n NAMESPACE -l app=SERVICE_NAME

# Check logs
kubectl logs -n NAMESPACE deployment/SERVICE_NAME

# Check field managers (to see who owns what)
kubectl get deployment SERVICE_NAME -n NAMESPACE --show-managed-fields -o yaml | grep -A5 "managedFields:"
```

## 🚫 What Broke Things Before

1. Multiple AI sessions running Pulumi from different contexts
2. Manual kubectl commands modifying resources
3. Importing existing resources multiple times
4. Not using patchForce when conflicts arose

## ✅ What's Fixed Now

1. `pulumi.com/patchForce: "true"` added to all resources
2. Pulumi has sole ownership via forced patching
3. integra-blockchain-api has a real, working Docker image
4. Deployment pipeline is proven to work

---

**Remember**: The infrastructure is managed by Pulumi. Pulumi is the source of truth. Manual kubectl changes will cause conflicts and break deployments.