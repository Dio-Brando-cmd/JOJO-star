// ============================================================
// 夜晚行动结算器 —— 按固定顺序处理所有夜间行动
// ============================================================

import { ROLES, NIGHT_STEPS } from './constants.js';

export class NightResolver {
  constructor(game) {
    this.game = game;
    this.players = game.players;
    this.log = [];           // 夜晚日志（公开）
    this.privateLog = [];    // 夜晚日志（仅相关角色可见）
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
      if (p.nightAction === 'GO_OUT' && p.nightTarget) {
        const targetHouse = p.nightTarget;
        const visitors = this.players.filter(v => {
          if (!v.alive || v.id === targetHouse) return false;
          return (v.currentHouse || v.id) === targetHouse;
        });
        const count = visitors.length;

        // 村民因人数过多被赶回家时只显示"很多人"
        let countDisplay;
        if (p.role === 'VILLAGER' && count >= 3) {
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
      [NIGHT_STEPS.HUNTER]: () => this.resolveHunter(),
      [NIGHT_STEPS.ALPHA_WOLF]: () => this.resolveAlphaWolf(),
      [NIGHT_STEPS.GUARD]: () => this.resolveGuard(),
      [NIGHT_STEPS.WEREWOLF]: () => this.resolveWerewolves(),
      [NIGHT_STEPS.SEER]: () => this.resolveSeer(),
      [NIGHT_STEPS.POISON_WITCH]: () => this.resolvePoisonWitch(),
      [NIGHT_STEPS.HEAL_WITCH]: () => this.resolveHealWitch(),
    };

    const handler = handlers[step];
    if (handler) await handler();
  }

  // ==========================================
  //  1. 猎人（第二晚起第一个行动）
  // ==========================================
  resolveHunter() {
    const hunter = this.players.find(p => p.role === ROLES.HUNTER && p.alive);
    if (!hunter || !hunter.nightAction) return;

    // 处理短火铳腐蚀（带出门一晚上后腐蚀）
    if (hunter.blunderbussUsable && hunter.nightAction === 'GO_OUT') {
      hunter.blunderbussUsable = false;
      this.privateLog.push({ type: 'blunderbuss_corroded', player: hunter.id, msg: '短火铳已腐蚀' });
    }
    if (hunter.rifleUsable && hunter.nightAction !== 'GO_OUT') {
      hunter.rifleUsable = false;
      this.privateLog.push({ type: 'rifle_corroded', player: hunter.id, msg: '猎枪未带出门，已腐蚀' });
    }

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

    // 猎人使用猎枪射杀
    if (hunter.nightAbility?.useRifle && hunter.rifleUsable) {
      const targetId = hunter.nightAbility.rifleTarget;
      if (targetId) {
        this.log.push({ type: 'hunter_shoot', target: targetId, msg: '猎人开枪了！' });
        hunter.canShootNextNight = null; // 当晚射杀，清除追踪
      }
    }

    // 猎枪追踪：上一晚观察到的出门目标
    if (hunter.canShootNextNight && hunter.rifleUsable) {
      this.log.push({ type: 'hunter_shoot', target: hunter.canShootNextNight, msg: '猎人追踪射杀！' });
      hunter.canShootNextNight = null;
    }

    // 设置下一晚可追踪的目标
    if (hunter.observedTargetWentOut && hunter.observedTarget && !hunter.nightAbility?.useRifle) {
      hunter.canShootNextNight = hunter.observedTarget;
    }
  }

  // ==========================================
  //  2. 种狼
  // ==========================================
  resolveAlphaWolf() {
    const alpha = this.players.find(p => p.role === ROLES.ALPHA_WOLF && p.alive);
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
        // 感染预言家的特殊处理
        if (target.role === ROLES.SEER) {
          target.infectedByAlpha = true;
          target.willBecomeWolf = false; // 预言家保留能力，不变狼
          this.privateLog.push({ type: 'seer_infected', player: target.id, alphaId: alpha.id });
          // 种狼变为普通村民
          alpha.role = ROLES.VILLAGER;
          alpha.team = 'VILLAGE';
          alpha.isTransformed = false;
          this.privateLog.push({ type: 'alpha_to_villager', player: alpha.id });
        } else {
          target.infectedByAlpha = true;
          target.willBecomeWolf = true;
          this.privateLog.push({ type: 'infected', player: target.id, msg: '被种狼感染，下个夜晚变为狼人' });
        }
        alpha.hasUsedInfect = true;
        // 使用了感染后，当前夜晚种狼算作狼人（可被预言家查出）
        this.privateLog.push({ type: 'alpha_infected_visible', player: alpha.id });
      }
    }

