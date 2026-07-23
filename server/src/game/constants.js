// ============================================================
// 帷幕之地游戏常量定义 — v2.0 角色升级版
// 新增：角色子类型、灵织者名字池、特质系统、神话标记、扩展能力
// ============================================================

// ---- 角色定义 ----
export const ROLES = {
  CORRUPTED: 'CORRUPTED',           // 蚀者
  NETHER_MONK: 'NETHER_MONK',       // 冥僧人
  VEIL_SCHOLAR: 'VEIL_SCHOLAR',                   // 帷幕学者
  HERBAL_SAGE: 'HERBAL_SAGE',   // 草药学者（蚀灭符）
  SPIRIT_MENDER: 'SPIRIT_MENDER',       // 愈灵师（灵焰修复）
  SPIRIT_WEAVER: 'SPIRIT_WEAVER',           // 灵织者
  VEIL_GUARDIAN: 'VEIL_GUARDIAN',                 // 守卫
  FLAME_TRACKER: 'FLAME_TRACKER',               // 猎人
};

// ---- 灵织者子类型（每个灵织者有独特定位） ----
export const SPIRIT_WEAVER_TYPES = {
  OLD_VETERAN: 'OLD_VETERAN',       // 老兵灵织者 — 直觉敏锐，有概率识别蚀者
  WANDERING_TRADER: 'WANDERING_TRADER',           // 行路灵织者 — 可访问2个屋子，信息灵通
  SPIRIT_APPRENTICE: 'SPIRIT_APPRENTICE',         // 学徒灵织者 — 可简单治疗，推迟死亡1回合
  CHRONICLER: 'CHRONICLER',     // 记述灵织者 — 讨论发言时间翻倍
  NIGHT_SENTINEL: 'NIGHT_SENTINEL', // 守夜灵织者 — 察觉门外经过者
  HEARTH_KEEPER: 'HEARTH_KEEPER',                 // 炊火灵织者 — 人缘好，知道更多人的行踪
  ARMOR_SMITH: 'ARMOR_SMITH',       // 锻甲灵织者 — 力大，可强化自家门锁
  VEIL_WEAVER: 'VEIL_WEAVER',               // 织幕灵织者 — 心思缜密，帷幕低语线索更精确
};

// 灵织者名字池（编号 → 名字+背景）
export const SPIRIT_WEAVER_NAMES = {
  1: {
    name: '老杰克',
    title: '暮色老兵',
    weaverType: SPIRIT_WEAVER_TYPES.OLD_VETERAN,
    backstory: '年轻时是名震一方的猎人，如今年事已高，但那份猎人的直觉从未消失。他的屋子里挂满了年轻时的战利品。',
    trait: '直觉敏锐 — 有概率识破进入自家的蚀者',
    quote: '"我可能老了，但这双眼睛，还看得清谁被蚀痕沾染。"',
  },
  2: {
    name: '玛丽安',
    title: '行路灵织者',
    weaverType: SPIRIT_WEAVER_TYPES.WANDERING_TRADER,
    backstory: '走南闯北的商人，帷幕之地的每条小路都刻在她脑子里。她认识所有人，也知道所有人的秘密。',
    trait: '消息灵通 — 每晚可访问2个屋子',
    quote: '"在这个村子里，灵焰的频率比武器更可靠。"',
  },
  3: {
    name: '艾米丽',
    title: '学徒灵织者',
    weaverType: SPIRIT_WEAVER_TYPES.SPIRIT_APPRENTICE,
    backstory: '继承了祖母留下的灵符绘制，虽然医术比不上真正的女巫，但她的草药足够帮人撑过最难熬的夜晚。',
    trait: '医术入门 — 可推迟目标死亡1回合',
    quote: '"大自然给了我们一切解药，只是大多数人不知道去哪里找。"',
  },
  4: {
    name: '托马斯',
    title: '记述灵织者',
    weaverType: SPIRIT_WEAVER_TYPES.CHRONICLER,
    backstory: '曾是宫廷的吟游诗人，因讲了一个不该讲的故事被流放到帷幕之地。他的舌头比刀子更锋利。',
    trait: '能言善辩 — 聚落会议发言时间翻倍，可额外发言一次',
    quote: '"给我三分钟，我能让蚀者自己走出庇护所。"',
  },
  5: {
    name: '卡莱布',
    title: '守夜灵织者',
    weaverType: SPIRIT_WEAVER_TYPES.NIGHT_SENTINEL,
    backstory: '曾是城防军的哨兵，在城墙上度过了无数个不眠之夜。如今他把这份警觉带到了暮色村。',
    trait: '警惕性高 — 可察觉门外经过的人',
    quote: '"黑暗里的一切动静，都逃不过我的耳朵。"',
  },
  6: {
    name: '艾拉',
    title: '炊火灵织者',
    weaverType: SPIRIT_WEAVER_TYPES.HEARTH_KEEPER,
    backstory: '村里唯一的烘焙师，每天清晨升起第一缕炊烟的人。所有人都来她这里买面包，所以她也听到了所有的闲言碎语。',
    trait: '人缘好 — 知道更多人的夜晚去向',
    quote: '"最好的情报来源？当然是排队买面包的队伍。"',
  },
  7: {
    name: '老彼得',
    title: '锻甲灵织者',
    weaverType: SPIRIT_WEAVER_TYPES.ARMOR_SMITH,
    backstory: '打了一辈子铁，两条手臂像树干一样粗壮。他的铁锤不仅能锻铁，也能敲碎骨头。',
    trait: '力大无穷 — 可加固自家门锁，抵御一次蚀者噬灵',
    quote: '"我的门，比某些人的胆子还硬。"',
  },
  8: {
    name: '莉莉安',
    title: '织幕灵织者',
    weaverType: SPIRIT_WEAVER_TYPES.VEIL_WEAVER,
    backstory: '安静寡言的纺织女，手指在织机上飞舞时，耳朵却能捕捉到最细微的声响。她不说，但她都记得。',
    trait: '心思缜密 — 帷幕低语线索更精确（排除干扰项）',
    quote: '"每一根线都有它的去向，每一个人也是。"',
  },
};

