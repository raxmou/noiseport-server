import SetupWizard from './components/SetupWizard';

function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-syne antialiased">
      {/* Header with NoisePort Server branding */}
      <header className="border-b border-neutral-800 bg-neutral-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-kode text-primary font-semibold">
            NoisePort Server
          </h1>
          <p className="text-neutral-400 mt-1 text-sm">
            Setup Wizard
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <SetupWizard />
      </main>
    </div>
  );
}

export default App;