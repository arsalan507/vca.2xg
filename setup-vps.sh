#!/bin/bash

# VPS Setup Script for Coolify Deployment
# Run this script on your VPS after connecting via SSH

set -e

echo "======================================"
echo "VPS Setup for Viral Content Analyzer"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

echo -e "${GREEN}Step 1: Updating system...${NC}"
apt update && apt upgrade -y

echo -e "${GREEN}Step 2: Installing essential packages...${NC}"
apt install -y curl wget git ufw htop

echo -e "${GREEN}Step 3: Configuring firewall...${NC}"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
echo "y" | ufw enable

echo -e "${GREEN}Step 4: Creating coolify user...${NC}"
if id "coolify" &>/dev/null; then
    echo -e "${YELLOW}User coolify already exists${NC}"
else
    adduser --gecos "" --disabled-password coolify
    usermod -aG sudo coolify
    echo -e "${GREEN}User coolify created${NC}"
fi

echo -e "${GREEN}Step 5: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker coolify
    rm get-docker.sh
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${YELLOW}Docker already installed${NC}"
fi

echo -e "${GREEN}Step 6: Installing Coolify...${NC}"
if ! command -v coolify &> /dev/null; then
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
    echo -e "${GREEN}Coolify installed successfully${NC}"
else
    echo -e "${YELLOW}Coolify already installed${NC}"
fi

echo ""
echo -e "${GREEN}======================================"
echo "Setup Complete!"
echo "======================================${NC}"
echo ""
echo "Next steps:"
echo "1. Access Coolify at: http://$(curl -s ifconfig.me):8000"
echo "2. Or if using domain: https://coolify.yourdomain.com"
echo "3. Follow the COOLIFY_DEPLOYMENT_GUIDE.md for deployment steps"
echo ""
echo -e "${YELLOW}Note: You may need to logout and login again for Docker permissions to take effect${NC}"
echo ""
