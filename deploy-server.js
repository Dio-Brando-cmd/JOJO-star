// ============================================================
// 狼人杀服务器部署脚本
// 将更新后的服务器代码部署到云服务器
// 用法: node deploy-server.js
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ====== 配置 ======
const REMOTE_HOST = '210.16.170.144';
const REMOTE_USER = 'root';
const REMOTE_PATH = '/opt/werewolf-server';
const REMOTE_PORT = 22;

// 本机构建目录
const SERVER_SRC = join(__dirname, 'server', 'src');
const CLIENT_DIST = join(__dirname, 'client', 'dist');
const SERVER_PKG = join(__dirname, 'server', 'package.json');
const ROOT_PKG = join(__dirname, 'package.json');

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function log(msg, color = 'cyan') {
  console.log(colors[color](msg));
}

async function deploy() {
  log('🐺 狼人杀 — 部署到云服务器');
  log(`   目标: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}`);

  // 1. 检查构建产物
  if (!existsSync(CLIENT_DIST)) {
    log('❌ 客户端未构建！请先运行: cd client && npm run build', 'red');
    log('   或者: npm run build:client', 'yellow');
    return;
  }
  log('✅ 客户端构建产物就绪', 'green');

  // 2. 打包文件
  log('📦 打包部署文件...');
  const tmpDir = join(__dirname, '.deploy-tmp');
  execSync(`rm -rf "${tmpDir}" && mkdir -p "${tmpDir}"`, { shell: true });

  // 复制文件
  execSync(`cp -r "${SERVER_SRC}" "${tmpDir}/src"`, { shell: true });
  execSync(`cp -r "${CLIENT_DIST}" "${tmpDir}/dist"`, { shell: true });
  execSync(`cp "${SERVER_PKG}" "${tmpDir}/package.json"`, { shell: true });

  log('📤 上传到服务器（使用 scp）...');
  log('   如果你使用密码登录，请运行以下命令:', 'yellow');
  log('');
  log(`   scp -r "${tmpDir.replace(/\\/g, '/')}/"* ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/`, 'green');
  log('');
  log('   然后 SSH 到服务器执行:', 'yellow');
  log('');
  log(`   ssh ${REMOTE_USER}@${REMOTE_HOST}`, 'green');
  log(`   cd ${REMOTE_PATH}`, 'green');
  log('   npm install --production', 'green');
  log('   pm2 restart werewolf-server || pm2 start src/index.js --name werewolf-server', 'green');
  log('');
  log('   或者直接使用 rsync (更快):', 'yellow');
  log('');
  log(`   rsync -avz --delete "${tmpDir.replace(/\\/g, '/')}/" ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/`, 'green');

  // 3. 清理
  // execSync(`rm -rf "${tmpDir}"`, { shell: true });

  log('✅ 部署准备完成！请按照上述命令上传', 'green');
}

// 如果直接运行此脚本
deploy().catch(e => {
  console.error(e);
});
