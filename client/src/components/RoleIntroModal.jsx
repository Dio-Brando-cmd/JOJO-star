// ============================================================
// 角色简介公告弹窗 —— 加入房间时展示所有角色说明
// ============================================================

import React, { useState } from 'react';
import { ROLES, ROLE_NAMES, ROLE_ICONS } from '../utils/constants';

const ROLE_DETAILS = [
  {
    id: ROLES.ALPHA_WOLF,
    name: '种狼',
    icon: '👑🐺',
    team: 'WOLF',
    teamName: '狼人阵营',
    color: '#c0392b',
    desc: '狼群的首领，拥有三种特殊能力。',
    abilities: [
      '🐺 <strong>变狼</strong>：变身成真正的狼人形态。变狼前不会被预言家查出身份。',
      '🦠 <strong>感染</strong>：感染一名玩家，下个夜晚变为狼人。使用感染后当前夜晚即算作狼人。若感染预言家，预言家保留能力并获知种狼身份，种狼变为普通村民。',
      '🔪 <strong>刀人</strong>：变狼后才可刀人。刀人后无法再使用感染。变狼和刀人可在同一晚进行。',
    ],
    tips: '策略：可以先感染再变狼刀人，或选择潜伏感染。注意感染预言家会导致自己变村民！',
  },
  {
    id: ROLES.WEREWOLF,
    name: '狼人',
    icon: '🐺',
    team: 'WOLF',
    teamName: '狼人阵营',
    color: '#e74c3c',
    desc: '夜晚出没的猎手，锁定的是人而不是屋子。',
    abilities: [
      '🔪 <strong>刀人</strong>：夜晚击杀目标。狼人锁定的是<em>人</em>而非屋子，会跟随目标移动。',
      '🐺 <strong>相认机制</strong>：开局互不相识。若去另一狼人家中，双方相认，下回合可共同睁眼、分头行动。',
      '⚔️ <strong>互刀</strong>：两狼互刀则相认；一狼刀另一狼则被刀者直接死亡。',
    ],
    tips: '策略：早期可尝试寻找其他狼人相认，协同行动效率更高。但注意不要误杀同伴！',
  },
  {
    id: ROLES.SEER,
    name: '预言家',
    icon: '🔮',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#7d3c98',
    desc: '拥有看穿一切的眼睛，查验身份是找出狼人的关键。',
    abilities: [
      '🔮 <strong>查验</strong>：每夜查验一名玩家是"好人"还是"狼人"。',
      '⚠️ <strong>种狼特殊</strong>：种狼变狼前查验结果为"好人"；种狼使用感染后会被查出。',
      '🦠 <strong>被感染时</strong>：保留预言能力，立即获知种狼身份，种狼变为普通村民。',
    ],
    tips: '策略：尽早查验可疑玩家。注意种狼可能在早期伪装成好人，需要结合行为判断。',
  },
  {
    id: ROLES.POISON_WITCH,
    name: '毒巫',
    icon: '☠️🧪',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#2e7d32',
    desc: '手持烈性毒药，能瞬间灭门一屋之人。',
    abilities: [
      '☠️ <strong>烈性毒药</strong>：毒死目标<em>屋子中所有人</em>。若屋内≥3人且有守卫，则守卫重伤、其余毒死。',
      '💊 <strong>药水</strong>：可救活一人，但<em>不能治疗守卫重伤</em>。一次性使用。',
    ],
    tips: '策略：烈性毒药威力巨大但可能误伤队友，需谨慎选择目标屋子。注意屋内人数！',
  },
  {
    id: ROLES.HEAL_WITCH,
    name: '药巫',
    icon: '💚🧪',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#27ae60',
    desc: '万能医者，药可救一切，毒则精确致命。',
    abilities: [
      '💚 <strong>万能药</strong>：可治疗<em>一切</em>，包括守卫重伤和死亡。一次性使用。',
      '🧪 <strong>毒药</strong>：单目标毒杀。若目标离开屋子则毒药失效；若有其他人进入则毒到第一个进入者。一次性使用。',
    ],
    tips: '策略：万能药是唯一能治疗守卫重伤的手段。毒药有传递机制，注意目标移动情况。',
  },
  {
    id: ROLES.GUARD,
    name: '守卫',
    icon: '🛡️',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#2980b9',
    desc: '强壮的守护者，去目标家中守护，但守不住出门的人。',
    abilities: [
      '🛡️ <strong>守护</strong>：去目标家中守护（逻辑是去其家中）。若目标出门则守护无效。',
      '💔 <strong>重伤机制</strong>：守护的屋子1-2人被狼攻击→重伤；独自在家被1狼攻击→重伤且该狼知道你是守卫。',
      '🚶 <strong>出门</strong>：可以出门躲避危险。去别人家等同于在家。',
      '⚠️ <strong>不计入人数</strong>：守护姿态的守卫不计入屋子人数。',
    ],
    tips: '策略：守护姿态不计入人数是关键变量。注意只有药巫能治疗你的重伤！',
  },
  {
    id: ROLES.HUNTER,
    name: '猎人',
    icon: '🔫',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#d35400',
    desc: '第二晚才能行动，手握猎枪和短火铳两把致命武器。',
    abilities: [
      '🔫 <strong>猎枪</strong>：白天必杀；夜晚观察目标是否出门+射杀。不带出门则腐蚀失效。追踪前一晚出门的目标可100%命中。',
      '💥 <strong>短火铳</strong>：防御武器。受到狼人攻击或住处/观察房被下毒时反杀攻击者。带出门只能保一晚后腐蚀。',
      '🎒 <strong>武器携带</strong>：可选带猎枪、短火铳、都带或都不带。',
      '👁️ <strong>观察</strong>：选择目标观察其是否出门。',
    ],
    tips: '策略：第二晚才能行动！白天猎枪必杀是最强能力之一。注意武器腐蚀管理——不带出门就会失效。',
  },
  {
    id: ROLES.VILLAGER,
    name: '村民',
    icon: '👨‍🌾',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#5d6d7e',
    desc: '普通村民，数量最多的好人。夜晚可出门或睡觉。',
    abilities: [
      '🚶 <strong>出门</strong>：可去别人家中（注意：屋内人数<3时才能进入其他村民家）。',
      '😴 <strong>睡觉</strong>：留在自己家中，最简单安全的选择。',
      '🔢 <strong>编号区分</strong>：各村民之间有编号区分，便于讨论时指认。',
    ],
    tips: '策略：虽然无特殊能力，但村民的投票和讨论是好人获胜的根本。注意分析信息，找出矛盾。',
  },
];

