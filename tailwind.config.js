/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nano: {
          yellow: '#FFD93D',
          orange: '#FF8C42',
          brown: '#6B4423',
        }
      }
    },
  },
  plugins: [],
}
