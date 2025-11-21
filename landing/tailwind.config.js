/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'click-orange': '#cf6f03',
        'click-black': '#0c0d0a',
        'click-white': '#ecedef',
        'click-dark-gray': '#2a2a2a',
        'click-white-2': '#e6e7e9',
      },
    },
  },
  plugins: [],
}
