/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'golden': '#DAA520',
        'golden-light': '#F4D03F',
        'golden-dark': '#B8860B',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
