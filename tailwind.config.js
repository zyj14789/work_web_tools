/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './gui/**/*.{html,tsx,ts}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontSize: {
        'xs': ['12px', '18px'],
        'sm': ['14px', '20px'],
        'base': ['16px', '24px'],
      },
    },
  },
  plugins: [],
};
