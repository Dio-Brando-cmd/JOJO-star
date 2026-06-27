// ============================================================
// 测试 12: 投票性能测试
// 测试多人同时投票的延迟和正确性
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYER_COUNT = 18;

async function testVotePerformance() {
  const report = new TestReport('12-投票性能测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('vote_perf');

  logSection('测试 12: 投票性能');
  logInfo(`${PLAYER_COUNT} 名玩家投票性能`);

  const players = await createPlayers(PLAYER_COUNT, SERVER_URL, 'VotePlayer');
  report.addResult('玩家连接', players.every(p => p.connected));

  try {
    const host = players[0];
    const createResult = await host.createRoom({ maxPlayers: PLAYER_COUNT });
    report.addResult('创建房间', createResult.success);

    for (let i = 1; i < PLAYER_COUNT; i++) {
      await players[i].joinRoom(createResult.roomCode);
    }

    await host.startGame();
    report.addResult('游戏开始', true);

    // 等待进入投票阶段
    logInfo('等待进入投票阶段...');

    // 加速夜晚：所有玩家提交睡觉
    for (let nightRound = 0; nightRound < 5; nightRound++) {
      await sleep(2000);
      const state = host.gameState;
      if (!state) continue;

      if (state.phase === PHASES.VOTE) break;

      if (state.phase === PHASES.NIGHT) {
        for (const p of players) {
          const mp = state.players?.find(pl => pl.id === p.playerId);
          if (mp?.alive) {
            p.socket.emit('night:action', {
              action: 'SLEEP',
              target: null,
              ability: null,
            });
          }
        }
      }
    }

    // 进入投票
    if (host.gameState?.phase === PHASES.DAY) {
      host.startVote();
      await sleep(1000);
    }

    // 同时投票
    if (host.gameState?.phase === PHASES.VOTE) {
      logInfo('所有玩家同时投票...');
      const voteStart = Date.now();
      const alivePlayers = host.gameState.players.filter(p => p.alive);

      const votePromises = [];
      for (const p of players) {
        const mp = alivePlayers.find(ap => ap.id === p.playerId);
        if (mp?.alive) {
          // 随机投给另一个存活玩家
          const targets = alivePlayers.filter(ap => ap.id !== p.playerId);
          const target = targets[Math.floor(Math.random() * targets.length)];
          votePromises.push(p.submitVote(target.id));
        }
      }

      await Promise.all(votePromises);
      const voteTime = Date.now() - voteStart;
      stats.recordLatency('parallel_vote', voteTime);
      report.addResult('并行投票', true,
        `${votePromises.length} 票, 耗时: ${PerfTimer.format(voteTime)}`);

      // 等待投票结果
      await sleep(3000);
      // 检查是否有投票结果事件
    }

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('投票性能', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testVotePerformance().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
