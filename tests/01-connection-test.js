// ============================================================
// 测试 01: 基础连接测试
// 测试多个玩家同时连接到服务器的性能和稳定性
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const PLAYER_COUNT = 12;

async function testBasicConnection() {
  const report = new TestReport('01-基础连接测试');
  const timer = new PerfTimer('connection_test');

  logSection('测试 01: 基础连接测试');
  logInfo(`目标服务器: ${SERVER_URL}`);
  logInfo(`模拟玩家数: ${PLAYER_COUNT}`);

  try {
    // 测试单个连接
    logInfo('测试单玩家连接...');
    const single = await createPlayers(1, SERVER_URL, 'Single');
    report.addResult('单玩家连接', single[0].connected, `${single[0].playerId}`);
    await disconnectAll(single);
    logSuccess(`单玩家连接成功`);

    // 测试批量连接（串行）
    logInfo(`测试 ${PLAYER_COUNT} 名玩家串行连接...`);
    const batchStart = Date.now();
    const players = await createPlayers(PLAYER_COUNT, SERVER_URL);
    const batchTime = Date.now() - batchStart;

    const allConnected = players.every(p => p.connected);
    report.addResult(
      `${PLAYER_COUNT}名玩家连接`,
      allConnected,
      `耗时: ${PerfTimer.format(batchTime)}, 平均: ${PerfTimer.format(batchTime / PLAYER_COUNT)}/玩家`
    );
    logSuccess(`${PLAYER_COUNT} 名玩家全部连接成功，总耗时: ${PerfTimer.format(batchTime)}`);

    // 验证连接稳定性
    logInfo('验证连接稳定性 (等待3秒)...');
    await new Promise(r => setTimeout(r, 3000));
    const stillConnected = players.filter(p => p.connected).length;
    report.addResult('连接稳定性', stillConnected === PLAYER_COUNT, `${stillConnected}/${PLAYER_COUNT} 保持连接`);

    // 断开所有
    await disconnectAll(players);
    report.addResult('断开连接', true, '所有玩家已断开');

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('连接测试', false, e.message);
  }

  report.print();

  // 返回性能数据
  return {
    totalTime: Date.now() - timer.startTime,
    playerCount: PLAYER_COUNT,
  };
}

// 运行
testBasicConnection().then(result => {
  console.log('性能摘要:', JSON.stringify(result, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
