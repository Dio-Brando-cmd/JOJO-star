// ============================================================
// 24-3d-blunderbuss.mjs — 3D 追逃「守幕者短铳反击」确定性护栏
// 6 真人同房 (2 蚀者 + 4 守幕者, 无随机), 直接验证:
//   1) _armRandomKeeper 恰好给 1 名守幕者配发短铳 (blunderbussUsable=true)
//   2) 蚀者噬灵该守幕者 → 被反杀 (result=COUNTERED), 蚀者出局
// 用法: node tests/24-3d-blunderbuss.mjs [serverUrl]
// ============================================================

import { io } from 'socket.io-client';

const SERVER_URL = process.argv[2] || 'http://localhost:4000';
const N = 6; // 2 蚀者 + 4 守幕者

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function ack(socket, event, payload, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} 超时`)), timeoutMs);
    socket.emit(event, payload, (resp) => { clearTimeout(t); resolve(resp); });
  });
}
function waitEvent(socket, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`等待 ${event} 超时`)), timeoutMs);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}
function emitPos(socket, x, z) { socket.emit('player:position', { x, y: 0, z, rotY: 0, isMoving: false, isSprinting: false }); }

const log = { i: (m) => console.log(`  ℹ️  ${m}`), ok: (m) => console.log(`  ✅ ${m}`), err: (m) => console.log(`  ❌ ${m}`) };

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  3D 追逃「守幕者短铳反击」→ ${SERVER_URL} (${N} 真人)`);
  console.log(`${'═'.repeat(60)}`);

  const socks = [];
  const priv = [];
  const errors = [];
  for (let i = 0; i < N; i++) {
    const s = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
    priv.push(null);
    s.on('game:privateState', (st) => { priv[i] = st; });
    s.on('connect_error', (e) => errors.push(`client${i} connect_error: ${e.message}`));
    socks.push(s);
  }
  await Promise.all(socks.map((s, i) => new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); })));
  log.ok(`${N} 客户端连接`);

  const R = { rows: [], pass(n, d='') { this.rows.push(['PASS', n, d]); }, fail(n, d='') { this.rows.push(['FAIL', n, d]); },
    print() { let p=0,f=0; for (const r of this.rows){ console.log(`    ${r[0]==='PASS'?'✅':'❌'} [${r[0]}] ${r[1]}${r[2]?' — '+r[2]:''}`); r[0]==='PASS'?p++:f++; } console.log(`\n  通过 ${p} / 失败 ${f}`); return {p,f}; } };

  try {
    const host = socks[0];
    const create = await ack(host, 'room:create', { playerName: '短铳宿主', gameMode: 'THIRD_PERSON', maxPlayers: N });
    if (!create?.success) { R.fail('建房', JSON.stringify(create)); return R.print(); }
    for (let i = 1; i < N; i++) {
      await ack(socks[i], 'room:join', { roomCode: create.roomCode, playerName: `短铳玩家${i}` });
    }
    log.ok('建房 + 5 人加入');

    const nsP = waitEvent(host, 'game:3dNightStart', 45000);
    const start = await ack(host, 'game:start', {});
    if (!start?.success) { R.fail('开局', JSON.stringify(start)); return R.print(); }
    await nsP;

    await sleep(200); // 等私有状态落定

    // (1) 短铳配发: 恰好 1 名守幕者持有
    const armedIdx = priv.findIndex(s => s?.myPrivateState?.blunderbussUsable === true);
    const armedCount = priv.filter(s => s?.myPrivateState?.blunderbussUsable === true).length;
    if (armedCount === 1) R.pass('恰好1名守幕者配发短铳', `armedCount=${armedCount}`);
    else R.fail('短铳配发数量', `armedCount=${armedCount}`);

    const keeperCount = priv.filter(s => s?.myTeam === 'VEIL_KEEPERS').length;
    const corruptedIdx = priv.findIndex(s => s?.myTeam === 'CORRUPTED');
    log.i(`阵营分布: 守幕者=${keeperCount} 蚀者=${N - keeperCount}, 短铳持有者=client${armedIdx}`);

    if (armedIdx < 0) { R.fail('未找到短铳持有者'); return R.print(); }
    if (corruptedIdx < 0) { R.fail('未找到蚀者'); return R.print(); }
    if (armedIdx === corruptedIdx) { R.fail('短铳持有者异常(蚀者持有)'); return R.print(); }

    // (2) 蚀者噬灵短铳守幕者 → 被反杀
    emitPos(socks[corruptedIdx], 0, 0);
    emitPos(socks[armedIdx], 1, 0);   // 距离 1.0 < 2.5 攻击范围
    await sleep(300);
    const att = await ack(socks[corruptedIdx], '3d:attack', { targetId: socks[armedIdx].id });
    if (att?.result === 'COUNTERED') R.pass('短铳反杀 (COUNTERED)', `victim=${att.victim}`);
    else R.fail('短铳反杀', `result=${att?.result} reason=${att?.reason}`);

    if (armedIdx === corruptedIdx) {} // noop
  } catch (e) {
    R.fail('测试异常', e.message);
  } finally {
    socks.forEach(s => s.disconnect());
  }
  const { p, f } = R.print();
  return f === 0 ? 0 : 1;
}

main().then((code) => { console.log(''); process.exit(code); });
