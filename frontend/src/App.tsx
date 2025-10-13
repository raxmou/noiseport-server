import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import SetupWizard from './components/SetupWizard';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

function App() {
  return (
    <MantineProvider>
      <Notifications />
      <SetupWizard />
    </MantineProvider>
  );
}

export default App;