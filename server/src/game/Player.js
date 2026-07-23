// ============================================================
// 玩家类 — v2.0 扩展版
// 新增：灵织者子类型、扩展能力状态、表层身份引用、特质状态
// ============================================================

import { ROLES, ROLE_TEAM, SPIRIT_WEAVER_TYPES } from './constants.js';

export class Player {
  constructor(id, name, role) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.alive = true;
    this.team = ROLE_TEAM[role];
    this.disconnected = false;
    this.isBot = false;
    this.hasLastWords = true;

    // ---- 位置状态 ----
    this.atHome = true;
    this.currentHouse = id;
    this.goingTo = null;

    // ---- 当晚行动 ----
    this.nightAction = null;
    this.nightTarget = null;
    this.nightAbility = null;

    // ---- 冥僧人特有 ----
    this.isTransformed = false;
    this.hasUsedInfect = false;
    this.hasKilled = false;
    this.infectedByAlpha = false;
    this.willBecomeWolf = false;
    // 新增：假身份编织
    this.fakeIdentity = null;          // 伪装的神职身份（被查验时显示为该身份）
    this.riftGuidanceBonus = 0;        // 狼群激素额外感染次数

    // ---- 守卫特有 ----
    this.guardingTarget = null;
    this.isGuarding = false;
    this.heavyInjury = false;
    this.whoKnowsGuardHeavyInjury = [];
    // 新增：筑垒/巡逻/舍身
    this.fortifiedTarget = null;       // 筑垒目标屋子
    this.patrolled = false;            // 是否巡逻过
    this.sacrificeTarget = null;       // 舍身替死目标

    // ---- 蚀者特有 ----
    this.knownWolves = [];
    this.wolvesOpenEyesTogether = [];
    this.wolfKillTarget = null;
    // 新增：嚎叫/伪装/嗅觉
    this.howled = false;               // 是否嚎叫过（冷却中）
    this.howlCooldown = 0;            // 嚎叫冷却回合
    this.disguised = false;            // 是否伪装中
    this.scentTrail = [];              // 嗅觉追踪记录 [{target, house}]

    // ---- 灵痕追猎者特有 ----
    this.canAct = false;
    this.hasRifle = false;
    this.hasBlunderbuss = false;
    this.rifleUsable = false;
    this.blunderbussUsable = false;
    this.observedTarget = null;
    this.observedTargetWentOut = false;
    this.canShootNextNight = null;
    // 新增：陷阱射击/复仇
    this.trapTarget = null;            // 陷阱设伏目标屋子
    this.revengeTarget = null;         // 复仇目标（投票出局时触发）

    // ---- 草药学者/愈灵师特有 ----
    this.hasHealTalisman = true;
    this.hasSealTalisman = true;
    this.talismanTarget = null;
    this.sealTarget = null;
    // 新增：蚀雾/配方
    this.corrosionMistTarget = null;       // 蚀雾符阵目标屋子
    this.corrosionMistActive = false;      // 蚀雾是否激活
    this.talismanMaterials = 2;          // 毒药材料（2材料→1蚀灭符阵，1材料→1普通毒药）

    // ---- 愈灵师特有 ----
    // (reuses hasHealTalisman, hasSealTalisman, talismanTarget, poisonTarget)
    // 新增：药草园/诊断
    this.talismanChargeStarted = false;    // 是否种植了药草
    this.talismanCharged = false;      // 药草是否可收获
    this.diagnoseTarget = null;        // 诊断目标
    this.diagnoseResult = null;        // 诊断结果

    // ---- 帷幕学者特有 ----
    this.checkTarget = null;
    this.checkResult = null;
    // 新增：梦境碎片/公开察灵/灵视
    this.dreamFragment = null;         // 梦境线索文本
    this.publicProphecyUsed = false;   // 公开察灵是否已使用（每局限1次）
    this.spiritVisionTarget = null;    // 灵视目标（查验死人）

    // ---- 灵织者特有 ----
    this.weaverIndex = -1;
    this.weaverType = null;          // 灵织者子类型（OLD_HUNTER / MERCHANT / ...）
    this.weaverName = null;          // 灵织者名字（如"老杰克"）
    this.weaverTitle = null;         // 灵织者称号（如"退休猎人"）
    // 灵织者扩展状态
    this.herbalRemedyUsed = false;     // 学徒灵织者：是否用过草药
    this.herbalRemedyTarget = null;    // 学徒灵织者：草药目标
    this.doorFortified = false;        // 锻甲灵织者：门锁是否加固
    this.nightWatchAlert = null;       // 守夜灵织者：门外的动静

    // ---- 表层身份（第二步使用） ----
    this.characterId = null;           // 选择的表层身份ID（如'SIGURD'）
    this.characterTraits = [];         // 该角色的外在特质列表
    this.traitCooldowns = {};          // 特质冷却追踪 {traitName: remainingCooldown}