// ---- 角色阵营 ----
export const TEAMS = {
  CORRUPTED: 'CORRUPTED',       // 蚀者阵营
  VEIL_KEEPERS: 'VEIL_KEEPERS', // 守幕者阵营
};

// 每个角色所属阵营
export const ROLE_TEAM = {
  [ROLES.CORRUPTED]: TEAMS.CORRUPTED,
  [ROLES.NETHER_MONK]: TEAMS.CORRUPTED,
  [ROLES.VEIL_SCHOLAR]: TEAMS.VEIL_KEEPERS,
  [ROLES.HERBAL_SAGE]: TEAMS.VEIL_KEEPERS,
  [ROLES.SPIRIT_MENDER]: TEAMS.VEIL_KEEPERS,
  [ROLES.SPIRIT_WEAVER]: TEAMS.VEIL_KEEPERS,
  [ROLES.VEIL_GUARDIAN]: TEAMS.VEIL_KEEPERS,
  [ROLES.FLAME_TRACKER]: TEAMS.VEIL_KEEPERS,
};

// 角色中文名
export const ROLE_NAMES = {
  [ROLES.CORRUPTED]: '蚀者',
  [ROLES.NETHER_MONK]: '冥僧人',
  [ROLES.VEIL_SCHOLAR]: '帷幕学者',
  [ROLES.HERBAL_SAGE]: '草药学者',
  [ROLES.SPIRIT_MENDER]: '愈灵师',
  [ROLES.SPIRIT_WEAVER]: '灵织者',
  [ROLES.VEIL_GUARDIAN]: '帷幕守卫',
  [ROLES.FLAME_TRACKER]: '灵痕追猎者',
};

// 角色图标
export const ROLE_ICONS = {
  [ROLES.CORRUPTED]: '🌑',
  [ROLES.NETHER_MONK]: '🕯️',
  [ROLES.VEIL_SCHOLAR]: '👁️',
  [ROLES.HERBAL_SAGE]: '🌿📜',
  [ROLES.SPIRIT_MENDER]: '💫',
  [ROLES.SPIRIT_WEAVER]: '🧵',
  [ROLES.VEIL_GUARDIAN]: '🛡️✨',
  [ROLES.FLAME_TRACKER]: '🎯',
};

// ---- 角色能力描述（扩展版） ----
export const ROLE_ABILITY_DESCRIPTIONS = {
  [ROLES.CORRUPTED]: {
    primary: '噬灵',
    secondary: ['灵痕感知', '裂隙共鸣召集', '灵焰遮蔽'],
    passive: '蚀者同伴相认：去另一蚀者庇护所则双方相认',
  },
  [ROLES.NETHER_MONK]: {
    primary: '蚀变 / 堕化 / 噬灵',
    secondary: ['裂隙引导', '灵焰遮蔽编织'],
    passive: '未蚀变时帷幕学者察灵为好人；堕化帷幕学者结果反转',
  },
  [ROLES.VEIL_SCHOLAR]: {
    primary: '察灵辨蚀',
    secondary: ['梦境碎片', '公开察灵', '灵视'],
    passive: '察灵后白昼可看目标灵焰颜色',
  },
  [ROLES.HERBAL_SAGE]: {
    primary: '蚀灭符（灭门）+ 灵符愈灵',
    secondary: ['蚀雾符阵', '抗蚀体质', '蚀痕净化配方'],
    passive: '帷幕守卫灵蚀重伤时草药学者获知',
  },
  [ROLES.SPIRIT_MENDER]: {
    primary: '灵焰修复 + 单目标蚀痕净化',
    secondary: ['战场急救', '灵符绘制', '诊断'],
    passive: '唯一能治疗灵蚀重伤的角色',
  },
  [ROLES.VEIL_GUARDIAN]: {
    primary: '守护',
    secondary: ['壁垒筑造', '巡逻', '舍身'],
    passive: '重伤机制：≤2人被攻→重伤挡刀；独自被袭→重伤暴露',
  },
  [ROLES.FLAME_TRACKER]: {
    primary: '灵焰猎枪追猎 + 噬灭短铳反击 + 白天开枪',
    secondary: ['复仇', '陷阱射击'],
    passive: '第二晚起才能行动；同晚出门+开枪不冲突',
  },
  [ROLES.SPIRIT_WEAVER]: {
    primary: '出门观察 + 帷幕低语',
    secondary: ['按灵织者类型不同的特技'],
    passive: '在所有专业守幕者和蚀者之后行动',
  },
};

