// ============================================================
// 测试 17: 语音信令中继性能测试
// 测试 WebRTC 信令在双房间负载下的中继延迟
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const SIGNAL_COUNT = 50;

async function testVoiceSignaling() {
  const report = new TestReport('17-语音信令中继测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('voice_signaling');

  logSection('测试 17: WebRTC 语音信令中继');

  const allPlayers = await createPlayers(24, SERVER_URL, 'VoicePlayer');
  report.addResult('24名玩家连接', allPlayers.every(p => p.connected));

  try {
    // 创建两个房间
    const roomA = allPlayers.slice(0, 12);
    const roomB = allPlayers.slice(12);

    const [createA, createB] = await Promise.all([
      roomA[0].createRoom({ maxPlayers: 12 }),
      roomB[0].createRoom({ maxPlayers: 12 }),
    ]);

    // 加入
    for (let i = 1; i < 12; i++) {
      await Promise.all([
        roomA[i].joinRoom(createA.roomCode),
        roomB[i].joinRoom(createB.roomCode),
      ]);
    }

    // 开始游戏
    await Promise.all([
      roomA[0].startGame(),
      roomB[0].startGame(),
    ]);

    // 加入语音频道
    logInfo('加入语音频道...');
    for (const p of roomA) p.socket.emit('voice:join');
    for (const p of roomB) p.socket.emit('voice:join');
    await sleep(500);

    // 测试信令中继延迟
    logInfo(`测试信令中继 (${SIGNAL_COUNT} 次)...`);

    const latencies = [];

    for (let i = 0; i < SIGNAL_COUNT; i++) {
      const sender = roomA[0];
      const target = roomA[1];

      const sigStart = Date.now();

      // 设置 ICE candidate 监听
      const latencyPromise = new Promise(resolve => {
        const handler = (data) => {
          if (data.peerId === sender.playerId && data.candidate === `test_${i}`) {
            target.socket.off('voice:iceCandidate', handler);
            resolve(Date.now() - sigStart);
          }
        };
        target.socket.on('voice:iceCandidate', handler);
        setTimeout(() => { target.socket.off('voice:iceCandidate', handler); resolve(-1); }, 3000);
      });

      sender.socket.emit('voice:iceCandidate', {
        targetId: target.playerId,
        candidate: `test_${i}`,
      });

      const latency = await latencyPromise;
      if (latency >= 0) {
        latencies.push(latency);
        stats.recordLatency('voice_signal', latency);
      }
    }

    if (latencies.length > 0) {
      latencies.sort((a, b) => a - b);
      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      report.addResult('信令中继延迟', avg < 500,
        `avg=${PerfTimer.format(avg)}, P50=${PerfTimer.format(latencies[Math.floor(latencies.length * 0.5)])}`);
      report.addResult('信令成功率', latencies.length >= SIGNAL_COUNT * 0.9,
        `${latencies.length}/${SIGNAL_COUNT}`);
    }

    // 离开语音
    for (const p of roomA) p.socket.emit('voice:leave');
    for (const p of roomB) p.socket.emit('voice:leave');

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('语音信令', false, e.message);
  }

  await disconnectAll(allPlayers);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testVoiceSignaling().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
