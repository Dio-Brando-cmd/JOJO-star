// Fix remaining issues in constants.js after bulk replacements
const fs = require('fs');
let c = fs.readFileSync(process.argv[2], 'utf-8');

// Fix weaverType references (OLD_HUNTER → OLD_VETERAN, etc.)
c = c.split("SPIRIT_WEAVER_TYPES.OLD_HUNTER").join("SPIRIT_WEAVER_TYPES.OLD_VETERAN");
c = c.split("SPIRIT_WEAVER_TYPES.MERCHANT").join("SPIRIT_WEAVER_TYPES.WANDERING_TRADER");
c = c.split("SPIRIT_WEAVER_TYPES.HERBALIST").join("SPIRIT_WEAVER_TYPES.SPIRIT_APPRENTICE");
c = c.split("SPIRIT_WEAVER_TYPES.STORYTELLER").join("SPIRIT_WEAVER_TYPES.CHRONICLER");
c = c.split("SPIRIT_WEAVER_TYPES.NIGHT_WATCHER").join("SPIRIT_WEAVER_TYPES.NIGHT_SENTINEL");
c = c.split("SPIRIT_WEAVER_TYPES.BAKER").join("SPIRIT_WEAVER_TYPES.HEARTH_KEEPER");
c = c.split("SPIRIT_WEAVER_TYPES.BLACKSMITH").join("SPIRIT_WEAVER_TYPES.ARMOR_SMITH");
c = c.split("SPIRIT_WEAVER_TYPES.WEAVER").join("SPIRIT_WEAVER_TYPES.VEIL_WEAVER");

// Fix duplicated "灵织者灵织者" → "灵织者"
c = c.split("灵织者灵织者").join("灵织者");

// Fix double role icons (ROLE_ICONS still has old emojis mixed in from pass1)
// These were already partially replaced but may have double-up issues
// Manual fix: ensure correct icons
const iconMap = {
  "ROLES.CORRUPTED]: '🐺'": "ROLES.CORRUPTED]: '🌑'",
  "ROLES.NETHER_MONK]: '👑🐺'": "ROLES.NETHER_MONK]: '🕯️'",
  "ROLES.VEIL_SCHOLAR]: '🔮'": "ROLES.VEIL_SCHOLAR]: '👁️'",
  "ROLES.HERBAL_SAGE]: '☠️🧪'": "ROLES.HERBAL_SAGE]: '🌿📜'",
  "ROLES.SPIRIT_MENDER]: '💚🧪'": "ROLES.SPIRIT_MENDER]: '💫'",
  "ROLES.SPIRIT_WEAVER]: '👨‍🌾'": "ROLES.SPIRIT_WEAVER]: '🧵'",
  "ROLES.VEIL_GUARDIAN]: '🛡️'": "ROLES.VEIL_GUARDIAN]: '🛡️✨'",
  "ROLES.FLAME_TRACKER]: '🔫'": "ROLES.FLAME_TRACKER]: '🎯'",
};
for (const [from, to] of Object.entries(iconMap)) {
  c = c.split(from).join(to);
}

// Fix lingering old text in backstories
c = c.split("'直觉敏锐 — 有概率识破进入自家的狼人'").join("'直觉敏锐 — 有概率识破进入自家的蚀者'");

// Fix lingering old Chinese text
c = c.split("'能言善辩 — 讨论发言时间翻倍，可额外发言一次'").join("'能言善辩 — 聚落会议发言时间翻倍，可额外发言一次'");

// Fix "狼群激素" → "裂隙引导"
c = c.split("狼群激素").join("裂隙引导");

// Fix "假身份编织" → "灵焰遮蔽编织"
c = c.split("假身份编织").join("灵焰遮蔽编织");

// Fix "抗毒体质" → "抗蚀体质"
c = c.split("抗毒体质").join("抗蚀体质");

// Fix "药草园" → "灵符绘制"
c = c.split("药草园").join("灵符绘制");

// Fix role ability description issues
c = c.split("'未蚀变时帷幕学者察灵为好人'").join("'未蚀变时察灵显示为纯净'");
c = c.split("'察灵后白天可看目标头像颜色'").join("'察灵后白昼可看目标灵焰颜色'");
c = c.split("'灵蚀重伤时草药学者获知'").join("'帷幕守卫灵蚀重伤时草药学者获知'");
c = c.split("'重伤挡刀'").join("'灵蚀重伤挡噬'");
c = c.split("'独自被袭→重伤暴露'").join("'独自被袭→灵蚀重伤暴露'");

fs.writeFileSync(process.argv[3], c, 'utf-8');
console.log('Done:', c.length, 'chars');
