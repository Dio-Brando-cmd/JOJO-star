// 临时脚本: 删除远端 zip, 供重新全量上传
// (因续传脚本把"旧包"误判为"部分上传"导致 append 污染, 需先清空再传)
import { Client } from 'ssh2';
const PASSWORD = process.argv[2];
if (!PASSWORD) { console.log('用法: node _reset-remote.mjs <密码>'); process.exit(1); }
const c = new Client();
c.on('ready', () => {
  c.exec(`rm -f /opt/veilland-server/download/帷幕之地3D.zip && (ls -la /opt/veilland-server/download/帷幕之地3D.zip 2>/dev/null || echo "REMOTE_GONE")`, (e, stream) => {
    if (e) { console.error('exec err', e); process.exit(1); }
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stdout.write(d));
    stream.on('close', () => { c.end(); process.exit(0); });
  });
});
c.on('error', e => { console.error('conn err', e); process.exit(1); });
c.connect({ host: '210.16.170.144', port: 22, username: 'root', password: PASSWORD, readyTimeout: 20000, keepaliveInterval: 5000 });
