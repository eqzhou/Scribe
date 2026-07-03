import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置
 *
 * 策略：
 * - 仅 chromium，复用已运行的本地服务（http://localhost:8787）
 * - 失败时保留截图、视频、trace 供调试
 * - 测试文件统一放在 tests/e2e/ 下
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // 串行执行，避免注册用户冲突
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 复用已运行的 pm2 服务，不自动启动
  webServer: {
    command: 'echo "use existing server"',
    url: 'http://localhost:8787',
    reuseExistingServer: true,
    timeout: 5000,
  },
});
