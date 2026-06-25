// ============================================================
// 狼人杀桌面客户端 — 全平台互通版本
// 与网页版、Android版使用同一云服务器
// ============================================================

import { app, BrowserWindow, shell, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 云服务器地址（所有版本统一使用此地址）
const CLOUD_SERVER = 'http://210.16.170.144:4000';
// 备用：本地开发服务器
const LOCAL_SERVER = 'http://localhost:4000';

let mainWindow = null;

// 自动检测最佳服务器
async function detectServer() {
  // 优先使用云服务器；如果不可达则使用本地
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${CLOUD_SERVER}/api/status`, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      console.log('✅ 云服务器可用:', CLOUD_SERVER);
      return CLOUD_SERVER;
    }
  } catch (e) {
    console.log('⚠️ 云服务器不可达，使用本地服务器');
  }
  return LOCAL_SERVER;
}

function createWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: '🐺 狼人杀 — 在线联机',
    icon: path.join(__dirname, '..', 'client', 'public', 'moon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 允许麦克风访问（WebRTC语音聊天需要）
      // Electron默认允许media访问
    },
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e',
  });

  mainWindow.loadURL(serverUrl);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle('🐺 狼人杀 — 在线联机');
  });

  // 处理麦克风权限请求
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      // 允许麦克风和媒体访问（WebRTC语音需要）
      const allowedPermissions = ['media', 'microphone', 'audioCapture'];
      if (allowedPermissions.includes(permission)) {
        console.log(`[权限] 允许: ${permission}`);
        callback(true);
      } else {
        callback(false);
      }
    }
  );

  // 允许外部链接在浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const serverUrl = await detectServer();
  createWindow(serverUrl);
  console.log('🐺 狼人杀桌面版已启动');
  console.log('   服务器:', serverUrl);
  console.log('   互通版本: Web | Android | Desktop');
});

app.on('window-all-closed', () => {
  app.quit();
});

// macOS: 点击dock图标重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(CLOUD_SERVER);
  }
});
