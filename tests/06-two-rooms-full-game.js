// ============================================================
// 测试 06: 两房间完整游戏（含自动操作）
// 两个房间同时进行完整游戏，自动提交夜晚行动和投票
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES, NIGHT_ACTIONS } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYERS_PER_ROOM = 12;

// 自动为所有玩家提交夜晚行动和投票
async function autoPlayRoom(players, roomLabel, stats) {
  const host = players[0];
  const timer = new PerfTimer(`auto_${roomLabel}`);

  // 创建房间
  const createResult = await host.createRoom({ maxPlayers: players.length });
  if (!createResult.success) return { success: false, error: createResult.error };
  const roomCode = createResult.roomCode;

  // 加入
  for (let i = 1; i < players.length; i++) {
    await players[i].joinRoom(roomCode);
  }

  // 开始
  await host.startGame();
  timer.mark('started');

  // 监控游戏状态并自动操作
  return new Promise(async (resolve) => {
    const result = { roomCode, phases: [], actions: 0, room: roomLabel };

    const monitor = setInterval(() => {
      const state = host.gameState;
      if (!state) return;

      const lastPhase = result.phases[result.phases.length - 1];
      if (!lastPhase || lastPhase.phase !== state.phase || lastPhase.round !== state.round) {
        result.phases.push({
          phase: state.phase,
          round: state.round,
          nightStep: state.nightStep,
          time: Date.now() - timer.startTime,
        });
        logInfo(`[${roomLabel}] ${state.phase} R${state.round}${state.nightStep ? ' ' + state.nightStep : ''}`);
      }

      // 自动操作：夜晚提交行动
      if (state.phase === PHASES.NIGHT) {
        for (const p of players) {
          if (p.gameState?.phase !== PHASES.NIGHT) continue;
          const myPlayer = state.players?.find(pl => pl.id === p.playerId);
          if (!myPlayer || !myPlayer.alive) continue;

          // 简单策略：随机选一个目标出门
          const alivePlayers = state.players.filter(pl => pl.alive && pl.id !== p.playerId);
          if (alivePlayers.length > 0) {
            const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
            p.submitNightAction(NIGHT_ACTIONS.GO_OUT, target.id);
            result.actions++;
          }
        }
      }

      // 自动操作：投票
      if (state.phase === PHASES.VOTE) {
        for (const p of players) {
          const myPlayer = state.players?.find(pl => pl.id === p.playerId);
          if (!myPlayer || !myPlayer.alive) continue;

          // 随机投票
          const alivePlayers = state.players.filter(pl => pl.alive && pl.id !== p.playerId);
          if (alivePlayers.length > 0) {
            const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
            p.submitVote(target.id);
            result.actions++;
          }
        }
      }

      if (state.phase === PHASES.GAME_OVER) {
        clearInterval(monitor);
        timer.mark('ended');
        result.duration = Date.now() - timer.startTime;
        resolve(result);
      }
    }, 500);

    // 超时保护（5分钟）
    setTimeout(() => {
      clearInterval(monitor);
      result.timeout = true;
      result.duration = Date.now() - timer.startTime;
      resolve(result);
    }, 300000);
  });
}

async function testTwoRoomsAutoPlay() {
  const report = new TestReport('06-双房间自动游戏测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('two_rooms_auto');

  logSection('测试 06: 双房间完整游戏（自动操作）');
  logInfo(`两个房间各 ${PLAYERS_PER_ROOM} 名玩家，自动提交操作`);

  const allPlayers = await createPlayers(PLAYERS_PER_ROOM * 2, SERVER_URL, 'AutoPlayer');
  report.addResult('所有玩家连接', allPlayers.every(p => p.connected));

  const roomA = allPlayers.slice(0, PLAYERS_PER_ROOM);
  const roomB = allPlayers.slice(PLAYERS_PER_ROOM);

  try {
    // 两个房间同时进行
    const [resultA, resultB] = await Promise.all([
      autoPlayRoom(roomA, 'A', stats),
      autoPlayRoom(roomB, 'B', stats),
    ]);

    report.addResult('房间A完成', !resultA.timeout,
      `${resultA.roomCode} - ${resultA.actions}次操作 - ${PerfTimer.format(resultA.duration || 0)}`);
    report.addResult('房间B完成', !resultB.timeout,
      `${resultB.roomCode} - ${resultB.actions}次操作 - ${PerfTimer.format(resultB.duration || 0)}`);

    // 对比两个房间的完成时间
    if (!resultA.timeout && !resultB.timeout) {
      const timeDiff = Math.abs((resultA.duration || 0) - (resultB.duration || 0));
      report.addResult('完成时间差异', timeDiff < 60000,
        `差异: ${PerfTimer.format(timeDiff)}`);
    }

    const totalActions = (resultA.actions || 0) + (resultB.actions || 0);
    report.addResult('总操作数', totalActions > 0, `${totalActions} 次操作`);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('自动游戏', false, e.message);
  }

  await disconnectAll(allPlayers);
  report.print();
  stats.print();

  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testTwoRoomsAutoPlay().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
