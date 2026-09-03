// ============================================================
// 夜晚行动结算器 —— 按固定顺序处理所有夜间行动
// ============================================================

import { ROLES, NIGHT_STEPS, SPIRIT_WEAVER_TYPES, TRAIT_TYPES } from './constants.js';

export class NightResolver {
  constructor(game) {
    this.game = game;
    this.players = game.players;
    this.log = [];           // 夜晚日志（公开）
    this.privateLog = [];    // 夜晚日志（仅相关角色可见）
    this.corruptedKills = new Map(); // 蚀者噬灵目标 Map<targetId, corruptedIds[]>
  }

  // ---- 主入口：结算整晚 ----
  async resolve() {
    this.log = [];
    this.privateLog = [];

    const steps = this.game.getNightSteps();

    for (const step of steps) {
      if (step === NIGHT_STEPS.RESOLUTION) {
        this.resolveAllDeaths();
        break;
      }
      await this.processStep(step);
    }

    // 收集屋子访客信息（给出门的玩家）
    this.collectHouseVisitInfo();

    // 检查胜利条件
    this.game.checkWinCondition();

    return { log: this.log, privateLog: this.privateLog };
  }

  // 为每个出门的玩家记录目标屋子的访客数量
  collectHouseVisitInfo() {
    for (const p of this.players) {
      if (!p.alive || p.nightAction === 'SLEEP') continue;
      // 通过 currentHouse 判断是否出门（冥僧人的 nightAction 可能已被重置）
      const leftHome = p.nightAction === 'GO_OUT' || (!p.atHome && p.currentHouse !== p.id);
      if (leftHome && p.currentHouse && p.currentHouse !== p.id) {
        const targetHouse = p.currentHouse;
        const visitors = this.players.filter(v => {
          if (!v.alive || v.id === targetHouse) return false;
          return (v.currentHouse || v.id) === targetHouse;
        });
        const count = visitors.length;

        // 灵织者因人数过多被赶回家时只显示"很多人"
        let countDisplay;
        if (p.role === 'SPIRIT_WEAVER' && count >= 3) {
          countDisplay = -1; // 代表"很多人"
          this.privateLog.push({
            type: 'house_visit',
            player: p.id,
            target: targetHouse,
            count: countDisplay,
            desc: '屋子里有很多人（≥3人），你被赶回了自己家',
          });
          // 灵织者被赶回家
          p.currentHouse = p.id;
          p.atHome = true;
        } else {
          countDisplay = count;
          this.privateLog.push({
            type: 'house_visit',
            player: p.id,
            target: targetHouse,
            count: countDisplay,
            desc: `屋子里有 ${count} 人（不含屋主）`,
          });
        }
      }
    }
  }

  // ---- 按步骤分发 ----
  async processStep(step) {
    const handlers = {
      [NIGHT_STEPS.FLAME_TRACKER]: () => this.resolveFlameTracker(),
      [NIGHT_STEPS.NETHER_MONK]: () => this.resolveNetherMonk(),
      [NIGHT_STEPS.VEIL_GUARDIAN]: () => this.resolveVeilGuardian(),
      [NIGHT_STEPS.CORRUPTED]: () => this.resolveCorrupted(),
      [NIGHT_STEPS.VEIL_SCHOLAR]: () => this.resolveVeilScholar(),
      [NIGHT_STEPS.HERBAL_SAGE]: () => this.resolveHerbalSage(),
      [NIGHT_STEPS.SPIRIT_MENDER]: () => this.resolveSpiritMender(),
      [NIGHT_STEPS.SPIRIT_WEAVER]: () => this.resolveWeaver(),
    };

    const handler = handlers[step];
    if (handler) await handler();
  }

  // ==========================================
  //  1. 灵痕追猎者（第二晚起第一个行动）
  // ==========================================
  resolveFlameTracker() {
    const flameTracker = this.players.find(p => p.role === ROLES.FLAME_TRACKER && p.alive);
    if (!flameTracker || !flameTracker.nightAction) return;

    if (flameTracker.nightAction === 'SLEEP') return;

    // 灵痕追猎者观察目标
    if (flameTracker.observedTarget && flameTracker.nightAction === 'USE_ABILITY') {
      const target = this.players.find(p => p.id === flameTracker.observedTarget);
      if (target && target.alive) {
        flameTracker.observedTargetWentOut = target.nightAction === 'GO_OUT';
        this.privateLog.push({
          type: 'flame_tracker_observe',
          player: flameTracker.id,
          target: target.id,
          wentOut: flameTracker.observedTargetWentOut,
        });
      }
    }

    // 灵痕追猎者使用猎枪射杀（先开枪后腐蚀，确保同一晚可开枪）
    if (flameTracker.nightAbility?.useRifle && flameTracker.rifleUsable) {
      const targetId = flameTracker.nightAbility.rifleTarget;
      if (targetId) {
        this.markForDeath(targetId, 'flame_tracker_rifle');
        this.log.push({ type: 'flame_tracker_shoot', target: targetId, msg: '追猎者射击了！' });
        flameTracker.rifleUsable = false; // 开枪消耗猎枪
        flameTracker.canShootNextNight = null;
      }
    }

    // 猎枪追猎：上一晚观察到的出门目标
    if (flameTracker.canShootNextNight && flameTracker.rifleUsable) {
      this.markForDeath(flameTracker.canShootNextNight, 'flame_tracker_rifle');
      this.log.push({ type: 'flame_tracker_shoot', target: flameTracker.canShootNextNight, msg: '灵痕追猎者追踪射杀！' });
      flameTracker.rifleUsable = false; // 开枪消耗猎枪
      flameTracker.canShootNextNight = null;
    }

    // 设置下一晚可追踪的目标
    if (flameTracker.observedTargetWentOut && flameTracker.observedTarget && !flameTracker.nightAbility?.useRifle) {
      flameTracker.canShootNextNight = flameTracker.observedTarget;
    }

    // 新增：灵痕追猎者陷阱射击
    if (flameTracker.nightAbility?.useTrap && flameTracker.nightTarget) {
      flameTracker.trapTarget = flameTracker.nightTarget;
      this.privateLog.push({
        type: 'flame_tracker_trap',
        player: flameTracker.id,
        target: flameTracker.nightTarget,
        msg: '灵痕追猎者在目标屋子设下了陷阱',
      });
    }

    // 新增：灵痕追猎者复仇标记（投票出局时触发，在此处记录）
    if (flameTracker.nightAbility?.markRevenge && flameTracker.nightTarget) {
      flameTracker.revengeTarget = flameTracker.nightTarget;
      this.privateLog.push({
        type: 'flame_tracker_revenge_mark',
        player: flameTracker.id,
        target: flameTracker.nightTarget,
        msg: '灵痕追猎者标记了复仇目标',
      });
    }

    // 处理武器腐蚀：带出门才会被腐蚀（在开枪之后判定，确保同一晚出门+开枪不会冲突）
    if (flameTracker.blunderbussUsable && flameTracker.nightAction === 'GO_OUT') {
      flameTracker.blunderbussUsable = false;
      this.privateLog.push({ type: 'blunderbuss_corroded', player: flameTracker.id, msg: '短火铳带出门，已腐蚀' });
    }
    if (flameTracker.rifleUsable && flameTracker.nightAction === 'GO_OUT') {
      flameTracker.rifleUsable = false;
      this.privateLog.push({ type: 'rifle_corroded', player: flameTracker.id, msg: '猎枪带出门，已腐蚀' });
    }
  }

