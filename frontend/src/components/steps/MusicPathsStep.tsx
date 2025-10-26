import { useEffect, useState } from "react";
import { WizardConfiguration } from "../../types/wizard";
import { ServiceInfo } from "../ServiceInfo";
import { serviceInfoData } from "../../data/services";
import { Button, TextInput, Paper, Alert } from "../ui";

interface ServiceStatus {
  url: string;
  running: boolean;
}

interface ServiceStatusMap {
  [serviceName: string]: ServiceStatus;
}

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function MusicPathsStep({
  config,
  onUpdate,
  onValidation,
}: Props) {
  const [servicesLaunched, setServicesLaunched] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatusMap | null>(
    null
  );
  const [configSaved, setConfigSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const isValid = Boolean(config.musicPaths?.hostMusicPath);
    onValidation(isValid);
  }, [config.musicPaths, onValidation]);

  const handlePathChange = (value: string) => {
    setConfigSaved(false);
    onUpdate({
      musicPaths: {
        ...config.musicPaths,
        hostMusicPath: value,
      },
    });
  };

  const saveConfiguration = async () => {
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

  const launchServices = async () => {
    setLaunching(true);
    try {
      const response = await fetch("/api/v1/config/launch-services", {
        method: "POST",
      });

      if (response.ok) {
        setServicesLaunched(true);
        checkServiceStatus();
      } else {
        console.error("Failed to launch services");
      }
    } catch (error) {
      console.error("Error launching services:", error);
    }
    setLaunching(false);
  };

  const checkServiceStatus = async () => {
    try {
      const response = await fetch("/api/v1/config/service-status");
      if (response.ok) {
        const result = await response.json();
        setServiceStatus(result.services);
      }
    } catch (error) {
      console.error("Error checking service status:", error);
    }
  };

  return (
    <>
      <h2 className="text-2xl font-kode mb-4">Music Folder Configuration</h2>
      <p className="text-neutral-400 mb-6">
        Configure the base music folder on your host system. The system will
        create necessary subdirectories for downloads and completed music files.
      </p>

      <Paper className="mb-4">
        <h4 className="text-lg font-kode text-primary mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
          Music Folder Configuration
        </h4>
        <p className="text-sm text-neutral-400 mb-4">
          Specify the base folder on the machine where music will be stored. The
          system will automatically create "downloads" and "complete"
          subdirectories within this folder.
        </p>
        <Alert variant="info" className="mb-4">
          <div className="text-sm space-y-2">
            <p>
              Since we're setting up a dedicated music server, it's important to
              make sure the path you're providing can handle large volumes of
              music files. Consequently, using external drives or
              network-attached storage (NAS) is highly recommended for optimal
              performance and storage capacity. If you do so, make sure the
              drive is properly mounted and accessible by the system before
              proceeding.
            </p>
            <p className="mt-2">
              <strong>📁 Directory Structure:</strong>
              <br />•{" "}
              <code className="bg-neutral-800 px-1 rounded">
                {config.musicPaths?.hostMusicPath || "./music"}/downloads/
              </code>{" "}
              - For files being downloaded
              <br />•{" "}
              <code className="bg-neutral-800 px-1 rounded">
                {config.musicPaths?.hostMusicPath || "./music"}/complete/
              </code>{" "}
              - For your organized music library
            </p>
          </div>
        </Alert>
        <TextInput
          label="Host Music Path"
          placeholder="./music"
          value={config.musicPaths?.hostMusicPath || "./music"}
          onChange={(event) => handlePathChange(event.currentTarget.value)}
          required
          description="Base folder on your machine for music storage (e.g., /home/user/music or ./music)"
        />
      </Paper>

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
                Configuration files correctly generated, ready to launch
                services!
              </p>
            </div>
          </div>
        </Alert>
      )}

      <Paper className="mb-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold mb-1">Step 1: Save Configuration</p>
              <p className="text-sm text-neutral-400">
                Save your music base path to generate correct config files.
              </p>
            </div>
            <Button
              onClick={saveConfiguration}
              loading={saving}
              disabled={!config.musicPaths?.hostMusicPath}
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
                ? "Saved ✓"
                : "Save Configuration"}
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold mb-1">Step 2: Launch Services</p>
              <p className="text-sm text-neutral-400">
                After saving configuration, launch all music services with your
                music base path.
              </p>
            </div>
            <Button
              onClick={launchServices}
              loading={launching}
              disabled={!configSaved}
              variant="primary"
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
              {launching ? "Launching..." : "Launch Services"}
            </Button>
          </div>

          {launching && (
            <Alert variant="info" className="mt-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                <p className="text-sm">
                  Stopping wizard container and starting full music stack with
                  your configured music path...
                </p>
              </div>
            </Alert>
          )}
        </div>

        {servicesLaunched && serviceStatus && (
          <Paper className="bg-green-900/20 border-green-700/30 mt-6">
            <div className="flex items-center gap-3 mb-6">
              <svg
                className="w-6 h-6 text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
              <div>
                <p className="font-semibold text-green-200 text-lg">
                  🎉 Services Launched Successfully!
                </p>
                <p className="text-sm text-neutral-400">
                  All services are running with your configured music path. Time
                  to set up your accounts!
                </p>
              </div>
            </div>

            <Alert variant="info" className="mb-6">
              <div className="text-sm">
                <p className="font-medium mb-2">🚀 Next Steps: Account Setup</p>
                <p>
                  Your music services are now running! Click on each service
                  below to create accounts and complete the setup. Once you've
                  created accounts, return to this wizard to finish the
                  configuration.
                </p>
              </div>
            </Alert>

            <div className="space-y-6">
              {Object.entries(serviceStatus).map(
                ([serviceName, service]: [string, ServiceStatus], index) => {
                  const serviceInfo = serviceInfoData[serviceName];
                  const isLastService =
                    index === Object.entries(serviceStatus).length - 1;

                  if (!serviceInfo) {
                    return (
                      <div
                        key={serviceName}
                        className="flex items-center gap-3"
                      >
                        <a
                          href={service.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-outline flex items-center gap-2"
                        >
                          {service.running ? (
                            <svg
                              className="w-4 h-4 text-green-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-red-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {serviceName.charAt(0).toUpperCase() +
                            serviceName.slice(1)}
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </div>
                    );
                  }

                  return (
                    <div key={serviceName}>
                      <ServiceInfo
                        service={{
                          ...serviceInfo,
                          url: service.url,
                        }}
                        isRunning={service.running}
                        showAccountInstructions={true}
                      />
                      {!isLastService && (
                        <hr className="border-neutral-700 my-6" />
                      )}
                    </div>
                  );
                }
              )}
            </div>

            <Alert variant="warning" className="mt-6">
              <div className="text-sm">
                <p className="font-medium mb-2">💡 After Account Setup</p>
                <p>
                  Once you've created accounts in Navidrome and Jellyfin, return
                  to this wizard to continue with the configuration. The next
                  steps will help you connect these services for seamless music
                  management and streaming.
                </p>
              </div>
            </Alert>
          </Paper>
        )}
      </Paper>
    </>
  );
}
