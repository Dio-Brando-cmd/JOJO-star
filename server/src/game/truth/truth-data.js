// ============================================================
// 真相盘 —— 静态数据表
// 真神池（8 位）、契约池（6 条）、任务名、净化点区域、默认数值。
// 全部为「结构化数据」：真神决定机制参数，碎片用 clueTexts 组合，
// 因此无需手写剧本，规则生成器即可无限产出不同对局。
// ============================================================

// ---- 真神池（每位神 = 一条特殊规则 + 一个净化条件 + 一组线索词汇）----
export const GODS = [
  {
    id: 'harvest', name: '丰收之神', icon: '🌾',
    rule: '所有资源（灵焰/绝望）获取效率 +50%',
    purify: '灵焰上限提升至 120（需多攒 20）',
    clueTags: ['丰饶', '生长', '腐熟'],
    clueTexts: [
      '你看见缝隙里疯长的藤蔓，结出的果实在腐烂前就已经被啃食。',
      '空气里有谷物成熟的气味，混着腐败的甜腻。',
      '地上的血泊里，有什么东西在缓慢发芽。',
    ],
    mechanic: { resourceMultiplier: 1.5, extraSpiritCost: 20 },
  },
  {
    id: 'war', name: '战争之神', icon: '⚔️',
    rule: '献祭不涨绝望（战争豁免杀戮），但死亡造成的绝望 ×2',
    purify: '净化点每 30 秒游走到相邻区域',
    clueTags: ['兵刃', '号角', '仇恨'],
    clueTexts: [
      '你听见远处有战鼓在响，节奏像心跳，又像磨刀。',
      '残破的兵刃插在地上，刃口还沾着没干的血。',
      '仇恨在这里被反复打磨，越磨越亮。',
    ],
    mechanic: { sacrificeRaisesDespair: false, deathDespairMultiplier: 2, purifyPointWanders: true },
  },
  {
    id: 'oblivion', name: '遗忘之神', icon: '🌫️',
    rule: '每有 1 人死亡，全体存活者随机丢失 1 张碎片',
    purify: '执行净化时需同时持有 ≥3 张该神真碎片',
    clueTags: ['空白', '丢失', '淡去'],
    clueTexts: [
      '你想念某个名字，却怎么也想不起它的发音。',
      '墙上的刻痕正在一点点变淡，像有人擦掉了它。',
      '你记得自己曾在这里失去过什么，但不记得是什么了。',
    ],
    mechanic: { loseShardOnDeath: true, requiredTrueShards: 3 },
  },
  {
    id: 'weaver', name: '纺织之神', icon: '🧵',
    rule: '地图被丝线切成若干区，随时间连通区减少',
    purify: '净化点位于当前「线头」区，位置半随机',
    clueTags: ['丝线', '经纬', '切割'],
    clueTexts: [
      '你看见帷幕的裂缝边，有细密的丝线在缓慢收紧。',
      '脚下有几乎看不见的丝，把地面切成一块一块。',
      '有什么东西在织，织的不是布，是边界。',
    ],
    mechanic: { purifyZoneSemiRandom: true },
  },
  {
    id: 'tide', name: '潮汐之神', icon: '🌊',
    rule: '每 90 秒某区域被淹没封锁，随后解封',
    purify: '净化必须在退潮窗口内完成',
    clueTags: ['潮汐', '咸味', '水痕'],
    clueTexts: [
      '你闻到海水的咸味，虽然这里离海很远。',
      '地上有退潮后留下的水痕，一圈一圈。',
      '有什么东西周期性地涌来，又周期性地退去。',
    ],
    mechanic: { purifyNeedsEbb: true },
  },
  {
    id: 'liar', name: '谎言之神', icon: '🎭',
    rule: '伪碎片数量 ×2，且真碎片在 UI 上显示「可疑」',
    purify: '净化前必须先焚烧 1 张伪碎片作为验证',
    clueTags: ['真假', '倒影', '两面'],
    clueTexts: [
      '你听到一个声音在说真话，但听起来像谎言。',
      '你看见自己的倒影，先你一步眨了眨眼。',
      '这里每句真话都藏着半句假话。',
    ],
    mechanic: { falseFragmentMultiplier: 2, realShardMarkedSuspicious: true, requiresBurnFalse: true },
  },
  {
    id: 'silence', name: '静默之神', icon: '🔇',
    rule: '全局/私聊频率受限',
    purify: '净化需 2 名灵焰方同时在场',
    clueTags: ['静默', '低语', '噤声'],
    clueTexts: [
      '四周突然安静下来，静得能听见自己的骨头在响。',
      '有人想说话，但声音被什么东西吞掉了。',
      '你听见帷幕深处有低语，却听不清一个词。',
    ],
    mechanic: { purifyNeedsTwo: true },
  },
  {
    id: 'ash', name: '灰烬之神', icon: '💀',
    rule: '死者身份与死因不公开，尸体被灰烬掩盖',
    purify: '净化点不可见，只能靠碎片线索定位',
    clueTags: ['灰烬', '无面', '掩盖'],
    clueTexts: [
      '地上有焚烧过的痕迹，灰里混着辨认不出的骨。',
      '你看见一具尸体，但它的脸被灰抹平了。',
      '所有被烧过的东西，都失去了原来的样子。',
    ],
    mechanic: { deathInfoHidden: true, purifyPointHidden: true },
  },
];

