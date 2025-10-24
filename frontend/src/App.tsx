import SetupWizard from './components/SetupWizard';
import Header from './components/Header';

function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Header />
      <SetupWizard />
    </div>
  );
}

export default App;