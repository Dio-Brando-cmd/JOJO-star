// ============================================================
// 角色简介公告弹窗 — v2.0 扩展版
// 展示所有角色的完整能力（含新增能力）
// ============================================================

import React from 'react';
import { ROLES, ROLE_NAMES, ROLE_ICONS, SPIRIT_WEAVER_TYPE_NAMES } from '../utils/constants';

const ROLE_DETAILS = [
  {
    id: ROLES.NETHER_MONK,
    name: '冥僧人',
    icon: '🕯️🌑',
    team: 'CORRUPTED',
    teamName: '蚀者阵营',
    color: '#c0392b',
    desc: '蚀者群的首领，兼具蚀变、堕化与刀人的多重能力。可以选择潜伏伪装，也可以选择正面强攻——但要记得：蚀变越深，你离“自己”越远。',
    abilities: [
      '🌑 <strong>蚀变</strong>：灵焰完全蚀变。蚀变前察灵显示为纯净。',
      '🦠 <strong>堕化</strong>：堕化一名玩家，下个夜晚蚀变为蚀者（察灵家保留能力但查验反转）。',
      '🎭 <strong>假身份编织</strong>：蚀变前可伪装成一种守幕者身份，被帷幕学者察灵时显示为该身份。使用堕化后伪装失效。',
      '🔪 <strong>刀人</strong>：蚀变后在蚀者步骤与蚀者群一起选择击杀目标。',
      '💉 <strong>裂隙引导</strong>（被动）：每次有蚀者被放逐，获得一次额外堕化机会。',
    ],
    tips: '💡 策略：先潜伏编织假身份，再择机蚀变。堕化察灵家是最强干扰——让守幕者的信息核心彻底混乱。',
  },
  {
    id: ROLES.CORRUPTED,
    name: '蚀者',
    icon: '🌑',
    team: 'CORRUPTED',
    teamName: '蚀者阵营',
    color: '#e74c3c',
    desc: '夜晚出没的猎手。不止会刀人——还能共鸣召集同伴、伪装混入人群、追踪猎物的气味。只是那种饿，从来都填不满。',
    abilities: [
      '🔪 <strong>刀人</strong>：在蚀者步骤击杀目标。锁定的是人而非屋子，会跟随目标移动。',
      '🌑 <strong>共鸣机制</strong>：去另一蚀者庇护所则双方共鸣。互噬则不死。',
      '📢 <strong>裂隙共鸣</strong>：放弃噬灵，发出裂隙信号。所有未共鸣的蚀者收到召唤，下回合共鸣概率翻倍。冷却2蚀月。',
      '🎭 <strong>伪装</strong>：伪装成守幕者出门，计入屋子人数，不暴露蚀者身份。代价：当晚不能刀人。',
      '👃 <strong>嗅觉追踪</strong>（被动）：刀人时若目标出了门，可闻到目标去了谁家。',
    ],
    tips: '💡 策略：共鸣+伪装+刀人三者选一，增加了每夜的决策深度。尽早用共鸣召集同伴，伪装可用于渗透信息。',
  },
  {
    id: ROLES.VEIL_SCHOLAR,
    name: '帷幕学者',
    icon: '👁️',
    team: 'VEIL_KEEPERS',
    teamName: '守幕者阵营',
    color: '#7d3c98',
    desc: '每夜查验一名玩家的身份。新增梦境线索、灵视和公开察灵能力，是守幕者方最丰富的信息核心。只是看久了，你会分不清是你在看帷幕，还是帷幕在看你。',
    abilities: [
      '🔮 <strong>查验</strong>：每夜查验一名玩家，获知"守幕者"或"蚀者"。白天查看目标头像：金色=守幕者，暗紫=蚀者。',
      '🌙 <strong>梦境碎片</strong>（被动）：查验后额外获得一条模糊线索——如"有人去过目标屋子"。',
      '👻 <strong>灵视</strong>：不查活人，改为查验已死亡玩家——获知死者的真实身份。消耗当夜查验机会。',
      '📢 <strong>公开察灵</strong>（每局限1次，白天）：公开宣布察灵结果。若判断错误则自己被投票出局——梭哈能力！',
      '🦠 <strong>被堕化时</strong>：保留察灵能力，但察灵结果反转。获知冥僧人身份。',
    ],
    tips: '💡 策略：梦境碎片提供辅助推理线索。灵视可用来验证已死者的身份（确认之前查验是否正确）。公开察灵是终极武器——用之前确保没被堕化。',
  },
  {
    id: ROLES.HERBAL_SAGE,
    name: '草药学者',
    icon: '☠️🧪',
    team: 'VEIL_KEEPERS',
    teamName: '守幕者阵营',
    color: '#2e7d32',
    desc: '蚀灭符阵可灭门，蚀雾可设陷阱。新增毒药材料管理——用多少、什么时候用，都是决策。只是你已经很久，没在夜里睡过一个整觉了。',
    abilities: [
      '☠️ <strong>蚀灭符阵</strong>：毒死目标屋子中所有人。消耗2份毒药材料。若屋内≥3人且有守卫：灵蚀重伤、其余毒死。',
      '🌫️ <strong>蚀雾符阵</strong>：在目标屋子释放延迟蚀雾。下一晚进入该屋的人中毒。消耗1份材料。',
      '💊 <strong>灵符</strong>：救活一名本应死亡的玩家。不能治疗灵蚀重伤。一次性使用。',
      '🧪 <strong>毒药材料</strong>（资源管理）：初始2份材料。2材料=1蚀灭符阵，1材料=1普通毒药。',
      '🛡️ <strong>抗毒体质</strong>（被动）：草药学者自己永远不会被毒死。',
      '👁️ <strong>知情权</strong>（被动）：灵蚀重伤时草药学者会获知。',
    ],
    tips: '💡 策略：蚀雾是战略性武器——今晚设陷阱，明晚收网。材料管理是关键：用蚀灭符阵还是攒着做两个蚀雾？',
  },
  {
    id: ROLES.SPIRIT_MENDER,
    name: '愈灵师',
    icon: '💚🧪',
    team: 'VEIL_KEEPERS',
    teamName: '守幕者阵营',
    color: '#27ae60',
    desc: '万能医者，新增战场急救、药草园和诊断能力——从"打针医生"变为"战术医疗官"。尽管你心里清楚，有些微光，最后也保不住。',
    abilities: [
      '💚 <strong>万能药</strong>：治疗一切——死亡救活、重伤治愈。唯一能治疗灵蚀重伤的手段。一次性使用。',
      '🧪 <strong>单目标毒药</strong>：毒杀一人。若目标离开屋子则蚀痕净化转移到第一个进入者。一次性使用。',
      '🚑 <strong>战场急救</strong>：去被攻击的屋子——若有重伤者，急救使其存活（但进入"半条命"状态，不能投票/使用能力）。',
      '🌿 <strong>药草园</strong>：留守家中种植药草。下一回合获得额外1份解药（每局限1次）。代价：不参与任何行动。',
      '🔍 <strong>诊断</strong>：去目标家，不消耗药——获知目标是否濒死、是否重伤、是否被堕化。纯信息能力。',
    ],
    tips: '💡 策略：诊断+战场急救组合——先诊断确认需要救谁，再决定用万能药还是战场急救。药草园是"放弃今晚换明晚更强"的长期投资。',
  },
  {
    id: ROLES.VEIL_GUARDIAN,
    name: '帷幕守卫',
    icon: '🛡️',
    team: 'VEIL_KEEPERS',
    teamName: '守幕者阵营',
    color: '#2980b9',
    desc: '强壮的守护者。新增筑垒、巡逻、舍身——从"站桩挡刀"变为"战术指挥官"。只是你守了一夜又一夜，却从不敢想：这扇门，到底守得住什么。',
    abilities: [
      '🛡️ <strong>守护</strong>：去目标家中守护。守护姿态不计入屋子人数。≤2人被蚀者噬灵→重伤挡下击杀。',
      '🏰 <strong>筑垒</strong>：加固目标屋子。蚀者不能攻击该屋内的人（但草药学者的蚀灭符阵可击穿）。哈尔瓦德无法进入筑垒的屋子。',
      '👀 <strong>巡逻</strong>：不守护具体目标，改为巡视全村。获知今晚哪些屋子有蚀者进入（数量，不知是谁）。用守护换信息。',
      '💀 <strong>舍身</strong>：标记一个替死目标。若该目标当晚死亡，守卫替其死亡。一次性的最高牺牲。',
      '💔 <strong>重伤机制</strong>：独自在家被1蚀者攻击→重伤且该蚀者获知你是帷幕守卫。只有愈灵师万能药能治重伤。',
    ],
    tips: '💡 策略：筑垒是战略性防御——保护关键角色被蚀者噬灵。巡逻换情报。舍身是终极大招——用自己换察灵家/愈灵师活下来。',
  },
  {
    id: ROLES.FLAME_TRACKER,
    name: '灵痕追猎者',
    icon: '🔫',
    team: 'VEIL_KEEPERS',
    teamName: '守幕者阵营',
    color: '#d35400',
    desc: '第二晚起才能行动。猎枪追猎+短铳反击+白天开枪+陷阱射击+复仇——五杀手段！只是每开一枪，你都离那个“谁”更远一分。',
    abilities: [
      '🔫 <strong>猎枪</strong>：夜晚观察目标+射杀。追踪：前一晚出门的目标下晚必可追踪射杀。白天讨论阶段必杀一人。',
      '💥 <strong>短火铳</strong>：防御。受蚀者攻击时反杀所有攻击者。带出门后腐蚀，只能保一晚。',
      '🪤 <strong>陷阱射击</strong>：在某屋子外设伏。第一个进出的人被标记——可追踪或被警告。',
      '💢 <strong>复仇</strong>：标记复仇目标。若灵痕追猎者被投票出局，开枪击杀复仇目标（而非随机）。',
      '🎒 <strong>武器管理</strong>：每晚选择携带哪些武器。不带则留在家中安全。先开枪后腐蚀。',
    ],
    tips: '💡 策略：陷阱+猎枪组合——设伏后下晚追踪射杀。复仇是保命威慑——"投我可以，你得陪葬"。注意武器管理——带出门就腐蚀。',
  },
  {
    id: ROLES.SPIRIT_WEAVER,
    name: '灵织者',
    icon: '👨‍🌾',
    team: 'VEIL_KEEPERS',
    teamName: '守幕者阵营',
    color: '#5d6d7e',
    desc: '灵织者不再相同！有8种不同类型的灵织者，各有独特能力：老兵、商人、草药师、说书人、守夜人、面包师、铁匠、织布女。一个普通人站在黑暗里，本身就是最大的勇气。',
    abilities: [
      '🚶 <strong>出门</strong>：去别人家中，天亮后得知目标屋子的访客人数（≥3人显示"很多人"并被赶回家）。',
      '👂 <strong>帷幕低语</strong>：在目标屋子外帷幕低语。基于屋内实际成员给线索（织布女的线索更精确）。',
      '🎯 <strong>8种子类型</strong>：',
      '　🔫 老兵灵织者：20%概率识破进入庇护所的蚀者；可在家设陷阱',
      '　📦 旅行行路灵织者：每晚可访问2个屋子；可交易信息',
      '　🌿 学徒灵织者：可推迟目标死亡1回合；感知谁被毒过',
      '　📖 说书人：讨论发言时间翻倍；可额外发言一次',
      '　👁️ 守夜灵织者：察觉门外经过者；可获知今晚出门人数',
      '　🍞 面包师：知道更多人的夜晚去向；天亮时额外获知一条信息',
      '　🔨 锻甲灵织者：加固自家门锁（抵御一次蚀者噬灵）；被投出局带走一名投票者',
      '　🧵 织布女：帷幕低语线索排除干扰项；感知谁进过自己家',
    ],
    tips: '💡 策略：不同灵织者类型的策略完全不同。老兵和铁匠是防御型，商人和守夜人是信息型，草药师是辅助型，说书人是社交型。选灵织者不再无聊！',
  },
];

