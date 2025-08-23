#!/bin/bash
# Generate version tags for all services
# This creates deterministic version tags based on current date/time

set -e

TIMESTAMP=$(date +%Y%m%d%H%M%S)
VERSIONS_FILE="versions.yaml"

echo "Generating version tags with timestamp: $TIMESTAMP"

# Services list
SERVICES=(
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

# Update versions.yaml
for SERVICE in "${SERVICES[@]}"; do
  VERSION="v1.0.0-${TIMESTAMP}"
  echo "  ${SERVICE}: ${VERSION}"
  
  # Update in versions.yaml using yq
  yq eval ".services.\"${SERVICE}\".version = \"${VERSION}\"" -i "$VERSIONS_FILE"
  yq eval ".services.\"${SERVICE}\".commit = \"initial\"" -i "$VERSIONS_FILE"
  yq eval ".services.\"${SERVICE}\".deployed = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" -i "$VERSIONS_FILE"
done

# Update metadata
yq eval ".metadata.updated = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" -i "$VERSIONS_FILE"
yq eval ".metadata.updatedBy = \"version-generator\"" -i "$VERSIONS_FILE"

echo "Updated versions.yaml with proper version tags"