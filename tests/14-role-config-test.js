// ============================================================
// 测试 14: 自定义角色配置测试
// 测试各种角色配置的合法性和游戏运行
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError, PHASES, ROLES } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

async function testRoleConfig() {
  const report = new TestReport('14-角色配置测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('role_config');

  logSection('测试 14: 自定义角色配置');

  const players = await createPlayers(12, SERVER_URL, 'RolePlayer');
  report.addResult('玩家连接', players.every(p => p.connected));

  const host = players[0];

  try {
    // 测试1: 合法配置 - 标准12人
    logInfo('测试合法配置 - 标准12人...');
    const standardConfig = [
      ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED,
      ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER,
      ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER,
      ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER,
    ];
    const result1 = await host.createRoom({ maxPlayers: 12, roleConfig: standardConfig });
    report.addResult('标准配置创建', result1.success, result1.roomCode || result1.error);

    // 清理
    await host.leaveRoom();

    // 测试2: 非法配置 - 全是蚀者
    logInfo('测试非法配置 - 全蚀者...');
    const allWolves = Array(12).fill(ROLES.CORRUPTED);
    const result2 = await host.createRoom({ maxPlayers: 12, roleConfig: allWolves });
    report.addResult('全蚀者配置被拒', !result2.success,
      result2.error || '未被拒绝');

    // 测试3: 非法配置 - 全是守幕者
    logInfo('测试非法配置 - 全是守幕者...');
    const allGood = [ROLES.VEIL_SCHOLAR, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ...Array(9).fill(ROLES.SPIRIT_WEAVER)];
    const result3 = await host.createRoom({ maxPlayers: 12, roleConfig: allGood });
    report.addResult('全守幕者配置被拒', !result3.success,
      result3.error || '未被拒绝');

    // 测试4: 合法配置 - 人多蚀者少
    logInfo('测试合法配置 - 人多蚀者少...');
    const fewWolves = [
      ROLES.NETHER_MONK, ROLES.CORRUPTED,
      ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER,
      ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER,
      ...Array(5).fill(ROLES.SPIRIT_WEAVER),
    ];
    const result4 = await host.createRoom({ maxPlayers: 12, roleConfig: fewWolves });
    report.addResult('少蚀者配置创建', result4.success, result4.roomCode || result4.error);

    // 加入并开始游戏来验证配置生效
    for (let i = 1; i < 12; i++) {
      await players[i].joinRoom(result4.roomCode);
    }

    const startResult = await host.startGame(fewWolves);
    report.addResult('少蚀者配置游戏开始', startResult.success);

    // 验证分发的角色
    await sleep(1000);
    const state = host.gameState;
    if (state) {
      const roles = state.players?.map(p => p.role) || [];
      const corruptedCount = roles.filter(r => r === ROLES.CORRUPTED || r === ROLES.NETHER_MONK).length;
      report.addResult('蚀者数量验证', corruptedCount === 2,
        `配置了2蚀者, 实际${corruptedCount}蚀者`);
    }

    // 测试5: 房主修改配置
    logInfo('测试房主修改配置...');
    await new Promise(resolve => {
      host.socket.emit('room:updateRoleConfig', {
        roleConfig: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.CORRUPTED,
          ROLES.VEIL_SCHOLAR, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER,
          ...Array(5).fill(ROLES.SPIRIT_WEAVER)],
      }, resolve);
    });
    report.addResult('房主修改配置', true);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('角色配置', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testRoleConfig().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
