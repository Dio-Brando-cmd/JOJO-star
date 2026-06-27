// ============================================================
// 角色卡 —— 显示玩家自己的角色信息
// ============================================================

import React from 'react';
import { ROLES, ROLE_NAMES, ROLE_ICONS, TEAMS, TEAM_NAMES } from '../utils/constants';
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
        </div>
      </div>

      {/* 角色详细信息（仅对持有该能力的角色显示） */}
      <div className="role-card-details">
        {pvt?.isTransformed && <span className="detail-tag">🐺 已变狼</span>}
        {pvt?.hasUsedInfect && <span className="detail-tag">🦠 已感染</span>}
        {/* 仅毒巫/药巫可见自己的药水状态 */}
        {(role === ROLES.POISON_WITCH || role === ROLES.HEAL_WITCH) && pvt?.hasPotion !== undefined && (
          <span className="detail-tag">💊 解药: {pvt.hasPotion ? '有' : '已用'}</span>
        )}
        {(role === ROLES.POISON_WITCH || role === ROLES.HEAL_WITCH) && pvt?.hasPoison !== undefined && (
          <span className="detail-tag">🧪 毒药: {pvt.hasPoison ? '有' : '已用'}</span>
        )}
        {pvt?.hasRifle && pvt?.rifleUsable && <span className="detail-tag">🔫 猎枪可用</span>}
        {pvt?.hasBlunderbuss && pvt?.blunderbussUsable && <span className="detail-tag">💥 短火铳可用</span>}
        {pvt?.willBecomeWolf && <span className="detail-tag warning">⚠️ 即将变狼</span>}
        {pvt?.canShootNextNight && <span className="detail-tag">🎯 明晚可追踪射杀</span>}
      </div>

      {/* 已知同伴（狼人相认后可见） */}
      {pvt?.knownWolves?.length > 0 && (
        <div className="role-card-allies">
          <h5>🐺 已知同伴:</h5>
          {pvt.knownWolves.map(wid => (
            <span key={wid} className="ally-tag">{wid}</span>
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
    </div>
  );
}

function formatPrivateLog(entry) {
  switch (entry.type) {
    case 'seer_check':
      return `🔮 查验结果: ${entry.result === 'GOOD' ? '好人 ✅' : '狼人 🐺'}`;
    case 'wolf_meet':
      return '🐺 你遇到了另一只狼人！';
    case 'wolves_united':
      return '🐺 狼人们已相认，下回合可协同行动';
    case 'wolf_mutual_kill':
      return '⚔️ 两只狼人互刀，已相认';
    case 'guard_heavy_injury':
      return '💔 守卫进入了重伤状态';
    case 'guard_heavy_injury_alone':
      return '💔 守卫独自在家被狼人袭击，重伤';
    case 'guard_heavy_injury_3plus':
      return '💔 守卫在多人屋内被袭，重伤';
    case 'heal_injury':
      return '💚 重伤已被万能药治愈';
    case 'infected':
      return '🦠 你被种狼感染，下个夜晚将变为狼人';
    case 'seer_infected':
      return '🔮 种狼试图感染你，但你保留了预言能力，种狼已变为村民';
    case 'alpha_to_villager':
      return '👨‍🌾 种狼感染了预言家，自己变成了村民';
    case 'alpha_transform':
      return '🐺 种狼完成了变狼';
    case 'blunderbuss_corroded':
      return '💥 短火铳已腐蚀';
    case 'rifle_corroded':
      return '🔫 猎枪未带出门，已腐蚀';
    case 'hunter_observe':
      return `🔍 观察到目标${entry.wentOut ? '出门了' : '没有出门'}`;
    case 'eavesdrop':
      return `👂 ${entry.result || entry.msg || '偷听结果不明'}`;
    case 'house_visit':
      return `🏠 ${entry.desc || `去了目标家`}`;
    default:
      return entry.msg || entry.type;
  }
}
