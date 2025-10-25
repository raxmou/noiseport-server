/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6867AF',
      },
      fontFamily: {
        kode: ['"Kode Mono"', 'monospace'],
        syne: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
