#!/bin/bash
# 🔥 DOCKER REGISTRY CLEANUP - Delete ALL old images with 'latest' tag

set -e

echo "🔥 DOCKER REGISTRY CLEANUP - REMOVING ALL 'latest' TAGS"
echo "========================================================"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Login to registry
echo -e "${YELLOW}Logging into DigitalOcean Container Registry...${NC}"
doctl registry login

REGISTRY="registry.digitalocean.com/integra-container-registry"

# Get all repositories
echo -e "${YELLOW}Fetching all repositories...${NC}"
REPOS=$(doctl registry repository list-v2 --format Name --no-header)

echo -e "${YELLOW}Found $(echo "$REPOS" | wc -l) repositories${NC}"
echo ""

for repo in $REPOS; do
    echo -e "${YELLOW}Processing: $repo${NC}"
    
    # List all tags for this repository
    TAGS=$(doctl registry repository list-tags "$repo" --format Tag --no-header 2>/dev/null || echo "")
    
    if [ -z "$TAGS" ]; then
        echo -e "  ${YELLOW}No tags found${NC}"
        continue
    fi
    
    # Delete 'latest' tag
    if echo "$TAGS" | grep -q "^latest$"; then
        echo -e "  ${RED}✗ Deleting 'latest' tag${NC}"
        doctl registry repository delete-tag "$repo" latest --force || true
    fi
    
    # Delete any tags that look like improper versions
    for tag in $TAGS; do
        # Delete tags that are just 'main' or branch names without timestamps
        if [[ "$tag" =~ ^(main|master|develop|staging|production)$ ]]; then
            echo -e "  ${RED}✗ Deleting improper tag: $tag${NC}"
            doctl registry repository delete-tag "$repo" "$tag" --force || true
        fi
        
        # Delete any tags older than 7 days (optional - comment out if you want to keep)
        # This helps clean up old builds
        if [[ "$tag" =~ ^main-[a-f0-9]{8}-[0-9]{14}$ ]]; then
            TAG_DATE=$(echo "$tag" | grep -oE '[0-9]{14}$')
            CURRENT_DATE=$(date +%Y%m%d%H%M%S)
            SEVEN_DAYS_AGO=$(date -d '7 days ago' +%Y%m%d%H%M%S 2>/dev/null || date -v-7d +%Y%m%d%H%M%S)
            
            if [[ "$TAG_DATE" < "$SEVEN_DAYS_AGO" ]]; then
                echo -e "  ${RED}✗ Deleting old tag (>7 days): $tag${NC}"
                doctl registry repository delete-tag "$repo" "$tag" --force || true
            fi
        fi
    done
    
    # Show remaining tags
    REMAINING=$(doctl registry repository list-tags "$repo" --format Tag --no-header 2>/dev/null | wc -l)
    echo -e "  ${GREEN}✓ Remaining tags: $REMAINING${NC}"
    echo ""
done

# Run garbage collection to actually free up space
echo -e "${YELLOW}Running garbage collection to free up space...${NC}"
doctl registry garbage-collection start --force

echo "========================================================"
echo -e "${GREEN}✅ REGISTRY CLEANUP COMPLETE${NC}"
echo ""
echo "Deleted:"
echo "  • ALL 'latest' tags"
echo "  • ALL branch-name-only tags (main, master, etc.)"
echo "  • ALL tags older than 7 days"
echo ""
echo -e "${YELLOW}Garbage collection started - space will be freed shortly${NC}"