// Final comprehensive replacement: weapons, talisman system, UI branding
const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2];
if (!targetDir) { console.error('Usage: node replace_final.cjs <directory>'); process.exit(1); }

function findFiles(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file.endsWith('.bak')) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) { results.push(...findFiles(fullPath)); }
    else if (/\.(js|jsx|html|css|txt|json|md)$/.test(file)) { results.push(fullPath); }
  }
  return results;
}

const files = findFiles(targetDir);
console.log(`Found ${files.length} source files`);

const reps = [
  // === WEAPONS: keep as firearms ===
  // 灵焰弩 → 灵焰猎枪 (spirit flame hunting rifle) — CODE stays hasRifle, rifleUsable etc
  ["'灵焰弩'", "'灵焰猎枪'"],
  ['「灵焰弩」', '「灵焰猎枪」'],
  ['灵焰弩', '灵焰猎枪'],
  ['spirit_flame_crossbow', 'spirit_flame_rifle'],

  // 噬灭短刃 → 噬灭短铳 (devour-destroying short musket) — CODE stays hasBlunderbuss
  ["'噬灭短刃'", "'噬灭短铳'"],
  ['「噬灭短刃」', '「噬灭短铳」'],
  ['噬灭短刃', '噬灭短铳'],

  // === POISON SYSTEM → TALISMAN SYSTEM ===
  // 蚀灭药剂 → 蚀灭符 (corrosion-destroying talisman)
  ["'蚀灭药剂'", "'蚀灭符'"],
  ['蚀灭药剂', '蚀灭符'],

  // 愈灵汤剂 → 愈灵符 (spirit-healing talisman)
  ["'愈灵汤剂'", "'愈灵符'"],
  ['愈灵汤剂', '愈灵符'],

  // 烈性毒药 → 蚀灭符阵 (mass-destroying talisman array)
  ["'烈性毒药'", "'蚀灭符阵'"],
  ['烈性毒药', '蚀灭符阵'],

  // 药水 → 灵符
  ['药水救人', '灵符愈灵'],
  ['药水', '灵符'],

  // 毒药（单目标） → 蚀灭符（单目标）
  ["primary: '蚀灭符阵（群灭）+ 灵符愈灵'", "primary: '蚀灭符阵 + 愈灵符'"],

  // 万能药 → 灵焰修复 (already done in pass 1, but double-check)
  // 单目标毒药 → 蚀痕净化

  // CODE level changes: hasPotion → hasHealTalisman, hasPoison → hasSealTalisman
  ['hasPotion', 'hasHealTalisman'],
  ['hasPoison', 'hasSealTalisman'],
  ['potionMaterials', 'talismanMaterials'],
  ['hasUsedPotion', 'hasUsedHealTalisman'],
  ['herbGardenReady', 'talismanCharged'],

  // Night actions
  ["POISON_FOG: 'POISON_FOG'", "CORROSION_MIST: 'CORROSION_MIST'"],
  ["POISON_FOG", "CORROSION_MIST"],
  ["'POISON_FOG'", "'CORROSION_MIST'"],
  ['毒雾陷阱', '蚀雾符阵'],
  ['poison_fog', 'corrosion_mist'],

  // Other poison references
  ['lethal_poison', 'mass_seal'],
  ['lethalPoison', 'massSeal'],
  ['lethal_poison', 'mass_seal'],
  ['烈性毒药（灭门）', '蚀灭符阵（群灭）'],
  ['potion_save', 'talisman_save'],
  ['potion', 'talisman'],
  ['Potion', 'Talisman'],
  ['poison_transferred', 'seal_transferred'],
  ['poison_fog', 'corrosion_mist'],
  ['毒药转移', '蚀灭符转移'],
  ['毒药配方', '灵符绘制'],
  ['毒雾', '蚀雾'],
  ['毒材', '符材'],

  // === BRANDING: 狼人杀 → 帷幕之地 ===
  ["'狼人杀'", "'帷幕之地'"],
  ['「狼人杀」', '「帷幕之地」'],
  ['狼人杀 Setup', '帷幕之地 Setup'],
  ['狼人杀_Setup', '帷幕之地_Setup'],
  ['狼人杀_Werewolf_Setup', '帷幕之地_VeilLand_Setup'],

  // === REMAINING CHINESE TEXT ===
  ['种狼 ', '冥僧人 '],
  ['种狼的', '冥僧人的'],
  ['预言结果', '察灵结果'],
  ['预言家查验', '帷幕学者察灵'],
  ['预言', '察灵'],
  ['去另一狼人家中', '去另一蚀者庇护所'],
  ['另一狼人', '另一蚀者'],

  // Handler messages
  ["种狼 ${player.name} 告知：你已被堕化！种狼是 ${player.name}。你的预言结果已被反转。",
   "冥僧人 ${player.name} 告知：你已被堕化！冥僧人是 ${player.name}。你的察灵结果已被反转。"],
  ["种狼 ${player.name} 告知：你已被堕化，下个夜晚将蚀变为蚀者。",
   "冥僧人 ${player.name} 告知：你已被堕化，下个蚀月将蚀变。"],

  // Log messages
  ['狼人袭击了某个目标', '蚀者噬灵了某个目标'],
  ['有人被解药救活', '有人被愈灵符救回'],
  ['万能药救活了一人', '灵焰修复救回了一人'],
  ['变成了狼人', '蚀变为蚀者'],
  ['有人变成了狼人', '有人蚀变了'],

  // UI labels
  ['找出狼人', '辨识蚀者'],
  ['狼人胜', '蚀者胜'],
  ['好人胜', '守幕者胜'],

  // Comments
  ['// 狼人裂隙共鸣召集', '// 蚀者裂隙共鸣'],
  ['// 狼人灵焰遮蔽', '// 蚀者灵焰遮蔽'],
  ['不能全是狼人', '不能全是蚀者'],
  ['不能全狼人', '不能全蚀者'],
  ['狼人嚎叫和伪装不能同时刀人', '蚀者裂隙共鸣和灵焰遮蔽不能同时噬灵'],
  ['村民偷听', '灵织者帷幕低语'],
  ['猎人开枪', '追猎者射击'],
  ['猎枪追踪', '猎枪追猎'],
  ['短火铳反击', '短铳反击'],

  // Role select descriptions
  ['可变狼/感染/刀人', '可堕化/蚀变/噬灵'],
  ['夜晚刀人，锁定人而非屋', '夜晚噬灵，锁定灵焰而非庇护所'],
  ['查验好人/狼人', '察灵辨识纯净/蚀痕'],
  ['烈性毒药+药水', '蚀灭符阵+愈灵符'],
  ['万能药+单目标毒药', '灵焰修复+蚀痕净化'],
  ['守护一人，可重伤', '灵焰庇护一人，可灵蚀重伤'],
  ['猎枪+短火铳', '灵焰猎枪+噬灭短铳'],

  // Hero/subtitle text
  ['月圆之夜，狼人出没', '血月之夜，蚀者噬灵'],
  ['狼人杀 在线联机版', '帷幕之地 在线联机版'],
  ['<h1>狼人杀</h1>', '<h1>帷幕之地</h1>'],
  ['<h1>帷幕之地</h1>', '<h1>帷幕之地</h1>'], // idempotent

  // Download filename in code
  ["'/download/狼人杀_Setup.exe'", "'/download/帷幕之地_Setup.exe'"],
  ["'/download/帷幕之地_Setup.exe'", "'/download/帷幕之地_Setup.exe'"], // idempotent

  // App title
  ['无敌狼人杀', '帷幕之地'],

  // CSS comments
  ['狼人杀 ——', '帷幕之地 ——'],
  ['狼人杀 设计', '帷幕之地 设计'],

  // Contact/Download pages
  ['狼人杀官网', '帷幕之地官网'],
  ['狼人杀 在线联机版', '帷幕之地 在线联机版'],

  // 种狼告知 CSS
  ['种狼告知', '冥僧告知'],
];

let changed = 0;
for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  for (const [from, to] of reps) {
    if (from === to) continue; // skip idempotency pairs
    if (content.includes(from)) {
      content = content.split(from).join(to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    changed++;
    console.log(`  Updated: ${path.relative(targetDir, filePath)}`);
  }
}

console.log(`\nChanged ${changed} of ${files.length} files`);
