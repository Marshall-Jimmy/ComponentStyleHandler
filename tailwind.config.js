/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface1: 'var(--color-surface-1)',
        surface2: 'var(--color-surface-2)',
        surface3: 'var(--color-surface-3)',
        border: 'var(--color-border)',
        borderStrong: 'var(--color-border-strong)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        tertiary: 'var(--color-text-tertiary)',
        accent: 'var(--color-accent)',
        accentHover: 'var(--color-accent-hover)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      boxShadow: {
        elevation1: 'var(--shadow-elevation-1)',
        elevation2: 'var(--shadow-elevation-2)',
        glowAccent: 'var(--shadow-glow-accent)',
      },
      keyframes: {
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        slideInUp: 'slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) both',
        fadeIn: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
        scaleIn: 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
        spin: 'spin 0.8s linear infinite',
        toastIn: 'toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
        toastOut: 'toastOut 0.24s cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
