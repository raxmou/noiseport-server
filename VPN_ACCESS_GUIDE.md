# 🔒 VPN-Only Access Guide

## Overview

Your NoisePort music server is configured for **secure VPN-only access** using Headscale (self-hosted Tailscale). This means music services are NOT publicly accessible and can only be accessed by authorized devices connected to your VPN.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Public Internet                                            │
│                                                             │
│  ✅ Headscale API (35.224.207.136.sslip.io)                │
│     - VPN registration                                      │
│     - Client authentication                                 │
│                                                             │
│  ✅ Headplane UI (admin.35.224.207.136.sslip.io)           │
│     - VPN management                                        │
│                                                             │
│  ❌ Music Services (NOT PUBLIC)                            │
│     - Navidrome, Jellyfin, slskd                           │
│     - Only accessible via VPN                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ VPN Tunnel
                          │
┌─────────────────────────────────────────────────────────────┐
│  Private VPN Network (Headscale MagicDNS)                   │
│                                                             │
│  🎵 navidrome:4533    - Music streaming                     │
│  🎬 jellyfin:8096     - Media server                        │
│  📥 slskd:5030        - Music downloads                     │
│  🔧 api:80            - NoisePort API                       │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Install Tailscale Client

**macOS / Linux / Windows:**
Download from: https://tailscale.com/download

**iOS:**
App Store: https://apps.apple.com/app/tailscale/id1470499037

**Android:**
Play Store: https://play.google.com/store/apps/details?id=com.tailscale.ipn

### 2. Get Your Pre-Auth Key

**Option A: Via Headplane UI (Easiest)**
1. Visit: `https://admin.35-224-207-136.sslip.io` (or your Headscale domain)
2. Login with your Headscale API key
3. Navigate to "Pre-Auth Keys"
4. Generate a new key
5. Copy the key

**Option B: Via Headscale CLI (Advanced)**
```bash
# On your server
docker exec headscale headscale preauthkeys create --user YOUR_USERNAME --reusable --expiration 24h
```

### 3. Connect to VPN

Open Tailscale client and run:

```bash
# Replace YOUR_HEADSCALE_URL with your actual Headscale server URL
tailscale up --login-server=https://35-224-207-136.sslip.io --auth-key=YOUR_PREAUTH_KEY
```

**Example:**
```bash
tailscale up --login-server=https://35-224-207-136.sslip.io --auth-key=tskey-auth-kXXXXXXXXXXXXXXXXXX
```

### 4. Verify Connection

Check if you're connected:
```bash
tailscale status
```

You should see your device listed with an IP like `100.64.x.x`

### 5. Access Services

Once connected to the VPN, access services using **MagicDNS hostnames**:

| Service | URL | Description |
|---------|-----|-------------|
| Navidrome | `http://navidrome:4533` | Music streaming server |
| Jellyfin | `http://jellyfin:8096` | Media server |
| slskd | `http://slskd:5030` | Music downloads |
| NoisePort API | `http://api:80` | Backend API |

**Note:** These URLs ONLY work when connected to the VPN. They will not work from regular internet.

## MagicDNS Explained

**What is MagicDNS?**
MagicDNS automatically resolves short hostnames (like `navidrome`) to the correct internal IP addresses without needing to remember IPs.

**How it works:**
1. Headscale runs a DNS server for VPN clients
2. Container names become DNS hostnames
3. Your device queries Headscale DNS for `navidrome`
4. Headscale returns the container's IP on the Docker bridge
5. Your VPN tunnel routes traffic to the server

**Benefits:**
- ✅ No need to remember IP addresses
- ✅ Works across all devices
- ✅ Automatic updates if IPs change
- ✅ Clean, memorable URLs

## Troubleshooting

### "Cannot resolve hostname 'navidrome'"

**Cause:** MagicDNS not enabled or VPN not connected

**Fix:**
1. Verify VPN connection: `tailscale status`
2. Check Headscale logs: `docker logs headscale`
3. Ensure MagicDNS is enabled in Headscale config

### "Connection refused"

**Cause:** Service not running or firewall blocking

**Fix:**
1. Check service status on server:
   ```bash
   docker ps | grep navidrome
   docker logs navidrome
   ```
2. Verify service is listening:
   ```bash
   docker exec navidrome netstat -tlnp
   ```

### "Tailscale won't connect"

