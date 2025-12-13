# NoisePort VPN Access Guide

## 🔒 Security Architecture

NoisePort uses a **VPN-only access model** for enhanced security. Music services are **not publicly accessible** via direct IP addresses. All access requires connection through the Headscale VPN.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Internet (Public Access)                   │
│                                             │
│  ✅ https://your-domain.sslip.io           │
│     └─> Headscale API (VPN registration)   │
│                                             │
│  ✅ https://admin.your-domain.sslip.io     │
│     └─> Headplane UI (VPN management)      │
│                                             │
│  ❌ Music services (NOT publicly exposed)  │
└─────────────────────────────────────────────┘
                      │
                      │ VPN Tunnel
                      ▼
┌─────────────────────────────────────────────┐
│  Private Network (VPN-Only Access)          │
│                                             │
│  ✅ http://navidrome:4533                  │
│  ✅ http://jellyfin:8096                   │
│  ✅ http://slskd:5030                      │
│  ✅ http://fastapi:8000                    │
└─────────────────────────────────────────────┘
```

## Why VPN-Only Access?

### Without VPN (Insecure):
- ❌ All ports exposed to internet
- ❌ Vulnerable to attacks, port scanning
- ❌ HTTP traffic unencrypted
- ❌ Anyone can attempt to connect
- ❌ Complex firewall management

### With Headscale VPN (Secure):
- ✅ Only VPN port exposed (41641/udp)
- ✅ Zero-trust: Each device must be authorized
- ✅ All traffic encrypted via WireGuard
- ✅ Works through NAT, firewalls, mobile networks
- ✅ Granular per-user/device permissions
- ✅ MagicDNS for easy service discovery

## Setup Instructions

### 1. Initial Setup (Admin)

#### On Server:
```bash
# 1. Complete wizard setup at http://YOUR_IP:8000/wizard
# 2. Configure Headscale in the wizard
# 3. Launch Headscale infrastructure
# 4. Access Headplane at https://admin.YOUR_DOMAIN.sslip.io
```

#### Create First User:
```bash
# SSH to server
gcloud compute ssh ensemble

# Create a namespace (user group)
docker exec headscale headscale namespaces create family

# Generate pre-auth key for new device
docker exec headscale headscale preauthkeys create --namespace family --expiration 24h

# Copy the generated key (starts with "...")
```

### 2. Client Setup (Users)

#### Install Tailscale Client:

**macOS/Linux:**
```bash
# macOS
brew install tailscale

# Linux (Ubuntu/Debian)
curl -fsSL https://tailscale.com/install.sh | sh
```

**Windows:**
- Download from: https://tailscale.com/download/windows

**iOS/Android:**
- Download from App Store / Play Store

#### Connect to VPN:

```bash
# Replace with your server details
sudo tailscale up \
  --login-server=https://YOUR_DOMAIN.sslip.io \
  --authkey=YOUR_PREAUTH_KEY

# Verify connection
tailscale status
```

### 3. Add Server to VPN (CRITICAL STEP)

**The server itself must join the Headscale VPN** to be accessible via MagicDNS:

```bash
# SSH to your server
gcloud compute ssh ensemble

# Generate pre-auth key for the server
docker exec headscale headscale preauthkeys create --user main --reusable --expiration 24h

# Install Tailscale on the server (if not already installed)
curl -fsSL https://tailscale.com/install.sh | sh

# Connect server to Headscale VPN
sudo tailscale up --login-server=https://YOUR_DOMAIN.sslip.io --authkey=YOUR_PREAUTH_KEY

# Check connection and find your server's hostname
tailscale status
```

The output will show something like:
```
100.64.0.3  ensemble  main  linux  -
```

Your server's MagicDNS hostname is: **ensemble.headscale.local** (or whatever name appears in the status)

⚠️ **Important:** Save this hostname in the wizard's Headscale step! This will be used by all clients to access services.

### 4. Access Services

Once connected to VPN, access services using the **server's MagicDNS hostname** (the one you saved in the wizard):

| Service | URL | Description |
|---------|-----|-------------|
| Navidrome | `http://YOUR-SERVER-NAME.headscale.local:4533` | Music streaming server |
| Jellyfin | `http://YOUR-SERVER-NAME.headscale.local:8096` | Media server |
| slskd | `http://YOUR-SERVER-NAME.headscale.local:5030` | Soulseek client |
| FastAPI | `http://YOUR-SERVER-NAME.headscale.local:8010` | Backend API |

Or use the VPN IP address directly (found with `tailscale status`):
- `http://100.64.0.3:4533` (Navidrome)
- `http://100.64.0.3:8096` (Jellyfin)
- `http://100.64.0.3:5030` (slskd)
- `http://100.64.0.3:8010` (FastAPI)

**Note:** These URLs ONLY work when connected to the VPN!

## Managing Users (Admin)

### Via Headplane UI:
1. Access `https://admin.YOUR_DOMAIN.sslip.io`
2. Login with Headscale API key
3. Manage users, devices, and access policies