// ---- 游戏阶段 ----
export const PHASES = {
  LOBBY: 'LOBBY',
  NIGHT: 'NIGHT',
  DAY: 'DAY',
  VOTE: 'VOTE',
  DISCUSSION: 'DISCUSSION',
  GAME_OVER: 'GAME_OVER',
  // 新增阶段
  CHARACTER_SELECT: 'CHARACTER_SELECT', // 表层身份选择阶段
  PROLOGUE: 'PROLOGUE',                 // 背景叙事序幕
};

// 夜晚子步骤
export const NIGHT_STEPS = {
  FLAME_TRACKER: 'FLAME_TRACKER',
  NETHER_MONK: 'NETHER_MONK',
  VEIL_GUARDIAN: 'VEIL_GUARDIAN',
  CORRUPTED: 'CORRUPTED',
  VEIL_SCHOLAR: 'VEIL_SCHOLAR',
  HERBAL_SAGE: 'HERBAL_SAGE',
  SPIRIT_MENDER: 'SPIRIT_MENDER',
  SPIRIT_WEAVER: 'SPIRIT_WEAVER',
  RESOLUTION: 'RESOLUTION',
};

export const NIGHT_STEPS_NIGHT1 = [
  NIGHT_STEPS.NETHER_MONK,
  NIGHT_STEPS.VEIL_GUARDIAN,
  NIGHT_STEPS.CORRUPTED,
  NIGHT_STEPS.VEIL_SCHOLAR,
  NIGHT_STEPS.HERBAL_SAGE,
  NIGHT_STEPS.SPIRIT_MENDER,
  NIGHT_STEPS.SPIRIT_WEAVER,
  NIGHT_STEPS.RESOLUTION,
];

export const NIGHT_STEPS_FULL = [
  NIGHT_STEPS.FLAME_TRACKER,
  NIGHT_STEPS.NETHER_MONK,
  NIGHT_STEPS.VEIL_GUARDIAN,
  NIGHT_STEPS.CORRUPTED,
  NIGHT_STEPS.VEIL_SCHOLAR,
  NIGHT_STEPS.HERBAL_SAGE,
  NIGHT_STEPS.SPIRIT_MENDER,
  NIGHT_STEPS.SPIRIT_WEAVER,
  NIGHT_STEPS.RESOLUTION,
];

// ---- 夜晚行动选项（扩展版） ----
export const NIGHT_ACTIONS = {
  GO_OUT: 'GO_OUT',
  USE_ABILITY: 'USE_ABILITY',
  SLEEP: 'SLEEP',
  EAVESDROP: 'EAVESDROP',
  // 新增
  HOWL: 'HOWL',                   // 蚀者裂隙共鸣
  DISGUISE: 'DISGUISE',           // 蚀者灵焰遮蔽
  PUBLIC_PROPHECY: 'PUBLIC_PROPHECY', // 帷幕学者公开察灵
  SPIRIT_VISION: 'SPIRIT_VISION',     // 帷幕学者灵视
  CORROSION_MIST: 'CORROSION_MIST',           // 草药学者蚀雾符阵
  BATTLEFIELD_AID: 'BATTLEFIELD_AID', // 愈灵师战场急救
  DIAGNOSE: 'DIAGNOSE',               // 愈灵师诊断
  PATROL: 'PATROL',                   // 守卫巡逻
  FORTIFY: 'FORTIFY',                 // 守卫壁垒筑造
  SACRIFICE: 'SACRIFICE',             // 帷幕守卫舍身誓言
  TRAP_SET: 'TRAP_SET',               // 猎人陷阱射击 / 老兵灵织者陷阱
  REVENGE: 'REVENGE',                 // 猎人复仇
  TRADE_INFO: 'TRADE_INFO',           // 商人灵织者交易信息
  HERBAL_REMEDY: 'HERBAL_REMEDY',     // 学徒灵织者草药
  NIGHT_WATCH: 'NIGHT_WATCH',         // 守夜灵织者守夜
  FORTIFY_DOOR: 'FORTIFY_DOOR',       // 锻甲灵织者加固门锁
  TELL_STORY: 'TELL_STORY',           // 记述灵织者讲故事
};

// ---- 冥僧人能力 ----
export const ALPHA_ACTIONS = {
  TRANSFORM: 'TRANSFORM',
  INFECT: 'INFECT',
  KILL: 'KILL',
  FAKE_IDENTITY: 'FAKE_IDENTITY',   // 灵焰遮蔽编织
  PACK_HORMONE: 'PACK_HORMONE',     // 裂隙引导（被动）
};

