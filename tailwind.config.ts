import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';
import defaultTheme from 'tailwindcss/defaultTheme';

const gold = {
  50: '#fbf7e9',
  100: '#f5e8be',
  200: '#ecd395',
  300: '#e3bf72',
  400: '#d6b15f',
  500: '#c39a43',
  600: '#967127',
  700: '#78561b',
  800: '#553d17',
  900: '#382b14',
  950: '#211a10',
};

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'mobile-landscape': {
          raw: '(orientation: landscape) and (max-height: 700px)',
        },
      },
      fontFamily: {
        primary: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        green: Object.fromEntries(
          Object.entries(colors.green).map(([shade, hex]) => [
            shade,
            `rgb(var(--accent-${shade}, ${[1, 3, 5]
              .map((start) => parseInt(hex.slice(start, start + 2), 16))
              .join(' ')}) / <alpha-value>)`,
          ])
        ),
        gold,
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#00dc82',
          500: '#00cc75',
          600: '#00a85f',
          700: '#07824e',
          800: '#08653f',
          900: '#064b30',
          950: '#022c1d',
        },
        gray: {
          50: 'rgb(var(--gray-50, 250 250 250) / <alpha-value>)',
          100: 'rgb(var(--gray-100, 240 241 242) / <alpha-value>)',
          200: 'rgb(var(--gray-200, 217 219 222) / <alpha-value>)',
          300: 'rgb(var(--gray-300, 191 194 199) / <alpha-value>)',
          400: 'rgb(var(--gray-400, 150 155 163) / <alpha-value>)',
          500: 'rgb(var(--gray-500, 114 120 128) / <alpha-value>)',
          600: 'rgb(var(--gray-600, 81 87 96) / <alpha-value>)',
          700: 'rgb(var(--gray-700, 52 57 65) / <alpha-value>)',
          800: 'rgb(var(--gray-800, 36 40 46) / <alpha-value>)',
          900: 'rgb(var(--gray-900, 24 27 32) / <alpha-value>)',
          950: 'rgb(var(--gray-950, 16 18 20) / <alpha-value>)',
        },
        dark: '#101214',
      },
      keyframes: {
        flicker: {
          '0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100%': {
            opacity: '0.99',
            filter:
              'drop-shadow(0 0 1px rgba(252, 211, 77)) drop-shadow(0 0 15px rgba(245, 158, 11)) drop-shadow(0 0 1px rgba(252, 211, 77))',
          },
          '20%, 21.999%, 63%, 63.999%, 65%, 69.999%': {
            opacity: '0.4',
            filter: 'none',
          },
        },
        shimmer: {
          '0%': {
            backgroundPosition: '-700px 0',
          },
          '100%': {
            backgroundPosition: '700px 0',
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        flicker: 'flicker 3s linear infinite',
        shimmer: 'shimmer 1.3s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-in-out',
        'slide-down': 'slideDown 0.3s ease-in-out',
        'slide-in-from-right': 'slideInFromRight 0.3s ease-out',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
} satisfies Config;

export default config;
