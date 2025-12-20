import { useEffect, useState } from "react";
import { WizardConfiguration } from "../../types/wizard";
import { Button, Checkbox, TextInput, Paper, Alert, Code } from "../ui";

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
  saveConfig: () => Promise<void>;
}

// Helper function to generate the admin Headplane URL
const getHeadplaneUrl = (config: WizardConfiguration): string | null => {
  if (config.headscale.setupMode === "domain" && config.headscale.domain) {
    return `https://admin.${config.headscale.domain}/admin`;
  } else if (config.headscale.setupMode === "ip" && config.headscale.serverIp) {
    const sslipDomain =
      config.headscale.serverIp.replace(/\./g, "-") + ".sslip.io";
    return `https://admin.${sslipDomain}/admin`;
  }
  return null;
};

export default function HeadscaleStep({
  config,
  onUpdate,
  onValidation,
  saveConfig,
}: Props) {
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null
  );
  const [launchStatus, setLaunchStatus] = useState<
    "idle" | "launching" | "success" | "error"
  >("idle");
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [detectedIp, setDetectedIp] = useState<string>("");
  const [configSaved, setConfigSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-detect server IP on mount
  useEffect(() => {
    const detectServerIp = async () => {
      try {
        // Try to get the server IP from the current URL
        const hostname = window.location.hostname;
        if (hostname !== "localhost" && hostname !== "127.0.0.1") {
          setDetectedIp(hostname);
          // Auto-fill if not already set
          if (
            !config.headscale.serverIp &&
            config.headscale.setupMode === "ip"
          ) {
            onUpdate({
              headscale: { ...config.headscale, serverIp: hostname },
            });
          }
        }
      } catch (error) {
        console.error("Failed to detect server IP:", error);
      }
    };

    detectServerIp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Validation logic
    const isValid =
      !config.headscale.enabled ||
      (config.headscale.enabled &&
        ((config.headscale.setupMode === "domain" &&
          !!config.headscale.domain) ||
          (config.headscale.setupMode === "ip" &&
            !!config.headscale.serverIp)) &&
        !!config.headscale.serverUrl);
    onValidation(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.headscale.enabled,
    config.headscale.setupMode,
    config.headscale.domain,
    config.headscale.serverIp,
    config.headscale.serverUrl,
  ]);

  const handleHeadscaleToggle = (enabled: boolean) => {
    setConfigSaved(false);
    onUpdate({
      headscale: { ...config.headscale, enabled },
    });
  };
  const handleSetupModeChange = (value: string) => {
    if (value === "domain" || value === "ip") {
      setConfigSaved(false);
      const updates: Partial<WizardConfiguration["headscale"]> = {
        setupMode: value,
      };

      // Auto-generate server URL based on mode
      if (value === "domain" && config.headscale.domain) {
        updates.serverUrl = `https://${config.headscale.domain}`;
      } else if (value === "ip" && config.headscale.serverIp) {
        updates.serverUrl = `http://${config.headscale.serverIp}:8080`;
      }

      onUpdate({
        headscale: { ...config.headscale, ...updates },
      });
    }
  };

  const generateSslipDomain = (ip: string) => {
    // Convert IP to sslip.io format: 1-2-3-4.sslip.io
    return ip.replace(/\./g, "-") + ".sslip.io";
  };

  const handleDomainChange = (value: string) => {
    setConfigSaved(false);
    const serverUrl = value ? `https://${value}` : "";
    onUpdate({
      headscale: {
        ...config.headscale,
        domain: value,
        serverUrl,
      },
    });
  };
  const handleServerIpChange = (value: string) => {
    setConfigSaved(false);
    // For IP mode, generate sslip.io domain for HTTPS support
    const sslipDomain = value ? generateSslipDomain(value) : "";
    const serverUrl = sslipDomain ? `https://${sslipDomain}` : "";
    onUpdate({
      headscale: {
        ...config.headscale,
        serverIp: value,
        domain: sslipDomain,
        serverUrl,
      },
    });
  };
  const handleServerUrlChange = (value: string) => {
    setConfigSaved(false);
    onUpdate({
      headscale: { ...config.headscale, serverUrl: value },
    });
  };

  const handleBaseDomainChange = (value: string) => {
    setConfigSaved(false);
    onUpdate({
      headscale: { ...config.headscale, baseDomain: value },
    });
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      await saveConfig();
      setConfigSaved(true);
    } catch (error) {
      console.error("Failed to save configuration:", error);
      setLaunchStatus("error");
      setLaunchMessage("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const testHeadscaleConnection = async () => {
    if (!config.headscale.serverUrl) {
      setConnectionStatus("error");
      setConnectionMessage("Please enter the Headscale server URL first");
      return;
    }

    setConnectionStatus("testing");
    setConnectionMessage(null);

    // Create AbortController for timeout (better browser compatibility)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const healthUrl = `${config.headscale.serverUrl}/health`;
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setConnectionStatus("success");
        setConnectionMessage(
          "Connection successful! Headscale server is accessible."
        );

        try {
          await saveConfig();
        } catch (err) {
          console.error(
            "Failed to auto-save config after Headscale test:",
            err
          );
        }
      } else {
        setConnectionStatus("error");
        setConnectionMessage(
          `Headscale server returned status ${response.status}. Make sure the server is properly configured.`
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      setConnectionStatus("error");
      setConnectionMessage(
        "Failed to connect to Headscale. Make sure the server is running and accessible."
      );
    }
  };

  const launchHeadscale = async () => {
    setLaunchStatus("launching");
    setLaunchMessage(null);

    try {
      const response = await fetch("/api/v1/config/launch-headscale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        setLaunchStatus("success");
        setLaunchMessage(
          "Headscale containers launched successfully! It may take a minute for services to start."
        );
      } else {
        setLaunchStatus("error");
        setLaunchMessage(
          data.detail || "Failed to launch Headscale containers"
        );
      }
    } catch (error) {
      setLaunchStatus("error");
      setLaunchMessage(
        "Failed to launch Headscale. Please check your configuration and try again."
      );
    }
  };

  return (
    <>
      <h2 className="text-2xl font-kode mb-4 flex items-center gap-2">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        Headscale VPN Setup
      </h2>

      <p className="text-neutral-400 mb-6">
        Headscale is a self-hosted VPN that creates a secure private network for
        all your users to access NoisePort services from anywhere in the world.
        Think of it as your own private internet that only your users can join.
      </p>

      <Alert variant="info" className="mb-6">
        <div className="space-y-2">
          <p className="font-medium">🌐 What is Headscale?</p>
          <p className="text-sm">
            Headscale creates a <strong>shared VPN network</strong> that all
            your users can join. Once connected, users can securely access your
            music server, Jellyfin, Navidrome, and other NoisePort services as
            if they were on the same local network - even if they're on the
            other side of the world.
          </p>
          <p className="text-sm">
            Unlike commercial VPN services, Headscale gives you complete
            control: you decide who gets access, you manage the network, and all
            data stays on your infrastructure. It uses the WireGuard protocol
            for fast, encrypted connections and works with standard Tailscale
            clients on all platforms.
          </p>
          <p className="text-sm">
            <strong>Headplane</strong> provides a user-friendly web interface
            for managing your Headscale server - easily add users, generate
            connection keys, monitor connected devices, and manage your VPN
            network without command-line tools.
          </p>
        </div>
      </Alert>

      <Paper className="mb-6">
        <h3 className="text-lg font-kode mb-4">Quick Start Guide</h3>

        <div className="space-y-4">
          <Alert variant="info">
            <p className="text-sm">
              The wizard will set up Headscale with <strong>Caddy</strong>{" "}
              (automatic HTTPS reverse proxy) for you automatically. Caddy will
              handle SSL certificates via Let's Encrypt.
            </p>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-medium">Choose Your Setup Mode:</h4>
            <ul className="list-disc ml-5 space-y-2 text-sm text-neutral-400">
              <li>
                <strong>IP-based with sslip.io (Recommended):</strong>{" "}
                Automatically generates a domain from your IP (e.g.,
                34-55-55-28.sslip.io). No DNS configuration needed! Perfect for
                quick setup with automatic HTTPS.
              </li>
              <li>
                <strong>Domain-based:</strong> Use if you have your own domain
                name. You'll need to set up a DNS A record pointing to your
                server.
              </li>
            </ul>
          </div>

          <Alert variant="warning">
            <p className="text-sm">
              <strong>Important:</strong> For IP-based setup, make sure to use
              your <strong>public IP</strong>, not a local IP like 192.168.x.x
              or 10.x.x.x. sslip.io and Let's Encrypt won't work with private
              IPs.
            </p>
          </Alert>
        </div>
      </Paper>

      <Paper className="mb-6">
        <Checkbox
          label="Enable Headscale Integration"
          checked={config.headscale.enabled}
          onChange={(event) =>
            handleHeadscaleToggle(event.currentTarget.checked)
          }
          className="mb-4"
        />

        {!config.headscale.enabled && (
          <Alert variant="info" className="mt-4">
            <p className="text-sm">
              ℹ️ Check the box above to enable Headscale and configure your VPN
              settings. Configuration files will only be generated when
              Headscale is enabled.
            </p>
          </Alert>
        )}

        {config.headscale.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-3">
                Setup Mode <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-neutral-400 mb-3">
                Choose how you want to access your Headscale server
              </p>
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-800 transition-colors">
                  <input
                    type="radio"
                    name="setupMode"
                    value="ip"
                    checked={config.headscale.setupMode === "ip"}
                    onChange={(e) => handleSetupModeChange(e.target.value)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">IP with sslip.io (HTTPS)</div>
                    <div className="text-sm text-neutral-400">
                      Automatic domain from IP - no DNS setup needed!
                      (Recommended)
                    </div>
                  </div>
                </label>
                <label className="flex items-center p-3 border border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-800 transition-colors">
                  <input
                    type="radio"
                    name="setupMode"
                    value="domain"
                    checked={config.headscale.setupMode === "domain"}
                    onChange={(e) => handleSetupModeChange(e.target.value)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">Own Domain (HTTPS)</div>
                    <div className="text-sm text-neutral-400">
                      Use your own domain name with DNS A record
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {config.headscale.setupMode === "domain" && (
              <>
                <Alert variant="info">
                  <div className="space-y-2">
                    <p className="font-medium">Domain Setup Requirements</p>
                    <p className="text-sm">
                      For domain-based setup, you'll need:
                    </p>
                    <ul className="list-disc ml-5 space-y-1 text-sm">
                      <li>A domain name (e.g., headscale.yourdomain.com)</li>
                      <li>DNS A record pointing to your server's public IP</li>
                      <li>
                        SSL certificate (can use Let's Encrypt with a reverse
                        proxy like Caddy or Nginx)
                      </li>
                    </ul>
                  </div>
                </Alert>

                <TextInput
                  label="Domain Name"
                  placeholder="headscale.yourdomain.com"
                  value={config.headscale.domain}
                  onChange={(event) =>
                    handleDomainChange(event.currentTarget.value)
                  }
                  description="The domain name where Headscale will be accessible"
                  required
                />
              </>
            )}

            {config.headscale.setupMode === "ip" && (
              <>
                <Alert variant="info">
                  <div className="space-y-2">
                    <p className="font-medium">IP-based Setup with sslip.io</p>
                    <p className="text-sm">
                      For IP-based setup with HTTPS support, we'll use{" "}
                      <strong>sslip.io</strong> - a free DNS service that
                      automatically resolves to your IP. This allows Caddy to
                      get a Let's Encrypt certificate.
                      {detectedIp && (
                        <span>
                          {" "}
                          Detected server IP: <strong>{detectedIp}</strong>
                        </span>
                      )}
                    </p>
                    <p className="text-sm">
                      Example: IP <Code>34.55.55.28</Code> becomes{" "}
                      <Code>34-55-55-28.sslip.io</Code>
                    </p>
                  </div>
                </Alert>

                <TextInput
                  label="Server IP Address"
                  placeholder="34.55.55.28 (your public IP)"
                  value={config.headscale.serverIp}
                  onChange={(event) =>
                    handleServerIpChange(event.currentTarget.value)
                  }
                  description={
                    detectedIp
                      ? `Detected IP: ${detectedIp} (you can use this or enter a different one)`
                      : "Enter your server's PUBLIC IP address (not local/private IP)"
                  }
                  required
                />
                {config.headscale.serverIp && (
                  <Alert variant="success">
                    <p className="text-sm">
                      ✓ Your Headscale domain will be:{" "}
                      <strong>
                        {generateSslipDomain(config.headscale.serverIp)}
                      </strong>
                    </p>
                    <p className="text-sm mt-2">
                      Caddy will automatically obtain a Let's Encrypt
                      certificate for HTTPS.
                    </p>
                  </Alert>
                )}
              </>
            )}

            <TextInput
              label="Headscale Server URL"
              placeholder={
                config.headscale.setupMode === "domain"
                  ? "https://headscale.yourdomain.com"
                  : "http://192.168.1.100:8080"
              }
              value={config.headscale.serverUrl}
              onChange={(event) =>
                handleServerUrlChange(event.currentTarget.value)
              }
              description="Complete URL where Headscale will be accessible (auto-generated based on your input above)"
              required
            />

            <div>
              <TextInput
                label="MagicDNS Base Domain"
                placeholder="headscale.local"
                value={config.headscale.baseDomain}
                onChange={(event) =>
                  handleBaseDomainChange(event.currentTarget.value)
                }
                description="Base domain for MagicDNS (allows using machine names instead of IPs)"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Example: With base domain "headscale.local", you can access
                machines as "machine-name.headscale.local"
              </p>
            </div>

            {configSaved && (
              <Alert variant="info" className="mb-4">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="font-semibold text-blue-200">
                      Configuration Saved!
                    </p>
                    <p className="text-sm text-neutral-400">
                      Headscale configuration files generated, ready to launch
                      services!
                    </p>
                  </div>
                </div>
              </Alert>
            )}

            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold mb-1">
                    Step 1: Save Configuration
                  </p>
                  <p className="text-sm text-neutral-400">
                    Save your Headscale settings to generate config files and
                    .env
                  </p>
                </div>
                <Button
                  onClick={saveConfiguration}
                  loading={saving}
                  disabled={!config.headscale.serverUrl}
                  variant={configSaved ? "outline" : "primary"}
                  leftSection={
                    configSaved ? (
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : undefined
                  }
                >
                  {saving
                    ? "Saving..."
                    : configSaved
                    ? "Saved"
                    : "Save Configuration"}
                </Button>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold mb-1">
                    Step 2: Launch Headscale Containers
                  </p>
                  <p className="text-sm text-neutral-400">
                    Start Headscale, Caddy, and Headplane containers
                  </p>
                </div>
                <Button
                  onClick={launchHeadscale}
                  loading={launchStatus === "launching"}
                  variant="primary"
                  disabled={!configSaved}
                  leftSection={
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  }
                >
                  {launchStatus === "launching"
                    ? "Launching..."
                    : "Launch Headscale"}
                </Button>
              </div>
            </div>

            {launchStatus === "success" && (
              <Alert
                variant="success"
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                }
                className="mt-4"
              >
                <div>{launchMessage}</div>
                <div className="mt-2 text-sm">
                  <p className="font-medium mb-1">✅ Important Setup Notes:</p>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>
                      Services are configured with <strong>static IPs</strong> (172.20.0.10-13) for reliable MagicDNS resolution
                    </li>
                    <li>
                      MagicDNS will resolve service names (navidrome, jellyfin, slskd, api) to these static IPs
                    </li>
                    <li>
                      This ensures VPN clients can always access your services via consistent hostnames
                    </li>
                  </ul>
                </div>
              </Alert>
            )}

            {launchStatus === "error" && (
              <Alert
                variant="error"
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                }
                className="mt-4"
              >
                <div>{launchMessage}</div>
              </Alert>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-neutral-800">
              <div>
                <p className="font-medium">Test Connection</p>
                <p className="text-sm text-neutral-400">
                  Verify that Headscale is accessible at the configured URL
                </p>
              </div>
              <Button
                onClick={testHeadscaleConnection}
                loading={connectionStatus === "testing"}
                variant="secondary"
                disabled={!config.headscale.serverUrl}
              >
                Test Connection
              </Button>
            </div>
          </div>
        )}

        {connectionStatus === "success" && config.headscale.enabled && (
          <Alert
            variant="success"
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            }
            className="mt-4"
          >
            <div>{connectionMessage}</div>
          </Alert>
        )}

        {connectionStatus === "error" && config.headscale.enabled && (
          <Alert
            variant="error"
            icon={
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            }
            className="mt-4"
          >
            <div>
              {connectionMessage ||
                "Unable to connect to Headscale. This is normal if you haven't launched the services yet. Configure the settings and launch the stack from the Summary step."}
            </div>
          </Alert>
        )}
      </Paper>

      <Paper className="mb-6">
        <h3 className="text-lg font-kode mb-4">Next Steps After Launch</h3>
        <ol className="list-decimal ml-5 space-y-3 text-sm">
          <li>
            <strong>Click "Launch Headscale"</strong> button above to start
            Headscale, Caddy, and Headplane containers
          </li>
          <li>
            <strong>Wait for Caddy to obtain SSL certificate</strong> - this may
            take 1-2 minutes. Check logs with: <Code>docker logs caddy</Code>
          </li>
          <li>
            <strong>Open SSH connection to your server</strong> - Open a new terminal
            and SSH into the machine where NoisePort is hosted to run the following
            commands:
            <div className="mt-2">
              <Code block>ssh user@your-server-ip</Code>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              All the following steps require command-line access to your server.
            </p>
          </li>
          <li>
            <strong>Generate Headscale API Key</strong> for Headplane:
            <div className="mt-2">
              <Code block>docker exec headscale headscale apikeys create</Code>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Copy the generated key - you'll need it for the next step.
            </p>
          </li>
          <li>
            <strong>Access Headplane Web UI</strong> to manage your Headscale
            server through a user-friendly interface:
            <div className="mt-2">
              {getHeadplaneUrl(config) ? (
                <a
                  href={getHeadplaneUrl(config)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 underline"
                >
                  {getHeadplaneUrl(config)}
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                </a>
              ) : (
                <Code>Configure domain/IP above to see your Headplane URL</Code>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Note: Headplane runs on the <Code>admin.</Code> subdomain with
              automatic HTTPS via Caddy. Paste your API key into Headplane's
              settings or login form.
            </p>
          </li>
          <li>
            <strong>Create a user/namespace</strong> for your server in
            Headplane UI or via command line:
            <div className="mt-2">
              <Code block>
                docker exec headscale headscale users create main
              </Code>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              This user/namespace will be used for your server and later for
              other devices
            </p>
          </li>
          <li>
            <strong>⚠️ CRITICAL: Add this server to Headscale VPN</strong> - The
            server itself needs to join the VPN to be accessible via MagicDNS:
            <div className="mt-2 space-y-2">
              <Alert variant="info" className="mb-2">
                <p className="text-xs">
                  <strong>💡 Tip:</strong> You can get all the commands and
                  create pre-auth keys directly from Headplane's settings page:
                </p>
                <div className="mt-2">
                  {getHeadplaneUrl(config) ? (
                    <a
                      href={`${getHeadplaneUrl(config)}/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 underline text-xs"
                    >
                      {getHeadplaneUrl(config)}/settings
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                    </a>
                  ) : (
                    <Code>
                      https://admin.YOUR-DOMAIN/admin/settings
                    </Code>
                  )}
                </div>
              </Alert>
              <p className="text-xs text-neutral-400">
                Or generate a pre-auth key via command line:
              </p>
              <Code block>
                docker exec headscale headscale preauthkeys create --user main
                --reusable --expiration 24h
              </Code>
              <p className="text-xs text-neutral-400 mt-2">
                First, install Tailscale on this server:
              </p>
              <Code block>
                curl -fsSL https://tailscale.com/install.sh | sh
              </Code>
              <p className="text-xs text-neutral-400 mt-2">
                Then, connect to your Headscale server:
              </p>
              <Code block>
                sudo tailscale up --login-server={config.headscale.serverUrl}{" "}
                --authkey=YOUR_PREAUTH_KEY
              </Code>
              <p className="text-xs text-neutral-400 mt-2">
                After connecting, check your server's VPN hostname:
              </p>
              <Code block>tailscale status</Code>
              <Alert variant="warning" className="mt-2">
                <p className="text-xs">
                  <strong>Important:</strong> Copy the server's MagicDNS
                  hostname (e.g., "noiseport.headscale.local") and save it in
                  the field below. This hostname will be used by all clients to
                  access your music services.
                </p>
              </Alert>
            </div>
          </li>
          <li>
            <strong>Install Tailscale client on user devices</strong> and
            connect them using your Headscale server URL and a pre-auth key
            generated for each device
          </li>
        </ol>
      </Paper>

      {config.headscale.enabled && (
        <Paper className="mb-6 bg-blue-900/20 border-blue-700/30">
          <h3 className="text-lg font-kode mb-4 text-blue-200">
            Server VPN Configuration
          </h3>
          <p className="text-sm text-neutral-400 mb-4">
            After connecting this server to Headscale VPN (step 6 above), enter
            the server's VPN hostname here. This will be used by all clients to
            access your music services.
          </p>
          <div className="space-y-4">
            <TextInput
              label="Server VPN Hostname"
              placeholder="noiseport.headscale.local"
              value={config.headscale.serverVpnHostname}
              onChange={(event) =>
                onUpdate({
                  headscale: {
                    ...config.headscale,
                    serverVpnHostname: event.currentTarget.value,
                  },
                })
              }
              description="The MagicDNS hostname of this server (found with 'tailscale status' command)"
            />
            <Alert variant="info">
              <p className="text-sm">
                <strong>How to find this:</strong> SSH to your server and run{" "}
                <Code>tailscale status</Code>. Look for this machine's name in
                the output (e.g., "noiseport" or "server-name"). The full
                hostname will be:{" "}
                <Code>machinename.{config.headscale.baseDomain}</Code>
              </p>
            </Alert>
            {config.headscale.serverVpnHostname && (
              <Alert variant="success">
                <p className="text-sm">✓ Clients will access services at:</p>
                <ul className="list-disc ml-5 mt-2 text-xs space-y-1">
                  <li>
                    <Code>
                      http://{config.headscale.serverVpnHostname}:4533
                    </Code>{" "}
                    (Navidrome)
                  </li>
                  <li>
                    <Code>
                      http://{config.headscale.serverVpnHostname}:8096
                    </Code>{" "}
                    (Jellyfin)
                  </li>
                  <li>
                    <Code>
                      http://{config.headscale.serverVpnHostname}:5030
                    </Code>{" "}
                    (slskd)
                  </li>
                </ul>
              </Alert>
            )}
            <div className="flex justify-end">
              <Button
                onClick={saveConfiguration}
                loading={saving}
                disabled={!config.headscale.serverVpnHostname}
                variant="primary"
              >
                Save VPN Hostname
              </Button>
            </div>
          </div>
        </Paper>
      )}

      <Alert
        variant="info"
        icon={
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        }
      >
        <div className="text-sm">
          <p className="font-medium mb-2">Why use Headscale for NoisePort?</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              👥 <strong>Shared Access:</strong> All your users join the same
              VPN network to access your services
            </li>
            <li>
              🌍 <strong>Global Access:</strong> Users can stream music from
              anywhere in the world securely
            </li>
            <li>
              🔐 <strong>Self-Hosted:</strong> Complete control over who can
              join your network
            </li>
            <li>
              🆓 <strong>Free Forever:</strong> No subscription fees or user
              limits
            </li>
            <li>
              🔒 <strong>Encrypted:</strong> All connections are end-to-end
              encrypted via WireGuard
            </li>
            <li>
              🚫 <strong>Private:</strong> No third-party services - your data
              stays with you
            </li>
            <li>
              📱 <strong>Universal:</strong> Works with Tailscale clients on
              iOS, Android, Windows, Mac, Linux
            </li>
            <li>
              ⚡ <strong>Fast:</strong> Direct peer-to-peer connections when
              possible for low latency
            </li>
          </ul>
        </div>
      </Alert>
    </>
  );
}
