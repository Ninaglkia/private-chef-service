/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#faf9f7',
          100: '#f5f3ef',
          200: '#e8e4dc',
          300: '#d4cdc0',
          400: '#bdb3a1',
          500: '#a89a85',
          600: '#8f806c',
          700: '#766959',
          800: '#62574a',
          900: '#52493f',
        },
        gold: {
          50: '#fffbf0',
          100: '#fff4dd',
          200: '#ffe5b4',
          300: '#ffd699',
          400: '#ffc047',
          500: '#ffb347',
          600: '#ff9e1f',
          700: '#ff8c00',
          800: '#e67e00',
          900: '#cc6600',
        },
        cream: {
          50: '#fffef9',
          100: '#fffef5',
          200: '#fffaf0',
          300: '#fff5e6',
          400: '#fff0d9',
          500: '#ffe6cc',
          600: '#ffd9b3',
          700: '#ffcc99',
          800: '#f0c080',
          900: '#e0b366',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      fontSize: {
        'display-1': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-2': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-3': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.1), 0 2px 8px -2px rgba(0, 0, 0, 0.05)',
        'soft-xl': '0 20px 50px -12px rgba(0, 0, 0, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