export const GOD_MAP = Object.fromEntries(GODS.map((g) => [g.id, g]));

// ---- 阵营与子角色 ----
export const TEAM_SPIRIT = 'spirit';       // 灵焰方
export const TEAM_CORRUPTED = 'corrupted'; // 食神者方
export const CORRUPTED_ROLE = '食神者';
export const SPIRIT_SUBROLES = ['灵焰', '生存', '守幕者'];

// ---- 契约池（个人计分，不影响阵营胜负）----
export const CONTRACTS = [
  { id: 'survivor',    name: '存活者', icon: '🕊️', desc: '活到对局结束',             points: 30 },
  { id: 'purifier',    name: '净化者', icon: '🔥', desc: '亲手执行净化仪式',         points: 40 },
  { id: 'oracle',      name: '真知者', icon: '👁️', desc: '终局前公开猜对真神',       points: 50 },
  { id: 'guardian',    name: '守护者', icon: '🛡️', desc: '指定角色存活到终局',       points: 25 },
  { id: 'sacrificer',  name: '献祭者', icon: '🗡️', desc: '亲手献祭至少 1 人',        points: 20 },
  { id: 'fatebreaker', name: '逆命者', icon: '🌀', desc: '隐藏转世身份，真神揭晓时公开真名', points: 50 },
];
export const CONTRACT_MAP = Object.fromEntries(CONTRACTS.map((c) => [c.id, c]));

// ---- 任务名（可复用，非每局剧本）----
export const TASK_NAMES = [
  '灵焰灯台', '帷幕碑文', '记忆井', '献祭灶台',
  '丝线纺车', '退潮闸门', '灰烬火盆', '静默钟',
];

// ---- 净化点所在区域（抽象分区，用于地点判定）----
export const ZONES = ['北垣', '南垣', '东垣', '西垣', '中庭', '深殿'];

// ---- 默认数值（v0.1 初稿，标 ⚠️ 处待实机调参）----
export const DEFAULT_CONFIG = {
  playerCount: 8,
  corruptedCount: 2,          // 食神者数量
  trueFragments: 6,           // 真碎片基准数
  falseFragments: 3,          // 伪碎片基准数（谎言之神 ×2）
  taskCount: 8,
  contractsPerPlayer: 1,

  // 命运时钟
  spiritMax: 100,             // ⚠️ 灵焰上限
  despairMax: 100,            // ⚠️ 绝望上限
  phase2Despair: 50,          // ⚠️ 阶段2阈值（守幕者解锁枪）
  phase3Despair: 75,          // ⚠️ 阶段3阈值（灵焰可烧帷幕）
  sacrificeDespair: 25,       // ⚠️ 献祭一次涨的绝望
  deathDespair: 10,           // ⚠️ 死亡一次涨的绝望
  taskFailDespair: 5,         // ⚠️ 灵焰任务失败涨的绝望
  taskSpirit: 15,             // ⚠️ 完成任务给的灵焰
  correctSacrificeSpirit: 20, // ⚠️ 献祭对食神者给的灵焰
  wrongSacrificeSpiritPenalty: 10, // ⚠️ 误献祭好人的灵焰惩罚
  deathSpiritLoss: 5,         // ⚠️ 每死亡 1 人的灵焰损耗
  burnVeilSpiritCost: 30,       // ⚠️ 灵焰烧帷幕消耗的灵焰
  burnVeilDespairReduction: 20, // ⚠️ 烧帷幕降低的绝望
  veilConsumeIntervalSec: 90, // 帷幕吞噬节奏
  veilConsumeMax: 5,          // 帷幕吞噬上限（吞完只剩核心区）
  requiredSacrificesForCorruptedWin: 3, // 食神者献祭灵焰方达到此数即胜
};
