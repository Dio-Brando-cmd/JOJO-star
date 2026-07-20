// ============================================================
// 狼人杀游戏常量定义 — v2.0 角色升级版
// 新增：角色子类型、村民名字池、特质系统、神话标记、扩展能力
// ============================================================

// ---- 角色定义 ----
export const ROLES = {
  WEREWOLF: 'WEREWOLF',           // 普通狼人
  ALPHA_WOLF: 'ALPHA_WOLF',       // 种狼
  SEER: 'SEER',                   // 预言家
  POISON_WITCH: 'POISON_WITCH',   // 毒巫（烈性毒药）
  HEAL_WITCH: 'HEAL_WITCH',       // 药巫（万能药）
  VILLAGER: 'VILLAGER',           // 村民
  GUARD: 'GUARD',                 // 守卫
  HUNTER: 'HUNTER',               // 猎人
};

// ---- 村民子类型（每个村民有独特定位） ----
export const VILLAGER_TYPES = {
  OLD_HUNTER: 'OLD_HUNTER',       // 老猎人村民 — 直觉敏锐，有概率识别狼人
  MERCHANT: 'MERCHANT',           // 旅行商人村民 — 可访问2个屋子，信息灵通
  HERBALIST: 'HERBALIST',         // 草药师村民 — 可简单治疗，推迟死亡1回合
  STORYTELLER: 'STORYTELLER',     // 说书人村民 — 讨论发言时间翻倍
  NIGHT_WATCHER: 'NIGHT_WATCHER', // 守夜人村民 — 察觉门外经过者
  BAKER: 'BAKER',                 // 面包师村民 — 人缘好，知道更多人的行踪
  BLACKSMITH: 'BLACKSMITH',       // 铁匠村民 — 力大，可强化自家门锁
  WEAVER: 'WEAVER',               // 织布女村民 — 心思缜密，偷听线索更精确
};

// 村民名字池（编号 → 名字+背景）
export const VILLAGER_NAMES = {
  1: {
    name: '老杰克',
    title: '退休猎人',
    villagerType: VILLAGER_TYPES.OLD_HUNTER,
    backstory: '年轻时是名震一方的猎人，如今年事已高，但那份猎人的直觉从未消失。他的屋子里挂满了年轻时的战利品。',
    trait: '直觉敏锐 — 有概率识破进入自家的狼人',
    quote: '"我可能老了，但这双眼睛，还看得清谁是野兽。"',
  },
  2: {
    name: '玛丽安',
    title: '旅行商人',
    villagerType: VILLAGER_TYPES.MERCHANT,
    backstory: '走南闯北的商人，帷幕之地的每条小路都刻在她脑子里。她认识所有人，也知道所有人的秘密。',
    trait: '消息灵通 — 每晚可访问2个屋子',
    quote: '"在这个村子里，消息比武器更值钱。"',
  },
  3: {
    name: '艾米丽',
    title: '草药师',
    villagerType: VILLAGER_TYPES.HERBALIST,
    backstory: '继承了祖母留下的药草园，虽然医术比不上真正的女巫，但她的草药足够帮人撑过最难熬的夜晚。',
    trait: '医术入门 — 可推迟目标死亡1回合',
    quote: '"大自然给了我们一切解药，只是大多数人不知道去哪里找。"',
  },
  4: {
    name: '托马斯',
    title: '说书人',
    villagerType: VILLAGER_TYPES.STORYTELLER,
    backstory: '曾是宫廷的吟游诗人，因讲了一个不该讲的故事被流放到帷幕之地。他的舌头比刀子更锋利。',
    trait: '能言善辩 — 讨论发言时间翻倍，可额外发言一次',
    quote: '"给我三分钟，我能让狼人自己投自己一票。"',
  },
  5: {
    name: '卡莱布',
    title: '守夜人',
    villagerType: VILLAGER_TYPES.NIGHT_WATCHER,
    backstory: '曾是城防军的哨兵，在城墙上度过了无数个不眠之夜。如今他把这份警觉带到了暮色村。',
    trait: '警惕性高 — 可察觉门外经过的人',
    quote: '"黑暗里的一切动静，都逃不过我的耳朵。"',
  },
  6: {
    name: '艾拉',
    title: '面包师',
    villagerType: VILLAGER_TYPES.BAKER,
    backstory: '村里唯一的烘焙师，每天清晨升起第一缕炊烟的人。所有人都来她这里买面包，所以她也听到了所有的闲言碎语。',
    trait: '人缘好 — 知道更多人的夜晚去向',
    quote: '"最好的情报来源？当然是排队买面包的队伍。"',
  },
  7: {
    name: '老彼得',
    title: '铁匠',
    villagerType: VILLAGER_TYPES.BLACKSMITH,
    backstory: '打了一辈子铁，两条手臂像树干一样粗壮。他的铁锤不仅能锻铁，也能敲碎骨头。',
    trait: '力大无穷 — 可加固自家门锁，抵御一次狼人入侵',
    quote: '"我的门，比某些人的胆子还硬。"',
  },
  8: {
    name: '莉莉安',
    title: '织布女',
    villagerType: VILLAGER_TYPES.WEAVER,
    backstory: '安静寡言的纺织女，手指在织机上飞舞时，耳朵却能捕捉到最细微的声响。她不说，但她都记得。',
    trait: '心思缜密 — 偷听线索更精确（排除干扰项）',
    quote: '"每一根线都有它的去向，每一个人也是。"',
  },
};

