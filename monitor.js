// ============================================================
// 狼人杀 实时监控面板
// 用法: node monitor.js [服务器地址]
// 默认: http://210.16.170.144:4000
// ============================================================

import { io } from 'socket.io-client';
import { createInterface } from 'readline';

const SERVER_URL = process.argv[2] || process.env.SERVER_URL || 'http://210.16.170.144:4000';

// ===== 颜色 =====
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
};
function c(color, s) { return `${C[color]}${s}${C.reset}`; }

// ===== 状态 =====
const state = {
  connected: false,
  serverVersion: '',
  rooms: [],
  totalPlayers: 0,
  totalBots: 0,
  events: [],      // 最近事件日志
  startTime: Date.now(),
  apiStatus: null,
};

// ===== 连接监控 Socket =====
const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 3000,
});

socket.on('connect', () => {
  state.connected = true;
  log('连接成功', 'green');
  getFullStatus();
});

socket.on('disconnect', () => {
  state.connected = false;
  log('连接断开', 'red');
});

socket.on('connect_error', (e) => {
  state.connected = false;
  log(`连接失败: ${e.message}`, 'red');
});

// 监听大厅广播
socket.on('lobby:updated', (data) => {
  if (data?.rooms) state.rooms = data.rooms;
});

// 全局事件监听
socket.onAny((eventName, ...args) => {
  if (eventName === 'lobby:updated' || eventName === 'game:state') return;
  // 记录重要事件
  const importantEvents = ['game:started', 'game:over', 'room:create', 'chat:message'];
  if (importantEvents.includes(eventName)) {
    state.events.push({ time: Date.now(), event: eventName, data: args[0] });
    if (state.events.length > 50) state.events.shift();
  }
});

// 定时刷新
setInterval(getFullStatus, 10000);

// ===== 获取完整状态 =====
async function getFullStatus() {
  try {
    // REST API 状态
    const apiResp = await fetch(`${SERVER_URL}/api/status`);
    state.apiStatus = await apiResp.json();

    const verResp = await fetch(`${SERVER_URL}/api/version`);
    const verData = await verResp.json();
    state.serverVersion = verData.version;

    // 大厅列表
    const lobbyResp = await fetch(`${SERVER_URL}/api/lobby`);
    const lobbyData = await lobbyResp.json();
    if (lobbyData?.rooms) state.rooms = lobbyData.rooms;

    // 计算统计
    state.totalPlayers = state.rooms.reduce((sum, r) => sum + (r.playerCount || 0), 0);
  } catch (e) {
    // 静默失败，下次重试
  }
}

// ===== 事件日志 =====
const events = [];
function log(msg, color = 'white') {
  const time = new Date().toLocaleTimeString('zh-CN');
  events.push({ time, msg, color });
  if (events.length > 100) events.shift();
}

