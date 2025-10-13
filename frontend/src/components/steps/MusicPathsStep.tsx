import { useEffect } from 'react';
import {
  Title,
  Text,
  TextInput,
  Paper,
  Alert,
} from '@mantine/core';
import { IconFolder } from '@tabler/icons-react';
import { WizardConfiguration } from '../../types/wizard';

interface Props {
  config: WizardConfiguration;
  onUpdate: (updates: Partial<WizardConfiguration>) => void;
  onValidation: (valid: boolean) => void;
}

export default function MusicPathsStep({ config, onUpdate, onValidation }: Props) {
  useEffect(() => {
    const isValid = Boolean(
      config.musicPaths?.downloadPath && config.musicPaths?.completePath
    );
    onValidation(isValid);
  }, [config.musicPaths, onValidation]);

  const handlePathChange = (field: 'downloadPath' | 'completePath', value: string) => {
    onUpdate({
      musicPaths: { 
        downloadPath: config.musicPaths?.downloadPath || '',
        completePath: config.musicPaths?.completePath || '',
        [field]: value 
      }
    });
  };

  return (
    <>
      <Title order={2} mb="md">
        Music Folder Configuration
      </Title>
      <Text c="dimmed" mb="md">
        Configure the folders where music will be downloaded and stored after processing.
        These paths should be accessible to the application.
      </Text>

      <Paper p="md" withBorder>
        <TextInput
          label="Download Path"
          placeholder="/music/downloads"
          value={config.musicPaths?.downloadPath || ''}
          onChange={(event) => handlePathChange('downloadPath', event.currentTarget.value)}
          mb="md"
          required
          leftSection={<IconFolder size="1rem" />}
          description="Temporary folder for downloads in progress"
        />
        
        <TextInput
          label="Complete Path"
          placeholder="/music/complete"
          value={config.musicPaths?.completePath || ''}
          onChange={(event) => handlePathChange('completePath', event.currentTarget.value)}
          mb="md"
          required
          leftSection={<IconFolder size="1rem" />}
          description="Final folder for processed and organized music"
        />

        <Alert color="blue" variant="light">
          <Text size="sm">
            <strong>Path Guidelines:</strong>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Use absolute paths (e.g., /music/downloads)</li>
              <li>Ensure the application has read/write permissions</li>
              <li>Download path is for temporary files during processing</li>
              <li>Complete path is for your final organized music library</li>
              <li>Paths can be on different drives/volumes if needed</li>
            </ul>
          </Text>
        </Alert>
      </Paper>
    </>
  );
}