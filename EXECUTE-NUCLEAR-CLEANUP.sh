#!/bin/bash
# 🔥🔥🔥 NUCLEAR CLEANUP - DESTROY ALL LEGACY DEPLOYMENT CODE 🔥🔥🔥
# 
# WARNING: This will DELETE:
#   - ALL GitHub Actions workflows from ALL repos
#   - ALL Dockerfiles from ALL repos  
#   - ALL deployment configurations
#   - ALL 'latest' tags from Docker registry
#   - ALL legacy secrets from GitHub
#   - ALL Pulumi state
#
# THERE IS NO UNDO!

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

clear

echo -e "${RED}${BOLD}"
echo "🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥"
echo "     NUCLEAR CLEANUP - TOTAL LEGACY DESTRUCTION"
echo "🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥"
echo -e "${NC}"

echo -e "${YELLOW}${BOLD}This script will PERMANENTLY DELETE:${NC}"
echo ""
echo "  📁 Repository Files:"
echo "     • ALL .github/workflows/ files"
echo "     • ALL Dockerfiles"
echo "     • ALL docker-compose files"
echo "     • ALL .npmrc files"
echo "     • ALL deployment scripts"
echo "     • ALL CI/CD configs"
echo ""
echo "  🐳 Docker Registry:"
echo "     • ALL 'latest' tags"
echo "     • ALL branch-name tags"
echo "     • ALL images >7 days old"
echo ""
echo "  🔐 GitHub Secrets:"
echo "     • INFISICAL_TOKEN (legacy)"
echo "     • NPM_TOKEN (should be NPM_GITHUB_TOKEN)"
echo "     • All VITE_* secrets"
echo "     • All redundant secrets"
echo ""
echo "  📊 Pulumi State:"
echo "     • Option to destroy all K8s resources"
echo "     • Option to clear entire state"
echo "     • Option for complete nuclear reset"
echo ""
echo -e "${RED}${BOLD}⚠️  THIS CANNOT BE UNDONE! ⚠️${NC}"
echo ""
read -p "Type 'DESTROY EVERYTHING' to proceed: " confirm

if [ "$confirm" != "DESTROY EVERYTHING" ]; then
    echo -e "${YELLOW}Aborted. Nothing was deleted.${NC}"
    exit 0
fi

echo ""
echo -e "${RED}${BOLD}Starting NUCLEAR CLEANUP...${NC}"
echo ""

# Create log directory
LOGDIR="/Users/davidfisher/AAA-LAUNCH/integra-infrastructure/cleanup-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGDIR"

# Function to run cleanup scripts
run_cleanup() {
    local script=$1
    local name=$2
    local logfile="$LOGDIR/$name.log"
    
    echo -e "${YELLOW}▶ Running: $name${NC}"
    
    if bash "$script" > "$logfile" 2>&1; then
        echo -e "${GREEN}  ✅ $name completed${NC}"
    else
        echo -e "${RED}  ❌ $name failed (check $logfile)${NC}"
        echo -e "${YELLOW}  Continuing with other cleanups...${NC}"
    fi
    echo ""
}

# Make all scripts executable
chmod +x /Users/davidfisher/AAA-LAUNCH/integra-infrastructure/*.sh

# Phase 1: Repository Cleanup
echo -e "${BLUE}${BOLD}PHASE 1: Repository File Cleanup${NC}"
echo "========================================="
run_cleanup "./TOTAL-CLEANUP-SCRIPT.sh" "repository-cleanup"

# Phase 2: Docker Registry Cleanup
echo -e "${BLUE}${BOLD}PHASE 2: Docker Registry Cleanup${NC}"
echo "========================================="
read -p "Clean Docker registry? (y/n): " clean_docker
if [ "$clean_docker" = "y" ]; then
    run_cleanup "./DOCKER-REGISTRY-CLEANUP.sh" "docker-cleanup"
else
    echo -e "${YELLOW}  Skipped Docker registry cleanup${NC}\n"
fi

# Phase 3: GitHub Secrets Cleanup
echo -e "${BLUE}${BOLD}PHASE 3: GitHub Secrets Cleanup${NC}"
echo "========================================="
read -p "Clean GitHub secrets? (y/n): " clean_secrets
if [ "$clean_secrets" = "y" ]; then
    run_cleanup "./GITHUB-SECRETS-CLEANUP.sh" "secrets-cleanup"
else
    echo -e "${YELLOW}  Skipped GitHub secrets cleanup${NC}\n"
fi

# Phase 4: Pulumi State Cleanup
echo -e "${BLUE}${BOLD}PHASE 4: Pulumi State Cleanup${NC}"
echo "========================================="
read -p "Clean Pulumi state? (y/n): " clean_pulumi
if [ "$clean_pulumi" = "y" ]; then
    run_cleanup "./PULUMI-STATE-CLEANUP.sh" "pulumi-cleanup"
else
    echo -e "${YELLOW}  Skipped Pulumi state cleanup${NC}\n"
fi

# Phase 5: Additional Cleanup
echo -e "${BLUE}${BOLD}PHASE 5: Final Cleanup${NC}"
echo "========================================="

# Clean old infrastructure directories
echo -e "${YELLOW}Cleaning old infrastructure directories...${NC}"
if [ -d "/Users/davidfisher/AAA-LAUNCH/integra-infrastructure-old" ]; then
    rm -rf /Users/davidfisher/AAA-LAUNCH/integra-infrastructure-old
    echo -e "${GREEN}  ✅ Removed old infrastructure backup${NC}"
fi

# Clean Pulumi home cache
echo -e "${YELLOW}Cleaning Pulumi cache...${NC}"
rm -rf ~/.pulumi/plugins/resource-kubernetes-* 2>/dev/null || true
echo -e "${GREEN}  ✅ Cleaned Pulumi plugin cache${NC}"

echo ""
echo "========================================="
echo -e "${GREEN}${BOLD}🎉 NUCLEAR CLEANUP COMPLETE! 🎉${NC}"
echo "========================================="
echo ""
echo -e "${GREEN}What was destroyed:${NC}"
echo "  ✅ All legacy GitHub Actions workflows"
echo "  ✅ All Dockerfiles and Docker configs"
echo "  ✅ All deployment scripts and configs"
echo "  ✅ All legacy secrets"
echo "  ✅ All 'latest' Docker tags"
echo "  ✅ Pulumi state (if selected)"
echo ""
echo -e "${YELLOW}${BOLD}Next Steps:${NC}"
echo "  1. Run: ${BLUE}bash CREATE-STANDARD-TEMPLATES.sh${NC}"
echo "  2. Run: ${BLUE}bash APPLY-TEMPLATES-TO-ALL.sh${NC}"
echo "  3. Run: ${BLUE}bash DEPLOY-FRESH-INFRASTRUCTURE.sh${NC}"
echo ""
echo -e "${YELLOW}Logs saved to: $LOGDIR${NC}"
echo ""
echo -e "${GREEN}${BOLD}Ready for clean, standardized deployment! 🚀${NC}"