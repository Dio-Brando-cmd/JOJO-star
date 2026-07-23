// Final comprehensive project name fix - all remaining old branding
const fs = require('fs');
const path = require('path');

function findFiles(dir, exts) {
  const results = [];
  try {
    for(const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      if(entry.name === 'node_modules' || entry.name === '.git' || entry.name.endsWith('.bak')) continue;
      const fp = path.join(dir, entry.name);
      if(entry.isDirectory()) results.push(...findFiles(fp, exts));
      else if(exts.some(e => entry.name.endsWith(e))) results.push(fp);
    }
  } catch(e) {}
  return results;
}

const targets = process.argv.slice(2);
const exts = ['.js','.jsx','.html','.css','.json','.txt','.md','.sh','.ps1','.py','.cs','.yml','.yaml'];

let totalChanged = 0;
let totalFiles = 0;

for (const dir of targets) {
  const files = findFiles(dir, exts);
  totalFiles += files.length;
  console.log(`\n=== ${dir} (${files.length} files) ===`);

  for (const fp of files) {
    let c = fs.readFileSync(fp, 'utf-8');
    let m = false;

    const reps = [
      // === Deployment paths & PM2 names ===
      ["'/opt/werewolf-server'", "'/opt/veilland-server'"],
      ['"/opt/werewolf-server"', '"/opt/veilland-server"'],
      ['/opt/werewolf-server', '/opt/veilland-server'],
      ['/opt/werewolf/client', '/opt/veilland/client'],
      ['/opt/werewolf/server', '/opt/veilland/server'],
      ['C:\\werewolf', 'C:\\veilland'],
      ["pm2 restart werewolf-server", "pm2 restart veilland-server"],
      ["pm2 start index.js --name werewolf-server", "pm2 start index.js --name veilland-server"],
      ["pm2 restart werewolf", "pm2 restart veilland"],
      ["--name werewolf-server", "--name veilland-server"],
      ["--name werewolf", "--name veilland"],

      // === Salt values ===
      ["'werewolf-server-salt-2024'", "'veilland-server-salt-2.13'"],
      ["'werewolf-prod-salt-1.4.0'", "'veilland-prod-salt-2.13'"],
      ["'werewolf-room-salt-1.4.0'", "'veilland-room-salt-2.13'"],
      ["'werewolf-user-salt-2024-v2'", "'veilland-user-salt-2.13'"],

      // === Download URLs ===
      ["'/download/werewolf.apk'", "'/download/veilland.apk'"],

      // === Comments and console logs ===
      ["// 狼人杀 —", "// 帷幕之地 —"],
      ["// 狼人杀 ", "// 帷幕之地 "],
      ["# 狼人杀 —", "# 帷幕之地 —"],
      ["# 狼人杀 ", "# 帷幕之地 "],
      ["🐺 狼人杀 —", "🌑 帷幕之地 —"],
      ["🐺 狼人杀 ", "🌑 帷幕之地 "],
      ["'🐺 狼人杀实时监控面板'", "'🌑 帷幕之地实时监控面板'"],
      ["'🐺 狼人杀性能测试'", "'🌑 帷幕之地性能测试'"],
      ["狼人杀 3D", "帷幕之地 3D"],
      ["狼人杀 Blender", "帷幕之地 Blender"],
      ["狼人杀 — 自动部署", "帷幕之地 — 自动部署"],
      ["狼人杀 — 部署", "帷幕之地 — 部署"],
      ["狼人杀桌面版", "帷幕之地桌面版"],
      ["狼人杀在线联机版", "帷幕之地"],
      ["狼人杀服务器", "帷幕之地服务器"],
      ["狼人杀 - 修正版", "帷幕之地 - 修正版"],
      ["狼人杀实时监控面板", "帷幕之地实时监控面板"],
      ["狼人杀 性能测试", "帷幕之地 性能测试"],
      ["狼人杀项目", "帷幕之地项目"],
      ["狼人杀部署", "帷幕之地部署"],
      ["部署狼人杀", "部署帷幕之地"],

      // === Project descriptions ===
      ['"description": "狼人杀在线联机版 - PC桌面多人联机游戏"', '"description": "帷幕之地 · 灵焰纪元 — 暗黑奇幻多人联机游戏"'],

      // === README headers ===
      ["# 🐺 狼人杀在线联机版", "# 🌑 帷幕之地 · 灵焰纪元"],
      ["# 🐺 狼人杀", "# 🌑 帷幕之地"],

      // === Windows deploy script ===
      ['"Werewolf Game Port 4000"', '"VeilLand Game Port 4000"'],
      ['"Werewolf HTTP Port 80"', '"VeilLand HTTP Port 80"'],
      ['"部署狼人杀服务端"', '"部署帷幕之地服务端"'],
      ['"狼人杀部署完成！"', '"帷幕之地部署完成！"'],

      // === Docker ===
      ['werewolf-deploy.tar.gz', 'veilland-deploy.tar.gz'],
      ['werewolf.tar.gz', 'veilland.tar.gz'],

      // === HTML build artifacts (dist, android) ===
      ["<title>狼人杀 - 在线联机版</title>", "<title>帷幕之地 · 灵焰纪元</title>"],
      ['content="狼人杀"', 'content="帷幕之地"'],

      // === Unity scripts ===
      ['"Tools/Werewolf/', '"Tools/VeilLand/'],
      ['"com.werewolf.veilland"', '"com.veilland.online"'],
      ['"Werewolf Studio"', '"VeilLand Studio"'],
      ['Werewolf project fully configured', 'VeilLand project fully configured'],
      ['狼人杀Node.js服务端', '帷幕之地Node.js服务端'],
      ['"狼人行动"', '"蚀者行动"'],
      ['case "WEREWOLF":', 'case "CORRUPTED":'],

      // === Blender scripts ===
      ['"werewolf_models"', '"veilland_models"'],
      ['"Werewolf_Models"', '"VeilLand_Models"'],
      ['"Werewolf_Models_HD"', '"VeilLand_Models_HD"'],
      ['werewolf_utils.py', 'veilland_utils.py'],
      ["'werewolf': ('狼人', 'WEREWOLF')", "'corrupted': ('蚀者', 'CORRUPTED')"],
      ["'alpha_wolf': ('种狼', 'ALPHA_WOLF')", "'nether_monk': ('冥僧人', 'NETHER_MONK')"],
      ["role_id in ('werewolf', 'alpha_wolf')", "role_id in ('corrupted', 'nether_monk')"],
      ['add_wolf_head', 'add_corrupted_head'],
      ['_wolf_head', '_corrupted_head'],
      ['_wolf', '_corrupted'],
      ['"werewolf_all_characters.glb"', '"veilland_all_characters.glb"'],
      ['"werewolf_silenthill_map.glb"', '"veilland_silenthill_map.glb"'],
      ['f"werewolf_{', 'f"veilland_{'],

      // === GUI text in Unity ===
      ['"种狼屋", "蚀者屋"', '"冥僧庇护所", "蚀者庇护所"'],
      ['"猎人屋", "守卫屋"', '"追猎者庇护所", "帷幕守卫庇护所"'],

      // === CSS class names (visual only, safe to change) ===
      ['.order-step.wolf', '.order-step.corrupted'],
      ['.team-badge.WOLF', '.team-badge.CORRUPTED'],
      ['.reveal-team.WOLF', '.reveal-team.CORRUPTED'],
      ['.role-option.WOLF', '.role-option.CORRUPTED'],
      ['.config-role-tag.WOLF', '.config-role-tag.CORRUPTED'],
      ['.detail-tag.wolf', '.detail-tag.corrupted'],
      ['.ally-tag.wolf', '.ally-tag.corrupted'],

      // === CSS variables ===
      ["--wolf: #6b3fa0", "--corrupted: #6b3fa0"],
      ["var(--wolf)", "var(--corrupted)"],
      ["--color-wolf: #8b0c0c", "--color-corrupted: #6b3fa0"],

      // === Remaining wolf text in Chinese ===
      ["抵御一次狼人", "抵御一次蚀者噬灵"],
      ["狼人肆虐后", "蚀痕蔓延后"],
      ["没有狼人敢靠近", "没有蚀者敢靠近"],
      ["狼人的裂隙共鸣", "蚀者的裂隙共鸣"],
      ["感知附近狼人", "感知附近蚀者"],
      ["查出的狼人", "查出的蚀者"],
      ["狼人想要", "蚀者想要"],
      ["狼嚎在帷幕之地回荡", "蚀痕在帷幕之地蔓延"],
      ["进入你家的狼人", "进入庇护所的蚀者"],
      ["狼人获胜", "蚀者获胜"],
      ["狼人数量不少于好人", "蚀者数量不少于守幕者"],
      ["所有狼人已出局", "所有蚀者已出局"],
      ["不告知狼人彼此身份", "不告知蚀者彼此身份"],
      ["AI狼人自动狩猎", "AI蚀者自动噬灵"],
    ];

    for (const [from, to] of reps) {
      if (from === to) continue;
      if (c.includes(from)) { c = c.split(from).join(to); m = true; }
    }

    if (m) { fs.writeFileSync(fp, c, 'utf-8'); totalChanged++; console.log('  ' + path.basename(fp)); }
  }
}

console.log(`\nChanged ${totalChanged} of ${totalFiles} files`);
