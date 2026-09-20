// ============================================================
// upload-client-zip.js — 只上传客户端包到服务器下载目录 (不重启服务)
// 用法: node upload-client-zip.js <服务器密码>
// 上传 download/帷幕之地3D.zip → /opt/veilland-server/download/
// ============================================================

import { Client } from 'ssh2';
import { createReadStream, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOST = '210.16.170.144';
const PORT = 22;
const USER = 'root';
const REMOTE_DIR = '/opt/veilland-server/download';
const ZIP_NAME = '帷幕之地3D.zip';
const LOCAL = join(__dirname, 'download', ZIP_NAME);
const REMOTE = REMOTE_DIR + '/' + ZIP_NAME;

const PASSWORD = process.argv[2];
if (!PASSWORD) { console.log('用法: node upload-client-zip.js <服务器密码>'); process.exit(1); }
if (!existsSync(LOCAL)) { console.error(`本地文件不存在: ${LOCAL}`); process.exit(1); }

const total = statSync(LOCAL).size;
const totalMB = (total / 1024 / 1024).toFixed(1);
console.log(`🌑 上传客户端包 ${ZIP_NAME} (${totalMB} MB) → ${HOST}:${REMOTE}`);

const conn = new Client();
conn.on('ready', () => {
  console.log('   ✅ SSH 已连接');
  conn.sftp((err, sftp) => {
    if (err) { console.error('   ❌ SFTP 失败:', err.message); process.exit(1); }

    sftp.mkdir(REMOTE_DIR, { mode: 0o755 }, () => {
      const rs = createReadStream(LOCAL);
      const ws = sftp.createWriteStream(REMOTE, { mode: 0o644 });

      let uploaded = 0;
      let lastLog = 0;
      rs.on('data', (chunk) => {
        uploaded += chunk.length;
        if (uploaded - lastLog >= 25 * 1024 * 1024) {
          lastLog = uploaded;
          console.log(`   进度 ${(uploaded / 1024 / 1024).toFixed(0)}/${totalMB} MB (${(100 * uploaded / total).toFixed(0)}%)`);
        }
      });

      ws.on('close', () => {
        // 校验远端大小
        sftp.stat(REMOTE, (e, st) => {
          if (e || !st) { console.error('   ⚠️ 无法校验远端文件, 但上传流已关闭'); }
          else if (st.size !== total) {
            console.error(`   ❌ 大小不一致: 远端 ${st.size} ≠ 本地 ${total}`);
            sftp.end(); conn.end(); process.exit(1);
          } else {
            console.log(`   ✅ 上传完成并校验通过 (${(st.size / 1024 / 1024).toFixed(1)} MB)`);
          }
          sftp.end(); conn.end(); process.exit(e || st?.size !== total ? 1 : 0);
        });
      });

      ws.on('error', (e) => { console.error('   ❌ 上传失败:', e.message); process.exit(1); });
      rs.pipe(ws);
    });
  });
});
conn.on('error', (err) => { console.error('   ❌ 连接失败:', err.message); process.exit(1); });
conn.connect({ host: HOST, port: PORT, username: USER, password: PASSWORD, readyTimeout: 15000 });
