// ============================================================
// 测试 16: 大厅列表更新测试
// 测试在双房间负载下大厅列表的更新频率和正确性
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

async function testLobbyUpdates() {
  const report = new TestReport('16-大厅列表更新测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('lobby_updates');

  logSection('测试 16: 大厅列表更新（双房间）');

  const allPlayers = await createPlayers(24, SERVER_URL, 'LobbyPlayer');
  report.addResult('24名玩家连接', allPlayers.every(p => p.connected));

  try {
    const observerA = allPlayers[0];
    const observerB = allPlayers[12];

    // 初始大厅状态
    const initLobbyA = await observerA.getLobbyList();
    const initLobbyB = await observerB.getLobbyList();
    report.addResult('初始大厅一致', initLobbyA.rooms?.length === initLobbyB.rooms?.length,
      `A: ${initLobbyA.rooms?.length || 0}, B: ${initLobbyB.rooms?.length || 0}`);

    // 同时创建两个房间
    logInfo('同时创建两个房间...');
    const roomHosts = [allPlayers[1], allPlayers[13]];
    const createResults = await Promise.all([
      roomHosts[0].createRoom({ maxPlayers: 12 }),
      roomHosts[1].createRoom({ maxPlayers: 12 }),
    ]);

    // 检查大厅更新
    await sleep(500);
    const afterCreateA = await observerA.getLobbyList();
    const afterCreateB = await observerB.getLobbyList();
    report.addResult('创建后大厅一致', afterCreateA.rooms?.length === afterCreateB.rooms?.length,
      `A: ${afterCreateA.rooms?.length || 0}, B: ${afterCreateB.rooms?.length || 0}`);

    // 玩家加入（大厅应显示正确人数）
    logInfo('玩家加入，验证大厅人数更新...');
    const roomA = createResults[0].roomCode;
    const roomB = createResults[1].roomCode;

    // 往房间A加入玩家
    for (let i = 2; i < 12; i++) {
      await allPlayers[i].joinRoom(roomA);
    }

    await sleep(500);
    const afterJoinA = await observerA.getLobbyList();
    const roomAEntry = afterJoinA.rooms?.find(r => r.id === roomA);
    report.addResult('房间A人数更新', roomAEntry?.playerCount === 11,
      `显示 ${roomAEntry?.playerCount || 0}/11`);

    // 房间B也加入
    for (let i = 14; i < 24; i++) {
      await allPlayers[i].joinRoom(roomB);
    }

    await sleep(500);
    const afterJoinB = await observerA.getLobbyList();
    const roomBEntry = afterJoinB.rooms?.find(r => r.id === roomB);
    report.addResult('房间B人数更新', roomBEntry?.playerCount === 11,
      `显示 ${roomBEntry?.playerCount || 0}/11`);

    // 两个房间同时开始游戏（应从大厅移除）
    logInfo('开始游戏，验证从大厅移除...');
    await Promise.all([
      roomHosts[0].startGame(),
      roomHosts[1].startGame(),
    ]);

    await sleep(500);
    const afterStart = await observerA.getLobbyList();
    const roomAStill = afterStart.rooms?.find(r => r.id === roomA);
    const roomBStill = afterStart.rooms?.find(r => r.id === roomB);
    report.addResult('游戏房间从大厅移除', !roomAStill && !roomBStill,
      `A: ${roomAStill ? '仍在' : '已移除'}, B: ${roomBStill ? '仍在' : '已移除'}`);

    // 大厅列表查询延迟
    logInfo('大厅列表查询延迟...');
    const queryStart = Date.now();
    for (let i = 0; i < 20; i++) {
      await observerA.getLobbyList();
    }
    stats.recordLatency('lobby_query_20x', Date.now() - queryStart);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('大厅列表', false, e.message);
  }

  await disconnectAll(allPlayers);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testLobbyUpdates().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
