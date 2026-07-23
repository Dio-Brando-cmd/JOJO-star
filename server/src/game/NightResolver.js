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
    this.wolfKills = new Map(); // 蚀者噬灵目标 Map<targetId, wolfIds[]>
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

        // 村民因人数过多被赶回家时只显示"很多人"
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
          // 村民被赶回家
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
      [NIGHT_STEPS.FLAME_TRACKER]: () => this.resolveHunter(),
      [NIGHT_STEPS.NETHER_MONK]: () => this.resolveAlphaWolf(),
      [NIGHT_STEPS.VEIL_GUARDIAN]: () => this.resolveGuard(),
      [NIGHT_STEPS.CORRUPTED]: () => this.resolveWerewolves(),
      [NIGHT_STEPS.VEIL_SCHOLAR]: () => this.resolveSeer(),
      [NIGHT_STEPS.HERBAL_SAGE]: () => this.resolvePoisonWitch(),
      [NIGHT_STEPS.SPIRIT_MENDER]: () => this.resolveHealWitch(),
      [NIGHT_STEPS.SPIRIT_WEAVER]: () => this.resolveWeaver(),
    };

    const handler = handlers[step];
    if (handler) await handler();
  }

  // ==========================================
  //  1. 猎人（第二晚起第一个行动）
  // ==========================================
  resolveHunter() {
    const hunter = this.players.find(p => p.role === ROLES.FLAME_TRACKER && p.alive);
    if (!hunter || !hunter.nightAction) return;

    if (hunter.nightAction === 'SLEEP') return;

    // 猎人观察目标
    if (hunter.observedTarget && hunter.nightAction === 'USE_ABILITY') {
      const target = this.players.find(p => p.id === hunter.observedTarget);
      if (target && target.alive) {
        hunter.observedTargetWentOut = target.nightAction === 'GO_OUT';
        this.privateLog.push({
          type: 'hunter_observe',
          player: hunter.id,
          target: target.id,
          wentOut: hunter.observedTargetWentOut,
        });
      }
    }

    // 猎人使用猎枪射杀（先开枪后腐蚀，确保同一晚可开枪）
    if (hunter.nightAbility?.useRifle && hunter.rifleUsable) {
      const targetId = hunter.nightAbility.rifleTarget;
      if (targetId) {
        this.markForDeath(targetId, 'hunter_rifle');
        this.log.push({ type: 'hunter_shoot', target: targetId, msg: '追猎者射击了！' });
        hunter.rifleUsable = false; // 开枪消耗猎枪
        hunter.canShootNextNight = null;
      }
    }

    // 猎枪追猎：上一晚观察到的出门目标
    if (hunter.canShootNextNight && hunter.rifleUsable) {
      this.markForDeath(hunter.canShootNextNight, 'hunter_rifle');
      this.log.push({ type: 'hunter_shoot', target: hunter.canShootNextNight, msg: '猎人追踪射杀！' });
      hunter.rifleUsable = false; // 开枪消耗猎枪
      hunter.canShootNextNight = null;
    }

    // 设置下一晚可追踪的目标
    if (hunter.observedTargetWentOut && hunter.observedTarget && !hunter.nightAbility?.useRifle) {
      hunter.canShootNextNight = hunter.observedTarget;
    }

    // 新增：猎人陷阱射击
    if (hunter.nightAbility?.useTrap && hunter.nightTarget) {
      hunter.trapTarget = hunter.nightTarget;
      this.privateLog.push({
        type: 'hunter_trap',
        player: hunter.id,
        target: hunter.nightTarget,
        msg: '猎人在目标屋子设下了陷阱',
      });
    }

    // 新增：猎人复仇标记（投票出局时触发，在此处记录）
    if (hunter.nightAbility?.markRevenge && hunter.nightTarget) {
      hunter.revengeTarget = hunter.nightTarget;
      this.privateLog.push({
        type: 'hunter_revenge_mark',
        player: hunter.id,
        target: hunter.nightTarget,
        msg: '猎人标记了复仇目标',
      });
    }

    // 处理武器腐蚀：带出门才会被腐蚀（在开枪之后判定，确保同一晚出门+开枪不会冲突）
    if (hunter.blunderbussUsable && hunter.nightAction === 'GO_OUT') {
      hunter.blunderbussUsable = false;
      this.privateLog.push({ type: 'blunderbuss_corroded', player: hunter.id, msg: '短火铳带出门，已腐蚀' });
    }
    if (hunter.rifleUsable && hunter.nightAction === 'GO_OUT') {
      hunter.rifleUsable = false;
      this.privateLog.push({ type: 'rifle_corroded', player: hunter.id, msg: '猎枪带出门，已腐蚀' });
    }
  }

  // ==========================================
  //  2. 种狼
  // ==========================================
  resolveAlphaWolf() {
    const alpha = this.players.find(p => p.role === ROLES.NETHER_MONK && p.alive);
    if (!alpha || alpha.nightAction === 'SLEEP') return;

    const ability = alpha.nightAbility || {};

    // 变狼
    if (ability.transform && !alpha.isTransformed) {
      alpha.isTransformed = true;
      this.privateLog.push({ type: 'alpha_transform', player: alpha.id, msg: '种狼完成了变狼' });
    }

    // 感染
    if (ability.infect && !alpha.hasUsedInfect && !alpha.hasKilled) {
      const targetId = alpha.nightTarget;
      const target = this.players.find(p => p.id === targetId && p.alive);
      if (target) {
        // 感染察灵家的特殊处理：察灵家被感染但不变成狼人，种狼保持蚀者阵营
        if (target.role === ROLES.VEIL_SCHOLAR) {
          target.infectedByAlpha = true;
          target.willBecomeWolf = false; // 察灵家保留能力，不变狼
          // 种狼仍属于蚀者阵营，身份不变，行动次序不变
          this.privateLog.push({ type: 'seer_infected', player: target.id, alphaId: alpha.id, msg: '察灵家被冥僧人堕化，但保留察灵能力' });
        } else {
          target.infectedByAlpha = true;
          target.willBecomeWolf = true;
          this.privateLog.push({ type: 'infected', player: target.id, msg: '被冥僧人堕化，下个夜晚蚀变为蚀者' });
        }
        alpha.hasUsedInfect = true;
        // 使用了感染后，当前夜晚种狼算作狼人（可被察灵家查出）
        this.privateLog.push({ type: 'alpha_infected_visible', player: alpha.id });
      }
    }

    // 注意：变狼后的刀人在 resolveWerewolves 中统一处理（已变狼种狼算作狼人群）
    // 此处只设置标记，不重复写击杀逻辑

    // 新增：假身份编织（变狼前可伪装成神职）
    if (ability.fakeIdentity && !alpha.isTransformed && !alpha.hasUsedInfect) {
      const fakeRole = ability.fakeIdentityRole;
      if (fakeRole && [ROLES.VEIL_SCHOLAR, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER].includes(fakeRole)) {
        alpha.fakeIdentity = fakeRole;
        this.privateLog.push({
          type: 'alpha_fake_identity',
          player: alpha.id,
          fakeRole,
          msg: `种狼编织了假身份：${fakeRole}`,
        });
      }
    }

    // 更新冥僧人的所在屋子（不计入人数）
    if (alpha.nightAction === 'GO_OUT' && alpha.nightTarget) {
      alpha.currentHouse = alpha.nightTarget;
      alpha.atHome = false;
    }

    // 重置冥僧入定状态，使其能在蚀者步骤重新提交刀人
    // 出门信息已保存在 currentHouse/atHome，collectHouseVisitInfo 用这些判断
    alpha.nightAction = null;
    alpha.nightTarget = null;
    alpha.nightAbility = null;
  }

  // ==========================================
  //  3. 守卫
  // ==========================================
  resolveGuard() {
    const guard = this.players.find(p => p.role === ROLES.VEIL_GUARDIAN && p.alive);
    if (!guard || guard.nightAction === 'SLEEP') return;

    if (guard.nightAbility?.guard) {
      const targetId = guard.nightTarget;
      const target = this.players.find(p => p.id === targetId);
      if (target) {
        // 守卫去目标家
        guard.currentHouse = targetId;
        guard.atHome = false;
        guard.isGuarding = true;
        guard.guardingTarget = targetId;
        this.privateLog.push({ type: 'guard', player: guard.id, target: targetId });
      }
    }

    // 如果守卫只是出门（不使用守护能力）
    if (guard.nightAction === 'GO_OUT' && !guard.nightAbility?.guard) {
      guard.atHome = false;
      if (guard.nightTarget) {
        guard.currentHouse = guard.nightTarget;
      }
    }

    // 新增：守卫筑垒（加固目标屋子）
    if (guard.nightAbility?.fortify && guard.nightTarget) {
      guard.fortifiedTarget = guard.nightTarget;
      guard.currentHouse = guard.nightTarget;
      guard.atHome = false;
      this.privateLog.push({
        type: 'guard_fortify',
        player: guard.id,
        target: guard.nightTarget,
        msg: '守卫筑垒加固了目标屋子',
      });
    }

    // 新增：守卫巡逻（不护具体目标，巡视全村）
    if (guard.nightAbility?.patrol) {
      guard.patrolled = true;
      const wolfHouses = [];
      for (const p of this.players) {
        if (p.alive && p.isWolf() && p.nightAction === 'GO_OUT' && p.currentHouse !== p.id) {
          wolfHouses.push(p.currentHouse);
        }
      }
      this.privateLog.push({
        type: 'guard_patrol',
        player: guard.id,
        wolfVisitedHouses: wolfHouses,
        count: wolfHouses.length,
        msg: `守卫巡逻：${wolfHouses.length > 0 ? `发现${wolfHouses.length}间屋子有狼人进入` : '未发现异常'}`,
      });
    }

    // 新增：守卫舍身（标记替死目标）
    if (guard.nightAbility?.sacrifice && guard.nightTarget) {
      guard.sacrificeTarget = guard.nightTarget;
      this.privateLog.push({
        type: 'guard_sacrifice',
        player: guard.id,
        target: guard.nightTarget,
        msg: '守卫立下舍身誓言：若目标死亡，愿替其死',
      });
    }
  }

  // ==========================================
  //  4. 狼人群（随机顺序）
  // ==========================================
  resolveWerewolves() {
    // 所有蚀者阵营：普通狼人 + 已变狼/已感染的种狼（参与协同）
    const wolves = this.players.filter(p =>
      p.alive &&
      (p.role === ROLES.CORRUPTED ||
       (p.role === ROLES.NETHER_MONK && (p.isTransformed || p.hasUsedInfect)))
    );

    if (wolves.length === 0) return;

    // 随机打乱蚀者噬灵顺序
    this.shuffleArray(wolves);

    // 收集所有狼人的击杀目标
    const killTargets = new Map(); // targetId -> [wolfIds]

    for (const wolf of wolves) {
      if (wolf.nightAction === 'SLEEP') continue;

      // 新增：狼人嚎叫召集
      if (wolf.nightAction === 'HOWL') {
        wolf.howled = true;
        wolf.howlCooldown = 2; // 冷却2回合
        this.privateLog.push({
          type: 'wolf_howl',
          player: wolf.id,
          msg: '狼人发出嚎叫——同伴们听到了召唤',
        });
        // 通知所有未相认的狼人
        for (const otherWolf of wolves) {
          if (otherWolf.id !== wolf.id && !otherWolf.knownWolves.includes(wolf.id)) {
            this.privateLog.push({
              type: 'wolf_howl_heard',
              player: otherWolf.id,
              howler: wolf.id,
              msg: '你听到了同伴的嚎叫——有人在召唤你',
            });
          }
        }
        continue; // 嚎叫的狼人今晚不刀人
      }

      // 新增：狼人伪装（计入屋子人数）
      if (wolf.nightAction === 'DISGUISE') {
        wolf.disguised = true;
        wolf.atHome = false;
        if (wolf.nightTarget) {
          wolf.currentHouse = wolf.nightTarget;
        }
        this.privateLog.push({
          type: 'wolf_disguise',
          player: wolf.id,
          msg: '狼人伪装成好人，混入人群中',
        });
        continue; // 伪装的狼人今晚不刀人
      }

      // 狼人出门
      if (wolf.nightAction === 'GO_OUT') {
        wolf.atHome = false;
        if (wolf.nightTarget) {
          wolf.currentHouse = wolf.nightTarget;
          // 检查是否去了另一个狼人家 → 相认
          const houseOwner = this.players.find(p => p.id === wolf.nightTarget);
          if (houseOwner && houseOwner.isWolf() && houseOwner.alive) {
            if (!wolf.knownWolves.includes(houseOwner.id)) {
              wolf.knownWolves.push(houseOwner.id);
              wolf.wolvesOpenEyesTogether.push(houseOwner.id);
              houseOwner.knownWolves.push(wolf.id);
              houseOwner.wolvesOpenEyesTogether.push(wolf.id);
              this.privateLog.push({ type: 'wolf_meet', wolves: [wolf.id, houseOwner.id] });
            }
          }
        }
      }

      // 新增：嗅觉追踪（刀人时记录目标的去向）
      if (wolf.nightAbility?.trackScent && wolf.nightTarget) {
        const target = this.players.find(p => p.id === wolf.nightTarget && p.alive);
        if (target && target.nightAction === 'GO_OUT' && target.currentHouse !== target.id) {
          wolf.scentTrail.push({
            target: wolf.nightTarget,
            house: target.currentHouse,
            round: this.game.round,
          });
          this.privateLog.push({
            type: 'wolf_scent_track',
            player: wolf.id,
            target: wolf.nightTarget,
            house: target.currentHouse,
            msg: `嗅觉追踪：目标去了 ${target.currentHouse} 的屋子`,
          });
        }
      }

      // 狼人刀人（锁定人，不是锁定屋子）
      if (wolf.nightAbility?.kill) {
        const targetId = wolf.nightTarget;
        // 狼人刀人是跟着人走 —— 目标锁定为人
        if (targetId) {
          if (!killTargets.has(targetId)) {
            killTargets.set(targetId, []);
          }
          killTargets.get(targetId).push(wolf.id);
          wolf.wolfKillTarget = targetId;
        }
      }
    }

    // 处理狼人互刀：如果两个狼人互刀 → 相认；如果一方刀另一方 → 被杀
    for (const [targetId, killers] of killTargets) {
      const target = this.players.find(p => p.id === targetId);
      if (!target || !target.alive) continue;

      // 被刀的目标也是狼人
      if (target.isWolf() && target.wolfKillTarget) {
        // 检查是否互刀
        const mutualKill = killers.some(wolfId => target.wolfKillTarget === wolfId);
        if (mutualKill) {
          // 互刀 → 相认，不死
          for (const wolfId of killers) {
            const wolf = this.players.find(p => p.id === wolfId);
            if (wolf && !wolf.knownWolves.includes(targetId)) {
              wolf.knownWolves.push(targetId);
              wolf.wolvesOpenEyesTogether.push(targetId);
            }
          }
          if (!target.knownWolves.includes(killers[0])) {
            target.knownWolves.push(killers[0]);
            target.wolvesOpenEyesTogether.push(killers[0]);
          }
          this.privateLog.push({ type: 'wolf_mutual_kill', wolves: [...killers, targetId] });
          // 移除击杀
          killTargets.delete(targetId);
          for (const wolfId of killers) {
            const wolf = this.players.find(p => p.id === wolfId);
            if (wolf) wolf.wolfKillTarget = null;
          }
          target.wolfKillTarget = null;
        }
      }
    }

    // 存储击杀目标供结算阶段使用
    this.wolfKills = killTargets;
  }

  // ==========================================
  //  5. 察灵家
  // ==========================================
  resolveSeer() {
    const seer = this.players.find(p => p.role === ROLES.VEIL_SCHOLAR && p.alive);
    if (!seer || seer.nightAction === 'SLEEP' || !seer.nightTarget) return;

    const targetId = seer.nightTarget;
    const target = this.players.find(p => p.id === targetId && p.alive);
    if (!target) return;

    // 出门
    if (seer.nightAction === 'GO_OUT') {
      seer.currentHouse = targetId;
      seer.atHome = false;
    }

    // 查验
    if (seer.nightAbility?.check) {
      // 判断逻辑：
      // - 普通狼人：是狼
      // - 种狼：变狼后是狼；使用感染后是狼；未变狼未感染 → 好人
      // - 假身份：种狼有fakeIdentity时显示为该神职
      let isGood = true;
      if (target.role === ROLES.CORRUPTED) {
        isGood = false;
      } else if (target.role === ROLES.NETHER_MONK) {
        const isWolf = target.isTransformed || target.hasUsedInfect;
        if (!isWolf && target.fakeIdentity) {
          // 假身份编织：查验结果显示为伪装的神职
          seer.checkResult = `FAKE_${target.fakeIdentity}`;
          this.privateLog.push({
            type: 'seer_check_fake',
            player: seer.id,
            target: targetId,
            fakeRole: target.fakeIdentity,
            msg: `查验结果：${target.fakeIdentity}（但真相隐藏在更深处...）`,
          });
          return; // 特殊处理，不走正常逻辑
        }
        isGood = !isWolf;
      }
      // 被感染但尚未生效的不算狼人

      // 被感染察灵家：查验结果反转（狼→好人，好人→狼）
      if (seer.infectedByAlpha) {
        isGood = !isGood;
      }

      seer.checkResult = isGood ? 'GOOD' : 'WOLF';
      this.privateLog.push({
        type: 'seer_check',
        player: seer.id,
        target: targetId,
        result: seer.checkResult,
        reversed: !!seer.infectedByAlpha,
      });
    }

    // 新增：梦境碎片（额外模糊线索）
    if (seer.nightAbility?.dreamFragment && seer.nightTarget) {
      const fragments = [
        '梦境中你看到有人影在目标屋外徘徊...',
        '梦的碎片里，你听到目标屋内传来不寻常的声响...',
        '你在梦中感受到一股不安——目标的命运与今晚紧密相连...',
      ];
      seer.dreamFragment = fragments[Math.floor(Math.random() * fragments.length)];
      this.privateLog.push({
        type: 'seer_dream',
        player: seer.id,
        fragment: seer.dreamFragment,
      });
    }

    // 新增：灵视（查验已死的玩家）
    if (seer.nightAbility?.spiritVision && seer.spiritVisionTarget) {
      const deadTarget = this.players.find(p => p.id === seer.spiritVisionTarget && !p.alive);
      if (deadTarget) {
        seer.checkResult = `SPIRIT_${deadTarget.role}`;
        this.privateLog.push({
          type: 'seer_spirit_vision',
          player: seer.id,
          target: deadTarget.id,
          role: deadTarget.role,
          msg: `灵视：死者 ${deadTarget.name || deadTarget.id} 的真实身份是 ${deadTarget.role}`,
        });
      }
    }
  }

  // ==========================================
  //  6. 毒巫（蚀灭符阵 + 灵符）
  // ==========================================
  resolvePoisonWitch() {
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
      const guard = peopleInHouse.find(p => p.role === ROLES.VEIL_GUARDIAN);
      if (peopleInHouse.length >= 3 && guard) {
        guard.heavyInjury = true;
        guard.whoKnowsGuardHeavyInjury = [guard.id, pw.id];
        this.privateLog.push({ type: 'guard_heavy_injury', player: guard.id, source: 'mass_seal' });
        // 灵蚀重伤，其余人被毒死
        for (const p of peopleInHouse) {
          if (p.id !== guard.id && p.alive) {
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

    // 毒巫的灵符（不能治疗灵蚀重伤）
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
        msg: '毒巫在目标屋子释放了蚀雾——下一晚进入的人将中毒',
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
  //  7. 药巫（万能药 + 单目标毒药）
  // ==========================================
  resolveHealWitch() {
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
          target.whoKnowsGuardHeavyInjury = [];
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
            this.markForDeath(firstEntrant.id, 'heal_witch_poison');
            this.log.push({ type: 'seal_transferred', original: targetId, actual: firstEntrant.id });
          }
        } else {
          this.markForDeath(targetId, 'heal_witch_poison');
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
            msg: '药巫战场急救成功——目标存活但暂时无法行动',
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
        msg: '药巫在自己的药草园种下了种子——下一回合可收获',
      });
    }

    // 新增：诊断（获知目标状态而不使用药）
    if (hw.nightAbility?.diagnose && hw.nightTarget) {
      const diagTarget = this.players.find(p => p.id === hw.nightTarget && p.alive);
      if (diagTarget) {
        hw.diagnoseResult = {
          isMarkedForDeath: this.deathMarks.has(diagTarget.id),
          heavyInjury: diagTarget.heavyInjury,
          infectedByAlpha: diagTarget.infectedByAlpha,
          willBecomeWolf: diagTarget.willBecomeWolf,
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
  //  8. 村民（所有神和狼行动完后行动）
  // ==========================================
  resolveWeaver() {
    const villagers = this.players.filter(p =>
      p.role === ROLES.SPIRIT_WEAVER && p.alive
    );
    if (villagers.length === 0) return;

    for (const villager of villagers) {
      if (!villager.nightAction || villager.nightAction === 'SLEEP') continue;

      // 村民出门去别人家
      if (villager.nightAction === 'GO_OUT' && villager.nightTarget) {
        villager.currentHouse = villager.nightTarget;
        villager.atHome = false;
      }

      // 老猎人村民：直觉 + 陷阱
      if (villager.weaverType === SPIRIT_WEAVER_TYPES.OLD_VETERAN) {
        if (villager.nightAction === 'TRAP_SET') {
          villager.doorFortified = true;
          this.privateLog.push({
            type: 'old_hunter_trap',
            player: villager.id,
            msg: '老猎人在自家设下了陷阱',
          });
        }
      }

      // 旅行商人村民：双访问
      if (villager.weaverType === SPIRIT_WEAVER_TYPES.WANDERING_TRADER) {
        if (villager.nightAbility?.secondVisit && villager.nightAbility.secondTarget) {
          // 第二个访问目标（不触发额外效果，仅收集信息）
          this.privateLog.push({
            type: 'merchant_double_visit',
            player: villager.id,
            firstTarget: villager.nightTarget,
            secondTarget: villager.nightAbility.secondTarget,
            msg: `商人访问了两个屋子`,
          });
        }
        // 交易信息
        if (villager.nightAction === 'TRADE_INFO' && villager.nightTarget) {
          this.privateLog.push({
            type: 'trade_info',
            player: villager.id,
            target: villager.nightTarget,
            msg: '商人发起了信息交易',
          });
        }
      }

      // 草药师村民：草药
      if (villager.weaverType === SPIRIT_WEAVER_TYPES.SPIRIT_APPRENTICE) {
        if (villager.nightAction === 'HERBAL_REMEDY' && villager.nightTarget) {
          villager.herbalRemedyUsed = true;
          villager.herbalRemedyTarget = villager.nightTarget;
          this.privateLog.push({
            type: 'herbal_remedy',
            player: villager.id,
            target: villager.nightTarget,
            msg: '草药师使用了草药——若目标今晚死亡，可推迟1回合',
          });
        }
      }

      // 守夜人村民：守夜
      if (villager.weaverType === SPIRIT_WEAVER_TYPES.NIGHT_SENTINEL) {
        if (villager.nightAction === 'NIGHT_WATCH') {
          // 获知今晚出门的总人数
          const outCount = this.players.filter(p => p.alive && p.nightAction === 'GO_OUT').length;
          villager.nightWatchAlert = { outCount, round: this.game.round };
          this.privateLog.push({
            type: 'night_watch',
            player: villager.id,
            outCount,
            msg: `守夜灵织者：今晚有 ${outCount} 人出门`,
          });
        }
      }

      // 铁匠村民：加固门锁
      if (villager.weaverType === SPIRIT_WEAVER_TYPES.ARMOR_SMITH) {
        if (villager.nightAction === 'FORTIFY_DOOR') {
          villager.doorFortified = true;
          this.privateLog.push({
            type: 'blacksmith_fortify',
            player: villager.id,
            msg: '铁匠加固了自家门锁——可抵御一次蚀者噬灵',
          });
        }
      }

      // 织幕灵织者：帷幕低语更精确
      if (villager.weaverType === SPIRIT_WEAVER_TYPES.VEIL_WEAVER) {
        if (villager.nightAction === 'EAVESDROP' && villager.nightTarget) {
          // 织网：排除干扰项（50%概率给出精确信息而非模糊线索）
          const accurateResult = this._accurateEavesdrop(villager.nightTarget);
          this.privateLog.push({
            type: 'eavesdrop_accurate',
            player: villager.id,
            target: villager.nightTarget,
            result: accurateResult,
            msg: `精确帷幕低语: ${accurateResult}`,
          });
          continue;
        }
      }

      // 灵织低语（通用逻辑，非织布女）
      if (villager.nightAction === 'EAVESDROP' && villager.nightTarget) {
        const result = this._eavesdropResult(villager.nightTarget);
        this.privateLog.push({
          type: 'eavesdrop',
          player: villager.id,
          target: villager.nightTarget,
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

    const hasWolf = peopleInHouse.some(p => p.isWolf());
    const hasGod = peopleInHouse.some(p => p.isGod());
    const hasWeaver = peopleInHouse.some(p => p.isWeaver());

    const clues = [];
    if (hasWolf) clues.push(`你清楚地听到了狼的呼吸声——屋里有狼人`);
    if (hasGod) clues.push(`你听到了法器碰撞的声音——屋里有神职`);
    if (hasWeaver) clues.push(`你听到了平常人的脚步声——屋里有村民`);
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
    const hasWolf = peopleInHouse.some(p => p.isWolf());
    const hasGod = peopleInHouse.some(p => p.isGod());
    const hasWeaver = peopleInHouse.some(p => p.isWeaver());
    const total = peopleInHouse.length;

    // 根据屋内实际成员构建候选结果池
    const candidates = [];

    if (hasWolf) {
      candidates.push('听到低沉的狼嚎声...');
      candidates.push('听到野兽般的呼吸声...');
    }
    if (hasGod) {
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
    const guard = this.players.find(p => p.role === ROLES.VEIL_GUARDIAN && p.alive);
    const poisonWitch = this.players.find(p => p.role === ROLES.HERBAL_SAGE && p.alive);

    if (this.wolfKills) {
      for (const [targetId, killers] of this.wolfKills) {
        if (killers.length === 0) continue;
        const target = this.players.find(p => p.id === targetId && p.alive);
        if (!target) continue;

        // 狼人跟着目标去击杀（目标锁定为人）
        if (guard && guard.isGuarding) {
          // 检查守卫是否在当前被攻击目标所在屋子
          const targetHouse = target.currentHouse || target.id;
          const peopleInHouse = this.getPeopleInHouse(targetHouse);
          const peopleCount = peopleInHouse.length;

          if (peopleInHouse.includes(guard) && peopleCount >= 1 && peopleCount <= 2) {
            // 守卫守护的屋子有1-2人且被蚀者噬灵 → 灵蚀重伤
            guard.heavyInjury = true;
            guard.whoKnowsGuardHeavyInjury = [guard.id];
            if (poisonWitch) guard.whoKnowsGuardHeavyInjury.push(poisonWitch.id);
            this.privateLog.push({ type: 'guard_heavy_injury', player: guard.id, source: 'wolf_attack' });
            // 守卫挡下了攻击，目标不死
            continue;
          }
          if (peopleInHouse.includes(guard) && peopleCount >= 3 && killers.length >= 1) {
            // 人多时灵蚀重伤但目标可能还是死
            guard.heavyInjury = true;
            guard.whoKnowsGuardHeavyInjury = [guard.id];
            if (poisonWitch) guard.whoKnowsGuardHeavyInjury.push(poisonWitch.id);
            this.privateLog.push({ type: 'guard_heavy_injury', player: guard.id, source: 'wolf_attack_3plus' });
          }
        }

        // 检查守卫独自在家被一位蚀者噬灵
        if (guard && guard.nightAction === 'SLEEP' && targetId === guard.id && killers.length === 1) {
          guard.heavyInjury = true;
          guard.whoKnowsGuardHeavyInjury = [guard.id];
          if (poisonWitch) guard.whoKnowsGuardHeavyInjury.push(poisonWitch.id);
          // 狼人知道这是守卫
          const killer = this.players.find(p => p.id === killers[0]);
          if (killer) killer.knownGuard = guard.id;
          this.privateLog.push({ type: 'guard_heavy_injury_alone', player: guard.id, wolf: killers[0] });
          continue; // 灵蚀重伤但没死
        }

        // 检查猎人的短铳反击
        if (target.role === ROLES.FLAME_TRACKER && target.blunderbussUsable) {
          // 猎人用短火铳反杀攻击者
          for (const wolfId of killers) {
            this.markForDeath(wolfId, 'hunter_blunderbuss');
          }
          target.blunderbussUsable = false;
          this.log.push({ type: 'hunter_defend', player: target.id });
          continue; // 猎人不死
        }

        // 正常击杀
        this.markForDeath(targetId, 'wolf_kill');

        // 新增：铁匠加固门锁——抵御一次蚀者噬灵
        if (target.doorFortified && target.alive) {
          target.doorFortified = false; // 门锁被破坏
          this.reviveFromDeath(targetId);
          this.privateLog.push({
            type: 'blacksmith_door_blocked',
            player: target.id,
            msg: '铁匠的加固门锁挡住了狼人的攻击！但门锁已被破坏',
          });
        }

        // 新增：老猎人陷阱——狼人进入时有20%概率被发现
        if (target.weaverType === 'OLD_VETERAN' && target.doorFortified && Math.random() < 0.20) {
          for (const wolfId of killers) {
            if (!target.knownWolves) target.knownWolves = [];
            target.knownWolves.push(wolfId);
          }
          this.privateLog.push({
            type: 'old_hunter_detected',
            player: target.id,
            detectedWolves: killers,
            msg: '老猎人的陷阱触发了——你发现了进入你家的狼人！',
          });
        }
      }
    }

    // 新增：守卫舍身——替目标死亡
    for (const [targetId, reason] of this.deathMarks) {
      const guard = this.players.find(p =>
        p.role === ROLES.VEIL_GUARDIAN && p.alive && p.sacrificeTarget === targetId
      );
      if (guard) {
        this.reviveFromDeath(targetId);
        this.markForDeath(guard.id, 'guard_sacrifice');
        this.log.push({
          type: 'guard_sacrifice_death',
          guard: guard.id,
          savedTarget: targetId,
          msg: '守卫舍身替目标挡下了致命一击！',
        });
        this.privateLog.push({
          type: 'guard_sacrifice',
          player: guard.id,
          target: targetId,
          msg: '你履行了舍身誓言——目标活了下来',
        });
      }
    }

    // 新增：蚀雾延迟结算——上一晚设下的蚀雾本晚触发
    for (const p of this.players) {
      if (!p.alive) continue;
      // 找到毒巫的蚀雾
      const poisonWitch = this.players.find(pw =>
        pw.role === ROLES.HERBAL_SAGE && pw.corrosionMistActive && pw.corrosionMistTarget
      );
      if (poisonWitch && poisonWitch.corrosionMistTarget) {
        const peopleInFog = this.getPeopleInHouse(poisonWitch.corrosionMistTarget);
        for (const victim of peopleInFog) {
          if (victim.id !== poisonWitch.id && !this.deathMarks.has(victim.id)) {
            this.markForDeath(victim.id, 'corrosion_mist');
            this.log.push({
              type: 'corrosion_mist_triggered',
              target: victim.id,
              msg: '蚀雾陷阱触发——进入者中毒身亡',
            });
          }
        }
        poisonWitch.corrosionMistTarget = null;
        poisonWitch.corrosionMistActive = false;
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

    // --- 应用感染效果（延迟一晚上） ---
    for (const p of this.players) {
      if (p.willBecomeWolf && p.alive) {
        if (p.role === ROLES.VEIL_SCHOLAR) {
          // 察灵家保留能力不变狼，已在冥僧步骤中处理
          p.willBecomeWolf = false;
        } else {
          p.role = ROLES.CORRUPTED;
          p.team = 'WOLF';
          p.willBecomeWolf = false;
          p.infectedByAlpha = false;
          this.log.push({ type: 'became_wolf', player: p.id });
        }
      }
    }

    // --- 处理狼人相认（下回合共同睁眼） ---
    for (const p of this.players) {
      if (p.role === ROLES.CORRUPTED && p.wolvesOpenEyesTogether.length > 0) {
        this.privateLog.push({
          type: 'wolves_united',
          wolves: [p.id, ...p.wolvesOpenEyesTogether],
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