// ---- 角色阵营 ----
export const TEAMS = {
  WOLF: 'WOLF',       // 狼人阵营
  VILLAGE: 'VILLAGE', // 好人阵营
};

// 每个角色所属阵营
export const ROLE_TEAM = {
  [ROLES.WEREWOLF]: TEAMS.WOLF,
  [ROLES.ALPHA_WOLF]: TEAMS.WOLF,
  [ROLES.SEER]: TEAMS.VILLAGE,
  [ROLES.POISON_WITCH]: TEAMS.VILLAGE,
  [ROLES.HEAL_WITCH]: TEAMS.VILLAGE,
  [ROLES.VILLAGER]: TEAMS.VILLAGE,
  [ROLES.GUARD]: TEAMS.VILLAGE,
  [ROLES.HUNTER]: TEAMS.VILLAGE,
};

// 角色中文名
export const ROLE_NAMES = {
  [ROLES.WEREWOLF]: '狼人',
  [ROLES.ALPHA_WOLF]: '种狼',
  [ROLES.SEER]: '预言家',
  [ROLES.POISON_WITCH]: '毒巫',
  [ROLES.HEAL_WITCH]: '药巫',
  [ROLES.VILLAGER]: '村民',
  [ROLES.GUARD]: '守卫',
  [ROLES.HUNTER]: '猎人',
};

// 角色图标
export const ROLE_ICONS = {
  [ROLES.WEREWOLF]: '🐺',
  [ROLES.ALPHA_WOLF]: '👑🐺',
  [ROLES.SEER]: '🔮',
  [ROLES.POISON_WITCH]: '☠️🧪',
  [ROLES.HEAL_WITCH]: '💚🧪',
  [ROLES.VILLAGER]: '👨‍🌾',
  [ROLES.GUARD]: '🛡️',
  [ROLES.HUNTER]: '🔫',
};

