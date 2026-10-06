// ============================================================
// 真相盘引擎 —— 自检 / 演示脚本（纯 Node，无依赖）
// 运行：  node server/src/game/truth/demo.js [seed]
// 输出：
//   1. 一局完整生成的「真相盘」明细（含区域/吞噬顺序/阶段解锁）
//   2. 种子可复现校验（同 seed 两次生成逐字段相等）
//   3. 结构性不变量自检（跑 1000 个 seed）
//   4. 命运时钟演示：阶段跃迁 / 帷幕吞噬 / 阶段门控动作
//   5. 两种胜负（灵焰净化 / 食神者绝望）判定演示
//   6. 回放复现校验（同 seed 重放动作序列 → 状态逐字段一致）
// ============================================================

import { createMatch, applyAction, checkWin, computePersonalScores, snapshot, replayMatch } from './TruthEngine.js';
import { GODS, GOD_MAP, CONTRACTS, ZONES } from './truth-data.js';

const SEP = '─'.repeat(72);

// ---------- 1. 一局明细 ----------
function printMatch(match) {
  const god = GOD_MAP[match.god];
  console.log(`\n${SEP}`);
  console.log(`【真相盘】 一局明细   种子="${match.seedRaw}"  (hash=${match.seed})`);
  console.log(`${SEP}`);
  console.log(`真神：${god.icon} ${god.name}`);
  console.log(`  特殊规则：${god.rule}`);
  console.log(`  净化条件：${god.purify}`);
  console.log(`  吞噬顺序（外围→核心）：${match.consumeOrder.join(' → ')}`);
  console.log(`  净化点：${match.purifyPoint.zone}${match.purifyPoint.hidden ? '（不可见）' : ''}${match.purifyPoint.wandering ? '（会游走）' : ''}${match.purifyPoint.semiRandom ? '（半随机）' : ''}`);
  console.log(`  阶段：${phaseName(match.phase)}｜解锁：${unlockStr(match.unlocks)}`);

  console.log(`\n—— 玩家（阵营 / 角色 / 契约 / 初始碎片）——`);
  for (const p of match.players) {
    const teamTag = p.team === 'spirit' ? '灵焰方' : '食神者';
    const shards = p.shards.map((s) => `[${s.kind === 'true' ? '真' : '伪'}:${GOD_MAP[s.hintGod].name}]${s.text}`).join(' | ') || '（无）';
    const extra = p.contract.id === 'guardian'
      ? ` 守护→${p.guardTargetId}`
      : p.contract.id === 'fatebreaker'
        ? ` 转世→${GOD_MAP[p.reincarnationOf].name}`
        : '';
    console.log(`  ${p.id} ${p.name}｜${teamTag}·${p.role}｜契约:${p.contract.icon}${p.contract.name}${extra}`);
    console.log(`      ${shards}`);
  }

  console.log(`\n—— 任务（带碎片的任务完成后会奖励该碎片）——`);
  for (const t of match.tasks) {
    const shardTag = t.shard ? `  ⭐[${t.shard.kind === 'true' ? '真' : '伪'}:${GOD_MAP[t.shard.hintGod].name}]` : '';
    console.log(`  ${t.id} ${t.name}${shardTag}`);
  }

  const totals = countShards(match);
  console.log(`\n碎片统计：真 ${totals.true} / 伪 ${totals.false}（环境伪 ${totals.envFalse} + 植入伪 ${totals.plant}）`);
  console.log(`时钟：灵焰 ${match.clocks.spirit}/${match.config.spiritMax + (god.mechanic.extraSpiritCost || 0)}，绝望 ${match.clocks.despair}/${match.config.despairMax}，帷幕 ${match.clocks.veil}/${match.config.veilConsumeMax}`);
}

