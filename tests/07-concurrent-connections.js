// ============================================================
// 测试 07: 并发连接压力测试
// 50个玩家同时连接，测试服务器连接处理能力
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const CONCURRENT_COUNT = 50;

async function testConcurrentConnections() {
  const report = new TestReport('07-并发连接压力测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('concurrent_connect');

  logSection('测试 07: 并发连接压力测试');
  logInfo(`目标: ${CONCURRENT_COUNT} 个并发连接`);

  try {
    // 批量创建连接
    logInfo(`创建 ${CONCURRENT_COUNT} 个并发连接...`);
    const batchStart = Date.now();
    const players = await createPlayers(CONCURRENT_COUNT, SERVER_URL, 'StressPlayer');
    const batchTime = Date.now() - batchStart;

    const connected = players.filter(p => p.connected).length;
    report.addResult(
      '并发连接成功率',
      connected >= CONCURRENT_COUNT * 0.95,
      `${connected}/${CONCURRENT_COUNT} (${((connected / CONCURRENT_COUNT) * 100).toFixed(1)}%)`
    );
    report.addResult(
      '总连接耗时',
      true,
      `${PerfTimer.format(batchTime)} (平均 ${PerfTimer.format(batchTime / connected)}/连接)`
    );
    stats.recordLatency('batch_connect', batchTime);
    timer.mark('all_connected');

    // 心跳稳定性（保持连接 10 秒）
    logInfo('保持连接 10 秒测试稳定性...');
    await new Promise(r => setTimeout(r, 10000));

    const stillConnected = players.filter(p => p.connected).length;
    report.addResult(
      '10秒后连接保持率',
      stillConnected >= CONCURRENT_COUNT * 0.9,
      `${stillConnected}/${CONCURRENT_COUNT}`
    );
    timer.mark('stability_check');

    // 同时加入房间（测试房间操作压力）
    logInfo('测试 50 名玩家同时加入房间...');
    const host = players[0];
    const createResult = await host.createRoom({ maxPlayers: 18 });

    if (createResult.success) {
      const joinStart = Date.now();
      const joinPromises = [];
      for (let i = 1; i < Math.min(18, CONCURRENT_COUNT); i++) {
        joinPromises.push(players[i].joinRoom(createResult.roomCode));
      }
      await Promise.all(joinPromises);
      stats.recordLatency('mass_join', Date.now() - joinStart);
      report.addResult('大量加入房间', true, `${Math.min(18, CONCURRENT_COUNT) - 1} 名玩家加入`);
    }

    // 同时断开测试
    logInfo('测试同时断开...');
    const discStart = Date.now();
    await disconnectAll(players);
    stats.recordLatency('mass_disconnect', Date.now() - discStart);
    report.addResult('同时断开', true, PerfTimer.format(Date.now() - discStart));

    timer.mark('all_disconnected');

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('并发连接', false, e.message);
  }

  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testConcurrentConnections().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
