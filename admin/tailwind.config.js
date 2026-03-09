/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        vico: {
          primary: '#5b7895',
          'primary-hover': '#4a6478',
        },
      },
    },
  },
  plugins: [],
}
