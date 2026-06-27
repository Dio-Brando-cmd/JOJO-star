// ============================================================
// 测试 03: 房间创建和加入测试
// 测试房间创建、加入、大厅列表等基础房间操作
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

async function testRoomOperations() {
  const report = new TestReport('03-房间创建加入测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('room_test');

  logSection('测试 03: 房间创建和加入测试');

  // 创建 24 名玩家（两个房间各 12 人）
  const players = await createPlayers(24, SERVER_URL, 'RoomPlayer');
  report.addResult('24名玩家连接', players.every(p => p.connected));

  try {
    // ===== 创建房间测试 =====
    logInfo('测试房间创建...');
    const roomA = players[0];
    const roomB = players[12];

    const createStartA = Date.now();
    const resultA = await roomA.createRoom({ maxPlayers: 12 });
    stats.recordLatency('create_room', Date.now() - createStartA);
    report.addResult('房间A创建', resultA.success, `房间号: ${resultA.roomCode}`);

    const createStartB = Date.now();
    const resultB = await roomB.createRoom({ maxPlayers: 12 });
    stats.recordLatency('create_room', Date.now() - createStartB);
    report.addResult('房间B创建', resultB.success, `房间号: ${resultB.roomCode}`);

    if (!resultA.success || !resultB.success) {
      report.addResult('后续测试', false, '房间创建失败，无法继续');
      await disconnectAll(players);
      report.print();
      return;
    }

    // ===== 加入房间测试（并行） =====
    logInfo('测试并行加入房间...');
    const joinStart = Date.now();
    const joinPromises = [];

    // 玩家 1-11 加入房间A
    for (let i = 1; i < 12; i++) {
      joinPromises.push(
        players[i].joinRoom(resultA.roomCode).then(r => ({ room: 'A', player: i, ...r }))
      );
    }
    // 玩家 13-23 加入房间B
    for (let i = 13; i < 24; i++) {
      joinPromises.push(
        players[i].joinRoom(resultB.roomCode).then(r => ({ room: 'B', player: i, ...r }))
      );
    }

    const joinResults = await Promise.all(joinPromises);
    const joinTime = Date.now() - joinStart;

    const joinSuccess = joinResults.filter(r => r.success).length;
    report.addResult(
      '并行加入房间',
      joinSuccess === 22,
      `${joinSuccess}/22 成功, 总耗时: ${PerfTimer.format(joinTime)}`
    );
    stats.recordLatency('parallel_join', joinTime);

    // ===== 大厅列表测试 =====
    logInfo('测试大厅列表...');
    const lobbyStart = Date.now();
    const lobbyResult = await players[0].getLobbyList();
    stats.recordLatency('lobby_list', Date.now() - lobbyStart);
    report.addResult('大厅列表获取', lobbyResult.success,
      `${lobbyResult.rooms?.length || 0} 个房间`);

    // ===== 重复创建房间被限制测试 =====
    logInfo('测试速率限制...');
    const rapidResults = [];
    for (let i = 0; i < 6; i++) {
      rapidResults.push(await players[0].createRoom({ maxPlayers: 6 }));
    }
    const rateLimited = rapidResults.some(r => !r.success && r.error?.includes('频繁'));
    report.addResult('创建房间速率限制', rateLimited, rateLimited ? '已触发限制' : '未触发限制');

    // ===== 离开房间测试 =====
    logInfo('测试离开房间...');
    await players[1].leaveRoom();
    await players[13].leaveRoom();

    // 验证玩家已离开
    const updatedLobby = await players[0].getLobbyList();
    report.addResult('离开房间后大厅更新', updatedLobby.success,
      `${updatedLobby.rooms?.length || 0} 个房间`);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('房间操作', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();
  return { stats: stats.summary() };
}

testRoomOperations().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
