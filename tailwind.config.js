/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 语义色：通过 CSS 变量驱动，随主题切换
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        'card-foreground': 'hsl(var(--card-foreground) / <alpha-value>)',
        popover: 'hsl(var(--popover) / <alpha-value>)',
        'popover-foreground': 'hsl(var(--popover-foreground) / <alpha-value>)',
        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
        'primary-deep': 'hsl(var(--primary-deep) / <alpha-value>)',
        secondary: 'hsl(var(--secondary) / <alpha-value>)',
        'secondary-foreground': 'hsl(var(--secondary-foreground) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        'accent-foreground': 'hsl(var(--accent-foreground) / <alpha-value>)',
        destructive: 'hsl(var(--destructive) / <alpha-value>)',
        'destructive-foreground': 'hsl(var(--destructive-foreground) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        'warning-foreground': 'hsl(var(--warning-foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        'border-soft': 'hsl(var(--border-soft) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',

        // 品牌辅助色：苔绿 / 鎏金（同样由 CSS 变量驱动，随主题微调）
        moss: 'hsl(var(--moss) / <alpha-value>)',
        gold: 'hsl(var(--gold) / <alpha-value>)',

        // 旧语义 token 兼容
        'hover-inverse': 'hsl(var(--hover-inverse-bg) / <alpha-value>)',
        'hover-inverse-fg': 'hsl(var(--hover-inverse-fg) / <alpha-value>)',
        overlay: 'var(--overlay-color)',
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        // serif 修正:指向真正的衬线体(思源宋体),用于次要文本的雅致渲染
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Georgia', 'serif'],
        'serif-prose': ['"Noto Serif SC"', 'Georgia', 'serif'],
        brush: ['"Ma Shan Zheng"', 'cursive'],
        elegance: ['"ZCOOL XiaoWei"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        // 语义化阴影：随主题切换（CSS 变量）
        soft: 'var(--shadow-soft)',
        premium: 'var(--shadow-premium)',
        lifted: 'var(--shadow-lifted)',
        glow: '0 0 16px rgb(var(--primary) / 0.25)',
        'glow-bronze': '0 0 20px rgb(var(--gold) / 0.25)',
        'glow-primary': '0 0 25px rgb(var(--primary) / 0.35)',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 0.25s ease-out both',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'pulse-glow': 'pulseGlow 2s infinite ease-in-out',
        'ink-smoke': 'inkSmoke 3s infinite ease-in-out',
        shimmer: 'shimmer 1.6s infinite linear',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgb(var(--primary) / 0.25)' },
          '50%': { boxShadow: '0 0 25px rgb(var(--primary) / 0.45)' },
        },
        inkSmoke: {
          '0%, 100%': { filter: 'blur(0px) opacity(1)', transform: 'translateY(0)' },
          '50%': { filter: 'blur(1px) opacity(0.85)', transform: 'translateY(-2px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      // 统一间距尺度（4px 基础）
      spacing: {
        '4.5': '1.125rem', // 18px
        '5.5': '1.375rem', // 22px
      },
    },
  },
  plugins: [],
}
