/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        // Emory navy primary scale — 600 is the canonical Emory Blue (#002878)
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
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
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        // Emory gold accent scale
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
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
