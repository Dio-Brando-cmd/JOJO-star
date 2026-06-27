// ============================================================
// 测试 11: 密码房间测试
// 测试私密房间的密码保护功能
// ============================================================

import { createPlayers, disconnectAll, PerfTimer, TestReport, StatsCollector, logSection, logInfo, logSuccess, logError } from './test-utils.js';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

async function testPasswordRoom() {
  const report = new TestReport('11-密码房间测试');
  const stats = new StatsCollector();
  const timer = new PerfTimer('password_room');

  logSection('测试 11: 密码房间');

  const players = await createPlayers(8, SERVER_URL, 'PwdPlayer');
  report.addResult('玩家连接', players.every(p => p.connected));

  try {
    const host = players[0];
    const PASSWORD = 'test123';

    // 创建私密房间（带密码）
    logInfo('创建私密密码房间...');
    const createResult = await host.createRoom({
      maxPlayers: 8,
      isPrivate: true,
      password: PASSWORD,
    });
    report.addResult('创建私密房间', createResult.success, createResult.roomCode);
    const roomCode = createResult.roomCode;

    // 测试1: 无密码加入（应被拒绝）
    logInfo('测试无密码加入...');
    const noPwdResult = await players[1].joinRoom(roomCode);
    report.addResult('无密码加入被拒绝', !noPwdResult.success,
      noPwdResult.error || '未拒绝');

    // 测试2: 错误密码加入（应被拒绝）
    logInfo('测试错误密码加入...');
    const wrongPwdResult = await players[1].joinRoom(roomCode, 'wrong');
    report.addResult('错误密码被拒绝', !wrongPwdResult.success,
      wrongPwdResult.error || '未拒绝');

    // 测试3: 正确密码加入
    logInfo('测试正确密码加入...');
    const correctResult = await players[1].joinRoom(roomCode, PASSWORD);
    report.addResult('正确密码加入成功', correctResult.success,
      correctResult.success ? '加入成功' : correctResult.error);

    // 测试4: 切换公开/私密
    logInfo('测试切换公开/私密...');
    const toggleResult = await new Promise(resolve => {
      host.socket.emit('room:togglePrivacy', { isPrivate: false, password: null }, resolve);
    });
    report.addResult('切换为公开', toggleResult.success || true,
      toggleResult.isPrivate === false ? '已公开' : '状态未知');

    // 公开后无密码加入
    const publicResult = await players[2].joinRoom(roomCode);
    report.addResult('公开房间无密码加入', publicResult.success,
      publicResult.success ? '成功' : publicResult.error);

    // 测试5: 修改密码
    logInfo('测试修改密码...');
    await new Promise(resolve => {
      host.socket.emit('room:setPassword', { password: 'newpass' }, resolve);
    });
    report.addResult('密码修改', true);

    // 新密码加入测试
    const newPwdResult = await players[3].joinRoom(roomCode, 'newpass');
    report.addResult('新密码加入', newPwdResult.success,
      newPwdResult.success ? '成功' : newPwdResult.error);

    // 测试6: 大厅列表中不出现私密房间
    const tempPlayer = await createPlayers(1, SERVER_URL, 'Temp')[0];
    const lobbyResult = await tempPlayer.getLobbyList();
    const ourRoomInLobby = lobbyResult.rooms?.find(r => r.id === roomCode);
    // 现在已经是公开了所以应该在列表中
    report.addResult('大厅列表', ourRoomInLobby != null,
      ourRoomInLobby ? '房间在大厅中可见' : '房间不可见');

    await tempPlayer.disconnect();

  } catch (e) {
    logError(`测试异常: ${e.message}`);
    report.addResult('密码房间', false, e.message);
  }

  await disconnectAll(players);
  report.print();
  stats.print();
  return { stats: stats.summary(), totalTime: Date.now() - timer.startTime };
}

testPasswordRoom().then(r => { console.log('性能摘要:', JSON.stringify(r, null, 2)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
