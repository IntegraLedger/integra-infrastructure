#!/bin/bash
set -e

# This script creates standardized GitHub Actions workflows for each service

REPOS_DIR="/Users/davidfisher/AAA-LAUNCH/repos"

create_workflow() {
    local service_path=$1
    local service_name=$2
    local service_type=$3
    
    mkdir -p "$service_path/.github/workflows"
    
    cat > "$service_path/.github/workflows/build-and-push.yml" << EOF
name: Build and Push

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: registry.digitalocean.com/integra-container-registry
  IMAGE_NAME: $service_name

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Login to DigitalOcean Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ secrets.DIGITALOCEAN_TOKEN }}
          password: \${{ secrets.DIGITALOCEAN_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}
            
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:buildcache
          cache-to: type=registry,ref=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:buildcache,mode=max
          
      - name: Trigger infrastructure deployment
        if: github.ref == 'refs/heads/main'
        uses: peter-evans/repository-dispatch@v2
        with:
          token: \${{ secrets.GITHUB_TOKEN }}
          repository: IntegraLedger/integra-infrastructure
          event-type: service-updated
          client-payload: '{"service": "$service_name", "image": "\${{ steps.meta.outputs.tags }}"}'
EOF
}

# Frontend apps
for app in integra-trust-app integra-admin-app integra-explorer-app integra-docs-app; do
    if [ -d "$REPOS_DIR/apps/$app" ]; then
        echo "Creating workflow for $app"
        create_workflow "$REPOS_DIR/apps/$app" "$app" "frontend"
    fi
done

# Core services
for service in integra-bridge-service integra-admin-service integra-ai-help-service integra-dev-assistant-service; do
    if [ -d "$REPOS_DIR/services/core/$service" ]; then
        echo "Creating workflow for $service"
        create_workflow "$REPOS_DIR/services/core/$service" "$service" "backend"
    fi
done

# Blockchain services
for service in integra-blockchain-api integra-gateway-service integra-rpc-service integra-indexer-service integra-proof-service integra-hogan-api; do
    if [ -d "$REPOS_DIR/services/blockchain/$service" ]; then
        echo "Creating workflow for $service"
        create_workflow "$REPOS_DIR/services/blockchain/$service" "$service" "backend"
    fi
done

# Executor services
for service in integra-polygon-executor integra-arbitrum-executor integra-avalanche-executor integra-base-executor; do
    if [ -d "$REPOS_DIR/services/executors/$service" ]; then
        echo "Creating workflow for $service"
        create_workflow "$REPOS_DIR/services/executors/$service" "$service" "backend"
    fi
done

# Workflow services
for service in integra-temporal-orchestrator-service integra-temporal-messaging-service integra-messaging-service integra-workflow-service; do
    if [ -d "$REPOS_DIR/services/workflow/$service" ]; then
        echo "Creating workflow for $service"
        create_workflow "$REPOS_DIR/services/workflow/$service" "$service" "backend"
    fi
done

# Gateway service
if [ -d "$REPOS_DIR/gateways/integra-ai-gateway-service" ]; then
    echo "Creating workflow for integra-ai-gateway-service"
    create_workflow "$REPOS_DIR/gateways/integra-ai-gateway-service" "integra-ai-gateway-service" "backend"
fi

echo "Workflows created for all services"