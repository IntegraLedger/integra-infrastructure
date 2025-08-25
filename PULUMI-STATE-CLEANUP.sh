#!/bin/bash
# 🔥 PULUMI STATE CLEANUP - Complete state reset

set -e

echo "🔥 PULUMI STATE CLEANUP - DESTROYING OLD STATE"
echo "=============================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd /Users/davidfisher/AAA-LAUNCH/integra-infrastructure

# 1. Export current state as backup
echo -e "${YELLOW}Backing up current state...${NC}"
BACKUP_FILE="pulumi-backup-$(date +%Y%m%d-%H%M%S).json"
pulumi stack export --stack dev > "$BACKUP_FILE"
echo -e "${GREEN}✓ State backed up to: $BACKUP_FILE${NC}"

# 2. Show what we're about to destroy
echo -e "${YELLOW}Current resources in state:${NC}"
pulumi stack --stack dev --show-urns | grep "URN" | wc -l || echo "0"

# 3. Aggressive cleanup options
echo ""
echo -e "${YELLOW}Choose cleanup strategy:${NC}"
echo "1) DESTROY ALL - Run pulumi destroy (removes K8s resources)"
echo "2) ABANDON ALL - Clear state without deleting K8s resources"
echo "3) NUCLEAR - Delete entire stack and recreate"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo -e "${RED}DESTROYING all Kubernetes resources...${NC}"
        pulumi destroy --stack dev --yes --skip-preview || {
            echo -e "${YELLOW}Destroy failed - some resources may be protected${NC}"
            echo -e "${YELLOW}Attempting force refresh and retry...${NC}"
            pulumi refresh --stack dev --yes --skip-preview
            pulumi destroy --stack dev --yes --skip-preview --target-dependents || true
        }
        ;;
    
    2)
        echo -e "${YELLOW}ABANDONING all resources (keeping K8s objects)...${NC}"
        # Get all resource URNs
        URNS=$(pulumi stack --stack dev --show-urns | grep "URN" | awk '{print $4}')
        
        # Delete each from state without destroying
        for urn in $URNS; do
            echo -e "${RED}  ✗ Removing from state: ${urn:0:60}...${NC}"
            pulumi state delete "$urn" --stack dev --yes 2>/dev/null || true
        done
        ;;
    
    3)
        echo -e "${RED}NUCLEAR OPTION - Deleting entire stack...${NC}"
        
        # First try to destroy
        pulumi destroy --stack dev --yes --skip-preview || true
        
        # Then remove the stack entirely
        pulumi stack rm dev --yes --force || {
            echo -e "${YELLOW}Force removing stack...${NC}"
            # If that fails, manually clear
            rm -rf ~/.pulumi/stacks/dafisher2000-org/integra-infrastructure/dev.json
        }
        
        # Recreate empty stack
        echo -e "${YELLOW}Creating fresh stack...${NC}"
        pulumi stack init dev
        pulumi config set kubernetes:context integra-dev
        pulumi config set environment dev
        pulumi config set containerRegistry registry.digitalocean.com/integra-container-registry
        ;;
esac

# 4. Clean up local Pulumi artifacts
echo -e "${YELLOW}Cleaning local Pulumi artifacts...${NC}"
rm -rf .pulumi/ || true
rm -f Pulumi.dev.yaml || true

# 5. Verify cleanup
echo ""
echo -e "${YELLOW}Verifying cleanup...${NC}"
REMAINING=$(pulumi stack --stack dev --show-urns 2>/dev/null | grep "URN" | wc -l || echo "0")

if [ "$REMAINING" -eq "0" ]; then
    echo -e "${GREEN}✅ Pulumi state is completely clean!${NC}"
else
    echo -e "${RED}⚠ Warning: $REMAINING resources still in state${NC}"
    echo "Run 'pulumi state delete --all' to force clear"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}✅ PULUMI CLEANUP COMPLETE${NC}"
echo ""
echo "Next steps:"
echo "  1. Delete old infrastructure code: rm -rf *.ts components/ node_modules/"
echo "  2. Create fresh Pulumi project: pulumi new typescript --force"
echo "  3. Implement single standardized component"
echo ""
echo -e "${YELLOW}Backup saved to: $BACKUP_FILE${NC}"