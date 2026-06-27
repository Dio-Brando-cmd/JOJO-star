// ============================================================
// 测试 05: 两个房间并行游戏测试
// 两个12人房间同时进行游戏，测试并发性能
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYERS_PER_ROOM = 12;

async function testTwoRoomsParallel() {
  const report = new TestReport('05-双房间并行游戏测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('two_rooms');

  logSection('测试 05: 两个房间并行游戏');
  logInfo(`每房间 ${PLAYERS_PER_ROOM} 名玩家, 共 ${PLAYERS_PER_ROOM * 2} 名`);

  // 创建所有玩家
  const allPlayers = await createPlayers(PLAYERS_PER_ROOM * 2, SERVER_URL, 'ParallelPlayer');
  report.addResult('所有玩家连接', allPlayers.every(p => p.connected),
    `${allPlayers.filter(p => p.connected).length}/${PLAYERS_PER_ROOM * 2}`);

  const roomAPlayers = allPlayers.slice(0, PLAYERS_PER_ROOM);
  const roomBPlayers = allPlayers.slice(PLAYERS_PER_ROOM);

  try {
    // 两个房间同时创建
    logInfo('并行创建两个房间...');
    const [createA, createB] = await Promise.all([
      roomAPlayers[0].createRoom({ maxPlayers: PLAYERS_PER_ROOM }),
      roomBPlayers[0].createRoom({ maxPlayers: PLAYERS_PER_ROOM }),
    ]);

    report.addResult('房间A创建', createA.success, createA.roomCode);
    report.addResult('房间B创建', createB.success, createB.roomCode);
    timer.mark('rooms_created');

    // 并行加入两个房间
    logInfo('并行加入两个房间...');
    const joinStart = Date.now();
    const joinPromises = [];
    for (let i = 1; i < PLAYERS_PER_ROOM; i++) {
      joinPromises.push(roomAPlayers[i].joinRoom(createA.roomCode));
      joinPromises.push(roomBPlayers[i].joinRoom(createB.roomCode));
    }
    const joinResults = await Promise.all(joinPromises);
    const joinSuccess = joinResults.filter(r => r.success).length;
    stats.recordLatency('parallel_join_all', Date.now() - joinStart);
    report.addResult('并行加入', joinSuccess === (PLAYERS_PER_ROOM - 1) * 2,
      `${joinSuccess}/${(PLAYERS_PER_ROOM - 1) * 2}`);
    timer.mark('all_joined');

    // 两个房间同时开始游戏
    logInfo('两个房间同时开始游戏...');
    const [startA, startB] = await Promise.all([
      roomAPlayers[0].startGame(),
      roomBPlayers[0].startGame(),
    ]);
    report.addResult('房间A开始', startA.success, roomAPlayers[0].gameState?.phase);
    report.addResult('房间B开始', startB.success, roomBPlayers[0].gameState?.phase);
    timer.mark('both_started');

    // 等待两个游戏都结束
    logInfo('等待两个游戏结束...');
    const gameEndPromises = [
      new Promise(resolve => {
        const check = setInterval(() => {
          if (roomAPlayers[0].gameState?.phase === PHASES.GAME_OVER) {
            clearInterval(check);
            resolve('A');
          }
        }, 200);
      }),
      new Promise(resolve => {
        const check = setInterval(() => {
          if (roomBPlayers[0].gameState?.phase === PHASES.GAME_OVER) {
            clearInterval(check);
            resolve('B');
          }
        }, 200);
      }),
    ];

    const completed = [];
    const timeout = sleep(300000).then(() => 'timeout');

    for (let i = 0; i < 2; i++) {
      const winner = await Promise.race([gameEndPromises[i], timeout]);
      if (winner !== 'timeout') completed.push(winner);
    }
    timer.mark('games_ended');

    report.addResult('房间A完成', completed.includes('A'),
      completed.includes('A') ? '游戏正常结束' : '超时');
    report.addResult('房间B完成', completed.includes('B'),
      completed.includes('B') ? '游戏正常结束' : '超时');

    // 检查各玩家状态一致性
    const phaseAConsistent = roomAPlayers.every(p =>
      p.gameState?.phase === PHASES.GAME_OVER
    );
    const phaseBConsistent = roomBPlayers.every(p =>
      p.gameState?.phase === PHASES.GAME_OVER
    );
    report.addResult('房间A状态一致', phaseAConsistent);
    report.addResult('房间B状态一致', phaseBConsistent);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('并行游戏', false, e.message);
  }

  await disconnectAll(allPlayers);
  report.print();
  stats.print();

  return {
    stats: stats.summary(),
    totalTime: Date.now() - timer.startTime,
    playerCount: PLAYERS_PER_ROOM * 2,
  };
}

testTwoRoomsParallel().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
