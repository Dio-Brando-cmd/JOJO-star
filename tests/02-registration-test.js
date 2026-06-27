// ============================================================
// 测试 02: 注册登录测试
// 测试用户注册和登录功能的正确性和性能
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const TEST_COUNT = 20;

async function testRegistration() {
  const report = new TestReport('02-注册登录测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('register_test');

  logSection('测试 02: 注册登录测试');
  logInfo(`目标服务器: ${SERVER_URL}`);
  logInfo(`测试用户数: ${TEST_COUNT}`);

  // 创建测试玩家
  const players = await createPlayers(TEST_COUNT, SERVER_URL, 'RegUser');
  report.addResult('玩家连接', players.every(p => p.connected));

  try {
    // ===== 注册测试 =====
    logInfo('测试注册...');
    const registerResults = [];
    for (let i = 0; i < TEST_COUNT; i++) {
      const username = `testuser_${Date.now()}_${i}`;
      const password = `pass_${i}_test`;

      const regStart = Date.now();
      const result = await players[i].register(username, password);
      const regTime = Date.now() - regStart;

      stats.recordLatency('register', regTime);
      registerResults.push({ i, username, success: result.success, error: result.error, time: regTime });

      if (result.success) {
        logSuccess(`用户 ${i + 1}: ${username} 注册成功 (${regTime}ms)`);
      } else {
        logError(`用户 ${i + 1}: ${username} 注册失败 - ${result.error}`);
      }
    }

    const regSuccess = registerResults.filter(r => r.success).length;
    report.addResult('注册成功率', regSuccess === TEST_COUNT, `${regSuccess}/${TEST_COUNT}`);

    // ===== 登录测试 =====
    logInfo('测试登录...');
    const loginResults = [];
    for (let i = 0; i < TEST_COUNT; i++) {
      if (!registerResults[i].success) continue;

      const loginStart = Date.now();
      const result = await players[i].login(registerResults[i].username, `pass_${i}_test`);
      const loginTime = Date.now() - loginStart;

      stats.recordLatency('login', loginTime);
      loginResults.push({ i, success: result.success, error: result.error, time: loginTime });

      if (result.success) {
        logSuccess(`用户 ${i + 1} 登录成功 (${loginTime}ms)`);
      }
    }

    const loginSuccess = loginResults.filter(r => r.success).length;
    report.addResult('登录成功率', loginSuccess === regSuccess, `${loginSuccess}/${regSuccess}`);

    // ===== 重复注册测试 =====
    logInfo('测试重复注册（应被拒绝）...');
    const dupResult = await players[0].register(registerResults[0].username, 'anypass');
    report.addResult('重复注册拦截', !dupResult.success && dupResult.error,
      dupResult.error || '无错误消息');

    // ===== 错误密码登录测试 =====
    logInfo('测试错误密码登录（应被拒绝）...');
    const badResult = await players[0].login(registerResults[0].username, 'wrongpassword');
    report.addResult('错误密码拦截', !badResult.success && badResult.error,
      badResult.error || '无错误消息');

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('注册登录测试', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();

  return { stats: stats.summary() };
}

testRegistration().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
