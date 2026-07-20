// ============================================================
// 客户端常量（与服务端保持一致）— v2.0 扩展版
// ============================================================

export const ROLES = {
  WEREWOLF: 'WEREWOLF',
  ALPHA_WOLF: 'ALPHA_WOLF',
  SEER: 'SEER',
  POISON_WITCH: 'POISON_WITCH',
  HEAL_WITCH: 'HEAL_WITCH',
  VILLAGER: 'VILLAGER',
  GUARD: 'GUARD',
  HUNTER: 'HUNTER',
};

export const VILLAGER_TYPES = {
  OLD_HUNTER: 'OLD_HUNTER',
  MERCHANT: 'MERCHANT',
  HERBALIST: 'HERBALIST',
  STORYTELLER: 'STORYTELLER',
  NIGHT_WATCHER: 'NIGHT_WATCHER',
  BAKER: 'BAKER',
  BLACKSMITH: 'BLACKSMITH',
  WEAVER: 'WEAVER',
};

export const VILLAGER_TYPE_NAMES = {
  OLD_HUNTER: '老猎人',
  MERCHANT: '旅行商人',
  HERBALIST: '草药师',
  STORYTELLER: '说书人',
  NIGHT_WATCHER: '守夜人',
  BAKER: '面包师',
  BLACKSMITH: '铁匠',
  WEAVER: '织布女',
};

export const VILLAGER_NAMES = {
  1: { name: '老杰克', title: '退休猎人', type: 'OLD_HUNTER', quote: '"我可能老了，但这双眼睛，还看得清谁是野兽。"' },
  2: { name: '玛丽安', title: '旅行商人', type: 'MERCHANT', quote: '"在这个村子里，消息比武器更值钱。"' },
  3: { name: '艾米丽', title: '草药师', type: 'HERBALIST', quote: '"大自然给了我们一切解药，只是大多数人不知道去哪里找。"' },
  4: { name: '托马斯', title: '说书人', type: 'STORYTELLER', quote: '"给我三分钟，我能让狼人自己投自己一票。"' },
  5: { name: '卡莱布', title: '守夜人', type: 'NIGHT_WATCHER', quote: '"黑暗里的一切动静，都逃不过我的耳朵。"' },
  6: { name: '艾拉', title: '面包师', type: 'BAKER', quote: '"最好的情报来源？当然是排队买面包的队伍。"' },
  7: { name: '老彼得', title: '铁匠', type: 'BLACKSMITH', quote: '"我的门，比某些人的胆子还硬。"' },
  8: { name: '莉莉安', title: '织布女', type: 'WEAVER', quote: '"每一根线都有它的去向，每一个人也是。"' },
};

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

export const CHARACTER_IDENTITIES = {
  SIGURD: { id: 'SIGURD', name: '西格德', title: '维京老战士', origin: 'NORSE', gender: 'male' },
  FREYJA: { id: 'FREYJA', name: '芙蕾雅', title: '华纳末裔', origin: 'NORSE', gender: 'female' },
  MORRIGAN: { id: 'MORRIGAN', name: '莫莉安', title: '最后的德鲁伊', origin: 'CELTIC', gender: 'female' },
  ANUBIS_ACOLYTE: { id: 'ANUBIS_ACOLYTE', name: '卡赫特', title: '冥界侍僧', origin: 'EGYPTIAN', gender: 'male' },
  HECTOR: { id: 'HECTOR', name: '赫克托', title: '特洛伊之盾', origin: 'GREEK', gender: 'male' },
  ROMULUS: { id: 'ROMULUS', name: '罗慕路斯', title: '狼养之子', origin: 'ROMAN', gender: 'male' },
  FENRIR_KIN: { id: 'FENRIR_KIN', name: '哈尔瓦德', title: '魔狼血裔', origin: 'NORSE', gender: 'male' },
  SKADI: { id: 'SKADI', name: '斯卡蒂', title: '雪山猎手', origin: 'NORSE', gender: 'female' },
  HAIKU_MONK: { id: 'HAIKU_MONK', name: '虚舟', title: '流浪僧人', origin: 'EASTERN', gender: 'male' },
  BRIGID: { id: 'BRIGID', name: '布丽吉德', title: '圣火侍女', origin: 'CELTIC', gender: 'female' },
};

export const MYTH_ORIGIN_NAMES = {
  NORSE: '北欧神话',
  CELTIC: '凯尔特神话',
  GREEK: '希腊神话',
  EGYPTIAN: '埃及神话',
  ROMAN: '罗马神话',
  EASTERN: '东方传说',
  FOLK: '民间故事',
};

export const TEAMS = { WOLF: 'WOLF', VILLAGE: 'VILLAGE' };
export const TEAM_NAMES = { WOLF: '狼人阵营', VILLAGE: '好人阵营' };

export const PHASES = {
  LOBBY: 'LOBBY', NIGHT: 'NIGHT', DAY: 'DAY', VOTE: 'VOTE',
  DISCUSSION: 'DISCUSSION', GAME_OVER: 'GAME_OVER',
  CHARACTER_SELECT: 'CHARACTER_SELECT', PROLOGUE: 'PROLOGUE',
};

export const NIGHT_STEPS = {
  HUNTER: 'HUNTER', ALPHA_WOLF: 'ALPHA_WOLF', GUARD: 'GUARD',
  WEREWOLF: 'WEREWOLF', SEER: 'SEER', POISON_WITCH: 'POISON_WITCH',
  HEAL_WITCH: 'HEAL_WITCH', VILLAGER: 'VILLAGER', RESOLUTION: 'RESOLUTION',
};

export const NIGHT_STEP_NAMES = {
  HUNTER: '猎人', ALPHA_WOLF: '种狼', GUARD: '守卫', WEREWOLF: '狼人',
  SEER: '预言家', POISON_WITCH: '毒巫', HEAL_WITCH: '药巫',
  VILLAGER: '村民', RESOLUTION: '结算',
};

export const NIGHT_ACTIONS = {
  GO_OUT: 'GO_OUT', USE_ABILITY: 'USE_ABILITY', SLEEP: 'SLEEP',
  EAVESDROP: 'EAVESDROP', HOWL: 'HOWL', DISGUISE: 'DISGUISE',
  PUBLIC_PROPHECY: 'PUBLIC_PROPHECY', SPIRIT_VISION: 'SPIRIT_VISION',
  POISON_FOG: 'POISON_FOG', BATTLEFIELD_AID: 'BATTLEFIELD_AID',
  DIAGNOSE: 'DIAGNOSE', PATROL: 'PATROL', FORTIFY: 'FORTIFY',
  SACRIFICE: 'SACRIFICE', TRAP_SET: 'TRAP_SET', REVENGE: 'REVENGE',
  TRADE_INFO: 'TRADE_INFO', HERBAL_REMEDY: 'HERBAL_REMEDY',
  NIGHT_WATCH: 'NIGHT_WATCH', FORTIFY_DOOR: 'FORTIFY_DOOR', TELL_STORY: 'TELL_STORY',
};