  // ==========================================
  //  2. 冥僧人
  // ==========================================
  resolveNetherMonk() {
    const netherMonk = this.players.find(p => p.role === ROLES.NETHER_MONK && p.alive);
    if (!netherMonk || netherMonk.nightAction === 'SLEEP') return;

    const ability = netherMonk.nightAbility || {};

    // 蚀变
    if (ability.transform && !netherMonk.isTransformed) {
      netherMonk.isTransformed = true;
      this.privateLog.push({ type: 'nether_monk_transform', player: netherMonk.id, msg: '冥僧人完成了蚀变' });
    }

    // 堕化
    if (ability.corrupt && !netherMonk.hasUsedCorrupt && !netherMonk.hasKilled) {
      const targetId = netherMonk.nightTarget;
      const target = this.players.find(p => p.id === targetId && p.alive);
      if (target) {
        // 堕化察灵家的特殊处理：察灵家被堕化但不变成蚀者，冥僧人保持蚀者阵营
        if (target.role === ROLES.VEIL_SCHOLAR) {
          target.corruptedByNetherMonk = true;
          target.willBecomeCorrupted = false; // 察灵家保留能力，不蚀变
          // 冥僧人仍属于蚀者阵营，身份不变，行动次序不变
          this.privateLog.push({ type: 'veil_scholar_corrupted', player: target.id, netherMonkId: netherMonk.id, msg: '察灵家被冥僧人堕化，但保留察灵能力' });
        } else {
          target.corruptedByNetherMonk = true;
          target.willBecomeCorrupted = true;
          this.privateLog.push({ type: 'corrupted', player: target.id, msg: '被冥僧人堕化，下个夜晚蚀变为蚀者' });
        }
        netherMonk.hasUsedCorrupt = true;
        // 使用了堕化后，当前夜晚冥僧人算作蚀者（可被察灵家查出）
        this.privateLog.push({ type: 'nether_monk_corrupted_visible', player: netherMonk.id });
      }
    }

    // 注意：蚀变后的刀人在 resolveCorrupted 中统一处理（已蚀变冥僧人算作蚀者群）
    // 此处只设置标记，不重复写击杀逻辑

    // 新增：假身份编织（蚀变前可伪装成守幕者）
    if (ability.fakeIdentity && !netherMonk.isTransformed && !netherMonk.hasUsedCorrupt) {
      const fakeRole = ability.fakeIdentityRole;
      if (fakeRole && [ROLES.VEIL_SCHOLAR, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER].includes(fakeRole)) {
        netherMonk.fakeIdentity = fakeRole;
        this.privateLog.push({
          type: 'nether_monk_fake_identity',
          player: netherMonk.id,
          fakeRole,
          msg: `冥僧人编织了假身份：${fakeRole}`,
        });
      }
    }

    // 更新冥僧人的所在屋子（不计入人数）
    if (netherMonk.nightAction === 'GO_OUT' && netherMonk.nightTarget) {
      netherMonk.currentHouse = netherMonk.nightTarget;
      netherMonk.atHome = false;
    }

    // 重置冥僧入定状态，使其能在蚀者步骤重新提交刀人
    // 出门信息已保存在 currentHouse/atHome，collectHouseVisitInfo 用这些判断
    netherMonk.nightAction = null;
    netherMonk.nightTarget = null;
    netherMonk.nightAbility = null;
  }

