// Bulk text replacement for constants.js files
const fs = require('fs');

let content = fs.readFileSync(process.argv[2], 'utf-8');

// Simple text replacements - no regex, no fancy escaping
const reps = [];

function add(from, to) { reps.push([from, to]); }

// === ROLES ===
add("WEREWOLF: 'WEREWOLF'", "CORRUPTED: 'CORRUPTED'");
add("ALPHA_WOLF: 'ALPHA_WOLF'", "NETHER_MONK: 'NETHER_MONK'");
add("SEER: 'SEER'", "VEIL_SCHOLAR: 'VEIL_SCHOLAR'");
add("POISON_WITCH: 'POISON_WITCH'", "HERBAL_SAGE: 'HERBAL_SAGE'");
add("HEAL_WITCH: 'HEAL_WITCH'", "SPIRIT_MENDER: 'SPIRIT_MENDER'");
add("VILLAGER: 'VILLAGER'", "SPIRIT_WEAVER: 'SPIRIT_WEAVER'");
add("GUARD: 'GUARD'", "VEIL_GUARDIAN: 'VEIL_GUARDIAN'");
add("HUNTER: 'HUNTER'", "FLAME_TRACKER: 'FLAME_TRACKER'");

// === VILLAGER_TYPES → SPIRIT_WEAVER_TYPES ===
add("VILLAGER_TYPES", "SPIRIT_WEAVER_TYPES");
add("OLD_HUNTER: 'OLD_HUNTER'", "OLD_VETERAN: 'OLD_VETERAN'");
add("MERCHANT: 'MERCHANT'", "WANDERING_TRADER: 'WANDERING_TRADER'");
add("HERBALIST: 'HERBALIST'", "SPIRIT_APPRENTICE: 'SPIRIT_APPRENTICE'");
add("STORYTELLER: 'STORYTELLER'", "CHRONICLER: 'CHRONICLER'");
add("NIGHT_WATCHER: 'NIGHT_WATCHER'", "NIGHT_SENTINEL: 'NIGHT_SENTINEL'");
add("BAKER: 'BAKER'", "HEARTH_KEEPER: 'HEARTH_KEEPER'");
add("BLACKSMITH: 'BLACKSMITH'", "ARMOR_SMITH: 'ARMOR_SMITH'");
add("WEAVER: 'WEAVER'", "VEIL_WEAVER: 'VEIL_WEAVER'");

// === VILLAGER_NAMES → SPIRIT_WEAVER_NAMES ===
add("VILLAGER_NAMES", "SPIRIT_WEAVER_NAMES");
add("villagerType", "weaverType");
add("villagerIndex", "weaverIndex");
add("villagerName", "weaverName");
add("villagerTitle", "weaverTitle");

// === TEAMS ===
add("WOLF: 'WOLF'", "CORRUPTED: 'CORRUPTED'");
add("VILLAGE: 'VILLAGE'", "VEIL_KEEPERS: 'VEIL_KEEPERS'");
add("TEAMS.WOLF", "TEAMS.CORRUPTED");
add("TEAMS.VILLAGE", "TEAMS.VEIL_KEEPERS");
add("team: 'WOLF'", "team: 'CORRUPTED'");
add("team: 'VILLAGE'", "team: 'VEIL_KEEPERS'");
add("team === 'WOLF'", "team === 'CORRUPTED'");
add("team === 'VILLAGE'", "team === 'VEIL_KEEPERS'");

// === ROLE_NAMES ===
add("[ROLES.WEREWOLF]: '狼人'", "[ROLES.CORRUPTED]: '蚀者'");
add("[ROLES.ALPHA_WOLF]: '种狼'", "[ROLES.NETHER_MONK]: '冥僧人'");
add("[ROLES.SEER]: '预言家'", "[ROLES.VEIL_SCHOLAR]: '帷幕学者'");
add("[ROLES.POISON_WITCH]: '毒巫'", "[ROLES.HERBAL_SAGE]: '草药学者'");
add("[ROLES.HEAL_WITCH]: '药巫'", "[ROLES.SPIRIT_MENDER]: '愈灵师'");
add("[ROLES.VILLAGER]: '村民'", "[ROLES.SPIRIT_WEAVER]: '灵织者'");
add("[ROLES.GUARD]: '守卫'", "[ROLES.VEIL_GUARDIAN]: '帷幕守卫'");
add("[ROLES.HUNTER]: '猎人'", "[ROLES.FLAME_TRACKER]: '灵痕追猎者'");

// === ROLE_ICONS ===
add("[ROLES.WEREWOLF]: '", "[ROLES.CORRUPTED]: '");
add("[ROLES.ALPHA_WOLF]: '", "[ROLES.NETHER_MONK]: '");
add("[ROLES.SEER]: '", "[ROLES.VEIL_SCHOLAR]: '");
add("[ROLES.POISON_WITCH]: '", "[ROLES.HERBAL_SAGE]: '");
add("[ROLES.HEAL_WITCH]: '", "[ROLES.SPIRIT_MENDER]: '");
add("[ROLES.VILLAGER]: '", "[ROLES.SPIRIT_WEAVER]: '");
add("[ROLES.GUARD]: '", "[ROLES.VEIL_GUARDIAN]: '");
add("[ROLES.HUNTER]: '", "[ROLES.FLAME_TRACKER]: '");

