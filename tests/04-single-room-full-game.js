// ============================================================
// 测试 04: 单房间完整游戏流程测试
// 12名玩家从创建房间到游戏结束的完整流程
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYER_COUNT = 12;

async function testFullGame() {
  const report = new TestReport('04-单房间完整游戏测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('full_game');

  logSection('测试 04: 单房间完整游戏流程');
  logInfo(`模拟 ${PLAYER_COUNT} 名玩家完整游戏`);

  // 创建所有玩家
  const players = await createPlayers(PLAYER_COUNT, SERVER_URL, 'GamePlayer');
  report.addResult('玩家连接', players.every(p => p.connected),
    `${players.filter(p => p.connected).length}/${PLAYER_COUNT}`);

  try {
    // 房主创建房间
    const host = players[0];
    const createResult = await host.createRoom({ maxPlayers: PLAYER_COUNT });
    report.addResult('创建房间', createResult.success, createResult.roomCode);
    const roomCode = createResult.roomCode;

    // 所有玩家加入
    logInfo('所有玩家加入房间...');
    let joinedCount = 0;
    for (let i = 1; i < PLAYER_COUNT; i++) {
      const joinResult = await players[i].joinRoom(roomCode);
      if (joinResult.success) joinedCount++;
    }
    report.addResult('玩家加入', joinedCount === PLAYER_COUNT - 1,
      `${joinedCount + 1}/${PLAYER_COUNT}`);

    // 开始游戏
    logInfo('开始游戏...');
    const startResult = await host.startGame();
    report.addResult('游戏开始', startResult.success);
    timer.mark('game_started');

    // 等待并记录阶段变化
    const phaseHistory = [];
    const phasePromise = new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const state = host.gameState;
        if (state) {
          const lastPhase = phaseHistory[phaseHistory.length - 1];
          if (!lastPhase || lastPhase.phase !== state.phase || lastPhase.round !== state.round) {
            phaseHistory.push({
              phase: state.phase,
              round: state.round,
              nightStep: state.nightStep,
              time: Date.now() - timer.startTime,
            });
            logInfo(`阶段: ${state.phase} R${state.round}${state.nightStep ? ' ' + state.nightStep : ''}`);

            if (state.phase === PHASES.GAME_OVER) {
              clearInterval(checkInterval);
              resolve();
            }
          }
        }
      }, 200);
    });

    // 等待游戏结束（最多 5 分钟）
    const gameTimeout = await Promise.race([
      phasePromise.then(() => true),
      sleep(300000).then(() => false),
    ]);

    timer.mark('game_ended');

    if (gameTimeout) {
      report.addResult('游戏完成', true,
        `经历 ${phaseHistory.length} 个阶段变化, 总耗时: ${PerfTimer.format(Date.now() - timer.startTime)}`);
    } else {
      report.addResult('游戏完成', false, '超时（5分钟）- 可能卡在某个阶段');
    }

    // 记录阶段转换性能
    for (let i = 1; i < phaseHistory.length; i++) {
      const transitionTime = phaseHistory[i].time - phaseHistory[i - 1].time;
      stats.recordPhaseTransition(
        phaseHistory[i - 1].phase,
        phaseHistory[i].phase,
        transitionTime
      );
    }

    // 验证所有玩家都收到了 game:over 事件
    const gotGameOver = players.filter(p =>
      p.events.some(e => e.type === 'game:over')
    ).length;
    report.addResult('GameOver事件广播', gotGameOver === PLAYER_COUNT,
      `${gotGameOver}/${PLAYER_COUNT}`);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('完整游戏', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();

  return {
    stats: stats.summary(),
    totalTime: Date.now() - timer.startTime,
    playerCount: PLAYER_COUNT,
  };
}

testFullGame().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