  // ==========================================
  //  3. 守卫
  // ==========================================
  resolveVeilGuardian() {
    const veilGuardian = this.players.find(p => p.role === ROLES.VEIL_GUARDIAN && p.alive);
    if (!veilGuardian || veilGuardian.nightAction === 'SLEEP') return;

    if (veilGuardian.nightAbility?.protect) {
      const targetId = veilGuardian.nightTarget;
      const target = this.players.find(p => p.id === targetId);
      if (target) {
        // 守卫去目标家
        veilGuardian.currentHouse = targetId;
        veilGuardian.atHome = false;
        veilGuardian.isProtecting = true;
        veilGuardian.protectTarget = targetId;
        this.privateLog.push({ type: 'protect', player: veilGuardian.id, target: targetId });
      }
    }

    // 如果守卫只是出门（不使用守护能力）
    if (veilGuardian.nightAction === 'GO_OUT' && !veilGuardian.nightAbility?.protect) {
      veilGuardian.atHome = false;
      if (veilGuardian.nightTarget) {
        veilGuardian.currentHouse = veilGuardian.nightTarget;
      }
    }

    // 新增：守卫筑垒（加固目标屋子）
    if (veilGuardian.nightAbility?.fortify && veilGuardian.nightTarget) {
      veilGuardian.fortifiedTarget = veilGuardian.nightTarget;
      veilGuardian.currentHouse = veilGuardian.nightTarget;
      veilGuardian.atHome = false;
      this.privateLog.push({
        type: 'veil_guardian_fortify',
        player: veilGuardian.id,
        target: veilGuardian.nightTarget,
        msg: '守卫筑垒加固了目标屋子',
      });
    }

    // 新增：守卫巡逻（不护具体目标，巡视全村）
    if (veilGuardian.nightAbility?.patrol) {
      veilGuardian.patrolled = true;
      const corruptedHouses = [];
      for (const p of this.players) {
        if (p.alive && p.isCorrupted() && p.nightAction === 'GO_OUT' && p.currentHouse !== p.id) {
          corruptedHouses.push(p.currentHouse);
        }
      }
      this.privateLog.push({
        type: 'veil_guardian_patrol',
        player: veilGuardian.id,
        corruptedVisitedHouses: corruptedHouses,
        count: corruptedHouses.length,
        msg: `守卫巡逻：${corruptedHouses.length > 0 ? `发现${corruptedHouses.length}间屋子有蚀者进入` : '未发现异常'}`,
      });
    }

    // 新增：守卫舍身（标记替死目标）
    if (veilGuardian.nightAbility?.sacrifice && veilGuardian.nightTarget) {
      veilGuardian.sacrificeTarget = veilGuardian.nightTarget;
      this.privateLog.push({
        type: 'veil_guardian_sacrifice',
        player: veilGuardian.id,
        target: veilGuardian.nightTarget,
        msg: '守卫立下舍身誓言：若目标死亡，愿替其死',
      });
    }
  }

  // ==========================================
  //  4. 蚀者群（随机顺序）
  // ==========================================
  resolveCorrupted() {
    // 所有蚀者阵营：普通蚀者 + 已蚀变/已堕化的冥僧人（参与协同）
    const corrupted = this.players.filter(p =>
      p.alive &&
      (p.role === ROLES.CORRUPTED ||
       (p.role === ROLES.NETHER_MONK && (p.isTransformed || p.hasUsedCorrupt)))
    );

    if (corrupted.length === 0) return;

    // 随机打乱蚀者噬灵顺序
    this.shuffleArray(corrupted);

    // 收集所有蚀者的击杀目标
    const killTargets = new Map(); // targetId -> [corruptedIds]

    for (const corrupted of corrupted) {
      if (corrupted.nightAction === 'SLEEP') continue;

      // 新增：蚀者共鸣召集
      if (corrupted.nightAction === 'RIFT_RESONANCE') {
        corrupted.resonated = true;
        corrupted.resonanceCooldown = 2; // 冷却2回合
        this.privateLog.push({
          type: 'rift_resonance',
          player: corrupted.id,
          msg: '蚀者发出共鸣——同伴们听到了召唤',
        });
        // 通知所有未相认的蚀者
        for (const otherCorrupted of corrupted) {
          if (otherCorrupted.id !== corrupted.id && !otherCorrupted.knownCorrupted.includes(corrupted.id)) {
            this.privateLog.push({
              type: 'rift_resonance_heard',
              player: otherCorrupted.id,
              resonator: corrupted.id,
              msg: '你听到了同伴的共鸣——有人在召唤你',
            });
          }
        }
        continue; // 共鸣的蚀者今晚不刀人
      }

      // 新增：蚀者伪装（计入屋子人数）
      if (corrupted.nightAction === 'DISGUISE') {
        corrupted.disguised = true;
        corrupted.atHome = false;
        if (corrupted.nightTarget) {
          corrupted.currentHouse = corrupted.nightTarget;
        }
        this.privateLog.push({
          type: 'corrupted_disguise',
          player: corrupted.id,
          msg: '蚀者伪装成守幕者，混入人群中',
        });
        continue; // 伪装的蚀者今晚不刀人
      }

      // 蚀者出门
      if (corrupted.nightAction === 'GO_OUT') {
        corrupted.atHome = false;
        if (corrupted.nightTarget) {
          corrupted.currentHouse = corrupted.nightTarget;
          // 检查是否去了另一个蚀者家 → 相认
          const houseOwner = this.players.find(p => p.id === corrupted.nightTarget);
          if (houseOwner && houseOwner.isCorrupted() && houseOwner.alive) {
            if (!corrupted.knownCorrupted.includes(houseOwner.id)) {
              corrupted.knownCorrupted.push(houseOwner.id);
              corrupted.corruptedOpenEyesTogether.push(houseOwner.id);
              houseOwner.knownCorrupted.push(corrupted.id);
              houseOwner.corruptedOpenEyesTogether.push(corrupted.id);
              this.privateLog.push({ type: 'corrupted_meet', corrupted: [corrupted.id, houseOwner.id] });
            }
          }
        }
      }

      // 新增：嗅觉追踪（刀人时记录目标的去向）
      if (corrupted.nightAbility?.trackScent && corrupted.nightTarget) {
        const target = this.players.find(p => p.id === corrupted.nightTarget && p.alive);
        if (target && target.nightAction === 'GO_OUT' && target.currentHouse !== target.id) {
          corrupted.scentTrail.push({
            target: corrupted.nightTarget,
            house: target.currentHouse,
            round: this.game.round,
          });
          this.privateLog.push({
            type: 'corrupted_scent_track',
            player: corrupted.id,
            target: corrupted.nightTarget,
            house: target.currentHouse,
            msg: `嗅觉追踪：目标去了 ${target.currentHouse} 的屋子`,
          });
        }
      }

      // 蚀者刀人（锁定人，不是锁定屋子）
      if (corrupted.nightAbility?.kill) {
        const targetId = corrupted.nightTarget;
        // 蚀者刀人是跟着人走 —— 目标锁定为人
        if (targetId) {
          if (!killTargets.has(targetId)) {
            killTargets.set(targetId, []);
          }
          killTargets.get(targetId).push(corrupted.id);
          corrupted.corruptedKillTarget = targetId;
        }
      }
    }

    // 处理蚀者互刀：如果两个蚀者互刀 → 相认；如果一方刀另一方 → 被杀
    for (const [targetId, killers] of killTargets) {
      const target = this.players.find(p => p.id === targetId);
      if (!target || !target.alive) continue;

      // 被刀的目标也是蚀者
      if (target.isCorrupted() && target.corruptedKillTarget) {
        // 检查是否互刀
        const mutualKill = killers.some(corruptedId => target.corruptedKillTarget === corruptedId);
        if (mutualKill) {
          // 互刀 → 相认，不死
          for (const corruptedId of killers) {
            const corrupted = this.players.find(p => p.id === corruptedId);
            if (corrupted && !corrupted.knownCorrupted.includes(targetId)) {
              corrupted.knownCorrupted.push(targetId);
              corrupted.corruptedOpenEyesTogether.push(targetId);
            }
          }
          if (!target.knownCorrupted.includes(killers[0])) {
            target.knownCorrupted.push(killers[0]);
            target.corruptedOpenEyesTogether.push(killers[0]);
          }
          this.privateLog.push({ type: 'corrupted_mutual_kill', corrupted: [...killers, targetId] });
          // 移除击杀
          killTargets.delete(targetId);
          for (const corruptedId of killers) {
            const corrupted = this.players.find(p => p.id === corruptedId);
            if (corrupted) corrupted.corruptedKillTarget = null;
          }
          target.corruptedKillTarget = null;
        }
      }
    }

    // 存储击杀目标供结算阶段使用
    this.corruptedKills = killTargets;
  }

