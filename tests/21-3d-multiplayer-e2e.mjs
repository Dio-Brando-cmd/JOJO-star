// ============================================================
// 21-3d-multiplayer-e2e.mjs — 3D 追逃「真人联机」端到端冒烟
// 验证 2+ 真实人类客户端能同房打完一局 3D 追逃的关键线上路径:
//   建房 → 加入 → 开局 → 进入 3D 夜 → 双真人位置互见(同步)
//   → 藏匿 → 采集灵焰(守幕者) → 噬灵攻击(蚀者)
// 用法: node tests/21-3d-multiplayer-e2e.mjs [serverUrl]
// 默认: http://localhost:4000 (本地验证); 可传线上 http://210.16.170.144:4000
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

// promisified socket emit + ack 回调
function ack(socket, event, payload, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${event} 超时`)), timeoutMs);
    socket.emit(event, payload, (resp) => { clearTimeout(t); resolve(resp); });
  });
}

// 一次性等待某事件
function waitEvent(socket, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`等待 ${event} 超时`)), timeoutMs);
    socket.once(event, (d) => { clearTimeout(t); resolve(d); });
  });
}

// 轮询直到条件成立(兜底偶发事件时序)
async function waitFor(fn, timeoutMs = 5000, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = fn();
    if (v) return v;
    await sleep(intervalMs);
  }
  return null;
}

function emitPos(socket, pos) {
  socket.emit('player:position', { x: pos.x, y: pos.y ?? 0, z: pos.z, rotY: 0, isMoving: false, isSprinting: false });
}

// 在位置快照数组里找某玩家的最新坐标
function findInSnaps(snaps, id) {
  for (let i = snaps.length - 1; i >= 0; i--) {
    if (snaps[i].positions?.[id]) return snaps[i].positions[id];
  }
  return null;
}

// 结果记录器
class Reporter {
  constructor() { this.rows = []; }
  add(name, status, detail = '') { this.rows.push({ name, status, detail }); }
  pass(name, detail = '') { this.add(name, 'PASS', detail); }
  fail(name, detail = '') { this.add(name, 'FAIL', detail); }
  skip(name, detail = '') { this.add(name, 'SKIP', detail); }
  print() {
    console.log(`\n  ── 结果汇总 ──`);
    let pass = 0, fail = 0, skip = 0;
    for (const r of this.rows) {
      const mark = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '➖';
      console.log(`    ${mark} [${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
      if (r.status === 'PASS') pass++; else if (r.status === 'FAIL') fail++; else skip++;
    }
    console.log(`\n  通过 ${pass} / 失败 ${fail} / 跳过 ${skip}`);
    return { pass, fail, skip };
  }
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  3D 追逃「真人联机」端到端冒烟 → ${SERVER_URL}`);
  console.log(`${'═'.repeat(60)}`);

  const R = new Reporter();

  // ---- 连接 2 个真实客户端 ----
  const host = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  const guest = io(SERVER_URL, { transports: ['websocket'], reconnection: false, timeout: 15000 });

  await Promise.all([
    new Promise((res, rej) => { host.on('connect', res); host.on('connect_error', rej); }),
    new Promise((res, rej) => { guest.on('connect', res); guest.on('connect_error', rej); }),
  ]);
  R.pass('双客户端连接', `host=${host.id.slice(0, 8)} guest=${guest.id.slice(0, 8)}`);

  // ---- 收集私有状态 + 位置广播 + 灵焰状态 + 结算 ----
  const hostPriv = { myTeam: null, myRole: null };
  const guestPriv = { myTeam: null, myRole: null };
  host.on('game:privateState', (s) => { hostPriv.myTeam = s.myTeam; hostPriv.myRole = s.myRole; });
  guest.on('game:privateState', (s) => { guestPriv.myTeam = s.myTeam; guestPriv.myRole = s.myRole; });

  const hostSnaps = [], guestSnaps = [];
  host.on('players:positions', (d) => hostSnaps.push(d));
  guest.on('players:positions', (d) => guestSnaps.push(d));

  let flameUpdate = null;
  host.on('game:flameUpdate', (d) => { flameUpdate = d; });

  let gameOver = null;
  const overSeen = () => gameOver !== null;
  host.on('game:over', (d) => { gameOver = d; });
  guest.on('game:over', (d) => { gameOver = d; });

  try {
    // ---- 建房 + 加入 ----
    const create = await ack(host, 'room:create', { playerName: 'E2E宿主', gameMode: 'THIRD_PERSON', maxPlayers: 6 });
    if (!create?.success) { R.fail('建房', JSON.stringify(create)); return R.print(); }
    const roomCode = create.roomCode;
    R.pass('建房(THIRD_PERSON)', `roomCode=${roomCode}`);

    const join = await ack(guest, 'room:join', { roomCode, playerName: 'E2E访客' });
    if (!join?.success) { R.fail('访客加入', JSON.stringify(join)); return R.print(); }
    const lobbyPlayers = join.gameState?.players?.length ?? 0;
    R.pass('访客加入同房', `大厅人数=${lobbyPlayers}`);

    // ---- 开局(宿主) ----
    const nsHostP = waitEvent(host, 'game:3dNightStart', 45000);
    const nsGuestP = waitEvent(guest, 'game:3dNightStart', 45000);
    const start = await ack(host, 'game:start', {});
    if (!start?.success) { R.fail('开局', JSON.stringify(start)); return R.print(); }

    const nsHost = await nsHostP;
    const nsGuest = await nsGuestP;
    const roster = nsHost.players || [];
    const humans = roster.filter((p) => p.id === host.id || p.id === guest.id);
    const bots = roster.filter((p) => p.id !== host.id && p.id !== guest.id);
    R.pass('进入 3D 追逃夜', `玩家=${roster.length} (真人${humans.length} + 人机${bots.length})`);
    if (roster.length !== 6) log.warn(`预期 6 人(2真人+4人机), 实得 ${roster.length}`);

    // 回归护栏: 夜晚开始不得泄露具体职业(否则蚀者会规避 FLAME_TRACKER 短铳反杀), 只发阵营
    const noRoleLeak = roster.every((p) => !p.role) && roster.every((p) => !!p.team);
    if (noRoleLeak) R.pass('夜晚开始不泄露具体职业', 'roster 仅含阵营(team)');
    else R.fail('职业泄露', JSON.stringify(roster.map((p) => ({ n: p.name, role: p.role, team: p.team }))));

    // 阵营判定 — 私有状态开局后下发, 轮询兜底偶发时序
    await waitFor(() => hostPriv.myTeam && guestPriv.myTeam, 5000);
    const hCorrupted = hostPriv.myTeam === 'CORRUPTED';
    const gCorrupted = guestPriv.myTeam === 'CORRUPTED';
    const crossTeam = hCorrupted !== gCorrupted;
    log.i(`阵营: 宿主=${hostPriv.myRole ?? '?'}(${hostPriv.myTeam ?? '?'}) 访客=${guestPriv.myRole ?? '?'}(${guestPriv.myTeam ?? '?'})`);

    // ---- 藏匿(双方, 任意阵营可藏) ----
    const hideH = await ack(host, '3d:hide', { hideSpotId: 'house_0' });
    const hideG = await ack(guest, '3d:hide', { hideSpotId: 'house_1' });
    if (hideH?.success && hideG?.success) R.pass('藏匿(双真人)');
    else R.fail('藏匿', `host=${JSON.stringify(hideH)} guest=${JSON.stringify(hideG)}`);

    // ---- 坐标规划(单次到位, 规避反作弊瞬移) ----
    // 跨阵营: 蚀者(-5,-6) 近守幕者(-5,-8)=水井 → 攻击(2m)+采集(0m) 同时成立
    // 双守幕者: 宿主→水井, 访客→铁匠铺, 各自采集
    // 双蚀者: 1m 间距(仅位置同步+藏匿可测)
    let hostPos, guestPos;
    let keeperSock = null, keeperId = null, keeperFlame = null;
    let corruptedSock = null, corruptedId = null;
    if (crossTeam) {
      if (hCorrupted) {
        hostPos = { x: -5, z: -6 }; guestPos = { x: -5, z: -8 };
        corruptedSock = host; corruptedId = host.id; keeperSock = guest; keeperId = guest.id; keeperFlame = 'well';
      } else {
        hostPos = { x: -5, z: -8 }; guestPos = { x: -5, z: -6 };
        keeperSock = host; keeperId = host.id; keeperFlame = 'well'; corruptedSock = guest; corruptedId = guest.id;
      }
    } else if (!hCorrupted) {
      hostPos = { x: -5, z: -8 }; guestPos = { x: 10, z: 5 };
      keeperSock = host; keeperId = host.id; keeperFlame = 'well';
    } else {
      hostPos = { x: 2, z: 0 }; guestPos = { x: 3, z: 0 };
      corruptedSock = host; corruptedId = host.id;
    }

    // ---- 位置同步(核心: 双真人互见) ----
    emitPos(host, hostPos);
    emitPos(guest, guestPos);
    await sleep(500); // 等位置注册 + 100ms 广播

    const hostSeesGuest = findInSnaps(hostSnaps, guest.id);
    const guestSeesHost = findInSnaps(guestSnaps, host.id);
    if (hostSeesGuest && guestSeesHost) {
      R.pass('双真人位置互见', `宿主见访客(${hostSeesGuest.x},${hostSeesGuest.z}) / 访客见宿主(${guestSeesHost.x},${guestSeesHost.z})`);
    } else {
      R.fail('位置同步', `宿主见访客=${!!hostSeesGuest} 访客见宿主=${!!guestSeesHost} (快照${hostSnaps.length}/${guestSnaps.length}帧)`);
    }

    // ---- 采集灵焰(守幕者真人) ----
    if (keeperSock) {
      const collect = await ack(keeperSock, '3d:collect', { flameId: keeperFlame });
      if (collect?.success) {
        const c = flameUpdate?.collected ?? -1;
        R.pass(`采集灵焰(${keeperFlame})`, `守幕者=${keeperId.slice(0, 8)}, 广播已采集 ${c}`);
      } else {
        R.fail('采集灵焰', JSON.stringify(collect));
      }
    } else {
      R.skip('采集灵焰', '本局无守幕者真人(双蚀者)');
    }

    // ---- 噬灵攻击(蚀者真人 → 守幕者真人) ----
    if (corruptedSock && keeperSock) {
      const atk = await ack(corruptedSock, '3d:attack', { targetId: keeperId });
      if (atk?.success) {
        R.pass('噬灵攻击(真人→真人)', `结果=${atk.result}`);
      } else {
        R.fail('噬灵攻击', JSON.stringify(atk));
      }
    } else if (corruptedSock) {
      R.skip('噬灵攻击', '无守幕者真人可攻(双蚀者)');
    } else {
      R.skip('噬灵攻击', '本局无蚀者真人(双守幕者)');
    }

    // 若意外触发结算, 报告
    if (overSeen()) {
      log.i(`游戏已结算: 胜者=${gameOver.winner} 原因=${gameOver.reason}`);
    }
  } catch (e) {
    R.fail('测试异常', e.message);
  } finally {
    host.disconnect();
    guest.disconnect();
  }

  const { fail } = R.print();
  return fail === 0 ? 0 : 1;
}

main()
  .then((code) => { console.log(''); process.exit(code); })
  .catch((e) => { console.log(`\n  ❌ 测试崩溃: ${e.stack || e.message}`); process.exit(1); });
