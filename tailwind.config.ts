import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1b3461',
          'navy-dark': '#152a50',
          accent: '#4A90D9',
          'accent-hover': '#185FA5',
          'accent-alt': '#6366F1',
          dark: '#0A0E1A',
        },
        surface: {
          DEFAULT: '#ffffff',
          raised: '#f5f7fa',
          muted: '#eef1f6',
          border: '#dde3ee',
          'border-strong': '#b8c4d8',
        },
        content: {
          primary: '#111827',
          secondary: '#374151',
          muted: '#6B7280',
          inverse: '#ffffff',
        },
        status: {
          ready: '#166534',
          'ready-bg': '#dcfce7',
          risk: '#92400e',
          'risk-bg': '#fef3c7',
          unready: '#991b1b',
          'unready-bg': '#fee2e2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
