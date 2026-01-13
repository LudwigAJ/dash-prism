// tailwind.config.mjs (optional – delete if using defaults)
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/ts/**/*.{ts,tsx}"],  // Auto-purge unused classes
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: 'var(--border)',
        // Your theme vars
      },
    },
  },
  darkMode: 'class',  // For your light/dark toggle
};