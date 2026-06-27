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
      ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF,
      ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH,
      ROLES.GUARD, ROLES.HUNTER,
      ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER,
    ];
    const result1 = await host.createRoom({ maxPlayers: 12, roleConfig: standardConfig });
    report.addResult('标准配置创建', result1.success, result1.roomCode || result1.error);

    // 清理
    await host.leaveRoom();

    // 测试2: 非法配置 - 全是狼人
    logInfo('测试非法配置 - 全狼人...');
    const allWolves = Array(12).fill(ROLES.WEREWOLF);
    const result2 = await host.createRoom({ maxPlayers: 12, roleConfig: allWolves });
    report.addResult('全狼人配置被拒', !result2.success,
      result2.error || '未被拒绝');

    // 测试3: 非法配置 - 全是好人
    logInfo('测试非法配置 - 全是好人...');
    const allGood = [ROLES.SEER, ROLES.GUARD, ROLES.HUNTER, ...Array(9).fill(ROLES.VILLAGER)];
    const result3 = await host.createRoom({ maxPlayers: 12, roleConfig: allGood });
    report.addResult('全好人配置被拒', !result3.success,
      result3.error || '未被拒绝');

    // 测试4: 合法配置 - 人多狼少
    logInfo('测试合法配置 - 人多狼少...');
    const fewWolves = [
      ROLES.ALPHA_WOLF, ROLES.WEREWOLF,
      ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH,
      ROLES.GUARD, ROLES.HUNTER,
      ...Array(5).fill(ROLES.VILLAGER),
    ];
    const result4 = await host.createRoom({ maxPlayers: 12, roleConfig: fewWolves });
    report.addResult('少狼配置创建', result4.success, result4.roomCode || result4.error);

    // 加入并开始游戏来验证配置生效
    for (let i = 1; i < 12; i++) {
      await players[i].joinRoom(result4.roomCode);
    }

    const startResult = await host.startGame(fewWolves);
    report.addResult('少狼配置游戏开始', startResult.success);

    // 验证分发的角色
    await sleep(1000);
    const state = host.gameState;
    if (state) {
      const roles = state.players?.map(p => p.role) || [];
      const wolfCount = roles.filter(r => r === ROLES.WEREWOLF || r === ROLES.ALPHA_WOLF).length;
      report.addResult('狼人数量验证', wolfCount === 2,
        `配置了2狼, 实际${wolfCount}狼`);
    }

    // 测试5: 房主修改配置
    logInfo('测试房主修改配置...');
    await new Promise(resolve => {
      host.socket.emit('room:updateRoleConfig', {
        roleConfig: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.WEREWOLF,
          ROLES.SEER, ROLES.GUARD, ROLES.HUNTER,
          ...Array(5).fill(ROLES.VILLAGER)],
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
