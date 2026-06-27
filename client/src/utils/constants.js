// ============================================================
// 客户端常量（与服务端保持一致）
// ============================================================

export const ROLES = {
  WEREWOLF: 'WEREWOLF',
  ALPHA_WOLF: 'ALPHA_WOLF',
  SEER: 'SEER',
  POISON_WITCH: 'POISON_WITCH',
  HEAL_WITCH: 'HEAL_WITCH',
  VILLAGER: 'VILLAGER',
  GUARD: 'GUARD',
  HUNTER: 'HUNTER',
};

export const ROLE_NAMES = {
  [ROLES.WEREWOLF]: '狼人',
  [ROLES.ALPHA_WOLF]: '种狼',
  [ROLES.SEER]: '预言家',
  [ROLES.POISON_WITCH]: '毒巫',
  [ROLES.HEAL_WITCH]: '药巫',
  [ROLES.VILLAGER]: '村民',
  [ROLES.GUARD]: '守卫',
  [ROLES.HUNTER]: '猎人',
};

export const ROLE_ICONS = {
  [ROLES.WEREWOLF]: '🐺',
  [ROLES.ALPHA_WOLF]: '👑🐺',
  [ROLES.SEER]: '🔮',
  [ROLES.POISON_WITCH]: '☠️🧪',
  [ROLES.HEAL_WITCH]: '💚🧪',
  [ROLES.VILLAGER]: '👨‍🌾',
  [ROLES.GUARD]: '🛡️',
  [ROLES.HUNTER]: '🔫',
};

export const TEAMS = {
  WOLF: 'WOLF',
  VILLAGE: 'VILLAGE',
};

export const TEAM_NAMES = {
  WOLF: '狼人阵营',
  VILLAGE: '好人阵营',
};

export const PHASES = {
  LOBBY: 'LOBBY',
  NIGHT: 'NIGHT',
  DAY: 'DAY',
  VOTE: 'VOTE',
  DISCUSSION: 'DISCUSSION',
  GAME_OVER: 'GAME_OVER',
};

export const NIGHT_STEPS = {
  HUNTER: 'HUNTER',
  ALPHA_WOLF: 'ALPHA_WOLF',
  GUARD: 'GUARD',
  WEREWOLF: 'WEREWOLF',
  SEER: 'SEER',
  POISON_WITCH: 'POISON_WITCH',
  HEAL_WITCH: 'HEAL_WITCH',
  VILLAGER: 'VILLAGER',
  RESOLUTION: 'RESOLUTION',
};

export const NIGHT_STEP_NAMES = {
  HUNTER: '猎人',
  ALPHA_WOLF: '种狼',
  GUARD: '守卫',
  WEREWOLF: '狼人',
  SEER: '预言家',
  POISON_WITCH: '毒巫',
  HEAL_WITCH: '药巫',
  VILLAGER: '村民',
  RESOLUTION: '结算',
};

export const NIGHT_ACTIONS = {
  GO_OUT: 'GO_OUT',
  USE_ABILITY: 'USE_ABILITY',
  SLEEP: 'SLEEP',
  EAVESDROP: 'EAVESDROP',
};
