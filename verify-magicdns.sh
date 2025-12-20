#!/bin/bash
# MagicDNS Configuration Verification Script
# This script verifies that your NoisePort MagicDNS setup is correctly configured

set -e

echo "🔍 NoisePort MagicDNS Configuration Verification"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected IP addresses
declare -A EXPECTED_IPS
EXPECTED_IPS[navidrome]="172.20.0.10"
EXPECTED_IPS[jellyfin]="172.20.0.11"
EXPECTED_IPS[slskd]="172.20.0.12"
EXPECTED_IPS[fastapi]="172.20.0.13"

# Check if running from correct directory
if [ ! -f "docker-compose.full.yml.template" ]; then
    echo -e "${RED}❌ Error: Please run this script from the noiseport-server directory${NC}"
    exit 1
fi

# Check 1: Verify docker-compose.full.yml has static IPs
echo "1️⃣  Checking docker-compose.full.yml.template for static IP configuration..."
if grep -q "ipv4_address: 172.20.0.10" docker-compose.full.yml.template; then
    echo -e "   ${GREEN}✅ Static IP configuration found in template${NC}"
else
    echo -e "   ${RED}❌ Static IP configuration missing in template${NC}"
    echo "   Please ensure docker-compose.full.yml.template has static IP assignments"
    exit 1
fi

# Check 2: Verify network subnet configuration
echo ""
echo "2️⃣  Checking network subnet configuration..."
if grep -q "subnet: 172.20.0.0/16" docker-compose.full.yml.template; then
    echo -e "   ${GREEN}✅ Network subnet correctly configured (172.20.0.0/16)${NC}"
else
    echo -e "   ${RED}❌ Network subnet configuration missing or incorrect${NC}"
    exit 1
fi

# Check 3: Verify Headscale DNS configuration
echo ""
echo "3️⃣  Checking Headscale DNS configuration..."
if [ -f "config/headscale/config.yaml.template" ]; then
    if grep -q "magic_dns: true" config/headscale/config.yaml.template; then
        echo -e "   ${GREEN}✅ MagicDNS enabled in Headscale template${NC}"
    else
        echo -e "   ${YELLOW}⚠️  MagicDNS not enabled in Headscale template${NC}"
    fi
    
    if grep -q "172.20.0.10" config/headscale/config.yaml.template; then
        echo -e "   ${GREEN}✅ DNS extra_records configured${NC}"
    else
        echo -e "   ${RED}❌ DNS extra_records missing${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  Headscale template not found (may not be using Headscale)${NC}"
fi

# Check 4: Verify running containers (if any)
echo ""
echo "4️⃣  Checking running container IP addresses..."
ALL_MATCH=true

for container in "${!EXPECTED_IPS[@]}"; do
    expected_ip="${EXPECTED_IPS[$container]}"
    
    # Get actual IP (only from noiseport network)
    actual_ip=$(docker inspect -f '{{range $net, $conf := .NetworkSettings.Networks}}{{if eq $net "noiseport"}}{{$conf.IPAddress}}{{end}}{{end}}' "$container" 2>/dev/null || echo "")
    
    if [ -z "$actual_ip" ]; then
        echo -e "   ${YELLOW}⚠️  Container '$container' not found or not running${NC}"
    elif [ "$actual_ip" == "$expected_ip" ]; then
        echo -e "   ${GREEN}✅ $container: $actual_ip (matches expected)${NC}"
    else
        echo -e "   ${RED}❌ $container: $actual_ip (expected $expected_ip)${NC}"
        ALL_MATCH=false
    fi
done

# Check 5: Verify network exists and has correct configuration
echo ""
echo "5️⃣  Checking Docker network configuration..."
if docker network inspect noiseport >/dev/null 2>&1; then
    subnet=$(docker network inspect noiseport -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null)
    if [ "$subnet" == "172.20.0.0/16" ]; then
        echo -e "   ${GREEN}✅ Network 'noiseport' configured with correct subnet: $subnet${NC}"
    else
        echo -e "   ${RED}❌ Network 'noiseport' has incorrect subnet: $subnet${NC}"
        echo "      Expected: 172.20.0.0/16"
        ALL_MATCH=false
    fi
else
    echo -e "   ${YELLOW}⚠️  Network 'noiseport' does not exist yet${NC}"
fi

# Check 6: Test API validation endpoint (if API is running)
echo ""
echo "6️⃣  Testing DNS validation endpoint..."
if curl -s http://localhost:8010/api/v1/config/validate-dns >/dev/null 2>&1; then
    validation_result=$(curl -s http://localhost:8010/api/v1/config/validate-dns)
    is_valid=$(echo "$validation_result" | jq -r '.valid' 2>/dev/null || echo "unknown")
    
    if [ "$is_valid" == "true" ]; then
        echo -e "   ${GREEN}✅ API validation endpoint reports: VALID${NC}"
    elif [ "$is_valid" == "false" ]; then
        echo -e "   ${RED}❌ API validation endpoint reports: INVALID${NC}"
        echo "      Check: http://localhost:8010/api/v1/config/validate-dns"
        ALL_MATCH=false
    else
        echo -e "   ${YELLOW}⚠️  Could not parse validation result${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  API not running or not accessible (this is OK if services aren't started)${NC}"
fi

# Summary
echo ""
echo "================================================"
if [ "$ALL_MATCH" == "true" ]; then
    echo -e "${GREEN}✅ MagicDNS Configuration: VALID${NC}"
    echo ""
    echo "Your MagicDNS setup is correctly configured!"
    echo "Once you connect to the VPN, you can access services at:"
    echo "  • http://navidrome:4533"
    echo "  • http://jellyfin:8096"
    echo "  • http://slskd:5030"
    echo "  • http://api:80"
else
    echo -e "${RED}❌ MagicDNS Configuration: ISSUES DETECTED${NC}"
    echo ""
    echo "To fix issues:"
    echo "  1. Stop containers: docker compose down"
    echo "  2. Remove network: docker network rm noiseport"
    echo "  3. Start containers: docker compose up -d"
    echo "  4. Run this script again to verify"
fi

echo ""
echo "For detailed validation, visit:"
echo "  http://localhost:8010/api/v1/config/validate-dns"
echo ""