  // ==========================================
  //  5. 察灵家
  // ==========================================
  resolveVeilScholar() {
    const veilScholar = this.players.find(p => p.role === ROLES.VEIL_SCHOLAR && p.alive);
    if (!veilScholar || veilScholar.nightAction === 'SLEEP' || !veilScholar.nightTarget) return;

    const targetId = veilScholar.nightTarget;
    const target = this.players.find(p => p.id === targetId && p.alive);
    if (!target) return;

    // 出门
    if (veilScholar.nightAction === 'GO_OUT') {
      veilScholar.currentHouse = targetId;
      veilScholar.atHome = false;
    }

    // 查验
    if (veilScholar.nightAbility?.check) {
      // 判断逻辑：
      // - 普通蚀者：是蚀者
      // - 冥僧人：蚀变后是蚀者；使用堕化后是蚀者；未蚀变未堕化 → 守幕者
      // - 假身份：冥僧人有fakeIdentity时显示为该守幕者
      let isGood = true;
      if (target.role === ROLES.CORRUPTED) {
        isGood = false;
      } else if (target.role === ROLES.NETHER_MONK) {
        const isCorrupted = target.isTransformed || target.hasUsedCorrupt;
        if (!isCorrupted && target.fakeIdentity) {
          // 假身份编织：查验结果显示为伪装的守幕者
          veilScholar.checkResult = `FAKE_${target.fakeIdentity}`;
          this.privateLog.push({
            type: 'veil_scholar_check_fake',
            player: veilScholar.id,
            target: targetId,
            fakeRole: target.fakeIdentity,
            msg: `查验结果：${target.fakeIdentity}（但真相隐藏在更深处...）`,
          });
          return; // 特殊处理，不走正常逻辑
        }
        isGood = !isCorrupted;
      }
      // 被堕化但尚未生效的不算蚀者

      // 被堕化察灵家：查验结果反转（蚀者→守幕者，守幕者→蚀者）
      if (veilScholar.corruptedByNetherMonk) {
        isGood = !isGood;
      }

      veilScholar.checkResult = isGood ? 'GOOD' : 'CORRUPTED';
      this.privateLog.push({
        type: 'veil_scholar_check',
        player: veilScholar.id,
        target: targetId,
        result: veilScholar.checkResult,
        reversed: !!veilScholar.corruptedByNetherMonk,
      });
    }

    // 新增：梦境碎片（额外模糊线索）
    if (veilScholar.nightAbility?.dreamFragment && veilScholar.nightTarget) {
      const fragments = [
        '梦境中你看到有人影在目标屋外徘徊...',
        '梦的碎片里，你听到目标屋内传来不寻常的声响...',
        '你在梦中感受到一股不安——目标的命运与今晚紧密相连...',
      ];
      veilScholar.dreamFragment = fragments[Math.floor(Math.random() * fragments.length)];
      this.privateLog.push({
        type: 'veil_scholar_dream',
        player: veilScholar.id,
        fragment: veilScholar.dreamFragment,
      });
    }

    // 新增：灵视（查验已死的玩家）
    if (veilScholar.nightAbility?.spiritVision && veilScholar.spiritVisionTarget) {
      const deadTarget = this.players.find(p => p.id === veilScholar.spiritVisionTarget && !p.alive);
      if (deadTarget) {
        veilScholar.checkResult = `SPIRIT_${deadTarget.role}`;
        this.privateLog.push({
          type: 'veil_scholar_spirit_vision',
          player: veilScholar.id,
          target: deadTarget.id,
          role: deadTarget.role,
          msg: `灵视：死者 ${deadTarget.name || deadTarget.id} 的真实身份是 ${deadTarget.role}`,
        });
      }
    }
  }

