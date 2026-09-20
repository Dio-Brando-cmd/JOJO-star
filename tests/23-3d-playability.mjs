// ============================================================
// 23-3d-playability.mjs — 3D 追逃「可玩性」回归护栏
// 验证本轮平衡改动:
//   1) game:3dNightStart 下发 round + maxRounds(生存判胜夜数)
//   2) 灵焰总数 = 4 (由 5 减为 4, 仪式更易完成)
//   3) 灵焰跨回合保留 (第1夜采集后第2夜不清零)
//   4) 守幕者撑过 N 夜判胜 (第3夜结束→守幕者胜)
//   5) 随机配发短铳 (守幕者私有状态 blunderbussUsable 存在)
// 用法: node tests/23-3d-playability.mjs [serverUrl]
// ============================================================

import { io } from 'socket.io-client';

const SERVER_URL = process.argv[2] || 'http://localhost:4000';

const log = { i: (m) => console.log(`  ℹ️  ${m}`), ok: (m) => console.log(`  ✅ ${m}`), err: (m) => console.log(`  ❌ ${m}`), warn: (m) => console.log(`  ⚠️  ${m}`) };
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

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  3D 追逃「可玩性」回归护栏 → ${SERVER_URL}`);
  console.log(`${'═'.repeat(60)}`);

  const host = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  const guest = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  await Promise.all([
    new Promise((res, rej) => { host.on('connect', res); host.on('connect_error', rej); }),
    new Promise((res, rej) => { guest.on('connect', res); guest.on('connect_error', rej); }),
  ]);
  log.ok('双客户端连接');

  const priv = { host: null, guest: null };
  host.on('game:privateState', (s) => { priv.host = s; });
  guest.on('game:privateState', (s) => { priv.guest = s; });
  let flame = null;
  host.on('game:flameUpdate', (d) => { flame = d; });
  let over = null;
  host.on('game:over', (d) => { over = d; });

  const R = { rows: [], pass(n, d='') { this.rows.push(['PASS', n, d]); }, fail(n, d='') { this.rows.push(['FAIL', n, d]); }, skip(n, d='') { this.rows.push(['SKIP', n, d]); },
    print() { let p=0,f=0,s=0; for (const r of this.rows){ const m = r[0]==='PASS'?'✅':r[0]==='FAIL'?'❌':'➖'; console.log(`    ${m} [${r[0]}] ${r[1]}${r[2]?' — '+r[2]:''}`); if(r[0]==='PASS')p++; else if(r[0]==='FAIL')f++; else s++; } console.log(`\n  通过 ${p} / 失败 ${f} / 跳过 ${s}`); return {p,f,s}; } };

  try {
    const create = await ack(host, 'room:create', { playerName: '可玩性宿主', gameMode: 'THIRD_PERSON', maxPlayers: 6 });
    if (!create?.success) { R.fail('建房', JSON.stringify(create)); return R.print(); }
    await ack(guest, 'room:join', { roomCode: create.roomCode, playerName: '可玩性访客' });

    const ns1p = waitEvent(host, 'game:3dNightStart', 45000);
    const start = await ack(host, 'game:start', {});
    if (!start?.success) { R.fail('开局', JSON.stringify(start)); return R.print(); }
    const ns1 = await ns1p;

    // (1) round + maxRounds
    if (ns1.round === 1) R.pass('第1夜 round=1'); else R.fail('round', `=${ns1.round}`);
    if (ns1.maxRounds === 3) R.pass('maxRounds=3(生存判胜夜数)'); else R.fail('maxRounds', `=${ns1.maxRounds}`);

    // 等灵焰广播
    await sleep(300);
    const flameTotal = flame?.total ?? -1;
    if (flameTotal === 4) R.pass('灵焰总数=4(由5减为4)', `total=${flameTotal}`);
    else R.fail('灵焰总数', `=${flameTotal}`);

    // 阵营
    const hostKeep = priv.host?.myTeam === 'VEIL_KEEPERS';
    const guestKeep = priv.guest?.myTeam === 'VEIL_KEEPERS';
    const keeperSock = hostKeep ? host : (guestKeep ? guest : null);
    const keeperId = keeperSock === host ? host.id : (keeperSock === guest ? guest.id : null);
    log.i(`阵营: 宿主=${priv.host?.myTeam ?? '?'} 访客=${priv.guest?.myTeam ?? '?'}`);

    // (5) 短铳配发: 守幕者私有状态里 blunderbussUsable 应为布尔值 (至少一个守幕者持有)
    const armedSock = [host, guest].find(s => (s === host ? priv.host : priv.guest)?.myPrivateState?.blunderbussUsable === true);
    if (armedSock) R.pass('随机配发短铳(守幕者)', `持有者=${armedSock === host ? '宿主' : '访客'}`);
    else if (keeperSock) R.skip('短铳配发', '真人守幕者未被抽中(短铳在其余守幕者/人机)');
    else R.skip('短铳配发', '本局无真人守幕者');

    // (3) 灵焰跨回合保留: 有真人守幕者则采集一处, 第2夜验证不清零
    let collectedRound1 = -1;
    if (keeperSock) {
      emitPos(keeperSock, -5, -8);   // 水井
      await sleep(300);
      const collect = await ack(keeperSock, '3d:collect', { flameId: 'well' });
      if (collect?.success) {
        collectedRound1 = flame?.collected ?? -1;
        R.pass('第1夜采集水井', `collected=${collectedRound1}`);
      } else {
        R.fail('采集水井', JSON.stringify(collect));
      }
    } else {
      R.skip('灵焰采集/保留', '本局无真人守幕者');
    }

    // 结束第1夜 → 第2夜
    host.emit('3d:endNight');
    const ns2 = await waitEvent(host, 'game:3dNightStart', 20000);
    if (ns2.round === 2) R.pass('第2夜 round=2'); else R.fail('第2夜 round', `=${ns2.round}`);
    await sleep(300);
    if (collectedRound1 === 1) {
      const collectedRound2 = flame?.collected ?? -1;
      if (collectedRound2 === 1) R.pass('灵焰跨回合保留', '第2夜 collected 仍=1');
      else R.fail('灵焰跨回合保留', `第2夜 collected=${collectedRound2}`);
    }

    // 结束第2夜 → 第3夜
    host.emit('3d:endNight');
    const ns3 = await waitEvent(host, 'game:3dNightStart', 20000);
    if (ns3.round === 3) R.pass('第3夜 round=3'); else R.fail('第3夜 round', `=${ns3.round}`);

    // 结束第3夜 → 守幕者撑过3夜判胜
    const overP = waitEvent(host, 'game:over', 20000);
    host.emit('3d:endNight');
    const ov = await overP;
    if (ov.winner === 'VEIL_KEEPERS') R.pass('守幕者撑过3夜判胜', `reason=${ov.reason}`);
    else R.fail('生存判胜', `winner=${ov.winner} reason=${ov.reason}`);
  } catch (e) {
    R.fail('测试异常', e.message);
  } finally {
    host.disconnect(); guest.disconnect();
  }
  const { p, f } = R.print();
  return f === 0 ? 0 : 1;
}

main().then((code) => { console.log(''); process.exit(code); });
