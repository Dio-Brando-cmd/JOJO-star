// ============================================================
// 测试 08: 快速房间创建/销毁测试
// 测试频繁创建和销毁房间的稳定性
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, sleep, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const ROOM_CYCLES = 30;

async function testRapidRoomCreate() {
  const report = new TestReport('08-快速房间创建销毁测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('rapid_rooms');

  logSection('测试 08: 快速房间创建/销毁');
  logInfo(`目标: ${ROOM_CYCLES} 次创建/销毁循环`);

  const players = await createPlayers(6, SERVER_URL, 'RapidPlayer');
  report.addResult('玩家连接', players.every(p => p.connected));

  try {
    const host = players[0];
    const others = players.slice(1);
    let createdCount = 0;
    let destroyedCount = 0;
    let errors = 0;

    for (let cycle = 0; cycle < ROOM_CYCLES; cycle++) {
      // 创建房间
      const createStart = Date.now();
      const createResult = await host.createRoom({ maxPlayers: 6 });
      const createTime = Date.now() - createStart;
      stats.recordLatency('create_room', createTime);

      if (!createResult.success) {
        errors++;
        continue;
      }
      createdCount++;
      const roomCode = createResult.roomCode;

      // 其他玩家加入
      for (const p of others) {
        const joinResult = await p.joinRoom(roomCode);
        if (!joinResult.success) errors++;
      }

      // 所有玩家离开
      for (const p of others) {
        await p.leaveRoom();
      }
      await host.leaveRoom();
      destroyedCount++;

      // 短暂等待
      await sleep(200);

      if ((cycle + 1) % 10 === 0) {
        logInfo(`已完成 ${cycle + 1}/${ROOM_CYCLES} 次循环`);
      }
    }

    report.addResult('房间创建', createdCount === ROOM_CYCLES,
      `${createdCount}/${ROOM_CYCLES}`);
    report.addResult('房间销毁', destroyedCount === ROOM_CYCLES,
      `${destroyedCount}/${ROOM_CYCLES}`);
    report.addResult('错误数', errors === 0,
      `${errors} 个错误`);

    // 验证服务器状态
    const lobbyResult = await host.getLobbyList();
    report.addResult('最终大厅状态', lobbyResult.success,
      `${lobbyResult.rooms?.length || 0} 个活跃房间`);

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('快速房间', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testRapidRoomCreate().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
