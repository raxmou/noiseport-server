import { useEffect, useState, useRef } from "react";
import { WizardConfiguration } from "../../types/wizard";
import { useWizardConfig } from "../../hooks/useWizardConfig";
import {
  Button,
  Checkbox,
  TextInput,
  PasswordInput,
  Paper,
  Alert,
} from "../ui";

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function SoulseekStep({
  config,
  onUpdate,
  onValidation,
}: Props) {
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [restartStatus, setRestartStatus] = useState<
    "idle" | "restarting" | "success" | "error"
  >("idle");
  const [saving, setSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const { testConnection } = useWizardConfig();

  const onValidationRef = useRef(onValidation);
  useEffect(() => {
    onValidationRef.current = onValidation;
  }, [onValidation]);

  useEffect(() => {
    const isValid =
      !config.soulseek.enabled ||
      Boolean(
        config.soulseek.host &&
          config.soulseek.username &&
          config.soulseek.password &&
          config.soulseek.soulseekUsername &&
          config.soulseek.soulseekPassword
      );
    onValidationRef.current(isValid);
  }, [config.soulseek]);

  useEffect(() => {
    // Auto-set host using Headscale server IP if available (only if the host is still the default)
    if (
      config.headscale.enabled &&
      config.headscale.serverIp &&
      config.soulseek.host === "http://slskd:5030"
    ) {
      onUpdate({
        soulseek: {
          ...config.soulseek,
          host: `http://${config.headscale.serverIp}:5030`,
        },
      });
    }
  }, [config.headscale.enabled, config.headscale.serverIp]); // Intentionally exclude onUpdate to prevent loops

  const handleSoulseekToggle = (enabled: boolean) => {
    onUpdate({
      soulseek: { ...config.soulseek, enabled },
    });
  };

  const handleSoulseekChange = (field: string, value: string) => {
    onUpdate({
      soulseek: { ...config.soulseek, [field]: value },
    });
  };

  const testSoulseekConnection = async () => {
    setConnectionStatus("testing");
    try {
      const success = await testConnection("soulseek", config.soulseek);
      setConnectionStatus(success ? "success" : "error");
    } catch {
      setConnectionStatus("error");
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    console.log("Saving configuration:", config);
    try {
      const response = await fetch("/api/v1/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setConfigSaved(true);
        const result = await response.json();
        console.log("Configuration saved:", result);
      } else {
        console.error("Failed to save configuration");
      }
    } catch (error) {
      console.error("Error saving configuration:", error);
    }
    setSaving(false);
  };

  const restartSlskdContainer = async () => {
    setRestartStatus("restarting");
    try {
      const response = await fetch("/api/v1/config/restart-slskd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setRestartStatus("success");
        setTimeout(() => setRestartStatus("idle"), 3000);
      } else {
        setRestartStatus("error");
      }
    } catch {
      setRestartStatus("error");
    }
  };

  const isFormValid =
    config.soulseek.host &&
    config.soulseek.username &&
    config.soulseek.password &&
    config.soulseek.soulseekUsername &&
    config.soulseek.soulseekPassword;

  return (
    <>
      <h2 className="text-2xl font-kode mb-4">Soulseek/slskd Configuration</h2>
      <p className="text-neutral-400 mb-4">
        Configure your Soulseek connection for music downloading. This is the
        core component for finding and downloading music from the Soulseek
        network.
      </p>

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
        className="mb-6"
      >
        <div className="space-y-2">
          <p className="font-medium">Understanding slskd vs Soulseek</p>
          <p className="text-sm">
            <strong>slskd</strong> is the daemon/server that runs on your
            machine and provides a web interface for Soulseek. It requires its
            own credentials (slskd username/password) to access the web
            interface.
          </p>
          <p className="text-sm">
            <strong>Soulseek</strong> is the actual peer-to-peer network where
            you share and download music. You need a Soulseek account (Soulseek
            username/password) to connect to the network and download files.
          </p>
        </div>
      </Alert>

      <Paper>
        <Checkbox
          label="Enable Soulseek/slskd Integration"
          checked={config.soulseek.enabled}
          onChange={(event) =>
            handleSoulseekToggle(event.currentTarget.checked)
          }
          className="mb-6"
        />

        {config.soulseek.enabled && (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-kode mb-2">
                slskd Daemon Configuration
              </h4>
              <p className="text-sm text-neutral-400 mb-4">
                These credentials are for accessing the slskd web interface (the
                daemon that manages Soulseek connections).
              </p>

              <TextInput
                label="slskd Host URL"
                placeholder="http://slskd:5030"
                value={config.soulseek.host}
                onChange={(event) =>
                  handleSoulseekChange("host", event.currentTarget.value)
                }
                required
                description={
                  config.headscale.enabled && config.headscale.serverIp
                    ? `Automatically set using Headscale server IP: ${config.headscale.serverIp}`
                    : "The URL where your slskd instance is running"
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="slskd Username"
                  placeholder="slskd"
                  value={config.soulseek.username}
                  onChange={(event) =>
                    handleSoulseekChange("username", event.currentTarget.value)
                  }
                  required
                  description="Username for the slskd web interface"
                />
                <PasswordInput
                  label="slskd Password"
                  placeholder="slskd"
                  value={config.soulseek.password}
                  onChange={(event) =>
                    handleSoulseekChange("password", event.currentTarget.value)
                  }
                  required
                  description="Password for the slskd web interface"
                />
              </div>
            </div>

            <hr className="border-neutral-700" />

            <div>
              <h4 className="text-lg font-kode mb-2">
                Soulseek Network Configuration
              </h4>
              <p className="text-sm text-neutral-400 mb-4">
                These credentials are for your Soulseek network account (the
                actual P2P network for downloading music).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="Soulseek Username"
                  placeholder="your_soulseek_username"
                  value={config.soulseek.soulseekUsername}
                  onChange={(event) =>
                    handleSoulseekChange(
                      "soulseekUsername",
                      event.currentTarget.value
                    )
                  }
                  required
                  description="Your Soulseek network username"
                />
                <PasswordInput
                  label="Soulseek Password"
                  placeholder="your_soulseek_password"
                  value={config.soulseek.soulseekPassword}
                  onChange={(event) =>
                    handleSoulseekChange(
                      "soulseekPassword",
                      event.currentTarget.value
                    )
                  }
                  required
                  description="Your Soulseek network password"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={testSoulseekConnection}
                loading={connectionStatus === "testing"}
                disabled={!isFormValid}
                variant="secondary"
              >
                Test Connection
              </Button>
              <Button
                onClick={handleSaveConfig}
                loading={saving}
                disabled={!isFormValid}
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

            {connectionStatus === "success" && (
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
              >
                slskd connection successful!
              </Alert>
            )}

            {connectionStatus === "error" && (
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
              >
                Connection failed. Please check your slskd configuration.
              </Alert>
            )}

            {connectionStatus === "success" && (
              <Paper className="bg-green-900/20 border-green-700/30">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Restart slskd Container</p>
                    <p className="text-sm text-neutral-400">
                      Restart the slskd container to apply your Soulseek network
                      credentials
                    </p>
                  </div>
                  <Button
                    onClick={restartSlskdContainer}
                    loading={restartStatus === "restarting"}
                    variant="primary"
                  >
                    Restart slskd
                  </Button>
                </div>

                {restartStatus === "success" && (
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
                    slskd container restarted successfully! Soulseek credentials
                    have been applied.
                  </Alert>
                )}

                {restartStatus === "error" && (
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
                    Failed to restart slskd container. Please restart manually
                    or check the logs.
                  </Alert>
                )}
              </Paper>
            )}

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
              <p className="text-sm">
                <strong>Note:</strong> Make sure your slskd instance is running
                and accessible at the specified URL. The Soulseek network
                credentials will be saved to the slskd configuration and applied
                when you restart the container.
              </p>
            </Alert>
          </div>
        )}
      </Paper>
    </>
  );
}
