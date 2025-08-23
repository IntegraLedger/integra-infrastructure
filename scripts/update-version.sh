#!/bin/bash
# Update service version in versions.yaml
# Called by CI/CD after successful Docker build

set -e

SERVICE_NAME=$1
VERSION_TAG=$2
COMMIT_SHA=$3
BUILD_URL=$4

if [ -z "$SERVICE_NAME" ] || [ -z "$VERSION_TAG" ]; then
  echo "Usage: $0 <service-name> <version-tag> [commit-sha] [build-url]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSIONS_FILE="$SCRIPT_DIR/../versions.yaml"

# Update versions.yaml using yq
if ! command -v yq &> /dev/null; then
  echo "Installing yq..."
  wget -qO /tmp/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
  chmod +x /tmp/yq
  YQ=/tmp/yq
else
  YQ=yq
fi

# Update the service version
$YQ eval ".services.\"$SERVICE_NAME\".version = \"$VERSION_TAG\"" -i "$VERSIONS_FILE"
$YQ eval ".services.\"$SERVICE_NAME\".deployed = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" -i "$VERSIONS_FILE"

if [ ! -z "$COMMIT_SHA" ]; then
  $YQ eval ".services.\"$SERVICE_NAME\".commit = \"$COMMIT_SHA\"" -i "$VERSIONS_FILE"
fi

if [ ! -z "$BUILD_URL" ]; then
  $YQ eval ".services.\"$SERVICE_NAME\".buildUrl = \"$BUILD_URL\"" -i "$VERSIONS_FILE"
fi

# Update metadata
$YQ eval ".metadata.updated = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" -i "$VERSIONS_FILE"
$YQ eval ".metadata.updatedBy = \"ci-pipeline\"" -i "$VERSIONS_FILE"

echo "Updated $SERVICE_NAME to version $VERSION_TAG in versions.yaml"