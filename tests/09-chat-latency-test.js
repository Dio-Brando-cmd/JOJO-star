// ============================================================
// 测试 09: 聊天延迟测试
// 测试在高负载下（两个房间同时游戏）聊天消息的延迟
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const MESSAGES_PER_PLAYER = 10;
const PLAYERS_PER_ROOM = 12;

async function testChatLatency() {
  const report = new TestReport('09-聊天延迟测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('chat_latency');

  logSection('测试 09: 聊天延迟（双房间负载）');
  logInfo(`每房间 ${PLAYERS_PER_ROOM} 名玩家, 每人 ${MESSAGES_PER_PLAYER} 条消息`);

  const allPlayers = await createPlayers(PLAYERS_PER_ROOM * 2, SERVER_URL, 'ChatPlayer');
  report.addResult('所有玩家连接', allPlayers.every(p => p.connected));

  try {
    // 创建两个房间
    const roomA = allPlayers.slice(0, PLAYERS_PER_ROOM);
    const roomB = allPlayers.slice(PLAYERS_PER_ROOM);

    const [createA, createB] = await Promise.all([
      roomA[0].createRoom({ maxPlayers: PLAYERS_PER_ROOM }),
      roomB[0].createRoom({ maxPlayers: PLAYERS_PER_ROOM }),
    ]);

    if (!createA.success || !createB.success) {
      report.addResult('房间创建', false, '房间创建失败');
      await disconnectAll(allPlayers);
      report.print();
      return;
    }

    // 所有玩家加入
    for (let i = 1; i < PLAYERS_PER_ROOM; i++) {
      await Promise.all([
        roomA[i].joinRoom(createA.roomCode),
        roomB[i].joinRoom(createB.roomCode),
      ]);
    }

    // 开始游戏（进入可以聊天的状态）
    await Promise.all([
      roomA[0].startGame(),
      roomB[0].startGame(),
    ]);
    report.addResult('两个房间游戏开始', true);

    // 等待进入白天阶段（可以聊天）
    await sleep(3000);

    // 测量聊天延迟
    logInfo('测量聊天延迟...');
    const latencies = [];

    for (let round = 0; round < MESSAGES_PER_PLAYER; round++) {
      // 房间A发送消息
      for (const sender of roomA.slice(0, 3)) { // 只用3个发送者避免速率限制
        const msgStart = Date.now();
        sender.sendChat(`Test message ${round} from ${sender.name}`);

        // 等待至少一个其他玩家收到消息
        await new Promise(resolve => {
          const check = () => {
            const receivers = roomA.filter(p => p !== sender);
            const anyReceived = receivers.some(r =>
              r.chatMessages.some(m => m.message?.includes(`Test message ${round}`))
            );
            if (anyReceived) {
              latencies.push(Date.now() - msgStart);
              resolve();
            } else {
              setTimeout(check, 10);
            }
          };
          setTimeout(() => resolve(), 2000); // 超时
          check();
        });

        await sleep(50); // 避免速率限制
      }

      // 房间B发送消息
      for (const sender of roomB.slice(0, 3)) {
        const msgStart = Date.now();
        sender.sendChat(`Test message ${round} from ${sender.name}`);

        await new Promise(resolve => {
          const check = () => {
            const receivers = roomB.filter(p => p !== sender);
            const anyReceived = receivers.some(r =>
              r.chatMessages.some(m => m.message?.includes(`Test message ${round}`))
            );
            if (anyReceived) {
              latencies.push(Date.now() - msgStart);
              resolve();
            } else {
              setTimeout(check, 10);
            }
          };
          setTimeout(() => resolve(), 2000);
          check();
        });

        await sleep(50);
      }
    }

    // 分析延迟
    latencies.sort((a, b) => a - b);
    for (const l of latencies) stats.recordLatency('chat', l);

    report.addResult('消息发送成功', latencies.length > 0,
      `${latencies.length} 条消息被接收`);

    if (latencies.length > 0) {
      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];

      report.addResult('平均聊天延迟', avg < 1000,
        `avg=${PerfTimer.format(avg)}, P50=${PerfTimer.format(p50)}, P95=${PerfTimer.format(p95)}`);
    }

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('聊天延迟', false, e.message);
  }

  await disconnectAll(allPlayers);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testChatLatency().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
