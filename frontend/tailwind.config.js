/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        bitrix: {
          canvas: '#eef2f4',
          'canvas-alt': '#f5f7f8',
          card: '#ffffff',
          dark: '#1e242c',
          'dark-card': '#27313c',
          primary: '#00a2e8',
          'primary-hover': '#008ecb',
          'primary-glow': '#2fc6f6',
          label: '#535c69',
          title: '#333333',
          border: '#e2e8f0',
          success: '#2ecc71',
          warning: '#f39c12',
          danger: '#e74c3c',
        }
      },
      boxShadow: {
        'bitrix': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'bitrix-glow': '0 0 15px -3px rgba(0, 162, 232, 0.25)',
      }
    },
  },
  plugins: [],
}
