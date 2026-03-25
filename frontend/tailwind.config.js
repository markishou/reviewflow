/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rf: {
          'bg-primary': '#0a0e1a',
          'bg-secondary': '#151b2e',
          'bg-tertiary': '#1e2840',
          'accent': '#00d4aa',
          'accent-blue': '#0099ff',
          'accent-danger': '#ff4757',
          'accent-warning': '#ffa502',
          'accent-purple': '#a855f7',
          'text-primary': '#e8ecf3',
          'text-secondary': '#8b95ab',
          'text-muted': '#4a5568',
          'border': '#1e284066',
        }
      },
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
