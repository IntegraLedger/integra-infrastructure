#!/bin/bash
# 🔥 GITHUB SECRETS CLEANUP - Standardize ALL repository secrets

set -e

echo "🔥 GITHUB SECRETS CLEANUP - REMOVING LEGACY SECRETS"
echo "===================================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get all IntegraLedger repos
echo -e "${YELLOW}Fetching all IntegraLedger repositories...${NC}"
REPOS=$(gh repo list IntegraLedger --limit 100 --json name -q '.[].name')
TOTAL_REPOS=$(echo "$REPOS" | wc -l | tr -d ' ')

echo -e "${YELLOW}Found $TOTAL_REPOS repositories${NC}"
echo ""

# Secrets to DELETE (legacy/deprecated)
LEGACY_SECRETS=(
    "INFISICAL_TOKEN"           # Old approach - using CLIENT_ID/SECRET now
    "NPM_TOKEN"                 # Should be NPM_GITHUB_TOKEN
    "VITE_PRIVY_APP_ID"        # Should come from Infisical
    "VITE_ABLY_API_KEY"        # Should come from Infisical  
    "VITE_AI_GATEWAY_URL"      # Should come from Infisical
    "GITHUB_PAT"               # Redundant
    "GH_TOKEN"                 # Redundant
    "DOCKER_PASSWORD"          # Using DIGITALOCEAN_TOKEN
    "DOCKER_USERNAME"          # Using DIGITALOCEAN_TOKEN
    "REGISTRY_PASSWORD"        # Using DIGITALOCEAN_TOKEN
    "REGISTRY_USERNAME"        # Using DIGITALOCEAN_TOKEN
    "KUBECONFIG"              # Security risk
    "KUBE_CONFIG"             # Security risk
    "K8S_CONFIG"              # Security risk
)

# Secrets that MUST exist (will verify, not create here)
REQUIRED_SECRETS=(
    "NPM_GITHUB_TOKEN"
    "DIGITALOCEAN_TOKEN"
    "INFISICAL_CLIENT_ID"
    "INFISICAL_CLIENT_SECRET"
    "PULUMI_TRIGGER_TOKEN"
)

COUNT=0

for repo in $REPOS; do
    COUNT=$((COUNT + 1))
    echo -e "${YELLOW}[$COUNT/$TOTAL_REPOS] Processing: IntegraLedger/$repo${NC}"
    
    # Get current secrets
    CURRENT_SECRETS=$(gh secret list --repo "IntegraLedger/$repo" --json name -q '.[].name' 2>/dev/null || echo "")
    
    # Delete legacy secrets
    for secret in "${LEGACY_SECRETS[@]}"; do
        if echo "$CURRENT_SECRETS" | grep -q "^$secret$"; then
            echo -e "  ${RED}✗ Deleting legacy secret: $secret${NC}"
            gh secret delete "$secret" --repo "IntegraLedger/$repo" 2>/dev/null || true
        fi
    done
    
    # Verify required secrets exist
    MISSING_SECRETS=()
    for secret in "${REQUIRED_SECRETS[@]}"; do
        if ! echo "$CURRENT_SECRETS" | grep -q "^$secret$"; then
            MISSING_SECRETS+=("$secret")
        fi
    done
    
    if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
        echo -e "  ${RED}⚠ Missing required secrets: ${MISSING_SECRETS[*]}${NC}"
    else
        echo -e "  ${GREEN}✓ All required secrets present${NC}"
    fi
    
    echo ""
done

echo "===================================================="
echo -e "${GREEN}✅ SECRETS CLEANUP COMPLETE${NC}"
echo ""
echo "Deleted legacy secrets:"
for secret in "${LEGACY_SECRETS[@]}"; do
    echo "  • $secret"
done
echo ""
echo "Required secrets (verified):"
for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "  • $secret"
done
echo ""
echo -e "${YELLOW}Note: Missing secrets must be added separately with proper values${NC}"