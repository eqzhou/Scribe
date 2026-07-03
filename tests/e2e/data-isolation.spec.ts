/**
 * 用户数据隔离 E2E 测试
 *
 * 核心验证：一个用户的作品/章节/角色等数据，对另一个用户完全不可见。
 * 覆盖所有实体的 collection 端点 + 单实体越权访问。
 *
 * 策略：
 * - 注册两个用户 A、B
 * - 用户 A 创建作品 + 各类实体
 * - 用户 B 查询同类端点，结果应为空数组
 * - 用户 B 用 A 的 bookId 查询 → 应 404 或空
 * - 用户 B 用 A 的实体 ID 直接访问 → 应 404
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8787/api';

function uniqueUsername(prefix = 'iso'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function registerUser(request: import('@playwright/test').APIRequestContext) {
  const username = uniqueUsername();
  const res = await request.post(`${BASE}/auth/register`, {
    data: { username, password: 'test123456' },
  });
  const body = await res.json();
  return { username, token: body.token, userId: body.user.id, headers: { Authorization: `Bearer ${body.token}` } };
}

test.describe('用户数据隔离', () => {
  test('用户 B 无法看到用户 A 的作品', async ({ request }) => {
    const userA = await registerUser(request);
    const userB = await registerUser(request);

    // 用户 A 创建作品
    const createRes = await request.post(`${BASE}/books`, {
      headers: userA.headers,
      data: { title: 'A的私密作品' },
    });
    const book = await createRes.json();

    // 用户 B 查询作品列表 — 不应包含 A 的作品
    const bListRes = await request.get(`${BASE}/books`, { headers: userB.headers });
    expect(bListRes.ok()).toBeTruthy();
    const bList = await bListRes.json();
    const bBookIds = bList.map((b: { id: string }) => b.id);
    expect(bBookIds).not.toContain(book.id);

    // 用户 B 直接访问 A 的作品 ID → 404
    const bGetRes = await request.get(`${BASE}/books/${book.id}`, { headers: userB.headers });
    expect(bGetRes.status()).toBe(404);
  });

  test('用户 B 无法看到用户 A 的章节', async ({ request }) => {
    const userA = await registerUser(request);
    const userB = await registerUser(request);

    // A 创建作品 + 章节
    const bookRes = await request.post(`${BASE}/books`, {
      headers: userA.headers,
      data: { title: '隔离测试' },
    });
    const book = await bookRes.json();

    const chRes = await request.post(`${BASE}/books/${book.id}/chapters`, {
      headers: userA.headers,
      data: { title: 'A的章节', content: '<p>私密内容</p>' },
    });
    const chapter = await chRes.json();

    // B 用 A 的 bookId 查章节列表 → 空数组
    const bListRes = await request.get(`${BASE}/books/${book.id}/chapters`, {
      headers: userB.headers,
    });
    expect(bListRes.ok()).toBeTruthy();
    const bList = await bListRes.json();
    expect(bList).toEqual([]);

    // B 直接访问 A 的章节 ID → 404
    const bGetRes = await request.get(`${BASE}/chapters/${chapter.id}`, { headers: userB.headers });
    expect(bGetRes.status()).toBe(404);
  });

  test('用户 B 无法看到用户 A 的角色和关系', async ({ request }) => {
    const userA = await registerUser(request);
    const userB = await registerUser(request);

    // A 创建作品 + 角色
    const bookRes = await request.post(`${BASE}/books`, {
      headers: userA.headers,
      data: { title: '角色隔离' },
    });
    const book = await bookRes.json();

    const c1Res = await request.post(`${BASE}/books/${book.id}/characters`, {
      headers: userA.headers,
      data: { name: '角色A1', role: 'protagonist' },
    });
    const c1 = await c1Res.json();
    const c2Res = await request.post(`${BASE}/books/${book.id}/characters`, {
      headers: userA.headers,
      data: { name: '角色A2', role: 'supporting' },
    });
    const c2 = await c2Res.json();

    // A 创建关系
    await request.post(`${BASE}/books/${book.id}/relations`, {
      headers: userA.headers,
      data: { fromId: c1.id, toId: c2.id, type: 'friend' },
    });

    // B 查 A 的 bookId 下的角色 → 空
    const bCharRes = await request.get(`${BASE}/books/${book.id}/characters`, {
      headers: userB.headers,
    });
    expect(bCharRes.ok()).toBeTruthy();
    expect(await bCharRes.json()).toEqual([]);

    // B 查 A 的 bookId 下的关系 → 空
    const bRelRes = await request.get(`${BASE}/books/${book.id}/relations`, {
      headers: userB.headers,
    });
    expect(bRelRes.ok()).toBeTruthy();
    expect(await bRelRes.json()).toEqual([]);

    // B 直接访问 A 的角色 ID → 404
    const bGetChar = await request.get(`${BASE}/characters/${c1.id}`, { headers: userB.headers });
    expect(bGetChar.status()).toBe(404);
  });

  test('用户 B 无法修改/删除用户 A 的作品', async ({ request }) => {
    const userA = await registerUser(request);
    const userB = await registerUser(request);

    const bookRes = await request.post(`${BASE}/books`, {
      headers: userA.headers,
      data: { title: '不可篡改' },
    });
    const book = await bookRes.json();

    // B 尝试修改 A 的作品 → 404
    const bPatch = await request.patch(`${BASE}/books/${book.id}`, {
      headers: userB.headers,
      data: { title: '被B篡改' },
    });
    expect(bPatch.status()).toBe(404);

    // B 尝试删除 A 的作品 → 404
    const bDel = await request.delete(`${BASE}/books/${book.id}`, { headers: userB.headers });
    expect(bDel.status()).toBe(404);

    // A 仍然能正常访问
    const aGet = await request.get(`${BASE}/books/${book.id}`, { headers: userA.headers });
    expect(aGet.ok()).toBeTruthy();
    const aBook = await aGet.json();
    expect(aBook.title).toBe('不可篡改');
  });

  test('用户 B 无法看到用户 A 的剧情线/节点/伏笔/灵感/场景/世界观', async ({ request }) => {
    const userA = await registerUser(request);
    const userB = await registerUser(request);

    // A 创建作品 + 各类实体
    const bookRes = await request.post(`${BASE}/books`, {
      headers: userA.headers,
      data: { title: '全面隔离' },
    });
    const book = await bookRes.json();
    const bookId = book.id;

    // 剧情线
    const plRes = await request.post(`${BASE}/books/${bookId}/plot-lines`, {
      headers: userA.headers,
      data: { title: '主线', type: 'main' },
    });
    const plotLine = await plRes.json();

    // 剧情节点
    await request.post(`${BASE}/books/${bookId}/plot-points`, {
      headers: userA.headers,
      data: { plotLineId: plotLine.id, title: '节点1' },
    });

    // 伏笔
    await request.post(`${BASE}/books/${bookId}/foreshadowing`, {
      headers: userA.headers,
      data: { title: '伏笔A', status: 'pending' },
    });

    // 灵感
    await request.post(`${BASE}/books/${bookId}/inspiration`, {
      headers: userA.headers,
      data: { title: '灵感A', content: '内容' },
    });

    // 场景
    await request.post(`${BASE}/books/${bookId}/scenes`, {
      headers: userA.headers,
      data: { name: '场景A' },
    });

    // 世界观
    await request.post(`${BASE}/books/${bookId}/worldview`, {
      headers: userA.headers,
      data: { title: '世界观A', category: 'geography' },
    });

    // 卷宗
    await request.post(`${BASE}/books/${bookId}/volumes`, {
      headers: userA.headers,
      data: { title: '卷宗A' },
    });

    // B 用 A 的 bookId 查所有实体 → 全部空数组
    const endpoints = [
      'plot-lines',
      'plot-points',
      'foreshadowing',
      'inspiration',
      'scenes',
      'worldview',
      'volumes',
      'writing-logs',
    ];

    for (const ep of endpoints) {
      const res = await request.get(`${BASE}/books/${bookId}/${ep}`, {
        headers: userB.headers,
      });
      expect(res.ok(), `GET /books/:id/${ep} 应返回 200（空数组），实际 ${res.status()}`).toBeTruthy();
      const body = await res.json();
      expect(body, `用户 B 查 ${ep} 应为空数组`).toEqual([]);
    }
  });
});
