import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#020203',
        surface: '#09090b',
        'surface-2': '#121214',
        cyan: {
          DEFAULT: '#05ff85',
          dim: 'rgba(5,255,133,0.1)',
          glow: 'rgba(5,255,133,0.5)',
        },
        danger: {
          DEFAULT: '#ff3366',
          dim: 'rgba(255,51,102,0.1)',
          glow: 'rgba(255,51,102,0.5)',
        },
        warning: {
          DEFAULT: '#ffaa00',
          dim: 'rgba(255,170,0,0.1)',
          glow: 'rgba(255,170,0,0.5)',
        },
        success: {
          DEFAULT: '#00ff88',
          dim: 'rgba(0,255,136,0.1)',
          glow: 'rgba(0,255,136,0.5)',
        },
        border: 'rgba(5,255,133,0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
        'radar-spin': 'radarSpin 3s linear infinite',
        'threat-flash': 'threatFlash 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 6px rgba(5,255,133,0.1)' },
          '50%': { boxShadow: '0 0 14px rgba(5,255,133,0.25)' },
        },
        radarSpin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        threatFlash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(rgba(5,255,133,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(5,255,133,0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
    },
  },
  plugins: [],
}

export default config
