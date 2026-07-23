// Comprehensive replacement script for all source files
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetDir = process.argv[2];
if (!targetDir) { console.error('Usage: node replace_all.cjs <directory>'); process.exit(1); }

// Find all .js and .jsx files recursively, excluding node_modules and backups
function findFiles(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file.endsWith('.bak')) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.txt')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findFiles(targetDir);
console.log(`Found ${files.length} source files`);

const reps = [
  // === Role constants ===
  ["ROLES.WEREWOLF", "ROLES.CORRUPTED"],
  ["ROLES.ALPHA_WOLF", "ROLES.NETHER_MONK"],
  ["ROLES.SEER", "ROLES.VEIL_SCHOLAR"],
  ["ROLES.POISON_WITCH", "ROLES.HERBAL_SAGE"],
  ["ROLES.HEAL_WITCH", "ROLES.SPIRIT_MENDER"],
  ["ROLES.VILLAGER", "ROLES.SPIRIT_WEAVER"],
  ["ROLES.GUARD", "ROLES.VEIL_GUARDIAN"],
  ["ROLES.HUNTER", "ROLES.FLAME_TRACKER"],

  // === Team constants ===
  ["TEAMS.WOLF", "TEAMS.CORRUPTED"],
  ["TEAMS.VILLAGE", "TEAMS.VEIL_KEEPERS"],
  ["team === 'WOLF'", "team === 'CORRUPTED'"],
  ["team === 'VILLAGE'", "team === 'VEIL_KEEPERS'"],
  ["team: 'WOLF'", "team: 'CORRUPTED'"],
  ["team: 'VILLAGE'", "team: 'VEIL_KEEPERS'"],

  // === Night step constants ===
  ["NIGHT_STEPS.HUNTER", "NIGHT_STEPS.FLAME_TRACKER"],
  ["NIGHT_STEPS.ALPHA_WOLF", "NIGHT_STEPS.NETHER_MONK"],
  ["NIGHT_STEPS.GUARD", "NIGHT_STEPS.VEIL_GUARDIAN"],
  ["NIGHT_STEPS.WEREWOLF", "NIGHT_STEPS.CORRUPTED"],
  ["NIGHT_STEPS.SEER", "NIGHT_STEPS.VEIL_SCHOLAR"],
  ["NIGHT_STEPS.POISON_WITCH", "NIGHT_STEPS.HERBAL_SAGE"],
  ["NIGHT_STEPS.HEAL_WITCH", "NIGHT_STEPS.SPIRIT_MENDER"],
  ["NIGHT_STEPS.VILLAGER", "NIGHT_STEPS.SPIRIT_WEAVER"],

  // === VILLAGER_TYPES ===
  ["VILLAGER_TYPES.OLD_HUNTER", "SPIRIT_WEAVER_TYPES.OLD_VETERAN"],
  ["VILLAGER_TYPES.MERCHANT", "SPIRIT_WEAVER_TYPES.WANDERING_TRADER"],
  ["VILLAGER_TYPES.HERBALIST", "SPIRIT_WEAVER_TYPES.SPIRIT_APPRENTICE"],
  ["VILLAGER_TYPES.STORYTELLER", "SPIRIT_WEAVER_TYPES.CHRONICLER"],
  ["VILLAGER_TYPES.NIGHT_WATCHER", "SPIRIT_WEAVER_TYPES.NIGHT_SENTINEL"],
  ["VILLAGER_TYPES.BAKER", "SPIRIT_WEAVER_TYPES.HEARTH_KEEPER"],
  ["VILLAGER_TYPES.BLACKSMITH", "SPIRIT_WEAVER_TYPES.ARMOR_SMITH"],
  ["VILLAGER_TYPES.WEAVER", "SPIRIT_WEAVER_TYPES.VEIL_WEAVER"],

  // === Common Chinese text ===
  ["狼人阵营", "蚀者阵营"],
  ["好人阵营", "守幕者阵营"],
  ["狼人同伴", "蚀者同伴"],

  // === Night step display names ===
  ["HUNTER: '猎人'", "FLAME_TRACKER: '追猎者'"],
  ["ALPHA_WOLF: '种狼'", "NETHER_MONK: '冥僧'"],
  ["GUARD: '守卫'", "VEIL_GUARDIAN: '帷幕守卫'"],
  ["WEREWOLF: '狼人'", "CORRUPTED: '蚀者'"],
  ["SEER: '预言家'", "VEIL_SCHOLAR: '帷幕学者'"],
  ["POISON_WITCH: '毒巫'", "HERBAL_SAGE: '草药学者'"],
  ["HEAL_WITCH: '药巫'", "SPIRIT_MENDER: '愈灵师'"],
  ["VILLAGER: '村民'", "SPIRIT_WEAVER: '灵织者'"],

  // === Phase/step names ===
  ["猎人行动", "追猎行动"],
  ["种狼行动", "冥僧入定"],
  ["守卫行动", "帷幕庇护"],
  ["狼人行动", "蚀者噬灵"],
  ["预言家行动", "学者察灵"],
  ["毒巫行动", "草药炼剂"],
  ["药巫行动", "愈灵修复"],
  ["村民行动", "灵织守夜"],
];

let changed = 0;
for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  for (const [from, to] of reps) {
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
