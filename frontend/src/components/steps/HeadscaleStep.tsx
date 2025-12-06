import { useEffect, useState } from "react";
import { WizardConfiguration } from "../../types/wizard";
import { useWizardConfig } from "../../hooks/useWizardConfig";
import {
  Button,
  Checkbox,
  TextInput,
  Paper,
  Alert,
  Anchor,
  Code,
  Select,
} from "../ui";

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function HeadscaleStep({
  config,
  onUpdate,
  onValidation,
}: Props) {
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null
  );
  const [detectedIp, setDetectedIp] = useState<string>("");
  const { saveConfig } = useWizardConfig();

  // Auto-detect server IP on mount
  useEffect(() => {
    const detectServerIp = async () => {
      try {
        // Try to get the server IP from the current URL
        const hostname = window.location.hostname;
        if (hostname !== "localhost" && hostname !== "127.0.0.1") {
          setDetectedIp(hostname);
          // Auto-fill if not already set
          if (!config.headscale.serverIp && config.headscale.setupMode === "ip") {
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
        ((config.headscale.setupMode === "domain" && !!config.headscale.domain) ||
          (config.headscale.setupMode === "ip" && !!config.headscale.serverIp)) &&
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
    onUpdate({
      headscale: { ...config.headscale, enabled },
    });
  };

  const handleSetupModeChange = (value: string | null) => {
    if (value === "domain" || value === "ip") {
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

  const handleDomainChange = (value: string) => {
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
    const serverUrl = value ? `http://${value}:8080` : "";
    onUpdate({
      headscale: {
        ...config.headscale,
        serverIp: value,
        serverUrl,
      },
    });
  };

  const handleServerUrlChange = (value: string) => {
    onUpdate({
      headscale: { ...config.headscale, serverUrl: value },
    });
  };

  const handleApiKeyChange = (value: string) => {
    onUpdate({
      headscale: { ...config.headscale, apiKey: value },
    });
  };

  const handleBaseDomainChange = (value: string) => {
    onUpdate({
      headscale: { ...config.headscale, baseDomain: value },
    });
  };

  const generateApiKey = () => {
    // Generate a secure random API key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const apiKey = Array.from(array, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    handleApiKeyChange(apiKey);
  };

  const testHeadscaleConnection = async () => {
    if (!config.headscale.serverUrl) {
      setConnectionStatus("error");
      setConnectionMessage("Please enter the Headscale server URL first");
      return;
    }

    setConnectionStatus("testing");
    setConnectionMessage(null);
    try {
      const healthUrl = `${config.headscale.serverUrl}/health`;
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

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
          `Connection failed: Server returned status ${response.status}`
        );
      }
    } catch (error) {
      setConnectionStatus("error");
      if (error instanceof Error && error.name === "TimeoutError") {
        setConnectionMessage(
          "Connection timed out. Make sure Headscale is running and accessible."
        );
      } else {
        setConnectionMessage(
          "Failed to connect. Please verify your server URL and ensure Headscale is running."
        );
      }
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
        Headscale is a self-hosted, open-source implementation of the Tailscale
        control server. It creates a secure, private VPN network that lets you
        access your NoisePort servers from anywhere, without relying on
        third-party services.
      </p>

      <Alert variant="info" className="mb-6">
        <div className="space-y-2">
          <p className="font-medium">What is Headscale?</p>
          <p className="text-sm">
            Headscale is a self-hosted coordination server for the WireGuard
            VPN protocol. Unlike Tailscale (which is a paid service), Headscale
            gives you complete control over your VPN infrastructure. It works
            with the open-source Tailscale clients to provide secure,
            encrypted connections between your devices.
          </p>
          <p className="text-sm">
            <strong>Headplane</strong> provides a user-friendly web interface
            for managing your Headscale server, making it easy to add devices,
            manage users, and monitor your VPN network.
          </p>
        </div>
      </Alert>

      <Paper className="mb-6">
        <h3 className="text-lg font-kode mb-4">Quick Start Guide</h3>

        <div className="space-y-4">
          <Alert variant="info">
            <p className="text-sm">
              The wizard will set up Headscale and Headplane Docker containers
              for you automatically. You just need to choose your setup mode and
              provide the necessary configuration.
            </p>
          </Alert>

          <div className="space-y-2">
            <h4 className="font-medium">Choose Your Setup Mode:</h4>
            <ul className="list-disc ml-5 space-y-2 text-sm text-neutral-400">
              <li>
                <strong>Domain-based:</strong> Use if you have a domain name and
                can set up DNS records. Recommended for production use with
                HTTPS.
              </li>
              <li>
                <strong>IP-based:</strong> Use if you want to access Headscale
                directly via IP address. Simpler setup, good for testing or
                local networks.
              </li>
            </ul>
          </div>
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

        {config.headscale.enabled && (
          <div className="space-y-4">
            <Select
              label="Setup Mode"
              value={config.headscale.setupMode}
              onChange={handleSetupModeChange}
              data={[
                { value: "domain", label: "Domain-based (HTTPS)" },
                { value: "ip", label: "IP-based (HTTP)" },
              ]}
              description="Choose how you want to access your Headscale server"
              required
            />

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
                      <li>
                        DNS A record pointing to your server's public IP
                      </li>
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
                    <p className="font-medium">IP-based Setup</p>
                    <p className="text-sm">
                      For IP-based setup, you'll use your server's IP address.
                      {detectedIp && (
                        <span>
                          {" "}
                          We detected your server IP as:{" "}
                          <strong>{detectedIp}</strong>
                        </span>
                      )}
                    </p>
                  </div>
                </Alert>

                <TextInput
                  label="Server IP Address"
                  placeholder="192.168.1.100 or your public IP"
                  value={config.headscale.serverIp}
                  onChange={(event) =>
                    handleServerIpChange(event.currentTarget.value)
                  }
                  description={
                    detectedIp
                      ? `Detected IP: ${detectedIp} (you can use this or enter a different one)`
                      : "Enter your server's IP address (local or public)"
                  }
                  required
                />
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

            <div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <TextInput
                    label="Headscale API Key"
                    placeholder="Enter or generate API key"
                    value={config.headscale.apiKey}
                    onChange={(event) =>
                      handleApiKeyChange(event.currentTarget.value)
                    }
                    description="API key for Headplane to communicate with Headscale"
                    type="password"
                  />
                </div>
                <Button onClick={generateApiKey} variant="secondary">
                  Generate Key
                </Button>
              </div>
              <Alert variant="warning" className="mt-2">
                <p className="text-sm">
                  <strong>Important:</strong> After launching the services,
                  you'll need to create this API key in Headscale. Use the
                  command:
                </p>
                <Code block className="mt-2">
                  {`docker exec headscale headscale apikeys create`}
                </Code>
                <p className="text-sm mt-2">
                  Then update this field with the generated key, or use the one
                  generated here and create it with:
                </p>
                <Code block className="mt-2">
                  {`docker exec headscale headscale apikeys create --expiration 0`}
                </Code>
              </Alert>
            </div>

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
        <h3 className="text-lg font-kode mb-4">Next Steps After Setup</h3>
        <ol className="list-decimal ml-5 space-y-3 text-sm">
          <li>
            <strong>Launch the services</strong> from the Summary step - this
            will start Headscale and Headplane containers
          </li>
          <li>
            <strong>Access Headplane</strong> at{" "}
            <Code>http://localhost:3000</Code> (or your server IP)
          </li>
          <li>
            <strong>Create a namespace/user</strong> in Headscale:
            <Code block className="mt-2">
              docker exec headscale headscale users create myuser
            </Code>
          </li>
          <li>
            <strong>Generate a pre-auth key</strong> for your devices:
            <Code block className="mt-2">
              docker exec headscale headscale preauthkeys create --user myuser
              --reusable --expiration 24h
            </Code>
          </li>
          <li>
            <strong>Install Tailscale client</strong> on your devices and
            connect using your Headscale server URL and pre-auth key
          </li>
        </ol>
      </Paper>

      <Alert
        variant="warning"
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
          <p className="font-medium mb-2">Benefits of Headscale:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>🔐 Self-hosted - complete control over your VPN infrastructure</li>
            <li>🆓 Free and open-source - no subscription fees</li>
            <li>🔒 End-to-end encrypted connections</li>
            <li>🌐 Access your music from anywhere in the world</li>
            <li>🚫 No third-party dependencies or data sharing</li>
            <li>📱 Works with standard Tailscale clients on all platforms</li>
            <li>⚡ Fast peer-to-peer connections when possible</li>
          </ul>
        </div>
      </Alert>
    </>
  );
}
