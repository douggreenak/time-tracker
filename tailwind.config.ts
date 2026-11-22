import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Roboto",
          "\"Google Sans\"",
          "\"Google Sans Text\"",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Segoe UI\"",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "\"Roboto Mono\"",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        outline: "hsl(var(--outline) / <alpha-value>)",
        "outline-variant": "hsl(var(--outline-variant) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          container: "hsl(var(--primary-container) / <alpha-value>)",
          "on-container": "hsl(var(--on-primary-container) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          container: "hsl(var(--secondary-container) / <alpha-value>)",
          "on-container": "hsl(var(--on-secondary-container) / <alpha-value>)",
        },
        tertiary: {
          DEFAULT: "hsl(var(--tertiary) / <alpha-value>)",
          foreground: "hsl(var(--tertiary-foreground) / <alpha-value>)",
          container: "hsl(var(--tertiary-container) / <alpha-value>)",
          "on-container": "hsl(var(--on-tertiary-container) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        "surface-low": "hsl(var(--surface-container-low) / <alpha-value>)",
        "surface-container": "hsl(var(--surface-container) / <alpha-value>)",
        "surface-high": "hsl(var(--surface-container-high) / <alpha-value>)",
        "surface-highest": "hsl(var(--surface-container-highest) / <alpha-value>)",
      },
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "8px",
        DEFAULT: "12px",
        md: "16px",
        lg: "20px",
        xl: "28px",
        "2xl": "32px",
        "3xl": "36px",
        full: "9999px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 hsl(220 40% 10% / 0.06)",
        sm: "0 1px 2px 0 hsl(220 40% 10% / 0.08), 0 1px 3px 1px hsl(220 40% 10% / 0.06)",
        DEFAULT: "0 1px 3px 0 hsl(220 40% 10% / 0.10), 0 1px 2px -1px hsl(220 40% 10% / 0.10)",
        md: "0 2px 6px 0 hsl(220 40% 10% / 0.10), 0 1px 2px 0 hsl(220 40% 10% / 0.06)",
        lg: "0 4px 12px 0 hsl(220 40% 10% / 0.10), 0 2px 4px -2px hsl(220 40% 10% / 0.08)",
        xl: "0 12px 32px -8px hsl(220 40% 10% / 0.20), 0 4px 10px -4px hsl(220 40% 10% / 0.10)",
        "2xl": "0 24px 56px -12px hsl(220 40% 10% / 0.26)",
        "m3-1": "0 1px 2px 0 hsl(220 40% 10% / 0.30), 0 1px 3px 1px hsl(220 40% 10% / 0.15)",
        "m3-2": "0 1px 2px 0 hsl(220 40% 10% / 0.30), 0 2px 6px 2px hsl(220 40% 10% / 0.15)",
        "m3-3": "0 1px 3px 0 hsl(220 40% 10% / 0.30), 0 4px 8px 3px hsl(220 40% 10% / 0.15)",
      },
      transitionTimingFunction: {
        expressive: "cubic-bezier(0.2, 0, 0, 1)",
        emphasized: "cubic-bezier(0.05, 0.7, 0.1, 1)",
      },
      keyframes: {
        "m3-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        "m3-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "m3-rise": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "m3-in": "m3-in 0.28s cubic-bezier(0.2, 0, 0, 1) both",
        "m3-fade": "m3-fade 0.2s ease-out both",
        "m3-rise": "m3-rise 0.35s cubic-bezier(0.2, 0, 0, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
