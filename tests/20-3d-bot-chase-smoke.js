// ============================================================
// 20-3d-bot-chase-smoke.js — 3D 人机追逐冒烟测试（连线上服）
// 验证: 部署后的人机 AI 是否在 3D 追逃夜里真实移动/追击
// 用法: node tests/20-3d-bot-chase-smoke.js [serverUrl]
// 默认: http://210.16.170.144:4000
// ============================================================

import { io } from 'socket.io-client';

const SERVER_URL = process.argv[2] || 'http://210.16.170.144:4000';
const HOST_NAME = 'SmokeHost' + Math.floor(Math.random() * 1000);
const WATCH_MS = 6000;   // 观察人机移动的时长

const log = {
  i: (m) => console.log(`  ℹ️  ${m}`),
  ok: (m) => console.log(`  ✅ ${m}`),
  err: (m) => console.log(`  ❌ ${m}`),
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function dist(a, b) {
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.z ?? 0) - (b.z ?? 0));
}

async function main() {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  3D 人机追逐冒烟测试 → ${SERVER_URL}`);
  console.log(`${'═'.repeat(56)}`);

  const socket = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });

  const nightStart = new Promise((resolve, reject) => {
    socket.on('game:3dNightStart', (d) => resolve(d));
    setTimeout(() => reject(new Error('等待 game:3dNightStart 超时')), 45000);
  });

  const positions = [];      // 收集 players:positions 快照
  socket.on('players:positions', (d) => positions.push(d));

  // 连接
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
  log.ok(`已连接, socket.id=${socket.id}`);

  // 建 3D 房
  const create = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('room:create 超时')), 15000);
    socket.emit('room:create', {
      playerName: HOST_NAME,
      gameMode: 'THIRD_PERSON',
      maxPlayers: 6,
    }, (r) => { clearTimeout(t); resolve(r); });
  });
  if (!create?.success) { log.err(`建房失败: ${JSON.stringify(create)}`); return 1; }
  log.ok(`已建 3D 房: ${create.roomCode}`);

  // 开始游戏（1 真人 + 5 人机）
  const start = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('game:start 超时')), 15000);
    socket.emit('game:start', {}, (r) => { clearTimeout(t); resolve(r); });
  });
  if (!start?.success) { log.err(`开始失败: ${JSON.stringify(start)}`); return 1; }
  log.ok('游戏已开始（8s 序幕 → 3D 夜）');

  // 等进 3D 夜
  const ns = await nightStart;
  const roster = ns.players || [];
  const bots = roster.filter((p) => p.id !== socket.id);
  log.ok(`进入 3D 追逃夜: timeLeft=${ns.timeLeft}s, 玩家=${roster.length} (真人1 + 人机${bots.length})`);
  log.i(`人机名单: ${bots.map((p) => `${p.name}(${p.role})`).join(', ')}`);

  // 观察人机位置变化
  log.i(`观察人机移动 ${WATCH_MS / 1000}s ...`);
  await sleep(WATCH_MS);

  // 汇总: 每个 bot 的位移
  const first = {}, last = {}, movedDist = {};
  for (const snap of positions) {
    for (const [id, p] of Object.entries(snap.positions || {})) {
      if (id === socket.id) continue;         // 跳过真人自己
      if (!first[id]) first[id] = p;
      last[id] = p;
    }
  }

  const ids = [...new Set([...Object.keys(first), ...Object.keys(last)])];
  let movingCount = 0, trackedCount = 0;

  console.log(`\n  ── 人机位移统计 ──`);
  for (const id of ids) {
    const a = first[id], b = last[id];
    if (!a || !b) continue;
    trackedCount++;
    const d = dist(a, b);
    movedDist[id] = d;
    if (d > 0.5) movingCount++;
    console.log(`    ${id.slice(0, 8)}: ${a.x?.toFixed(1)},${a.z?.toFixed(1)} → ${b.x?.toFixed(1)},${b.z?.toFixed(1)}  位移=${d.toFixed(2)}m  isMoving=${b.isMoving}`);
  }

  console.log(`\n  ── 结论 ──`);
  log.i(`位置快照 ${positions.length} 帧; 追踪到人机 ${trackedCount}/${bots.length}`);

  const pass = trackedCount > 0 && movingCount >= Math.min(3, trackedCount);
  if (pass) {
    log.ok(`PASS — ${movingCount}/${trackedCount} 个人机在移动，人机追逐 AI 已生效`);
  } else {
    log.err(`FAIL — 追踪到 ${trackedCount} 个人机，移动中 ${movingCount} 个`);
    if (positions.length === 0) log.err(`      未收到任何 players:positions 广播`);
  }

  socket.disconnect();
  return pass ? 0 : 1;
}

main()
  .then((code) => { console.log(''); process.exit(code); })
  .catch((e) => { console.log(`\n  ❌ 测试异常: ${e.message}`); process.exit(1); });