**Cause:** Login server URL incorrect or unreachable

**Fix:**
1. Verify Headscale is running: `docker ps | grep headscale`
2. Test Headscale API: `curl https://YOUR_HEADSCALE_URL/health`
3. Check Caddy logs: `docker logs caddy`

### "I want to use my phone on cellular data"

**Solution:** This works! The beauty of Headscale/Tailscale is that it works from anywhere:
1. Connect to VPN on your phone (while on WiFi)
2. Keep Tailscale running in background
3. Switch to cellular - VPN stays connected
4. Access music services as normal

## Security Considerations

### What's Protected:
- ✅ All music services require VPN connection
- ✅ No public ports for Navidrome/Jellyfin/slskd
- ✅ Encrypted WireGuard tunnels (state-of-the-art)
- ✅ Per-device authentication and authorization
- ✅ You control who can join your VPN

### What's Still Public:
- ⚠️ Headscale API (port 8080) - Required for VPN registration
- ⚠️ Headplane UI (admin subdomain) - For VPN management
- ℹ️ These are necessary for the VPN to function

### Best Practices:
1. **Use strong API keys** - Generate long, random keys
2. **Rotate pre-auth keys** - Set expiration times
3. **Monitor connected devices** - Check Headplane regularly
4. **Revoke unused devices** - Remove old/lost devices
5. **Keep services updated** - Run `docker compose pull` regularly

## Adding New Users

### For Family/Friends:

1. **Create user namespace (first time only):**
   ```bash
   docker exec headscale headscale users create family
   ```

2. **Generate pre-auth key:**
   ```bash
   docker exec headscale headscale preauthkeys create --user family --reusable --expiration 24h
   ```

3. **Share with user:**
   - Send them this guide
   - Send them the pre-auth key (securely - Signal, WhatsApp, etc.)
   - Send them your Headscale URL

4. **User follows steps 1-5 above**

### Managing Users:

**List all users:**
```bash
docker exec headscale headscale users list
```

**List devices:**
```bash
docker exec headscale headscale nodes list
```

**Remove device:**
```bash
docker exec headscale headscale nodes delete --identifier DEVICE_ID
```

**Expire pre-auth key:**
```bash
docker exec headscale headscale preauthkeys expire --user USERNAME --key KEY_ID
```

## Advanced: ACL Policies

You can restrict which services each user can access using ACL policies.

**Example:** Only allow specific users to access slskd (downloads):

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["group:admins"],
      "dst": ["*:*"]
    },
    {
      "action": "accept",
      "src": ["group:users"],
      "dst": ["navidrome:4533", "jellyfin:8096"]
    }
  ],
  "groups": {
    "group:admins": ["admin@headscale.local"],
    "group:users": ["user1@headscale.local", "user2@headscale.local"]
  }
}
```

Save this to `wizard-config/headscale/acl-policy.json` and update `config.yaml`:
```yaml
policy:
  mode: file
  path: /etc/headscale/acl-policy.json
```

## FAQ

**Q: Can I still use services locally without VPN?**
A: No, with VPN-only mode, services are not exposed on public ports. You must connect via VPN even from the same network.

**Q: What if Headscale goes down?**
A: You won't be able to access services until Headscale is back up. Keep the server running!

**Q: Can I use a real domain instead of sslip.io?**
A: Yes! Update `HEADSCALE_DOMAIN` in `.env` and rerun configuration. Real domains support better SSL certificates.

**Q: How many users can I have?**
A: Headscale has no hard limits. Performance depends on your server resources.

**Q: Is this as good as Tailscale's paid service?**
A: Headscale is feature-compatible with Tailscale but self-hosted. You get the same WireGuard-based VPN without the subscription.

**Q: Can I access services from multiple devices?**
A: Yes! Connect each device to the VPN and all will be able to access services.

## Support

**Check logs:**
```bash
# Headscale
docker logs headscale

# Caddy
docker logs caddy

# Services
docker logs navidrome
docker logs jellyfin
docker logs slskd
```

**Restart services:**
```bash
# Restart Headscale stack
cd /path/to/noiseport-server
docker compose -f docker-compose.headscale.yml restart

# Restart music stack
cd wizard-config
docker compose -f docker-compose.full.yml restart
```

**Need help?** Check the GitHub issues or Headscale documentation:
- https://github.com/juanfont/headscale
- https://headscale.net/
