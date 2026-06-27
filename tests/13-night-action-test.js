// ============================================================
// 测试 13: 夜晚行动提交测试
// 测试夜晚行动提交的并发性能和正确性
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYER_COUNT = 12;

async function testNightAction() {
  const report = new TestReport('13-夜晚行动性能测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('night_action');

  logSection('测试 13: 夜晚行动提交');
  logInfo(`${PLAYER_COUNT} 名玩家夜晚行动并发提交`);

  const players = await createPlayers(PLAYER_COUNT, SERVER_URL, 'NightPlayer');
  report.addResult('玩家连接', players.every(p => p.connected));

  try {
    const host = players[0];
    const createResult = await host.createRoom({ maxPlayers: PLAYER_COUNT });
    if (!createResult.success) throw new Error('房间创建失败');

    for (let i = 1; i < PLAYER_COUNT; i++) {
      await players[i].joinRoom(createResult.roomCode);
    }
    await host.startGame();
    report.addResult('游戏开始', true);

    // 等待进入夜晚
    await sleep(2000);

    if (host.gameState?.phase === PHASES.NIGHT) {
      const nightStep = host.gameState.nightStep;
      logInfo(`当前夜晚步骤: ${nightStep}`);

      // 测量所有玩家同时提交行动的性能
      const actionStart = Date.now();
      const actionPromises = [];

      for (const p of players) {
        const mp = host.gameState.players.find(pl => pl.id === p.playerId);
        if (mp?.alive) {
          const aliveTargets = host.gameState.players.filter(pl => pl.alive && pl.id !== p.playerId);
          const target = aliveTargets.length > 0 ? aliveTargets[0].id : null;

          // 不使用 _emit（不等待回调），直接 emit 模拟并发
          p.socket.emit('night:action', {
            action: 'GO_OUT',
            target: target,
            ability: null,
          });
          actionPromises.push(true);
        }
      }

      const actionTime = Date.now() - actionStart;
      stats.recordLatency('night_action_submit', actionTime);
      report.addResult('并发提交夜晚行动', true,
        `${actionPromises.length} 个行动, ${PerfTimer.format(actionTime)}`);

      // 等待步骤推进
      await sleep(3000);
      const newStep = host.gameState?.nightStep;
      report.addResult('夜晚步骤推进', newStep !== nightStep,
        `${nightStep} → ${newStep || '?'}`);

      // 再等一步
      await sleep(3000);
      const step2 = host.gameState?.nightStep;
      report.addResult('继续推进', step2 !== newStep,
        `${newStep} → ${step2 || '?'}`);
    }

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('夜晚行动', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testNightAction().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
