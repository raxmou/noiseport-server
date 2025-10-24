/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'kode': ['Kode Mono', 'monospace'],
        'syne': ['Syne', 'sans-serif'],
        'sans': ['Syne', 'sans-serif'], // Make Syne the default sans font
      },
      colors: {
        primary: '#6867AF',
        'neutral-950': '#0a0a0a',
        'neutral-100': '#f5f5f5',
      },
      backgroundColor: {
        'dark': '#0a0a0a',
      },
      textColor: {
        'light': '#f5f5f5',
      }
    },
  },
  plugins: [],
  darkMode: 'media', // Use prefers-color-scheme
}