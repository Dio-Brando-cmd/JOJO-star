// ============================================================
// 真相盘引擎 —— 自生成叙事任务系统的核心（纯逻辑、无 UI、种子可复现）
//
// 职责：
//   1. createMatch(seed, opts)    由一个种子生成完整一局：
//      真神 / 玩家阵营 / 真伪碎片 / 任务 / 区域吞噬顺序 / 净化点 / 契约 / 时钟。
//   2. applyAction(match, action) 执行动作，推进状态、阶段与时钟，返回事件。
//   3. checkWin(match)            公开胜利条件判定（可裁判）。
//   4. computePersonalScores(match) 个人契约计分（不影响胜负，防乱玩）。
//   5. replayMatch(seed, actions) 回放：同 seed 重放动作序列，逐帧复现。
//
// 三层系统：
//   真相盘（真神池/碎片真伪/契约）＝ 谜底
//   命运时钟（绝望度/帷幕吞噬度/灵焰值 + 阶段跃迁）＝ 节奏
//   契约目标（个人计分）＝ 角色
//
// 关键设计：
//   - 胜负框架稳定（灵焰净化 vs 绝望满值/献祭数），真神只改变「怎么达成」。
//   - 阶段单调递增（命运只进不退），由绝望度驱动，解锁守幕者短铳/灵焰烧帷幕。
//   - 帷幕吞噬把地图一层层吞掉，最后只剩核心区，逼出终局遭遇。
// ============================================================

import { createRng } from './rng.js';
import {
  GODS, GOD_MAP, CONTRACTS,
  DEFAULT_CONFIG, TASK_NAMES, SPIRIT_SUBROLES,
  CORRUPTED_ROLE, TEAM_CORRUPTED, TEAM_SPIRIT, ZONES,
} from './truth-data.js';

// ============================================================
// 生成阶段
// ============================================================

/**
 * 由一个种子生成完整一局。
 * @param {string|number} seed 任意种子
 * @param {object} [opts] 覆盖 DEFAULT_CONFIG 的字段，可选 godPool: string[]
 * @returns 完整对局对象（含 rng，用于动作阶段的确定性随机）
 */
export function createMatch(seed, opts = {}) {
  const config = { ...DEFAULT_CONFIG, ...opts };
  const rng = createRng(seed);
  const sid = makeIdGen('S'); // 碎片 id 生成器（顺序固定 → 确定性）

  // 1. 摇真神
  const godPool = opts.godPool ? GODS.filter((g) => opts.godPool.includes(g.id)) : GODS;
  const god = rng.pick(godPool);

  // 2. 生成碎片池
  const falseBase = config.falseFragments * (god.mechanic.falseFragmentMultiplier || 1);
  const n = config.playerCount;
  const trueCount = Math.max(config.trueFragments, n - falseBase + 1); // 保证每人拿 1 张且至少留 1 张进任务
  const trueFrags = makeTrueFragments(god, trueCount, rng, sid);
  const envFalseFrags = makeFalseFragments(god, falseBase, rng, sid, 'world');
  const envShards = rng.shuffle([...trueFrags, ...envFalseFrags]);

  // 3. 玩家
  const players = makePlayers(config, rng);

  // 4. 初始分发：每人 1 张环境碎片
  for (const p of players) {
    if (envShards.length) p.shards.push(envShards.pop());
  }
  // 食神者额外各持 1 张「植入」伪碎片（用于误导）
  const corruptedPlayers = players.filter((p) => p.team === TEAM_CORRUPTED);
  const plantFrags = makeFalseFragments(god, corruptedPlayers.length, rng, sid, 'plant');
  corruptedPlayers.forEach((p, i) => p.shards.push(plantFrags[i]));

  // 5. 剩余碎片埋入任务
  const tasks = makeTasks(config, envShards, rng); // envShards 里剩下即埋入任务

  // 6. 区域与吞噬顺序（帷幕吞噬度会把地图一层层吞掉，最后只剩核心区）
  const consumeOrder = rng.shuffle(ZONES);
  const zones = ZONES.map((name) => ({ name, consumed: false }));

  // 7. 净化点（默认在最深处·核心区 = 最后被吞噬的区域）
  const purifyPoint = makePurifyPoint(god, consumeOrder);

  // 8. 契约
  assignContracts(players, god, config, rng);

  // 9. 时钟
  const clocks = { spirit: 0, despair: 0, veil: 0 };

  return {
    seed: rng.seed,
    seedRaw: String(seed),
    god: god.id,
    config,
    players,
    tasks,
    zones,
    consumeOrder,
    purifyPoint,
    clocks,
    phase: 1,
    unlocks: deriveUnlocks(1),
    ebbWindow: false, // 潮汐之神：退潮窗口
    winner: null,
    reason: null,
    purifiedBy: null,
    log: [],       // 事件流水
    actions: [],   // 动作回放序列
    rng,           // 动作阶段的确定性随机源（不参与 snapshot）
  };
}

