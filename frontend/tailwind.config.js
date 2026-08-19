/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f1",
          100: "#d7ecdf",
          200: "#b0d9c2",
          300: "#7fbf9f",
          400: "#4da17c",
          500: "#2b8562",
          600: "#1d6a4e",
          700: "#175540",
          800: "#134434",
          900: "#0f382c",
        },
        ink: {
          900: "#101418",
          700: "#2b3238",
          500: "#59636c",
          300: "#9aa4ad",
          100: "#e4e8ec",
          50: "#f4f6f8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'DM Sans'", "Inter", "system-ui", "sans-serif"],
        bangla: ["'Hind Siliguri'", "'Noto Sans Bengali'", "sans-serif"],
      },
      borderRadius: {
        card: "4px",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(16 20 24 / 0.05), 0 4px 16px -4px rgb(16 20 24 / 0.08)",
        lift: "0 4px 8px -2px rgb(16 20 24 / 0.08), 0 16px 40px -12px rgb(29 106 78 / 0.25)",
      },
    },
  },
  plugins: [],
};
