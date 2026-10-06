// ============================================================
// 25-3d-truth-disc-e2e.mjs — 真相盘 3D 位置同步 + 动作 + 重连 端到端
// 验证 M1 服务端改动：
//   1. truth:state.players[].socketId 已下发（id 空间映射）
//   2. truth 房间的 player:position 被路由到 PositionSync 并广播 players:positions
//   3. truth:action (move/task/guess) 状态推进
//   4. truth:rejoin 座次重连
// 用法: node tests/25-3d-truth-disc-e2e.mjs [serverUrl]
// 默认: http://localhost:4100 (本地验证); 可传线上 http://210.16.170.144:4000
// ============================================================

import { io } from 'socket.io-client';

const SERVER_URL = process.argv[2] || 'http://localhost:4100';
const log = { i: (m) => console.log(`  ℹ️  ${m}`), ok: (m) => console.log(`  ✅ ${m}`), err: (m) => console.log(`  ❌ ${m}`) };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ack(socket, event, payload, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} 超时`)), timeoutMs);
    socket.emit(event, payload, (resp) => { clearTimeout(t); resolve(resp); });
  });
}

function waitEvent(socket, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`等待 ${event} 超时`)), timeoutMs);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

async function main() {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  真相盘 3D 端到端 → ${SERVER_URL}`);
  console.log(`${'═'.repeat(56)}`);

  let pass = 0, fail = 0;
  const ok = (name) => { pass++; log.ok(name); };
  const bad = (name, detail = '') => { fail++; log.err(name + (detail ? ` — ${detail}` : '')); };

  const s1 = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  const s2 = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  const s3 = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  const s4 = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  await Promise.all([s1, s2, s3, s4].map((s) => new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); })));
  ok('4 客户端连接');

  // 收集状态
  const states = { s1: [], s2: [], s3: [], s4: [] };
  const privs = { s1: null, s2: null, s3: null, s4: null };
  const started = { s1: false, s2: false, s3: false, s4: false };
  const positions = { s1: [], s2: [], s3: [], s4: [] };
  for (const [key, s] of [['s1', s1], ['s2', s2], ['s3', s3], ['s4', s4]]) {
    s.on('truth:state', (d) => states[key].push(d));
    s.on('truth:privateState', (d) => { privs[key] = d; });
    s.on('truth:started', () => { started[key] = true; });
    s.on('players:positions', (d) => positions[key].push(d));
  }

  // ---- 建房 + 加入 ----
  const create = await ack(s1, 'room:create', { playerName: 'T3D宿主', gameMode: 'TRUTH_DISC' });
  if (!create?.success) { bad('建房', JSON.stringify(create)); return 1; }
  const code = create.roomCode;
  ok(`建房 roomCode=${code}`);

  const j2 = await ack(s2, 'room:join', { roomCode: code, playerName: 'T3D乙' });
  const j3 = await ack(s3, 'room:join', { roomCode: code, playerName: 'T3D丙' });
  const j4 = await ack(s4, 'room:join', { roomCode: code, playerName: 'T3D丁' });
  if (j2?.success && j3?.success && j4?.success) ok('3 访客加入');
  else { bad('加入', `${JSON.stringify(j2)} ${JSON.stringify(j3)} ${JSON.stringify(j4)}`); return 1; }

  // ---- 开局 ----
  const start = await ack(s1, 'game:start', {});
  if (!start?.success) { bad('开局', JSON.stringify(start)); return 1; }
  await sleep(300);
  if (started.s1 && started.s2 && started.s3 && started.s4) ok('truth:started 全员收到');
  else bad('truth:started', `s1=${started.s1} s2=${started.s2} s3=${started.s3} s4=${started.s4}`);

  const pub = states.s1[states.s1.length - 1];
  if (pub?.phase === 'PLAYING' && pub.players?.length === 4) ok('truth:state PLAYING, 4 玩家');
  else { bad('公开状态', JSON.stringify(pub?.players)); return 1; }

  const hasSocketId = pub.players.every((p) => typeof p.socketId === 'string' && p.socketId.length > 0);
  if (hasSocketId) ok('players[].socketId 已下发');
  else bad('socketId 缺失', JSON.stringify(pub.players.map((p) => ({ id: p.id, socketId: p.socketId }))));

  const privsOk = [privs.s1, privs.s2, privs.s3, privs.s4].every((p) => p && p.mySeat && p.myRejoinToken);
  if (privsOk) ok('truth:privateState 含 mySeat/myRejoinToken');
  else bad('私有状态缺字段');

  // ---- 位置同步（核心） ----
  const posData = { x: 1, y: 0, z: 1, rotY: 0, isMoving: true, isSprinting: false };
  s1.emit('player:position', posData);
  s2.emit('player:position', { ...posData, x: 5, z: 5 });
  s3.emit('player:position', { ...posData, x: -5, z: -5 });
  s4.emit('player:position', { ...posData, x: 0, z: 0 });
  await sleep(600); // 等 100ms 广播 + 网络
  const gotPos = (s) => positions[s].length > 0;
  const allGot = gotPos('s1') && gotPos('s2') && gotPos('s3') && gotPos('s4');
  if (allGot) {
    const seen = Object.keys(positions.s1[positions.s1.length - 1]?.positions || {});
    ok(`players:positions 全员收到 (s1 见 ${seen.length} 人)`);
  } else bad('players:positions', `s1=${gotPos('s1')} s2=${gotPos('s2')} s3=${gotPos('s3')} s4=${gotPos('s4')}`);

  // ---- 动作推进 ----
  const move = await ack(s1, 'truth:action', { action: { type: 'move', zone: '中庭' } });
  if (move?.ok) ok('move 中庭');
  else bad('move', JSON.stringify(move));

  await sleep(1600); // 等 1.5s 动作冷却

  const spiritEntry = Object.entries(privs).find(([, p]) => p.myTeam === 'spirit');
  if (spiritEntry) {
    const spiritKey = spiritEntry[0];
    const spirit = { s1, s2, s3, s4 }[spiritKey];
    const taskId = (states[spiritKey].slice(-1)[0]?.tasks || [])[0]?.id;
    if (taskId) {
      const t = await ack(spirit, 'truth:action', { action: { type: 'task', taskId } });
      if (t?.ok) ok(`task(${taskId}) 完成`);
      else bad('task', JSON.stringify(t));
    }
  }
  await sleep(1600); // 等 1.5s 动作冷却
  const guess = await ack(s1, 'truth:action', { action: { type: 'guess', godId: 'harvest' } });
  if (guess?.ok) ok('guess 真神');
  else bad('guess', JSON.stringify(guess));

  // ---- 重连 ----
  const victim = s3;
  const victimKey = 's3';
  const seat = privs[victimKey].mySeat;
  const token = privs[victimKey].myRejoinToken;
  victim.disconnect();
  await sleep(200);
  const s3b = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  await new Promise((res, rej) => { s3b.on('connect', res); s3b.on('connect_error', rej); });
  const rejoin = await ack(s3b, 'truth:rejoin', { roomCode: code, seat, token });
  if (rejoin?.success) ok(`rejoin 座次 ${seat} 成功`);
  else bad('rejoin', JSON.stringify(rejoin));
  s3b.disconnect();

  s1.disconnect(); s2.disconnect(); s4.disconnect();

  console.log(`\n  ── 结果 ──`);
  console.log(`  通过 ${pass} / 失败 ${fail}`);
  return fail === 0 ? 0 : 1;
}

main().then((c) => { console.log(''); process.exit(c); }).catch((e) => { console.log(`\n  ❌ 异常: ${e.stack || e.message}`); process.exit(1); });