function makeIdGen(prefix) {
  let i = 0;
  return () => `${prefix}${(++i).toString().padStart(2, '0')}`;
}

function makeTrueFragments(god, count, rng, sid) {
  const texts = rng.shuffle(god.clueTexts);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: sid(), kind: 'true', hintGod: god.id, text: texts[i % texts.length], source: 'world' });
  }
  return out;
}

function makeFalseFragments(god, count, rng, sid, source) {
  const others = GODS.filter((g) => g.id !== god.id);
  const out = [];
  for (let i = 0; i < count; i++) {
    const other = rng.pick(others);
    out.push({ id: sid(), kind: 'false', hintGod: other.id, text: rng.pick(other.clueTexts), source });
  }
  return out;
}

function makePlayers(config, rng) {
  const n = config.playerCount;
  const teams = [];
  for (let i = 0; i < config.corruptedCount; i++) teams.push(TEAM_CORRUPTED);
  for (let i = config.corruptedCount; i < n; i++) teams.push(TEAM_SPIRIT);
  const shuffledTeams = rng.shuffle(teams);

  const players = shuffledTeams.map((team, i) => ({
    id: `P${i + 1}`,
    name: `玩家${i + 1}`,
    team,
    role: team === TEAM_CORRUPTED ? CORRUPTED_ROLE : null,
    alive: true,
    zone: null,
    shards: [],
    contract: null,
    guardTargetId: null,      // 守护者契约
    reincarnationOf: null,    // 逆命者契约
    guessedGodId: null,       // 真知者契约
    revealed: false,
    burnedFalse: false,
    blunderbussUsed: false,   // 守幕者短铳：每局一次
    sacrificeCount: 0,
    purifier: false,
  }));

  // 给灵焰方分配子角色（守幕者稀缺）
  const spiritPlayers = players.filter((p) => p.team === TEAM_SPIRIT);
  const roles = rng.shuffle(distributeSubroles(spiritPlayers.length));
  spiritPlayers.forEach((p, i) => { p.role = roles[i]; });
  return players;
}

function distributeSubroles(spiritCount) {
  const roles = [];
  if (spiritCount >= 3) roles.push('守幕者');
  let flip = true;
  while (roles.length < spiritCount) {
    roles.push(flip ? '灵焰' : '生存');
    flip = !flip;
  }
  return roles;
}

function makeTasks(config, leftoverShards, rng) {
  const names = rng.shuffle(TASK_NAMES);
  const count = Math.min(config.taskCount, names.length);
  const tasks = names.slice(0, count).map((name, i) => ({
    id: `T${i + 1}`, name, shard: null, completed: false, completedBy: null, sabotaged: false,
  }));
  leftoverShards.forEach((s, i) => {
    if (i < tasks.length) tasks[i].shard = s;
  });
  return tasks;
}

function makePurifyPoint(god, consumeOrder) {
  const core = consumeOrder[consumeOrder.length - 1]; // 核心区 = 最后被吞噬
  return {
    zone: core,
    core,
    hidden: !!god.mechanic.purifyPointHidden,
    wandering: !!god.mechanic.purifyPointWanders,
    semiRandom: !!god.mechanic.purifyZoneSemiRandom,
  };
}

function assignContracts(players, god, config, rng) {
  const pool = rng.shuffle(CONTRACTS.slice());
  players.forEach((p, i) => { p.contract = pool[i % pool.length]; });
  for (const p of players) {
    if (p.contract.id === 'guardian') {
      const others = players.filter((x) => x.id !== p.id);
      p.guardTargetId = rng.pick(others).id;
    }
    if (p.contract.id === 'fatebreaker') {
      p.reincarnationOf = rng.pick(GODS).id;
    }
  }
}

// ============================================================
// 动作阶段（纯逻辑，所有随机都走 match.rng，保证可复现）
// ============================================================