// ===== 渲染仪表盘 =====
function render() {
  // 清屏
  process.stdout.write('\x1b[2J\x1b[H');

  const w = process.stdout.columns || 80;

  // 标题
  console.log(c('bold', '╔' + '═'.repeat(w - 2) + '╗'));
  console.log(c('bold', '║') + c('yellow', '  🐺 狼人杀实时监控面板'.padEnd(w - 1)) + c('bold', '║'));
  console.log(c('bold', '╠' + '═'.repeat(w - 2) + '╣'));

  // 服务器状态行
  const statusColor = state.connected ? 'green' : 'red';
  const statusText = state.connected ? '● 在线' : '○ 离线';
  const uptime = state.apiStatus ? formatUptime(Date.now() - state.apiStatus.timestamp) : 'N/A';

  console.log(c('bold', '║ ') +
    `${c(statusColor, statusText)}  │  ${c('dim', SERVER_URL)}  │  ${c('cyan', 'v' + state.serverVersion)}  │  运行 ${uptime}`.padEnd(w - 1) +
    c('bold', '║'));

  console.log(c('bold', '╠' + '═'.repeat(w - 2) + '╣'));

  // 核心指标
  const metrics = [
    { label: '活跃房间', value: state.rooms.length, color: 'yellow' },
    { label: '在线玩家', value: state.totalPlayers, color: 'green' },
  ];
  if (state.apiStatus) {
    metrics.push({ label: '总连接数', value: state.apiStatus.players, color: 'blue' });
  }

  const metricStr = metrics.map(m =>
    `${c(m.color, String(m.value))} ${m.label}`
  ).join('  │  ');

  console.log(c('bold', '║ ') + '  ' + metricStr.padEnd(w - 5) + c('bold', '║'));
  console.log(c('bold', '╠' + '═'.repeat(w - 2) + '╣'));

  // 房间列表
  if (state.rooms.length > 0) {
    console.log(c('bold', '║ ') + c('bold', '房间列表:').padEnd(w - 1) + c('bold', '║'));
    console.log(c('bold', '║ ') + c('dim', '  房间号    房主            人数    状态').padEnd(w - 1) + c('bold', '║'));

    for (const room of state.rooms.slice(0, 10)) {
      const code = c('yellow', room.id?.padEnd(10) || '?'.padEnd(10));
      const host = (room.hostName || '?').padEnd(16).substring(0, 16);
      const count = `${room.playerCount || 0}/${room.maxPlayers || 12}`;
      const countStr = c('green', count.padEnd(7));

      let line = `  ${code} ${host} ${countStr}`;
      console.log(c('bold', '║ ') + line.padEnd(w - 1) + c('bold', '║'));
    }
    if (state.rooms.length > 10) {
      console.log(c('bold', '║ ') + c('dim', `  ...还有 ${state.rooms.length - 10} 个房间`).padEnd(w - 1) + c('bold', '║'));
    }
  } else {
    console.log(c('bold', '║ ') + c('dim', '  暂无活跃房间').padEnd(w - 1) + c('bold', '║'));
  }

  console.log(c('bold', '╠' + '═'.repeat(w - 2) + '╣'));

  // 事件日志（最近5条）
  console.log(c('bold', '║ ') + c('bold', '最近事件:').padEnd(w - 1) + c('bold', '║'));
  const recentEvents = events.slice(-5).reverse();
  if (recentEvents.length === 0) {
    console.log(c('bold', '║ ') + c('dim', '  等待事件...').padEnd(w - 1) + c('bold', '║'));
  }
  for (const evt of recentEvents) {
    const line = `  ${c('dim', evt.time)}  ${c(evt.color, '[' + evt.msg + ']')}`;
    console.log(c('bold', '║ ') + line.padEnd(w - 1) + c('bold', '║'));
  }

  console.log(c('bold', '╚' + '═'.repeat(w - 2) + '╝'));
  console.log(c('dim', `  刷新间隔10秒 │ 按 q 退出 │ ${new Date().toLocaleTimeString('zh-CN')}`));
}

// ===== 工具 =====
function formatUptime(ms) {
  if (ms < 60000) return Math.floor(ms / 1000) + 's';
  if (ms < 3600000) return Math.floor(ms / 60000) + 'm';
  if (ms < 86400000) return Math.floor(ms / 3600000) + 'h';
  return Math.floor(ms / 86400000) + 'd';
}

// ===== 主循环 =====
const fps = 4; // 每秒刷新4次
const interval = setInterval(render, 1000 / fps);

// 键盘控制
const rl = createInterface({ input: process.stdin });
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.on('keypress', (str, key) => {
  if (key?.name === 'q' || str === 'q') {
    clearInterval(interval);
    rl.close();
    socket.disconnect();
    process.stdout.write('\x1b[2J\x1b[H');
    console.log('监控已停止');
    process.exit(0);
  }
  if (key?.name === 'r') {
    log('手动刷新', 'blue');
    getFullStatus();
  }
});

// 启动
log('监控启动', 'cyan');
getFullStatus().then(() => render());