// ---- 角色能力描述（扩展版） ----
export const ROLE_ABILITY_DESCRIPTIONS = {
  [ROLES.WEREWOLF]: {
    primary: '刀人',
    secondary: ['嗅觉追踪', '嚎叫召集', '伪装'],
    passive: '狼人同伴相认：去另一狼人家中则双方相认',
  },
  [ROLES.ALPHA_WOLF]: {
    primary: '变狼 / 感染 / 刀人',
    secondary: ['狼群激素', '假身份编织'],
    passive: '未变狼时预言家查验为好人；感染预言家结果反转',
  },
  [ROLES.SEER]: {
    primary: '查验阵营',
    secondary: ['梦境碎片', '公开预言', '灵视'],
    passive: '查验后白天可看目标头像颜色',
  },
  [ROLES.POISON_WITCH]: {
    primary: '烈性毒药（灭门）+ 药水救人',
    secondary: ['毒雾陷阱', '抗毒体质', '毒药配方'],
    passive: '守卫重伤时毒巫获知',
  },
  [ROLES.HEAL_WITCH]: {
    primary: '万能药 + 单目标毒药',
    secondary: ['战场急救', '药草园', '诊断'],
    passive: '唯一能治疗守卫重伤的角色',
  },
  [ROLES.GUARD]: {
    primary: '守护',
    secondary: ['筑垒', '巡逻', '舍身'],
    passive: '重伤机制：≤2人被攻→重伤挡刀；独自被袭→重伤暴露',
  },
  [ROLES.HUNTER]: {
    primary: '猎枪追踪 + 短火铳反击 + 白天开枪',
    secondary: ['复仇', '陷阱射击'],
    passive: '第二晚起才能行动；同晚出门+开枪不冲突',
  },
  [ROLES.VILLAGER]: {
    primary: '出门观察 + 偷听',
    secondary: ['按村民类型不同的特技'],
    passive: '在所有神职和狼人之后行动',
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
  HUNTER: 'HUNTER',
  ALPHA_WOLF: 'ALPHA_WOLF',
  GUARD: 'GUARD',
  WEREWOLF: 'WEREWOLF',
  SEER: 'SEER',
  POISON_WITCH: 'POISON_WITCH',
  HEAL_WITCH: 'HEAL_WITCH',
  VILLAGER: 'VILLAGER',
  RESOLUTION: 'RESOLUTION',
};

export const NIGHT_STEPS_NIGHT1 = [
  NIGHT_STEPS.ALPHA_WOLF,
  NIGHT_STEPS.GUARD,
  NIGHT_STEPS.WEREWOLF,
  NIGHT_STEPS.SEER,
  NIGHT_STEPS.POISON_WITCH,
  NIGHT_STEPS.HEAL_WITCH,
  NIGHT_STEPS.VILLAGER,
  NIGHT_STEPS.RESOLUTION,
];

export const NIGHT_STEPS_FULL = [
  NIGHT_STEPS.HUNTER,
  NIGHT_STEPS.ALPHA_WOLF,
  NIGHT_STEPS.GUARD,
  NIGHT_STEPS.WEREWOLF,
  NIGHT_STEPS.SEER,
  NIGHT_STEPS.POISON_WITCH,
  NIGHT_STEPS.HEAL_WITCH,
  NIGHT_STEPS.VILLAGER,
  NIGHT_STEPS.RESOLUTION,
];

// ---- 夜晚行动选项（扩展版） ----
export const NIGHT_ACTIONS = {
  GO_OUT: 'GO_OUT',
  USE_ABILITY: 'USE_ABILITY',
  SLEEP: 'SLEEP',
  EAVESDROP: 'EAVESDROP',
  // 新增
  HOWL: 'HOWL',                   // 狼人嚎叫召集
  DISGUISE: 'DISGUISE',           // 狼人伪装
  PUBLIC_PROPHECY: 'PUBLIC_PROPHECY', // 预言家公开预言
  SPIRIT_VISION: 'SPIRIT_VISION',     // 预言家灵视
  POISON_FOG: 'POISON_FOG',           // 毒巫毒雾陷阱
  BATTLEFIELD_AID: 'BATTLEFIELD_AID', // 药巫战场急救
  DIAGNOSE: 'DIAGNOSE',               // 药巫诊断
  PATROL: 'PATROL',                   // 守卫巡逻
  FORTIFY: 'FORTIFY',                 // 守卫筑垒
  SACRIFICE: 'SACRIFICE',             // 守卫舍身
  TRAP_SET: 'TRAP_SET',               // 猎人陷阱射击 / 老猎人陷阱
  REVENGE: 'REVENGE',                 // 猎人复仇
  TRADE_INFO: 'TRADE_INFO',           // 商人村民交易信息
  HERBAL_REMEDY: 'HERBAL_REMEDY',     // 草药师村民草药
  NIGHT_WATCH: 'NIGHT_WATCH',         // 守夜人村民守夜
  FORTIFY_DOOR: 'FORTIFY_DOOR',       // 铁匠村民加固门锁
  TELL_STORY: 'TELL_STORY',           // 说书人村民讲故事
};

// ---- 种狼能力 ----
export const ALPHA_ACTIONS = {
  TRANSFORM: 'TRANSFORM',
  INFECT: 'INFECT',
  KILL: 'KILL',
  FAKE_IDENTITY: 'FAKE_IDENTITY',   // 假身份编织
  PACK_HORMONE: 'PACK_HORMONE',     // 狼群激素（被动）
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

export const NOT_COUNT_IN_HOUSE = [ROLES.WEREWOLF, ROLES.ALPHA_WOLF];
export const FREE_MOVERS = [ROLES.HUNTER, ROLES.WEREWOLF, ROLES.ALPHA_WOLF, ROLES.GUARD];

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
  NORSE: 'NORSE',           // 北欧神话
  CELTIC: 'CELTIC',         // 凯尔特神话
  GREEK: 'GREEK',           // 希腊神话
  EGYPTIAN: 'EGYPTIAN',     // 埃及神话
  ROMAN: 'ROMAN',           // 罗马神话
  EASTERN: 'EASTERN',       // 东方传说
  FOLK: 'FOLK',            // 各国民间故事
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
        effect: '被狼人攻击时无法自行逃脱（QTE难度大幅提高）',
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
        effect: '查验类能力准确率+20%（对预言家/猎人观察）',
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
        effect: '被狼人攻击时，若处于守护姿态，有25%概率不受重伤',
        icon: '🛡️',
      },
      {
        name: '荣誉枷锁',
        type: TRAIT_TYPES.WEAKNESS,
        effect: '不能投票给已知的好人阵营玩家',
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
    story: '传说中由母狼养大的罗马建城者。在他体内，人性与狼性从未停止过争斗。帷幕之地的月亮，总让他听到血液中狼的呼唤。',
    externalTraits: [
      {
        name: '双重血统',
        type: TRAIT_TYPES.PASSIVE,
        effect: '无论里身份为何，始终能听到狼人的嚎叫（获知嚎叫发生但不知是谁）',
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
    recommendedHiddenRoles: ['WEREWOLF', 'ALPHA_WOLF'],
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
        effect: '被守卫筑垒的屋子不能进入',
        icon: '🥈',
      },
    ],
    recommendedHiddenRoles: ['ALPHA_WOLF', 'WEREWOLF'],
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
        effect: '不能主动投票给第一晚查验出的狼人（需等待更多证据）',
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
        effect: '被毒巫的烈性毒药锁定后无法移动',
        icon: '😰',
      },
    ],
    recommendedHiddenRoles: ['GUARD', 'VILLAGER'],
  },
};

// ---- 预设角色配置 ----
export const ROLE_CONFIGS = {
  5: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.HEAL_WITCH, ROLES.VILLAGER],
  6: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.VILLAGER, ROLES.VILLAGER],
  7: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.VILLAGER, ROLES.VILLAGER],
  8: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.VILLAGER, ROLES.VILLAGER],
  9: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.VILLAGER, ROLES.VILLAGER],
  10: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER],
  11: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
  12: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
  13: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
  14: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
  15: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
  16: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
  17: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
  18: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
};

export function getRoleConfig(playerCount) {
  return ROLE_CONFIGS[playerCount] || ROLE_CONFIGS[12];
}

// 获取村民名字（按编号循环分配）
export function getVillagerName(index) {
  const keys = Object.keys(VILLAGER_NAMES);
  const idx = ((index - 1) % keys.length) + 1;
  return VILLAGER_NAMES[idx] || VILLAGER_NAMES[1];
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
