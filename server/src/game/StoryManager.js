// ============================================================
// StoryManager — 叙事管理器
// 管理游戏中的叙事文本、背景故事加载、序幕演出
// 用于第二步"神话背景"系统
// ============================================================

import { WORLD_STORY, getCharacterStory, getCharacterQuote, getRandomPrologueExcerpt } from './WorldStory.js';
import { CHARACTER_IDENTITIES, MYTH_ORIGINS } from './constants.js';

export class StoryManager {
  constructor(game) {
    this.game = game;
    this.narratives = {};      // {playerId: personalNarrative}
    this.roundNarratives = []; // 每轮全局叙事事件
    this.prologueShown = false;
  }

  /**
   * 生成序幕文本（选完角色后展示）
   */
  generatePrologue() {
    return {
      title: WORLD_STORY.title,
      subtitle: WORLD_STORY.subtitle,
      excerpt: getRandomPrologueExcerpt(),
      chapter: this._getChapter('prologue'),
      playerNarratives: this.game.players
        .filter(p => p.characterId && p.alive)
        .map(p => ({
          playerId: p.id,
          playerName: p.name,
          characterId: p.characterId,
          story: p.characterId ? this._generatePersonalIntro(p) : null,
        })),
    };
  }

  /**
   * 为每个玩家生成个人引入叙事
   */
  _generatePersonalIntro(player) {
    const charDef = CHARACTER_IDENTITIES[player.characterId];
    if (!charDef) return null;

    return {
      characterName: charDef.name,
      characterTitle: charDef.title,
      origin: charDef.origin,
      intro: `你是<strong>${charDef.name}</strong>——${charDef.title}。${charDef.story}`,
      quote: WORLD_STORY.characterQuotes[player.characterId]?.select || '',
      hiddenRoleHint: this._getRoleHint(player.role),
    };
  }

  /**
   * 根据里身份给出模糊的叙事提示
   */
  _getRoleHint(role) {
    const hints = {
      CORRUPTED: '你感觉到体内有一种难以控制的饥渴。月亮在呼唤。',
      NETHER_MONK: '你比他们更强。你可以选择变化——或者传播变化。',
      VEIL_SCHOLAR: '你的眼睛在黑暗中看见别人看不见的东西。真相是一把双刃剑。',
      HERBAL_SAGE: '你的手指间藏着死亡与救赎。使用哪一个，取决于你的心。',
      SPIRIT_MENDER: '你的使命是治愈——但治愈有时意味着伤害那些伤害他人的人。',
      VEIL_GUARDIAN: '你的存在本身就是一堵墙。但每堵墙都有裂缝。',
      FLAME_TRACKER: '你的武器已经上膛。耐心——猎人在黑暗中等待。',
      VILLAGER: '你是普通人。但在这片土地上，普通人也有活下去的办法。',
    };
    return hints[role] || '你的命运还在迷雾之中。';
  }

  /**
   * 生成夜晚叙事
   */
  generateNightNarrative(round) {
    const roundTexts = [
      '第一夜——帷幕最薄弱的时刻。所有人都屏住了呼吸。',
      '第二夜——月亮更红了。有些东西在阴影中移动。',
      '第三夜——你开始习惯黑暗了。这是最危险的事。',
      '第四夜——帷幕在颤抖。有人听到了外面的声音——不是狼的嚎叫。',
      '第五夜——古老的月亮俯视着一切。它见过了太多这样的夜晚。',
    ];

    return {
      round,
      text: roundTexts[Math.min(round - 1, roundTexts.length - 1)] || `第${round}夜——这场游戏已经持续太久了。`,
      phase: 'NIGHT',
    };
  }

  /**
   * 生成白天叙事
   */
  generateDayNarrative(round, deathCount) {
    if (deathCount === 0) {
      return {
        round,
        text: '天亮得反常。没有人死——这意味着今晚还会继续。',
        mood: 'uneasy',
      };
    }
    if (deathCount === 1) {
      return {
        round,
        text: '天亮了。少了一个人。其他人交换着怀疑的目光。',
        mood: 'tense',
      };
    }
    return {
      round,
      text: `天亮了。少了${deathCount}个人。恐慌在空气中蔓延。`,
      mood: 'panic',
    };
  }

  /**
   * 生成结局叙事
   */
  generateEnding(winner, players, round) {
    if (winner === 'VILLAGE') {
      return {
        title: '曙光',
        subtitle: '守幕者阵营胜利',
        text: `经过${round}个夜晚，最后一只狼倒下了。帷幕暂时平静下来——但没人知道下一次它何时会再次变薄。幸存者们互相看着对方，眼中既有庆幸，也有愧疚。他们为了活下来，牺牲了太多人。而明天，太阳还是会照常升起。帷幕之外，混沌仍在呼吸。但至少在帷幕之内，今天，人类赢了。`,
        mood: 'bittersweet',
      };
    }

    return {
      title: '永夜',
      subtitle: '蚀者阵营胜利',
      text: `狼嚎在帷幕之地回荡，最后一个反抗者倒下了。但这并不是狼人想要的胜利——他们只是变回了自己的本质。芬里尔的血脉、吕卡翁的诅咒、罗慕路斯的宿命——所有这些在今晚汇合。帷幕之外，有什么东西在发出满足的叹息。也许这场游戏从来就不是人类的游戏。也许它从来就是一场——狩猎。`,
      mood: 'dark',
    };
  }

