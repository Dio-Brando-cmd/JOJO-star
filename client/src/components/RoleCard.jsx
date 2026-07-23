// ============================================================
// 角色卡 — v2.0 扩展版
// 展示玩家自己的角色信息（含表层身份、村民类型、新能力状态）
// ============================================================

import React from 'react';
import { ROLES, ROLE_NAMES, ROLE_ICONS, TEAM_NAMES, VILLAGER_TYPE_NAMES } from '../utils/constants';
import RoleIllustration from './RoleIllustration';

export default function RoleCard({ privateState }) {
  const role = privateState?.myRole;
  const team = privateState?.myTeam;
  const pvt = privateState?.myPrivateState;

  if (!role) return null;

  return (
    <div className="role-card">
      <div className="role-card-header">
        <h4>🎭 你的身份</h4>
      </div>

      <div className="role-card-body">
        <RoleIllustration role={role} size="medium" showLabel={false} />
        <div className="role-card-info">
          <h3 className="role-name">{ROLE_NAMES[role]}</h3>
          <span className={`team-badge ${team}`}>{TEAM_NAMES[team]}</span>
          {/* 灵织者子类型显示 */}
          {pvt?.weaverType && (
            <span className="villager-type-badge">
              {VILLAGER_TYPE_NAMES[pvt.weaverType] || pvt.weaverType}
            </span>
          )}
          {pvt?.weaverName && (
            <span className="villager-name-badge">「{pvt.weaverName}」</span>
          )}
        </div>
      </div>

      {/* 表层身份（第二步使用） */}
      {pvt?.characterId && (
        <div className="role-card-character">
          <span className="section-label">🧬 表层身份</span>
          <span className="character-tag">{pvt.characterId}</span>
          {pvt?.characterTraits?.length > 0 && (
            <div className="character-traits">
              {pvt.characterTraits.map((t, i) => (
                <span key={i} className={`trait-tag trait-${t.type?.toLowerCase()}`} title={t.effect}>
                  {t.icon || ''} {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 角色详细信息 */}
      <div className="role-card-details">
        {pvt?.isTransformed && <span className="detail-tag wolf">🐺 已变狼</span>}
        {pvt?.hasUsedInfect && <span className="detail-tag wolf">🦠 已感染</span>}
        {pvt?.fakeIdentity && <span className="detail-tag wolf">🎭 伪装: {pvt.fakeIdentity}</span>}

        {(role === ROLES.HERBAL_SAGE || role === ROLES.SPIRIT_MENDER) && pvt?.hasHealTalisman !== undefined && (
          <span className="detail-tag heal">💊 解药: {pvt.hasHealTalisman ? '有' : '已用'}</span>
        )}
        {(role === ROLES.HERBAL_SAGE || role === ROLES.SPIRIT_MENDER) && pvt?.hasSealTalisman !== undefined && (
          <span className="detail-tag poison">🧪 毒药: {pvt.hasSealTalisman ? '有' : '已用'}</span>
        )}
        {role === ROLES.HERBAL_SAGE && pvt?.talismanMaterials !== undefined && (
          <span className="detail-tag poison">⚗️ 符材: {pvt.talismanMaterials}</span>
        )}
        {role === ROLES.SPIRIT_MENDER && pvt?.talismanCharged && (
          <span className="detail-tag heal">🌿 药草可收获</span>
        )}

        {pvt?.hasRifle && pvt?.rifleUsable && <span className="detail-tag hunter">🔫 猎枪可用</span>}
        {pvt?.hasBlunderbuss && pvt?.blunderbussUsable && <span className="detail-tag hunter">💥 短火铳可用</span>}

        {pvt?.willBecomeWolf && <span className="detail-tag warning">⚠️ 即将变狼</span>}
        {pvt?.canShootNextNight && <span className="detail-tag hunter">🎯 明晚可追踪</span>}
        {pvt?.heavyInjury && <span className="detail-tag danger">💔 重伤</span>}

        {/* 村民特有状态 */}
        {pvt?.doorFortified && <span className="detail-tag safe">🔒 门锁加固</span>}
        {pvt?.herbalRemedyUsed && <span className="detail-tag heal">🌿 草药已用</span>}
        {pvt?.nightWatchAlert && (
          <span className="detail-tag info">👁️ 出门: {pvt.nightWatchAlert.outCount}人</span>
        )}

        {/* 狼人特有状态 */}
        {pvt?.howlCooldown > 0 && <span className="detail-tag wolf">📢 嚎叫冷却: {pvt.howlCooldown}回合</span>}
        {pvt?.corrosionMistActive && <span className="detail-tag poison">🌫️ 蚀雾就绪</span>}

        {/* 察灵家特有状态 */}
        {pvt?.dreamFragment && <span className="detail-tag seer">🌙 梦境线索已获取</span>}
        {pvt?.publicProphecyUsed && <span className="detail-tag seer">📢 公开察灵已用</span>}
        {pvt?.diagnoseResult && <span className="detail-tag info">🔍 诊断完成</span>}

        {/* 特质冷却 */}
        {pvt?.traitCooldowns && Object.entries(pvt.traitCooldowns).map(([name, cd]) =>
          cd > 0 ? <span key={name} className="detail-tag cooldown">⏳ {name}: {cd}回合</span> : null
        )}

        {/* 3D模式状态 */}
        {pvt?.stamina !== undefined && (
          <span className="detail-tag info">⚡ 体力: {pvt.stamina}</span>
        )}
        {pvt?.isInCombat && <span className="detail-tag danger">⚔️ 追逐中</span>}
      </div>

      {/* 已知同伴 */}
      {pvt?.knownWolves?.length > 0 && (
        <div className="role-card-allies">
          <h5>🐺 已知同伴:</h5>
          {pvt.knownWolves.map(wid => (
            <span key={wid} className="ally-tag">{wid}</span>
          ))}
        </div>
      )}

      {/* 嗅觉追踪记录 */}
      {pvt?.scentTrail?.length > 0 && (
        <div className="role-card-allies">
          <h5>👃 嗅觉追踪:</h5>
          {pvt.scentTrail.map((st, i) => (
            <span key={i} className="ally-tag" title={`第${st.round || '?'}晚`}>
              {st.target} → 🏠{st.house}
            </span>
          ))}
        </div>
      )}

      {/* 私密日志 */}
      {privateState?.privateLog?.length > 0 && (
        <div className="role-card-log">
          <h5>📜 夜晚情报:</h5>
          {privateState.privateLog.map((entry, i) => (
            <div key={i} className="log-line">
              {formatPrivateLog(entry)}
            </div>
          ))}
        </div>
      )}

      {/* 背景故事提示（第二步） */}
      {pvt?.characterId && !privateState?.storyShown && (
        <div className="role-card-story-hint">
          <span>📖 点击查看 {pvt.characterId} 的背景故事</span>
        </div>
      )}
    </div>
  );
}

function formatPrivateLog(entry) {
  switch (entry.type) {
    // 察灵家相关
    case 'seer_check':
      return `🔮 查验结果: ${entry.result === 'GOOD' ? '好人 ✅' : entry.result === 'WOLF' ? '狼人 🐺' : entry.result}`;
    case 'seer_check_fake':
      return `🔮 查验结果: ${entry.fakeRole || '?'}（可疑——可能是假身份）`;
    case 'seer_dream':
      return `🌙 梦境碎片: ${entry.fragment || '模糊的幻象...'}`;
    case 'seer_spirit_vision':
      return `👻 灵视: 死者身份 — ${entry.role || '?'}`;

    // 狼人相关
    case 'wolf_meet':
      return '🐺 你感知到另一名蚀者！';
    case 'wolves_united':
      return '🐺 蚀者们已共鸣，下回合可协同行动';
    case 'wolf_mutual_kill':
      return '⚔️ 两名蚀者互噬，已相认';
    case 'wolf_howl':
      return '📢 你发出了嚎叫——同伴们听到了召唤';
    case 'wolf_howl_heard':
      return '📢 你听到了同伴的嚎叫——有人在召唤你';
    case 'wolf_disguise':
      return '🎭 你伪装成好人，混入人群中';
    case 'wolf_scent_track':
      return `👃 嗅觉追踪: 目标去了 🏠${entry.house || '?'}`;

    // 守卫相关
    case 'guard_heavy_injury':
      return '💔 守卫进入了重伤状态';
    case 'guard_heavy_injury_alone':
      return '💔 守卫独自在家被蚀者噬灵，重伤';
    case 'guard_heavy_injury_3plus':
      return '💔 守卫在多人屋内被袭，重伤';
    case 'guard_fortify':
      return `🏰 筑垒完成: ${entry.target || '?'} 的屋子已加固`;
    case 'guard_patrol':
      return `👀 巡逻: ${entry.count > 0 ? `发现${entry.count}间屋子有狼人` : '未发现异常'}`;
    case 'guard_sacrifice':
      return `💀 舍身誓言: 若 ${entry.target || '?'} 死亡，你将替其而死`;

    // 女巫相关
    case 'corrosion_mist_set':
      return `🌫️ 蚀雾已布设在 ${entry.target || '?'} 的屋子——明晚触发`;
    case 'heal_injury':
      return '💚 重伤已被万能药治愈';
    case 'battlefield_aid':
      return `🚑 战场急救: ${entry.target || '?'} 存活但暂时无法行动`;
    case 'herb_garden':
      return '🌿 药草已种下——下回合可收获额外解药';
    case 'diagnose':
      return `🔍 诊断: ${entry.msg || '结果已记录'}`;

    // 猎人相关
    case 'hunter_observe':
      return `🔍 观察到目标${entry.wentOut ? '出门了' : '没有出门'}`;
    case 'hunter_shoot':
      return `🔫 猎枪射击: ${entry.target || '?'}`;
    case 'hunter_trap':
      return `🪤 陷阱设在 ${entry.target || '?'} 的屋子`;
    case 'hunter_revenge_mark':
      return `💢 复仇标记: ${entry.target || '?'}`;
    case 'blunderbuss_corroded':
      return '💥 短火铳已腐蚀';
    case 'rifle_corroded':
      return '🔫 猎枪带出门，已腐蚀';

    // 种狼相关
    case 'alpha_transform':
      return '🐺 种狼完成了变狼';
    case 'alpha_fake_identity':
      return `🎭 假身份编织: ${entry.fakeRole || '?'}`;
    case 'alpha_infected_visible':
      return '⚠️ 种狼使用了感染——现在可被察灵家查出';

    // 感染相关
    case 'infected':
      return '🦠 你被冥僧人堕化，下个夜晚将蚀变为蚀者';
    case 'seer_infected':
      return '🔮 种狼试图感染你，但你保留了察灵能力';
    case 'alpha_to_villager':
      return '👨‍🌾 冥僧人堕化了帷幕学者，自己变成了村民';
    case 'became_wolf':
      return '🐺 你已蚀变为蚀者！';

    // 村民相关
    case 'eavesdrop':
      return `👂 ${entry.result || entry.msg || '帷幕低语结果不明'}`;
    case 'eavesdrop_accurate':
      return `🧵 精确帷幕低语: ${entry.result || '...'}`;
    case 'house_visit':
      return `🏠 ${entry.desc || '去了目标家'}`;
    case 'old_hunter_trap':
      return '🪤 老猎人的陷阱已布设——等待猎物';
    case 'old_hunter_detected':
      return `🎯 老猎人发现了进入你家的狼人！`;
    case 'merchant_double_visit':
      return `📦 商人访问了两个屋子: ${entry.firstTarget || '?'} 和 ${entry.secondTarget || '?'}`;
    case 'trade_info':
      return '💱 你发起了信息交易';
    case 'herbal_remedy':
      return `🌿 草药已施给 ${entry.target || '?'}——若其今晚死亡，可推迟1回合`;
    case 'night_watch':
      return `👁️ 守夜: 今晚有 ${entry.outCount || 0} 人出门`;
    case 'blacksmith_fortify':
      return '🔒 门锁已加固——可抵御一次蚀者噬灵';
    case 'blacksmith_door_blocked':
      return '🔒 你的加固门锁挡住了蚀者噬灵！但门锁已被毁坏';

    // 其他
    case 'trait_trigger':
      return `✨ ${entry.trait || '特质'}: ${entry.effect || '触发'}`;
    case 'death':
      return `💀 ${entry.player || '?'} 死亡: ${entry.reason || '?'}`;
    case 'corrosion_mist_triggered':
      return `🌫️ 蚀雾陷阱触发!`;

    default:
      return entry.msg || entry.type || '未知情报';
  }
}
