/**
 * 认证流程 E2E 测试
 *
 * 覆盖：
 * - 落地页导航按钮（登录/注册）存在且链接正确
 * - URL ?tab=register 直接进入注册表单
 * - 注册 → 自动登录 → 跳转 /editor
 * - 登出后 → 重定向 /login
 * - 重复注册同名用户 → 报错
 * - 密码显示/隐藏切换
 */
import { test, expect } from '@playwright/test';

/** 生成唯一用户名，避免重复测试冲突 */
function uniqueUsername(prefix = 'e2e'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

test.describe('认证流程', () => {
  test('落地页右上角显示登录与注册按钮', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 导航栏中的登录按钮存在且指向 /login
    const loginLink = page.locator('nav a[href="/login"]').first();
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText('登录');

    // 导航栏中的注册按钮存在且指向 /login?tab=register
    const registerLink = page.locator('nav a[href="/login?tab=register"]').first();
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toContainText('注册');
  });

  test('URL ?tab=register 直接进入注册表单', async ({ page }) => {
    await page.goto('/login?tab=register', { waitUntil: 'domcontentloaded' });

    // 注册 Tab 应为激活态
    const registerTab = page.locator('button[role="tab"]:has-text("注册")');
    await expect(registerTab).toHaveAttribute('aria-selected', 'true');

    // 应显示「显示名（可选）」字段（仅注册模式有）
    await expect(page.locator('label:has-text("显示名")')).toBeVisible();
  });

  test('完整注册→登录→登出流程', async ({ page }) => {
    const username = uniqueUsername('auth');
    const password = 'test123456';

    // 1. 注册
    await page.goto('/login?tab=register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[placeholder="字母 / 数字 / 下划线"]')).toBeVisible();
    await page.fill('input[placeholder="字母 / 数字 / 下划线"]', username);
    await page.fill('input[placeholder="至少 6 位"]', password);
    await page.click('button[type="submit"]');

    // 注册成功后应跳转到 /editor
    await page.waitForURL('**/editor', { timeout: 10000 });
    expect(page.url()).toContain('/editor');

    // 2. 登出：清除 token 并访问受保护页面应跳转登录
    await page.evaluate(() => localStorage.removeItem('scribe-token'));
    await page.goto('/editor');
    await page.waitForURL('**/login', { timeout: 10000 });

    // 3. 重新登录
    await page.fill('input[placeholder="字母 / 数字 / 下划线"]', username);
    await page.fill('input[placeholder="至少 6 位"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/editor', { timeout: 10000 });
    expect(page.url()).toContain('/editor');
  });

  test('重复注册同名用户报错', async ({ page }) => {
    const username = uniqueUsername('dup');
    const password = 'test123456';

    // 第一次注册成功
    await page.goto('/login?tab=register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[placeholder="字母 / 数字 / 下划线"]')).toBeVisible();
    await page.fill('input[placeholder="字母 / 数字 / 下划线"]', username);
    await page.fill('input[placeholder="至少 6 位"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/editor', { timeout: 10000 });

    // 登出
    await page.evaluate(() => localStorage.removeItem('scribe-token'));

    // 第二次注册同名用户应报错
    await page.goto('/login?tab=register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[placeholder="字母 / 数字 / 下划线"]')).toBeVisible();
    await page.fill('input[placeholder="字母 / 数字 / 下划线"]', username);
    await page.fill('input[placeholder="至少 6 位"]', password);
    await page.click('button[type="submit"]');

    // 应显示错误提示
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role="alert"]')).toContainText('已存在');
  });

  test('密码显示/隐藏切换功能', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const passwordInput = page.locator('input[placeholder="至少 6 位"]');
    await passwordInput.fill('secret123');

    // 默认 type=password
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // 点击显示密码
    await page.locator('button[aria-label="显示密码"]').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // 再点击隐藏
    await page.locator('button[aria-label="隐藏密码"]').click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('未认证访问受保护页面跳转登录', async ({ page }) => {
    // 确保无 token
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[placeholder="字母 / 数字 / 下划线"]')).toBeVisible();
    await page.evaluate(() => localStorage.removeItem('scribe-token'));

    // 访问编辑器应被重定向
    await page.goto('/editor');
    await page.waitForURL('**/login', { timeout: 10000 });
  });
});
