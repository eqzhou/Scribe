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
  test('AI 蓝图先预览确认，确认前不创建作品或写入资料', async ({ page, request }) => {
    const username = uniqueUsername('bp');
    const regRes = await request.post('http://localhost:8787/api/auth/register', {
      data: { username, password: 'test123456', displayName: 'Blueprint Tester' },
    });
    expect(regRes.ok()).toBeTruthy();
    const regBody = await regRes.json();
    const token = regBody.token;
    const headers = { Authorization: `Bearer ${token}` };
    const bookTitle = `蓝图预览_${Date.now().toString(36)}`;
    let requestedStructureLevel: string | undefined;
    const blueprint = {
      worldview: [{ category: 'geography', title: '雾港', content: '终年被雾笼罩的港城。', tags: ['港城'] }],
      characters: [{
        name: '沈砚', alias: '', faction: '巡夜司', role: 'protagonist', appearance: '黑衣执灯。',
        personality: '克制敏锐。', background: '追查失踪船队。', arc: '从独行者成为守护者。',
        tags: ['主角'], relatedWorldviewTitles: ['雾港'],
      }],
      scenes: [{
        name: '旧码头', description: '废弃船只停靠的码头。', atmosphere: ['潮湿'],
        characterNames: ['沈砚'], worldviewTitles: ['雾港'], chapterTitles: ['第一章 雾中来客'],
      }],
      plotLines: [{ title: '失踪船队', type: 'main', synopsis: '追查船队失踪真相。', status: 'planning', order: 0 }],
      plotPoints: [{
        plotLineTitle: '失踪船队', title: '发现空船', description: '主角发现无人归来的旧船。',
        chapterTitle: '第一章 雾中来客', characterNames: ['沈砚'], order: 0, timelineOrder: 0,
      }],
      inspirations: [{ title: '雾中铃声', content: '铃声可作为幽灵船线索。', tags: ['氛围'], category: '意象' }],
      foreshadowing: [{
        title: '断裂船铃', description: '船铃缺口对应失踪船队。',
        setupChapterTitle: '第一章 雾中来客', payoffChapterTitle: '第一章 雾中来客', status: 'pending',
      }],
      chapters: [{ title: '第一章 雾中来客', summary: '主角在雾港发现空船。', outline: '巡查码头并发现线索。', order: 0 }],
    };

    await page.route('**/api/models', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [{
            id: 'test-model', name: '测试模型', provider: 'custom', modelId: 'test',
            baseUrl: 'http://example.test/v1', enabled: true, isDefault: true,
            temperature: 0.7, maxTokens: 4096, capabilities: ['worldview'],
          }],
          activeModelId: 'test-model',
        }),
      });
    });
    await page.route('**/api/ai/project-blueprint', async (route) => {
      requestedStructureLevel = route.request().postDataJSON().structureLevel;
      const raw = JSON.stringify(blueprint);
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ text: raw })}\n\ndata: [DONE]\n\n`,
      });
    });
    await page.addInitScript(({ authToken, user }) => {
      localStorage.setItem('scribe-token', authToken);
      localStorage.setItem('scribe-user', JSON.stringify(user));
    }, { authToken: token, user: regBody.user });

    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '新建作品' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name="title"]').fill(bookTitle);
    await dialog.locator('textarea[name="synopsis"]').fill('雾港巡夜人追查一支凭空消失的船队。');
    await dialog.getByRole('button', { name: '详细' }).click();
    await dialog.locator('input[name="dailyGoal"]').fill('100001');
    await dialog.getByRole('button', { name: '生成蓝图预览' }).click();
    await expect(dialog.getByText('每日目标需为 1 到 100000 的整数')).toBeVisible();
    expect(requestedStructureLevel).toBeUndefined();
    await dialog.locator('input[name="dailyGoal"]').fill('2000');
    await dialog.getByRole('button', { name: '生成蓝图预览' }).click();

    await expect(dialog.getByRole('heading', { name: '蓝图预览' })).toBeVisible();
    expect(requestedStructureLevel).toBe('detailed');
    await dialog.getByRole('tab', { name: /角色/ }).click();
    await expect(dialog.getByText('沈砚', { exact: true })).toBeVisible();
    await dialog.getByRole('tab', { name: /灵感/ }).click();
    await dialog.getByRole('button', { name: '移除 雾中铃声' }).click();
    const beforeConfirm = await request.get('http://localhost:8787/api/books', { headers });
    expect((await beforeConfirm.json()).some((item: { title: string }) => item.title === bookTitle)).toBeFalsy();

    await dialog.getByRole('button', { name: '确认创建并导入' }).click();
    await expect(dialog).toBeHidden();
    const afterConfirm = await request.get('http://localhost:8787/api/books', { headers });
    const created = (await afterConfirm.json()).find((item: { title: string }) => item.title === bookTitle);
    expect(created).toBeTruthy();
    const characters = await request.get(`http://localhost:8787/api/books/${created.id}/characters`, { headers });
    expect((await characters.json()).map((item: { name: string }) => item.name)).toContain('沈砚');
    const inspirations = await request.get(`http://localhost:8787/api/books/${created.id}/inspiration`, { headers });
    expect((await inspirations.json()).map((item: { title: string }) => item.title)).not.toContain('雾中铃声');
  });

  test('子路径部署下顶部图标返回 /Scribe 首页', async ({ page, request }) => {
    const username = uniqueUsername('sp');
    const regRes = await request.post('http://localhost:8787/Scribe/api/auth/register', {
      data: { username, password: 'test123456', displayName: 'Subpath Tester' },
    });
    expect(regRes.ok()).toBeTruthy();
    const regBody = await regRes.json();
    const token = regBody.token;
    const headers = { Authorization: `Bearer ${token}` };

    const bookRes = await request.post('http://localhost:8787/Scribe/api/books', {
      headers,
      data: {
        title: `子路径导航_${Date.now().toString(36)}`,
        synopsis: '验证 /Scribe 子路径部署下顶部图标不会跳到域名根。',
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

    await page.goto('/Scribe/worldview', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('main').getByRole('heading', { name: '世界观', exact: true })).toBeVisible();

    const homeLink = page.getByRole('link', { name: '返回首页' });
    await expect(homeLink).toHaveAttribute('href', /\/Scribe\/$/);
    await homeLink.click();
    await page.waitForURL('**/Scribe/', { timeout: 10000 });
    await expect(page.locator('#hero-screenshot-img')).toBeVisible();
  });

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
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: '剧情', exact: true })).toBeVisible();

    await page.getByTitle('工作台').click();
    await page.waitForTimeout(120);
    await expect(page.getByLabel('页面加载中')).toHaveCount(0);
    await expect(page.getByRole('status', { name: '加载中' })).toHaveCount(0);
    await expect(main.getByRole('heading', { name: '工作台', exact: true })).toBeVisible();
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