/**
 * 执行一个动作，推进状态，返回事件与（可能的）胜负。
 * action 类型：task / taskFail / sacrifice / death / veilTick / guess / burnFalse / move / reveal / blunderbuss / burnVeil / purify
 */
export function applyAction(match, action) {
  match.actions.push(action);
  const events = [];
  const { clocks, config } = match;
  const god = GOD_MAP[match.god];
  const mech = god.mechanic;
  const resMult = mech.resourceMultiplier || 1;

  switch (action.type) {
    case 'task': {
      const t = match.tasks.find((x) => x.id === action.taskId);
      const p = match.players.find((x) => x.id === action.playerId);
      if (!t || t.completed) return { ok: false, events: ['任务不存在或已完成'] };
      if (!p || !p.alive) return { ok: false, events: ['玩家不存在或已死亡'] };
      if (p.team !== TEAM_SPIRIT) return { ok: false, events: ['只有灵焰方能完成任务'] };
      t.completed = true;
      t.completedBy = p.id;
      const gain = Math.round(config.taskSpirit * resMult);
      clocks.spirit += gain;
      events.push(`${p.name} 完成【${t.name}】，灵焰 +${gain}`);
      if (t.shard) {
        p.shards.push(t.shard);
        // 只广播「获得碎片」这一事实；碎片的真伪与线索文本属私密信息，
        // 由 TruthGame.getPrivateState 单独下发给持有者，避免公开日志泄题。
        events.push(`　↳ ${p.name} 获得了一张记忆碎片`);
        t.shard = null;
      }
      return after(match, events);
    }

    case 'taskFail': {
      const p = match.players.find((x) => x.id === action.playerId);
      if (!p || !p.alive) return { ok: false, events: ['玩家不存在或已死亡'] };
      if (p.team !== TEAM_CORRUPTED) return { ok: false, events: ['只有食神者能破坏任务'] };
      const t = match.tasks.find((x) => x.id === action.taskId);
      if (!t || t.completed || t.sabotaged) return { ok: false, events: ['任务不存在、已完成或已被破坏'] };
      t.sabotaged = true;
      const dg = config.taskFailDespair;
      clocks.despair += dg;
      events.push(`一处灵焰任务被破坏，绝望 +${dg}`);
      return after(match, events);
    }

    case 'sacrifice': {
      const victim = match.players.find((x) => x.id === action.victimId);
      const exec = action.executorId ? match.players.find((x) => x.id === action.executorId) : null;
      if (!victim || !victim.alive) return { ok: false, events: ['目标不存在或已死亡'] };
      if (exec && exec.id === victim.id) return { ok: false, events: ['不能献祭自己'] };
      victim.alive = false;
      if (exec) exec.sacrificeCount += 1;
      const dg = mech.sacrificeRaisesDespair === false ? 0 : config.sacrificeDespair;
      clocks.despair += dg;
      events.push(`${victim.name} 被献祭给帷幕${mech.sacrificeRaisesDespair === false ? '（献祭不涨绝望）' : `，绝望 +${dg}`}`);
      // 默认：献祭验人 —— 死者阵营公开（社交推理的核心反馈）。
      // 灰烬之神（deathInfoHidden）例外：死者身份不公开，献祭不区分对错、不结算灵焰。
      if (!mech.deathInfoHidden) {
        if (victim.team === TEAM_CORRUPTED) {
          const g = Math.round(config.correctSacrificeSpirit * resMult);
          clocks.spirit += g;
          events.push(`　↳ 献祭了食神者，灵焰 +${g}`);
        } else {
          clocks.spirit = Math.max(0, clocks.spirit - config.wrongSacrificeSpiritPenalty);
          events.push(`　↳ 误献祭灵焰方，灵焰 -${config.wrongSacrificeSpiritPenalty}`);
        }
      }
      applyDeathSideEffects(match, victim, events, mech);
      return after(match, events);
    }

    case 'death': {
      const victim = match.players.find((x) => x.id === action.playerId);
      if (!victim || !victim.alive) return { ok: false, events: ['目标不存在或已死亡'] };
      victim.alive = false;
      const dg = Math.round(config.deathDespair * (mech.deathDespairMultiplier || 1));
      clocks.despair += dg;
      events.push(`${victim.name} 死亡，绝望 +${dg}`);
      applyDeathSideEffects(match, victim, events, mech);
      return after(match, events);
    }

    case 'blunderbuss': {
      const p = match.players.find((x) => x.id === action.playerId);
      const target = match.players.find((x) => x.id === action.targetId);
      if (!p || p.role !== '守幕者') return { ok: false, events: ['只有守幕者能使用短铳'] };
      if (match.phase < 2) return { ok: false, events: ['短铳尚未解锁（阶段2·诸神残响解锁）'] };
      if (p.blunderbussUsed) return { ok: false, events: ['短铳已用（每局一次）'] };
      if (!target || !target.alive) return { ok: false, events: ['目标不存在或已死亡'] };
      if (target.id === p.id) return { ok: false, events: ['不能瞄准自己'] };
      target.alive = false;
      p.blunderbussUsed = true;
      const dg = Math.round(config.deathDespair * (mech.deathDespairMultiplier || 1));
      clocks.despair += dg;
      events.push(`🔫 ${p.name} 短铳击毙了 ${target.name}，绝望 +${dg}`);
      applyDeathSideEffects(match, target, events, mech);
      return after(match, events);
    }

    case 'burnVeil': {
      const p = match.players.find((x) => x.id === action.playerId);
      if (!p || p.team !== TEAM_SPIRIT || !p.alive) return { ok: false, events: ['只有存活的灵焰方能烧帷幕'] };
      if (match.phase < 3) return { ok: false, events: ['灵焰尚无法烧穿帷幕（阶段3·屠宰场解锁）'] };
      if (clocks.spirit < config.burnVeilSpiritCost) return { ok: false, events: [`灵焰不足（需 ${config.burnVeilSpiritCost}）`] };
      clocks.spirit -= config.burnVeilSpiritCost;
      const before = clocks.despair;
      clocks.despair = Math.max(0, clocks.despair - config.burnVeilDespairReduction);
      const reduced = before - clocks.despair;
      events.push(`🔥 ${p.name} 烧穿一段帷幕，灵焰 -${config.burnVeilSpiritCost}，绝望 -${reduced}`);
      return after(match, events);
    }

    case 'veilTick': {
      clocks.veil += 1;
      const zone = consumeNextZone(match);
      events.push(`帷幕吞噬 +1（${clocks.veil}/${config.veilConsumeMax}）${zone ? `，吞没了【${zone.name}】` : ''}`);
      if (clocks.veil >= config.veilConsumeMax) {
        events.push('　↳ 屠宰场只剩核心区，终局将至');
      }
      if (mech.purifyNeedsEbb) {
        match.ebbWindow = clocks.veil % 2 === 1;
        // 中性措辞：不点名潮汐之神（真神须靠碎片推断）
        events.push(match.ebbWindow ? '　↳ 帷幕的气息退去，净化窗口开启' : '　↳ 帷幕的气息涌来，净化窗口关闭');
      }
      if (mech.purifyPointWanders) {
        const open = match.zones.filter((z) => !z.consumed);
        match.purifyPoint.zone = match.rng.pick(open).name;
        // 净化点新位置由公开状态 zone 字段体现，这里不写「游走」事件以免点名战争之神
      }
      return after(match, events);
    }

    case 'guess': {
      const p = match.players.find((x) => x.id === action.playerId);
      p.guessedGodId = action.godId;
      // 猜测结果不公开：真知者契约在终局结算时才判定对错，
      // 否则「有人猜对」会当场把真神广播给所有人，泄题。
      events.push(`${p.name} 公开猜测真神为「${GOD_MAP[action.godId].name}」`);
      return after(match, events);
    }

    case 'burnFalse': {
      const p = match.players.find((x) => x.id === action.playerId);
      const idx = p.shards.findIndex((s) => s.kind === 'false');
      if (idx === -1) return { ok: false, events: [`${p.name} 没有伪碎片可焚烧`] };
      p.shards.splice(idx, 1);
      p.burnedFalse = true;
      events.push(`${p.name} 焚烧了一张伪碎片`);
      return after(match, events);
    }

    case 'move': {
      const p = match.players.find((x) => x.id === action.playerId);
      const z = match.zones.find((x) => x.name === action.zone);
      if (z && z.consumed) return { ok: false, events: [`【${action.zone}】已被帷幕吞噬，无法进入`] };
      p.zone = action.zone;
      events.push(`${p.name} 移动到【${action.zone}】`);
      return after(match, events);
    }

    case 'reveal': {
      const p = match.players.find((x) => x.id === action.playerId);
      p.revealed = true;
      const name = p.reincarnationOf ? GOD_MAP[p.reincarnationOf].name : '无';
      events.push(`${p.name} 揭露了自己的转世真名「${name}」`);
      return after(match, events);
    }

    case 'purify': {
      const p = match.players.find((x) => x.id === action.playerId);
      if (!p || p.team !== TEAM_SPIRIT || !p.alive) return { ok: false, events: ['只有存活的灵焰方能执行净化'] };
      const goal = config.spiritMax + (mech.extraSpiritCost || 0);

      // 所有失败统一用不泄题的措辞：不暴露 goal（丰收之神 120）、不暴露 own 计数（遗忘之神测谎机）、
      // 不暴露具体条件（否则一次失败即可反推真神机制）。
      if (clocks.spirit < goal) return { ok: false, events: ['净化失败：灵焰尚未攒满'] };

      if (mech.requiredTrueShards) {
        const own = p.shards.filter((s) => s.kind === 'true' && s.hintGod === match.god).length;
        if (own < mech.requiredTrueShards) return { ok: false, events: ['净化失败：仪式条件未满足'] };
      }
      if (mech.requiresBurnFalse && !p.burnedFalse) return { ok: false, events: ['净化失败：仪式条件未满足'] };
      if (mech.purifyNeedsTwo) {
        const present = match.players.filter((x) => x.id !== p.id && x.alive && x.team === TEAM_SPIRIT && x.zone === match.purifyPoint.zone).length;
        if (present < 1) return { ok: false, events: ['净化失败：仪式条件未满足'] };
      }
      if (mech.purifyNeedsEbb && !match.ebbWindow) return { ok: false, events: ['净化失败：仪式条件未满足'] };

      if (mech.purifyPointHidden) {
        const hasClue = p.shards.some((s) => s.kind === 'true' && s.hintGod === match.god);
        if (!hasClue) return { ok: false, events: ['净化失败：仪式条件未满足'] };
      } else if (p.zone !== match.purifyPoint.zone) {
        return { ok: false, events: ['净化失败：地点不符'] };
      }

      match.winner = TEAM_SPIRIT;
      match.reason = '净化仪式完成';
      match.purifiedBy = p.id;
      p.purifier = true;
      events.push(`🔥 ${p.name} 完成净化仪式，灵焰方胜利！`);
      return after(match, events);
    }

    default:
      return { ok: false, events: ['未知动作'] };
  }
}

