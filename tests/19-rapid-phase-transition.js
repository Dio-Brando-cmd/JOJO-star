// ============================================================
// 测试 19: 阶段转换速度测试
// 精确测量双房间下各游戏阶段之间的转换延迟
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYER_COUNT = 12;

async function testPhaseTransition() {
  const report = new TestReport('19-阶段转换速度测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('phase_transition');

  logSection('测试 19: 阶段转换速度');

  const allPlayers = await createPlayers(PLAYER_COUNT * 2, SERVER_URL, 'PhasePlayer');
  report.addResult('所有玩家连接', allPlayers.every(p => p.connected));

  try {
    const roomA = allPlayers.slice(0, PLAYER_COUNT);
    const roomB = allPlayers.slice(PLAYER_COUNT);

    // 两个房间创建和加入
    const [createA, createB] = await Promise.all([
      roomA[0].createRoom({ maxPlayers: PLAYER_COUNT }),
      roomB[0].createRoom({ maxPlayers: PLAYER_COUNT }),
    ]);

    for (let i = 1; i < PLAYER_COUNT; i++) {
      await Promise.all([
        roomA[i].joinRoom(createA.roomCode),
        roomB[i].joinRoom(createB.roomCode),
      ]);
    }

    // 收集阶段变化时间
    const phaseTimings = { A: [], B: [] };

    const collectPhases = (room, label) => {
      const host = room[0];
      let lastUpdate = Date.now();
      const interval = setInterval(() => {
        const state = host.gameState;
        if (!state) return;

        const last = phaseTimings[label][phaseTimings[label].length - 1];
        const currentKey = `${state.phase}_R${state.round}_${state.nightStep || ''}`;
        if (!last || last.key !== currentKey) {
          const now = Date.now();
          phaseTimings[label].push({
            key: currentKey,
            phase: state.phase,
            round: state.round,
            nightStep: state.nightStep,
            time: now,
            sinceLast: last ? now - last.time : now - timer.startTime,
          });
        }

        if (state.phase === PHASES.GAME_OVER) {
          clearInterval(interval);
        }
      }, 100);
    };

    // 同时开始
    await Promise.all([roomA[0].startGame(), roomB[0].startGame()]);
    timer.mark('games_started');

    collectPhases(roomA, 'A');
    collectPhases(roomB, 'B');

    // 等待游戏结束（最多 5 分钟）
    await new Promise(resolve => {
      const check = setInterval(() => {
        const stateA = roomA[0].gameState;
        const stateB = roomB[0].gameState;
        if ((stateA?.phase === PHASES.GAME_OVER) && (stateB?.phase === PHASES.GAME_OVER)) {
          clearInterval(check);
          resolve();
        }
      }, 500);
      setTimeout(() => { clearInterval(check); resolve(); }, 300000);
    });

    // 分析阶段转换
    for (const label of ['A', 'B']) {
      const timings = phaseTimings[label];
      logInfo(`房间${label}: ${timings.length} 次阶段变化`);

      // 计算每种阶段转换的平均时间
      const transitions = {};
      for (let i = 1; i < timings.length; i++) {
        const from = timings[i - 1].phase;
        const to = timings[i].phase;
        const key = `${from}→${to}`;
        if (!transitions[key]) transitions[key] = [];
        transitions[key].push(timings[i].sinceLast);
      }

      for (const [key, times] of Object.entries(transitions)) {
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        stats.recordLatency(`phase_${label}_${key}`, avg);
      }
    }

    report.addResult('房间A阶段变化', phaseTimings.A.length > 3,
      `${phaseTimings.A.length} 次`);
    report.addResult('房间B阶段变化', phaseTimings.B.length > 3,
      `${phaseTimings.B.length} 次`);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('阶段转换', false, e.message);
  }

  await disconnectAll(allPlayers);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testPhaseTransition().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
