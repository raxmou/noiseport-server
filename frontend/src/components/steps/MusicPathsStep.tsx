import { useEffect, useState, useRef } from "react";
import { WizardConfiguration } from "../../types/wizard";
import { ServiceInfo } from "../ServiceInfo";
import { serviceInfoData } from "../../data/services";
import { Button, TextInput, Paper, Alert } from "../ui";
import { ApiService } from "../../utils/api";
import type { ServiceInfo as ApiServiceInfo } from "../../utils/api";

interface ServiceStatusMap {
  [serviceName: string]: ApiServiceInfo;
}

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
  saveConfig: () => Promise<void>;
}

export default function MusicPathsStep({
  config,
  onUpdate,
  onValidation,
  saveConfig,
}: Props) {
  const [servicesLaunched, setServicesLaunched] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatusMap | null>(
    null
  );
  const [configSaved, setConfigSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [containerLogs, setContainerLogs] = useState<{ [key: string]: string }>(
    {}
  );
  const [showLogs, setShowLogs] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const isValid = Boolean(config.musicPaths?.hostMusicPath);
    // Only call onValidation if the value changes
    onValidationRef.current(isValid);
  }, [config.musicPaths]);

  const onValidationRef = useRef(onValidation);
  useEffect(() => {
    onValidationRef.current = onValidation;
  }, [onValidation]);

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
      await saveConfig();
      setConfigSaved(true);
    } catch (error) {
      console.error("Error saving configuration:", error);
    } finally {
      setSaving(false);
    }
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
    setCheckingStatus(true);
    try {
      const result = await ApiService.getServiceStatus();
      setServiceStatus(result.services);
    } catch (error) {
      console.error("Error checking service status:", error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const fetchContainerLogs = async (containerName: string) => {
    try {
      const result = await ApiService.getContainerLogs(containerName);
      setContainerLogs((prev) => ({ ...prev, [containerName]: result.logs }));
    } catch (error) {
      console.error(`Error fetching logs for ${containerName}:`, error);
      setContainerLogs((prev) => ({
        ...prev,
        [containerName]: "Failed to fetch logs",
      }));
    }
  };

  const toggleLogs = async (containerName: string) => {
    const isCurrentlyShown = showLogs[containerName];
    setShowLogs((prev) => ({ ...prev, [containerName]: !isCurrentlyShown }));

    // Fetch logs if opening and not already fetched
    if (!isCurrentlyShown && !containerLogs[containerName]) {
      await fetchContainerLogs(containerName);
    }
  };

  const getStateColor = (state?: string) => {
    switch (state) {
      case "running":
        return "text-green-400";
      case "creating":
      case "restarting":
        return "text-yellow-400";
      case "exited":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStateIcon = (state?: string, running?: boolean) => {
    if (running) {
      return (
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
      );
    } else if (state === "creating" || state === "restarting") {
      return (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
      );
    } else {
      return (
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
      );
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
                ? "Saved"
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
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <p className="text-sm font-semibold">
                    Starting music stack...
                  </p>
                </div>
                <p className="text-sm text-neutral-400">
                  Stopping wizard container and starting full music stack with
                  your configured music path.
                </p>
                <Alert variant="warning" className="mt-2">
                  <p className="text-sm">
                    <strong>⏱️ First Launch Notice:</strong> If this is your
                    first time launching, Docker will need to download container
                    images (Navidrome, Jellyfin, slskd). This process may take
                    several minutes depending on your internet connection. The
                    wizard will show you when services are ready.
                  </p>
                </Alert>
              </div>
            </Alert>
          )}

          {servicesLaunched && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold">Service Status</p>
                <Button
                  onClick={checkServiceStatus}
                  loading={checkingStatus}
                  variant="outline"
                  size="xs"
                  leftSection={
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                        clipRule="evenodd"
                      />
                    </svg>
                  }
                >
                  {checkingStatus ? "Checking..." : "Check Status"}
                </Button>
              </div>
              <Alert variant="info" className="text-xs">
                <p>
                  Click "Check Status" to manually refresh the current state of
                  your containers. This is especially useful during the initial
                  setup when images are being downloaded.
                </p>
              </Alert>
            </div>
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
                  🎉 Services Launch In Progress
                </p>
                <p className="text-sm text-neutral-400">
                  Containers are starting up. Check the status below to see
                  progress.
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
                ([serviceName, service]: [string, ApiServiceInfo], index) => {
                  const serviceInfo = serviceInfoData[serviceName];
                  const isLastService =
                    index === Object.entries(serviceStatus).length - 1;

                  if (!serviceInfo) {
                    return (
                      <div key={serviceName} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStateIcon(service.state, service.running)}
                            <span className="font-semibold">
                              {serviceName.charAt(0).toUpperCase() +
                                serviceName.slice(1)}
                            </span>
                            <span
                              className={`text-xs ${getStateColor(
                                service.state
                              )}`}
                            >
                              ({service.state || "unknown"})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => toggleLogs(serviceName)}
                              variant="outline"
                              size="xs"
                            >
                              {showLogs[serviceName]
                                ? "Hide Logs"
                                : "Show Logs"}
                            </Button>
                            <a
                              href={service.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline flex items-center gap-2 text-xs px-2 py-1"
                            >
                              Open
                              <svg
                                className="w-3 h-3"
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
                        </div>
                        {service.status && (
                          <p className="text-xs text-neutral-400 ml-6">
                            Status: {service.status}
                          </p>
                        )}
                        {showLogs[serviceName] && (
                          <div className="ml-6 mt-2">
                            <div className="bg-neutral-900 rounded p-3 text-xs font-mono max-h-64 overflow-y-auto">
                              {containerLogs[serviceName] ? (
                                <pre className="whitespace-pre-wrap text-neutral-300">
                                  {containerLogs[serviceName]}
                                </pre>
                              ) : (
                                <p className="text-neutral-500">
                                  Loading logs...
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={serviceName}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStateIcon(service.state, service.running)}
                            <span className="font-semibold">
                              {serviceName.charAt(0).toUpperCase() +
                                serviceName.slice(1)}
                            </span>
                            <span
                              className={`text-xs ${getStateColor(
                                service.state
                              )}`}
                            >
                              ({service.state || "unknown"})
                            </span>
                          </div>
                          <Button
                            onClick={() => toggleLogs(serviceName)}
                            variant="outline"
                            size="xs"
                          >
                            {showLogs[serviceName] ? "Hide Logs" : "Show Logs"}
                          </Button>
                        </div>
                        {service.status && (
                          <p className="text-xs text-neutral-400 ml-6">
                            Status: {service.status}
                          </p>
                        )}
                        {showLogs[serviceName] && (
                          <div className="ml-6 mb-4">
                            <div className="bg-neutral-900 rounded p-3 text-xs font-mono max-h-64 overflow-y-auto">
                              {containerLogs[serviceName] ? (
                                <pre className="whitespace-pre-wrap text-neutral-300">
                                  {containerLogs[serviceName]}
                                </pre>
                              ) : (
                                <p className="text-neutral-500">
                                  Loading logs...
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
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
