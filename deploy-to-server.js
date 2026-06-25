// ============================================================
// 狼人杀 自动部署脚本 (使用 ssh2)
// 用法: node deploy-to-server.js <密码>
// ============================================================

import { Client } from 'ssh2';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ====== 服务器配置 ======
const HOST = '210.16.170.144';
const PORT = 22;
const USER = 'root';
const REMOTE_BASE = '/opt/werewolf-server';

// ====== 本机文件路径 ======
const SERVER_SRC = join(__dirname, 'server', 'src');
const CLIENT_DIST = join(__dirname, 'client', 'dist');
const SERVER_PKG = join(__dirname, 'server', 'package.json');

const PASSWORD = process.argv[2];

if (!PASSWORD) {
  console.log('用法: node deploy-to-server.js <服务器密码>');
  console.log('例如: node deploy-to-server.js MyPassword123');
  process.exit(1);
}

// ====== 工具函数 ======
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function collectFiles(dir, base = dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else {
      files.push({
        localPath: fullPath,
        remotePath: join(REMOTE_BASE, relative(base, fullPath)).replace(/\\/g, '/'),
      });
    }
  }
  return files;
}

// ====== 主流程 ======
async function deploy() {
  console.log(c.cyan('🐺 狼人杀 — 自动部署到云服务器'));
  console.log(c.cyan(`   目标: ${USER}@${HOST}:${REMOTE_BASE}\n`));

  // 1. 收集文件
  console.log(c.yellow('[1/4] 收集部署文件...'));
  const serverFiles = collectFiles(SERVER_SRC);
  const clientFiles = collectFiles(CLIENT_DIST, CLIENT_DIST).map(f => ({
    ...f,
    remotePath: join(REMOTE_BASE, 'dist', relative(CLIENT_DIST, f.localPath)).replace(/\\/g, '/'),
  }));
  const pkgFile = {
    localPath: SERVER_PKG,
    remotePath: join(REMOTE_BASE, 'package.json').replace(/\\/g, '/'),
  };
  const allFiles = [...serverFiles, ...clientFiles, pkgFile];
  console.log(`   服务器文件: ${serverFiles.length} 个`);
  console.log(`   客户端文件: ${clientFiles.length} 个`);
  console.log(`   总计: ${allFiles.length} 个文件\n`);

  // 2. 连接
  console.log(c.yellow('[2/4] 连接服务器...'));
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log(c.green('   ✅ 已连接\n'));
      resolve();
    });
    conn.on('error', (err) => {
      console.log(c.red(`   ❌ 连接失败: ${err.message}`));
      reject(err);
    });
    conn.connect({
      host: HOST,
      port: PORT,
      username: USER,
      password: PASSWORD,
      readyTimeout: 15000,
    });
  });

  // 3. 上传文件
  console.log(c.yellow('[3/4] 上传文件...'));

  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) { reject(err); return; }

      let uploaded = 0;
      const total = allFiles.length;
      let finished = false;

      function ensureDir(remotePath, cb) {
        const dir = dirname(remotePath).replace(/\\/g, '/');
        sftp.mkdir(dir, { mode: 0o755 }, (err2) => {
          // 忽略已存在的错误
          cb();
        });
      }

      function uploadNext(index) {
        if (index >= total) {
          finished = true;
          sftp.end();
          resolve();
          return;
        }

        const file = allFiles[index];
        const progress = `[${index + 1}/${total}]`;

        ensureDir(file.remotePath, () => {
          const readStream = createReadStream(file.localPath);
          const writeStream = sftp.createWriteStream(file.remotePath, {
            mode: 0o644,
          });

          writeStream.on('close', () => {
            uploaded++;
            if (uploaded % 10 === 0 || uploaded === total) {
              console.log(`   ${progress} 已上传 ${uploaded}/${total}`);
            }
            uploadNext(index + 1);
          });

          writeStream.on('error', (e) => {
            console.log(c.red(`   ❌ 上传失败: ${file.remotePath} - ${e.message}`));
            uploadNext(index + 1);
          });

          readStream.pipe(writeStream);
        });
      }

      uploadNext(0);
    });
  });

  console.log(c.green('   ✅ 文件上传完成\n'));

  // 4. 重启服务
  console.log(c.yellow('[4/4] 重启服务器...'));

  const restartResult = await new Promise((resolve) => {
    conn.exec('cd /opt/werewolf-server && npm install --production 2>&1 && pm2 restart werewolf-server 2>&1 || pm2 start src/index.js --name werewolf-server 2>&1', (err, stream) => {
      if (err) { resolve({ error: err.message }); return; }
      let output = '';
      stream.on('data', (data) => { output += data.toString(); });
      stream.stderr.on('data', (data) => { output += data.toString(); });
      stream.on('close', () => resolve({ output }));
    });
  });

  if (restartResult.error) {
    console.log(c.red(`   ❌ 重启失败: ${restartResult.error}`));
    console.log(c.yellow('   请手动 SSH 到服务器执行:'));
    console.log(c.yellow('   cd /opt/werewolf-server && npm install && pm2 restart werewolf-server'));
  } else {
    console.log(c.green('   ✅ 服务器重启成功'));
    console.log(c.cyan(`   ${restartResult.output?.trim()}`));
  }

  conn.end();

  console.log(c.green('\n════════════════════════════════════'));
  console.log(c.green('  🎉 部署完成！'));
  console.log(c.green('  游戏地址: http://210.16.170.144:4000'));
  console.log(c.green('════════════════════════════════════\n'));
}

deploy().catch(e => {
  console.error(c.red(`部署失败: ${e.message}`));
  process.exit(1);
});
