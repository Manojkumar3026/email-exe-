import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#b8cdff',
          300: '#8badff',
          400: '#5c86ff',
          500: '#3660ff',
          600: '#2140f0',
          700: '#1a31c4',
          800: '#1a2b9c',
          900: '#1a2a7a',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
