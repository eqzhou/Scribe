/**
 * Scribe · 种子数据注入
 *
 * 依据 PRD 第 7.2 节注入示例武侠小说《云隐录》的完整种子数据。
 * 素材取自 HTML 原型《Scribe-Novel-Crafting.html》。
 *
 * 数据范围：
 * - 作品 1 部
 * - 世界观 6 条（地理 3 + 势力 2 + 体系 1）
 * - 角色 6 个 + 关系 5 条
 * - 剧情线 4 条（主 2 + 支 2）+ 剧情节点 6 个
 * - 伏笔 6 个（paidoff 3 + planted 2 + pending 1）
 * - 场景 6 个
 * - 卷宗 3 个 + 章节 8 个（done 5 + writing 1 + draft 1 + archived 1）
 * - 灵感 7 条
 * - 写作日志 30 天模拟数据
 */
import type {
  Book,
  WorldviewEntry,
  Character,
  CharacterRelation,
  PlotLine,
  PlotPoint,
  Foreshadowing,
  Scene,
  Volume,
  Chapter,
  Inspiration,
  WritingLog,
} from '../types';
import { db } from './db';
import {
  bookRepository,
  worldviewRepository,
  characterRepository,
  relationRepository,
  plotLineRepository,
  plotPointRepository,
  foreshadowingRepository,
  sceneRepository,
  volumeRepository,
  chapterRepository,
  inspirationRepository,
  writingLogRepository,
} from './repositories';

/**
 * 注入《云隐录》种子数据。
 *
 * 幂等：若数据库中已存在作品，则跳过注入。
 */