function countShards(match) {
  const all = [];
  for (const p of match.players) all.push(...p.shards);
  for (const t of match.tasks) if (t.shard) all.push(t.shard);
  const t = all.filter((s) => s.kind === 'true').length;
  const f = all.filter((s) => s.kind === 'false').length;
  const plant = match.players.filter((p) => p.team === 'corrupted').length;
  return { true: t, false: f, envFalse: f - plant, plant };
}

function phaseName(p) {
  return p === 1 ? '阶段1·入幕' : p === 2 ? '阶段2·诸神残响' : '阶段3·屠宰场';
}
function unlockStr(u) {
  const a = [];
  if (u.veilKeeperArmed) a.push('守幕者短铳');
  if (u.spiritCanBurnVeil) a.push('灵焰烧帷幕');
  return a.length ? a.join(' / ') : '无';
}

// ---------- 2. 种子可复现校验 ----------
function checkReproducibility(seed) {
  const a = snapshot(createMatch(seed));
  const b = snapshot(createMatch(seed));
  const same = JSON.stringify(a) === JSON.stringify(b);
  console.log(`\n${SEP}`);
  console.log(`【可复现性】 同 seed="${seed}" 生成两次：${same ? '✅ 完全一致' : '❌ 不一致'}`);
  console.log(`${SEP}`);
  return same;
}

// ---------- 3. 结构性不变量自检 ----------
function validateMatch(m) {
  const errs = [];
  const cfg = m.config;
  const god = GOD_MAP[m.god];
  const falseBase = cfg.falseFragments * (god.mechanic.falseFragmentMultiplier || 1);
  const trueCount = Math.max(cfg.trueFragments, cfg.playerCount - falseBase + 1);
  const corrupted = m.players.filter((p) => p.team === 'corrupted').length;

  if (m.players.length !== cfg.playerCount) errs.push(`玩家数 ${m.players.length}≠${cfg.playerCount}`);
  if (corrupted !== cfg.corruptedCount) errs.push(`食神者数 ${corrupted}≠${cfg.corruptedCount}`);
  if (!god) errs.push('真神非法');

  // 区域 / 吞噬顺序 / 净化点
  if (m.zones.length !== ZONES.length) errs.push(`区域数 ${m.zones.length}≠${ZONES.length}`);
  if (new Set(m.consumeOrder).size !== ZONES.length) errs.push('吞噬顺序不是全排列');
  if (m.purifyPoint.core !== m.consumeOrder[m.consumeOrder.length - 1]) errs.push('净化点核心区错误');
  if (m.purifyPoint.zone !== m.purifyPoint.core) errs.push('初始净化点不在核心区');
  if (m.phase !== 1 || m.unlocks.veilKeeperArmed || m.unlocks.spiritCanBurnVeil) errs.push('初始阶段/解锁错误');

  const all = [];
  for (const p of m.players) all.push(...p.shards);
  for (const t of m.tasks) if (t.shard) all.push(t.shard);

  const ids = all.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errs.push('碎片 id 重复');
  if (all.some((s) => s.kind !== 'true' && s.kind !== 'false')) errs.push('碎片 kind 非法');
  for (const s of all) {
    if (s.kind === 'true' && s.hintGod !== m.god) errs.push(`真碎片指向了错误的神 ${s.hintGod}`);
    if (s.kind === 'false' && s.hintGod === m.god) errs.push('伪碎片却指向了真神');
  }
  for (const p of m.players) {
    if (!p.contract) errs.push(`${p.id} 无契约`);
    if (p.shards.length < 1) errs.push(`${p.id} 无初始碎片`);
  }

  const trueN = all.filter((s) => s.kind === 'true').length;
  const falseN = all.filter((s) => s.kind === 'false').length;
  if (trueN !== trueCount) errs.push(`真碎片 ${trueN}≠${trueCount}`);
  if (falseN !== falseBase + corrupted) errs.push(`伪碎片 ${falseN}≠${falseBase + corrupted}`);

  const playerHeld = m.players.reduce((sum, p) => sum + p.shards.length, 0);
  const taskHeld = m.tasks.filter((t) => t.shard).length;
  if (playerHeld !== cfg.playerCount + corrupted) errs.push(`玩家持有碎片 ${playerHeld}≠${cfg.playerCount + corrupted}`);
  if (taskHeld !== trueCount + falseBase - cfg.playerCount) errs.push(`任务埋藏碎片 ${taskHeld}≠${trueCount + falseBase - cfg.playerCount}`);

  return errs;
}

