import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { WizardConfiguration } from "../../types/wizard";
import { Paper, Alert } from "../ui";
import { ApiService } from "../../utils/api";

interface Props {
  config: WizardConfiguration;
  onValidation: (valid: boolean) => void;
}

interface ServiceLink {
  name: string;
  port: number;
  enabled: boolean;
}

export default function SummaryStep({ config, onValidation }: Props) {
  const onValidationRef = useRef(onValidation);
  const [machineIP, setMachineIP] = useState<string>("loading...");
  const [confettiTriggered, setConfettiTriggered] = useState(false);

  useEffect(() => {
    onValidationRef.current = onValidation;
  }, [onValidation]);

  useEffect(() => {
    // Always valid for summary step
    onValidationRef.current(true);
  }, [config]);

  useEffect(() => {
    // Fetch machine IP
    const fetchIP = async () => {
      try {
        const response = await ApiService.getMachineIP();
        setMachineIP(response.ip);
      } catch (error) {
        console.error("Failed to fetch machine IP:", error);
        setMachineIP("localhost");
      }
    };
    fetchIP();
  }, []);

  useEffect(() => {
    // Trigger confetti animation once when component mounts
    if (!confettiTriggered) {
      const duration = 3000;
      const animationEnd = Date.now() + duration;

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          particleCount,
          angle: randomInRange(55, 125),
          spread: randomInRange(50, 70),
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
          colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'],
        });
      }, 250);

      setConfettiTriggered(true);

      // Cleanup interval on unmount
      return () => clearInterval(interval);
    }
  }, [confettiTriggered]);

  const services: ServiceLink[] = [
    {
      name: "Navidrome",
      port: 4533,
      enabled: config.navidrome.enabled,
    },
    {
      name: "Jellyfin",
      port: 8096,
      enabled: config.jellyfin.enabled,
    },
    {
      name: "slskd (Soulseek)",
      port: 5030,
      enabled: config.soulseek.enabled,
    },
    {
      name: "NoisePort API",
      port: 8010,
      enabled: true, // Always enabled
    },
  ];

  const enabledServices = services.filter(s => s.enabled);

  return (
    <>
      <h2 className="text-2xl font-kode mb-4">🎉 Setup Complete!</h2>
      <p className="text-neutral-400 mb-6">
        Your NoisePort Server is configured and ready to use.
      </p>

      <div className="space-y-4">
        {/* Service Links */}
        <Paper>
          <h3 className="font-medium mb-4">Running Services</h3>
          <p className="text-sm text-neutral-400 mb-4">
            Access your services at the following addresses:
          </p>
          <div className="space-y-3">
            {enabledServices.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-medium">{service.name}</span>
                </div>
                <a
                  href={`http://${machineIP}:${service.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary-light transition-colors"
                >
                  http://{machineIP}:{service.port}
                </a>
              </div>
            ))}
          </div>
        </Paper>

        {/* Machine IP Info */}
        <Paper>
          <h3 className="font-medium mb-4">Machine IP Address</h3>
          <div className="p-4 bg-neutral-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-mono text-lg text-primary">{machineIP}</span>
            </div>
            <p className="text-sm text-neutral-400">
              This is the address to use in Noiseport Desktop and Mobile apps.
            </p>
          </div>
        </Paper>

        {/* Next Steps */}
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
          <div className="space-y-3">
            <p className="text-sm font-medium">Next Steps:</p>
            <p className="text-sm">
              All you need to do now is download the Desktop and/or Mobile app (if not done yet),
              go to their settings/config page, and input the IP address{" "}
              <span className="font-mono text-primary">{machineIP}</span> along with the
              credentials you configured for your services (e.g., Navidrome or Jellyfin username and password).
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Download Apps:</p>
              <div className="flex gap-3">
                <a
                  href="https://github.com/maxenceroux/noiseport/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                  Desktop App
                </a>
                <a
                  href="https://github.com/maxenceroux/noiseport/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  Mobile App
                </a>
              </div>
            </div>
          </div>
        </Alert>
      </div>
    </>
  );
}
