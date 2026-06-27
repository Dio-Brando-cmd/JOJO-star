// ============================================================
// 角色简介公告弹窗 —— 加入房间时展示所有角色说明
// v1.5.4 修正版
// ============================================================

import React from 'react';
import { ROLES, ROLE_NAMES, ROLE_ICONS } from '../utils/constants';

const ROLE_DETAILS = [
  {
    id: ROLES.ALPHA_WOLF,
    name: '种狼',
    icon: '👑🐺',
    team: 'WOLF',
    teamName: '狼人阵营',
    color: '#c0392b',
    desc: '狼群的首领。在种狼步骤变身/感染，随后在狼人步骤与同伴一起刀人。',
    abilities: [
      '🐺 <strong>变狼</strong>：在种狼步骤变身为狼人形态。变狼前不会被预言家查出。',
      '🦠 <strong>感染</strong>：感染一名玩家，下个夜晚变为狼人（预言家除外）。使用感染后当前夜晚即算作狼人。',
      '🔮 <strong>感染预言家</strong>：预言家保留能力但查验结果<em>反转</em>（好人→狼人，狼人→好人），种狼仍属狼人阵营。',
      '🔪 <strong>刀人</strong>：变狼后在<em>狼人步骤</em>与狼群一起选择击杀目标。',
    ],
    tips: '策略：先变身潜伏，再随狼群统一行动。感染预言家会让其查验结果完全颠倒，是强力干扰战术！',
  },
  {
    id: ROLES.WEREWOLF,
    name: '狼人',
    icon: '🐺',
    team: 'WOLF',
    teamName: '狼人阵营',
    color: '#e74c3c',
    desc: '夜晚出没的猎手，锁定人而非屋子，与同伴协同击杀。',
    abilities: [
      '🔪 <strong>刀人</strong>：在狼人步骤击杀目标。锁定的是<em>人</em>而非屋子，会跟随目标移动。',
      '🐺 <strong>相认机制</strong>：开局互不相识。去另一狼人家中则双方相认，下回合可共同睁眼。',
      '⚔️ <strong>互刀</strong>：两狼互刀则相认不死；一狼刀另一狼则被刀者直接死亡。',
    ],
    tips: '策略：尽早出门寻找同伴相认。协同行动时分散去不同屋子可同时获取多条情报。',
  },
  {
    id: ROLES.SEER,
    name: '预言家',
    icon: '🔮',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#7d3c98',
    desc: '每夜查验一名玩家的阵营身份，是好人方的信息核心。',
    abilities: [
      '🔮 <strong>查验</strong>：每夜查验一名玩家，获知"好人"或"狼人"。查验后在<em>白天</em>查看目标头像：🟡金色=好人，⬜银白=狼人。',
      '⚠️ <strong>种狼判定</strong>：未变狼且未感染的种狼查验为"好人"；已变狼或已感染则查出"狼人"。',
      '🦠 <strong>被感染时</strong>：保留预言能力，但查验结果<em>完全反转</em>。你获知种狼身份，种狼仍属狼人阵营。',
    ],
    tips: '策略：尽早查验可疑玩家。被感染后结果反转，需重新评估之前的所有查验结论！',
  },
  {
    id: ROLES.POISON_WITCH,
    name: '毒巫',
    icon: '☠️🧪',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#2e7d32',
    desc: '烈性毒药可灭门一屋之人，药水可救活一人。',
    abilities: [
      '☠️ <strong>烈性毒药</strong>：毒死目标<em>屋子中所有人</em>。若屋内≥3人且有守卫：守卫重伤、其余毒死。',
      '💊 <strong>药水</strong>：救活一名本应死亡的玩家。<em>不能治疗守卫重伤</em>。一次性使用。',
      '👁️ <strong>知情权</strong>：守卫重伤时毒巫会获知。',
    ],
    tips: '策略：烈性毒药威力巨大——人多时慎用以免误伤。优先救预言家或确认的好人。',
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
      '💚 <strong>万能药</strong>：治疗<em>一切</em>——死亡救活、重伤治愈。唯一能治疗守卫重伤的手段。一次性使用。',
      '🧪 <strong>单目标毒药</strong>：毒杀一人。若目标离开屋子则毒药转移到第一个进入者。一次性使用。',
    ],
    tips: '策略：万能药是最强治疗，优先留给可能需要救守卫或预言家的场合。毒药有传递机制。',
  },
  {
    id: ROLES.GUARD,
    name: '守卫',
    icon: '🛡️',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#2980b9',
    desc: '强壮的守护者。去目标家中守护，用身体挡住袭击。',
    abilities: [
      '🛡️ <strong>守护</strong>：去目标家中守护。守护姿态不计入屋子人数。若目标出门则守护落空。',
      '💔 <strong>重伤机制</strong>：守护屋≤2人被狼攻击→重伤挡下击杀；独自在家被1狼攻击→重伤且该狼获知你是守卫。',
      '⚠️ <strong>注意</strong>：只有药巫的万能药能治疗重伤。重伤状态下继续守护无法挡刀。',
    ],
    tips: '策略：守住关键角色（预言家/女巫）。注意守护姿态不计入人数，会影响毒巫的烈性毒药判定。',
  },
  {
    id: ROLES.HUNTER,
    name: '猎人',
    icon: '🔫',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#d35400',
    desc: '第二晚起才能行动，猎枪追踪+短火铳反击+白天开枪，三杀手段。',
    abilities: [
      '🔫 <strong>猎枪</strong>：①白天讨论阶段必杀一人（无视防御）；②夜晚观察目标+射杀；③追踪：前一晚出门的目标下晚100%可追踪射杀。不带出门则腐蚀失效。',
      '💥 <strong>短火铳</strong>：防御武器。受狼攻击时反杀攻击者（含多人围攻时反杀所有）。带出门后腐蚀，只能保一晚。',
      '🎒 <strong>武器携带</strong>：每晚选择携带猎枪和/或短火铳。不带则留在家中安全。先开枪后腐蚀，确保同晚可用。',
    ],
    tips: '策略：第二晚才能行动！白天猎枪是最强单杀。短火铳是保命神器。注意武器管理——带出门就会腐蚀。',
  },
  {
    id: ROLES.VILLAGER,
    name: '村民',
    icon: '👨‍🌾',
    team: 'VILLAGE',
    teamName: '好人阵营',
    color: '#5d6d7e',
    desc: '普通村民，在所有神职和狼人之后行动。可通过出门观察或偷听获取情报。',
    abilities: [
      '🚶 <strong>出门</strong>：去别人家中，天亮后得知目标屋子的访客人数（≥3人显示"很多人"并被赶回家）。',
      '👂 <strong>偷听</strong>：在目标屋子外偷听。<em>基于屋内实际成员</em>随机给线索：狼嚎=有狼人、祈祷=有神职、多人在活动、空无一人等。',
      '😴 <strong>睡觉</strong>：留在自己家中。安全但无信息。',
      '🔢 <strong>编号</strong>：每个村民有唯一编号，便于讨论时区分。',
    ],
    tips: '策略：出门看人数+偷听听线索，是好人方的情报基石。3人以上被赶回家说明目标屋子很热闹！',
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
            <h4>🌙 夜晚行动顺序</h4>
            <div className="action-order">
              <span className="order-step hunter">🔫 猎人</span>
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
              <span className="order-arrow">→</span>
              <span className="order-step village">👨‍🌾 村民</span>
            </div>
            <p className="order-note">
              第一晚猎人不能行动；村民在所有神和狼之后行动
            </p>
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
