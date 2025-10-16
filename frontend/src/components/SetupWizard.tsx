import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Stepper,
  Button,
  Group,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
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
    <Container size="lg" py="xl">
      <Paper p="xl" radius="md" withBorder>
        <LoadingOverlay visible={loading || saving} />
        
        <Title order={1} mb="xl" ta="center">
          Noiseport Setup Wizard
        </Title>
        
        <Text size="lg" c="dimmed" ta="center" mb="xl">
          Configure your Noiseport client stack in a few simple steps.
          If you encounter any issues, please refer to the documentation or seek help on our support channels. 
          You can revisit this wizard anytime to update your settings.
          
        </Text>

        {error && (
          <Alert icon={<IconAlertCircle size="1rem" />} color="red" mb="xl">
            {error}
          </Alert>
        )}

        <Stepper
          active={activeStep}
          onStepClick={setActiveStep}
          mb="xl"
        >
          {wizardSteps.map((step, index) => (
            <Stepper.Step
              key={step.id}
              label={step.title}
              description={step.description}
              completedIcon={<IconCheck size="1rem" />}
              allowStepSelect={index <= activeStep}
            />
          ))}
        </Stepper>

        <Paper p="md" radius="md" bg="gray.0" mb="xl">
          {renderStepContent()}
        </Paper>

        <Group justify="space-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={activeStep === 0}
          >
            Previous
          </Button>

          {isLastStep ? (
            <Button
              onClick={handleFinish}
              disabled={!canProceed}
              loading={saving}
            >
              Complete Setup
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
            >
              Next
            </Button>
          )}
        </Group>
      </Paper>
    </Container>
  );
}