function runInvariants(n = 1000) {
  console.log(`\n${SEP}`);
  console.log(`【不变量自检】 跑 ${n} 个 seed，校验结构严密性…`);
  console.log(`${SEP}`);
  let bad = 0;
  const godDist = {};
  for (let i = 0; i < n; i++) {
    const m = createMatch(`seed-${i}`);
    godDist[m.god] = (godDist[m.god] || 0) + 1;
    const errs = validateMatch(m);
    if (errs.length) {
      bad++;
      if (bad <= 5) console.log(`  ❌ seed-${i}: ${errs.join('；')}`);
    }
  }
  console.log(bad === 0 ? '  ✅ 全部通过：1000 局无一违反不变量' : `  ❌ ${bad} 局违反不变量`);
  console.log('  真神分布：' + Object.entries(godDist).map(([k, v]) => `${GOD_MAP[k].name} ${v}`).join(' | '));
  return bad;
}

// ---------- 4. 命运时钟演示 ----------
function demoClocks() {
  console.log(`\n${SEP}`);
  console.log('【命运时钟演示】 阶段跃迁 / 帷幕吞噬 / 阶段门控动作');
  console.log(`${SEP}`);

  // 4a. 阶段跃迁（绝望度驱动，阶段单调递增）
  // 注：taskFail 现受「每任务仅可破坏一次」约束，不再能无限刷绝望，
  //     故演示直接推进绝望度并借 veilTick 触发阶段重推导。
  const m = createMatch('clock-demo');
  console.log(`\n▶ 阶段跃迁（绝望度 → 阶段，只进不退）`);
  console.log(`  初始：${phaseName(m.phase)}｜绝望 ${m.clocks.despair}`);
  m.clocks.despair = 55; applyAction(m, { type: 'veilTick' });
  console.log(`  绝望 55 → ${phaseName(m.phase)}｜解锁 ${unlockStr(m.unlocks)}`);
  m.clocks.despair = 80; applyAction(m, { type: 'veilTick' });
  console.log(`  绝望 80 → ${phaseName(m.phase)}｜解锁 ${unlockStr(m.unlocks)}`);
  // 单调性证明：烧帷幕降低绝望，但阶段不回退
  m.clocks.spirit = 100;
  applyAction(m, { type: 'burnVeil', playerId: m.players.find((p) => p.team === 'spirit' && p.alive).id });
  console.log(`  烧帷幕后：绝望 ${m.clocks.despair}，阶段仍为 ${phaseName(m.phase)}（命运只进不退）`);

  // 4b. 帷幕吞噬（把地图一层层吞掉）
  const m2 = createMatch('veil-demo');
  console.log(`\n▶ 帷幕吞噬（吞噬度 → 吞没区域）`);
  console.log(`  吞噬顺序：${m2.consumeOrder.join(' → ')}`);
  for (let i = 0; i < m2.config.veilConsumeMax; i++) {
    const r = applyAction(m2, { type: 'veilTick' });
    console.log(`  ${r.events[0]}`);
  }
  const left = m2.zones.filter((z) => !z.consumed).map((z) => z.name);
  console.log(`  剩余区域：${left.join(' / ')}（核心区 = 净化点所在）`);

  // 4c. 阶段门控动作（blunderbuss / burnVeil，分开两局避免互相干扰）
  console.log(`\n▶ 阶段门控动作`);
  const g1 = createMatch('gate-blunderbuss');
  const keeper1 = g1.players.find((p) => p.role === '守幕者');
  const corrupt1 = g1.players.find((p) => p.team === 'corrupted' && p.alive);
  const r1 = applyAction(g1, { type: 'blunderbuss', playerId: keeper1.id, targetId: corrupt1.id });
  console.log(`  阶段1 短铳反击：${r1.events[0]}（${r1.ok ? '成功' : '被拒'}）`);
  g1.clocks.despair = 55; applyAction(g1, { type: 'veilTick' });
  const keeper2 = g1.players.find((p) => p.role === '守幕者' && p.alive);
  const corrupt2 = g1.players.find((p) => p.team === 'corrupted' && p.alive);
  const r2 = applyAction(g1, { type: 'blunderbuss', playerId: keeper2.id, targetId: corrupt2.id });
  console.log(`  阶段2 短铳反击：${r2.events[0]}（${r2.ok ? '成功' : '被拒'}）`);

  const g2 = createMatch('gate-burnveil');
  const burner1 = g2.players.find((p) => p.team === 'spirit' && p.alive);
  const rb1 = applyAction(g2, { type: 'burnVeil', playerId: burner1.id });
  console.log(`  阶段1 烧帷幕：${rb1.events[0]}（${rb1.ok ? '成功' : '被拒'}）`);
  g2.clocks.despair = 80; applyAction(g2, { type: 'veilTick' });
  g2.clocks.spirit = 100;
  const burner2 = g2.players.find((p) => p.team === 'spirit' && p.alive);
  const rb2 = applyAction(g2, { type: 'burnVeil', playerId: burner2.id });
  console.log(`  阶段3 烧帷幕：${rb2.events[0]}（${rb2.ok ? '成功' : '被拒'}）`);
}

