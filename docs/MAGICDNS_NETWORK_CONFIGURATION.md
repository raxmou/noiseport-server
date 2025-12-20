# MagicDNS Network Configuration Guide

## Overview
This document explains how MagicDNS service discovery works in NoisePort and the network configuration requirements.

## Current Configuration

### Headscale DNS Extra Records
The Headscale configuration includes DNS extra records for service discovery:

```yaml
# config/headscale/config.yaml.template
dns:
  magic_dns: true
  base_domain: {{HEADSCALE_BASE_DOMAIN}}
  extra_records:
    - name: navidrome
      type: A
      value: "172.20.0.10"
    - name: jellyfin
      type: A
      value: "172.20.0.11"
    - name: slskd
      type: A
      value: "172.20.0.12"
    - name: api
      type: A
      value: "172.20.0.13"
```

### What This Means
When a VPN client queries `navidrome.headscale.local` (or just `navidrome` if using MagicDNS search domains), Headscale's DNS server returns `172.20.0.10`.

## ⚠️ Important: Static IP Requirements

### The Problem
The hardcoded IPs in the extra_records **must match** the actual IPs assigned to Docker containers. By default, Docker assigns IPs dynamically, which can change:
- When containers restart
- When the network is recreated
- When containers start in different order

### Solution Options

#### Option 1: Static IP Assignment (Recommended)
Assign static IPs in your docker-compose file to match the Headscale configuration:

```yaml
# docker-compose.full.yml or wizard-config/docker-compose.full.yml
version: "3.8"

services:
  navidrome:
    image: deluan/navidrome:latest
    networks:
      noiseport:
        ipv4_address: 172.20.0.10
    # ... rest of config
    
  jellyfin:
    image: lscr.io/linuxserver/jellyfin:latest
    networks:
      noiseport:
        ipv4_address: 172.20.0.11
    # ... rest of config
    
  slskd:
    image: maxenceroux/noiseport-server-slskd:latest
    networks:
      noiseport:
        ipv4_address: 172.20.0.12
    # ... rest of config
    
  fastapi:
    image: maxenceroux/noiseport-server:latest
    networks:
      noiseport:
        ipv4_address: 172.20.0.13
    # ... rest of config

networks:
  noiseport:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
          gateway: 172.20.0.1
```

#### Option 2: Docker DNS Resolution (Alternative)
Instead of hardcoded IPs, rely on Docker's built-in DNS. However, this requires the Headscale container to be on the same Docker network as the music services.

**Pros:**
- No hardcoded IPs
- Works automatically with Docker's service discovery
- More resilient to network changes

**Cons:**
- Headscale container must be on the `noiseport` network (not just `headscale-net`)
- More complex network topology

#### Option 3: CNAME Records (Future Enhancement)
Headscale could support CNAME records pointing to Docker service names:

```yaml
extra_records:
  - name: navidrome
    type: CNAME
    value: navidrome.noiseport.local
```

This is not currently implemented in Headscale.

## How to Verify Current IPs

### Check Container IPs
Run this command to see actual IPs assigned to containers:

```bash
docker network inspect noiseport
```

Or for specific containers:
```bash
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' navidrome
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' jellyfin
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' slskd
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' fastapi
```

### Test MagicDNS Resolution
From a device connected to the Headscale VPN:

```bash
# Test DNS resolution
nslookup navidrome
nslookup jellyfin
nslookup slskd
nslookup api

# Or with dig
dig navidrome.headscale.local
```

### Test Service Connectivity
```bash
# Test HTTP connectivity
curl http://navidrome:4533/ping
curl http://jellyfin:8096/health
curl http://slskd:5030/api/v0/session
```

## Migration Guide

### If You Need to Change IPs

1. **Update Headscale config template:**
   ```bash
   vim config/headscale/config.yaml.template
   # Update the extra_records values
   ```

2. **Regenerate Headscale config:**
   - Re-run the wizard, or
   - Manually update `wizard-config/headscale/config/config.yaml`

3. **Update docker-compose files** to use matching static IPs

4. **Restart Headscale:**
   ```bash
   docker restart headscale
   ```

5. **Verify from VPN clients** that DNS still resolves correctly

## Best Practices

1. **Always use static IPs** for production deployments with MagicDNS extra records
2. **Document IP assignments** in your docker-compose file comments
3. **Use a consistent subnet** (e.g., 172.20.0.0/16) to avoid conflicts
4. **Reserve IP ranges:**
   - `172.20.0.1-9`: Infrastructure (gateway, DNS, etc.)
   - `172.20.0.10-50`: Core services (Navidrome, Jellyfin, etc.)
   - `172.20.0.51-100`: Additional services
   - `172.20.0.101-254`: Dynamic allocation (if needed)

## Troubleshooting

### Services Not Accessible via MagicDNS

**Symptom:** Cannot access `http://navidrome:4533` from VPN client

**Checks:**
1. Verify VPN connection: `tailscale status`
2. Check DNS resolution: `nslookup navidrome`
3. Verify container IPs match Headscale config
4. Check container is running: `docker ps | grep navidrome`
5. Test direct IP access: `curl http://172.20.0.10:4533/ping`

### Wrong IP Returned

**Symptom:** DNS returns IP but service doesn't respond

**Cause:** IP mismatch between Headscale config and actual container IP

**Fix:**
1. Check actual container IP
2. Update Headscale config to match, OR
3. Update docker-compose to use static IP matching config
4. Restart affected services

### DNS Resolution Slow

**Symptom:** MagicDNS queries take several seconds

**Possible Causes:**
- Headscale server overloaded
- Network latency to Headscale server
- DNS query timeout/retry issues

**Fix:**
- Check Headscale server resources
- Consider local DNS caching
- Verify `override_local_dns: true` in Headscale config

## Related Documentation

- [MAGICDNS_IMPLEMENTATION.md](../MAGICDNS_IMPLEMENTATION.md) - Implementation details
- [VPN_ACCESS_GUIDE.md](../VPN_ACCESS_GUIDE.md) - User guide for connecting to VPN
- [docker-compose.full.yml.template](../docker-compose.full.yml.template) - Service definitions
- [config.yaml.template](../config/headscale/config.yaml.template) - Headscale DNS configuration