  // ==========================================
  //  6. 草药学者（蚀灭符阵 + 灵符）
  // ==========================================
  resolveHerbalSage() {
    const pw = this.players.find(p => p.role === ROLES.HERBAL_SAGE && p.alive);
    if (!pw || pw.nightAction === 'SLEEP') return;

    const ability = pw.nightAbility || {};

    // 出门
    if (pw.nightAction === 'GO_OUT' && pw.nightTarget) {
      pw.currentHouse = pw.nightTarget;
      pw.atHome = false;
    }

    // 蚀灭符阵：毒死一个屋子中所有人
    if (ability.massSeal) {
      const targetHouse = ability.massSealTarget; // 目标屋子（玩家ID）
      const peopleInHouse = this.getPeopleInHouse(targetHouse);

      // 检查守卫是否在屋子里（3人及以上且守卫在其中→灵蚀重伤）
      const veilGuardian = peopleInHouse.find(p => p.role === ROLES.VEIL_GUARDIAN);
      if (peopleInHouse.length >= 3 && veilGuardian) {
        veilGuardian.heavyInjury = true;
        veilGuardian.whoKnowsVeilGuardianHeavyInjury = [veilGuardian.id, pw.id];
        this.privateLog.push({ type: 'veil_guardian_heavy_injury', player: veilGuardian.id, source: 'mass_seal' });
        // 灵蚀重伤，其余人被毒死
        for (const p of peopleInHouse) {
          if (p.id !== veilGuardian.id && p.alive) {
            this.markForDeath(p.id, 'mass_seal');
          }
        }
      } else {
        // 全部毒死
        for (const p of peopleInHouse) {
          if (p.alive) {
            this.markForDeath(p.id, 'mass_seal');
          }
        }
      }
      this.log.push({ type: 'mass_seal', house: targetHouse });
    }

    // 草药学者的灵符（不能治疗灵蚀重伤）
    if (ability.talisman) {
      const targetId = ability.talismanTarget;
      const target = this.players.find(p => p.id === targetId);
      const isMarkedForDeath = this.deathMarks.has(targetId);
      if (target && isMarkedForDeath && !(target.role === ROLES.VEIL_GUARDIAN && target.heavyInjury)) {
        this.reviveFromDeath(targetId);
        this.log.push({ type: 'talisman_save', target: targetId });
      }
      pw.hasHealTalisman = false;
    }

    // 新增：蚀雾符阵（在目标屋子释放延迟蚀雾）
    if (ability.corrosionMist) {
      const fogTarget = ability.corrosionMistTarget;
      pw.corrosionMistTarget = fogTarget;
      pw.corrosionMistActive = true;
      this.privateLog.push({
        type: 'corrosion_mist_set',
        player: pw.id,
        target: fogTarget,
        msg: '草药学者在目标屋子释放了蚀雾——下一晚进入的人将中毒',
      });
    }

    // 新增：毒药材料管理（2材料→1蚀灭符阵，1材料→1普通毒药）
    if (ability.massSeal) {
      pw.talismanMaterials = Math.max(0, (pw.talismanMaterials || 2) - 2);
    } else if (ability.singlePoison) {
      pw.talismanMaterials = Math.max(0, (pw.talismanMaterials || 2) - 1);
    }
  }

  // ==========================================
  //  7. 愈灵师（万能药 + 单目标毒药）
  // ==========================================
  resolveSpiritMender() {
    const hw = this.players.find(p => p.role === ROLES.SPIRIT_MENDER && p.alive);
    if (!hw || hw.nightAction === 'SLEEP') return;

    const ability = hw.nightAbility || {};

    // 出门
    if (hw.nightAction === 'GO_OUT' && hw.nightTarget) {
      hw.currentHouse = hw.nightTarget;
      hw.atHome = false;
    }

    // 万能药（可以治疗一切，包括灵蚀重伤）
    if (ability.heal) {
      const targetId = ability.healTarget;
      const target = this.players.find(p => p.id === targetId);
      if (target) {
        // 检查 deathMarks（而非 !target.alive，因为死亡标记要到 RESOLUTION 步才应用）
        const isMarkedForDeath = this.deathMarks.has(targetId);
        if (isMarkedForDeath) {
          this.reviveFromDeath(targetId);
          this.log.push({ type: 'heal_save', target: targetId });
        }
        if (target.heavyInjury) {
          target.heavyInjury = false;
          target.whoKnowsVeilGuardianHeavyInjury = [];
          this.privateLog.push({ type: 'heal_injury', player: targetId });
        }
      }
      hw.hasHealTalisman = false;
    }

    // 单目标毒药
    if (ability.poison) {
      const targetId = ability.poisonTarget;
      const target = this.players.find(p => p.id === targetId && p.alive);
      if (target) {
        // 检查目标是否在毒生效前离开屋子
        if (target.nightAction === 'GO_OUT' && target.currentHouse !== target.id) {
          // 目标离开了，毒失效，毒到第一个进入屋子的人
          const firstEntrant = this.getFirstEntrant(target.id);
          if (firstEntrant) {
            this.markForDeath(firstEntrant.id, 'spirit_mender_poison');
            this.log.push({ type: 'seal_transferred', original: targetId, actual: firstEntrant.id });
          }
        } else {
          this.markForDeath(targetId, 'spirit_mender_poison');
        }
      }
      hw.hasSealTalisman = false;
    }

    // 新增：战场急救（去被攻击的屋子，有概率急救重伤者）
    if (hw.nightAbility?.battlefieldAid && hw.nightTarget) {
      const aidHouse = hw.currentHouse || hw.nightTarget;
      for (const p of this.players) {
        if (p.alive && p.heavyInjury && (p.currentHouse || p.id) === aidHouse) {
          this.reviveFromDeath(p.id);
          p.heavyInjury = false;
          p.halfAlive = true;
          this.privateLog.push({
            type: 'battlefield_aid',
            player: hw.id,
            target: p.id,
            msg: '愈灵师战场急救成功——目标存活但暂时无法行动',
          });
          break;
        }
      }
    }

    // 新增：药草园（留守家中种植，获得额外解药）
    if (hw.nightAbility?.plantHerbGarden) {
      hw.talismanChargeStarted = true;
      hw.talismanCharged = true;
      this.privateLog.push({
        type: 'herb_garden',
        player: hw.id,
        msg: '愈灵师在自己的药草园种下了种子——下一回合可收获',
      });
    }

    // 新增：诊断（获知目标状态而不使用药）
    if (hw.nightAbility?.diagnose && hw.nightTarget) {
      const diagTarget = this.players.find(p => p.id === hw.nightTarget && p.alive);
      if (diagTarget) {
        hw.diagnoseResult = {
          isMarkedForDeath: this.deathMarks.has(diagTarget.id),
          heavyInjury: diagTarget.heavyInjury,
          corruptedByNetherMonk: diagTarget.corruptedByNetherMonk,
          willBecomeCorrupted: diagTarget.willBecomeCorrupted,
        };
        this.privateLog.push({
          type: 'diagnose',
          player: hw.id,
          target: diagTarget.id,
          result: hw.diagnoseResult,
          msg: `诊断结果：${JSON.stringify(hw.diagnoseResult)}`,
        });
      }
    }
  }

