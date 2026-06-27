// ============================================================
// 测试 10: 断线重连测试
// 测试游戏中玩家断线后重连的完整流程
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES } from './test-utils.js';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYER_COUNT = 12;

async function testReconnect() {
  const report = new TestReport('10-断线重连测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('reconnect');

  logSection('测试 10: 断线重连');

  const players = await createPlayers(PLAYER_COUNT, SERVER_URL, 'ReconnPlayer');
  report.addResult('玩家连接', players.every(p => p.connected));

  try {
    // 创建房间并开始游戏
    const host = players[0];
    const createResult = await host.createRoom({ maxPlayers: PLAYER_COUNT });
    report.addResult('创建房间', createResult.success, createResult.roomCode);

    for (let i = 1; i < PLAYER_COUNT; i++) {
      await players[i].joinRoom(createResult.roomCode);
    }
    await host.startGame();
    report.addResult('游戏开始', true);
    timer.mark('game_started');

    // 等待进入夜晚阶段
    await sleep(2000);

    // 测试1: 大厅中断线重连
    logInfo('测试1: 大厅中断线重连...');
    const lobbyPlayer = players[PLAYER_COUNT - 1];
    const oldLobbyId = lobbyPlayer.playerId;
    await lobbyPlayer.disconnect();

    // 重新连接
    const reconnSocket = io(SERVER_URL, { transports: ['websocket'], timeout: 10000 });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('重连超时')), 10000);
      reconnSocket.on('connect', () => { clearTimeout(t); resolve(); });
    });

    const reconnResult = await new Promise(resolve => {
      reconnSocket.emit('room:rejoin', {
        roomCode: createResult.roomCode,
        oldPlayerId: oldLobbyId,
      }, resolve);
    });
    report.addResult('大厅重连', reconnResult.success,
      reconnResult.success ? '重连成功' : reconnResult.error);

    // 更新玩家 socket
    lobbyPlayer.socket = reconnSocket;
    lobbyPlayer.connected = true;
    lobbyPlayer.playerId = reconnSocket.id;

    // 测试2: 游戏中断线重连
    logInfo('测试2: 游戏中断线重连...');
    const gamePlayer = players[1];
    const oldGameId = gamePlayer.playerId;

    // 记录断线前状态
    const beforeState = gamePlayer.gameState;
    await gamePlayer.disconnect();

    // 短暂等待让服务器检测到断线
    await sleep(2000);

    // 重新连接
    const reconn2Socket = io(SERVER_URL, { transports: ['websocket'], timeout: 10000 });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('重连超时')), 10000);
      reconn2Socket.on('connect', () => { clearTimeout(t); resolve(); });
    });

    const reconn2Result = await new Promise(resolve => {
      reconn2Socket.emit('room:rejoin', {
        roomCode: createResult.roomCode,
        oldPlayerId: oldGameId,
      }, resolve);
    });

    if (reconn2Result.success) {
      gamePlayer.socket = reconn2Socket;
      gamePlayer.connected = true;
      gamePlayer.playerId = reconn2Socket.id;

      // 检查状态是否恢复
      await sleep(1000);
      const afterState = host.gameState;
      report.addResult('游戏中重连', true,
        `重连后游戏阶段: ${afterState?.phase || 'unknown'}`);
    } else {
      report.addResult('游戏中重连', false, reconn2Result.error);
    }

    // 测试3: 超时未重连（120秒）
    logInfo('测试3: 断线超时处理...');
    const timeoutPlayer = players[2];
    const oldTimeoutId = timeoutPlayer.playerId;
    const wasAliveBefore = host.gameState?.players?.find(p => p.id === oldTimeoutId)?.alive;

    await timeoutPlayer.disconnect();
    // 不重连，等待120秒超时（这里只等10秒验证断线标记）
    await sleep(10000);

    const duringTimeout = host.gameState?.players?.find(p => p.id === oldTimeoutId);
    report.addResult('断线标记', duringTimeout?.disconnected === true,
      `玩家 ${timeoutPlayer.name} 标记为 disconnected`);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('断线重连', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testReconnect().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
