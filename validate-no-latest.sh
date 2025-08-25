#!/bin/bash
# Validation script to prevent "latest" tag usage
# This MUST be run before any Pulumi deployment

set -e

echo "🔍 Validating infrastructure configuration..."

# Check versions.yaml for any "latest" tags
if grep -q 'version:.*latest' versions.yaml; then
  echo "❌ FORBIDDEN: Found 'latest' tag in versions.yaml"
  echo "All services must use explicit version tags (main-{sha}-{timestamp}) or 'none'"
  grep 'version:.*latest' versions.yaml
  exit 1
fi

# Check if any TypeScript files contain "latest" as default
if grep -r '"latest"' --include="*.ts" . | grep -v "FORBIDDEN" | grep -v "validate-no-latest"; then
  echo "❌ FORBIDDEN: Found 'latest' string in TypeScript files"
  echo "Remove all references to 'latest' tag"
  exit 1
fi

# Check current Kubernetes deployments for latest tags
echo "Checking deployed images..."
DEPLOYMENTS=$(kubectl get deployments -A -o json 2>/dev/null | jq -r '.items[] | select(.metadata.namespace | startswith("integra-")) | "\(.metadata.namespace)/\(.metadata.name):\(.spec.template.spec.containers[0].image)"' || true)

if echo "$DEPLOYMENTS" | grep -q ":latest"; then
  echo "❌ WARNING: Found deployments using 'latest' tag:"
  echo "$DEPLOYMENTS" | grep ":latest"
  echo "These must be updated to use versioned tags"
fi

echo "✅ Validation passed - no 'latest' tags found in configuration"