import logo from "../assets/logo.png";
export default function Header() {
  return (
    <header className="bg-neutral-900 border-b border-neutral-800">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logo} alt="NoisePort Logo" className="h-10 w-10 rounded" />
          <h1 className="font-kode text-2xl tracking-tight">
            NoisePort Server
          </h1>
        </div>
        <a
          href="https://noiseport.rax.zone"
          target="_blank"
          rel="noopener noreferrer"
          className="font-syne text-neutral-100 text-base px-4 py-2 rounded-lg bg-primary hover:bg-primary/80 transition-colors"
        >
          a Noiseport solution
        </a>
      </div>
    </header>
  );
}
