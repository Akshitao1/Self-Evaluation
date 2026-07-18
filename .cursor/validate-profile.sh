#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in production environment
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${YELLOW}ℹ️  Skipping profile validation in production environment${NC}"
    exit 0
fi

# Check if .cursorrules exists
if [ ! -f .cursorrules ]; then
    echo -e "${RED}❌ Error: No active profile found (.cursorrules is missing)${NC}"
    echo -e "Run one of:"
    echo -e "  ${YELLOW}npm run profile:default${NC} - For rapid development mode"
    echo -e "  ${YELLOW}npm run profile:joveo${NC} - For Joveo AI Dashboard mode"
    exit 1
fi

# Read the active profile from .cursorrules
ACTIVE_PROFILE=$(head -n 1 .cursorrules | grep -o "DEFAULT MODE\|JOVEO AI DASHBOARD MODE")

if [ -z "$ACTIVE_PROFILE" ]; then
    echo -e "${RED}❌ Error: Invalid profile format in .cursorrules${NC}"
    echo "First line should contain 'ACTIVE PROFILE: DEFAULT MODE' or 'ACTIVE PROFILE: JOVEO AI DASHBOARD MODE'"
    exit 1
fi

# Set profile directory based on active profile
if [ "$ACTIVE_PROFILE" = "DEFAULT MODE" ]; then
    PROFILE_DIR=".cursor/profiles/default"
elif [ "$ACTIVE_PROFILE" = "JOVEO AI DASHBOARD MODE" ]; then
    PROFILE_DIR=".cursor/profiles/joveo-ai-dashboard"
else
    echo -e "${RED}❌ Error: Unknown profile type: $ACTIVE_PROFILE${NC}"
    exit 1
fi

# Check if profile directory exists
if [ ! -d "$PROFILE_DIR" ]; then
    echo -e "${RED}❌ Error: Profile directory not found: $PROFILE_DIR${NC}"
    exit 1
fi

# Check if rules directory exists
if [ ! -d "$PROFILE_DIR/rules" ]; then
    echo -e "${RED}❌ Error: Rules directory not found in profile: $PROFILE_DIR/rules${NC}"
    exit 1
fi

# Skip individual rule file validation - only check directory structure
# Each profile can have its own set of rules

# Compare .cursorrules with profile's .cursorrules
if ! cmp -s ".cursorrules" "$PROFILE_DIR/.cursorrules"; then
    echo -e "${RED}❌ Error: .cursorrules file doesn't match the profile's rules${NC}"
    echo -e "Run ${YELLOW}npm run profile:$([ "$ACTIVE_PROFILE" = "DEFAULT MODE" ] && echo "default" || echo "joveo")${NC} to fix this"
    exit 1
fi

echo -e "${GREEN}✅ Profile validation successful: $ACTIVE_PROFILE${NC}"
exit 0