  // ==========================================
  //  8. 灵织者（在所有专业守幕者和蚀者之后行动）
  // ==========================================
  resolveWeaver() {
    const weavers = this.players.filter(p =>
      p.role === ROLES.SPIRIT_WEAVER && p.alive
    );
    if (weavers.length === 0) return;

    for (const weaver of weavers) {
      if (!weaver.nightAction || weaver.nightAction === 'SLEEP') continue;

      // 灵织者出门去别人家
      if (weaver.nightAction === 'GO_OUT' && weaver.nightTarget) {
        weaver.currentHouse = weaver.nightTarget;
        weaver.atHome = false;
      }

      // 老兵灵织者：直觉 + 陷阱
      if (weaver.weaverType === SPIRIT_WEAVER_TYPES.OLD_VETERAN) {
        if (weaver.nightAction === 'TRAP_SET') {
          weaver.doorFortified = true;
          this.privateLog.push({
            type: 'old_flame_tracker_trap',
            player: weaver.id,
            msg: '老兵在自家设下了陷阱',
          });
        }
      }

      // 旅行商人灵织者：双访问
      if (weaver.weaverType === SPIRIT_WEAVER_TYPES.WANDERING_TRADER) {
        if (weaver.nightAbility?.secondVisit && weaver.nightAbility.secondTarget) {
          // 第二个访问目标（不触发额外效果，仅收集信息）
          this.privateLog.push({
            type: 'merchant_double_visit',
            player: weaver.id,
            firstTarget: weaver.nightTarget,
            secondTarget: weaver.nightAbility.secondTarget,
            msg: `商人访问了两个屋子`,
          });
        }
        // 交易信息
        if (weaver.nightAction === 'TRADE_INFO' && weaver.nightTarget) {
          this.privateLog.push({
            type: 'trade_info',
            player: weaver.id,
            target: weaver.nightTarget,
            msg: '商人发起了信息交易',
          });
        }
      }

      // 草药师灵织者：草药
      if (weaver.weaverType === SPIRIT_WEAVER_TYPES.SPIRIT_APPRENTICE) {
        if (weaver.nightAction === 'HERBAL_REMEDY' && weaver.nightTarget) {
          weaver.herbalRemedyUsed = true;
          weaver.herbalRemedyTarget = weaver.nightTarget;
          this.privateLog.push({
            type: 'herbal_remedy',
            player: weaver.id,
            target: weaver.nightTarget,
            msg: '草药师使用了草药——若目标今晚死亡，可推迟1回合',
          });
        }
      }

      // 守夜人灵织者：守夜
      if (weaver.weaverType === SPIRIT_WEAVER_TYPES.NIGHT_SENTINEL) {
        if (weaver.nightAction === 'NIGHT_WATCH') {
          // 获知今晚出门的总人数
          const outCount = this.players.filter(p => p.alive && p.nightAction === 'GO_OUT').length;
          weaver.nightWatchAlert = { outCount, round: this.game.round };
          this.privateLog.push({
            type: 'night_watch',
            player: weaver.id,
            outCount,
            msg: `守夜灵织者：今晚有 ${outCount} 人出门`,
          });
        }
      }

      // 铁匠灵织者：加固门锁
      if (weaver.weaverType === SPIRIT_WEAVER_TYPES.ARMOR_SMITH) {
        if (weaver.nightAction === 'FORTIFY_DOOR') {
          weaver.doorFortified = true;
          this.privateLog.push({
            type: 'blacksmith_fortify',
            player: weaver.id,
            msg: '铁匠加固了自家门锁——可抵御一次蚀者噬灵',
          });
        }
      }

      // 织幕灵织者：帷幕低语更精确
      if (weaver.weaverType === SPIRIT_WEAVER_TYPES.VEIL_WEAVER) {
        if (weaver.nightAction === 'EAVESDROP' && weaver.nightTarget) {
          // 织网：排除干扰项（50%概率给出精确信息而非模糊线索）
          const accurateResult = this._accurateEavesdrop(weaver.nightTarget);
          this.privateLog.push({
            type: 'eavesdrop_accurate',
            player: weaver.id,
            target: weaver.nightTarget,
            result: accurateResult,
            msg: `精确帷幕低语: ${accurateResult}`,
          });
          continue;
        }
      }

      // 灵织低语（通用逻辑，非织布女）
      if (weaver.nightAction === 'EAVESDROP' && weaver.nightTarget) {
        const result = this._eavesdropResult(weaver.nightTarget);
        this.privateLog.push({
          type: 'eavesdrop',
          player: weaver.id,
          target: weaver.nightTarget,
          result,
          msg: `帷幕低语结果: ${result}`,
        });
      }
    }
  }

  // 织布女精确帷幕低语（排除干扰项）
  _accurateEavesdrop(targetHouseId) {
    const peopleInHouse = this.players.filter(p => {
      if (!p.alive) return false;
      return (p.currentHouse || p.id) === targetHouseId;
    });

    const hasCorrupted = peopleInHouse.some(p => p.isCorrupted());
    const hasKeeper = peopleInHouse.some(p => p.isKeeper());
    const hasWeaver = peopleInHouse.some(p => p.isWeaver());

    const clues = [];
    if (hasCorrupted) clues.push(`你清楚地听到了蚀者的呼吸声——屋里有蚀者`);
    if (hasKeeper) clues.push(`你听到了法器碰撞的声音——屋里有守幕者`);
    if (hasWeaver) clues.push(`你听到了平常人的脚步声——屋里有灵织者`);
    if (peopleInHouse.length === 0) clues.push('屋里空无一人，只有风声');
    if (peopleInHouse.length >= 2) clues.push(`你能分辨出至少${peopleInHouse.length}个人`);

    return clues.length > 0
      ? clues.join('；')
      : '什么也没听到...';
  }