function consumeNextZone(match) {
  for (const name of match.consumeOrder) {
    const z = match.zones.find((x) => x.name === name);
    if (z && !z.consumed) {
      z.consumed = true;
      return z;
    }
  }
  return null;
}

function applyDeathSideEffects(match, victim, events, mech) {
  const { clocks, config } = match;
  // 死亡通用损耗
  clocks.spirit = Math.max(0, clocks.spirit - config.deathSpiritLoss);
  events.push(`　↳ 灵焰 -${config.deathSpiritLoss}（死亡损耗）`);

  // 遗忘之神：每有 1 人死亡，全体存活者随机丢 1 张碎片（措辞不点名真神）
  if (mech.loseShardOnDeath) {
    const survivors = match.players.filter((p) => p.alive && p.shards.length);
    for (const p of survivors) {
      const idx = match.rng.int(0, p.shards.length - 1);
      p.shards.splice(idx, 1);
      events.push(`　↳ 帷幕的气息掠过，${p.name} 丢失了一张记忆碎片`);
    }
  }
  // 灰烬之神：死者信息被掩盖（措辞不点名真神）
  if (mech.deathInfoHidden) {
    events.push('　↳ 死者的身份与死因被掩盖，不公开');
  }
}

function after(match, events) {
  // 阶段单调递增：命运只进不退
  const nextPhase = derivePhase(match);
  if (nextPhase > match.phase) {
    match.phase = nextPhase;
    events.push(phaseAnnouncement(nextPhase));
  }
  match.unlocks = deriveUnlocks(match.phase);

  const winner = checkWin(match);
  if (winner && !events.some((e) => e.includes('胜利'))) {
    events.push(`☠️ ${winner === TEAM_CORRUPTED ? '食神者' : '灵焰'}方胜利 —— ${match.reason}`);
  }
  match.log.push(...events);
  return { ok: true, events, winner, reason: match.reason, phase: match.phase };
}

