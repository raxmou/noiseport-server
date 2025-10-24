import { useState, useEffect } from 'react';
import { useWizardConfig } from '../hooks/useWizardConfig';
import { WizardStep } from '../types/wizard';
import SpotifyStep from './steps/SpotifyStep';
import SoulseekStep from './steps/SoulseekStep';
import MusicPathsStep from './steps/MusicPathsStep';
import TailscaleStep from './steps/TailscaleStep';
import FeaturesStep from './steps/FeaturesStep';
import SummaryStep from './steps/SummaryStep';

const steps: WizardStep[] = [
  {
    id: 'tailscale',
    title: 'Tailscale VPN',
    description: 'Set up Tailscale VPN for secure remote access',
    completed: false,
    valid: false,
  },
  {
    id: 'paths',
    title: 'Music Paths',
    description: 'Set music folder paths',
    completed: false,
    valid: false,
  },
  {
    id: 'soulseek',
    title: 'Soulseek/slskd',
    description: 'Configure Soulseek connection',
    completed: false,
    valid: false,
  },
  {
    id: 'spotify',
    title: 'Spotify API',
    description: 'Configure Spotify credentials',
    completed: false,
    valid: false,
  },
  {
    id: 'features',
    title: 'Additional Features',
    description: 'Choose additional features',
    completed: false,
    valid: false,
  },
  {
    id: 'summary',
    title: 'Summary',
    description: 'Review and confirm settings',
    completed: false,
    valid: false,
  },
];

export default function SetupWizard() {
  const [activeStep, setActiveStep] = useState(0);
  const [wizardSteps, setWizardSteps] = useState(steps);
  const { config, loading, error, saveConfig, updateConfig, loadConfig } = useWizardConfig();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleNext = () => {
    if (activeStep < wizardSteps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrevious = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleStepValidation = (stepIndex: number, valid: boolean) => {
    setWizardSteps(prev => 
      prev.map((step, index) => 
        index === stepIndex ? { ...step, valid, completed: valid } : step
      )
    );
  };

  const handleFinish = async () => {
    try {
      setSaving(true);
      await saveConfig();
      // Show success notification
      alert('Configuration saved successfully!');
    } catch (err) {
      console.error('Failed to save configuration:', err);
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <TailscaleStep
            config={config}
            onUpdate={updateConfig}
            onValidation={(valid) => handleStepValidation(0, valid)}
          />
        );
      case 1:
        return (
          <MusicPathsStep
            config={config}
            onUpdate={updateConfig}
            onValidation={(valid) => handleStepValidation(1, valid)}
          />
        );
      case 2:
        return (
          <SoulseekStep
            config={config}
            onUpdate={updateConfig}
            onValidation={(valid) => handleStepValidation(2, valid)}
          />
        );
      case 3:
        return (
          <SpotifyStep
            config={config}
            onUpdate={updateConfig}
            onValidation={(valid) => handleStepValidation(3, valid)}
          />
        );
      case 4:
        return (
          <FeaturesStep
            config={config}
            onUpdate={updateConfig}
            onValidation={(valid) => handleStepValidation(4, valid)}
          />
        );
      case 5:
        return (
          <SummaryStep
            config={config}
            onValidation={(valid) => handleStepValidation(5, valid)}
          />
        );
      default:
        return null;
    }
  };

  const currentStep = wizardSteps[activeStep];
  const isLastStep = activeStep === wizardSteps.length - 1;
  const canProceed = currentStep?.valid || activeStep === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Loading overlay */}
      {(loading || saving) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-neutral-100">
              {saving ? 'Saving configuration...' : 'Loading...'}
            </span>
          </div>
        </div>
      )}

      <div className="card">
        {/* Title and description */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-kode font-bold text-primary mb-6">
            Setup Wizard
          </h1>
          <div className="max-w-3xl mx-auto space-y-4 text-neutral-300">
            <p className="text-lg">
              You are a few steps away from completing the setup of NoisePort Server.
              This server is meant to run on a dedicated machine, such as a Raspberry Pi or a home server, to make your music accessible anytime and anywhere.
            </p>
            <p>
              If you don't have a dedicated machine, consider setting up a virtual machine on a cloud provider like DigitalOcean, Hetzner or OVH.
            </p>
            <p>
              If you encounter any issues, you can always contact me directly on the Noiseport Discord server.
              You can revisit this wizard anytime to update your settings.
            </p>
          </div>
        </div>

        {/* Error alert */}
        {error && (
          <div className="alert alert-error mb-8">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Step indicators */}
        <div className="mb-12">
          <div className="flex items-center justify-center space-x-4 overflow-x-auto pb-4">
            {wizardSteps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => index <= activeStep && setActiveStep(index)}
                  disabled={index > activeStep}
                  className={`
                    flex flex-col items-center space-y-2 p-4 rounded-lg min-w-[140px] text-center transition-all duration-200
                    ${index === activeStep 
                      ? 'bg-primary/20 border-2 border-primary' 
                      : index < activeStep
                        ? 'bg-green-900/20 border-2 border-green-600 cursor-pointer hover:bg-green-900/30'
                        : 'bg-neutral-800/50 border-2 border-neutral-700 cursor-not-allowed opacity-60'
                    }
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${index === activeStep 
                      ? 'bg-primary text-white' 
                      : index < activeStep
                        ? 'bg-green-600 text-white'
                        : 'bg-neutral-700 text-neutral-400'
                    }
                  `}>
                    {step.completed ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div>
                    <div className={`font-medium text-sm ${
                      index === activeStep ? 'text-primary' : 
                      index < activeStep ? 'text-green-400' : 'text-neutral-400'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {step.description}
                    </div>
                  </div>
                </button>
                {index < wizardSteps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    index < activeStep ? 'bg-green-600' : 'bg-neutral-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-neutral-900/30 rounded-xl p-8 mb-8 min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={activeStep === 0}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {isLastStep ? (
            <button
              onClick={handleFinish}
              disabled={!canProceed || saving}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}