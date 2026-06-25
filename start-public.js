// ============================================================
// 公网联机启动脚本 —— 自动尝试多种隧道，选第一个成功的
// 顺序: localtunnel → SSH(serveo) → 仅局域网
// ============================================================

import { startServer } from './server/src/app.js';
import os from 'os';
import { spawn } from 'child_process';

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 4000;

async function tryLocalTunnel() {
  try {
    const localtunnel = (await import('localtunnel')).default;
    const tunnel = await localtunnel({ port: PORT, timeout: 15000 });
    return { url: tunnel.url, type: 'localtunnel', instance: tunnel };
  } catch (e) {
    console.log('  localtunnel 失败:', e.message);
    return null;
  }
}

async function tryServeo() {
  return new Promise((resolve) => {
    console.log('  尝试 serveo.net (SSH隧道)...');
    const child = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=60',
      '-o', 'ConnectTimeout=10',
      '-R', `80:localhost:${PORT}`,
      'serveo.net',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; child.kill(); resolve(null); }
    }, 15000);

    child.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('  serveo:', text.trim());
      const match = text.match(/https?:\/\/[a-zA-Z0-9.-]+\.serveo\.net/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ url: match[0], type: 'serveo', instance: child });
      }
    });

    child.stderr.on('data', (data) => {
      console.log('  serveo stderr:', data.toString().trim());
    });

    child.on('error', () => {
      if (!resolved) { resolved = true; clearTimeout(timeout); resolve(null); }
    });
  });
}

async function main() {
  console.log('🚀 启动游戏服务器...');
  await startServer(PORT);
  console.log(`✅ 服务器运行在: http://localhost:${PORT}\n`);

  const localIP = getLocalIP();

  console.log('🌐 正在获取公网地址（自动尝试多种方式）...\n');

  // 尝试 1: localtunnel
  console.log('[1/2] 尝试 localtunnel...');
  let result = await tryLocalTunnel();

  // 尝试 2: serveo SSH 隧道
  if (!result) {
    console.log('[2/2] 尝试 SSH 隧道 (serveo.net)...');
    result = await tryServeo();
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  🐺 狼人杀 — 联机地址');
  console.log('═══════════════════════════════════════════');

  if (result) {
    console.log(`  📡 公网地址: ${result.url}  (${result.type})`);
  } else {
    console.log('  ❌ 自动获取公网地址失败');
  }

  console.log(`  🏠 局域网:   http://${localIP}:${PORT}`);
  console.log(`  💻 本机:     http://localhost:${PORT}`);
  console.log('');
  if (result) {
    console.log('  👉 把「公网地址」发给任何人，全球都能加入！');
  } else {
    console.log('  💡 公网隧道失败，同一WiFi下可用局域网地址');
    console.log('  💡 永久方案：参考 deploy/deploy.md 部署到云服务器');
  }
  console.log('═══════════════════════════════════════════');
}

main().catch(console.error);