function derivePhase(match) {
  const d = match.clocks.despair;
  if (d >= match.config.phase3Despair) return 3;
  if (d >= match.config.phase2Despair) return 2;
  return 1;
}

function deriveUnlocks(phase) {
  return {
    veilKeeperArmed: phase >= 2,   // 守幕者短铳
    spiritCanBurnVeil: phase >= 3, // 灵焰烧帷幕
  };
}

function phaseAnnouncement(phase) {
  if (phase === 2) return '【阶段2·诸神残响】守幕者解锁短铳（blunderbuss）';
  if (phase === 3) return '【阶段3·屠宰场】灵焰可烧穿帷幕（burnVeil）';
  return '【阶段1·入幕】';
}

// ============================================================
// 胜负判定（公开、可裁判）
// ============================================================

export function checkWin(match) {
  if (match.winner) return match.winner;
  const { config } = match;
  const spiritDeaths = match.players.filter((p) => p.team === TEAM_SPIRIT && !p.alive).length;
  if (match.clocks.despair >= config.despairMax) {
    match.winner = TEAM_CORRUPTED;
    match.reason = '绝望满值（屠宰场进食完成）';
  } else if (spiritDeaths >= config.requiredSacrificesForCorruptedWin) {
    match.winner = TEAM_CORRUPTED;
    match.reason = `灵焰方死亡 ${spiritDeaths} 人（≥${config.requiredSacrificesForCorruptedWin}）`;
  }
  return match.winner;
}

