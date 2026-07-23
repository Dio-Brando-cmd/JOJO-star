// Third-pass: fix remaining hardcoded Chinese UI text in components
const fs = require('fs');
const path = require('path');

function findFiles(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.git' || file.endsWith('.bak')) continue;
    const fp = path.join(dir, file);
    try { const st = fs.statSync(fp); if (st.isDirectory()) results.push(...findFiles(fp)); else if (/\.(js|jsx)$/.test(file)) results.push(fp); } catch(e) {}
  }
  return results;
}

const files = findFiles(process.argv[2]);

const reps = [
  // === NightPhase.jsx UI text ===
  ["{/* 种狼特殊：告知被感染者 */}", "{/* 冥僧人特殊：告知被堕化者 */}"],
  ['📢 告知被感染者', '📢 告知被堕化者'],
  ['向被你感染的玩家揭露你的身份', '向被你堕化的玩家揭露你的身份'],
  ["{/* 使用能力（非村民角色） */}", "{/* 使用能力（专业守幕者） */}"],
  ["{/* 帷幕低语（村民专属） */}", "{/* 帷幕低语（灵织者专属） */}"],
  ['// 冥僧步骤只能变身/感染；刀人在蚀者步骤进行', '// 冥僧步骤只能蚀变/堕化；噬灵在蚀者步骤进行'],
  ['<span>🔪 刀人（作为狼群一员选择击杀目标）</span>', '<span>🌑 噬灵（作为蚀者群一员选择噬灵目标）</span>'],
  ['<span>🔮 查验目标是否是好人</span>', '<span>👁️ 察灵目标是否被蚀痕沾染</span>'],
  ['<span>💚 使用万能药（可治疗一切，包括灵蚀重伤）</span>', '<span>💫 灵焰修复（可修复一切灵焰损伤，包括灵蚀重伤）</span>'],
  ['<span>🔫 猎枪 — 观察目标是否出门，可以射杀（带出门会腐蚀，留在家中安全）</span>', '<span>🔫 灵焰猎枪 — 观察目标是否夜行，可以射杀（带出会腐蚀，留庇护所安全）</span>'],
  ['<span>💥 短火铳 — 受到攻击时反杀（带出门会腐蚀，只能保一晚）</span>', '<span>💥 噬灭短铳 — 受到攻击时反杀（带出会腐蚀，只能保一晚）</span>'],
  ['<span>🎯 使用猎枪射杀目标（开枪后猎枪消耗，无论是否出门）</span>', '<span>🎯 使用灵焰猎枪射杀目标（开枪后猎枪消耗）</span>'],
  ["[ROLES.NETHER_MONK]: '变狼 / 感染 / 刀人'", "[ROLES.NETHER_MONK]: '蚀变 / 堕化 / 噬灵'"],
  ["[ROLES.CORRUPTED]: '刀人（锁定人，不锁定屋）'", "[ROLES.CORRUPTED]: '噬灵（锁定灵焰，不锁定庇护所）'"],
  ["[ROLES.VEIL_SCHOLAR]: '查验一个人是否是好人'", "[ROLES.VEIL_SCHOLAR]: '察灵辨识纯净或蚀痕'"],
  ["[ROLES.SPIRIT_MENDER]: '万能药 / 毒药'", "[ROLES.SPIRIT_MENDER]: '灵焰修复 / 蚀痕净化'"],
  ["[ROLES.FLAME_TRACKER]: '观察 + 猎枪 / 短火铳'", "[ROLES.FLAME_TRACKER]: '观察 + 灵焰猎枪 / 噬灭短铳'"],
  ['// 普通狼人 + 种狼（种狼在变身/感染后算蚀者群，私密状态可能尚未更新故一律放行）', '// 蚀者 + 冥僧人（冥僧人在蚀变/堕化后算蚀者群）'],

  // === PlayerList.jsx ===
  ["`村民${player.weaverIndex || ''}`", "`灵织者${player.weaverIndex || ''}`"],

  // === RoleCard.jsx ===
  ['（含表层身份、村民类型、新能力状态）', '（含表层身份、灵织者类型、新能力状态）'],
  ['猎枪可用', '灵焰猎枪可用'],
  ['短火铳可用', '噬灭短铳可用'],
  ['即将变狼', '即将蚀变'],
  ["{/* 村民特有状态 */}", "{/* 灵织者特有状态 */}"],

  // === RoleSelector.jsx ===
  ['支持同名角色多选（如2狼人、3村民）', '支持同名角色多选（如2蚀者、3灵织者）'],

  // === RoleSVG ===
  ['{/* 猎枪 */}', '{/* 灵焰猎枪 */}'],

  // === RoleIntroModal.jsx (partial - these are the worst offenders) ===
  ['<strong>变狼</strong>：变身为狼人形态。变狼前不会被察灵家查出。', '<strong>蚀变</strong>：灵焰完全蚀变，可在蚀者步骤一起噬灵。蚀变前察灵显示为纯净。'],
  ['<strong>狼群激素</strong>（被动）：每有一只狼人被投票出局，获得一次额外感染机会。', '<strong>裂隙引导</strong>（被动）：每次有蚀者被放逐，获得一次额外堕化机会。'],
  ["name: '狼人'", "name: '蚀者'"],
  ['<strong>相认机制</strong>：去另一蚀者庇护所则双方相认。互刀则相认不死。', '<strong>共鸣机制</strong>：去另一蚀者庇护所则双方共鸣。互噬则不死。'],
  ['<strong>嚎叫召集</strong>：放弃刀人，发出嚎叫。所有未相认的狼人听到召唤，下回合相认概率翻倍。冷却2回合。', '<strong>裂隙共鸣</strong>：放弃噬灵，发出裂隙信号。所有未共鸣的蚀者收到召唤，下回合共鸣概率翻倍。冷却2蚀月。'],
  ['<strong>伪装</strong>：伪装成好人出门，计入屋子人数，不暴露狼人身份。代价：当晚不能刀人。', '<strong>灵焰遮蔽</strong>：掩盖蚀痕出门，计入人数，不暴露蚀者身份。代价：当晚不能噬灵。'],
  ['<strong>查验</strong>：每夜查验一名玩家，获知"好人"或"狼人"。白天查看目标头像：金色=好人，银白=狼人。', '<strong>察灵</strong>：每晚察灵一名玩家，辨识灵焰纯净或蚀痕。白昼查看目标：金色=守幕者，暗紫=蚀者。'],
  ['狼人不能攻击该屋内的人', '蚀者不能攻击该屋内的人'],
  ['蚀灭符阵可击穿', '蚀灭符阵可击穿'],
  ['获知今晚哪些屋子有狼人进入', '获知今晚哪些屋子有蚀者进入'],
  ['老猎人：20%概率识破进入自家的狼人', '老兵灵织者：20%概率识破进入庇护所的蚀者'],
  ['本局狼人杀共有', '本局帷幕之地共有'],
  ['className="order-step wolf">🐺 狼人群', 'className="order-step corrupted">🌑 蚀者群'],
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