### Via Command Line:

```bash
# List all devices
docker exec headscale headscale nodes list

# Create new namespace (user group)
docker exec headscale headscale namespaces create USERNAME

# Generate pre-auth key
docker exec headscale headscale preauthkeys create --namespace USERNAME --expiration 24h

# Approve a device
docker exec headscale headscale nodes register --namespace USERNAME --key NODE_KEY

# Remove a device
docker exec headscale headscale nodes delete --identifier NODE_ID
```

## Access Control (ACL)

By default, all VPN users can access all services. To restrict access:

1. Edit Headscale ACL policy:
```bash
# Create ACL file
cat > ~/noiseport-server/wizard-config/headscale/acl.json << 'EOF'
{
  "acls": [
    {
      "action": "accept",
      "src": ["family"],
      "dst": ["*:*"]
    },
    {
      "action": "accept",
      "src": ["friends"],
      "dst": ["navidrome:4533", "jellyfin:8096"]
    }
  ]
}
EOF

# Restart Headscale
docker restart headscale
```

## Troubleshooting

### Can't Connect to VPN:

```bash
# Check Headscale is running
docker ps | grep headscale

# Check Headscale logs
docker logs headscale -f

# Verify firewall allows UDP 41641
sudo ufw status
```

### VPN Connected but Can't Access Services:

```bash
# Verify MagicDNS is enabled
tailscale status

# Try using container names
ping navidrome

# Check service is running
docker ps | grep navidrome

# Verify network connectivity
docker exec navidrome ping -c 3 headscale
```

### Headplane Won't Load:

```bash
# Check Caddy is running
docker ps | grep caddy

# Check Caddy logs
docker logs caddy -f

# Verify SSL certificate
curl -v https://admin.YOUR_DOMAIN.sslip.io
```

## Mobile Access

### iOS/Android Setup:
1. Install Tailscale app from store
2. Open app and tap "Add Account"
3. Select "Use a custom control server"
4. Enter: `https://YOUR_DOMAIN.sslip.io`
5. Paste pre-auth key when prompted
6. Connect!

### Access Services on Mobile:
- Use same MagicDNS URLs: `http://navidrome:4533`
- Works on cellular, WiFi, anywhere
- Automatic reconnection
- Background VPN mode available

## Best Practices

### For Admins:
1. ✅ Generate unique pre-auth keys per user
2. ✅ Set expiration on pre-auth keys (24h)
3. ✅ Use namespaces to organize users
4. ✅ Regularly review connected devices
5. ✅ Keep Headscale/Headplane updated
6. ✅ Monitor Headscale logs for issues

### For Users:
1. ✅ Keep VPN connected for seamless access
2. ✅ Use mobile app for on-the-go access
3. ✅ Don't share your pre-auth key
4. ✅ Report lost devices to admin immediately
5. ✅ Use bookmarks for service URLs

## Advanced Configuration

### Enable HTTPS for Internal Services:

If you want HTTPS even inside VPN:

```yaml
# Add to docker-compose.headscale.yml
caddy-internal:
  image: caddy:latest
  networks:
    - headscale-net
  volumes:
    - ./caddy-internal:/etc/caddy
  # Add reverse proxy config for each service
```

### Custom Domain Names:

Instead of IP-based sslip.io:

1. Buy domain (e.g., `mymusic.com`)
2. Point A record to server IP
3. Update `.env` with domain
4. Restart Headscale stack
5. Automatic SSL for all subdomains

### Split-Tunnel VPN:

Only route music traffic through VPN:

```bash
# On client
tailscale up \
  --login-server=https://YOUR_DOMAIN.sslip.io \
  --authkey=YOUR_KEY \
  --accept-routes=false
```

## Security Considerations

### What's Protected:
- ✅ Music services not exposed to internet
- ✅ All VPN traffic encrypted
- ✅ Per-device authentication
- ✅ Centralized access control

### What's Still Public:
- ⚠️ Headscale API (required for VPN registration)
- ⚠️ Headplane UI (required for management)
- ℹ️ Both use HTTPS with Let's Encrypt

### Additional Hardening:
1. Enable 2FA on Headplane (if supported)
2. Use strong API keys
3. Restrict Headplane to VPN-only (advanced)
4. Enable fail2ban on server
5. Regular security updates

## Support

For issues or questions:
- Check logs: `docker logs <container>`
- Review Headscale docs: https://headscale.net
- Check Tailscale docs: https://tailscale.com/kb
- Project issues: https://github.com/raxmou/noiseport-server

## Summary

- 🔒 **Secure**: VPN-only access, no public exposure
- 🌍 **Accessible**: Works from anywhere (mobile, travel, etc.)
- 👥 **Multi-user**: Easy user management via Headplane
- 🚀 **Simple**: MagicDNS makes services easy to find
- 🔐 **Private**: Only authorized devices can connect

Connect once, enjoy your music anywhere, securely! 🎵
