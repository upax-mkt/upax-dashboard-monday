/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        upax: {
          dark: '#0A0A0F',
          card: '#111118',
          border: '#1E1E2E',
          accent: '#6C63FF',
          'accent-2': '#FF6B6B',
          muted: '#3A3A4A',
          text: '#E0E0F0',
          'text-muted': '#8888A0',
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
