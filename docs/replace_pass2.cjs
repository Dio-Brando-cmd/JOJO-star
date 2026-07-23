// Second-pass replacement: handle plain strings, Chinese UI text, branding
const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2];
if (!targetDir) { console.error('Usage: node replace_pass2.cjs <directory>'); process.exit(1); }

function findFiles(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file.endsWith('.bak')) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) { results.push(...findFiles(fullPath)); }
    else if (/\.(js|jsx|html|css|txt|json)$/.test(file)) { results.push(fullPath); }
  }
  return results;
}

const files = findFiles(targetDir);
console.log(`Found ${files.length} source files`);

// Ordered replacements: plain string constants → Chinese text → branding
const reps = [
  // === Plain string role references (used in switch/case, comparisons) ===
  ["role === 'WEREWOLF'", "role === 'CORRUPTED'"],
  ["role === 'ALPHA_WOLF'", "role === 'NETHER_MONK'"],
  ["role === 'SEER'", "role === 'VEIL_SCHOLAR'"],
  ["role === 'POISON_WITCH'", "role === 'HERBAL_SAGE'"],
  ["role === 'HEAL_WITCH'", "role === 'SPIRIT_MENDER'"],
  ["role === 'VILLAGER'", "role === 'SPIRIT_WEAVER'"],
  ["role === 'GUARD'", "role === 'VEIL_GUARDIAN'"],
  ["role === 'HUNTER'", "role === 'FLAME_TRACKER'"],

  // String arrays with roles
  ["'WEREWOLF', 'ALPHA_WOLF'", "'CORRUPTED', 'NETHER_MONK'"],
  ["['WEREWOLF', 'ALPHA_WOLF']", "['CORRUPTED', 'NETHER_MONK']"],
  ["roles: ['ALPHA_WOLF']", "roles: ['NETHER_MONK']"],
  ["roles: ['WEREWOLF', 'ALPHA_WOLF']", "roles: ['CORRUPTED', 'NETHER_MONK']"],
  ["roles: ['POISON_WITCH']", "roles: ['HERBAL_SAGE']"],
  ["roles: ['HEAL_WITCH']", "roles: ['SPIRIT_MENDER']"],
  ["roles: ['VILLAGER']", "roles: ['SPIRIT_WEAVER']"],
  ["roles: ['GUARD']", "roles: ['VEIL_GUARDIAN']"],
  ["roles: ['HUNTER']", "roles: ['FLAME_TRACKER']"],
  ["roles: ['SEER']", "roles: ['VEIL_SCHOLAR']"],

  // Object keys with role/step names (night_step_names, configs etc)
  ["'ALPHA_WOLF': '冥僧人'", "'NETHER_MONK': '冥僧人'"],

  // === Handler validation text ===
  ["'角色配置不合法：必须包含至少1狼人、至少1好人，且不能全狼人'",
   "'角色配置不合法：必须包含至少1蚀者、至少1守幕者，且不能全蚀者'"],

  // === Chinese text in UI and logs ===
  ["种狼告知被感染者", "冥僧人告知被堕化者"],
  ["种狼告知", "冥僧告知"],
  ["被种狼感染", "被冥僧人堕化"],
  ["种狼感染了预言家", "冥僧人堕化了帷幕学者"],
  ["已被感染", "已被堕化"],
  ["变为狼人", "蚀变为蚀者"],
  ["变成了狼人", "蚀变为蚀者"],
  ["下个夜晚将变为狼人", "下个蚀月将蚀变"],
  ["你已变为狼人", "你已蚀变，成为蚀者"],

  // Night logs
  ["狼人袭击了某个目标", "蚀者噬灵了某个目标"],
  ["有人被解药救活", "有人被愈灵汤剂救回"],
  ["万能药救活了一人", "灵焰修复救回了一人"],
  ["毒药转移", "蚀痕净化转移"],
  ["狼人攻击", "蚀者噬灵"],
  ["狼人击杀", "蚀者噬灵"],
  ["毒雾陷阱触发", "蚀雾陷阱触发"],

  // UI labels
  ["找出狼人", "辨识蚀者"],
  ["狼人胜", "蚀者胜"],
  ["好人胜", "守幕者胜"],
  ["村民偷听", "灵织低语"],
  ["守卫重伤", "灵蚀重伤"],
  ["种狼步骤", "冥僧步骤"],
  ["狼人步骤", "蚀者步骤"],

  // Story/event text
  ["狼人同伴相认", "蚀者共鸣相认"],
  ["两只狼人互刀", "两名蚀者互噬"],
  ["狼人已相认", "蚀者已共鸣"],
  ["狼人们已相认", "蚀者们已共鸣"],
  ["你遇到了另一只狼人", "你感知到另一名蚀者"],
  ["狼人试图破门而入", "蚀者试图穿越庇护所"],
  ["狼人袭击", "蚀者噬灵"],
  ["被狼人攻击", "被蚀者噬灵"],

  // Brand name (keep old download filenames for backward compat but update display names)
  ["狼人杀在线联机版", "帷幕之地 在线联机版"],
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
