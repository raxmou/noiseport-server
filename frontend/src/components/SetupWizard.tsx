import { useState, useEffect } from 'react';
import { useWizardConfig } from '../hooks/useWizardConfig';
import { WizardStep } from '../types/wizard';
import SpotifyStep from './steps/SpotifyStep';
import SoulseekStep from './steps/SoulseekStep';
import MusicPathsStep from './steps/MusicPathsStep';
import HeadscaleStep from './steps/HeadscaleStep';
import FeaturesStep from './steps/FeaturesStep';
import SummaryStep from './steps/SummaryStep';

const steps: WizardStep[] = [
  {
    id: 'headscale',
    title: 'Headscale VPN',
    description: 'Set up self-hosted Headscale VPN',
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
          <HeadscaleStep
            config={config}
            onUpdate={updateConfig}
            onValidation={(valid) => handleStepValidation(0, valid)}
            saveConfig={saveConfig}
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
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="card relative">
        {/* Loading overlay */}
        {(loading || saving) && (
          <div className="absolute inset-0 bg-neutral-950/80 flex items-center justify-center rounded-xl z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}
        
        <h1 className="text-4xl font-kode text-center mb-6">
          NoisePort Server Setup Wizard
        </h1>
        
        <div className="text-center mb-12 space-y-4">
          <p className="text-lg text-neutral-300">
            You are a few steps away from completing the setup of NoisePort Server.
            This server is meant to run on a dedicated machine, such as a Raspberry Pi or a home server, to make your music accessible anytime and anywhere.
            If you don't have a dedicated machine, consider setting up a virtual machine on a cloud provider like DigitalOcean, Hetzner or OVH.
          </p>
          <p className="text-neutral-400">
            If you encounter any issues, you can always contact me directly on the NoisePort Discord server.
            You can revisit this wizard anytime to update your settings.
          </p>
        </div>

        {error && (
          <div className="alert alert-error mb-8">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Stepper */}
        <div className="mb-12">
          <div className="flex justify-between items-start">
            {wizardSteps.map((step, index) => (
              <div key={step.id} className="flex-1 relative">
                <div className="flex flex-col items-center">
                  {/* Step circle */}
                  <button
                    onClick={() => index <= activeStep && setActiveStep(index)}
                    disabled={index > activeStep}
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-kode text-sm transition-all duration-200 ${
                      index < activeStep
                        ? 'bg-green-600 text-white'
                        : index === activeStep
                        ? 'bg-primary text-white ring-4 ring-primary/30'
                        : 'bg-neutral-800 text-neutral-500'
                    } ${index <= activeStep ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                  >
                    {step.completed ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </button>
                  
                  {/* Step label */}
                  <div className="mt-3 text-center max-w-[120px]">
                    <p className={`text-sm font-medium ${index === activeStep ? 'text-primary' : 'text-neutral-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1 hidden md:block">
                      {step.description}
                    </p>
                  </div>
                </div>
                
                {/* Connector line */}
                {index < wizardSteps.length - 1 && (
                  <div className="absolute top-6 left-[calc(50%+24px)] right-[calc(-50%+24px)] h-0.5 bg-neutral-800 -z-10">
                    <div
                      className={`h-full bg-primary transition-all duration-300 ${
                        index < activeStep ? 'w-full' : 'w-0'
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-neutral-900 rounded-lg p-8 mb-8 min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
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