  /**
   * 生成角色死亡叙事
   */
  generateDeathNarrative(player, causeOfDeath) {
    const charName = player.characterId
      ? CHARACTER_IDENTITIES[player.characterId]?.name
      : (player.weaverName || player.name);

    const deathTexts = {
      wolf_kill: `${charName}的尸体在清晨被发现——喉咙被撕开，屋子里的血迹已经干了。`,
      mass_seal: `${charName}的屋子里弥漫着毒药的气味。整个屋子的人都死了。`,
      heal_witch_poison: `${charName}死了。毒药精确地击中了他。`,
      hunter_rifle: `一声枪响惊醒了村庄。${charName}倒在了血泊中——子弹穿过心脏。`,
      hunter_blunderbuss: `${charName}试图攻击不该攻击的人。短火铳的响声就是他的丧钟。`,
      vote: `${charName}被众人的票数吊死在了广场的古树上。没有人敢看他的眼睛。`,
    };

    return {
      playerId: player.id,
      characterName: charName,
      cause: causeOfDeath,
      text: deathTexts[causeOfDeath] || `${charName}死了。又一个灵魂被帷幕吞没。`,
    };
  }

  /**
   * 生成角色使用能力的叙事文本
   */
  generateAbilityNarrative(player, abilityType, target) {
    const charName = player.characterId
      ? CHARACTER_IDENTITIES[player.characterId]?.name
      : (player.weaverName || player.name);

    const abilityTexts = {
      seer_check: `${charName}闭上眼睛，在黑暗中看到了幻象——关于某个人的真相。`,
      guard_protect: `${charName}站在门口，像一堵墙一样。今晚，没人能通过这里。`,
      wolf_kill: `${charName}的指甲变长了。血的味道引导着他穿过黑暗的村庄。`,
      poison_deploy: `${charName}取出了藏在袖子里的毒药。一整间屋子的人都将在睡梦中离开。`,
      heal_deploy: `${charName}的手指发出微弱的绿光。万能药的气味弥漫在空气中。`,
    };

    return abilityTexts[abilityType] || `${charName}在黑暗中行动了。`;
  }

  /**
   * 获取章节文本
   */
  _getChapter(chapterName) {
    return WORLD_STORY[chapterName] || '';
  }

  /**
   * 获取神话来源的描述
   */
  getOriginDescription(origin) {
    const descriptions = {
      [MYTH_ORIGINS.NORSE]: '来自北方冻土的传说——诸神、巨人、与世界树。',
      [MYTH_ORIGINS.CELTIC]: '来自翡翠岛的古老信仰——德鲁伊、圣林、与自然之灵。',
      [MYTH_ORIGINS.GREEK]: '来自爱琴海岸的神话——英雄、命运、与不可违抗的察灵。',
      [MYTH_ORIGINS.EGYPTIAN]: '来自尼罗河畔的智慧——冥界、审判、与永恒的真理。',
      [MYTH_ORIGINS.ROMAN]: '来自七丘之城的传奇——文明、狼、与聚落导师的宿命。',
      [MYTH_ORIGINS.EASTERN]: '来自东方大地的智慧——禅意、俳句、与沉默的力量。',
      [MYTH_ORIGINS.FOLK]: '来自民间的故事——普通人身上藏着不普通的勇气。',
    };
    return descriptions[origin] || '来自未知之地的传说。';
  }

  /**
   * 将背景故事匹配给玩家（分配未使用的表层身份）
   */
  assignCharactersToPlayers(availableCharacterIds) {
    const shuffled = [...availableCharacterIds].sort(() => Math.random() - 0.5);
    const unassignedPlayers = this.game.players.filter(p => !p.characterId && p.alive);

    for (let i = 0; i < Math.min(unassignedPlayers.length, shuffled.length); i++) {
      const player = unassignedPlayers[i];
      const charId = shuffled[i];
      player.characterId = charId;

      const charDef = CHARACTER_IDENTITIES[charId];
      if (charDef) {
        player.characterTraits = charDef.externalTraits.map(t => ({
          ...t,
          active: true,
          usedThisRound: false,
        }));
      }

      // 初始化个人叙事
      this.narratives[player.id] = {
        intro: this._generatePersonalIntro(player),
        keyEvents: [],
        ending: null,
      };
    }
  }

  /**
   * 记录叙事事件
   */
  recordNarrativeEvent(playerId, eventType, data) {
    if (!this.narratives[playerId]) {
      this.narratives[playerId] = { keyEvents: [] };
    }
    this.narratives[playerId].keyEvents.push({
      type: eventType,
      data,
      round: this.game.round,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取玩家个人叙事总结
   */
  getPersonalNarrativeSummary(playerId) {
    const narrative = this.narratives[playerId];
    if (!narrative) return null;

    const player = this.game.getPlayer(playerId);
    const charName = player?.characterId
      ? CHARACTER_IDENTITIES[player.characterId]?.name
      : (player?.weaverName || player?.name || '未知');

    return {
      playerId,
      characterName: charName,
      intro: narrative.intro,
      events: narrative.keyEvents,
      ending: narrative.ending,
      survived: player?.alive || false,
      role: player?.role || null,
    };
  }
}
