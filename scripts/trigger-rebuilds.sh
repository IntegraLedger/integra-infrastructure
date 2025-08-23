#!/bin/bash
# Trigger rebuilds for all services with proper version tags

set -e

echo "Triggering rebuilds for all services with versioned tags..."

TIMESTAMP=$(date +%Y%m%d%H%M%S)

# List of all service repositories
REPOS=(
  "integra-trust-app"
  "integra-admin-app"
  "integra-developer-app"
  "integra-explorer-app"
  "integra-docs-app"
  "integra-bridge-service"
  "integra-admin-service"
  "integra-developer-service"
  "integra-ai-help-service"
  "integra-ai-gateway-service"
  "integra-dev-assistant-service"
  "integra-blockchain-api"
  "integra-gateway-service"
  "integra-rpc-service"
  "integra-indexer-service"
  "integra-proof-service"
  "integra-hogan-api"
  "integra-polygon-executor"
  "integra-arbitrum-executor"
  "integra-avalanche-executor"
  "integra-base-executor"
  "integra-temporal-orchestrator-service"
  "integra-temporal-messaging-service"
  "integra-messaging-service"
  "integra-workflow-service"
)

for REPO in "${REPOS[@]}"; do
  echo "Triggering build for $REPO..."
  
  # Create a dummy commit to trigger the build
  # This will cause GitHub Actions to build with a proper version tag
  gh api repos/IntegraLedger/$REPO/dispatches \
    --method POST \
    --field event_type=rebuild \
    --field client_payload[version]="v1.0.0-${TIMESTAMP}" \
    2>/dev/null || {
      # If repository_dispatch doesn't work, create an empty commit
      echo "  Creating empty commit to trigger build..."
      (
        TEMP_DIR=$(mktemp -d)
        cd $TEMP_DIR
        gh repo clone IntegraLedger/$REPO --depth 1
        cd $REPO
        git commit --allow-empty -m "chore: trigger rebuild with version v1.0.0-${TIMESTAMP}"
        git push
        cd ../..
        rm -rf $TEMP_DIR
      ) || echo "  Failed to trigger $REPO"
    }
done

echo "All rebuild triggers sent!"