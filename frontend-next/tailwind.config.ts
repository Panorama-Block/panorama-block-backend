import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#0B0F1A',
        'panel': '#12172A',
        'accent': '#7C5CFC',
      }
    },
  },
  plugins: [],
};

export default config;

