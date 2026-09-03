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
      FLAME_TRACKER: '你的武器已经上膛。耐心——灵痕追猎者在黑暗中等待。',
      SPIRIT_WEAVER: '你是普通人。但在这片土地上，普通人也有活下去的办法。',
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
      '第四夜——帷幕在颤抖。有人听到了外面的声音——不是蚀者的共鸣。',
      '第五夜——古老的月亮俯视着一切。它见过了太多这样的夜晚。',
    ];
    const guidanceTexts = [
      '指引在你的耳边低语。它从不犯错，从不偏袒，从不疲惫。',
      '指引说：今晚，轮到谁了？',
      '你几乎能听见——那低语里，有一种近乎饥饿的耐心。',
      '指引从不催促。它只是，一直在。',
      '你忽然想：如果指引有一张脸，它会是什么表情？',
    ];

    return {
      round,
      text: roundTexts[Math.min(round - 1, roundTexts.length - 1)] || `第${round}夜——这场游戏已经持续太久了。`,
      guidance: guidanceTexts[Math.min(round - 1, guidanceTexts.length - 1)],
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
    if (winner === 'VEIL_KEEPERS') {
      return {
        title: '破晓',
        subtitle: '守幕者阵营胜利',
        text: `经过${round}个夜晚，最后一个蚀者倒下了。幸存者们在广场上相拥而泣，以为终于守住了什么。可是，那道每晚响起的"指引"，此刻仍在耳边低语——它在说："准备下一局。"月亮依旧血红，帷幕依旧安静。他们守住的，从来不是这个世界。他们只是，暂时还没轮到自己被吃。`,
        mood: 'bittersweet',
      };
    }

    return {
      title: '永夜',
      subtitle: '蚀者阵营胜利',
      text: `蚀痕蔓延到了村子的每一个角落，最后一个反抗者倒下了。但蚀者们没有欢呼——因为他们比谁都清楚：这份"胜利"，只是饥饿暂时得到了一点餍足。等月亮再次升起，饥饿会再一次回来。帷幕之外，那个东西发出了满足的、却依旧不满足的叹息。这场游戏，从来就没有赢家。`,
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
      corrupted_kill: `${charName}的尸体在清晨被发现——喉咙被撕开，屋子里的血迹已经干了。`,
      mass_seal: `${charName}的屋子里弥漫着毒药的气味。整个屋子的人都死了。`,
      spirit_mender_poison: `${charName}死了。毒药精确地击中了他。`,
      flame_tracker_rifle: `一声枪响惊醒了村庄。${charName}倒在了血泊中——子弹穿过心脏。`,
      flame_tracker_blunderbuss: `${charName}试图攻击不该攻击的人。短火铳的响声就是他的丧钟。`,
      vote: `${charName}被众人的票数吊死在了广场的古树上。没有人敢看他的眼睛。`,
    };
    const soulFates = {
      CORRUPTED: '他的蚀痕随死亡散去——但那股饥饿不会消失。它只是，换了一个宿主。',
      VEIL_KEEPERS: '他的灵焰熄灭了。最后一缕光，被帷幕悄悄吸走。',
    };

    return {
      playerId: player.id,
      characterName: charName,
      cause: causeOfDeath,
      text: deathTexts[causeOfDeath] || `${charName}死了。又一个灵魂被帷幕吞没。`,
      soulFate: soulFates[player.team] || '他的灵魂，成了帷幕之外那个东西的又一份食粮。',
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
      veil_scholar_check: `${charName}闭上眼睛，在黑暗中看到了幻象——关于某个人的真相。`,
      veil_guardian_protect: `${charName}站在门口，像一堵墙一样。今晚，没人能通过这里。`,
      corrupted_kill: `${charName}的指甲变长了。血的味道引导着他穿过黑暗的村庄。`,
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
      [MYTH_ORIGINS.ROMAN]: '来自七丘之城的传奇——文明、蚀者、与聚落导师的宿命。',
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
