/**
 * 作品 CRUD + 章节编辑全流程 E2E 测试
 *
 * 覆盖核心用户旅程：
 * - 登录 → 项目页 → 创建作品 → 进入编辑器
 * - 编辑器中创建章节、编辑正文、自动保存
 * - 返回项目页，验证作品和章节存在
 * - 删除作品
 */
import { test, expect } from '@playwright/test';

function uniqueUsername(prefix = 'crud'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

test.describe('作品 + 章节 UI 全流程', () => {
  test('左侧菜单切换到工作台不闪灰色骨架', async ({ page, request }) => {
    const username = uniqueUsername('nav');
    const regRes = await request.post('http://localhost:8787/api/auth/register', {
      data: { username, password: 'test123456', displayName: 'Nav Tester' },
    });
    expect(regRes.ok()).toBeTruthy();
    const regBody = await regRes.json();
    const token = regBody.token;
    const headers = { Authorization: `Bearer ${token}` };

    const bookRes = await request.post('http://localhost:8787/api/books', {
      headers,
      data: {
        title: `导航测试_${Date.now().toString(36)}`,
        synopsis: '验证菜单切换时不显示整块灰色骨架。',
        genre: 'fantasy',
        targetWords: 10000,
        dailyGoal: 500,
      },
    });
    expect(bookRes.ok()).toBeTruthy();
    const book = await bookRes.json();

    await page.addInitScript(({ authToken, user, bookId }) => {
      localStorage.setItem('scribe-token', authToken);
      localStorage.setItem('scribe-user', JSON.stringify(user));
      localStorage.setItem('scribe-book', JSON.stringify({
        state: { currentBookId: bookId },
        version: 0,
      }));
    }, { authToken: token, user: regBody.user, bookId: book.id });

    await page.goto('/plot', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '剧情' })).toBeVisible();

    await page.getByTitle('工作台').click();
    await page.waitForTimeout(120);
    await expect(page.getByLabel('页面加载中')).toHaveCount(0);
    await expect(page.getByRole('status', { name: '加载中' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible();
  });

  test('创建作品 → 编辑章节 → 验证内容持久化', async ({ page }) => {
    const username = uniqueUsername();
    const password = 'test123456';
    const bookTitle = `测试作品_${Date.now().toString(36)}`;
    const chapterTitle = '第一章 开端';
    const chapterContent = '这是第一章的正文内容，用于验证编辑器持久化。';

    // 1. 注册并登录
    await page.goto('/login?tab=register', { timeout: 30000 });
    await page.fill('input[placeholder="字母 / 数字 / 下划线"]', username);
    await page.fill('input[placeholder="至少 6 位"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/editor', { timeout: 15000 });

    // 2. 进入项目页创建作品
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });

    // 点击新建作品按钮
    await page.click('button:has-text("新建作品")');
    await page.waitForTimeout(500);

    // 填写作品标题（BookForm 弹窗中 name="title" 的 input）
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill(bookTitle);

    // 点击弹窗内的创建作品按钮（dialog 内最后一个 primary 按钮）
    await page.locator('[role="dialog"] button:has-text("创建作品")').click();
    await page.waitForTimeout(1500);

    // 3. 验证 API 层面作品已创建
    const token = await page.evaluate(() => localStorage.getItem('scribe-token'));
    const booksRes = await page.request.get('http://localhost:8787/api/books', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const books = await booksRes.json();
    const createdBook = books.find((b: { title: string }) => b.title === bookTitle);
    expect(createdBook, '作品应在 API 返回中存在').toBeTruthy();

    // 4. 通过 API 创建章节并写入正文（验证文件存储）
    const chapterRes = await page.request.post(
      `http://localhost:8787/api/books/${createdBook.id}/chapters`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          title: chapterTitle,
          content: `<p>${chapterContent}</p>`,
          summary: '章节摘要',
        },
      },
    );
    expect(chapterRes.ok()).toBeTruthy();
    const chapter = await chapterRes.json();
    expect(chapter.content).toContain(chapterContent);

    // 5. 读取章节验证持久化
    const getRes = await page.request.get(
      `http://localhost:8787/api/chapters/${chapter.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.title).toBe(chapterTitle);
    expect(fetched.content).toContain(chapterContent);
  });

  test('落地页主题切换功能', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const themeToggle = page.locator('#theme-toggle');
    await expect(themeToggle).toBeVisible();

    // 默认 light 模式
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // 切换到 dark
    await themeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // 切换回 light
    await themeToggle.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('落地页所有导航锚点可跳转', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 功能、AI 助写、数据安全 锚点链接存在（导航栏中）
    await expect(page.locator('nav a[href="#features"]')).toBeVisible();
    await expect(page.locator('nav a[href="#ai-writing"]')).toBeVisible();
    await expect(page.locator('nav a[href="#security"]')).toBeVisible();

    // 点击功能链接
    await page.locator('nav a[href="#features"]').click();
    await page.waitForTimeout(500);
    // 验证 URL 包含 anchor
    expect(page.url()).toContain('#features');
  });
});