// ---------- 5. 胜负判定演示 ----------
function demoWin() {
  console.log(`\n${SEP}`);
  console.log('【胜负判定演示】 用动作把状态推进到两种结局');
  console.log(`${SEP}`);

  // 5a. 灵焰方胜利
  const mA = createMatch('win-spirit');
  const godA = GOD_MAP[mA.god];
  console.log(`\n▶ 灵焰方胜利（真神=${godA.name}）`);
  for (const p of mA.players.filter((x) => x.team === 'spirit')) {
    for (const t of mA.tasks.filter((x) => !x.completed)) {
      applyAction(mA, { type: 'task', playerId: p.id, taskId: t.id });
      if (mA.clocks.spirit >= mA.config.spiritMax + (godA.mechanic.extraSpiritCost || 0)) break;
    }
    if (mA.clocks.spirit >= mA.config.spiritMax + (godA.mechanic.extraSpiritCost || 0)) break;
  }
  console.log(`  灵焰已攒至 ${mA.clocks.spirit}`);
  const purifier = mA.players.find((x) => x.team === 'spirit' && x.alive);
  forceSatisfyPurify(mA, purifier.id);
  const res = applyAction(mA, { type: 'purify', playerId: purifier.id });
  console.log(`  ${res.events.join('\n  ')}`);
  console.log(`  终局：${mA.winner === 'spirit' ? '灵焰方胜' : mA.winner} —— ${mA.reason}`);

  // 5b. 食神者方胜利
  const mB = createMatch('win-corrupted');
  const godB = GOD_MAP[mB.god];
  console.log(`\n▶ 食神者方胜利（真神=${godB.name}）`);
  let guard = 0;
  for (const p of mB.players.filter((x) => x.team === 'spirit' && x.alive)) {
    if (mB.winner) break;
    applyAction(mB, { type: 'death', playerId: p.id });
    if (++guard > 20) break;
  }
  console.log(`  绝望已推至 ${mB.clocks.despair}，灵焰方死亡 ${mB.players.filter((p) => p.team === 'spirit' && !p.alive).length} 人`);
  console.log(`  终局：${mB.winner === 'corrupted' ? '食神者方胜' : mB.winner} —— ${mB.reason}`);

  // 5c. 个人契约计分示例
  console.log(`\n▶ 个人契约计分（${mA.winner} 局，只影响排名不影响胜负）`);
  for (const row of computePersonalScores(mA)) {
    console.log(`  ${row.name}（${row.role ?? '食神者'}·${row.contract}）${row.points} 分 ${row.why.length ? '[' + row.why.join(',') + ']' : ''}`);
  }
}