// ---- 猎人武器 ----
export const HUNTER_WEAPONS = {
  RIFLE: 'RIFLE',
  BLUNDERBUSS: 'BLUNDERBUSS',
};

// ---- 角色分类 ----
export const MOVE_TYPES = {
  FREE: 'FREE',
  RESTRICTED: 'RESTRICTED',
};

export const NOT_COUNT_IN_HOUSE = [ROLES.CORRUPTED, ROLES.NETHER_MONK];
export const FREE_MOVERS = [ROLES.FLAME_TRACKER, ROLES.CORRUPTED, ROLES.NETHER_MONK, ROLES.VEIL_GUARDIAN];

// ---- 外在特质类型 ----
export const TRAIT_TYPES = {
  ACTIVE: 'ACTIVE',       // 主动使用的能力
  PASSIVE: 'PASSIVE',     // 被动生效的增益
  WEAKNESS: 'WEAKNESS',   // 负面弱点
  SURVIVAL: 'SURVIVAL',   // 影响存活判定
  SOCIAL: 'SOCIAL',       // 影响讨论/投票的能力
};

// ---- 表层身份定义（第二步使用） ----
// 神话来源标记
export const MYTH_ORIGINS = {
  NORSE: '铁森林边陲',
  CELTIC: '黑森林深处',
  GREEK: '古战场废墟',
  EGYPTIAN: '沙海之畔',
  ROMAN: '旧帝国遗址',
  EASTERN: '雾隐禅寺',
  FOLK: '帷幕之地',
  // 新增原始出处
  WILD: '铁森林荒野',
  MOUNTAIN: '永冬山脉',
  LAB: '学徒灵织者行会故地',
  ASH: '灰烬高地',
  VEIL: '帷幕裂隙',
  MINE: '矿脉山脉',
  BONE: '骨灰平原',
  PLAINS: '平原驿站',
  TOWER: '观测塔废墟',
};

