// ============================================================
// upload-client-zip-resume.mjs — 断点续传 + 自动重试上传
// 用法: node upload-client-zip-resume.mjs <服务器密码>
// 断点: 每次连接先 stat 远端, 已传 N 字节则从 N 继续(append)
// 重试: 连接/传输失败后等待 3s 重连, 直到传完或次数耗尽
// ============================================================
import { Client } from 'ssh2';
import { createReadStream, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HOST = '210.16.170.144', PORT = 22, USER = 'root';
const REMOTE_DIR = '/opt/veilland-server/download';
const ZIP_NAME = '帷幕之地3D.zip';
const LOCAL = join(dirname(fileURLToPath(import.meta.url)), 'download', ZIP_NAME);
const REMOTE = REMOTE_DIR + '/' + ZIP_NAME;
const PASSWORD = process.argv[2];
if (!PASSWORD) { console.log('用法: node upload-client-zip-resume.mjs <密码>'); process.exit(1); }
if (!existsSync(LOCAL)) { console.error('本地文件不存在: ' + LOCAL); process.exit(1); }
const total = statSync(LOCAL).size;
const totalMB = (total / 1048576).toFixed(1);
console.log(`🌑 断点续传 ${ZIP_NAME} (${totalMB} MB) → ${HOST}${REMOTE}`);

function attempt(prev, tries) {
  if (tries <= 0) { console.error('❌ 重试次数耗尽, 上传失败'); process.exit(1); }
  const c = new Client();
  c.on('ready', () => {
    c.sftp((e, sftp) => {
      if (e) { console.log(`  ❌ SFTP 失败: ${e.message} (重试)`); c.end(); setTimeout(() => attempt(prev, tries-1), 3000); return; }
      sftp.mkdir(REMOTE_DIR, { mode: 0o755 }, () => {
        sftp.stat(REMOTE, (se, st) => {
          let offset = 0;
          if (!se && st) {
            if (st.size >= total) { console.log('  ✅ 远端已完整, 无需上传'); sftp.end(); c.end(); process.exit(0); }
            offset = st.size;
          }
          if (offset > prev) console.log(`  ↻ 从断点 ${(offset/1048576).toFixed(1)} MB 继续`);
          const flags = offset > 0 ? 'a' : 'w';
          const rs = createReadStream(LOCAL, { start: offset });
          const ws = sftp.createWriteStream(REMOTE, { mode: 0o644, flags });
          let uploaded = offset, lastLog = offset;
          rs.on('data', chunk => {
            uploaded += chunk.length;
            if (uploaded - lastLog >= 50*1048576) {
              lastLog = uploaded;
              console.log(`  进度 ${(uploaded/1048576).toFixed(0)}/${totalMB} MB (${(100*uploaded/total).toFixed(0)}%)`);
            }
          });
          ws.on('close', () => {
            sftp.stat(REMOTE, (e2, st2) => {
              if (e2 || !st2 || st2.size !== total) {
                console.log(`  ⚠️ 未完成 (远端 ${st2?st2.size:'?'}/${total}), 重试`);
                sftp.end(); c.end(); setTimeout(() => attempt(Math.max(prev, offset), tries-1), 3000);
              } else {
                console.log(`  ✅ 上传完成并校验通过 (${(st2.size/1048576).toFixed(1)} MB)`);
                sftp.end(); c.end(); process.exit(0);
              }
            });
          });
          ws.on('error', er => { console.log(`  ❌ 传输失败: ${er.message} (重试)`); c.end(); setTimeout(() => attempt(Math.max(prev, offset), tries-1), 3000); });
          rs.pipe(ws);
        });
      });
    });
  });
  c.on('error', er => { console.log(`  ❌ 连接失败: ${er.message} (重试)`); setTimeout(() => attempt(prev, tries-1), 3000); });
  c.connect({ host: HOST, port: PORT, username: USER, password: PASSWORD, readyTimeout: 20000, keepaliveInterval: 5000, keepaliveCountMax: 10 });
}
attempt(0, 80);