export async function seedData(): Promise<void> {
  // 检查是否已有数据，避免重复注入
  const count = await db.books.count();
  if (count > 0) return;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const bookId = 'book-yunyin';

  /* ====================================================================== */
  /* 一、作品                                                                */
  /* ====================================================================== */
  const book: Book = {
    id: bookId,
    title: '云隐录',
    subtitle: '一剑光寒十九州',
    synopsis:
      '孤剑客沈云舟身世成谜，幼年所佩玉佩暗藏前朝秘辛。为寻真相，他踏遍九州，卷入一场跨越两代人的江湖阴谋。',
    genre: '武侠',
    targetWords: 500000,
    coverColor: '#3d4a3d',
    dailyGoal: 3000,
    createdAt: now - 30 * dayMs,
    updatedAt: now,
  };

  /* ====================================================================== */
  /* 二、世界观（地理 3 + 势力 2 + 体系 1）                                  */
  /* ====================================================================== */
  const worldviews: WorldviewEntry[] = [
    {
      id: 'wv-kunlun',
      bookId,
      category: 'geography',
      title: '昆仑雪顶',
      content:
        '<p>昆仑雪顶终年积雪，云海翻涌如银涛。山巅有古祭坛一座，传为前朝铸剑宗师淬剑之所。雪顶之下藏有冰窟，窟中寒气可封剑意，非内力深厚者不可入。</p>',
      tags: ['极北', '雪域', '铸剑圣地'],
      relatedCharacterIds: ['char-liu'],
      relatedSceneIds: ['sc-kunlun'],
      createdAt: now - 29 * dayMs,
      updatedAt: now - 5 * dayMs,
    },
    {
      id: 'wv-linan',
      bookId,
      category: 'geography',
      title: '临安城',
      content:
        '<p>临安依江而建，商贾云集，乃江南第一繁华地。城北铁匠巷炉火彻夜不熄，城南临江有听雨楼，凭栏可观钱塘潮信。皇城偏西，朝堂与江湖在此交汇，暗流涌动。</p>',
      tags: ['江南', '都城', '江湖枢纽'],
      relatedCharacterIds: ['char-shen', 'char-qin', 'char-su'],
      relatedSceneIds: ['sc-tingyu', 'sc-tiejiang'],
      createdAt: now - 29 * dayMs,
      updatedAt: now - 6 * dayMs,
    },
    {
      id: 'wv-yandang',
      bookId,
      category: 'geography',
      title: '雁荡山',
      content:
        '<p>雁荡山居东海之滨，峰奇谷幽，云雾常年不散。山中有多处剑痕遗迹，传为前辈高人论剑所留。后山有一断崖，崖壁上刻有半阙歌谣，风化难辨，沈云舟幼年曾随师父至此。</p>',
      tags: ['东南', '剑痕', '师徒旧地'],
      relatedCharacterIds: ['char-shen', 'char-qin', 'char-liu'],
      relatedSceneIds: ['sc-yandang'],
      createdAt: now - 28 * dayMs,
      updatedAt: now - 4 * dayMs,
    },
    {
      id: 'wv-tingyu',
      bookId,
      category: 'faction',
      title: '听雨楼',
      content:
        '<p>听雨楼名义上是临安城南的一座茶楼，实为江南最大的情报组织。楼主苏挽青，年少继位，手段圆融。听雨楼耳目遍布九州，凡江湖风吹草动，三日之内必达楼主案前。楼中设"雨前""雨后"两档消息，价高者得。</p>',
      tags: ['情报组织', '茶楼', '江南'],
      relatedCharacterIds: ['char-su', 'char-shen'],
      relatedSceneIds: ['sc-tingyu'],
      createdAt: now - 28 * dayMs,
      updatedAt: now - 3 * dayMs,
    },
    {
      id: 'wv-yaowang',
      bookId,
      category: 'faction',
      title: '药王谷',
      content:
        '<p>药王谷隐于群山之间，谷主陆九渊医术通神，号称"生死人肉白骨"。谷中植百草，有一株千年雪参，为续命圣药。药王谷立有祖训：救人不论正邪，只问缘法。故江湖中人纵是仇敌，亦不敢轻犯药王谷。</p>',
      tags: ['医道', '隐世', '中立'],
      relatedCharacterIds: ['char-lu', 'char-shen'],
      relatedSceneIds: ['sc-yaowang'],
      createdAt: now - 27 * dayMs,
      updatedAt: now - 4 * dayMs,
    },
    {
      id: 'wv-wuxue',
      bookId,
      category: 'system',
      title: '武学体系',
      content:
        '<p>天下武学，分"意""气""形"三境。形境练招，气境练劲，意境练心。寻常武人终其一生止于气境；意境者，可借天地之势，一念成剑。沈云舟所修"孤寒剑法"，乃意境之路，以心寒剑，剑出无情。血衣侯所练"血河魔功"，走气境极途，以血养劲，刚猛霸道。</p>',
      tags: ['武学境界', '剑法', '心法'],
      relatedCharacterIds: ['char-shen', 'char-qin', 'char-xiao'],
      relatedSceneIds: [],
      createdAt: now - 27 * dayMs,
      updatedAt: now - 2 * dayMs,
    },
  ];

  /* ====================================================================== */
  /* 三、角色（6 个）                                                        */
  /* ====================================================================== */
  const characters: Character[] = [
    {
      id: 'char-shen',
      bookId,
      name: '沈云舟',
      alias: '孤寒剑客',
      faction: '游侠',
      role: 'protagonist',
      appearance:
        '青衫落拓，眉目清冷，腰间一柄无名长剑，剑鞘霜白。左腕常年缠一缕褪色红绳，系着幼时所佩玉佩。',
      personality: '外冷内热，寡言重诺。对师恩执念极深，对旧识留三分情面，对仇敌则剑出无悔。',
      background:
        '临安城北铁匠巷长大，幼年由师父秦墨白抚养。十七岁那年师父自雁荡归来，留下一柄剑、一枚玉佩与一个秘密后不知所踪。沈云舟自此仗剑寻真，踏遍九州。',
      arc: '由孤剑客成长为能担江湖兴亡之意境剑修，最终于黄泉道第七废寺直面两代恩怨。',
      age: 21,
      appearanceColor: '#3d4a3d',
      tags: ['主角', '剑修', '孤寒剑法', '意境'],
      createdAt: now - 28 * dayMs,
      updatedAt: now - 3 * dayMs,
    },
    {
      id: 'char-su',
      bookId,
      name: '苏挽青',
      alias: '听雨楼主',
      faction: '听雨楼',
      role: 'supporting',
      appearance:
        '素衣如雪，发间一支白玉簪。眉眼温婉，笑意却不达眼底。腕上常悬一枚旧护身符，不知何人所赠。',
      personality: '八面玲珑，心思缜密。重旧情却以大局为先，能于笑语间布下杀招。',
      background:
        '听雨楼前任楼主之女，十八岁继位。与秦墨白有旧识之谊，故对沈云舟多有照拂。其护身符来历成谜，似与一桩旧案相关。',
      arc: '由情报旁观者逐步入局，在朝堂与江湖的夹缝中抉择立场。',
      age: 24,
      appearanceColor: '#7a8ca0',
      tags: ['配角', '情报', '听雨楼', '护身符'],
      createdAt: now - 28 * dayMs,
      updatedAt: now - 3 * dayMs,
    },
    {
      id: 'char-xiao',
      bookId,
      name: '萧无咎',
      alias: '血衣侯',
      faction: '朝堂',
      role: 'antagonist',
      appearance:
        '玄色大氅，肩头落雪不化。左肩有一道弯月形旧疤，贯穿肩胛。面容冷峻，眼底常带血色。',
      personality: '城府极深，心狠手辣。然于旧伤发作之夜，独坐废寺，似有难言之痛。',
      background:
        '前朝遗孤，幼年流落民间，后入朝堂掌权。练"血河魔功"，以血养劲。二十年前与秦墨白曾有一战，胜负未明。',
      arc: '由幕后黑手逐步现身，与沈云舟于黄泉道了断两代恩怨。',
      age: 45,
      appearanceColor: '#7a2e2e',
      tags: ['反派', '血衣侯', '血河魔功', '前朝遗孤'],
      createdAt: now - 27 * dayMs,
      updatedAt: now - 2 * dayMs,
    },
    {
      id: 'char-lu',
      bookId,
      name: '陆九渊',
      alias: '药王',
      faction: '药王谷',
      role: 'supporting',
      appearance:
        '布衣芒鞋，须发半白，腰间悬一只药葫芦。掌心常年染着草药青汁，笑起来眼角堆叠细纹。',
      personality: '豁达仁厚，救人不论正邪。唯独对祖训执拗，宁折不让。',
      background:
        '药王谷第三十七代谷主，医术通神。曾救沈云舟于重伤之际，结下救命之恩。其与秦墨白亦有旧约，未尽之言藏于千年雪参之中。',
      arc: '于沈云舟命悬一线时出手相救，并以雪参点破半桩旧案。',
      age: 60,
      appearanceColor: '#5a7a4a',
      tags: ['配角', '医道', '药王谷', '救命之恩'],
      createdAt: now - 27 * dayMs,
      updatedAt: now - 4 * dayMs,
    },
    {
      id: 'char-liu',
      bookId,
      name: '柳听雪',
      alias: '雪山传人',
      faction: '昆仑',
      role: 'supporting',
      appearance:
        '白衣胜雪，眉间一点朱砂。背一柄长剑，剑穗结着冰晶，行走间寒气微生。',
      personality: '清冷孤傲，外疏内热。对故人念旧，对俗事淡漠。',
      background:
        '昆仑雪顶剑修传人，与沈云舟幼年曾于雁荡有一面之缘。其剑法承自昆仑一脉，与"孤寒剑法"或有同源之妙。',
      arc: '于昆仑雪顶指引沈云舟参悟意境，并点破雁荡剑痕之秘。',
      age: 22,
      appearanceColor: '#a0b8d0',
      tags: ['配角', '昆仑', '剑修', '旧识'],
      createdAt: now - 26 * dayMs,
      updatedAt: now - 4 * dayMs,
    },
    {
      id: 'char-qin',
      bookId,
      name: '秦墨白',
      alias: '剑隐',
      faction: '游侠',
      role: 'supporting',
      appearance:
        '灰布长衫，须发已斑。腰间一柄"残月"剑，剑身有裂纹一道，似曾重铸。',
      personality: '沉稳寡言，心怀旧债。对沈云舟严而不厉，爱而不纵。',
      background:
        '沈云舟之师，二十年前与"那个人"决战于黄泉道第七废寺，传闻葬身火海。所留遗剑"残月"载有"残月斩"一式，专为破萧无咎左肩旧伤而生。',
      arc: '虽身陨火海，遗剑与歌谣却成为贯穿全书的暗线，最终由弟子了断旧债。',
      age: 50,
      appearanceColor: '#6a6a6a',
      tags: ['配角', '引导者', '师徒', '残月剑'],
      createdAt: now - 26 * dayMs,
      updatedAt: now - 10 * dayMs,
    },
  ];

  /* ====================================================================== */
  /* 四、角色关系（5 条）                                                    */
  /* ====================================================================== */
  const relations: CharacterRelation[] = [
    {
      id: 'rel-1',
      bookId,
      fromId: 'char-qin',
      toId: 'char-shen',
      type: 'mentor',
      description: '师徒。秦墨白抚养沈云舟长大，授以孤寒剑法，留遗剑"残月"与玉佩。',
    },
    {
      id: 'rel-2',
      bookId,
      fromId: 'char-shen',
      toId: 'char-su',
      type: 'friend',
      description: '知己。彼此试探又彼此援手，于江湖风雨中互为后盾。',
    },
    {
      id: 'rel-3',
      bookId,
      fromId: 'char-shen',
      toId: 'char-xiao',
      type: 'rival',
      description: '宿敌。两代恩怨纠葛，终须于黄泉道第七废寺了断。',
    },
    {
      id: 'rel-4',
      bookId,
      fromId: 'char-shen',
      toId: 'char-liu',
      type: 'friend',
      description: '旧识。幼年雁荡一面之缘，昆仑重逢后引为同道。',
    },
    {
      id: 'rel-5',
      bookId,
      fromId: 'char-su',
      toId: 'char-qin',
      type: 'other',
      description: '旧识。听雨楼与秦墨白有未明之谊，护身符或与其相关。',
    },
  ];

  /* ====================================================================== */
  /* 五、剧情线（主 2 + 支 2）与剧情节点（6 个）                            */
  /* ====================================================================== */
  const plotLines: PlotLine[] = [
    {
      id: 'pl-yupei',
      bookId,
      title: '玉佩之谜·寻身世',
      type: 'main',
      synopsis:
        '沈云舟幼年所佩玉佩暗藏前朝秘辛，裂纹渐现之际，身世之谜亦逐步揭开。终局指向黄泉道第七废寺。',
      status: 'writing',
      order: 1,
    },
    {
      id: 'pl-xueyi',
      bookId,
      title: '血衣侯·朝堂风云',
      type: 'main',
      synopsis:
        '血衣侯萧无咎搅动朝堂与江湖，以血河魔功震慑九州。其与秦墨白旧战未明，是沈云舟寻真路上最大阻碍。',
      status: 'writing',
      order: 2,
    },
    {
      id: 'pl-tingyu',
      bookId,
      title: '听雨楼·情报暗战',
      type: 'sub',
      synopsis:
        '听雨楼主苏挽青游走于黑白之间，以情报换情报。护身符之谜与朝堂暗战交织，为沈云舟提供关键线索。',
      status: 'planning',
      order: 3,
    },
    {
      id: 'pl-yaowang',
      bookId,
      title: '药王谷·救命之恩',
      type: 'sub',
      synopsis:
        '沈云舟重伤求医药王谷，陆九渊以雪参续命，并点破半桩旧案。救命之恩背后藏着与秦墨白的旧约。',
      status: 'planning',
      order: 4,
    },
  ];

  const plotPoints: PlotPoint[] = [
    {
      id: 'pp-1',
      bookId,
      plotLineId: 'pl-yupei',
      title: '玉佩现裂痕',
      description:
        '铁匠巷炉火之夜，玉佩无故生裂，显出半阙歌谣。沈云舟初觉身世有异，决意离家寻真。',
      chapterId: 'ch-1',
      characterIds: ['char-shen', 'char-qin'],
      order: 1,
      timelineOrder: 1,
    },
    {
      id: 'pp-2',
      bookId,
      plotLineId: 'pl-yupei',
      title: '师父遗剑重现',
      description:
        '黄泉道废寺中，"残月"剑自行鸣颤，剑谱"残月斩"应势而生，直指萧无咎左肩旧伤。',
      chapterId: 'ch-48',
      characterIds: ['char-shen', 'char-qin', 'char-xiao'],
      order: 2,
      timelineOrder: 5,
    },
    {
      id: 'pp-3',
      bookId,
      plotLineId: 'pl-xueyi',
      title: '血衣侯夜入临安',
      description:
        '萧无咎深夜潜入临安，血河魔功震慑江湖。听雨楼探得其行踪，沈云舟初窥宿敌真容。',
      characterIds: ['char-shen', 'char-xiao', 'char-su'],
      order: 1,
      timelineOrder: 2,
    },
    {
      id: 'pp-4',
      bookId,
      plotLineId: 'pl-tingyu',
      title: '听雨楼暗传消息',
      description:
        '苏挽青以"雨前"消息示沈云舟，暗中递出护身符线索，朝堂暗战初露端倪。',
      characterIds: ['char-su', 'char-shen'],
      order: 1,
      timelineOrder: 3,
    },
    {
      id: 'pp-5',
      bookId,
      plotLineId: 'pl-yaowang',
      title: '药王谷求医',
      description:
        '沈云舟重伤入药王谷，陆九渊以雪参续命，并点破与秦墨白的旧约，身世之谜再添一层。',
      chapterId: 'ch-12',
      characterIds: ['char-shen', 'char-lu'],
      order: 1,
      timelineOrder: 4,
    },
    {
      id: 'pp-6',
      bookId,
      plotLineId: 'pl-yupei',
      title: '黄泉道决战',
      description:
        '第七废寺风雪夜，沈云舟与萧无咎相对而立，二十年的恩怨与一具凉透的旧时光，皆须在此了断。',
      chapterId: 'ch-48',
      characterIds: ['char-shen', 'char-xiao', 'char-qin'],
      order: 3,
      timelineOrder: 6,
    },
  ];

  /* ====================================================================== */
  /* 六、伏笔（paidoff 3 + planted 2 + pending 1）                          */
  /* ====================================================================== */
  const foreshadowings: Foreshadowing[] = [
    {
      id: 'fs-yupei',
      bookId,
      title: '玉佩裂纹',
      description:
        '幼年所佩玉佩无故生裂，显出半阙歌谣。此裂纹暗藏前朝秘辛，歌谣唯师徒二人知晓。',
      setupChapterId: 'ch-1',
      payoffChapterId: 'ch-48',
      status: 'paidoff',
    },
    {
      id: 'fs-yijian',
      bookId,
      title: '师父遗剑',
      description:
        '秦墨白所留"残月"剑，剑身有重铸之纹，剑谱载有"残月斩"一式，专为破某肩而生。',
      setupChapterId: 'ch-1',
      payoffChapterId: 'ch-48',
      status: 'paidoff',
    },
    {
      id: 'fs-chuanfu',
      bookId,
      title: '忘川渡船夫',
      description:
        '忘川渡口老船夫曾赠沈云舟一句谶语，言"第七寺中等故人"。其身份疑与秦墨白旧识相关。',
      setupChapterId: 'ch-1',
      payoffChapterId: 'ch-48',
      status: 'paidoff',
    },
    {
      id: 'fs-hushen',
      bookId,
      title: '苏挽青的护身符',
      description:
        '苏挽青腕上旧护身符，来历不明，似与秦墨白及一桩朝堂旧案相关，将在后续章节揭晓。',
      setupChapterId: 'ch-1',
      status: 'planted',
    },
    {
      id: 'fs-jiushang',
      bookId,
      title: '血衣侯的旧伤',
      description:
        '萧无咎左肩弯月形旧疤，每逢雪夜发作。此伤与"残月斩"暗合，伏笔已埋，待回收。',
      setupChapterId: 'ch-48',
      status: 'planted',
    },
    {
      id: 'fs-jianhen',
      bookId,
      title: '雁荡山的剑痕',
      description:
        '雁荡后山断崖上有半阙歌谣与剑痕，风化难辨，待沈云舟重游故地时埋设。',
      status: 'pending',
    },
  ];

  /* ====================================================================== */
  /* 七、场景（6 个）                                                        */
  /* ====================================================================== */
  const scenes: Scene[] = [
    {
      id: 'sc-tingyu',
      bookId,
      name: '听雨楼',
      description:
        '临安城南临江茶楼，三层木构，凭栏可观钱塘潮信。楼内隔间众多，暗藏机括，乃江南第一情报枢纽。',
      atmosphere: ['雅致', '暗流', '江雨'],
      geography: 'wv-linan',
      worldviewEntryIds: ['wv-linan', 'wv-tingyu'],
      characterIds: ['char-su', 'char-shen'],
      chapterIds: ['ch-3'],
    },
    {
      id: 'sc-tiejiang',
      bookId,
      name: '铁匠巷',
      description:
        '临安城北一条窄巷，炉火映红半条街，锤声自天明响到天黑。沈家剑铺即坐落于此，是沈云舟成长之地。',
      atmosphere: ['烟火', '炉火', '市井'],
      geography: 'wv-linan',
      worldviewEntryIds: ['wv-linan'],
      characterIds: ['char-shen', 'char-qin'],
      chapterIds: ['ch-1'],
    },
    {
      id: 'sc-yaowang',
      bookId,
      name: '药王谷',
      description:
        '群山环抱的隐谷，谷中百草丰茂，雾气常生。谷主居所"百草堂"前有一株千年雪参，寒气逼人。',
      atmosphere: ['清幽', '药香', '雾气'],
      worldviewEntryIds: ['wv-yaowang'],
      characterIds: ['char-lu', 'char-shen'],
      chapterIds: ['ch-12'],
    },
    {
      id: 'sc-huangquan',
      bookId,
      name: '黄泉道废寺',
      description:
        '黄泉道旁十八废寺之第七寺，破门残垣，经卷满地。二十年前秦墨白与"那个人"决战之地，风雪灌入，火光摇曳。',
      atmosphere: ['肃杀', '风雪', '残破', '宿命'],
      worldviewEntryIds: [],
      characterIds: ['char-shen', 'char-xiao', 'char-qin'],
      chapterIds: ['ch-48'],
    },
    {
      id: 'sc-kunlun',
      bookId,
      name: '昆仑雪顶',
      description:
        '极北雪域之巅，云海翻涌，古祭坛立于风雪之中。雪顶之下冰窟寒气可封剑意，非内力深厚者不可入。',
      atmosphere: ['凛冽', '孤高', '云海'],
      geography: 'wv-kunlun',
      worldviewEntryIds: ['wv-kunlun'],
      characterIds: ['char-liu'],
      chapterIds: [],
    },
    {
      id: 'sc-yandang',
      bookId,
      name: '雁荡后山',
      description:
        '东海之滨的奇峰幽谷，云雾常年不散。后山断崖上有半阙歌谣与剑痕遗迹，沈云舟幼年曾随师父至此。',
      atmosphere: ['幽秘', '云雾', '怀旧'],
      geography: 'wv-yandang',
      worldviewEntryIds: ['wv-yandang'],
      characterIds: ['char-shen', 'char-qin', 'char-liu'],
      chapterIds: ['ch-30'],
    },
  ];

  /* ====================================================================== */
  /* 八、卷宗（3 个）                                                        */
  /* ====================================================================== */
  const volumes: Volume[] = [
    { id: 'vol-1', bookId, title: '第一卷 · 临安风雪', order: 1 },
    { id: 'vol-2', bookId, title: '第二卷 · 江湖夜雨', order: 2 },
    { id: 'vol-3', bookId, title: '第三卷 · 黄泉道', order: 3 },
  ];

  /* ====================================================================== */
  /* 九、章节（8 个：done 5 + writing 1 + draft 1 + archived 1）            */
  /* ====================================================================== */
  const ch1Content =
    '<h2>少年与剑</h2>\n' +
    '<p>临安城北，铁匠巷。炉火映红了半条巷子，锤声叮咚，自天明响到天黑。沈家剑铺的少年沈云舟，正是在这样的锤声里，长到了十七岁。</p>\n' +
    '<p>那一年的雪，比往年都大。师父秦墨白自雁荡山归来，带了一柄剑、一枚玉佩，和一个不能说的秘密。</p>';

  const ch48Content =
    '<h2>风雪夜归人</h2>\n' +
    '<div class="subtitle">第三卷 · 黄泉道 · 第四十八章</div>\n' +
    '<p>朔风卷雪，自雁荡一路向北，愈近黄泉道，天色愈沉。沈云舟牵马行于道旁，肩头已积了寸许厚的雪，那柄"孤寒"剑斜挂腰间，剑鞘上的霜花结了又化，化了又结。</p>\n' +
    '<p>他已在风雪中走了三日。三日前，他收到一封信——信上无署名，仅画着一枚开裂的玉佩，与半阙他幼时听师父唱过的歌谣。这首歌谣，世上只有两个人知道。一个是他，一个是早已葬身火海的师父秦墨白。</p>\n' +
    '<blockquote>所谓江湖，不过是旧债新仇，一笔笔记在风雪里。等雪化了，账也该清了。</blockquote>\n' +
    '<p>第七座废寺的轮廓在风雪中若隐若现。沈云舟勒住马，眉头微蹙。他记得师父曾说过，黄泉道旁十八废寺，每一寺都藏着一段江湖旧事，而第七寺，正是当年师父与"那个人"决战之地。</p>\n' +
    '<p>他推门而入。寺中火光一闪，竟已有人先到。那人背对他立于佛前，身着玄色大氅，肩头落满残雪。听见门响，那人并未回头，只低低笑了一声。</p>\n' +
    '<p>"你来了。"那声音苍老而疲惫，却带着一种说不出的熟悉，"二十年了，沈家的人，终究还是踏进了这座寺。"</p>\n' +
    '<p>沈云舟的手按上了剑柄。火光摇曳中，他看清了那人左肩——一道旧疤横贯肩头，形如弯月。他心中一震：师父遗剑的剑谱中，曾载有一式"残月斩"，专为破此肩而生。</p>\n' +
    '<p>风雪自破门灌入，卷起满地经卷。两人相对而立，中间隔着二十年的恩怨，与一具早已凉透的旧时光。</p>';

  const chapters: Chapter[] = [
    {
      id: 'ch-1',
      bookId,
      volumeId: 'vol-1',
      title: '第1章 少年与剑',
      content: ch1Content,
      summary: '铁匠巷炉火夜，玉佩生裂显歌谣，沈云舟初觉身世有异，决意离家寻真。',
      status: 'done',
      wordCount: 96,
      order: 1,
      createdAt: now - 29 * dayMs,
      updatedAt: now - 2 * dayMs,
    },
    {
      id: 'ch-2',
      bookId,
      volumeId: 'vol-1',
      title: '第2章 玉佩现',
      content: '',
      summary: '玉佩裂纹渐深，沈云舟于师父遗物中寻得半截剑谱，初闻"残月斩"之名。',
      status: 'done',
      wordCount: 3210,
      order: 2,
      createdAt: now - 27 * dayMs,
      updatedAt: now - 4 * dayMs,
    },
    {
      id: 'ch-3',
      bookId,
      volumeId: 'vol-1',
      title: '第3章 听雨楼（旧稿）',
      content: '',
      summary: '旧稿，初入听雨楼见苏挽青。因视角与节奏问题已归档，将以新章重写。',
      status: 'archived',
      wordCount: 2840,
      order: 3,
      createdAt: now - 26 * dayMs,
      updatedAt: now - 15 * dayMs,
    },
    {
      id: 'ch-12',
      bookId,
      volumeId: 'vol-2',
      title: '第12章 药王谷',
      content: '',
      summary: '沈云舟重伤入药王谷，陆九渊以雪参续命，点破与秦墨白的旧约。',
      status: 'done',
      wordCount: 3560,
      order: 12,
      createdAt: now - 22 * dayMs,
      updatedAt: now - 6 * dayMs,
    },
    {
      id: 'ch-25',
      bookId,
      volumeId: 'vol-2',
      title: '第25章 血衣侯',
      content: '',
      summary: '萧无咎夜入临安，血河魔功震慑江湖。沈云舟初窥宿敌真容，与之短兵相接。',
      status: 'writing',
      wordCount: 1820,
      order: 25,
      createdAt: now - 18 * dayMs,
      updatedAt: now - 1 * dayMs,
    },
    {
      id: 'ch-30',
      bookId,
      volumeId: 'vol-2',
      title: '第30章 雁荡剑痕',
      content: '',
      summary: '沈云舟重游雁荡后山，断崖剑痕与半阙歌谣浮现，身世之谜再添一层。',
      status: 'draft',
      wordCount: 0,
      order: 30,
      createdAt: now - 15 * dayMs,
      updatedAt: now - 15 * dayMs,
    },
    {
      id: 'ch-40',
      bookId,
      volumeId: 'vol-3',
      title: '第40章 旧识重逢',
      content: '',
      summary: '昆仑雪顶柳听雪指引意境，护身符线索浮现，沈云舟决意北上黄泉道。',
      status: 'done',
      wordCount: 3120,
      order: 40,
      createdAt: now - 10 * dayMs,
      updatedAt: now - 3 * dayMs,
    },
    {
      id: 'ch-48',
      bookId,
      volumeId: 'vol-3',
      title: '第48章 风雪夜归人',
      content: ch48Content,
      summary: '黄泉道第七废寺风雪夜，沈云舟与萧无咎相对而立，二十年恩怨须在此了断。',
      status: 'done',
      wordCount: 823,
      order: 48,
      createdAt: now - 5 * dayMs,
      updatedAt: now - 1 * dayMs,
    },
  ];

  /* ====================================================================== */
  /* 十、灵感（7 条）                                                        */
  /* ====================================================================== */
  const inspirations: Inspiration[] = [
    {
      id: 'ins-1',
      bookId,
      title: '剑名"孤寒"',
      content:
        '剑名"孤寒"，取自"高处不胜寒"。剑出无情，非心冷，而是心定。沈云舟的剑，是舍了退路之后的决绝。',
      tags: ['剑', '意象', '人物'],
      category: '设定',
      createdAt: now - 20 * dayMs,
    },
    {
      id: 'ins-2',
      bookId,
      title: '黄泉道十八废寺',
      content:
        '黄泉道旁十八废寺，每一寺藏一段江湖旧事。第七寺为决战之地，可作全书收束之锚。其余废寺留作支线伏笔。',
      tags: ['地理', '伏笔', '收束'],
      category: '设定',
      createdAt: now - 18 * dayMs,
    },
    {
      id: 'ins-3',
      bookId,
      title: '玉佩歌谣残句',
      content:
        '"雪满长安道，月残第七寺。故人持旧剑，来清旧时账。"——师徒二人独知的歌谣，可作为认亲与决战的暗号。',
      tags: ['伏笔', '台词', '歌谣'],
      category: '台词',
      createdAt: now - 16 * dayMs,
    },
    {
      id: 'ins-4',
      bookId,
      title: '苏挽青的气质',
      content:
        '素衣白簪，笑不达眼底。她是江南烟雨里最冷的一滴——温润其表，锋锐其内。护身符是她唯一的破绽。',
      tags: ['人物', '气质'],
      category: '人物',
      createdAt: now - 14 * dayMs,
    },
    {
      id: 'ins-5',
      bookId,
      title: '雁荡雪景描写',
      content:
        '雁荡云雾常年不散，雪后更如墨染宣纸。断崖剑痕覆薄冰，指尖一触，寒意直透腕骨。可作重游故地的开篇画面。',
      tags: ['场景', '描写', '雪'],
      category: '场景',
      createdAt: now - 12 * dayMs,
    },
    {
      id: 'ins-6',
      bookId,
      title: '血衣侯旧伤设定',
      content:
        '左肩弯月疤，雪夜发作。此伤与"残月斩"暗合，是萧无咎唯一的命门。发作时他独坐废寺，似有悔意，又似只是痛。',
      tags: ['人物', '伏笔', '命门'],
      category: '人物',
      createdAt: now - 9 * dayMs,
    },
    {
      id: 'ins-7',
      bookId,
      title: '铁匠巷的炉火',
      content:
        '炉火映红半条巷，锤声叮咚自天明到天黑。这是沈云舟的底色——他出身烟火，却走向风雪。开篇与终章可形成对照。',
      tags: ['场景', '氛围', '对照'],
      category: '场景',
      createdAt: now - 7 * dayMs,
    },
  ];

  /* ====================================================================== */
  /* 十一、写作日志（最近 30 天，每日均有记录，用于热力图展示）             */
  /* ====================================================================== */
  // 确定性伪随机：保证种子数据可复现
  let seedRand = 20240101;
  const rand = (): number => {
    seedRand = (seedRand * 1103515245 + 12345) & 0x7fffffff;
    return seedRand / 0x7fffffff;
  };

  const writingLogs: WritingLog[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * dayMs);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    // 每日均有写作记录：周末字数偏多（2000~4500），工作日偏少（200~2800）
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const wordCount = isWeekend
      ? Math.floor(2000 + rand() * 2500)
      : Math.floor(200 + rand() * 2600);
    writingLogs.push({
      id: `log-${dateStr}`,
      bookId,
      date: dateStr,
      wordCount,
      duration: Math.floor(wordCount / 8), // 约每秒 8 字
      createdAt: now - i * dayMs,
    });
  }

  /* ====================================================================== */
  /* 十二、批量注入                                                          */
  /* ====================================================================== */
  await bookRepository.bulkCreate([book]);
  await worldviewRepository.bulkCreate(worldviews);
  await characterRepository.bulkCreate(characters);
  await relationRepository.bulkCreate(relations);
  await plotLineRepository.bulkCreate(plotLines);
  await plotPointRepository.bulkCreate(plotPoints);
  await foreshadowingRepository.bulkCreate(foreshadowings);
  await sceneRepository.bulkCreate(scenes);
  await volumeRepository.bulkCreate(volumes);
  await chapterRepository.bulkCreate(chapters);
  await inspirationRepository.bulkCreate(inspirations);
  await writingLogRepository.bulkCreate(writingLogs);
}
