#!/bin/bash
# 🔥 TOTAL CLEANUP SCRIPT - Remove ALL Legacy Deployment Files
# This script will DESTROY all old deployment patterns with extreme prejudice

set -e

echo "🔥 NUCLEAR CLEANUP - REMOVING ALL LEGACY DEPLOYMENT FILES"
echo "==========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find all repos
REPOS=$(find /Users/davidfisher/AAA-LAUNCH/repos -type d -name ".git" -exec dirname {} \; | sort)
TOTAL_REPOS=$(echo "$REPOS" | wc -l | tr -d ' ')

echo -e "${YELLOW}Found $TOTAL_REPOS repositories to clean${NC}"
echo ""

# Counter
COUNT=0

for repo in $REPOS; do
    COUNT=$((COUNT + 1))
    REPO_NAME=$(basename "$repo")
    echo -e "${YELLOW}[$COUNT/$TOTAL_REPOS] Cleaning: $REPO_NAME${NC}"
    
    cd "$repo"
    
    # 1. DELETE ALL GitHub Actions workflows - no mercy
    if [ -d ".github/workflows" ]; then
        echo -e "${RED}  ✗ Deleting ALL workflows${NC}"
        rm -rf .github/workflows/*
        # Keep the directory, just empty
        mkdir -p .github/workflows
        touch .github/workflows/.gitkeep
    fi
    
    # 2. DELETE ALL Dockerfiles and related files
    echo -e "${RED}  ✗ Deleting ALL Docker files${NC}"
    rm -f Dockerfile* || true
    rm -f .dockerignore || true
    rm -f docker-compose* || true
    rm -rf docker/ || true
    
    # 3. DELETE deployment-related configs
    echo -e "${RED}  ✗ Deleting deployment configs${NC}"
    rm -f .env.example || true
    rm -f .env.production || true
    rm -f .env.development || true
    rm -f deploy.sh || true
    rm -f deploy.yml || true
    rm -rf k8s/ || true
    rm -rf kubernetes/ || true
    rm -rf deployment/ || true
    rm -rf .deploy/ || true
    
    # 4. DELETE CI/CD related files
    echo -e "${RED}  ✗ Deleting CI/CD files${NC}"
    rm -f .travis.yml || true
    rm -f .gitlab-ci.yml || true
    rm -f Jenkinsfile || true
    rm -f azure-pipelines.yml || true
    rm -rf .circleci/ || true
    
    # 5. DELETE old build scripts
    echo -e "${RED}  ✗ Deleting build scripts${NC}"
    rm -f build.sh || true
    rm -f build-docker.sh || true
    rm -f push.sh || true
    rm -f release.sh || true
    
    # 6. DELETE Pulumi files (if any exist in repos)
    echo -e "${RED}  ✗ Deleting any Pulumi files${NC}"
    rm -f Pulumi.yaml || true
    rm -f Pulumi.*.yaml || true
    rm -rf pulumi/ || true
    
    # 7. DELETE terraform files (if any legacy IaC)
    echo -e "${RED}  ✗ Deleting any Terraform files${NC}"
    rm -f *.tf || true
    rm -f *.tfvars || true
    rm -rf terraform/ || true
    
    # 8. DELETE helm charts (if any)
    echo -e "${RED}  ✗ Deleting any Helm charts${NC}"
    rm -rf charts/ || true
    rm -rf helm/ || true
    rm -f Chart.yaml || true
    rm -f values.yaml || true
    
    # 9. DELETE nginx configs
    echo -e "${RED}  ✗ Deleting nginx configs${NC}"
    rm -f nginx.conf || true
    rm -f nginx.*.conf || true
    rm -rf nginx/ || true
    
    # 10. Clean up .npmrc (will recreate fresh)
    echo -e "${RED}  ✗ Deleting .npmrc for fresh start${NC}"
    rm -f .npmrc || true
    
    # 11. DELETE any GitHub Actions artifacts
    rm -rf .github/actions/ || true
    rm -rf .github/scripts/ || true
    
    # 12. DELETE any old secret files
    echo -e "${RED}  ✗ Deleting secret references${NC}"
    rm -f secrets.yaml || true
    rm -f secrets.json || true
    rm -rf secrets/ || true
    
    echo -e "${GREEN}  ✓ Repository cleaned${NC}"
    echo ""
done

echo "==========================================================="
echo -e "${GREEN}✅ CLEANUP COMPLETE - All $TOTAL_REPOS repositories cleaned${NC}"
echo ""
echo "Deleted from all repos:"
echo "  • ALL GitHub Actions workflows"
echo "  • ALL Dockerfiles and Docker-related files"
echo "  • ALL deployment configurations"
echo "  • ALL CI/CD platform files"
echo "  • ALL build scripts"
echo "  • ALL IaC files (Pulumi, Terraform, Helm)"
echo "  • ALL nginx configurations"
echo "  • ALL .npmrc files"
echo "  • ALL secret files"
echo ""
echo -e "${YELLOW}Ready for clean standardized deployment setup!${NC}"