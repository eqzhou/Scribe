// 种子数据注入：新用户注册后注入《云隐录》示例武侠小说
// 符合 PRD 7.2：首次启动无作品时自动注入示例数据
import { prisma } from '../lib/prisma.js';
import { htmlToMd } from '../lib/markdown.js';
import { writeChapter } from '../lib/fileStore.js';

// 章节正文样本（HTML，TipTap 兼容，多段落 <p> 结构）
const CHAPTER_1_HTML =
  "<p>清晨的云隐山被薄雾笼罩，林逸风背着古卷，最后一次回望山门。师父的叮嘱犹在耳畔：'此卷关系江湖百年恩怨，切不可落入歹人之手。'</p>" +
  "<p>山道崎岖，少年踏着晨露一步步走下山去。林间鸟鸣清脆，却掩不住他内心的忐忑与期待。三年苦修，今日终于要踏入那传说中的江湖。</p>" +
  "<p>路过山腰凉亭，他驻足远眺，只见群山连绵，云海翻涌，心中豪情顿生。江湖，我来了。</p>";

const CHAPTER_2_HTML =
  "<p>日暮时分，林逸风走进洛阳城外的悦来客栈。店小二热情招呼，老张老板亲自端上一壶龙井。'少侠面生，首次来洛阳？'老张笑问。</p>" +
  "<p>林逸风点头，环顾四周，客栈里坐着各色江湖人物，佩刀带剑，神色各异。角落里一位青衣女子独坐窗边，正是医女苏婉儿。她神色淡然，手中把玩着一只银针。</p>" +
  "<p>林逸风找了个靠窗的位置坐下，古卷贴身收好，不敢有丝毫懈怠。夜色渐深，客栈的灯火映照着这个初入江湖的少年。</p>";

