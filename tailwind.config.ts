import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc5fb",
          400: "#36a5f7",
          500: "#0b87ea",
          600: "#016bc8",
          700: "#0255a2",
          800: "#064885",
          900: "#0b3d6f",
          950: "#072649",
        },
        health: {
          teal: "#0d9488",
          mint: "#10b981",
          slate: "#0f172a",
        },
      },
    },
  },
  plugins: [],
};
export default config;
