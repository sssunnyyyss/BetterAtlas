/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Emory navy primary scale — 600 is the canonical Emory Blue (#002878)
        primary: {
          50:  "#e4e6f0",  // Emory light blue-tinted surface
          100: "#c5c7cc",  // Emory muted gray-blue
          200: "#a0aece",
          300: "#7892bc",
          400: "#6384c6",  // Emory medium blue
          500: "#3d62ab",
          600: "#002878",  // Emory Navy — main brand color
          700: "#001f63",
          800: "#001550",
          900: "#000b3d",
          950: "#00052b",
        },
        // Emory gold accent scale
        accent: {
          50:  "#fbf9ed",  // Emory cream
          100: "#ebe8d7",  // Emory warm off-white
          200: "#c5c19d",  // Emory warm mid
          300: "#e8d585",  // Emory gold light
          400: "#d2b000",  // Emory gold
          500: "#d28e00",  // Emory darker gold
          600: "#7d610f",  // Emory dark gold
        },
      },
    },
  },
  plugins: [],
};
