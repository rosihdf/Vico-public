/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../shared/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        vico: {
          primary: 'var(--vico-primary, #5b7895)',
          'primary-hover': 'var(--vico-primary-hover, #4a6478)',
          'primary-light': '#e8eef3',
        },
      },
    },
  },
  plugins: [],
}