    // ---- 体力/状态（第三步3D模式使用） ----
    this.stamina = 100;                // 体力（0-100）
    this.movementSpeed = 1.0;          // 移动速度倍率
    this.stealthLevel = 0;             // 隐匿等级（0-10）
    this.isSprinting = false;          // 是否在冲刺
    this.isHidden = false;             // 是否在藏匿中
    this.isInCombat = false;           // 是否在追逐战中
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
    this.talismanTarget = null;
    this.sealTarget = null;
    this.observedTarget = null;
    this.observedTargetWentOut = false;
    this.corrosionMistTarget = null;
    this.diagnoseTarget = null;
    this.diagnoseResult = null;
    this.dreamFragment = null;
    this.spiritVisionTarget = null;
    this.patrolled = false;
    this.sacrificeTarget = null;
    this.trapTarget = null;
    this.disguised = false;
    this.scentTrail = [];
    this.herbalRemedyTarget = null;
    this.nightWatchAlert = null;
    this.fortifiedTarget = null;
    // 注意：不重置持续状态（武器、重伤、已用道具、冷却等）
  }

  // 是否属于蚀者阵营
  isWolf() {
    return this.team === 'CORRUPTED';
  }

  // 是否是神职
  isGod() {
    return [ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER].includes(this.role);
  }

  // 是否是村民
  isWeaver() {
    return this.role === ROLES.SPIRIT_WEAVER;
  }

  // 获取当前所在屋子ID
  getHouse() {
    if (!this.alive) return null;
    return this.currentHouse || this.id;
  }

  // 是否应被计入屋子人数
  countInHouse() {
    if (!this.alive) return false;
    if ((this.role === ROLES.CORRUPTED || this.role === ROLES.NETHER_MONK) && this.nightAction === 'GO_OUT' && !this.disguised) {
      return false;
    }
    if (this.role === ROLES.VEIL_GUARDIAN && this.isGuarding) {
      return false;
    }
    return true;
  }

  // 获取村民类型特有能力的描述
  getWeaverAbilityDescription() {
    if (this.role !== ROLES.SPIRIT_WEAVER || !this.weaverType) return null;
    const descriptions = {
      [SPIRIT_WEAVER_TYPES.OLD_VETERAN]: '直觉：20%概率识别进入庇护所的蚀者。陷阱：可在家设陷阱。',
      [SPIRIT_WEAVER_TYPES.WANDERING_TRADER]: '双访问：每晚可访问2个屋子。交易：可交换信息。',
      [SPIRIT_WEAVER_TYPES.SPIRIT_APPRENTICE]: '草药：可推迟目标灵焰消散1蚀月。灵植辨识：感知谁被蚀灭符阵波及。',
      [SPIRIT_WEAVER_TYPES.CHRONICLER]: '雄辩：讨论发言时间翻倍。故事：可额外发言一次。',
      [SPIRIT_WEAVER_TYPES.NIGHT_SENTINEL]: '守夜：察觉自家门外经过者。暗哨：可选择不睡觉获知今晚出门人数。',
      [SPIRIT_WEAVER_TYPES.HEARTH_KEEPER]: '人缘：知道更多人的夜晚去向。炊烟：天亮时额外获知一条全村信息。',
      [SPIRIT_WEAVER_TYPES.ARMOR_SMITH]: '铁门：加固自家门锁，抵御一次蚀者噬灵。铁锤：被放逐时随机带走一名投票者。',
      [SPIRIT_WEAVER_TYPES.VEIL_WEAVER]: '织网：帷幕低语排除干扰项（准确率+50%）。丝线：可感知谁进入过自己的庇护所。',
    };
    return descriptions[this.weaverType] || null;
  }

  // 冷却管理
  setTraitCooldown(traitName, turns) {
    this.traitCooldowns[traitName] = turns;
  }

  tickCooldowns() {
    for (const key of Object.keys(this.traitCooldowns)) {
      if (this.traitCooldowns[key] > 0) {
        this.traitCooldowns[key]--;
      }
    }
    if (this.howlCooldown > 0) {
      this.howlCooldown--;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      alive: this.alive,
      role: this.role,
      atHome: this.atHome,
      currentHouse: this.currentHouse,
      heavyInjury: this.heavyInjury,
      isGuarding: this.isGuarding,
      // v2.0 新增公开信息
      characterId: this.characterId,
      weaverType: this.role === ROLES.SPIRIT_WEAVER ? this.weaverType : undefined,
      weaverName: this.role === ROLES.SPIRIT_WEAVER ? this.weaverName : undefined,
    };
  }

  toPrivateJSON() {
    const isWitch = this.role === ROLES.HERBAL_SAGE || this.role === ROLES.SPIRIT_MENDER;
    return {
      ...this.toJSON(),
      role: this.role,
      team: this.team,
      hasHealTalisman: isWitch ? this.hasHealTalisman : undefined,
      hasSealTalisman: isWitch ? this.hasSealTalisman : undefined,
      talismanMaterials: isWitch ? this.talismanMaterials : undefined,
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
      checkResult: this.checkResult,
      checkTarget: this.checkTarget,
      // v2.0 新增
      fakeIdentity: this.fakeIdentity,
      howlCooldown: this.howlCooldown,
      heavyInjury: this.heavyInjury,
      corrosionMistActive: this.corrosionMistActive,
      talismanCharged: this.talismanCharged,
      dreamFragment: this.dreamFragment,
      publicProphecyUsed: this.publicProphecyUsed,
      diagnoseResult: this.diagnoseResult,
      weaverType: this.weaverType,
      weaverName: this.weaverName,
      weaverTitle: this.weaverTitle,
      characterId: this.characterId,
      characterTraits: this.characterTraits,
      traitCooldowns: this.traitCooldowns,
      doorFortified: this.doorFortified,
      nightWatchAlert: this.nightWatchAlert,
      herbalRemedyUsed: this.herbalRemedyUsed,
      stamina: this.stamina,
      isInCombat: this.isInCombat,
    };
  }
}
