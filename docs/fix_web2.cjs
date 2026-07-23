// Aggressive cleanup of all remaining wolf/brand references in client
const fs = require('fs');
const path = require('path');

function findFiles(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file.endsWith('.bak')) continue;
    const fp = path.join(dir, file);
    try { const st = fs.statSync(fp); if (st.isDirectory()) results.push(...findFiles(fp)); else if (/\.(js|jsx|html|css)$/.test(file)) results.push(fp); } catch(e) {}
  }
  return results;
}

const files = findFiles(process.argv[2]);
console.log(`Found ${files.length} files`);

const reps = [
  // === Emoji replacements ===
  ["brand-icon'>🐺<", "brand-icon'>🌑<"],
  ["<span>🐺</span>", "<span>🌑</span>"],
  ["'👑🐺'", "'🕯️🌑'"],
  ["icon: '👑🐺'", "icon: '🕯️🌑'"],
  ["'🔮'", "'👁️'"],
  ["icon: '🐺'", "icon: '🌑'"],
  ["hero-icon'>🐺<", "hero-icon'>🌑<"],
  ["logo-icon'>🐺<", "logo-icon'>🌑<"],

  // === Role names in UI ===
  ["name: '种狼'", "name: '冥僧人'"],
  ["name: '狼人'", "name: '蚀者'"],
  ["name: '察灵家'", "name: '帷幕学者'"],
  ["name: '毒巫'", "name: '草药学者'"],
  ["name: '药巫'", "name: '愈灵师'"],
  ["name: '守卫'", "name: '帷幕守卫'"],
  ["name: '猎人'", "name: '灵痕追猎者'"],
  ["name: '村民'", "name: '灵织者'"],

  // === UI Chinese text ===
  ["🐺狼人", "🌑蚀者"],
  ["👥好人", "✨守幕者"],
  ["狼人数量不能≥好人数量", "蚀者数量不能≥守幕者数量"],
  ["狼人群", "蚀者群"],
  ["狼人开始行动", "蚀者开始噬灵"],
  ["狼人 组", "蚀者 组"],

  // === Phase transition ===
  ["'狼人开始行动'", "'蚀者开始噬灵'"],

  // === NightPhase text ===
  ["变狼（变狼后可在蚀者步骤与同伴一起刀人）", "蚀变（蚀变后可在蚀者步骤与同伴一起噬灵）"],
  ["感染目标（下个夜晚生效；使用后当前夜晚算狼人）", "堕化目标（下个蚀月生效；使用后当前夜晚算蚀者）"],
  ["你已变狼，今晚随狼群一起行动（本步骤自动视为刀人目标选择）", "你已蚀变，今晚随蚀者群一起行动（本步骤自动视为噬灵目标选择）"],
  ["普通狼人 + 种狼（种狼在变身/感染后算狼人群，私密状态可能尚未更新故一律放行）", "蚀者 + 冥僧人（冥僧人在蚀变/堕化后算蚀者群，私密状态可能尚未更新故一律放行）"],
  ["狼人在冥僧步骤不醒，除非是种狼", "蚀者在冥僧步骤不醒，除非是冥僧人"],

  // === RoleCard log text ===
  ["已变狼", "已蚀变"],
  ["已感染", "已堕化"],
  ["🐺 你感知到另一名蚀者！", "🌑 你感知到另一名蚀者！"],
  ["🐺 蚀者们已共鸣，下回合可协同行动", "🌑 蚀者们已共鸣，下蚀月可协同行动"],
  ["你遇到了另一只狼人", "你感知到另一名蚀者"],
  ["狼人们已相认", "蚀者们已共鸣"],
  ["两只狼人互刀", "两名蚀者互噬"],
  ["种狼完成了变狼", "冥僧人完成了蚀变"],
  ["播种感染了预言家", "冥僧人堕化了帷幕学者"],
  ["自己变成了村民", "自己转化为灵织者"],
  ["变为狼人", "蚀变为蚀者"],
  ["已变为狼人", "已蚀变为蚀者"],
  ["你已蚀变为蚀者！", "你已蚀变为蚀者！"],
  ["种狼试图感染你", "冥僧人试图堕化你"],
  ["但你保留了预言能力", "但你保留了察灵能力"],
  ["狼人相关", "蚀者相关"],
  ["狼人特有状态", "蚀者特有状态"],
  ["狼人袭击了某个目标", "蚀者噬灵了某个目标"],
  ["有人被解药救活", "有人被愈灵符救回"],
  ["万能药救活了一人", "灵焰修复救回了一人"],
  ["毒药转移到了别人身上", "蚀灭符转移到了别人身上"],
  ["猎人的短火铳", "追猎者的噬灭短铳"],
  ["变成了狼人", "蚀变为蚀者"],
  ["有人变成了狼人", "有人蚀变为蚀者"],
  ["被狼人攻击", "被蚀者攻击"],

  // === RoleCard comments ===
  ["// 狼人相认", "// 蚀者共鸣"],
  ["金色=好人，银白=狼人", "金色=守幕者，暗紫=蚀者"],

  // === PlayerList ===
  ["好人 ✅", "守幕者 ✅"],  // but not inside code - careful

  // === GameBoard ===
  ["return <span>🐺", "return <span>🌑"],

  // === VoiceChat ===
  ["狼人杀需要使用", "帷幕之地需要使用"],

  // === RoleSelector config ===
  ["desc: '夜晚噬灵，锁定灵焰而非庇护所'", "desc: '夜晚噬灵，吞噬他人灵焰'"],
  ["desc: '可堕化/蚀变/噬灵'", "desc: '堕化他人·蚀变·噬灵·灵焰遮蔽'"],

  // === 狼人 → 蚀者 (general) ===
  ["是狼人", "是蚀者"],
  ["为狼人", "为蚀者"],
  ["狼人身份", "蚀者身份"],
  ["算狼人", "算蚀者"],
  ["狼人相认", "蚀者共鸣"],
  ["狼人群", "蚀者群"],

  // === 好人 → 守幕者 (UI labels) ===
  ["'好人'", "'守幕者'"],
  ["查出好人", "查出守幕者"],

  // === 查验 → 察灵 ===
  ["查验结果", "察灵结果"],

  // === 预言家 → 帷幕学者 ===
  ["预言能力", "察灵能力"],
  ["预言结果", "察灵结果"],
  ["预言家查验", "帷幕学者察灵"],
];

let changed = 0;
for (const fp of files) {
  let c = fs.readFileSync(fp, 'utf-8');
  let m = false;
  for (const [from, to] of reps) {
    if (from === to) continue;
    if (c.includes(from)) { c = c.split(from).join(to); m = true; }
  }
  if (m) { fs.writeFileSync(fp, c, 'utf-8'); changed++; console.log('  ' + path.basename(fp)); }
}
console.log(`Changed ${changed}/${files.length}`);