function forceSatisfyPurify(match, playerId) {
  const p = match.players.find((x) => x.id === playerId);
  const god = GOD_MAP[match.god];
  const mech = god.mechanic;
  if (mech.purifyPointHidden) {
    p.shards.push({ id: 'CLUE', kind: 'true', hintGod: match.god, text: god.clueTexts[0], source: 'demo' });
  } else {
    p.zone = match.purifyPoint.zone;
  }
  if (mech.requiredTrueShards) {
    for (let i = 0; i < mech.requiredTrueShards; i++) {
      p.shards.push({ id: `TRUE${i}`, kind: 'true', hintGod: match.god, text: god.clueTexts[i % god.clueTexts.length], source: 'demo' });
    }
  }
  if (mech.requiresBurnFalse) {
    p.shards.push({ id: 'FALSE', kind: 'false', hintGod: 'ash', text: '（演示用伪碎片）', source: 'demo' });
    applyAction(match, { type: 'burnFalse', playerId: p.id });
  }
  if (mech.purifyNeedsTwo) {
    const other = match.players.find((x) => x.id !== p.id && x.alive && x.team === 'spirit');
    if (other) other.zone = match.purifyPoint.zone;
  }
  if (mech.purifyNeedsEbb) match.ebbWindow = true;
}

// ---------- 6. 回放复现校验 ----------
function demoReplay() {
  console.log(`\n${SEP}`);
  console.log('【回放复现】 同 seed 重放动作序列 → 状态逐字段一致');
  console.log(`${SEP}`);
  const seed = 'replay-demo';
  const actions = [
    { type: 'task', playerId: 'P1', taskId: 'T1' },
    { type: 'task', playerId: 'P2', taskId: 'T2' },
    { type: 'veilTick' },
    { type: 'sacrifice', victimId: 'P4', executorId: 'P1' },
    { type: 'veilTick' },
    { type: 'death', playerId: 'P5' },
  ];

  const live = createMatch(seed);
  for (const a of actions) applyAction(live, a);
  const snapLive = snapshot(live);

  const { match: replayed, transcript } = replayMatch(seed, actions);
  const snapReplay = snapshot(replayed);
  const same = JSON.stringify(snapLive) === JSON.stringify(snapReplay);
  console.log(`  实况 vs 回放：${same ? '✅ 逐字段一致（含遗忘之神的随机丢碎片）' : '❌ 不一致'}`);
  console.log(`  回放共 ${transcript.length} 步，${transcript.filter((t) => t.ok).length} 步成功，终局=${replayed.winner ?? '未结束'}`);
  return same;
}

// ---------- main ----------
function main() {
  const seed = process.argv[2] || 'veilland-demo-001';
  console.log(`真相盘引擎自检  ·  seed="${seed}"`);
  console.log(`真神池：${GODS.map((g) => g.name).join(' / ')}`);
  console.log(`契约池：${CONTRACTS.map((c) => c.name).join(' / ')}`);
  console.log(`区域：${ZONES.join(' / ')}`);

  const match = createMatch(seed);
  printMatch(match);
  const okRepro = checkReproducibility(seed);
  const badInvariants = runInvariants(1000);
  demoClocks();
  demoWin();
  const okReplay = demoReplay();

  console.log(`\n${SEP}`);
  const all = okRepro && badInvariants === 0 && okReplay;
  console.log(`总结：可复现=${okRepro ? '通过' : '失败'}，不变量 ${badInvariants === 0 ? '1000/1000 通过' : badInvariants + ' 失败'}，回放=${okReplay ? '通过' : '失败'}`);
  console.log(all ? '✅ 全部自检通过' : '❌ 存在未通过项');
  console.log(`${SEP}`);
}

main();