// 表层身份定义（第二步完整实现）
export const CHARACTER_IDENTITIES = {
  SIGURD: {
    id: 'SIGURD',
    name: '西格德',
    title: '维京老战士',
    origin: MYTH_ORIGINS.NORSE,
    gender: 'male',
    story: '曾参与诸神黄昏最后一战的老兵，在战场上倒下后被帷幕带到此地。他的剑已锈蚀，但战士之魂不灭。',
    externalTraits: [
      {
        name: '老兵之躯',
        type: TRAIT_TYPES.SURVIVAL,
        effect: '受到致命伤时有15%概率重伤而非死亡',
        icon: '💪',
      },
      {
        name: '莽撞',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '夜晚出门时必然留下踪迹，可被其他玩家追踪',
        icon: '👣',
      },
      {
        name: '战吼',
        type: TRAIT_TYPES.ACTIVE,
        effect: '白天讨论阶段可以打断一次别人的发言',
        icon: '📢',
      },
    ],
    recommendedHiddenRoles: ['HUNTER', 'GUARD'],
  },
  FREYJA: {
    id: 'FREYJA',
    name: '芙蕾雅',
    title: '华纳末裔',
    origin: MYTH_ORIGINS.NORSE,
    gender: 'female',
    story: '华纳神族最后的血脉，精通草药与毒术。为追寻在诸神黄昏中失踪的爱人来到帷幕之地，却发现这里的秘密比想象中更加黑暗。',
    externalTraits: [
      {
        name: '纤弱',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '被蚀者噬灵时无法自行逃脱（QTE难度大幅提高）',
        icon: '🦴',
      },
      {
        name: '魅惑之声',
        type: TRAIT_TYPES.SOCIAL,
        effect: '讨论时发言，所有玩家必须听完（不能被房主跳过）',
        icon: '🎵',
      },
      {
        name: '草药学',
        type: TRAIT_TYPES.PASSIVE,
        effect: '被治疗后恢复速度+20%',
        icon: '🌿',
      },
    ],
    recommendedHiddenRoles: ['POISON_WITCH', 'HEAL_WITCH'],
  },
  MORRIGAN: {
    id: 'MORRIGAN',
    name: '莫莉安',
    title: '最后的德鲁伊',
    origin: MYTH_ORIGINS.CELTIC,
    gender: 'female',
    story: '凯尔特德鲁伊教的最后传人。当罗马的铁蹄踏平了圣林，她带着圣树的种子逃到了帷幕之地。这里的土地认得古老的力量。',
    externalTraits: [
      {
        name: '自然亲和',
        type: TRAIT_TYPES.PASSIVE,
        effect: '在室外移动速度+10%，在室内-5%',
        icon: '🌳',
      },
      {
        name: '圣树种子',
        type: TRAIT_TYPES.ACTIVE,
        effect: '可在某屋子种下圣树标记，获知谁进入过该屋',
        icon: '🌱',
      },
      {
        name: '异教徒',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '被投票时额外计入0.5票（向下取整）',
        icon: '⚠️',
      },
    ],
    recommendedHiddenRoles: ['HEAL_WITCH', 'SEER'],
  },
  ANUBIS_ACOLYTE: {
    id: 'ANUBIS_ACOLYTE',
    name: '卡赫特',
    title: '冥界侍僧',
    origin: MYTH_ORIGINS.EGYPTIAN,
    gender: 'male',
    story: '曾是阿努比斯神庙的侍僧，负责在亡者心脏与玛亚特羽毛之间宣读审判结果。因看到了不该看的真相——某个法老被偷换了心脏——而被流放。',
    externalTraits: [
      {
        name: '冥界视觉',
        type: TRAIT_TYPES.PASSIVE,
        effect: '察灵类能力准确率+20%（对帷幕学者/猎人观察）',
        icon: '👁️',
      },
      {
        name: '审判之词',
        type: TRAIT_TYPES.ACTIVE,
        effect: '投票时可公开自己投了谁（其他人投票仍是匿名）',
        icon: '⚖️',
      },
      {
        name: '被放逐者',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '当被投票出局时，不能发遗言',
        icon: '🔇',
      },
    ],
    recommendedHiddenRoles: ['SEER', 'HUNTER'],
  },
  HECTOR: {
    id: 'HECTOR',
    name: '赫克托',
    title: '特洛伊之盾',
    origin: MYTH_ORIGINS.GREEK,
    gender: 'male',
    story: '特洛伊城最强的英雄，为守护城池与阿喀琉斯决战而死。命运三女神给了他第二次机会——在帷幕之地，他还能继续守护他人。',
    externalTraits: [
      {
        name: '英雄之躯',
        type: TRAIT_TYPES.SURVIVAL,
        effect: '被蚀者噬灵时，若处于守护姿态，有25%概率不受重伤',
        icon: '🛡️',
      },
      {
        name: '荣誉枷锁',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '不能投票给已知的守幕者阵营玩家',
        icon: '⛓️',
      },
      {
        name: '守护誓言',
        type: TRAIT_TYPES.ACTIVE,
        effect: '白天可公开宣誓守护某玩家（如果该玩家当晚死亡，赫克托获得一次额外投票权）',
        icon: '🤝',
      },
    ],
    recommendedHiddenRoles: ['GUARD', 'HUNTER'],
  },
  ROMULUS: {
    id: 'ROMULUS',
    name: '罗慕路斯',
    title: '狼养之子',
    origin: MYTH_ORIGINS.ROMAN,
    gender: 'male',
    story: '传说中由母狼养大的罗马聚落导师。在他体内，人性与狼性从未停止过争斗。帷幕之地的月亮，总让他听到血液中狼的呼唤。',
    externalTraits: [
      {
        name: '双重血统',
        type: TRAIT_TYPES.PASSIVE,
        effect: '无论里身份为何，始终能听到蚀者的裂隙共鸣（获知裂隙共鸣发生但不知是谁）',
        icon: '🌗',
      },
      {
        name: '狼之嗅觉',
        type: TRAIT_TYPES.PASSIVE,
        effect: '可感知附近是否有狼人出没（模糊方向）',
        icon: '👃',
      },
      {
        name: '月狂',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '满月夜晚（每3晚一次），夜晚行动有概率失控（随机移动）',
        icon: '🌕',
      },
    ],
    recommendedHiddenRoles: ['CORRUPTED', 'NETHER_MONK'],
  },
  FENRIR_KIN: {
    id: 'FENRIR_KIN',
    name: '哈尔瓦德',
    title: '魔狼血裔',
    origin: MYTH_ORIGINS.NORSE,
    gender: 'male',
    story: '巨狼芬里尔的后裔，血脉中流淌着吞噬一切的饥饿。他来到帷幕之地是为了寻找解除诅咒的方法——但每次月圆，诅咒就会变强一分。',
    externalTraits: [
      {
        name: '魔狼之血',
        type: TRAIT_TYPES.PASSIVE,
        effect: '击杀后恢复体力（3D模式下），连续击杀无惩罚',
        icon: '🩸',
      },
      {
        name: '远古诅咒',
        type: TRAIT_TYPES.ACTIVE,
        effect: '可变身为狼形态（移速+30%，但会被所有人看到）',
        icon: '🐺',
      },
      {
        name: '银之恐惧',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '被守卫壁垒筑造的屋子不能进入',
        icon: '🥈',
      },
    ],
    recommendedHiddenRoles: ['NETHER_MONK', 'CORRUPTED'],
  },
  SKADI: {
    id: 'SKADI',
    name: '斯卡蒂',
    title: '雪山猎手',
    origin: MYTH_ORIGINS.NORSE,
    gender: 'female',
    story: '冬之女神斯卡蒂的凡间女儿，在雪山中长大，弓术无人能及。父亲死于诸神黄昏后，她追猎每一个与诸神有关的人——直到帷幕将她困在这里。',
    externalTraits: [
      {
        name: '雪山之眼',
        type: TRAIT_TYPES.PASSIVE,
        effect: '雾夜/黑暗环境中视野不受影响',
        icon: '👁️',
      },
      {
        name: '猎手步伐',
        type: TRAIT_TYPES.PASSIVE,
        effect: '移动时脚步声减半',
        icon: '👟',
      },
      {
        name: '复仇执念',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '如果选择了复仇目标而目标存活超过3回合，失去1次投票权',
        icon: '💢',
      },
    ],
    recommendedHiddenRoles: ['HUNTER', 'VILLAGER'],
  },
  HAIKU_MONK: {
    id: 'HAIKU_MONK',
    name: '虚舟',
    title: '流浪僧人',
    origin: MYTH_ORIGINS.EASTERN,
    gender: 'male',
    story: '来自东方国度的行脚僧，用俳句记录世间百态。他的眼睛看过太多悲剧，所以选择沉默——但他的沉默里藏着最深的洞察。',
    externalTraits: [
      {
        name: '禅定',
        type: TRAIT_TYPES.PASSIVE,
        effect: '讨论阶段不发言时，投票准确率提示（直觉引导）',
        icon: '🧘',
      },
      {
        name: '俳句',
        type: TRAIT_TYPES.ACTIVE,
        effect: '每局限一次，可用三行俳句传递加密信息（全员可见）',
        icon: '📝',
      },
      {
        name: '戒律',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '不能主动投票给第一晚察灵出的狼人（需等待更多证据）',
        icon: '📿',
      },
    ],
    recommendedHiddenRoles: ['SEER', 'VILLAGER'],
  },
  BRIGID: {
    id: 'BRIGID',
    name: '布丽吉德',
    title: '圣火侍女',
    origin: MYTH_ORIGINS.CELTIC,
    gender: 'female',
    story: '凯尔特火焰女神布丽吉德的凡间侍女。在圣火熄灭的那一天，她被帷幕带到了这里。她相信只要重新点燃圣火，就能照亮所有真相。',
    externalTraits: [
      {
        name: '圣火',
        type: TRAIT_TYPES.ACTIVE,
        effect: '可点燃一屋子外的火把，该屋主当晚不能出门',
        icon: '🔥',
      },
      {
        name: '光明亲和',
        type: TRAIT_TYPES.PASSIVE,
        effect: '白天讨论阶段可以看到谁在说谎（概率提示）',
        icon: '✨',
      },
      {
        name: '火焰恐惧',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '被草药学者的蚀灭符锁定后无法移动',
        icon: '😰',
      },
    ],
    recommendedHiddenRoles: ['GUARD', 'VILLAGER'],
  },

  // ---- 新增: 5个原创角色 ----
  YSERA: {
    id: 'YSERA', name: '伊瑟尔', title: '暗影织网者',
    origin: MYTH_ORIGINS.VEIL, gender: 'female',
    story: '她曾是帷幕之地最出色的情报贩子。没有人见过她的真面目——她每次出现都以不同的面孔示人。有人说她曾在帷幕裂隙中看到了不该看的东西，从此隐入暗处。',
    externalTraits: [
      { name: '千面', type: TRAIT_TYPES.ACTIVE, effect: '讨论中可模仿他人语气发言，混淆视听', icon: '🎭' },
      { name: '情报网', type: TRAIT_TYPES.PASSIVE, effect: '夜晚可获知一名随机出门玩家的去向', icon: '🕸️' },
      { name: '暗影恐惧', type: TRAIT_TYPES.WEAKNESS, effect: '被直接目光注视(察灵)时，下一回合无法使用能力', icon: '👁️' },
    ],
    recommendedHiddenRoles: ['SEER', 'VILLAGER', 'HEAL_WITCH'],
  },
  GOREN: {
    id: 'GOREN', name: '格伦', title: '流浪锻甲灵织者',
    origin: MYTH_ORIGINS.MINE, gender: 'male',
    story: '帷幕之地最好的锻甲灵织者。他打造过猎人的枪管、守卫的盾牌、女巫的药瓶架。蚀痕蔓延后他把铁砧搬到了暮色村。"如果我的铁能救一个人，这把锤子就没白抡。"',
    externalTraits: [
      { name: '锻甲灵织者之力', type: TRAIT_TYPES.PASSIVE, effect: '加固自家门锁(抵御一次蚀者噬灵)。被投出局时可带走一名投票者', icon: '🔨' },
      { name: '自制装备', type: TRAIT_TYPES.ACTIVE, effect: '可打造一件临时护甲给他人(持续1晚)', icon: '⚒️' },
      { name: '笨重', type: TRAIT_TYPES.WEAKNESS, effect: '移动速度-10%，潜行等级-2', icon: '🏋️' },
    ],
    recommendedHiddenRoles: ['GUARD', 'HUNTER', 'VILLAGER'],
  },
  AILIN: {
    id: 'AILIN', name: '艾琳', title: '守墓人',
    origin: MYTH_ORIGINS.BONE, gender: 'female',
    story: '在骨灰平原守了二十年墓。她见过每一种死亡方式。死神没有教会她恐惧——教会了她平静。每晚坐在墓地边缘，等待新的死者入土。"我不是在等死亡——我是在等真相。"',
    externalTraits: [
      { name: '死亡感知', type: TRAIT_TYPES.PASSIVE, effect: '可感知濒死(被死亡标记)的玩家', icon: '🪦' },
      { name: '安魂仪式', type: TRAIT_TYPES.ACTIVE, effect: '可获知已死亡玩家的真实身份(限1次/局)', icon: '⚰️' },
      { name: '死亡亲和', type: TRAIT_TYPES.WEAKNESS, effect: '被投票出局时不能发遗言', icon: '💀' },
    ],
    recommendedHiddenRoles: ['SEER', 'POISON_WITCH', 'GUARD'],
  },
  ORIC: {
    id: 'ORIC', name: '奥里克', title: '疾风信使',
    origin: MYTH_ORIGINS.PLAINS, gender: 'male',
    story: '帷幕之地最快的跑者。在大瘟疫期间用双腿跑出了整个防疫网。现在他的速度成了对抗狼人最宝贵的资源——不管是传递信息、逃离危险、还是追捕狼人。',
    externalTraits: [
      { name: '疾风步', type: TRAIT_TYPES.PASSIVE, effect: '移动速度+20%，夜间可访问2个屋子', icon: '💨' },
      { name: '急件传递', type: TRAIT_TYPES.ACTIVE, effect: '可向一名玩家传递匿名加密消息(限1次/局)', icon: '📨' },
      { name: '耐力有限', type: TRAIT_TYPES.WEAKNESS, effect: '冲刺体力消耗+30%', icon: '🫁' },
    ],
    recommendedHiddenRoles: ['VILLAGER', 'HUNTER', 'GUARD'],
  },
  NELIA: {
    id: 'NELIA', name: '奈莉亚', title: '帷幕学者',
    origin: MYTH_ORIGINS.TOWER, gender: 'female',
    story: '在观测塔研究了三十年帷幕。她是唯一能"阅读"帷幕低语的人。她知道帷幕之外有什么——也知道帷幕正在变薄。来暮色村不是为了玩游戏——是为了找到最后的答案。',
    externalTraits: [
      { name: '帷幕低语', type: TRAIT_TYPES.PASSIVE, effect: '察灵类能力准确率+25%，但每次使用帷幕低语都会向狼人泄露一条模糊信息', icon: '🌌' },
      { name: '观测', type: TRAIT_TYPES.ACTIVE, effect: '可获知当前回合帷幕的"情绪"(随机事件预告)', icon: '🔭' },
      { name: '帷幕反噬', type: TRAIT_TYPES.WEAKNESS, effect: '使用能力后下一回合无法使用任何能力', icon: '⚡' },
    ],
    recommendedHiddenRoles: ['SEER', 'POISON_WITCH', 'HEAL_WITCH'],
  },
};