// === ROLE refs ===
add("ROLES.WEREWOLF", "ROLES.CORRUPTED");
add("ROLES.ALPHA_WOLF", "ROLES.NETHER_MONK");
add("ROLES.SEER", "ROLES.VEIL_SCHOLAR");
add("ROLES.POISON_WITCH", "ROLES.HERBAL_SAGE");
add("ROLES.HEAL_WITCH", "ROLES.SPIRIT_MENDER");
add("ROLES.VILLAGER", "ROLES.SPIRIT_WEAVER");
add("ROLES.GUARD", "ROLES.VEIL_GUARDIAN");
add("ROLES.HUNTER", "ROLES.FLAME_TRACKER");

// === NIGHT_STEPS ===
add("NIGHT_STEPS.HUNTER", "NIGHT_STEPS.FLAME_TRACKER");
add("NIGHT_STEPS.ALPHA_WOLF", "NIGHT_STEPS.NETHER_MONK");
add("NIGHT_STEPS.WEREWOLF", "NIGHT_STEPS.CORRUPTED");
add("NIGHT_STEPS.SEER", "NIGHT_STEPS.VEIL_SCHOLAR");
add("NIGHT_STEPS.POISON_WITCH", "NIGHT_STEPS.HERBAL_SAGE");
add("NIGHT_STEPS.HEAL_WITCH", "NIGHT_STEPS.SPIRIT_MENDER");
add("NIGHT_STEPS.VILLAGER", "NIGHT_STEPS.SPIRIT_WEAVER");
add("NIGHT_STEPS.GUARD", "NIGHT_STEPS.VEIL_GUARDIAN");

// === Common terms ===
add("狼人杀", "帷幕之地");
add("狼人阵营", "蚀者阵营");
add("好人阵营", "守幕者阵营");
add("狼人同伴", "蚀者同伴");
add("狼人入侵", "蚀者噬灵");
add("普通狼人", "蚀者");
add("种狼", "冥僧人");
add("毒巫", "草药学者");
add("药巫", "愈灵师");
add("预言家", "帷幕学者");
add("守卫重伤", "灵蚀重伤");
add("守卫舍身", "帷幕守卫舍身誓言");
add("刀人", "噬灵");
add("变狼", "蚀变");
add("感染", "堕化");
add("查验阵营", "察灵辨蚀");
add("查验", "察灵");
add("狼人行动", "蚀者噬灵");
add("守卫行动", "帷幕庇护");
add("村民行动", "灵织守夜");
add("种狼行动", "冥僧人定");
add("猎人行动", "追猎行动");
add("预言家行动", "学者察灵");
add("毒巫行动", "草药炼剂");
add("药巫行动", "愈灵修复");
add("偷听", "帷幕低语");
add("出门观察 + 偷听", "夜行感知 + 帷幕低语");
add("烈性毒药", "蚀灭药剂");
add("万能药", "灵焰修复");
add("毒药", "蚀痕净化");
add("猎枪", "灵焰弩");
add("短火铳", "噬灭短刃");
add("嚎叫", "裂隙共鸣");
add("嗅觉追踪", "灵痕感知");
add("伪装", "灵焰遮蔽");
add("筑垒", "壁垒筑造");
add("村民", "灵织者");
add("神职和狼人", "专业守幕者和蚀者");
add("老猎人", "老兵灵织者");
add("旅行商人", "行路灵织者");
add("草药师", "学徒灵织者");
add("说书人", "记述灵织者");
add("守夜人", "守夜灵织者");
add("面包师", "炊火灵织者");
add("铁匠", "锻甲灵织者");
add("织布女", "织幕灵织者");
add("退休猎人", "暮色老兵");
add("消息比武器更值钱", "灵焰的频率比武器更可靠");
add("让狼人自己投自己一票", "让蚀者自己走出庇护所");
add("谁是野兽", "谁被蚀痕沾染");

// === File header ===
add("狼人杀游戏常量定义", "帷幕之地 · 灵焰纪元 — 常量定义");
add("新增：角色子类型、村民名字池、特质系统、神话标记、扩展能力", "新增：灵织者子类型、魂印系统、扩展能力");
add("村民子类型（每个村民有独特定位）", "灵织者子类型（每个灵织者有独特定位）");
add("村民名字池（编号 → 名字+背景）", "灵织者名册（编号 → 名字+背景）");

// Apply all replacements (using split/join for speed, no loops)
for (const [from, to] of reps) {
  if (content.includes(from)) {
    content = content.split(from).join(to);
  }
}

fs.writeFileSync(process.argv[3], content, 'utf-8');
console.log('Done:', content.length, 'chars');
