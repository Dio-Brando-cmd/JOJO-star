// ============================================================
// 帷幕之地 — 仅部署 Game.js (快速热更)
// 用法: node deploy-gamejs.mjs <服务器密码>
// 上传 server/src/game/Game.js → /opt/veilland-server/game/Game.js
// 然后 pm2 restart veilland-server (带生产盐环境变量)
// ============================================================

import { Client } from 'ssh2';
import { createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOST = '210.16.170.144';
const PORT = 22;
const USER = 'root';
const REMOTE_PATH = '/opt/veilland-server/game/Game.js';
const LOCAL_PATH = join(__dirname, 'server', 'src', 'game', 'Game.js');
const PASSWORD = process.argv[2];

if (!PASSWORD) {
  console.log('用法: node deploy-gamejs.mjs <服务器密码>');
  process.exit(1);
}

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

const conn = new Client();
conn.on('ready', () => {
  console.log(c.green('   ✅ 已连接'));
  conn.sftp((err, sftp) => {
    if (err) { console.log(c.red(`SFTP 失败: ${err.message}`)); process.exit(1); }
    console.log(c.yellow(`   上传 ${LOCAL_PATH} → ${REMOTE_PATH}`));
    const read = createReadStream(LOCAL_PATH);
    const write = sftp.createWriteStream(REMOTE_PATH, { mode: 0o644 });
    write.on('close', () => {
      console.log(c.green('   ✅ Game.js 上传完成'));
      sftp.end();
      const restartCmd = 'cd /opt/veilland-server && (USER_PASSWORD_SALT="veilland-prod-salt-1.4.0" ROOM_PASSWORD_SALT="veilland-room-salt-1.4.0" pm2 restart veilland-server 2>&1 || USER_PASSWORD_SALT="veilland-prod-salt-1.4.0" ROOM_PASSWORD_SALT="veilland-room-salt-1.4.0" pm2 start index.js --name veilland-server 2>&1)';
      conn.exec(restartCmd, (e2, stream) => {
        if (e2) { console.log(c.red(`重启失败: ${e2.message}`)); process.exit(1); }
        let out = '';
        stream.on('data', (d) => { out += d.toString(); });
        stream.stderr.on('data', (d) => { out += d.toString(); });
        stream.on('close', () => {
          console.log(c.green('   ✅ 服务器重启成功'));
          console.log(c.cyan(out.trim()));
          conn.end();
          console.log(c.green('\n🎉 Game.js 部署完成'));
          process.exit(0);
        });
      });
    });
    write.on('error', (e) => { console.log(c.red(`上传失败: ${e.message}`)); process.exit(1); });
    read.pipe(write);
  });
});
conn.on('error', (err) => {
  console.log(c.red(`连接失败: ${err.message}`));
  process.exit(1);
});
conn.connect({ host: HOST, port: PORT, username: USER, password: PASSWORD, readyTimeout: 15000 });