export default function RoleIntroModal({ show, onClose }) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content role-intro-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📜 角色简介公告（v2.0 扩展版）</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="intro-text">
            本局帷幕之地共有 <strong>8种职业角色 + 8种灵织者子类型 + 10种表层身份</strong>，每个角色拥有多元的行动方式和能力。
            请仔细阅读以下简介，了解你所扮演角色的全部能力。
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
                <p className="role-intro-tips">{role.tips}</p>
              </div>
            ))}
          </div>

          <div className="role-intro-summary">
            <h4>🌙 夜晚行动顺序</h4>
            <div className="action-order">
              <span className="order-step flame-tracker">🔫 灵痕追猎者</span>
              <span className="order-arrow">→</span>
              <span className="order-step corrupted">👑 冥僧人</span>
              <span className="order-arrow">→</span>
              <span className="order-step keeper">🛡️ 帷幕守卫</span>
              <span className="order-arrow">→</span>
              <span className="order-step corrupted">🌑 蚀者群</span>
              <span className="order-arrow">→</span>
              <span className="order-step keeper">🔮 察灵家</span>
              <span className="order-arrow">→</span>
              <span className="order-step keeper">☠️ 草药学者</span>
              <span className="order-arrow">→</span>
              <span className="order-step keeper">💚 愈灵师</span>
              <span className="order-arrow">→</span>
              <span className="order-step keeper">👨‍🌾 灵织者</span>
            </div>
            <p className="order-note">
              第一晚灵痕追猎者不能行动；灵织者在所有守幕者和蚀者之后行动<br/>
              <strong>v2.0新增</strong>：每种角色有2-3个可选新能力，每夜需在多个能力之间做出选择
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
