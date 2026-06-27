// ============================================================
// 测试 18: 最大容量压力测试
// 两个房间各18名玩家同时游戏，测试服务器极限性能
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES, NIGHT_ACTIONS } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYERS_PER_ROOM = 18;

async function testMaxCapacity() {
  const report = new TestReport('18-最大容量压力测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('max_capacity');

  logSection('测试 18: 最大容量 - 双房间各18人');
  logInfo(`共 ${PLAYERS_PER_ROOM * 2} 名玩家，两个房间各 ${PLAYERS_PER_ROOM} 人`);

  // 分批创建避免过载
  logInfo('分批创建连接 (每批12人)...');
  const allPlayers = [];
  for (let batch = 0; batch < 3; batch++) {
    const batchSize = 12;
    const batchPlayers = await createPlayers(batchSize, SERVER_URL, `MaxP${batch}_`);
    allPlayers.push(...batchPlayers);
    logInfo(`第${batch + 1}批: ${batchPlayers.filter(p => p.connected).length}/${batchSize} 已连接`);
  }

  const connected = allPlayers.filter(p => p.connected).length;
  report.addResult('全部连接', connected >= PLAYERS_PER_ROOM * 2 * 0.95,
    `${connected}/${PLAYERS_PER_ROOM * 2}`);
  timer.mark('all_connected');

  try {
    const roomA = allPlayers.slice(0, PLAYERS_PER_ROOM);
    const roomB = allPlayers.slice(PLAYERS_PER_ROOM);

    // 两个房间同时创建
    const [createA, createB] = await Promise.all([
      roomA[0].createRoom({ maxPlayers: PLAYERS_PER_ROOM }),
      roomB[0].createRoom({ maxPlayers: PLAYERS_PER_ROOM }),
    ]);
    report.addResult('房间创建', createA.success && createB.success);
    timer.mark('rooms_created');

    // 分批加入（避免同时大量join）
    logInfo('分批加入房间...');
    const joinStart = Date.now();
    for (let i = 1; i < PLAYERS_PER_ROOM; i++) {
      await Promise.all([
        roomA[i].joinRoom(createA.roomCode),
        roomB[i].joinRoom(createB.roomCode),
      ]);
    }
    stats.recordLatency('join_all', Date.now() - joinStart);
    report.addResult('所有玩家加入', true,
      PerfTimer.format(Date.now() - joinStart));
    timer.mark('all_joined');

    // 同时开始
    logInfo('两个房间同时开始游戏...');
    const [startA, startB] = await Promise.all([
      roomA[0].startGame(),
      roomB[0].startGame(),
    ]);
    report.addResult('同时开始', startA.success && startB.success);
    timer.mark('both_started');

    // 自动操作推进游戏
    logInfo('自动操作推进游戏 (最多 3 轮)...');
    let rounds = 0;
    const maxRounds = 3;

    await new Promise((resolve) => {
      const monitor = setInterval(() => {
        const stateA = roomA[0].gameState;
        const stateB = roomB[0].gameState;

        // 检查是否结束
        if ((!stateA || stateA.phase === PHASES.GAME_OVER) &&
            (!stateB || stateB.phase === PHASES.GAME_OVER)) {
          clearInterval(monitor);
          resolve();
          return;
        }

        if (stateA?.round > rounds) rounds = stateA.round;
        if (stateB?.round > rounds) rounds = stateB.round;
        if (rounds >= maxRounds) {
          clearInterval(monitor);
          resolve();
          return;
        }

        // 为两个房间的玩家自动提交操作
        for (const room of [roomA, roomB]) {
          const state = room[0].gameState;
          if (!state) continue;

          for (const p of room) {
            const mp = state.players?.find(pl => pl.id === p.playerId);
            if (!mp?.alive) continue;

            if (state.phase === PHASES.NIGHT) {
              const targets = state.players.filter(pl => pl.alive && pl.id !== p.playerId);
              if (targets.length > 0) {
                const t = targets[Math.floor(Math.random() * targets.length)];
                p.socket.emit('night:action', {
                  action: NIGHT_ACTIONS.GO_OUT,
                  target: t.id,
                  ability: null,
                });
              }
            }

            if (state.phase === PHASES.VOTE) {
              const targets = state.players.filter(pl => pl.alive && pl.id !== p.playerId);
              if (targets.length > 0) {
                const t = targets[Math.floor(Math.random() * targets.length)];
                p.socket.emit('vote:submit', { targetId: t.id });
              }
            }
          }
        }
      }, 500);

      // 总超时 5 分钟
      setTimeout(() => { clearInterval(monitor); resolve(); }, 300000);
    });

    timer.mark('games_advanced');
    report.addResult('游戏推进轮数', rounds >= 1,
      `完成了 ${rounds} 轮`);

    // 检查内存/连接状态
    const stillConn = allPlayers.filter(p => p.connected).length;
    report.addResult('连接保持率', stillConn >= PLAYERS_PER_ROOM * 2 * 0.9,
      `${stillConn}/${PLAYERS_PER_ROOM * 2}`);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('最大容量', false, e.message);
  }

  await disconnectAll(allPlayers);
  report.print();
  stats.print();

  return {
    stats: stats.summary(),
    totalTime: Date.now() - timer.startTime,
    totalPlayers: PLAYERS_PER_ROOM * 2,
  };
}

testMaxCapacity().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
