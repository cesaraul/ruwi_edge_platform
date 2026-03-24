import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     '#0d1117',
          surface:  '#161b22',
          elevated: '#21262d',
          border:   '#30363d',
        },
        status: {
          ok:   '#3fb950',
          warn: '#d29922',
          crit: '#f85149',
          off:  '#6e7681',
        },
        agro: {
          primary: '#2ea043',
          accent:  '#56d364',
          muted:   '#1f6340',
        },
        energy: {
          primary: '#388bfd',
          accent:  '#79c0ff',
          muted:   '#1c3a6e',
        },
        txt: {
          primary:   '#e6edf3',
          secondary: '#8b949e',
          muted:     '#6e7681',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
