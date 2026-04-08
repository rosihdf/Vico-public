/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./shared/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vico: {
          primary: '#059669',
          'primary-hover': '#047857',
          'primary-light': '#d1fae5',
          dark: '#0f766e',
          background: '#5b7895',
          /* Wie in index.css --vico-button / --vico-button-hover (Dark Mode per .dark auf html) */
          button: 'var(--vico-button)',
          'button-hover': 'var(--vico-button-hover)',
        },
        app: {
          foreground: 'var(--app-foreground)',
          muted: 'var(--app-muted)',
          label: 'var(--app-label)',
          border: 'var(--app-border)',
          surface: 'var(--app-surface)',
          error: 'var(--app-error)',
          success: 'var(--app-success)',
        },
      },
    },
  },
  plugins: [],
}
