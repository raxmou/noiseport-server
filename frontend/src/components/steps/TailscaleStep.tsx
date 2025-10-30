import { useEffect, useState } from "react";
import { WizardConfiguration } from "../../types/wizard";
import { useWizardConfig } from "../../hooks/useWizardConfig";
import { Button, Checkbox, TextInput, Paper, Alert, Anchor, Code } from "../ui";

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function TailscaleStep({
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
  const { saveConfig } = useWizardConfig();

  useEffect(() => {
    const isValid =
      !config.tailscale.enabled ||
      (config.tailscale.enabled && !!config.tailscale.ip);
    onValidation(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.tailscale.enabled, config.tailscale.ip]);

  const testTailscaleConnection = async () => {
    if (!config.tailscale.ip) {
      setConnectionStatus("error");
      setConnectionMessage("Please enter your Tailscale IP address first");
      return;
    }

    setConnectionStatus("testing");
    setConnectionMessage(null);
    try {
      const healthUrl = `http://${config.tailscale.ip}:8000/api/v1/system/health`;
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        setConnectionStatus("success");
        setConnectionMessage(
          "Connection successful! Your Tailscale IP is working correctly."
        );

        try {
          await saveConfig();
        } catch (err) {
          console.error(
            "Failed to auto-save config after Tailscale test:",
            err
          );
        }
      } else {
        setConnectionStatus("error");
        setConnectionMessage(
          `Connection failed: Server returned status ${response.status}`
        );
        console.log("Connection failed:", response);
      }
    } catch (error) {
      setConnectionStatus("error");
      if (error instanceof Error && error.name === "TimeoutError") {
        setConnectionMessage(
          "Connection timed out. Make sure the server is running and accessible via Tailscale."
        );
      } else {
        setConnectionMessage(
          "Failed to connect. Please verify your Tailscale IP and ensure the server is running."
        );
      }
    }
  };

  const handleTailscaleToggle = (enabled: boolean) => {
    onUpdate({
      tailscale: { ...config.tailscale, enabled },
    });
  };

  const handleIPChange = (value: string) => {
    onUpdate({
      tailscale: { ...config.tailscale, ip: value },
    });
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
        Tailscale VPN Setup
      </h2>

      <p className="text-neutral-400 mb-6">
        Tailscale creates a secure, private network that lets you access your
        NoisePort servers from anywhere. With Tailscale, you can stream your
        music remotely while keeping everything secure and private.
      </p>

      <Alert variant="info" className="mb-6">
        <div className="space-y-2">
          <p className="font-medium">What is Tailscale?</p>
          <p className="text-sm">
            Tailscale is a zero-config VPN that creates a secure mesh network
            between your devices. It makes your NoisePort servers accessible
            from anywhere without exposing them to the internet.
          </p>
        </div>
      </Alert>

      <Paper className="mb-6">
        <h3 className="text-lg font-kode mb-4">Setup Instructions</h3>

        <ol className="space-y-4 list-decimal ml-5">
          <li>
            <p className="font-medium mb-2">
              Install Tailscale on this machine:
            </p>
            <p className="text-sm text-neutral-400 mb-2">
              Spin up a new terminal on the remote machine and if Tailscale is
              not installed, run the following command:
            </p>

            <Code block>
              {`# Linux/macOS
curl -fsSL https://tailscale.com/install.sh | sh`}
            </Code>
            <p className="text-sm text-neutral-400">
              If you use Windows, download the installer from the{" "}
              <Anchor
                href="https://tailscale.com/download"
                target="_blank"
                rel="noopener noreferrer"
              >
                Tailscale Downloads Page
              </Anchor>
            </p>
          </li>

          <li>
            <p className="font-medium mb-2">
              Connect this machine to your Tailscale network:
            </p>
            <Code block>sudo tailscale up</Code>
            <p className="text-sm text-neutral-400 mt-2">
              This will open a browser window to authenticate with your
              Tailscale account. From experience, redirection link once
              authenticated may fail on first try. If you authenticate but you
              still see the authentication URL in the terminal, simply abort and
              rerun the command to get the connection established.
            </p>
          </li>

          <li>
            <p className="font-medium mb-2">
              Install Tailscale on your other devices:
            </p>
            <p className="text-sm text-neutral-400">
              Install the Tailscale app on your phone, laptop, or other devices
              where you want to access your music.
            </p>
          </li>
        </ol>
      </Paper>

      <Paper className="mb-6">
        <Checkbox
          label="Enable Tailscale Integration"
          checked={config.tailscale.enabled}
          onChange={(event) =>
            handleTailscaleToggle(event.currentTarget.checked)
          }
          className="mb-4"
        />

        {config.tailscale.enabled && (
          <div className="space-y-4">
            <Alert
              variant="info"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            >
              <div className="space-y-2">
                <p className="font-medium">Get Your Tailscale IP Address</p>
                <p className="text-sm">
                  Open a terminal on your server and run the following command:
                </p>
                <Code block>tailscale status</Code>
                <p className="text-sm">
                  Look for your machine's IP address in the output. It will be
                  in the format 100.x.x.x
                </p>
              </div>
            </Alert>

            <TextInput
              label="Tailscale IP Address"
              placeholder="100.64.1.2"
              value={config.tailscale.ip}
              onChange={(event) => handleIPChange(event.currentTarget.value)}
              description="Enter the IP address you got from running 'tailscale status'"
              required
            />

            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Test Connection</p>
                <p className="text-sm text-neutral-400">
                  Verify that your server is accessible via the Tailscale IP
                </p>
              </div>
              <Button
                onClick={testTailscaleConnection}
                loading={connectionStatus === "testing"}
                variant="secondary"
                disabled={!config.tailscale.ip}
              >
                Test Connection
              </Button>
            </div>
          </div>
        )}

        {connectionStatus === "success" && config.tailscale.enabled && (
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

        {connectionStatus === "error" && config.tailscale.enabled && (
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
                "Unable to connect to the server. Please verify your Tailscale IP and ensure the server is running."}
            </div>
          </Alert>
        )}
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
          <p className="font-medium mb-2">Benefits of using Tailscale:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>🔒 End-to-end encrypted connections</li>
            <li>🌐 Access your music from anywhere in the world</li>
            <li>🚫 No port forwarding or firewall configuration needed</li>
            <li>📱 Works on all devices (phones, tablets, computers)</li>
            <li>⚡ Fast peer-to-peer connections when possible</li>
          </ul>
        </div>
      </Alert>
    </>
  );
}
