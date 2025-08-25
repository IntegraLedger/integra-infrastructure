# Infrastructure Enforcement Rules

## 🚨 CRITICAL: Protection Against AI Corruption

This infrastructure is protected by multiple layers of enforcement to prevent AI sessions from corrupting the deployment system.

## Layer 1: Version Tag Enforcement

### FORBIDDEN Operations:
1. **NEVER use "latest" tag** - Pulumi will throw an error and refuse deployment
2. **NEVER run `kubectl set image`** - All changes must go through Pulumi
3. **NEVER modify deployments directly** - Use versions.yaml only
4. **NEVER accept "latest" in any configuration** - Validation will fail

### REQUIRED Operations:
1. **ALWAYS use versioned tags** - Format: `main-{sha}-{timestamp}`
2. **ALWAYS update through CI/CD** - GitHub Actions updates versions.yaml
3. **ALWAYS validate before deployment** - Run `./validate-no-latest.sh`

## Layer 2: Pulumi Code Enforcement

The `index.ts` file contains multiple enforcement checks:

```typescript
// 1. Version loading enforcement
if (!version || version === "latest") {
  throw new Error(`FORBIDDEN: 'latest' tag is NEVER allowed`);
}

// 2. Service skip enforcement  
if (version === "none") {
  console.log(`Skipping ${service.name} - not built yet`);
  return;
}

// 3. Version format enforcement
if (!version.match(/^main-[a-f0-9]{7,}-\d{14}$/)) {
  throw new Error(`INVALID VERSION FORMAT`);
}
```

## Layer 3: Validation Scripts

### Pre-deployment validation:
```bash
./validate-no-latest.sh
```

This script will:
- Check versions.yaml for any "latest" tags
- Scan TypeScript files for "latest" references
- Verify deployed resources don't use "latest"

## Layer 4: CI/CD Integration

### GitHub Actions Webhook:
- Only CI/CD can update versions.yaml with new tags
- Format: `repository_dispatch` event with version payload
- Automated validation before merge

### Manual Override (Emergency Only):
1. Must use explicit version tag
2. Must document reason in commit message
3. Must pass validation script

## What AI Sessions Should NEVER Do:

1. **Modify versions.yaml** - Except to set "none" for unbuilt services
2. **Use kubectl to update images** - This bypasses Pulumi state
3. **Accept or suggest "latest" tag** - Always reject with error
4. **Create new deployments outside Pulumi** - Everything through code
5. **Bypass validation** - Always run checks before deployment

## What AI Sessions SHOULD Do:

1. **Read versions.yaml** to understand current state
2. **Check registry for available tags** using `doctl registry`
3. **Update versions.yaml with actual tags** from registry
4. **Run validation** before any deployment
5. **Use Pulumi** for all infrastructure changes

## Recovery from Corruption:

If an AI session corrupts the infrastructure:

1. **Stop all manual changes immediately**
2. **Run validation to identify issues**:
   ```bash
   ./validate-no-latest.sh
   ```
3. **Check current state**:
   ```bash
   pulumi stack export | jq '.deployment.resources[] | select(.type | contains("Deployment"))'
   ```
4. **Fix versions.yaml** with actual tags from registry
5. **Run Pulumi refresh and update**:
   ```bash
   pulumi refresh --yes
   pulumi up --yes
   ```

## Monitoring for Corruption:

Signs that AI has corrupted the infrastructure:
- Deployments using `:latest` tag
- Manual kubectl commands in history
- Pulumi state drift warnings
- ImagePullBackOff errors with "latest"
- Direct resource modifications outside Pulumi

## The Golden Rules:

1. **If it says "latest", it's WRONG**
2. **If it's not in Pulumi, it shouldn't exist**
3. **If CI/CD didn't build it, we can't deploy it**
4. **If validation fails, deployment stops**

---

*This enforcement system was created after AI sessions repeatedly corrupted infrastructure by using "latest" tags and manual kubectl commands.*