/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nuit: { DEFAULT: '#1E2A3A', 50: '#F2F4F7', 100: '#E1E6ED', 700: '#2B3B52', 800: '#1E2A3A', 900: '#141C27' },
        or: { DEFAULT: '#A8842C', 50: '#FBF6EA', 100: '#F3E7C6', 400: '#C29E45', 500: '#A8842C', 600: '#8A6B21' },
        creme: '#FAF7F2',
        terre: '#B4532A',
      },
      fontFamily: {
        titre: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