  _eavesdropResult(targetHouseId) {
    // 获取目标屋内的所有存活玩家（包括屋主）
    const peopleInHouse = this.players.filter(p => {
      if (!p.alive) return false;
      return (p.currentHouse || p.id) === targetHouseId;
    });

    // 分类屋内成员
    const hasCorrupted = peopleInHouse.some(p => p.isCorrupted());
    const hasKeeper = peopleInHouse.some(p => p.isKeeper());
    const hasWeaver = peopleInHouse.some(p => p.isWeaver());
    const total = peopleInHouse.length;

    // 根据屋内实际成员构建候选结果池
    const candidates = [];

    if (hasCorrupted) {
      candidates.push('听到低沉的裂隙共鸣声...');
      candidates.push('听到野兽般的呼吸声...');
    }
    if (hasKeeper) {
      candidates.push('听到祈祷的低语...');
      candidates.push('听到法器碰撞的声响...');
    }
    if (hasWeaver || total > 0) {
      candidates.push('听到有人在小声交谈...');
      candidates.push('听到轻微的脚步声...');
    }
    if (total >= 2) {
      candidates.push('听到屋内有多人在活动...');
    }
    if (total === 0) {
      candidates.push('什么也没听到...屋内似乎空无一人');
      candidates.push('只听到风吹过的声音...屋里很安静');
      candidates.push('屋内静悄悄的，主人可能出门了');
    }
    // 总是有 fallback
    if (candidates.length === 0) {
      candidates.push('听到一些模糊的声响，但无法分辨...');
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ==========================================
  //  最终结算：处理所有死亡 + 重伤
  // ==========================================
  resolveAllDeaths() {
    // --- 处理蚀者噬灵 ---
    // 守卫查找提前到循环外，避免每次迭代重复查找
    const veilGuardian = this.players.find(p => p.role === ROLES.VEIL_GUARDIAN && p.alive);
    const herbalSage = this.players.find(p => p.role === ROLES.HERBAL_SAGE && p.alive);

    if (this.corruptedKills) {
      for (const [targetId, killers] of this.corruptedKills) {
        if (killers.length === 0) continue;
        const target = this.players.find(p => p.id === targetId && p.alive);
        if (!target) continue;

        // 蚀者跟着目标去击杀（目标锁定为人）
        if (veilGuardian && veilGuardian.isProtecting) {
          // 检查守卫是否在当前被攻击目标所在屋子
          const targetHouse = target.currentHouse || target.id;
          const peopleInHouse = this.getPeopleInHouse(targetHouse);
          const peopleCount = peopleInHouse.length;

          if (peopleInHouse.includes(veilGuardian) && peopleCount >= 1 && peopleCount <= 2) {
            // 守卫守护的屋子有1-2人且被蚀者噬灵 → 灵蚀重伤
            veilGuardian.heavyInjury = true;
            veilGuardian.whoKnowsVeilGuardianHeavyInjury = [veilGuardian.id];
            if (herbalSage) veilGuardian.whoKnowsVeilGuardianHeavyInjury.push(herbalSage.id);
            this.privateLog.push({ type: 'veil_guardian_heavy_injury', player: veilGuardian.id, source: 'corrupted_attack' });
            // 守卫挡下了攻击，目标不死
            continue;
          }
          if (peopleInHouse.includes(veilGuardian) && peopleCount >= 3 && killers.length >= 1) {
            // 人多时灵蚀重伤但目标可能还是死
            veilGuardian.heavyInjury = true;
            veilGuardian.whoKnowsVeilGuardianHeavyInjury = [veilGuardian.id];
            if (herbalSage) veilGuardian.whoKnowsVeilGuardianHeavyInjury.push(herbalSage.id);
            this.privateLog.push({ type: 'veil_guardian_heavy_injury', player: veilGuardian.id, source: 'corrupted_attack_3plus' });
          }
        }

        // 检查守卫独自在家被一位蚀者噬灵
        if (veilGuardian && veilGuardian.nightAction === 'SLEEP' && targetId === veilGuardian.id && killers.length === 1) {
          veilGuardian.heavyInjury = true;
          veilGuardian.whoKnowsVeilGuardianHeavyInjury = [veilGuardian.id];
          if (herbalSage) veilGuardian.whoKnowsVeilGuardianHeavyInjury.push(herbalSage.id);
          // 蚀者知道这是守卫
          const killer = this.players.find(p => p.id === killers[0]);
          if (killer) killer.knownVeilGuardian = veilGuardian.id;
          this.privateLog.push({ type: 'veil_guardian_heavy_injury_alone', player: veilGuardian.id, corrupted: killers[0] });
          continue; // 灵蚀重伤但没死
        }

        // 检查灵痕追猎者的短铳反击
        if (target.role === ROLES.FLAME_TRACKER && target.blunderbussUsable) {
          // 灵痕追猎者用短火铳反杀攻击者
          for (const corruptedId of killers) {
            this.markForDeath(corruptedId, 'flame_tracker_blunderbuss');
          }
          target.blunderbussUsable = false;
          this.log.push({ type: 'flame_tracker_defend', player: target.id });
          continue; // 灵痕追猎者不死
        }

        // 正常击杀
        this.markForDeath(targetId, 'corrupted_kill');

        // 新增：铁匠加固门锁——抵御一次蚀者噬灵
        if (target.doorFortified && target.alive) {
          target.doorFortified = false; // 门锁被破坏
          this.reviveFromDeath(targetId);
          this.privateLog.push({
            type: 'blacksmith_door_blocked',
            player: target.id,
            msg: '铁匠的加固门锁挡住了蚀者的攻击！但门锁已被破坏',
          });
        }

        // 新增：老兵陷阱——蚀者进入时有20%概率被发现
        if (target.weaverType === 'OLD_VETERAN' && target.doorFortified && Math.random() < 0.20) {
          for (const corruptedId of killers) {
            if (!target.knownCorrupted) target.knownCorrupted = [];
            target.knownCorrupted.push(corruptedId);
          }
          this.privateLog.push({
            type: 'old_veteran_detected',
            player: target.id,
            detectedWolves: killers,
            msg: '老兵的陷阱触发了——你发现了进入庇护所的蚀者！',
          });
        }
      }
    }

    // 新增：守卫舍身——替目标死亡
    for (const [targetId, reason] of this.deathMarks) {
      const veilGuardian = this.players.find(p =>
        p.role === ROLES.VEIL_GUARDIAN && p.alive && p.sacrificeTarget === targetId
      );
      if (veilGuardian) {
        this.reviveFromDeath(targetId);
        this.markForDeath(veilGuardian.id, 'veil_guardian_sacrifice');
        this.log.push({
          type: 'veil_guardian_sacrifice_death',
          veilGuardian: veilGuardian.id,
          savedTarget: targetId,
          msg: '守卫舍身替目标挡下了致命一击！',
        });
        this.privateLog.push({
          type: 'veil_guardian_sacrifice',
          player: veilGuardian.id,
          target: targetId,
          msg: '你履行了舍身誓言——目标活了下来',
        });
      }
    }

    // 新增：蚀雾延迟结算——上一晚设下的蚀雾本晚触发
    for (const p of this.players) {
      if (!p.alive) continue;
      // 找到草药学者的蚀雾
      const herbalSage = this.players.find(pw =>
        pw.role === ROLES.HERBAL_SAGE && pw.corrosionMistActive && pw.corrosionMistTarget
      );
      if (herbalSage && herbalSage.corrosionMistTarget) {
        const peopleInFog = this.getPeopleInHouse(herbalSage.corrosionMistTarget);
        for (const victim of peopleInFog) {
          if (victim.id !== herbalSage.id && !this.deathMarks.has(victim.id)) {
            this.markForDeath(victim.id, 'corrosion_mist');
            this.log.push({
              type: 'corrosion_mist_triggered',
              target: victim.id,
              msg: '蚀雾陷阱触发——进入者中毒身亡',
            });
          }
        }
        herbalSage.corrosionMistTarget = null;
        herbalSage.corrosionMistActive = false;
      }
    }

    // --- 应用死亡标记 ---
    this.applyDeathMarks();

    // 新增：草药师草药——推迟死亡1回合
    for (const p of this.players) {
      if (!p.alive && p.herbalRemedyUsed) continue; // 已经是死亡+已使用草药的情况
      const herbalist = this.players.find(h =>
        h.alive && h.weaverType === 'SPIRIT_APPRENTICE' &&
        h.herbalRemedyTarget === p.id && h.herbalRemedyUsed
      );
      if (herbalist && !p.alive) {
        p.alive = true; // 推迟死亡
        p.delayedDeath = true; // 标记为延迟死亡（下一晚结算时若无人救则必死）
        herbalist.herbalRemedyUsed = false;
        herbalist.herbalRemedyTarget = null;
        this.log.push({
          type: 'herbal_delay',
          player: p.id,
          msg: '草药师的草药推迟了目标的死亡——但只有一回合',
        });
        this.privateLog.push({
          type: 'herbal_delay',
          player: herbalist.id,
          target: p.id,
          msg: '你的草药起效了——目标暂时活了下来',
        });
      }
    }

    // 新增：延迟死亡结算（上回合被草药推迟的，本回合若未被救则死亡）
    for (const p of this.players) {
      if (p.delayedDeath && p.alive && !this.deathMarks.has(p.id)) {
        p.alive = false;
        p.delayedDeath = false;
        this.log.push({
          type: 'delayed_death',
          player: p.id,
          msg: '草药的效果消失了——再也无法推迟的死亡',
        });
      }
    }

    // --- 应用堕化效果（延迟一晚上） ---
    for (const p of this.players) {
      if (p.willBecomeCorrupted && p.alive) {
        if (p.role === ROLES.VEIL_SCHOLAR) {
          // 察灵家保留能力不蚀变，已在冥僧步骤中处理
          p.willBecomeCorrupted = false;
        } else {
          p.role = ROLES.CORRUPTED;
          p.team = 'CORRUPTED';
          p.willBecomeCorrupted = false;
          p.corruptedByNetherMonk = false;
          this.log.push({ type: 'became_corrupted', player: p.id });
        }
      }
    }

    // --- 处理蚀者相认（下回合共同睁眼） ---
    for (const p of this.players) {
      if (p.role === ROLES.CORRUPTED && p.corruptedOpenEyesTogether.length > 0) {
        this.privateLog.push({
          type: 'corrupted_united',
          corrupted: [p.id, ...p.corruptedOpenEyesTogether],
        });
      }
    }
  }

  // ---- 辅助方法 ----

  // 获取某个屋子里的所有存活玩家
  getPeopleInHouse(houseId) {
    return this.players.filter(p => {
      if (!p.alive) return false;
      return (p.currentHouse || p.id) === houseId;
    });
  }

  // 获取第一个进入屋子的人
  getFirstEntrant(houseId) {
    // 简化处理：找到去了这个屋子但原屋主已离开的人
    return this.players.find(p =>
      p.alive && p.nightAction === 'GO_OUT' && p.nightTarget === houseId
    ) || null;
  }

  // 死亡标记队列
  deathMarks = new Map(); // playerId -> reason

  markForDeath(playerId, reason) {
    this.deathMarks.set(playerId, reason);
  }

  reviveFromDeath(playerId) {
    this.deathMarks.delete(playerId);
  }

  applyDeathMarks() {
    for (const [playerId, reason] of this.deathMarks) {
      const player = this.players.find(p => p.id === playerId);
      if (player && player.alive) {
        player.alive = false;
        this.log.push({ type: 'death', player: playerId, reason });
      }
    }
  }

  // Fisher-Yates 洗牌
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
