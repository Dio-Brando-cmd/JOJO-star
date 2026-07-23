// Fix critical bugs in Player.js and related files
const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let c = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  const fixes = [
    // === Player.js CRITICAL fixes ===
    // Import
    ["import { ROLES, ROLE_TEAM, VILLAGER_TYPES }", "import { ROLES, ROLE_TEAM, SPIRIT_WEAVER_TYPES }"],

    // Property names
    ["this.villagerType", "this.weaverType"],
    ["this.villagerName", "this.weaverName"],
    ["this.villagerTitle", "this.weaverTitle"],
    ["this.villagerIndex", "this.weaverIndex"],

    // Methods
    ["getVillagerAbilityDescription()", "getWeaverAbilityDescription()"],

    // Old poison names
    ["this.poisonFogTarget", "this.corrosionMistTarget"],
    ["this.poisonFogActive", "this.corrosionMistActive"],
    ["this.poisonMaterials", "this.talismanMaterials"],
    ["this.poisonTarget", "this.sealTarget"],

    // Old herb garden
    ["this.herbGardenPlanted", "this.talismanChargeStarted"],

    // Old pack hormone
    ["this.packHormoneBonus", "this.riftGuidanceBonus"],
    ["packHormoneBonus", "riftGuidanceBonus"],

    // Comments
    ["// ---- 种狼特有 ----", "// ---- 冥僧人特有 ----"],
    ["// ---- 狼人特有 ----", "// ---- 蚀者特有 ----"],
    ["// ---- 猎人特有 ----", "// ---- 灵痕追猎者特有 ----"],
    ["// ---- 女巫特有 ----", "// ---- 草药学者/愈灵师特有 ----"],
    ["// ---- 药巫特有 ----", "// ---- 愈灵师特有 ----"],
    ["// ---- 察灵家特有 ----", "// ---- 帷幕学者特有 ----"],
    ["// ---- 村民特有 ----", "// ---- 灵织者特有 ----"],
    ["  // 村民子类型", "  // 灵织者子类型"],
    ["  // 村民名字", "  // 灵织者名字"],
    ["  // 村民称号", "  // 灵织者称号"],
    ["  // 村民扩展状态", "  // 灵织者扩展状态"],

    // Villager ability descriptions - fix old terms
    ["识别进入自家的狼人", "识别进入庇护所的蚀者"],
    ["抵御一次狼人入侵", "抵御一次蚀者噬灵"],
    ["偷听线索排除干扰项", "帷幕低语排除干扰项"],
    ["可感知谁进过自己家", "可感知谁进入过自己的庇护所"],
    ["被投票出局时随机带走一名投票者", "被放逐时随机带走一名投票者"],
    ["可推迟目标死亡1回合", "可推迟目标灵焰消散1蚀月"],
    ["草药识别：感知谁被毒过", "灵植辨识：感知谁被蚀灭符阵波及"],

    // JSON serialization
    ["poisonMaterials: isWitch ? this.poisonMaterials", "talismanMaterials: isWitch ? this.talismanMaterials"],
    ["poisonFogActive: this.poisonFogActive", "corrosionMistActive: this.corrosionMistActive"],

    // isWolf() - keep method name for compat but the check is already correct
    // isVillager() - keep name but make sure implementation correct

    // Double "者者" fix
    ["者者", "者"],
  ];

  for (const [from, to] of fixes) {
    if (from === to) continue;
    if (c.includes(from)) {
      c = c.split(from).join(to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, c, 'utf-8');
    console.log('Fixed: ' + path.basename(filePath));
  }
  return modified;
}

// Fix all key files
const files = process.argv.slice(2);
let count = 0;
for (const f of files) {
  if (fixFile(f)) count++;
}
console.log(`Fixed ${count} of ${files.length} files`);
