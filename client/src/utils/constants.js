// ============================================================
// 客户端常量（与服务端保持一致）— v2.0 扩展版
// ============================================================

export const ROLES = {
  CORRUPTED: 'CORRUPTED',
  NETHER_MONK: 'NETHER_MONK',
  VEIL_SCHOLAR: 'VEIL_SCHOLAR',
  HERBAL_SAGE: 'HERBAL_SAGE',
  SPIRIT_MENDER: 'SPIRIT_MENDER',
  SPIRIT_WEAVER: 'SPIRIT_WEAVER',
  VEIL_GUARDIAN: 'VEIL_GUARDIAN',
  FLAME_TRACKER: 'FLAME_TRACKER',
};

export const SPIRIT_WEAVER_TYPES = {
  OLD_VETERAN: 'OLD_VETERAN',
  WANDERING_TRADER: 'WANDERING_TRADER',
  SPIRIT_APPRENTICE: 'SPIRIT_APPRENTICE',
  CHRONICLER: 'CHRONICLER',
  NIGHT_SENTINEL: 'NIGHT_SENTINEL',
  HEARTH_KEEPER: 'HEARTH_KEEPER',
  ARMOR_SMITH: 'ARMOR_SMITH',
  VEIL_WEAVER: 'VEIL_WEAVER',
};

export const VILLAGER_TYPE_NAMES = {
  OLD_HUNTER: '老兵灵织者',
  MERCHANT: '行路灵织者',
  HERBALIST: '学徒灵织者',
  STORYTELLER: '记述灵织者',
  NIGHT_WATCHER: '守夜灵织者',
  BAKER: '炊火灵织者',
  BLACKSMITH: '锻甲灵织者',
  WEAVER: '织幕灵织者',
};

export const SPIRIT_WEAVER_NAMES = {
  1: { name: '老杰克', title: '暮色老兵', type: 'OLD_HUNTER', quote: '"我可能老了，但这双眼睛，还看得清谁被蚀痕沾染。"' },
  2: { name: '玛丽安', title: '行路灵织者', type: 'MERCHANT', quote: '"在这个村子里，灵焰的频率比武器更可靠。"' },
  3: { name: '艾米丽', title: '学徒灵织者', type: 'HERBALIST', quote: '"大自然给了我们一切解药，只是大多数人不知道去哪里找。"' },
  4: { name: '托马斯', title: '记述灵织者', type: 'STORYTELLER', quote: '"给我三分钟，我能让蚀者自己走出庇护所。"' },
  5: { name: '卡莱布', title: '守夜灵织者', type: 'NIGHT_WATCHER', quote: '"黑暗里的一切动静，都逃不过我的耳朵。"' },
  6: { name: '艾拉', title: '炊火灵织者', type: 'BAKER', quote: '"最好的情报来源？当然是排队买面包的队伍。"' },
  7: { name: '老彼得', title: '锻甲灵织者', type: 'BLACKSMITH', quote: '"我的门，比某些人的胆子还硬。"' },
  8: { name: '莉莉安', title: '织幕灵织者', type: 'WEAVER', quote: '"每一根线都有它的去向，每一个人也是。"' },
};

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

export const TEAMS = { CORRUPTED: 'CORRUPTED', VEIL_KEEPERS: 'VEIL_KEEPERS' };
export const TEAM_NAMES = { WOLF: '蚀者阵营', VILLAGE: '守幕者阵营' };

export const PHASES = {
  LOBBY: 'LOBBY', NIGHT: 'NIGHT', DAY: 'DAY', VOTE: 'VOTE',
  DISCUSSION: 'DISCUSSION', GAME_OVER: 'GAME_OVER',
  CHARACTER_SELECT: 'CHARACTER_SELECT', PROLOGUE: 'PROLOGUE',
};

export const NIGHT_STEPS = {
  FLAME_TRACKER: 'FLAME_TRACKER', NETHER_MONK: 'NETHER_MONK', VEIL_GUARDIAN: 'VEIL_GUARDIAN',
  CORRUPTED: 'CORRUPTED', VEIL_SCHOLAR: 'VEIL_SCHOLAR', HERBAL_SAGE: 'HERBAL_SAGE',
  SPIRIT_MENDER: 'SPIRIT_MENDER', SPIRIT_WEAVER: 'SPIRIT_WEAVER', RESOLUTION: 'RESOLUTION',
};

export const NIGHT_STEP_NAMES = {
  FLAME_TRACKER: '追猎者', ALPHA_WOLF: '冥僧人', VEIL_GUARDIAN: '帷幕守卫', CORRUPTED: '蚀者',
  VEIL_SCHOLAR: '帷幕学者', POISON_WITCH: '草药学者', HEAL_WITCH: '愈灵师',
  VILLAGER: '灵织者', RESOLUTION: '结算',
};

export const NIGHT_ACTIONS = {
  GO_OUT: 'GO_OUT', USE_ABILITY: 'USE_ABILITY', SLEEP: 'SLEEP',
  EAVESDROP: 'EAVESDROP', HOWL: 'HOWL', DISGUISE: 'DISGUISE',
  PUBLIC_PROPHECY: 'PUBLIC_PROPHECY', SPIRIT_VISION: 'SPIRIT_VISION',
  CORROSION_MIST: 'CORROSION_MIST', BATTLEFIELD_AID: 'BATTLEFIELD_AID',
  DIAGNOSE: 'DIAGNOSE', PATROL: 'PATROL', FORTIFY: 'FORTIFY',
  SACRIFICE: 'SACRIFICE', TRAP_SET: 'TRAP_SET', REVENGE: 'REVENGE',
  TRADE_INFO: 'TRADE_INFO', HERBAL_REMEDY: 'HERBAL_REMEDY',
  NIGHT_WATCH: 'NIGHT_WATCH', FORTIFY_DOOR: 'FORTIFY_DOOR', TELL_STORY: 'TELL_STORY',
};