export default function RoleIntroModal({ show, onClose }) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content role-intro-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📜 角色简介公告</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="intro-text">
            本局狼人杀共有 <strong>8种角色</strong>，每个角色拥有独特的行动方式和能力。
            请仔细阅读以下简介，了解你所扮演角色的能力。
          </p>

          <div className="role-cards-grid">
            {ROLE_DETAILS.map(role => (
              <div key={role.id} className="role-intro-card" style={{ borderLeftColor: role.color }}>
                <div className="role-intro-header">
                  <span className="role-intro-icon">{role.icon}</span>
                  <div className="role-intro-title">
                    <h4>{role.name}</h4>
                    <span className="role-intro-team" style={{ color: role.color }}>
                      {role.teamName}
                    </span>
                  </div>
                </div>
                <p className="role-intro-desc">{role.desc}</p>
                <ul className="role-intro-abilities">
                  {role.abilities.map((a, i) => (
                    <li key={i} dangerouslySetInnerHTML={{ __html: a }} />
                  ))}
                </ul>
                <p className="role-intro-tips">💡 {role.tips}</p>
              </div>
            ))}
          </div>

          <div className="role-intro-summary">
            <h4>🌙 夜晚行动顺序（第二晚起）</h4>
            <div className="action-order">
              <span className="order-step wolf">🐺 猎人</span>
              <span className="order-arrow">→</span>
              <span className="order-step wolf">👑 种狼</span>
              <span className="order-arrow">→</span>
              <span className="order-step village">🛡️ 守卫</span>
              <span className="order-arrow">→</span>
              <span className="order-step wolf">🐺 狼人群</span>
              <span className="order-arrow">→</span>
              <span className="order-step village">🔮 预言家</span>
              <span className="order-arrow">→</span>
              <span className="order-step village">☠️ 毒巫</span>
              <span className="order-arrow">→</span>
              <span className="order-step village">💚 药巫</span>
            </div>
            <p className="order-note">第一晚猎人不能行动</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
