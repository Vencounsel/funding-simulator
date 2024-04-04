/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--background-color)',
        textDark: 'var(--text-dark)',
        textLight: '#FFFFFF',
        primaryOrange: 'var(--orange)',
        borderLight: '#EEEEE2',
        borderDark: 'var(--border-dark)',
        borderDarkHover: 'var(--border-dark-hover)',
        blue: 'var(--blue)',
        lightBlue: 'var(--light-blue)',
        pink: 'var(--pink)',
        dangerLight: '#FF6B6B'
      }
    }
  },
  plugins: []
};
