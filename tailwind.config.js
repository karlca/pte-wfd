/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}", "./public/**/*.html"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#2d6a4f", light: "#52b788", dark: "#1b4332" },
        accent: "#1a73e8",
        danger: "#d32f2f",
      },
    },
  },
  plugins: [],
};
