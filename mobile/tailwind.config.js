/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#181b24',
        surface2: '#20242f',
        border: '#2a2f3c',
        text: '#e7e9ee',
        muted: '#9aa3b2',
        primary: '#6d5efc',
        primary2: '#8b7dff',
        success: '#2fbf71',
        danger: '#ef4565',
        warn: '#f5a623',
      },
    },
  },
  plugins: [],
};
