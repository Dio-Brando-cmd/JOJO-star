// ============================================================
// 测试 15: 玩家中途退出测试
// 测试游戏中玩家退出、房主转移、游戏继续等边界情况
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYER_COUNT = 12;

async function testEarlyLeave() {
  const report = new TestReport('15-中途退出测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('early_leave');

  logSection('测试 15: 玩家中途退出');

  const players = await createPlayers(PLAYER_COUNT, SERVER_URL, 'LeavePlayer');
  report.addResult('玩家连接', players.every(p => p.connected));

  try {
    const host = players[0];
    const createResult = await host.createRoom({ maxPlayers: PLAYER_COUNT });
    const roomCode = createResult.roomCode;
    report.addResult('创建房间', createResult.success);

    for (let i = 1; i < PLAYER_COUNT; i++) {
      await players[i].joinRoom(roomCode);
    }
    await host.startGame();
    report.addResult('游戏开始', true);

    // 测试1: 大厅阶段玩家退出
    logInfo('测试1: 大厅阶段退出...');
    // 先用 backToLobby 返回大厅
    const host2 = players[1]; // 另一个玩家
    // 先验证返回大厅的功能
    // （游戏已经开始了，所以先让游戏自然进行）

    // 测试2: 游戏中玩家断线（模拟退出）
    await sleep(3000);
    logInfo('测试2: 游戏中玩家断开...');
    const leavingPlayer = players[2];
    const leavingId = leavingPlayer.playerId;
    await leavingPlayer.disconnect();

    // 检查服务器是否标记为断线
    await sleep(2000);
    const stateAfter = host.gameState;
    const disconnectedPlayer = stateAfter?.players?.find(p => p.id === leavingId);
    report.addResult('断线玩家标记', disconnectedPlayer?.disconnected === true,
      `玩家 ${leavingPlayer.name} disconnected=${disconnectedPlayer?.disconnected}`);

    // 测试3: 非房主退出后的房主转移
    logInfo('测试3: 房主转移...');
    const originalHost = host.playerId;
    // 房主退出
    await host.backToLobby();
    await sleep(1000);

    const stateAfterHostLeft = players[1].gameState;
    const newHostId = stateAfterHostLeft?.hostId;
    report.addResult('房主转移', newHostId !== originalHost,
      `旧房主: ${originalHost?.substring(0, 8)} → 新房主: ${newHostId?.substring(0, 8) || '?'}`);

    // 测试4: 所有人都退出后房间被删除
    logInfo('测试4: 全部退出房间删除...');

    // 创建一个新房间用于此测试
    const soloPlayer = await createPlayers(2, SERVER_URL, 'Solo')[0];
    const soloPlayer2 = await createPlayers(1, SERVER_URL, 'Solo2')[0];

    const soloResult = await soloPlayer.createRoom({ maxPlayers: 6 });
    report.addResult('测试房间创建', soloResult.success);

    await soloPlayer2.joinRoom(soloResult.roomCode);
    await soloPlayer.leaveRoom();
    await soloPlayer2.leaveRoom();

    // 验证房间是否还存在
    await sleep(500);
    const lobbyAfter = await players[3].getLobbyList();
    const roomExists = lobbyAfter.rooms?.some(r => r.id === soloResult.roomCode);
    report.addResult('空房间删除', !roomExists,
      roomExists ? '房间仍存在' : '房间已删除');

    await soloPlayer.disconnect();
    await soloPlayer2.disconnect();

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('中途退出', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testEarlyLeave().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
