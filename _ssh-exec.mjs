// 临时 SSH 命令执行工具（诊断用）
import { Client } from 'ssh2';
const HOST = '210.16.170.144';
const USER = 'root';
const PASSWORD = process.argv[2];
const CMD = process.argv.slice(3).join(' ');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(CMD, (err, stream) => {
    if (err) { console.error('exec err', err.message); conn.end(); process.exit(1); }
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stdout.write(d));
    stream.on('close', () => { conn.end(); process.exit(0); });
  });
});
conn.on('error', (e) => { console.error('SSH err:', e.message); process.exit(1); });
conn.connect({ host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 20000 });