    // 变狼后刀人
    if (ability.kill && alpha.isTransformed) {
      const targetId = alpha.nightTarget || ability.killTarget;
      const target = this.players.find(p => p.id === targetId && p.alive);
      if (target) {
        alpha.hasKilled = true;
        alpha.wolfKillTarget = targetId;
        // 加入狼人击杀目标列表，供 resolveAllDeaths 结算
        if (!this.wolfKills.has(targetId)) {
          this.wolfKills.set(targetId, []);
        }
        this.wolfKills.get(targetId).push(alpha.id);
        this.log.push({ type: 'wolf_kill', player: alpha.id, target: targetId });
      }
    }

    // 更新种狼的所在屋子（不计入人数）
    if (alpha.nightAction === 'GO_OUT' && alpha.nightTarget) {
      alpha.currentHouse = alpha.nightTarget;
      alpha.atHome = false;
    }
  }

  // ==========================================
  //  3. 守卫
  // ==========================================
  resolveGuard() {
    const guard = this.players.find(p => p.role === ROLES.GUARD && p.alive);
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
  }

  // ==========================================
  //  4. 狼人群（随机顺序）
  // ==========================================
  resolveWerewolves() {
    // 所有狼人阵营：普通狼人 + 已变狼/已感染的种狼（参与协同）
    const wolves = this.players.filter(p =>
      p.alive &&
      (p.role === ROLES.WEREWOLF ||
       (p.role === ROLES.ALPHA_WOLF && (p.isTransformed || p.hasUsedInfect)))
    );

    if (wolves.length === 0) return;

    // 随机打乱狼人行动顺序
    this.shuffleArray(wolves);

    // 收集所有狼人的击杀目标
    const killTargets = new Map(); // targetId -> [wolfIds]

    for (const wolf of wolves) {
      if (wolf.nightAction === 'SLEEP') continue;

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
  //  5. 预言家
  // ==========================================
  resolveSeer() {
    const seer = this.players.find(p => p.role === ROLES.SEER && p.alive);
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
      let isGood = true;
      if (target.role === ROLES.WEREWOLF) {
        isGood = false;
      } else if (target.role === ROLES.ALPHA_WOLF) {
        isGood = !(target.isTransformed || target.hasUsedInfect);
      }
      // 被感染但尚未生效的不算狼人

      seer.checkResult = isGood ? 'GOOD' : 'WOLF';
      this.privateLog.push({
        type: 'seer_check',
        player: seer.id,
        target: targetId,
        result: seer.checkResult,
      });
    }
  }

  // ==========================================
  //  6. 毒巫（烈性毒药 + 药水）
  // ==========================================
  resolvePoisonWitch() {
    const pw = this.players.find(p => p.role === ROLES.POISON_WITCH && p.alive);
    if (!pw || pw.nightAction === 'SLEEP') return;

    const ability = pw.nightAbility || {};

    // 出门
    if (pw.nightAction === 'GO_OUT' && pw.nightTarget) {
      pw.currentHouse = pw.nightTarget;
      pw.atHome = false;
    }

    // 烈性毒药：毒死一个屋子中所有人
    if (ability.lethalPoison) {
      const targetHouse = ability.lethalPoisonTarget; // 目标屋子（玩家ID）
      const peopleInHouse = this.getPeopleInHouse(targetHouse);

      // 检查守卫是否在屋子里（3人及以上且守卫在其中→守卫重伤）
      const guard = peopleInHouse.find(p => p.role === ROLES.GUARD);
      if (peopleInHouse.length >= 3 && guard) {
        guard.heavyInjury = true;
        guard.whoKnowsGuardHeavyInjury = [guard.id, pw.id];
        this.privateLog.push({ type: 'guard_heavy_injury', player: guard.id, source: 'lethal_poison' });
        // 守卫重伤，其余人被毒死
        for (const p of peopleInHouse) {
          if (p.id !== guard.id && p.alive) {
            this.markForDeath(p.id, 'lethal_poison');
          }
        }
      } else {
        // 全部毒死
        for (const p of peopleInHouse) {
          if (p.alive) {
            this.markForDeath(p.id, 'lethal_poison');
          }
        }
      }
      this.log.push({ type: 'lethal_poison', house: targetHouse });
    }

    // 毒巫的药水（不能治疗守卫重伤）
    if (ability.potion) {
      const targetId = ability.potionTarget;
      const target = this.players.find(p => p.id === targetId);
      // 检查 deathMarks（而非 !target.alive，因为死亡标记要到 RESOLUTION 步才应用）
      const isMarkedForDeath = this.deathMarks.has(targetId);
      if (target && isMarkedForDeath && !(target.role === ROLES.GUARD && target.heavyInjury)) {
        // 救人（但不能救重伤的守卫）
        this.reviveFromDeath(targetId);
        this.log.push({ type: 'potion_save', target: targetId });
      }
      pw.hasPotion = false;
    }
  }

  // ==========================================
  //  7. 药巫（万能药 + 单目标毒药）
  // ==========================================
  resolveHealWitch() {
    const hw = this.players.find(p => p.role === ROLES.HEAL_WITCH && p.alive);
    if (!hw || hw.nightAction === 'SLEEP') return;

    const ability = hw.nightAbility || {};

    // 出门
    if (hw.nightAction === 'GO_OUT' && hw.nightTarget) {
      hw.currentHouse = hw.nightTarget;
      hw.atHome = false;
    }

    // 万能药（可以治疗一切，包括守卫重伤）
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
      hw.hasPotion = false;
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
            this.log.push({ type: 'poison_transferred', original: targetId, actual: firstEntrant.id });
          }
        } else {
          this.markForDeath(targetId, 'heal_witch_poison');
        }
      }
      hw.hasPoison = false;
    }
  }

  // ==========================================
  //  最终结算：处理所有死亡 + 重伤
  // ==========================================
  resolveAllDeaths() {
    // --- 处理狼人击杀 ---
    if (this.wolfKills) {
      for (const [targetId, killers] of this.wolfKills) {
        if (killers.length === 0) continue;
        const target = this.players.find(p => p.id === targetId && p.alive);
        if (!target) continue;

        // 狼人跟着目标去击杀（目标锁定为人）
        // 守卫在自己家/别人家被攻击判定
        const guard = this.players.find(p => p.role === ROLES.GUARD && p.alive);
        if (guard && guard.isGuarding) {
          // 检查守卫是否在当前被攻击目标所在屋子
          const targetHouse = target.currentHouse || target.id;
          const peopleInHouse = this.getPeopleInHouse(targetHouse);
          const peopleCount = peopleInHouse.length;

          if (peopleInHouse.includes(guard) && peopleCount >= 1 && peopleCount <= 2) {
            // 守卫守护的屋子有1-2人且被狼人攻击 → 守卫重伤
            guard.heavyInjury = true;
            guard.whoKnowsGuardHeavyInjury = [guard.id];
            const poisonWitch = this.players.find(p => p.role === ROLES.POISON_WITCH && p.alive);
            if (poisonWitch) guard.whoKnowsGuardHeavyInjury.push(poisonWitch.id);
            this.privateLog.push({ type: 'guard_heavy_injury', player: guard.id, source: 'wolf_attack' });
            // 守卫挡下了攻击，目标不死
            continue;
          }
          if (peopleInHouse.includes(guard) && peopleCount >= 3 && killers.length >= 1) {
            // 人多时守卫重伤但目标可能还是死
            guard.heavyInjury = true;
            guard.whoKnowsGuardHeavyInjury = [guard.id];
            const poisonWitch = this.players.find(p => p.role === ROLES.POISON_WITCH && p.alive);
            if (poisonWitch) guard.whoKnowsGuardHeavyInjury.push(poisonWitch.id);
            this.privateLog.push({ type: 'guard_heavy_injury', player: guard.id, source: 'wolf_attack_3plus' });
          }
        }

        // 检查守卫独自在家被一位狼人攻击
        if (guard && guard.nightAction === 'SLEEP' && targetId === guard.id && killers.length === 1) {
          guard.heavyInjury = true;
          guard.whoKnowsGuardHeavyInjury = [guard.id];
          const poisonWitch = this.players.find(p => p.role === ROLES.POISON_WITCH && p.alive);
          if (poisonWitch) guard.whoKnowsGuardHeavyInjury.push(poisonWitch.id);
          // 狼人知道这是守卫
          const killer = this.players.find(p => p.id === killers[0]);
          if (killer) killer.knownGuard = guard.id;
          this.privateLog.push({ type: 'guard_heavy_injury_alone', player: guard.id, wolf: killers[0] });
          continue; // 守卫重伤但没死
        }

        // 检查猎人的短火铳反击
        if (target.role === ROLES.HUNTER && target.blunderbussUsable) {
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
      }
    }

    // --- 处理猎枪射杀 ---
    for (const entry of this.log) {
      if (entry.type === 'hunter_shoot' && entry.target) {
        this.markForDeath(entry.target, 'hunter_rifle');
      }
    }

    // --- 应用死亡标记 ---
    this.applyDeathMarks();

    // --- 应用感染效果（延迟一晚上） ---
    for (const p of this.players) {
      if (p.willBecomeWolf && p.alive) {
        if (p.role === ROLES.SEER) {
          // 预言家保留能力不变狼，已在种狼步骤中处理
          p.willBecomeWolf = false;
        } else {
          p.role = ROLES.WEREWOLF;
          p.team = 'WOLF';
          p.willBecomeWolf = false;
          p.infectedByAlpha = false;
          this.log.push({ type: 'became_wolf', player: p.id });
        }
      }
    }

    // --- 处理狼人相认（下回合共同睁眼） ---
    for (const p of this.players) {
      if (p.role === ROLES.WEREWOLF && p.wolvesOpenEyesTogether.length > 0) {
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
