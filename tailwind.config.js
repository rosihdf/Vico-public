/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
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
          button: '#ffffff',
          'button-hover': '#f1f5f9',
        },
      },
    },
  },
  plugins: [],
}
