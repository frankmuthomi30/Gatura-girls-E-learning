/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CSS-variable-driven theme color — adapts per role
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
          light: 'rgb(var(--color-primary-light) / <alpha-value>)',
        },
        // Static role colors for explicit use
        admin: {
          DEFAULT: '#4F46E5',
          dark: '#4338CA',
          light: '#6366F1',
        },
        teacher: {
          DEFAULT: '#0D9488',
          dark: '#0F766E',
          light: '#14B8A6',
        },
        student: {
          DEFAULT: '#1A6B45',
          dark: '#145534',
          light: '#228B57',
        },
        stream: {
          blue: '#185FA5',
          green: '#1A6B45',
          magenta: '#99355A',
          red: '#A32D2D',
          white: '#888780',
          yellow: '#BA7517',
        },
      },
    },
  },
  plugins: [],
};
