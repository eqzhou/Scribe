import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// JS 版配置（优先于 .ts 加载，避免 Vite 编译 TS 配置时写 node_modules/.vite-temp）
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
