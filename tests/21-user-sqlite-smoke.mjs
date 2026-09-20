// tests/21-user-sqlite-smoke.mjs — SQLite 用户层冒烟测试（不连线上服，用临时数据目录）
// 运行: node tests/21-user-sqlite-smoke.mjs
// 覆盖: 旧 JSON 迁移、bcrypt 注册/登录、旧 HMAC 哈希 rehash、统计、回放、备份生成
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'veilland-sqlite-'));
const SALT = 'veilland-user-salt-2.13';

// 模拟旧 JSON 数据（迁移源，密码是旧版 HMAC-SHA256）
fs.writeFileSync(path.join(TMP, 'users.json'), JSON.stringify({
  legacy_user: {
    username: 'legacy_user',
    password: crypto.createHmac('sha256', SALT).update('pw1234').digest('hex'),
    createdAt: 1234567890,
    lastLogin: null,
    stats: { gamesPlayed: 3, wins: 2, losses: 1, winRate: 67 },
  },
}));
fs.writeFileSync(path.join(TMP, 'replays.json'), JSON.stringify({ legacy_user: [] }));

// 必须在 import 之前设置，UserManager 顶层读 VEILLAND_DATA_DIR
process.env.VEILLAND_DATA_DIR = TMP;
const { UserManager } = await import('../server/src/auth/UserManager.js');

const um = new UserManager();
let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
};

// 1. 迁移：旧用户(HMAC) 能登录，且登录后被 rehash 成 bcrypt
const legacyLogin = await um.login('legacy_user', 'pw1234');
check('迁移旧用户可登录', legacyLogin.success === true);
check('旧用户密码错误被拒', (await um.login('legacy_user', 'wrong')).error === '密码错误');
const legacyHash = um.db.prepare('SELECT password_hash FROM users WHERE username = ?').get('legacy_user').password_hash;
check('旧 HMAC 哈希登录后升级为 bcrypt', legacyHash.startsWith('$2'));
check('rehash 后仍能登录(bcrypt分支)', (await um.login('legacy_user', 'pw1234')).success === true);
check('旧 JSON 已备份 .bak', fs.existsSync(path.join(TMP, 'users.json.bak')));

// 2. 注册（bcrypt，密码≥6位）
check('密码<6位被拒', (await um.register('bob', 'abc12')).error === '密码至少需要6个字符');
check('注册新用户', (await um.register('alice', 'secret1')).success === true);
check('重复注册被拒', (await um.register('alice', 'xxxxxx')).error === '用户名已被注册');

// 3. 登录 / 统计
check('新用户登录', (await um.login('alice', 'secret1')).success === true);
um.updateStats('alice', true);
um.updateStats('alice', false);
const prof = um.getProfile('alice');
check('统计更新 (2局1胜, 胜率50)', prof.stats.gamesPlayed === 2 && prof.stats.wins === 1 && prof.stats.winRate === 50);

// 4. 回放
um.saveGameReplay({
  roomId: 'R1', winner: 'GOOD', reason: 'test', round: 2,
  players: [
    { name: 'alice', role: 'SEER', alive: true, team: 'GOOD' },
    { name: 'bob', role: 'WOLF', alive: false, team: 'EVIL' }, // 未注册，应被跳过
  ],
});
check('回放保存 (仅已注册用户)', um.getReplays('alice').length === 1);

// 5. getProfile 含回放
check('getProfile 含回放', um.getProfile('alice').replays.length === 1);

// 6. 数据库文件已生成
check('veilland.db 已生成', fs.existsSync(path.join(TMP, 'veilland.db')));

console.log(`\n结果: ${pass} PASS / ${fail} FAIL`);
um.db.close(); // 关句柄，否则 Windows 下删不掉 WAL 文件
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 清理失败不影响结果 */ }
process.exit(fail === 0 ? 0 : 1);