// ---- 预设角色配置 ----
export const ROLE_CONFIGS = {
  5: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.SPIRIT_MENDER, ROLES.SPIRIT_WEAVER],
  6: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  7: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  8: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  9: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  10: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  11: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  12: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  13: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  14: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  15: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  16: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  17: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
  18: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
};

export function getRoleConfig(playerCount) {
  return ROLE_CONFIGS[playerCount] || ROLE_CONFIGS[12];
}

// 获取灵织者名字（按编号循环分配）
export function getWeaverName(index) {
  const keys = Object.keys(SPIRIT_WEAVER_NAMES);
  const idx = ((index - 1) % keys.length) + 1;
  return SPIRIT_WEAVER_NAMES[idx] || SPIRIT_WEAVER_NAMES[1];
}

// 获取所有可选的表层身份
export function getCharacterIdentities() {
  return Object.values(CHARACTER_IDENTITIES);
}

// 根据里身份推荐表层身份
export function getRecommendedCharactersForRole(role) {
  return Object.values(CHARACTER_IDENTITIES).filter(
    char => char.recommendedHiddenRoles.includes(role)
  );
}

// ---- 灵格系统（Spirit Grade） ----
// 灵格是帷幕之地中衡量灵魂中诸神遗力显现程度的标尺
// 由德鲁伊莫莉安和冥界侍僧卡赫特共同创立
export const SPIRIT_GRADES = {
  MORTAL: 'MORTAL',         // 凡人之魂
  AWAKENED: 'AWAKENED',     // 觉醒之魂
  HEROIC: 'HEROIC',         // 英灵之魂
  DIVINE: 'DIVINE',         // 神遗之魂
  LEGENDARY: 'LEGENDARY',   // 传说之魂
};

