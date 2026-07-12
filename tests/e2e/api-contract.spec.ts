/**
 * API 契约验证 E2E 测试
 *
 * 核心价值：验证前端 repository 调用的 API 路径与后端路由注册的路径完全匹配。
 * 这正是防止 "plotLines vs plot-lines" 路径不一致 bug 的防线。
 *
 * 策略：
 * - 注册一个测试用户获取 JWT
 * - 创建一个测试作品获取 bookId
 * - 对每个实体的 collection 路径发 GET 请求，验证返回 200 + JSON 数组
 * - 验证 401 无 token 时被拒
 * - 验证路径用连字符格式（非驼峰）
 */
import { test, expect } from '@playwright/test';
import {
  parseChapterArchitectureResult,
  parseProjectBlueprintResult,
} from '../../src/lib/aiClient';
import {
  isFulltextGhostAcceptance,
  createAIGhostId,
  matchesAIGhostId,
  updateGhostAttributes,
} from '../../src/features/editor/nodes/AIGhostText';
import { resolveForeshadowingSyncPatch } from '../../src/lib/foreshadowingSync';
import { removeBlueprintItem } from '../../src/features/projects/blueprintUtils';
import type { ProjectBlueprintResult } from '../../src/types/ai';
import { createBookFromBlueprint } from '../../server/src/services/blueprintImportService';

const BASE = 'http://localhost:8787/api';

