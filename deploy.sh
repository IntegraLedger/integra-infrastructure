#!/bin/bash
set -e

echo "========================================"
echo "INTEGRA INFRASTRUCTURE DEPLOYMENT"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v pulumi &> /dev/null; then
    echo -e "${RED}✗ Pulumi not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Pulumi found${NC}"

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}✗ kubectl not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ kubectl found${NC}"

if ! command -v doctl &> /dev/null; then
    echo -e "${RED}✗ doctl not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ doctl found${NC}"

# Configure kubectl
echo ""
echo "Configuring kubectl..."
doctl auth init -t ${DIGITALOCEAN_TOKEN:-dop_v1_8f56781ed6f8723fcb01b3b10ca17b1125dc3232ab1d5ad8d0423e936651adc9}
doctl kubernetes cluster kubeconfig save integra-k8s-cluster

# Verify cluster connection
echo ""
echo "Verifying cluster connection..."
if kubectl cluster-info &> /dev/null; then
    echo -e "${GREEN}✓ Connected to Kubernetes cluster${NC}"
else
    echo -e "${RED}✗ Failed to connect to cluster${NC}"
    exit 1
fi

# Create registry secret if it doesn't exist
echo ""
echo "Setting up registry credentials..."
kubectl create secret docker-registry integra-registry \
    --docker-server=registry.digitalocean.com \
    --docker-username=${DIGITALOCEAN_TOKEN:-dop_v1_8f56781ed6f8723fcb01b3b10ca17b1125dc3232ab1d5ad8d0423e936651adc9} \
    --docker-password=${DIGITALOCEAN_TOKEN:-dop_v1_8f56781ed6f8723fcb01b3b10ca17b1125dc3232ab1d5ad8d0423e936651adc9} \
    --docker-email=admin@trustwithintegra.com \
    -n default --dry-run=client -o yaml | kubectl apply -f -

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "Installing dependencies..."
    npm ci
fi

# Preview the deployment
echo ""
echo -e "${YELLOW}Previewing deployment...${NC}"
pulumi preview

# Ask for confirmation
echo ""
read -p "Do you want to proceed with the deployment? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Deploy
echo ""
echo -e "${YELLOW}Deploying infrastructure...${NC}"
pulumi up --yes --skip-preview

# Show outputs
echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
pulumi stack output

echo ""
echo "========================================"
echo "DEPLOYMENT SUMMARY"
echo "========================================"
echo ""
echo "Stack: $(pulumi stack --show-name)"
echo "Resources: $(pulumi stack --show-urns | grep -c urn: || echo 0)"
echo ""
echo "To destroy the infrastructure, run: pulumi destroy --yes"
echo "To view the stack, run: pulumi stack"
echo ""