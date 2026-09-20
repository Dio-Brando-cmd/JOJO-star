// ============================================================
// 22-3d-multi-round.mjs — 3D 追逃「多回合」回归护栏
// 验证追逃夜结束后不再落入 2D 桌游的 白天/讨论/投票, 而是
// 直接进入下一轮追逃夜 (round 递增), 直到胜负判定。
// 用法: node tests/22-3d-multi-round.mjs [serverUrl]
// ============================================================

import { io } from 'socket.io-client';

const SERVER_URL = process.argv[2] || 'http://localhost:4000';

const log = {
  i: (m) => console.log(`  ℹ️  ${m}`),
  ok: (m) => console.log(`  ✅ ${m}`),
  err: (m) => console.log(`  ❌ ${m}`),
  warn: (m) => console.log(`  ⚠️  ${m}`),
};

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

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  3D 追逃「多回合」回归护栏 → ${SERVER_URL}`);
  console.log(`${'═'.repeat(60)}`);

  const host = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  await new Promise((res, rej) => { host.on('connect', res); host.on('connect_error', rej); });
  log.ok(`已连接 host=${host.id.slice(0, 8)}`);

  const phases = [];           // 记录收到的阶段变化 (含 game:3dNightStart)
  const nightRounds = [];      // 每次 3dNightStart 的 round
  let over = null;

  host.on('game:3dNightStart', (d) => { nightRounds.push(d.round); phases.push('NIGHT#' + d.round); });
  host.on('game:phaseChange', (d) => { phases.push(d.phase); });
  host.on('game:over', (d) => { over = d; });

  try {
    const create = await ack(host, 'room:create', { playerName: '多回合宿主', gameMode: 'THIRD_PERSON', maxPlayers: 6 });
    if (!create?.success) { log.err('建房: ' + JSON.stringify(create)); return 1; }
    log.ok(`建房 roomCode=${create.roomCode}`);

    const ns1 = waitEvent(host, 'game:3dNightStart', 45000);
    const start = await ack(host, 'game:start', {});
    if (!start?.success) { log.err('开局: ' + JSON.stringify(start)); return 1; }
    const d1 = await ns1;
    log.ok(`第 1 夜开始 round=${d1.round}`);

    // 快速结束第 1 夜 (房主强制) → 应直接进入第 2 夜, 而非 DAY
    host.emit('3d:endNight');
    const ns2 = await waitEvent(host, 'game:3dNightStart', 20000);
    log.ok(`第 2 夜开始 round=${ns2.round}`);

    // 再快速结束第 2 夜 → 第 3 夜
    host.emit('3d:endNight');
    const ns3 = await waitEvent(host, 'game:3dNightStart', 20000);
    log.ok(`第 3 夜开始 round=${ns3.round}`);

    await sleep(300);

    const roundSeqOk = nightRounds.length >= 3 && nightRounds[0] === 1 && nightRounds[1] === 2 && nightRounds[2] === 3;
    const noDayPhase = !phases.includes('DAY') && !phases.includes('DISCUSSION') && !phases.includes('VOTE');

    console.log(`\n  ── 结果汇总 ──`);
    console.log(`    阶段序列: ${phases.join(' → ')}`);
    console.log(`    夜晚轮次: ${nightRounds.join(', ')}`);

    let pass = 0, fail = 0;
    if (roundSeqOk) { log.ok('多回合连续追逃 (round 1→2→3)'); pass++; }
    else { log.err(`轮次异常: ${nightRounds.join(',')} (期望 1,2,3)`); fail++; }

    if (noDayPhase) { log.ok('无 2D 桌游白天/讨论/投票插曲'); pass++; }
    else { log.err('出现了 2D 白天/讨论/投票阶段'); fail++; }

    if (!over) { log.ok('游戏未提前结算 (持续追逃中)'); pass++; }
    else { log.err(`游戏提前结算: ${over.winner} / ${over.reason}`); fail++; }

    console.log(`\n  通过 ${pass} / 失败 ${fail}`);
    return fail === 0 ? 0 : 1;
  } catch (e) {
    log.err('测试异常: ' + (e.stack || e.message));
    return 1;
  } finally {
    host.disconnect();
  }
}

main().then((code) => { console.log(''); process.exit(code); });
