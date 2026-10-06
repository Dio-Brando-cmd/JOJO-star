// ============================================================
// bot-room.mjs — 真相盘测试通道：3 个机器人占座 + 等真人加入自动开局
//
// 用法: node bot-room.mjs [持续时间分钟]   (默认 30 分钟)
// 行为:
//   bot0 建 TRUTH_DISC 房 → bot1/2 加入 (3 席)
//   监听 truth:state, 第 4 席加入后 bot0 自动 game:start
//   开局后 3 个机器人在中庭附近走动并广播 player:position
//   (让 3D 客户端看到其他玩家胶囊移动, 验证位置同步 + socketId 映射)
//   房间码写入 bot-room-code.txt 并在控制台打印
// ============================================================
import { io } from 'socket.io-client';
import { writeFileSync } from 'fs';

const URL = 'http://210.16.170.144:4000';
const HOLD_MIN = parseInt(process.argv[2] || '30', 10);

const NAMES = ['测试灵焰', '测试守望', '测试旅人'];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const wait = ms => new Promise(r => setTimeout(r, ms));
const ack = (s, ev, p) => new Promise(r => s.emit(ev, p, r));

const socks = NAMES.map(n => io(URL, { transports: ['websocket', 'polling'], timeout: 15000 }));
const positions = [
  { x: 0,  z: -20, dx: 0.18, dz: 0.12 },
  { x: -5, z: -10, dx: 0.12, dz: 0.20 },
  { x: 8,  z: -15, dx: -0.15, dz: 0.10 },
];
let started = false;

(async () => {
  await wait(1500);

  // bot0 建房
  const create = await ack(socks[0], 'room:create', { playerName: NAMES[0], gameMode: 'TRUTH_DISC' });
  if (!create?.success) { log('❌ 建房失败:', JSON.stringify(create)); process.exit(1); }
  const roomCode = create.roomCode;
  writeFileSync('bot-room-code.txt', roomCode);
  log('✅ 房间已建, 房间码 =', roomCode, '(已写入 bot-room-code.txt)');

  // bot1/2 加入
  for (let i = 1; i < 3; i++) {
    const j = await ack(socks[i], 'room:join', { roomCode, playerName: NAMES[i] });
    log(j?.success ? `✅ ${NAMES[i]} 已加入` : `❌ ${NAMES[i]} 加入失败: ${JSON.stringify(j)}`);
  }

  // bot0 监听 state: 第 4 席(真人)加入后自动开局
  socks[0].on('truth:state', s => {
    if (started) return;
    const n = s?.players?.length ?? 0;
    log(`   大厅人数 = ${n}/4`);
    if (n >= 4) {
      started = true;
      log('🟢 第 4 席已入, 自动开局 ...');
      socks[0].emit('game:start', {}, a => log(a?.success ? '🟢 游戏已开始' : '⚠️ 开局失败: ' + JSON.stringify(a)));
    }
  });

  // 开局后机器人走动广播位置
  socks.forEach((s, i) => s.on('truth:started', () => log(`🤖 ${NAMES[i]} 收到开局`)));

  const wanderTimer = setInterval(() => {
    if (!started) return;
    socks.forEach((s, i) => {
      const p = positions[i];
      p.x += p.dx; p.z += p.dz;
      if (p.x > 28 || p.x < -28) p.dx = -p.dx;
      if (p.z > 28 || p.z < -28) p.dz = -p.dz;
      s.emit('player:position', { x: p.x, y: 1.5, z: p.z, rotY: 0, isMoving: true, isSprinting: false });
    });
  }, 200);

  log(`⏳ 测试通道就绪, 持续 ${HOLD_MIN} 分钟。房间码 = ${roomCode}`);
  log('   → 真人用 3D 客户端加入第 4 席即可自动开局');

  setTimeout(() => {
    log('⏰ 测试通道到时关闭');
    clearInterval(wanderTimer);
    socks.forEach(s => { try { s.close(); } catch {} });
    process.exit(0);
  }, HOLD_MIN * 60 * 1000);
})().catch(e => { log('❌ 异常:', e.message); process.exit(1); });
