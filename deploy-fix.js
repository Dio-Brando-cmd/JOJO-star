// 狼人杀 - 修正版部署脚本 (部署到 /opt/werewolf/server/src)
import { Client } from 'ssh2';
import { readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST = '210.16.170.144';
const USER = 'root';
const PWD = 'zx4ShToBKhT9tVcQ';
const REMOTE_SRC = '/opt/werewolf/server/src';
const REMOTE_DIST = '/opt/werewolf/client/dist';
const REMOTE_BGM = '/opt/werewolf/client/dist/bgm';

function collectFiles(dir, base) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const fp = join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...collectFiles(fp, base));
    } else {
      files.push({ local: fp, size: statSync(fp).size });
    }
  }
  return files;
}

function toUnix(p) {
  return p.replace(/\\/g, '/');
}

const SERVER_BASE = join(__dirname, 'server', 'src');
const CLIENT_BASE = join(__dirname, 'client', 'dist');
const serverFiles = collectFiles(SERVER_BASE, SERVER_BASE);
const clientFiles = collectFiles(CLIENT_BASE, CLIENT_BASE);

console.log(`服务器源文件: ${serverFiles.length} 个`);
console.log(`客户端文件: ${clientFiles.length} 个`);

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH已连接');

  conn.sftp((err, sftp) => {
    if (err) { console.log('SFTP失败:', err.message); conn.end(); return; }

    // 收集需要创建的目录
    const dirs = new Set();
    for (const f of serverFiles) {
      const rel = relative(SERVER_BASE, f.local);
      dirs.add(toUnix(dirname(join(REMOTE_SRC, rel))));
    }
    for (const f of clientFiles) {
      const rel = relative(CLIENT_BASE, f.local);
      dirs.add(toUnix(dirname(join(REMOTE_DIST, rel))));
    }

    // 创建目录
    let dirPending = dirs.size;
    if (dirPending === 0) {
      startUpload();
    } else {
      console.log(`创建 ${dirPending} 个目录...`);
      for (const d of dirs) {
        sftp.mkdir(d, { mode: 0o755 }, (e) => {
          // 忽略已存在错误
          dirPending--;
          if (dirPending === 0) {
            console.log('目录就绪');
            startUpload();
          }
        });
      }
    }

    function startUpload() {
      const all = [];
      for (const f of serverFiles) {
        const rel = relative(SERVER_BASE, f.local);
        all.push({
          local: f.local,
          remote: toUnix(join(REMOTE_SRC, rel)),
        });
      }
      for (const f of clientFiles) {
        const rel = relative(CLIENT_BASE, f.local);
        all.push({
          local: f.local,
          remote: toUnix(join(REMOTE_DIST, rel)),
        });
      }

      console.log(`开始上传 ${all.length} 个文件...`);
      let idx = 0;
      let errors = 0;

      function uploadNext() {
        if (idx >= all.length) {
          console.log(`上传完成: ${all.length - errors}/${all.length} 成功`);
          sftp.end();
          restartPM2();
          return;
        }
        const f = all[idx];
        const rs = createReadStream(f.local);
        const ws = sftp.createWriteStream(f.remote, { mode: 0o644 });

        ws.on('close', () => {
          idx++;
          if (idx % 8 === 0 || idx === all.length) {
            process.stdout.write(`\r  进度: ${idx}/${all.length}`);
          }
          uploadNext();
        });

        ws.on('error', (e) => {
          console.log(`\n  失败: ${f.remote} - ${e.message}`);
          errors++;
          idx++;
          uploadNext();
        });

        rs.on('error', (e) => {
          console.log(`\n  读取失败: ${f.local} - ${e.message}`);
          errors++;
          idx++;
          uploadNext();
        });

        rs.pipe(ws);
      }

      uploadNext();
    }

    function restartPM2() {
      console.log('\n创建数据目录并重启...');
      conn.exec('mkdir -p /opt/werewolf/server/data && pm2 restart werewolf', (e, stream) => {
        if (e) { console.log('exec失败:', e.message); conn.end(); return; }
        let out = '';
        stream.on('data', (d) => { out += d.toString(); });
        stream.stderr.on('data', (d) => { out += d.toString(); });
        stream.on('close', () => {
          console.log(out.trim());
          // 验证服务
          conn.exec('curl -s http://localhost:4000/api/status', (e2, s2) => {
            if (s2) {
              let out2 = '';
              s2.on('data', d => out2 += d.toString());
              s2.on('close', () => {
                console.log('服务状态:', out2.trim());
                console.log('\n✅ 部署成功！');
                console.log('🌐 http://210.16.170.144:4000');
                conn.end();
              });
            } else {
              console.log('\n✅ 部署完成');
              console.log('🌐 http://210.16.170.144:4000');
              conn.end();
            }
          });
        });
      });
    }
  });
});

conn.on('error', (e) => {
  console.log('连接失败:', e.message);
  process.exit(1);
});

conn.connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PWD,
  readyTimeout: 15000,
});
