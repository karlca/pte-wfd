/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}', './public/**/*.html'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--tw-primary)',
          light: 'var(--tw-primary-light)',
          dark: 'var(--tw-primary-dark)',
        },
        accent: 'var(--tw-accent)',
        danger: 'var(--tw-danger)',
        surface: 'var(--tw-surface)',
        'bg-main': 'var(--tw-bg-main)',
        'bg-card': 'var(--tw-bg-card)',
        'text-main': 'var(--tw-text-main)',
        'text-muted': 'var(--tw-text-muted)',
        'border-theme': 'var(--tw-border)',
      },
    },
  },
  plugins: [],
};