/** 生成唯一用户名 */
function uniqueUsername(prefix = 'api'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 注册并返回 { token, userId, bookId } */
async function setupUserAndBook(request: import('@playwright/test').APIRequestContext) {
  const username = uniqueUsername();
  const password = 'test123456';

  // 注册
  const regRes = await request.post(`${BASE}/auth/register`, {
    data: { username, password, displayName: 'E2E Tester' },
  });
  expect(regRes.ok()).toBeTruthy();
  const regBody = await regRes.json();
  const token = regBody.token;
  const userId = regBody.user.id;
  const headers = { Authorization: `Bearer ${token}` };

  // 创建作品
  const bookRes = await request.post(`${BASE}/books`, {
    headers,
    data: { title: 'E2E测试作品' },
  });
  expect(bookRes.ok()).toBeTruthy();
  const book = await bookRes.json();
  const bookId = book.id;

  return { token, userId, bookId, headers, username };
}

function completeBlueprintFixture(): ProjectBlueprintResult {
  return {
    worldview: [{ category: 'geography', title: '云隐山', content: '主角成长的山门。', tags: ['山门'] }],
    characters: [{
      name: '林逸风', alias: '', faction: '云隐派', role: 'protagonist',
      appearance: '青衫长剑。', personality: '正直果断。', background: '云隐派弟子。',
      arc: '从少年成长为守护者。', tags: ['主角'], relatedWorldviewTitles: ['云隐山'],
    }],
    scenes: [{
      name: '云隐山后山', description: '迷雾中的禁地。', atmosphere: ['神秘'],
      characterNames: ['林逸风'], worldviewTitles: ['云隐山'], chapterTitles: ['第一章'],
    }],
    plotLines: [{ title: '身世之谜', type: 'main', synopsis: '主角追查自己的身世。', status: 'planning', order: 0 }],
    plotPoints: [{
      plotLineTitle: '身世之谜', title: '发现玉佩', description: '主角在禁地发现线索。',
      chapterTitle: '第一章', characterNames: ['林逸风'], order: 0, timelineOrder: 0,
    }],
    inspirations: [{ title: '失落玉佩', content: '可作为后续谜团线索。', tags: ['伏笔'], category: '道具' }],
    foreshadowing: [{
      title: '玉佩裂纹', description: '裂纹暗示主角血脉。',
      setupChapterTitle: '第一章', payoffChapterTitle: '第一章', status: 'pending',
    }],
    chapters: [{ title: '第一章', summary: '主角发现玉佩。', outline: '进入禁地并发现线索。', order: 0 }],
  };
}

test.describe('API 路径契约验证', () => {
  test('仅接受全文生成的 Ghost Text 才触发章节结构同步', () => {
    expect(isFulltextGhostAcceptance({ source: 'fulltext', text: '已接受的正文' })).toBeTruthy();
    expect(isFulltextGhostAcceptance({ source: 'continue', text: '续写建议' })).toBeFalsy();
    expect(isFulltextGhostAcceptance({ source: 'fulltext' })).toBeFalsy();
    expect(updateGhostAttributes({ source: 'fulltext', text: '' }, '流式正文')).toEqual({
      source: 'fulltext',
      text: '流式正文',
    });
    expect(createAIGhostId()).not.toBe(createAIGhostId());
    expect(matchesAIGhostId('fulltext-ghost', 'fulltext-ghost')).toBeTruthy();
    expect(matchesAIGhostId('continue-ghost', 'fulltext-ghost')).toBeFalsy();
  });

  test('伏笔计划关联只在实际章节分析命中后更新状态', () => {
    const base = {
      id: 'foreshadow-1', bookId: 'book-1', title: '玉佩裂纹', description: '线索',
      setupChapterId: 'chapter-1', payoffChapterId: 'chapter-3', status: 'pending' as const,
    };
    expect(resolveForeshadowingSyncPatch(base, 'plant', 'chapter-1')).toEqual({ status: 'planted' });
    expect(resolveForeshadowingSyncPatch(base, 'payoff', 'chapter-3')).toEqual({ status: 'paidoff' });
    expect(resolveForeshadowingSyncPatch(base, 'payoff', 'chapter-2')).toEqual({});
    expect(resolveForeshadowingSyncPatch(
      { ...base, setupChapterId: undefined, payoffChapterId: undefined },
      'plant',
      'chapter-2',
    )).toEqual({ setupChapterId: 'chapter-2', status: 'planted' });
  });

  test('移除蓝图核心条目时同步清理下游引用', () => {
    const blueprint = completeBlueprintFixture();
    const withoutPlotLine = removeBlueprintItem(blueprint, 'plotLines', 0);
    expect(withoutPlotLine.plotLines).toHaveLength(0);
    expect(withoutPlotLine.plotPoints).toHaveLength(0);

    const withoutChapter = removeBlueprintItem(blueprint, 'chapters', 0);
    expect(withoutChapter.scenes[0].chapterTitles).toEqual([]);
    expect(withoutChapter.plotPoints[0].chapterTitle).toBeUndefined();
    expect(withoutChapter.foreshadowing[0].setupChapterTitle).toBeUndefined();
    expect(withoutChapter.foreshadowing[0].payoffChapterTitle).toBeUndefined();
  });

  test('AI 结构化 JSON 契约拒绝缺失必填集合的结果', () => {
    const completeBlueprint = completeBlueprintFixture();
    expect(parseProjectBlueprintResult(JSON.stringify(completeBlueprint))).not.toBeNull();
    expect(parseProjectBlueprintResult(JSON.stringify({ worldview: [] }))).toBeNull();
    expect(parseProjectBlueprintResult(JSON.stringify({ ...completeBlueprint, characters: [{}] }))).toBeNull();
    expect(parseProjectBlueprintResult(JSON.stringify({
      ...completeBlueprint,
      foreshadowing: [{ ...completeBlueprint.foreshadowing[0], setupChapterTitle: '不存在的章节' }],
    }))).toBeNull();
    expect(parseProjectBlueprintResult(JSON.stringify({
      ...completeBlueprint,
      scenes: [{ ...completeBlueprint.scenes[0], characterNames: ['不存在的角色'] }],
    }))).toBeNull();
    expect(parseProjectBlueprintResult(JSON.stringify({
      ...completeBlueprint,
      chapters: [...completeBlueprint.chapters, { ...completeBlueprint.chapters[0] }],
    }))).toBeNull();
    const overlongAsciiTitle = 'a'.repeat(101);
    expect(parseProjectBlueprintResult(JSON.stringify({
      ...completeBlueprint,
      chapters: [{ ...completeBlueprint.chapters[0], title: overlongAsciiTitle }],
      scenes: [{ ...completeBlueprint.scenes[0], chapterTitles: [overlongAsciiTitle] }],
      plotPoints: [{ ...completeBlueprint.plotPoints[0], chapterTitle: overlongAsciiTitle }],
      foreshadowing: [{
        ...completeBlueprint.foreshadowing[0],
        setupChapterTitle: overlongAsciiTitle,
        payoffChapterTitle: overlongAsciiTitle,
      }],
    }))).toBeNull();
    expect(parseProjectBlueprintResult(JSON.stringify({
      ...completeBlueprint,
      chapters: [
        { ...completeBlueprint.chapters[0], title: 'Chapter' },
        { ...completeBlueprint.chapters[0], title: 'chapter', order: 1 },
      ],
      scenes: [{ ...completeBlueprint.scenes[0], chapterTitles: ['Chapter'] }],
      plotPoints: [{ ...completeBlueprint.plotPoints[0], chapterTitle: 'Chapter' }],
      foreshadowing: [{
        ...completeBlueprint.foreshadowing[0], setupChapterTitle: 'Chapter', payoffChapterTitle: 'Chapter',
      }],
    }))).toBeNull();
    expect(parseProjectBlueprintResult(JSON.stringify({
      ...completeBlueprint,
      worldview: [
        completeBlueprint.worldview[0],
        { ...completeBlueprint.worldview[0], category: 'history' },
      ],
    }))).toBeNull();
    const normalizedEmptyReferences = parseProjectBlueprintResult(JSON.stringify({
      ...completeBlueprint,
      plotPoints: [{ ...completeBlueprint.plotPoints[0], chapterTitle: '' }],
      foreshadowing: [{
        ...completeBlueprint.foreshadowing[0], setupChapterTitle: '', payoffChapterTitle: '',
      }],
    }));
    expect(normalizedEmptyReferences?.plotPoints[0].chapterTitle).toBeUndefined();
    expect(normalizedEmptyReferences?.foreshadowing[0].setupChapterTitle).toBeUndefined();

    const completeArchitecture = {
      chapterSummary: '本章摘要',
      characters: [],
      scenes: [],
      plotPoints: [],
      worldview: [],
      inspirations: [],
      foreshadowing: [],
    };
    expect(parseChapterArchitectureResult(JSON.stringify(completeArchitecture))).not.toBeNull();
    expect(parseChapterArchitectureResult(JSON.stringify({ characters: [] }))).toBeNull();
    expect(parseChapterArchitectureResult(JSON.stringify({
      ...completeArchitecture,
      foreshadowing: [{ title: '伏笔', description: '描述', action: 'invalid' }],
    }))).toBeNull();
  });

  test('蓝图生成参数严格校验，导入边界返回稳定错误', async ({ request }) => {
    const { headers } = await setupUserAndBook(request);
    const invalidRequest = await request.post(`${BASE}/ai/project-blueprint`, {
      headers,
      data: {
        bookTitle: '参数校验', synopsis: '测试简介', genre: '玄幻',
        targetWords: -1, structureLevel: 'unknown',
      },
    });
    expect(invalidRequest.status()).toBe(400);

    const blueprint = completeBlueprintFixture();
    const invalidTitle = await request.post(`${BASE}/books/from-blueprint`, {
      headers,
      data: {
        book: {
          title: '///', subtitle: '', synopsis: '验证标题。', genre: '玄幻',
          targetWords: 100000, coverColor: '#3d4a3d', dailyGoal: 2000,
        },
        blueprint,
      },
    });
    expect(invalidTitle.status()).toBe(400);

    const invalidChapterTitle = '../坏章节';
    const invalidChapter = await request.post(`${BASE}/books/from-blueprint`, {
      headers,
      data: {
        book: {
          title: `非法章节_${Date.now().toString(36)}`, subtitle: '', synopsis: '验证章节标题。', genre: '玄幻',
          targetWords: 100000, coverColor: '#3d4a3d', dailyGoal: 2000,
        },
        blueprint: {
          ...blueprint,
          chapters: [{ ...blueprint.chapters[0], title: invalidChapterTitle }],
          scenes: [{ ...blueprint.scenes[0], chapterTitles: [invalidChapterTitle] }],
          plotPoints: [{ ...blueprint.plotPoints[0], chapterTitle: invalidChapterTitle }],
          foreshadowing: [{
            ...blueprint.foreshadowing[0],
            setupChapterTitle: invalidChapterTitle,
            payoffChapterTitle: invalidChapterTitle,
          }],
        },
      },
    });
    expect(invalidChapter.status()).toBe(400);

    const oversizedChapterTitle = '章'.repeat(90);
    const oversizedChapter = await request.post(`${BASE}/books/from-blueprint`, {
      headers,
      data: {
        book: {
          title: `超长章节_${Date.now().toString(36)}`, subtitle: '', synopsis: '验证字节长度。', genre: '玄幻',
          targetWords: 100000, coverColor: '#3d4a3d', dailyGoal: 2000,
        },
        blueprint: {
          ...blueprint,
          chapters: [{ ...blueprint.chapters[0], title: oversizedChapterTitle }],
          scenes: [{ ...blueprint.scenes[0], chapterTitles: [oversizedChapterTitle] }],
          plotPoints: [{ ...blueprint.plotPoints[0], chapterTitle: oversizedChapterTitle }],
          foreshadowing: [{
            ...blueprint.foreshadowing[0],
            setupChapterTitle: oversizedChapterTitle,
            payoffChapterTitle: oversizedChapterTitle,
          }],
        },
      },
    });
    expect(oversizedChapter.status()).toBe(400);

    const duplicateBook = await request.post(`${BASE}/books/from-blueprint`, {
      headers,
      data: {
        book: {
          title: 'e2e测试作品', subtitle: '', synopsis: '验证路径冲突。', genre: '玄幻',
          targetWords: 100000, coverColor: '#3d4a3d', dailyGoal: 2000,
        },
        blueprint,
      },
    });
    expect(duplicateBook.status()).toBe(409);
    expect(await duplicateBook.json()).toEqual({ error: '已存在文件路径相同的作品标题' });

    for (let attempt = 0; attempt < 2; attempt++) {
      await request.post(`${BASE}/books/from-blueprint`, {
        headers,
        data: {
          book: {
            title: 'E2E测试作品', subtitle: '', synopsis: '验证限流。', genre: '玄幻',
            targetWords: 100000, coverColor: '#3d4a3d', dailyGoal: 2000,
          },
          blueprint,
        },
      });
    }
    const rateLimited = await request.post(`${BASE}/books/from-blueprint`, {
      headers,
      data: {
        book: {
          title: 'E2E测试作品', subtitle: '', synopsis: '验证限流。', genre: '玄幻',
          targetWords: 100000, coverColor: '#3d4a3d', dailyGoal: 2000,
        },
        blueprint,
      },
    });
    expect(rateLimited.status()).toBe(429);
  });

  test('蓝图导入在事务中途失败时不残留作品', async ({ request }) => {
    const { headers, userId } = await setupUserAndBook(request);
    const title = `事务回滚_${Date.now().toString(36)}`;
    const blueprint = completeBlueprintFixture();
    const duplicateCharacters = {
      book: {
        title, subtitle: '', synopsis: '验证事务回滚。', genre: '玄幻',
        targetWords: 100000, coverColor: '#3d4a3d', dailyGoal: 2000,
      },
      blueprint: {
        ...blueprint,
        characters: [blueprint.characters[0], { ...blueprint.characters[0] }],
      },
    } as unknown as Parameters<typeof createBookFromBlueprint>[1];

    await expect(createBookFromBlueprint(userId, duplicateCharacters)).rejects.toThrow();
    const books = await request.get(`${BASE}/books`, { headers });
    expect((await books.json()).some((book: { title: string }) => book.title === title)).toBeFalsy();
  });

  test('蓝图导入同步世界观双向关系', async ({ request }) => {
    const { headers } = await setupUserAndBook(request);
    const title = `关系同步_${Date.now().toString(36)}`;
    const created = await request.post(`${BASE}/books/from-blueprint`, {
      headers,
      data: {
        book: {
          title, subtitle: '', synopsis: '验证关系同步。', genre: '玄幻',
          targetWords: 100000, coverColor: '#3d4a3d', dailyGoal: 2000,
        },
        blueprint: completeBlueprintFixture(),
      },
    });
    expect(created.status()).toBe(201);
    const { book } = await created.json();
    const [worldviewResponse, charactersResponse, scenesResponse] = await Promise.all([
      request.get(`${BASE}/books/${book.id}/worldview`, { headers }),
      request.get(`${BASE}/books/${book.id}/characters`, { headers }),
      request.get(`${BASE}/books/${book.id}/scenes`, { headers }),
    ]);
    const [worldview] = await worldviewResponse.json();
    const [character] = await charactersResponse.json();
    const [scene] = await scenesResponse.json();
    expect(worldview.relatedCharacterIds).toEqual([character.id]);
    expect(worldview.relatedSceneIds).toEqual([scene.id]);
  });

  test('落地页截图资源可访问', async ({ request }) => {
    const landing = await request.get('/');
    const html = await landing.text();
    expect(html).toContain('src="hero-screenshot.jpg"');
    expect(html).not.toContain("'/hero-screenshot.jpg'");
    expect(html).not.toContain("'/hero-screenshot-dark.jpg'");

    for (const path of ['/hero-screenshot.jpg', '/hero-screenshot-dark.jpg']) {
      const res = await request.get(path);
      expect(res.ok(), `GET ${path} 应返回 2xx，实际 ${res.status()}`).toBeTruthy();
      expect(res.headers()['content-type']).toContain('image/jpeg');
      expect(Number(res.headers()['content-length'] ?? 0), `${path} 不应为空文件`).toBeGreaterThan(0);
    }
  });

  test('子路径部署静态资源、SPA fallback 与 API 别名可访问', async ({ request }) => {
    const redirect = await request.get('/Scribe', { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe('/Scribe/');

    const landing = await request.get('/Scribe/');
    expect(landing.ok(), `GET /Scribe/ 应返回 2xx，实际 ${landing.status()}`).toBeTruthy();
    const landingHtml = await landing.text();
    expect(landingHtml).toContain('data-app-path="/login"');
    expect(landingHtml).toContain('src="hero-screenshot.jpg"');

    for (const path of ['/Scribe/hero-screenshot.jpg', '/Scribe/hero-screenshot-dark.jpg']) {
      const res = await request.get(path);
      expect(res.ok(), `GET ${path} 应返回 2xx，实际 ${res.status()}`).toBeTruthy();
      expect(res.headers()['content-type']).toContain('image/jpeg');
      expect(Number(res.headers()['content-length'] ?? 0), `${path} 不应为空文件`).toBeGreaterThan(0);
    }

    const loginPage = await request.get('/Scribe/login?tab=register');
    expect(loginPage.ok(), `GET /Scribe/login 应返回 SPA，实际 ${loginPage.status()}`).toBeTruthy();
    const loginHtml = await loginPage.text();
    expect(loginHtml).toContain('/Scribe/assets/');
    expect(loginHtml).not.toContain('src="/assets/');
    expect(loginHtml).not.toContain('href="/assets/');

    const apiAlias = await request.get('/Scribe/api/auth/me');
    expect(apiAlias.status()).toBe(401);
    expect(apiAlias.headers()['content-type']).toContain('application/json');
  });

  test('所有实体 collection 端点返回 200 + JSON 数组', async ({ request }) => {
    const { headers, bookId } = await setupUserAndBook(request);

    // 所以前端 repository 会调用的 collection 路径
    // 路径必须用连字符（kebab-case），与后端路由注册一致
    const endpoints = [
      `/books/${bookId}/chapters`,
      `/books/${bookId}/characters`,
      `/books/${bookId}/volumes`,
      `/books/${bookId}/worldview`,
      `/books/${bookId}/scenes`,
      `/books/${bookId}/plot-lines`,
      `/books/${bookId}/plot-points`,
      `/books/${bookId}/relations`,
      `/books/${bookId}/foreshadowing`,
      `/books/${bookId}/inspiration`,
      `/books/${bookId}/writing-logs`,
    ];

    for (const path of endpoints) {
      const res = await request.get(`${BASE}${path}`, { headers });
      expect(res.ok(), `GET ${path} 应返回 2xx，实际 ${res.status()}`).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body), `GET ${path} 应返回数组，实际 ${typeof body}`).toBeTruthy();
    }
  });

  test('驼峰路径不应匹配（防止 SPA fallback 返回 HTML）', async ({ request }) => {
    const { headers, bookId } = await setupUserAndBook(request);

    // 这些驼峰路径是错误的，不应返回 200 JSON
    const wrongPaths = [
      `/books/${bookId}/plotLines`,
      `/books/${bookId}/plotPoints`,
      `/books/${bookId}/writingLogs`,
    ];

    for (const path of wrongPaths) {
      const res = await request.get(`${BASE}${path}`, { headers });
      // 要么 404 JSON 错误，要么返回非 JSON；总之不能返回成功数组
      const contentType = res.headers()['content-type'] ?? '';
      const isJson = contentType.includes('application/json');
      // 驼峰路径不应该返回 JSON 数组
      if (isJson && res.ok()) {
        const body = await res.json();
        // 如果返回的是数组（而非 { error } 对象），说明路径意外匹配了
        expect(Array.isArray(body), `驼峰路径 ${path} 不应返回数组`).toBeFalsy();
      }
    }
  });

  test('无 token 访问所有受保护端点返回 401', async ({ request }) => {
    const { bookId } = await setupUserAndBook(request);

    const protectedEndpoints = [
      { method: 'GET', path: `/books` },
      { method: 'GET', path: `/books/${bookId}/chapters` },
      { method: 'GET', path: `/books/${bookId}/characters` },
      { method: 'GET', path: `/books/${bookId}/plot-lines` },
      { method: 'GET', path: `/books/${bookId}/plot-points` },
      { method: 'GET', path: `/books/${bookId}/worldview` },
      { method: 'GET', path: `/books/${bookId}/scenes` },
      { method: 'GET', path: `/books/${bookId}/relations` },
      { method: 'GET', path: `/books/${bookId}/foreshadowing` },
      { method: 'GET', path: `/books/${bookId}/inspiration` },
      { method: 'GET', path: `/books/${bookId}/writing-logs` },
    ];

    for (const { method, path } of protectedEndpoints) {
      const res = await request[method.toLowerCase()](`${BASE}${path}`);
      expect(res.status(), `${method} ${path} 无 token 应返回 401，实际 ${res.status()}`).toBe(401);
    }
  });

  test('作品 CRUD 完整流程', async ({ request }) => {
    const { headers } = await setupUserAndBook(request);

    // list
    const listRes = await request.get(`${BASE}/books`, { headers });
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(Array.isArray(list)).toBeTruthy();
    expect(list.length).toBeGreaterThan(0);

    const bookId = list[0].id;

    // get single
    const getRes = await request.get(`${BASE}/books/${bookId}`, { headers });
    expect(getRes.ok()).toBeTruthy();
    const book = await getRes.json();
    expect(book.id).toBe(bookId);

    // update
    const patchRes = await request.patch(`${BASE}/books/${bookId}`, {
      headers,
      data: { title: 'E2E修改标题' },
    });
    expect(patchRes.ok()).toBeTruthy();
    const updated = await patchRes.json();
    expect(updated.title).toBe('E2E修改标题');

    // delete
    const delRes = await request.delete(`${BASE}/books/${bookId}`, { headers });
    expect(delRes.ok()).toBeTruthy();

    // 确认已删除
    const getAfterDel = await request.get(`${BASE}/books/${bookId}`, { headers });
    expect(getAfterDel.status()).toBe(404);
  });

  test('章节创建并读取（含正文文件存储）', async ({ request }) => {
    const { headers, bookId } = await setupUserAndBook(request);

    // 创建章节
    const createRes = await request.post(`${BASE}/books/${bookId}/chapters`, {
      headers,
      data: {
        title: '测试章节',
        content: '<p>这是测试正文内容。</p>',
        summary: '测试摘要',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const chapter = await createRes.json();
    expect(chapter.id).toBeTruthy();
    expect(chapter.content).toContain('这是测试正文内容');

    // 读取章节列表
    const listRes = await request.get(`${BASE}/books/${bookId}/chapters`, { headers });
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(list.length).toBe(1);

    // 读取单个章节（含正文）
    const getRes = await request.get(`${BASE}/chapters/${chapter.id}`, { headers });
    expect(getRes.ok()).toBeTruthy();
    const fetched = await getRes.json();
    expect(fetched.content).toContain('这是测试正文内容');
  });

  test('剧情线 + 剧情节点 + 伏笔 联合路径验证', async ({ request }) => {
    const { headers, bookId } = await setupUserAndBook(request);

    // 创建剧情线
    const plRes = await request.post(`${BASE}/books/${bookId}/plot-lines`, {
      headers,
      data: { title: '主线', type: 'main' },
    });
    expect(plRes.ok()).toBeTruthy();
    const plotLine = await plRes.json();

    // 创建剧情节点
    const ppRes = await request.post(`${BASE}/books/${bookId}/plot-points`, {
      headers,
      data: { plotLineId: plotLine.id, title: '起始点' },
    });
    expect(ppRes.ok()).toBeTruthy();
    await ppRes.json();

    // 按剧情线查节点（二级路由）
    const byLineRes = await request.get(
      `${BASE}/plot-lines/${plotLine.id}/plot-points`,
      { headers },
    );
    expect(byLineRes.ok(), `GET /plot-lines/:id/plot-points 应返回 200`).toBeTruthy();
    const byLine = await byLineRes.json();
    expect(Array.isArray(byLine)).toBeTruthy();
    expect(byLine.length).toBe(1);

    // 创建伏笔
    const fsRes = await request.post(`${BASE}/books/${bookId}/foreshadowing`, {
      headers,
      data: { title: '神秘信件', status: 'pending' },
    });
    expect(fsRes.ok()).toBeTruthy();
    await fsRes.json();

    // 查伏笔列表
    const fsListRes = await request.get(`${BASE}/books/${bookId}/foreshadowing`, { headers });
    expect(fsListRes.ok()).toBeTruthy();
    const fsList = await fsListRes.json();
    expect(fsList.length).toBe(1);
  });

  test('角色 + 角色关系 联合路径验证', async ({ request }) => {
    const { headers, bookId } = await setupUserAndBook(request);

    // 创建两个角色
    const c1Res = await request.post(`${BASE}/books/${bookId}/characters`, {
      headers,
      data: { name: '林溯', role: 'protagonist' },
    });
    const c1 = await c1Res.json();
    const c2Res = await request.post(`${BASE}/books/${bookId}/characters`, {
      headers,
      data: { name: '沈砚', role: 'antagonist' },
    });
    const c2 = await c2Res.json();

    // 创建关系
    const relRes = await request.post(`${BASE}/books/${bookId}/relations`, {
      headers,
      data: { fromId: c1.id, toId: c2.id, type: 'rival', description: '宿敌' },
    });
    expect(relRes.ok()).toBeTruthy();

    // 按角色查关系（二级路由）
    const byCharRes = await request.get(
      `${BASE}/characters/${c1.id}/relations`,
      { headers },
    );
    expect(byCharRes.ok(), `GET /characters/:id/relations 应返回 200`).toBeTruthy();
    const byChar = await byCharRes.json();
    expect(byChar.length).toBe(1);
  });

  test('卷宗 + 按卷宗查章节 路径验证', async ({ request }) => {
    const { headers, bookId } = await setupUserAndBook(request);

    // 创建卷宗
    const volRes = await request.post(`${BASE}/books/${bookId}/volumes`, {
      headers,
      data: { title: '第一卷' },
    });
    expect(volRes.ok()).toBeTruthy();
    const volume = await volRes.json();

    // 创建属于该卷宗的章节
    await request.post(`${BASE}/books/${bookId}/chapters`, {
      headers,
      data: { title: '卷宗内章节', volumeId: volume.id },
    });

    // 按卷宗查章节（二级路由）
    const byVolRes = await request.get(
      `${BASE}/volumes/${volume.id}/chapters`,
      { headers },
    );
    expect(byVolRes.ok(), `GET /volumes/:id/chapters 应返回 200`).toBeTruthy();
    const byVol = await byVolRes.json();
    expect(byVol.length).toBe(1);
    expect(byVol[0].title).toBe('卷宗内章节');
  });

  test('写作记录 + 日期范围查询路径验证', async ({ request }) => {
    const { headers, bookId } = await setupUserAndBook(request);

    // 上报写作记录
    const logRes = await request.post(`${BASE}/books/${bookId}/writing-logs`, {
      headers,
      data: { wordCount: 1000, duration: 1800, date: '2026-07-03' },
    });
    expect(logRes.ok()).toBeTruthy();

    // 查全部
    const listRes = await request.get(`${BASE}/books/${bookId}/writing-logs`, { headers });
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(list.length).toBe(1);

    // 日期范围查询
    const rangeRes = await request.get(
      `${BASE}/books/${bookId}/writing-logs?startDate=2026-07-01&endDate=2026-07-31`,
      { headers },
    );
    expect(rangeRes.ok()).toBeTruthy();
    const range = await rangeRes.json();
    expect(range.length).toBe(1);

    // 单条读取、更新、删除路径需与前端通用 Repository 保持一致
    const created = await logRes.json();
    const getRes = await request.get(`${BASE}/writing-logs/${created.id}`, { headers });
    expect(getRes.ok(), `GET /writing-logs/:id 应返回 200`).toBeTruthy();

    const updateRes = await request.patch(`${BASE}/writing-logs/${created.id}`, {
      headers,
      data: { wordCount: 1200, duration: 2100 },
    });
    expect(updateRes.ok(), `PATCH /writing-logs/:id 应返回 200`).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.wordCount).toBe(1200);
    expect(updated.duration).toBe(2100);

    const deleteRes = await request.delete(`${BASE}/writing-logs/${created.id}`, { headers });
    expect(deleteRes.ok(), `DELETE /writing-logs/:id 应返回 200`).toBeTruthy();
  });

  test('未知 API 路径返回 JSON 404', async ({ request }) => {
    const { headers } = await setupUserAndBook(request);
    const res = await request.patch(`${BASE}/writing-logs/not-found-route/extra`, {
      headers,
      data: { wordCount: 1 },
    });

    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
    const body = await res.json();
    expect(body.error).toBe('接口不存在');
  });

  test('AI 项目蓝图与章节结构端点已注册', async ({ request }) => {
    const { headers } = await setupUserAndBook(request);

    const blueprintRes = await request.post(`${BASE}/ai/project-blueprint`, {
      headers,
      data: {
        bookTitle: '端点验证作品',
      },
    });
    expect(blueprintRes.status(), 'project-blueprint 应命中路由并校验必填字段').toBe(400);

    const architectureRes = await request.post(`${BASE}/ai/chapter-architecture`, {
      headers,
      data: {
        chapterTitle: '第一章',
        chapterContent: '调查员在旧港发现一枚会发光的记忆匣。',
      },
    });
    expect(architectureRes.status(), 'chapter-architecture 应命中路由并校验必填字段').toBe(400);
  });
});
