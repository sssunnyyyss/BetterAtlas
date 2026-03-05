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
        bg: {
          0: "hsl(var(--bg-0) / <alpha-value>)",
          "000": "hsl(var(--bg-000) / <alpha-value>)",
          100: "hsl(var(--bg-100) / <alpha-value>)",
          200: "hsl(var(--bg-200) / <alpha-value>)",
          300: "hsl(var(--bg-300) / <alpha-value>)",
        },
        text: {
          100: "hsl(var(--text-100) / <alpha-value>)",
          200: "hsl(var(--text-200) / <alpha-value>)",
          300: "hsl(var(--text-300) / <alpha-value>)",
          400: "hsl(var(--text-400) / <alpha-value>)",
          500: "hsl(var(--text-500) / <alpha-value>)",
        },
        // Emory navy primary scale. 600 is canonical Emory Blue (#002878)
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          50: "#e4e6f0",
          100: "#c5c7cc",
          200: "#a0aece",
          300: "#7892bc",
          400: "#6384c6",
          500: "#3d62ab",
          600: "#002878",
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
          50: "#fbf9ed",
          100: "#ebe8d7",
          200: "#c5c19d",
          300: "#e8d585",
          400: "#d2b000",
          500: "#d28e00",
          600: "#7d610f",
        },
        "accent-hover": "hsl(var(--accent-hover) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