export const SPIRIT_GRADE_NAMES = {
  MORTAL: '凡人之魂',
  AWAKENED: '觉醒之魂',
  HEROIC: '英灵之魂',
  DIVINE: '神遗之魂',
  LEGENDARY: '传说之魂',
};

export const SPIRIT_GRADE_ICONS = {
  MORTAL: '🕯️',
  AWAKENED: '🔥',
  HEROIC: '⚡',
  DIVINE: '✨',
  LEGENDARY: '🌟',
};

export const SPIRIT_GRADE_THRESHOLDS = {
  MORTAL:    { min: 0,    max: 999,  desc: '诸神的血脉在你体内沉寂。但每一个传说都始于凡人。' },
  AWAKENED:  { min: 1000, max: 1999, desc: '古老的力量开始苏醒。你隐约能感受到帷幕的呼吸。' },
  HEROIC:    { min: 2000, max: 3499, desc: '英灵的光辉在你身上显现。你已不再是普通的玩家。' },
  DIVINE:    { min: 3500, max: 5499, desc: '诸神的遗力在你血脉中奔涌。你的一举一动都牵动帷幕。' },
  LEGENDARY: { min: 5500, max: Infinity, desc: '传说之魂。你的名字将被刻在帷幕之地的石碑上。' },
};

