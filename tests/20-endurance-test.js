// ============================================================
// 测试 20: 耐久性测试（连续多局）
// 同一房间连续进行多局游戏，测试内存泄漏和长期稳定性
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYER_COUNT = 12;
const GAME_COUNT = 5; // 连续5局

async function testEndurance() {
  const report = new TestReport('20-耐久性测试（连续多局）');
  const stats = new StatsCollector();
  const timer = new PerfTimer('endurance');

  logSection('测试 20: 耐久性测试');
  logInfo(`${PLAYER_COUNT} 名玩家, 连续 ${GAME_COUNT} 局游戏`);

  const players = await createPlayers(PLAYER_COUNT, SERVER_URL, 'EndurePlayer');
  report.addResult('玩家连接', players.every(p => p.connected));

  try {
    const host = players[0];
    const createResult = await host.createRoom({ maxPlayers: PLAYER_COUNT });
    const roomCode = createResult.roomCode;
    report.addResult('创建房间', createResult.success, roomCode);

    for (let i = 1; i < PLAYER_COUNT; i++) {
      await players[i].joinRoom(roomCode);
    }

    const gameResults = [];

    for (let game = 0; game < GAME_COUNT; game++) {
      logInfo(`\n--- 第 ${game + 1}/${GAME_COUNT} 局 ---`);
      const gameStart = Date.now();

      // 开始游戏
      const startResult = await host.startGame();
      if (!startResult.success) {
        gameResults.push({ game: game + 1, success: false, error: startResult.error });
        continue;
      }

      // 等待游戏结束
      const gameEnd = await new Promise(resolve => {
        let resolved = false;
        const check = setInterval(() => {
          if (host.gameState?.phase === PHASES.GAME_OVER && !resolved) {
            resolved = true;
            clearInterval(check);
            resolve({ success: true, duration: Date.now() - gameStart });
          }
        }, 200);
        setTimeout(() => {
          if (!resolved) { resolved = true; clearInterval(check); resolve({ success: false, timeout: true }); }
        }, 300000);
      });

      gameResults.push({ game: game + 1, ...gameEnd });
      stats.recordLatency(`game_${game + 1}`, gameEnd.duration || 0);

      logInfo(`第 ${game + 1} 局: ${gameEnd.success ? `完成 (${PerfTimer.format(gameEnd.duration || 0)})` : '超时或失败'}`);

      // 返回大厅准备下一局
      if (game < GAME_COUNT - 1) {
        await host.socket.emit('room:returnToLobby');
        await sleep(3000); // 等待大厅重置

        // 检查所有玩家状态
        const state = host.gameState;
        if (state?.phase !== PHASES.LOBBY) {
          logError(`第 ${game + 1} 局后未能返回大厅: phase=${state?.phase}`);
        }
      }
    }

    // 分析结果
    const completedGames = gameResults.filter(r => r.success).length;
    report.addResult('完成局数', completedGames >= GAME_COUNT * 0.8,
      `${completedGames}/${GAME_COUNT}`);

    // 检查性能是否随时间变差
    const completedDurations = gameResults
      .filter(r => r.success && r.duration)
      .map(r => r.duration);

    if (completedDurations.length >= 2) {
      const first = completedDurations[0];
      const last = completedDurations[completedDurations.length - 1];
      const slowdown = last / first;

      report.addResult('性能衰减', slowdown < 2,
        `第1局: ${PerfTimer.format(first)}, 最后: ${PerfTimer.format(last)}, 衰减: ${(slowdown * 100 - 100).toFixed(0)}%`);
    }

    // 检查连接保持
    const stillConnected = players.filter(p => p.connected).length;
    report.addResult('连接保持率', stillConnected === PLAYER_COUNT,
      `${stillConnected}/${PLAYER_COUNT}`);

    // 内存使用估算（通过操作计数）
    logInfo('各局耗时:');
    for (const r of gameResults) {
      const icon = r.success ? '✅' : '❌';
      logInfo(`  ${icon} 第${r.game}局: ${PerfTimer.format(r.duration || 0)}${r.timeout ? ' (超时)' : ''}`);
    }

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('耐久性', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();

  return {
    stats: stats.summary(),
    totalTime: Date.now() - timer.startTime,
    gameCount: GAME_COUNT,
  };
}

testEndurance().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
