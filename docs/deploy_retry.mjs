const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST='210.16.170.144'; const USER='root'; const PWD='zx4ShToBKhT9tVcQ';
const REMOTE='/opt/werewolf-server';
const LOCAL = path.join(__dirname, '..', 'server', 'src');

function collectFiles(dir, base=dir) {
  const results = [];
  for(const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const fp = path.join(dir, entry.name);
    if(entry.isDirectory()) results.push(...collectFiles(fp, base));
    else results.push({local:fp, remote:path.join(REMOTE, path.relative(base, fp)).replace(/\\/g,'/')});
  }
  return results;
}

const serverFiles = collectFiles(LOCAL);
console.log('Files to upload:', serverFiles.length);

function uploadFiles(files) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('Connected');
      conn.sftp((err, sftp) => {
        if(err) { conn.end(); reject(err); return; }
        let done=0; const total=files.length;
        function ensureDir(rp, cb) {
          const d = path.dirname(rp).replace(/\\/g,'/');
          sftp.mkdir(d, {mode:0o755}, () => cb());
        }
        function upload(i) {
          if(i>=total) { sftp.end(); conn.end(); resolve(); return; }
          const f = files[i];
          ensureDir(f.remote, () => {
            const rs = fs.createReadStream(f.local);
            const ws = sftp.createWriteStream(f.remote, {mode:0o644});
            ws.on('close', () => { done++; if(done%5===0) console.log(done+'/'+total); upload(i+1); });
            ws.on('error', (e) => { console.error('Fail:', path.basename(f.remote), e.message); upload(i+1); });
            rs.pipe(ws);
          });
        }
        upload(0);
      });
    });
    conn.on('error', (e) => { conn.end(); reject(e); });
    conn.connect({host:HOST, port:22, username:USER, password:PWD, readyTimeout:30000, keepaliveInterval:5000});
  });
}

async function main() {
  try {
    await uploadFiles(serverFiles);
    console.log('Server files uploaded');

    const conn = new Client();
    await new Promise((resolve, reject) => {
      conn.on('ready', () => {
        conn.exec('cd /opt/werewolf-server && npm install --production 2>&1 && pm2 restart werewolf-server 2>&1', (err, stream) => {
          let out='';
          stream.on('data', d => out+=d.toString());
          stream.stderr.on('data', d => out+=d.toString());
          stream.on('close', () => { console.log(out.slice(-300)); conn.end(); resolve(); });
        });
      });
      conn.on('error', (e) => { conn.end(); reject(e); });
      conn.connect({host:HOST, port:22, username:USER, password:PWD, readyTimeout:15000});
    });
    console.log('DONE - Server restarted');
  } catch(e) { console.error('DEPLOY FAILED:', e.message); process.exit(1); }
}
main();