// ============================================================
// 个人契约计分（只影响排名，不影响胜负）
// ============================================================

export function computePersonalScores(match) {
  return match.players
    .map((p) => {
      let pts = 0;
      const why = [];
      switch (p.contract.id) {
        case 'survivor':
          if (p.alive) { pts += p.contract.points; why.push('存活到终局'); }
          break;
        case 'purifier':
          if (match.purifiedBy === p.id) { pts += p.contract.points; why.push('亲手净化'); }
          break;
        case 'oracle':
          if (p.guessedGodId === match.god) { pts += p.contract.points; why.push('猜对真神'); }
          break;
        case 'guardian': {
          const t = match.players.find((x) => x.id === p.guardTargetId);
          if (t && t.alive) { pts += p.contract.points; why.push(`守护目标 ${t.name} 存活`); }
          break;
        }
        case 'sacrificer':
          if (p.sacrificeCount >= 1) { pts += p.contract.points; why.push('亲手献祭'); }
          break;
        case 'fatebreaker':
          if (p.reincarnationOf === match.god && p.alive) { pts += p.contract.points; why.push('逆命成功'); }
          break;
      }
      return { playerId: p.id, name: p.name, team: p.team, role: p.role, contract: p.contract.name, points: pts, why };
    })
    .sort((a, b) => b.points - a.points);
}

// ============================================================
// 回放（同 seed 重放动作序列，逐帧复现）
// ============================================================

export function replayMatch(seed, actions) {
  const match = createMatch(seed);
  const transcript = [];
  for (const a of actions) {
    const r = applyAction(match, a);
    transcript.push({ action: a, ok: r.ok, events: r.events, winner: r.winner });
    if (r.winner) break;
  }
  return { match, transcript };
}

// ============================================================
// 快照（用于回放校验 / 复现比对，排除 rng 函数与 log/actions）
// ============================================================

export function snapshot(match) {
  return JSON.parse(JSON.stringify({
    seed: match.seedRaw,
    god: match.god,
    clocks: match.clocks,
    phase: match.phase,
    unlocks: match.unlocks,
    zones: match.zones,
    consumeOrder: match.consumeOrder,
    purifyPoint: match.purifyPoint,
    players: match.players.map((p) => ({
      id: p.id, team: p.team, role: p.role, alive: p.alive, zone: p.zone,
      shards: p.shards, contract: p.contract?.id ?? null,
      guardTargetId: p.guardTargetId, reincarnationOf: p.reincarnationOf,
      guessedGodId: p.guessedGodId, burnedFalse: p.burnedFalse, blunderbussUsed: p.blunderbussUsed,
    })),
    tasks: match.tasks.map((t) => ({ id: t.id, name: t.name, shard: t.shard, completed: t.completed, sabotaged: t.sabotaged })),
    config: match.config,
  }));
}
