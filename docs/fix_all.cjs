// AGGRESSIVE global replacement for ALL remaining old references
const fs = require('fs');
const path = require('path');

function findFiles(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file.endsWith('.bak')) continue;
    const fp = path.join(dir, file);
    try {
      const st = fs.statSync(fp);
      if (st.isDirectory()) { results.push(...findFiles(fp)); }
      else if (/\.(js|jsx|html|css|txt|json)$/.test(file)) { results.push(fp); }
    } catch(e) {}
  }
  return results;
}

// These are GLOBAL text replacements - no context, just raw string replace
const globalReps = [
  // Property names (all contexts)
  ["villagerType", "weaverType"],
  ["villagerName", "weaverName"],
  ["villagerTitle", "weaverTitle"],
  ["villagerIndex", "weaverIndex"],
  ["Villager", "Weaver"],

  // Poison → Corrosion/Talisman
  ["poisonFogTarget", "corrosionMistTarget"],
  ["poisonFogActive", "corrosionMistActive"],
  ["poisonFog", "corrosionMist"],
  ["poisonMaterials", "talismanMaterials"],
  ["POISON_FOG", "CORROSION_MIST"],

  // Herb garden
  ["herbGardenPlanted", "talismanChargeStarted"],
  ["herbGarden", "talismanGarden"],

  // Pack hormone
  ["packHormoneBonus", "riftGuidanceBonus"],
  ["packHormone", "riftGuidance"],

  // Chinese text fixes
  ["偷听", "帷幕低语"],
  ["狼人入侵", "蚀者噬灵"],
  ["被狼人攻击", "被蚀者攻击"],
  ["被狼人转化", "被蚀者转化"],
  ["识别进入自家的狼人", "识别进入庇护所的蚀者"],
  ["抵御一次狼人入侵", "抵御一次蚀者噬灵"],
  ["织布女村民", "织幕灵织者"],
  ["我是村民，听神职带队", "我是灵织者，听大家带队"],
  ["大家跟察灵家走", "大家跟帷幕学者走"],
  ["草药师：", "学徒灵织者："],
  ["铁匠：", "锻甲灵织者："],
  ["守夜人：", "守夜灵织者："],
  ["商人：", "行路灵织者："],

  // Type string values in code (not constants)
  ["weaverType === 'OLD_HUNTER'", "weaverType === 'OLD_VETERAN'"],
  ["weaverType !== 'OLD_HUNTER'", "weaverType !== 'OLD_VETERAN'"],
  ["weaverType === 'MERCHANT'", "weaverType === 'WANDERING_TRADER'"],
  ["weaverType !== 'MERCHANT'", "weaverType !== 'WANDERING_TRADER'"],
  ["weaverType === 'HERBALIST'", "weaverType === 'SPIRIT_APPRENTICE'"],
  ["weaverType !== 'HERBALIST'", "weaverType !== 'SPIRIT_APPRENTICE'"],
  ["weaverType === 'STORYTELLER'", "weaverType === 'CHRONICLER'"],
  ["weaverType === 'NIGHT_WATCHER'", "weaverType === 'NIGHT_SENTINEL'"],
  ["weaverType !== 'NIGHT_WATCHER'", "weaverType !== 'NIGHT_SENTINEL'"],
  ["weaverType === 'BAKER'", "weaverType === 'HEARTH_KEEPER'"],
  ["weaverType === 'BLACKSMITH'", "weaverType === 'ARMOR_SMITH'"],
  ["weaverType !== 'BLACKSMITH'", "weaverType !== 'ARMOR_SMITH'"],
  ["weaverType === 'WEAVER'", "weaverType === 'VEIL_WEAVER'"],

  // Fix "者者" double-ups
  ["者者", "者"],

  // Fix "WeaverWeaver" → "Weaver"
  ["WeaverWeaver", "Weaver"],

  // Fix double "OLD_VETERAN" type issues
  ["'OLD_VETERAN'", "'OLD_VETERAN'"], // idempotent

  // Fix any remaining "村民" that should be "灵织者" (in UI contexts, not backstory)
  ["村民子类型", "灵织者子类型"],
];

const dirs = process.argv.slice(2);
let totalChanged = 0;
let totalFiles = 0;

for (const dir of dirs) {
  const files = findFiles(dir);
  totalFiles += files.length;
  console.log(`Scanning ${dir}: ${files.length} files`);

  for (const filePath of files) {
    let c = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    for (const [from, to] of globalReps) {
      if (from === to) continue;
      if (c.includes(from)) {
        c = c.split(from).join(to);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, c, 'utf-8');
      totalChanged++;
      console.log(`  ✓ ${path.basename(filePath)}`);
    }
  }
}

console.log(`\nChanged ${totalChanged} of ${totalFiles} files`);
