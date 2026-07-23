// Fix all remaining "狼人杀" / "werewolf" references in client files
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
      if (st.isDirectory()) results.push(...findFiles(fp));
      else if (/\.(js|jsx|html|css|json|txt)$/.test(file)) results.push(fp);
    } catch(e) {}
  }
  return results;
}

const files = findFiles(process.argv[2]);
console.log(`Found ${files.length} files`);

const reps = [
  // === localStorage keys ===
  ["'werewolf_show_name'", "'veilland_show_name'"],
  ["'werewolf_server_url'", "'veilland_server_url'"],
  ["'werewolf_bgm_enabled'", "'veilland_bgm_enabled'"],
  ["'werewolf_bgm_volume'", "'veilland_bgm_volume'"],
  ["'werewolf_bgm_track'", "'veilland_bgm_track'"],
  ["'werewolf_bgm_phase_tracks'", "'veilland_bgm_phase_tracks'"],

  // === Package/config names ===
  ['"name": "werewolf-client"', '"name": "veilland-client"'],
  ['"appId": "com.werewolf.online"', '"appId": "com.veilland.online"'],
  ['"appName": "狼人杀"', '"appName": "帷幕之地"'],

  // === UI text ===
  ['<span className="brand-text">狼人杀</span>', '<span className="brand-text">帷幕之地</span>'],
  ['狼人杀</h1>', '帷幕之地</h1>'],
  ['狼人杀官网', '帷幕之地官网'],
  ['狼人杀 - 在线联机版', '帷幕之地 - 在线联机版'],

  // === Email/text references ===
  ['werewolf.game@outlook.com', 'veilland.game@outlook.com'],
  ['© 2026 Werewolf Online. 为朋友聚会而生', '© 2026 帷幕之地 VeilLand. 在灵焰的微光中守望'],

  // === Code identifiers ===
  ["ua.includes('Werewolf')", "ua.includes('VeilLand')"],
  ["ua.includes('WerewolfApp')", "ua.includes('VeilLandApp')"],

  // === Component names ===
  ['WerewolfSilhouette', 'VeilLandSilhouette'],

  // === Comment references ===
  ['狼人杀官网 —— 联系我们页面', '帷幕之地官网 —— 联系我们页面'],
  ['狼人杀官网 —— 下载PC端页面', '帷幕之地官网 —— 下载PC端页面'],
  ['狼人杀官网 —— 首页', '帷幕之地官网 —— 首页'],
  ['狼人杀 性能测试工具库', '帷幕之地 性能测试工具库'],

  // === CSS comments ===
  ['狼人杀 —— 全局样式', '帷幕之地 —— 全局样式'],
  ['狼人杀 Token', '帷幕之地 Token'],
  ['狼人杀 设计 Token 系统', '帷幕之地 设计 Token 系统'],
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
