// ============================================================
// 狼人杀 性能测试 — 主运行器
// 用法: node tests/run-all.js [选项]
// 选项:
//   --quick     仅运行快速测试 (1-3, 8, 11, 14)
//   --game      仅运行游戏测试 (4-6, 12-13, 18-20)
//   --stress    仅运行压力测试 (7, 8, 18, 20)
//   --two-rooms 运行所有双房间测试 (5, 6, 9, 16, 17, 18)
//   --all       运行全部 20 个测试 (默认)
//   --server    指定服务器 URL (默认 http://localhost:4000)
// ============================================================

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ALL_TESTS = [
  { file: '01-connection-test.js',        name: '基础连接',        category: 'quick' },
  { file: '02-registration-test.js',       name: '注册登录',        category: 'quick' },
  { file: '03-room-create-test.js',        name: '房间创建加入',    category: 'quick' },
  { file: '04-single-room-full-game.js',   name: '单房间完整游戏',  category: 'game' },
  { file: '05-two-rooms-parallel.js',      name: '双房间并行',      category: 'two-rooms' },
  { file: '06-two-rooms-full-game.js',     name: '双房间自动游戏',  category: 'two-rooms' },
  { file: '07-concurrent-connections.js',  name: '并发连接压力',    category: 'stress' },
  { file: '08-rapid-room-create.js',       name: '快速房间创建',    category: 'stress' },
  { file: '09-chat-latency-test.js',       name: '聊天延迟',        category: 'two-rooms' },
  { file: '10-reconnect-test.js',          name: '断线重连',        category: 'game' },
  { file: '11-password-room-test.js',      name: '密码房间',        category: 'quick' },
  { file: '12-vote-performance.js',        name: '投票性能',        category: 'game' },
  { file: '13-night-action-test.js',       name: '夜晚行动',        category: 'game' },
  { file: '14-role-config-test.js',        name: '角色配置',        category: 'quick' },
  { file: '15-edge-case-early-leave.js',   name: '中途退出',        category: 'game' },
  { file: '16-lobby-list-test.js',         name: '大厅列表更新',    category: 'two-rooms' },
  { file: '17-voice-signaling-test.js',    name: '语音信令',        category: 'two-rooms' },
  { file: '18-two-rooms-18-players.js',    name: '最大容量18人',    category: 'stress' },
  { file: '19-rapid-phase-transition.js',  name: '阶段转换速度',    category: 'game' },
  { file: '20-endurance-test.js',          name: '耐久性连续5局',   category: 'stress' },
];

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function color(c, s) { return `${COLORS[c]}${s}${COLORS.reset}`; }

async function runTest(testFile, timeoutMs = 600000) {
  return new Promise((resolve) => {
    const filePath = resolve(__dirname, testFile);
    const start = Date.now();

    const child = spawn('node', [filePath], {
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '1' },
      cwd: resolve(__dirname, '..'),
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ file: testFile, success: false, timeout: true, duration: Date.now() - start, stdout, stderr });
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      const duration = Date.now() - start;
      const success = code === 0;

      // 解析通过/失败数
      const passMatch = stdout.match(/通过:\s*(\d+)\/(\d+)/);
      const passed = passMatch ? parseInt(passMatch[1]) : -1;
      const total = passMatch ? parseInt(passMatch[2]) : -1;

      resolve({ file: testFile, success, duration, passed, total, stdout, stderr });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ file: testFile, success: false, error: err.message, duration: Date.now() - start, stdout, stderr });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let filter = 'all';

  if (args.includes('--quick')) filter = 'quick';
  if (args.includes('--game')) filter = 'game';
  if (args.includes('--stress')) filter = 'stress';
  if (args.includes('--two-rooms')) filter = 'two-rooms';
  if (args.includes('--all')) filter = 'all';

  let testsToRun;
  if (filter === 'all') {
    testsToRun = ALL_TESTS;
  } else {
    testsToRun = ALL_TESTS.filter(t => t.category === filter ||
      (filter === 'game' && (t.category === 'game' || t.category === 'two-rooms')));
  }

  console.log(color('cyan', `\n🐺 狼人杀性能测试 — ${filter}模式`));
  console.log(color('cyan', `   共 ${testsToRun.length} 个测试\n`));

  const totalStart = Date.now();
  const results = [];
  let passedCount = 0;
  let failedCount = 0;

  // 串行运行（避免干扰）
  for (let i = 0; i < testsToRun.length; i++) {
    const test = testsToRun[i];
    const label = `[${i + 1}/${testsToRun.length}]`;
    console.log(color('yellow', `${label} 运行: ${test.name}...`));

    const result = await runTest(test.file);

    results.push({
      ...test,
      ...result,
    });

    if (result.success) {
      passedCount++;
      console.log(color('green', `${label} ✅ 通过 (${(result.duration / 1000).toFixed(1)}s)`));
    } else {
      failedCount++;
      const reason = result.timeout ? '超时' : (result.error || '失败');
      console.log(color('red', `${label} ❌ ${reason} (${(result.duration / 1000).toFixed(1)}s)`));
    }

    // 测试间短暂休息
    if (i < testsToRun.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 总报告
  const totalTime = Date.now() - totalStart;

  console.log(`\n${'='.repeat(70)}`);
  console.log(color('cyan', '  最终测试报告'));
  console.log(`${'='.repeat(70)}`);

  console.log(`\n  ${'测试名称'.padEnd(30)} ${'结果'.padEnd(8)} ${'耗时'.padEnd(12)} ${'详情'}`);
  console.log(`  ${'-'.repeat(65)}`);

  for (const r of results) {
    const icon = r.success ? '✅' : '❌';
    const time = `${(r.duration / 1000).toFixed(1)}s`;
    const detail = r.passed >= 0 ? `${r.passed}/${r.total}通过` : (r.error || '');
    console.log(`  ${icon} ${r.name.padEnd(28)} ${time.padEnd(12)} ${detail}`);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(color('cyan', `  总计: ${results.length}个测试 | ✅ ${passedCount}通过 | ❌ ${failedCount}失败 | ⏱ ${(totalTime / 1000).toFixed(0)}s`));
  console.log(`${'='.repeat(70)}\n`);

  // 输出失败测试的错误信息
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log(color('red', '\n失败测试详情:\n'));
    for (const r of failedTests) {
      console.log(color('yellow', `--- ${r.name} ---`));
      // 显示最后 20 行 stdout
      const lines = r.stdout.split('\n').filter(l => l.trim());
      const lastLines = lines.slice(-20);
      console.log(lastLines.join('\n'));
      if (r.stderr.trim()) {
        console.log(color('red', '\nSTDERR:'));
        console.log(r.stderr.substring(0, 500));
      }
      console.log('');
    }
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(color('red', '运行器异常:'), e);
  process.exit(1);
});