// 灵格根据胜率、生存回合、贡献度综合计算
export const SPIRIT_GRADE_WEIGHTS = {
  WIN_RATE: 0.40,         // 胜率权重 40%
  SURVIVAL_RATE: 0.25,    // 生存率权重 25%
  CONTRIBUTION: 0.25,     // 贡献度权重 25%
  GAMES_PLAYED: 0.10,     // 场次权重 10%
};

// 每局灵格变化量（基于表现）
export const SPIRIT_GRADE_DELTA = {
  WIN: 25,
  LOSS: -15,
  MVP_BONUS: 10,
  SURVIVED_BONUS: 5,
  DISCONNECT_PENALTY: -30,
};

// ---- 排位段位 ----
export const RANKED_TIERS = {
  BRONZE: 'BRONZE', SILVER: 'SILVER', GOLD: 'GOLD',
  PLATINUM: 'PLATINUM', DIAMOND: 'DIAMOND', LEGEND: 'LEGEND',
};

export const RANKED_TIER_NAMES = {
  BRONZE: '青铜', SILVER: '白银', GOLD: '黄金',
  PLATINUM: '铂金', DIAMOND: '钻石', LEGEND: '传说',
};

export const RANKED_TIER_ICONS = {
  BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇',
  PLATINUM: '💎', DIAMOND: '👑', LEGEND: '🏆',
};

// ---- 匹配类型 ----
export const MATCH_TYPES = {
  CUSTOM: 'CUSTOM', QUICK: 'QUICK', RANKED: 'RANKED',
};

// ---- 游戏模式 (2.11.0) ----
export const GAME_MODES = {
  BOARD_GAME: 'BOARD_GAME',         // 经典桌游模式: 回合制夜晚/投票/发言
  THIRD_PERSON: 'THIRD_PERSON',     // 3D追逃模式: 自由移动/追逐/动作判定
};

export const GAME_MODE_NAMES = {
  BOARD_GAME: '经典桌游',
  THIRD_PERSON: '3D追逃',
};

export const GAME_MODE_DESCRIPTIONS = {
  BOARD_GAME: '回合制策略博弈——夜晚按顺序行动、白天讨论投票。经典帷幕之地桌游体验。',
  THIRD_PERSON: '3D非对称竞技——夜晚自由移动、追逐击杀、藏匿逃脱。类似黎明杀机的沉浸式体验。',
};

// 3D模式专用参数
export const THIRD_PERSON_CONFIG = {
  NIGHT_WINDOW_SECONDS: 120,         // 夜晚总时长(秒)
  MOVE_SPEED_WALK: 3.0,              // 走路速度
  MOVE_SPEED_SPRINT: 6.0,            // 冲刺速度
  MOVE_SPEED_CROUCH: 1.5,            // 蹲伏速度
  STAMINA_MAX: 100,                  // 体力上限
  STAMINA_DRAIN_SPRINT: 20,          // 冲刺每秒消耗
  STAMINA_REGEN: 15,                 // 体力每秒恢复
  ATTACK_RANGE: 2.0,                 // 蚀者噬灵距离(米)
  ATTACK_COOLDOWN_SECONDS: 8,        // 蚀者噬灵冷却
  HIDE_SPOT_CHECK_RADIUS: 2.0,       // 藏匿点检测半径
  QTE_ESCAPE_WINDOW_MS: 500,         // QTE逃脱时间窗口
  QTE_ESCAPE_BASE_CHANCE: 0.30,      // 基础逃脱概率
  KILL_ANIMATION_SECONDS: 3,         // 击杀动画时长
  WOLF_NIGHT_VISION_RANGE: 40,       // 狼人夜视距离(米)
  HUMAN_NIGHT_VISION_RANGE: 15,      // 人类夜视距离(米)
  FOG_DENSITY: 0.02,                 // 雾浓度
  MOONLIGHT_INTENSITY: 0.6,          // 月光强度
};

// ---- 匹配参数 ----
export const MATCHMAKING = {
  CYCLE_MS: 5000,
  ACCEPT_TIMEOUT_MS: 30000,
  INITIAL_BRACKET_RADIUS: 200,
  BRACKET_EXPANSION_RATE: 100,
  MAX_BRACKET_RADIUS: 2000,
  MIN_RANKED_PLAYERS: 6,
  MIN_QUICK_PLAYERS: 4,
  TARGET_PLAYERS: 12,
  PLACEMENT_GAMES: 5,
  DEMOTION_SHIELD_GAMES: 3,
};
