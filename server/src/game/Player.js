// ============================================================
// 玩家类
// ============================================================

import { ROLES, ROLE_TEAM } from './constants.js';

export class Player {
  constructor(id, name, role) {
    this.id = id;             // 唯一ID
    this.name = name;         // 玩家名称
    this.role = role;         // 角色
    this.alive = true;        // 是否存活
    this.team = ROLE_TEAM[role]; // 阵营
    this.disconnected = false;    // 是否断线中

    // ---- 位置状态 ----
    this.atHome = true;                // 是否在家
    this.currentHouse = id;            // 当前所在屋子（默认自己家）
    this.goingTo = null;               // 今晚要去的屋子（目标玩家ID）

    // ---- 当晚行动 ----
    this.nightAction = null;           // GO_OUT | USE_ABILITY | SLEEP
    this.nightTarget = null;           // 行动目标
    this.nightAbility = null;          // 能力详情对象

    // ---- 种狼特有 ----
    this.isTransformed = false;        // 是否已变狼
    this.hasUsedInfect = false;        // 是否已使用感染
    this.hasKilled = false;            // 今晚是否已刀人（种狼）
    this.infectedByAlpha = false;      // 被种狼感染（下个夜晚生效）
    this.willBecomeWolf = false;       // 下个夜晚变为狼人

    // ---- 守卫特有 ----
    this.guardingTarget = null;        // 守卫目标
    this.isGuarding = false;           // 是否处于守护姿态
    this.heavyInjury = false;          // 重伤状态
    this.whoKnowsGuardHeavyInjury = []; // 知道守卫重伤的人

    // ---- 狼人特有 ----
    this.knownWolves = [];             // 已相认的狼人IDs
    this.wolvesOpenEyesTogether = [];  // 下回合共同睁眼的狼人
    this.wolfKillTarget = null;        // 今晚击杀目标

    // ---- 猎人特有 ----
    this.canAct = false;               // 是否可以行动（第二晚起）
    this.hasRifle = false;             // 是否携带猎枪
    this.hasBlunderbuss = false;       // 是否携带短火铳
    this.rifleUsable = false;          // 猎枪是否可用（带出门过）
    this.blunderbussUsable = false;    // 短火铳是否可用
    this.observedTarget = null;        // 观察目标
    this.observedTargetWentOut = false;// 观察目标是否出门
    this.canShootNextNight = null;     // 下一晚可射杀的目标

    // ---- 女巫特有 ----
    this.hasPotion = true;             // 是否有解药
    this.hasPoison = true;             // 是否有毒药
    this.potionTarget = null;          // 解药目标
    this.poisonTarget = null;          // 毒药目标

    // ---- 预言家特有 ----
    this.checkTarget = null;           // 查验目标
    this.checkResult = null;           // 查验结果

    // ---- 村民特有 ----
    this.villagerIndex = -1;           // 村民编号（用于区分）
  }

  // ---- 重置当晚状态 ----
  resetNightState() {
    this.atHome = true;
    this.currentHouse = this.id;
    this.goingTo = null;
    this.nightAction = null;
    this.nightTarget = null;
    this.nightAbility = null;
    this.guardingTarget = null;
    this.isGuarding = false;
    this.wolfKillTarget = null;
    this.checkTarget = null;
    this.checkResult = null;
    this.potionTarget = null;
    this.poisonTarget = null;
    this.observedTarget = null;
    this.observedTargetWentOut = false;
    // 注意：不重置武器状态、重伤状态等持续状态
  }

  // 是否属于狼人阵营
  isWolf() {
    return this.team === 'WOLF';
  }

  // 是否是神职
  isGod() {
    return [ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER].includes(this.role);
  }

  // 是否是村民
  isVillager() {
    return this.role === ROLES.VILLAGER;
  }

  // 获取当前所在屋子ID
  getHouse() {
    if (!this.alive) return null;
    return this.currentHouse || this.id;
  }

  // 是否应被计入屋子人数
  countInHouse() {
    if (!this.alive) return false;
    // 狼人出门不计入
    if ((this.role === ROLES.WEREWOLF || this.role === ROLES.ALPHA_WOLF) && this.nightAction === 'GO_OUT') {
      return false;
    }
    // 守护姿态的守卫不计入
    if (this.role === ROLES.GUARD && this.isGuarding) {
      return false;
    }
    return true;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      alive: this.alive,
      role: this.role,
      // 不暴露敏感状态给客户端
      atHome: this.atHome,
      currentHouse: this.currentHouse,
      heavyInjury: this.heavyInjury,
      isGuarding: this.isGuarding,
    };
  }

  // 返回只有自己可见的完整信息
  toPrivateJSON() {
    return {
      ...this.toJSON(),
      role: this.role,
      team: this.team,
      hasPotion: this.hasPotion,
      hasPoison: this.hasPoison,
      hasRifle: this.hasRifle,
      hasBlunderbuss: this.hasBlunderbuss,
      rifleUsable: this.rifleUsable,
      blunderbussUsable: this.blunderbussUsable,
      isTransformed: this.isTransformed,
      hasUsedInfect: this.hasUsedInfect,
      willBecomeWolf: this.willBecomeWolf,
      infectedByAlpha: this.infectedByAlpha,
      knownWolves: this.knownWolves,
      canShootNextNight: this.canShootNextNight,
    };
  }
}