// 获取最近 n 天的日期字符串数组（YYYY-MM-DD，本地时区）
function recentDates(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

// 生成 0~max 之间的随机整数
function randInt(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

/**
 * 为新用户注入《云隐录》示例武侠小说种子数据。
 * 顺序创建各实体，确保外键关系正确建立。
 * @param userId 新注册用户 ID
 * @returns 创建的作品 bookId
 */
export async function seedDemoData(userId: string): Promise<string> {
  // 1. 创建作品
  const book = await prisma.book.create({
    data: {
      userId,
      title: '云隐录',
      synopsis:
        '江湖风云再起，一卷云隐录引出百年恩怨。少年剑客携古卷下山，卷入正邪之争，揭开身世之谜。',
      genre: '武侠',
      targetWords: 500000,
      coverColor: '#4a90d9',
      dailyGoal: 3000,
    },
  });
  const bookId = book.id;
  const bookTitle = book.title;

  // 2. 创建 3 个卷宗
  const v1 = await prisma.volume.create({
    data: { userId, bookId, title: '风起云隐', order: 0 },
  });
  const v2 = await prisma.volume.create({
    data: { userId, bookId, title: '剑指江湖', order: 1 },
  });
  const v3 = await prisma.volume.create({
    data: { userId, bookId, title: '恩怨了了', order: 2 },
  });

  // 3. 创建 8 个章节（正文以 Markdown 写入文件系统）
  // 第一卷
  const ch1 = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: v1.id,
      title: '下山',
      status: 'done',
      wordCount: 200,
      order: 0,
      summary: '林逸风奉师命下山，携云隐录踏入江湖。',
    },
  });
  writeChapter(userId, bookTitle, ch1.title, htmlToMd(CHAPTER_1_HTML));

  const ch2 = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: v1.id,
      title: '客栈',
      status: 'done',
      wordCount: 200,
      order: 1,
      summary: '林逸风夜宿悦来客栈，初遇医女苏婉儿。',
    },
  });
  writeChapter(userId, bookTitle, ch2.title, htmlToMd(CHAPTER_2_HTML));

  const ch3 = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: v1.id,
      title: '夜话',
      status: 'writing',
      wordCount: 0,
      order: 2,
      outline: '林逸风与苏婉儿夜话，得知魔教动向与云隐录的传闻。',
    },
  });

  // 第二卷
  const ch4 = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: v2.id,
      title: '比武',
      status: 'done',
      wordCount: 0,
      order: 3,
      summary: '洛阳武林大会，林逸风初露锋芒，与魔教结仇。',
    },
  });
  const ch5 = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: v2.id,
      title: '揭秘',
      status: 'done',
      wordCount: 0,
      order: 4,
      summary: '云隐录秘密初现，林逸风身世浮出水面。',
    },
  });
  const _ch6 = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: v2.id,
      title: '追逐',
      status: 'draft',
      wordCount: 0,
      order: 5,
    },
  });

  // 第三卷
  const ch7 = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: v3.id,
      title: '对决',
      status: 'archived',
      wordCount: 0,
      order: 6,
      summary: '林逸风与墨无痕的终极一战。',
    },
  });
  const _ch8 = await prisma.chapter.create({
    data: {
      userId,
      bookId,
      volumeId: v3.id,
      title: '归隐',
      status: 'done',
      wordCount: 0,
      order: 7,
      summary: '恩怨了了，林逸风归隐云隐山。',
    },
  });

  // 4. 创建 6 条世界观（3 地理 + 2 势力 + 1 体系）
  const wv1 = await prisma.worldviewEntry.create({
    data: {
      userId,
      bookId,
      category: 'geography',
      title: '云隐山',
      content:
        '云隐山位于中原之西，常年云雾缭绕，故名云隐。山中有云隐派，江湖正道之一。林逸风师承于此。',
      tags: ['山门', '正道'],
    },
  });
  const wv2 = await prisma.worldviewEntry.create({
    data: {
      userId,
      bookId,
      category: 'geography',
      title: '洛阳城',
      content:
        '洛阳为中原武林中心，商贸繁荣，门派林立。每年一度的武林大会在此举办，群豪云集。',
      tags: ['都市', '武林中心'],
    },
  });
  const wv3 = await prisma.worldviewEntry.create({
    data: {
      userId,
      bookId,
      category: 'geography',
      title: '江南水乡',
      content:
        '江南水乡风景秀丽，水路纵横。苏婉儿故乡所在，亦是儿女情长支线的主要舞台。',
      tags: ['水乡', '柔情'],
    },
  });
  const wv4 = await prisma.worldviewEntry.create({
    data: {
      userId,
      bookId,
      category: 'faction',
      title: '正道联盟',
      content:
        '正道联盟由少林、武当、云隐、青城等派组成，以维护江湖正义为己任。盟主每三年由各派推举产生。',
      tags: ['正道', '联盟'],
    },
  });
  const wv5 = await prisma.worldviewEntry.create({
    data: {
      userId,
      bookId,
      category: 'faction',
      title: '魔教',
      content:
        '魔教又称幽冥教，教主墨无痕武功高强，手段狠辣。觊觎云隐录百年，图谋称霸江湖。',
      tags: ['反派', '邪教'],
    },
  });
  const _wv6 = await prisma.worldviewEntry.create({
    data: {
      userId,
      bookId,
      category: 'system',
      title: '内力体系',
      content:
        '江湖武学以内力为根基，分筑基、通脉、凝气、化神四境。内力深厚者可隔空伤人、飞檐走壁。云隐录中记载有上古内力心法。',
      tags: ['武学', '内力'],
    },
  });

  // 5. 创建 6 个角色
  const c1 = await prisma.character.create({
    data: {
      userId,
      bookId,
      name: '林逸风',
      alias: '云隐剑客',
      faction: '正道',
      role: 'protagonist',
      appearance: '青衫长剑，眉目清朗，身形修长。',
      personality: '正直重义，略带书生气，遇事果断。',
      background: '云隐派弟子，自幼随师父修炼，身世成谜。',
      arc: '从初出茅庐的少年，成长为一代宗师。',
      age: 20,
      tags: ['剑客', '主角', '云隐派'],
      relatedWorldviewIds: [wv1.id],
    },
  });
  const c2 = await prisma.character.create({
    data: {
      userId,
      bookId,
      name: '苏婉儿',
      alias: '医仙',
      faction: '正道',
      role: 'supporting',
      appearance: '青衣素带，容貌清丽，常携药篓。',
      personality: '温柔聪慧，外柔内刚，医术精湛。',
      background: '江南医道世家传人，精通医理与毒理。',
      arc: '与林逸风相识于客栈，后成为重要助力与红颜知己。',
      age: 18,
      tags: ['医女', '女主', '江南'],
      relatedWorldviewIds: [wv3.id],
    },
  });
  const c3 = await prisma.character.create({
    data: {
      userId,
      bookId,
      name: '沈墨言',
      alias: '书剑公子',
      faction: '正道',
      role: 'supporting',
      appearance: '白衣纶巾，手不释卷，腰悬软剑。',
      personality: '博学多才，诙谐风趣，重情重义。',
      background: '青城派弟子，与苏婉儿同出一门。',
      arc: '与林逸风结义为兄弟，共抗魔教。',
      age: 22,
      tags: ['书生', '结义兄弟', '青城派'],
    },
  });
  const c4 = await prisma.character.create({
    data: {
      userId,
      bookId,
      name: '墨无痕',
      alias: '幽冥教主',
      faction: '魔教',
      role: 'antagonist',
      appearance: '黑袍覆面，眼神阴鸷，气度森寒。',
      personality: '野心勃勃，城府极深，心狠手辣。',
      background: '魔教教主，觊觎云隐录，与林逸风有血海深仇。',
      arc: '终局与林逸风决战，身败名裂。',
      age: 45,
      tags: ['反派', '魔教教主'],
      relatedWorldviewIds: [wv5.id],
    },
  });
  const c5 = await prisma.character.create({
    data: {
      userId,
      bookId,
      name: '老张',
      faction: '',
      role: 'minor',
      appearance: '身材微胖，面容和蔼，常着粗布短打。',
      personality: '热心健谈，见多识广。',
      background: '洛阳城外悦来客栈老板，江湖消息灵通。',
      age: 55,
      tags: ['客栈老板', '洛阳'],
      relatedWorldviewIds: [wv2.id],
    },
  });
  const c6 = await prisma.character.create({
    data: {
      userId,
      bookId,
      name: '白鹿仙',
      faction: '',
      role: 'minor',
      appearance: '鹤发童颜，仙风道骨，常骑白鹿。',
      personality: '淡泊超脱，偶有疯癫之语。',
      background: '云隐山隐士，林逸风师父的故交，实为林逸风生父。',
      age: 70,
      tags: ['隐士', '师徒', '身世'],
      relatedWorldviewIds: [wv1.id],
    },
  });

  // 6. 创建 5 条角色关系
  await prisma.characterRelation.create({
    data: {
      userId,
      bookId,
      fromId: c1.id,
      toId: c2.id,
      type: 'friend',
      description: '挚友，后互生情愫',
    },
  });
  await prisma.characterRelation.create({
    data: {
      userId,
      bookId,
      fromId: c1.id,
      toId: c3.id,
      type: 'family',
      description: '结义兄弟，肝胆相照',
    },
  });
  await prisma.characterRelation.create({
    data: {
      userId,
      bookId,
      fromId: c1.id,
      toId: c4.id,
      type: 'rival',
      description: '血海仇敌，不共戴天',
    },
  });
  await prisma.characterRelation.create({
    data: {
      userId,
      bookId,
      fromId: c2.id,
      toId: c3.id,
      type: 'other',
      description: '同门师兄妹',
    },
  });
  await prisma.characterRelation.create({
    data: {
      userId,
      bookId,
      fromId: c1.id,
      toId: c6.id,
      type: 'mentor',
      description: '师徒，实为父子',
    },
  });

  // 7. 创建 4 条剧情线（2 主线 + 2 支线）
  const pl1 = await prisma.plotLine.create({
    data: {
      userId,
      bookId,
      title: '云隐录之谜',
      type: 'main',
      status: 'planning',
      order: 0,
      synopsis: '云隐录记载上古武学秘辛，引出江湖百年恩怨。',
    },
  });
  const pl2 = await prisma.plotLine.create({
    data: {
      userId,
      bookId,
      title: '身世之谜',
      type: 'main',
      status: 'planning',
      order: 1,
      synopsis: '林逸风身世成谜，白鹿仙竟是生父。',
    },
  });
  const pl3 = await prisma.plotLine.create({
    data: {
      userId,
      bookId,
      title: '江湖恩怨',
      type: 'sub',
      status: 'planning',
      order: 2,
      synopsis: '正邪之争，魔教觊觎云隐录。',
    },
  });
  const pl4 = await prisma.plotLine.create({
    data: {
      userId,
      bookId,
      title: '儿女情长',
      type: 'sub',
      status: 'planning',
      order: 3,
      synopsis: '林逸风与苏婉儿的江湖情缘。',
    },
  });

  // 8. 创建 6 个剧情节点（分布在剧情线中）
  await prisma.plotPoint.create({
    data: {
      userId,
      bookId,
      plotLineId: pl1.id,
      title: '古卷下山',
      description: '林逸风奉师命携云隐录下山，江湖风波起。',
      chapterId: ch1.id,
      characterIds: [c1.id],
      order: 0,
      timelineOrder: 0,
    },
  });
  await prisma.plotPoint.create({
    data: {
      userId,
      bookId,
      plotLineId: pl1.id,
      title: '秘辛初现',
      description: '云隐录秘密初现，林逸风发现卷中暗藏玄机。',
      chapterId: ch5.id,
      characterIds: [c1.id, c3.id],
      order: 1,
      timelineOrder: 4,
    },
  });
  await prisma.plotPoint.create({
    data: {
      userId,
      bookId,
      plotLineId: pl2.id,
      title: '身世线索',
      description: '白鹿仙暗示林逸风身世，埋下伏笔。',
      chapterId: ch3.id,
      characterIds: [c1.id, c6.id],
      order: 0,
      timelineOrder: 2,
    },
  });
  await prisma.plotPoint.create({
    data: {
      userId,
      bookId,
      plotLineId: pl2.id,
      title: '真相大白',
      description: '林逸风得知白鹿仙为生父，身世之谜解开。',
      chapterId: ch5.id,
      characterIds: [c1.id, c6.id],
      order: 1,
      timelineOrder: 4,
    },
  });
  await prisma.plotPoint.create({
    data: {
      userId,
      bookId,
      plotLineId: pl3.id,
      title: '比武结仇',
      description: '洛阳武林大会，林逸风与魔教结下梁子。',
      chapterId: ch4.id,
      characterIds: [c1.id, c4.id],
      order: 0,
      timelineOrder: 3,
    },
  });
  await prisma.plotPoint.create({
    data: {
      userId,
      bookId,
      plotLineId: pl4.id,
      title: '客栈初遇',
      description: '林逸风与苏婉儿相遇于悦来客栈。',
      chapterId: ch2.id,
      characterIds: [c1.id, c2.id],
      order: 0,
      timelineOrder: 1,
    },
  });

  // 9. 创建 6 个伏笔（3 paidoff + 2 planted + 1 pending）
  await prisma.foreshadowing.create({
    data: {
      userId,
      bookId,
      title: '师父遗言',
      description: '师父临终所言"切不可落入歹人之手"，暗示云隐录的重要性。',
      setupChapterId: ch1.id,
      payoffChapterId: ch5.id,
      status: 'paidoff',
    },
  });
  await prisma.foreshadowing.create({
    data: {
      userId,
      bookId,
      title: '银针暗示',
      description: '苏婉儿手中的银针，暗示其医道世家身份。',
      setupChapterId: ch2.id,
      payoffChapterId: ch3.id,
      status: 'paidoff',
    },
  });
  await prisma.foreshadowing.create({
    data: {
      userId,
      bookId,
      title: '白鹿仙身份',
      description: '白鹿仙对林逸风的特殊关照，暗示父子关系。',
      setupChapterId: ch3.id,
      payoffChapterId: ch5.id,
      status: 'paidoff',
    },
  });
  await prisma.foreshadowing.create({
    data: {
      userId,
      bookId,
      title: '魔教暗探',
      description: '客栈中的神秘食客，实为魔教暗探，为后续追逐埋线。',
      setupChapterId: ch2.id,
      status: 'planted',
    },
  });
  await prisma.foreshadowing.create({
    data: {
      userId,
      bookId,
      title: '古卷残页',
      description: '云隐录中夹有一张残页，记载上古秘辛，尚未揭晓。',
      setupChapterId: ch1.id,
      status: 'planted',
    },
  });
  await prisma.foreshadowing.create({
    data: {
      userId,
      bookId,
      title: '终极对决',
      description: '林逸风与墨无痕的宿命之战，尚未展开。',
      status: 'pending',
    },
  });

  // 10. 创建 6 个场景（含氛围标签）
  await prisma.scene.create({
    data: {
      userId,
      bookId,
      name: '云隐山下山',
      description: '清晨云隐山，薄雾缭绕，林逸风下山场景。',
      atmosphere: ['清晨', '薄雾', '清冷'],
      geography: '云隐山',
      worldviewEntryIds: [wv1.id],
      characterIds: [c1.id],
      chapterIds: [ch1.id],
    },
  });
  await prisma.scene.create({
    data: {
      userId,
      bookId,
      name: '悦来客栈夜',
      description: '洛阳城外悦来客栈，灯火通明，江湖人物齐聚。',
      atmosphere: ['热闹', '温暖', '嘈杂'],
      geography: '洛阳城',
      worldviewEntryIds: [wv2.id],
      characterIds: [c1.id, c2.id, c5.id],
      chapterIds: [ch2.id],
    },
  });
  await prisma.scene.create({
    data: {
      userId,
      bookId,
      name: '洛阳比武台',
      description: '武林大会比武台，旌旗招展，群豪云集。',
      atmosphere: ['紧张', '热血', '喧嚣'],
      geography: '洛阳城',
      worldviewEntryIds: [wv2.id, wv4.id],
      characterIds: [c1.id, c4.id],
      chapterIds: [ch4.id],
    },
  });
  await prisma.scene.create({
    data: {
      userId,
      bookId,
      name: '魔教总坛',
      description: '幽冥教总坛，阴森可怖，机关重重。',
      atmosphere: ['阴森', '压抑', '危险'],
      geography: '幽冥崖',
      worldviewEntryIds: [wv5.id],
      characterIds: [c4.id],
    },
  });
  await prisma.scene.create({
    data: {
      userId,
      bookId,
      name: '江南水乡夜',
      description: '月色下的江南水乡，扁舟摇曳，柔情似水。',
      atmosphere: ['宁静', '柔情', '月色'],
      geography: '江南',
      worldviewEntryIds: [wv3.id],
      characterIds: [c1.id, c2.id],
    },
  });
  await prisma.scene.create({
    data: {
      userId,
      bookId,
      name: '云隐山顶',
      description: '云隐山之巅，云海翻涌，决战之地。',
      atmosphere: ['壮阔', '肃穆', '决绝'],
      geography: '云隐山',
      worldviewEntryIds: [wv1.id],
      characterIds: [c1.id, c4.id, c6.id],
      chapterIds: [ch7.id],
    },
  });

  // 11. 创建 7 条灵感（武侠创作灵感）
  await prisma.inspiration.create({
    data: {
      userId,
      bookId,
      title: '武侠三要素',
      content: '侠、武、情——武侠小说三大核心。侠为魂，武为骨，情为血肉。',
      tags: ['武侠', '创作心得'],
      category: '方法论',
    },
  });
  await prisma.inspiration.create({
    data: {
      userId,
      bookId,
      title: '反派塑造',
      content:
        '好的反派不是纯粹的恶，而是有自己的信念与执念。墨无痕的野心源于对江湖秩序的反抗。',
      tags: ['反派', '人物塑造'],
      category: '人物',
    },
  });
  await prisma.inspiration.create({
    data: {
      userId,
      bookId,
      title: '伏笔设计',
      content:
        '伏笔要自然，如春风化雨。师父遗言、银针暗示、白鹿仙身份，皆在前期不经意处埋下。',
      tags: ['伏笔', '结构'],
      category: '结构',
    },
  });
  await prisma.inspiration.create({
    data: {
      userId,
      bookId,
      title: '江湖地理',
      content:
        '江湖要有地理感。云隐山、洛阳城、江南水乡，三地构成故事的空间骨架。',
      tags: ['世界观', '地理'],
      category: '世界观',
    },
  });
  await prisma.inspiration.create({
    data: {
      userId,
      bookId,
      title: '武打描写',
      content:
        '武打重在气势而非招式。以环境、心理、节奏烘托，方能写出有韵味的打斗。',
      tags: ['武打', '写作技巧'],
      category: '技巧',
    },
  });
  await prisma.inspiration.create({
    data: {
      userId,
      bookId,
      title: '情感线索',
      content:
        '儿女情长不宜喧宾夺主。林逸风与苏婉儿的感情线应如暗流，于江湖主线中自然流淌。',
      tags: ['情感', '支线'],
      category: '结构',
    },
  });
  await prisma.inspiration.create({
    data: {
      userId,
      bookId,
      title: '结局构思',
      content:
        '结局要有余味。归隐不是逃避，而是阅尽沧桑后的选择。云隐山下的少年，最终回归云隐山。',
      tags: ['结局', '主题'],
      category: '主题',
    },
  });

  // 12. 创建 30 天写作日志（模拟热力图数据，随机字数 0-3000）
  const dates = recentDates(30);
  const writingLogs = dates.map((date) => ({
    userId,
    bookId,
    date,
    wordCount: randInt(3000),
    duration: 0,
  }));
  await prisma.writingLog.createMany({ data: writingLogs });

  return bookId;
}
