// tailwind.config.js
module.exports = {
  purge: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      backgroundColor: {
        'dark-blueish-green': '#0a1d1a',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
