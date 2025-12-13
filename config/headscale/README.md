# Headscale Configuration

This directory contains the Headscale configuration template used by the NoisePort setup wizard.

## What is Headscale?

Headscale is a self-hosted, open-source implementation of the Tailscale control server. It allows you to create a secure, private VPN network using the WireGuard protocol, giving you complete control over your VPN infrastructure without relying on third-party services.

## Configuration Template

The `config.yaml.template` file is used by the setup wizard to generate the actual Headscale configuration. The wizard replaces placeholders with your specific values:

- `{{HEADSCALE_SERVER_URL}}` - Your Headscale server URL (domain or IP-based)
- `{{HEADSCALE_BASE_DOMAIN}}` - Base domain for MagicDNS (e.g., `headscale.local`)

## Setup Modes

### Domain-Based Setup (Recommended for Production)

Use a domain name with HTTPS for secure, production-ready deployment:

**Requirements:**
- Domain name (e.g., `headscale.yourdomain.com`)
- DNS A record pointing to your server's public IP
- SSL certificate (use Let's Encrypt with Caddy or Nginx reverse proxy)

**Example URL:** `https://headscale.yourdomain.com`

**Benefits:**
- Secure HTTPS connections
- Professional setup
- Works well for public access

### IP-Based Setup (Quick Start/Testing)

Use your server's IP address directly:

**Requirements:**
- Server IP address (local or public)
- Example: `192.168.1.100` or your public IP

**Example URL:** `http://192.168.1.100:8080`

**Benefits:**
- Simple, quick setup
- No DNS configuration needed
- Good for testing or local networks

## Configuration Options

Key configuration sections in the template:

### Server URL
The public-facing URL where clients connect to Headscale:
```yaml
server_url: {{HEADSCALE_SERVER_URL}}
```

### Database
Uses SQLite for simplicity:
```yaml
database:
  type: sqlite3
  sqlite:
    path: /var/lib/headscale/db.sqlite
```

### DNS Configuration
Includes MagicDNS for using machine names instead of IPs:
```yaml
dns_config:
  magic_dns: true
  base_domain: {{HEADSCALE_BASE_DOMAIN}}
```

### IP Ranges
Default IP allocations for VPN clients:
```yaml
ip_prefixes:
  - fd7a:115c:a1e0::/48  # IPv6
  - 100.64.0.0/10        # IPv4
```

### DERP Servers
Relay servers for when direct connections fail:
```yaml
derp:
  urls:
    - https://controlplane.tailscale.com/derpmap/default
  auto_update_enabled: true
```

## Post-Setup Steps

After the wizard generates your Headscale configuration and starts the services:

### 1. Create a User/Namespace
```bash
docker exec headscale headscale users create myuser
```

### 2. Generate API Key (for Headplane)
```bash
docker exec headscale headscale apikeys create --expiration 0
```
Then update the API key in your `.env` file or through the wizard.

### 3. Create Pre-Auth Keys
Generate a key for connecting devices:
```bash
docker exec headscale headscale preauthkeys create --user myuser --reusable --expiration 24h
```

### 4. Connect Devices
1. Install Tailscale client on your devices
2. Configure them to use your Headscale server:
   ```bash
   # Linux/macOS
   tailscale up --login-server=YOUR_HEADSCALE_URL --authkey=YOUR_PREAUTH_KEY
   
   # Or interactive login
   tailscale up --login-server=YOUR_HEADSCALE_URL
   ```

## Management

### Headplane Web UI
Access the Headplane web interface at `http://localhost:3000` (or your server IP) to:
- View connected devices
- Manage users and namespaces
- Configure routes
- Monitor VPN status

### Command Line Management
Common Headscale CLI commands:

```bash
# List users
docker exec headscale headscale users list

# List machines (nodes)
docker exec headscale headscale nodes list

# Approve a machine
docker exec headscale headscale nodes register --user myuser --key MACHINE_KEY

# List routes
docker exec headscale headscale routes list

# Enable routes
docker exec headscale headscale routes enable -r ROUTE_ID
```

## Troubleshooting

### Can't connect to Headscale server
- Verify the server URL is correct and accessible
- Check firewall rules (ports 8080, 9090)
- Ensure Docker containers are running: `docker ps | grep headscale`

### Headplane won't load
- Check API key is set correctly
- Verify Headscale is running and accessible
- Check Headplane logs: `docker logs headplane`

### Devices won't connect
- Verify pre-auth key is valid and not expired
- Check Headscale server URL is correct
- Ensure machines are registered: `docker exec headscale headscale nodes list`

### DNS not working (MagicDNS)
- Check base domain is configured correctly
- Ensure `magic_dns: true` in config
- Verify nameservers are reachable

## Security Considerations

### API Key Security
- Store API keys securely
- Use unique keys for different services
- Rotate keys regularly
- Set appropriate expiration times

### Network Security
- Use HTTPS in production (domain-based setup)
- Configure firewall rules appropriately
- Regularly update Headscale and Headplane containers
- Review ACL policies for network access control

### Private Keys
- Never share private keys from `/var/lib/headscale/`
- These are automatically generated and stored securely
- Back them up if you need to restore the server

## Advanced Configuration

### Custom DERP Servers
To use your own DERP relay servers, modify the `derp` section in the config template.

### Access Control Lists (ACLs)
Define ACL policies to control which machines can communicate:
```yaml
acl_policy_path: /etc/headscale/acl.yaml
```

### TLS Configuration
For domain-based setup with built-in TLS:
```yaml
tls_cert_path: /path/to/cert.pem
tls_key_path: /path/to/key.pem
```

## Resources

- [Headscale Documentation](https://headscale.net/)
- [Headscale GitHub](https://github.com/juanfont/headscale)
- [Headplane GitHub](https://github.com/tale/headplane)
- [Tailscale Documentation](https://tailscale.com/kb/) (client setup)

## Support

For issues specific to the NoisePort Headscale integration, please create an issue in the NoisePort repository. For Headscale-specific issues, refer to the official Headscale documentation and GitHub repository.
