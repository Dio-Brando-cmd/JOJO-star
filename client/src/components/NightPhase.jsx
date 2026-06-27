// ============================================================
// 夜晚行动界面 —— 根据角色和当前步骤显示不同的操作面板
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  ROLES, NIGHT_STEPS, NIGHT_STEP_NAMES, NIGHT_ACTIONS,
} from '../utils/constants';
import RoleIllustration from './RoleIllustration';

export default function NightPhase({ socket }) {
  const { gameState, privateState } = socket;
  const { nightStep } = gameState;
  const myRole = privateState?.myRole;
  const myPrivate = privateState?.myPrivateState;
  const myPlayerId = socket.playerId;

  const [action, setAction] = useState(null);
  const [target, setTarget] = useState(null);
  const [ability, setAbility] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const submittingRef = useRef(false);
  const [countdown, setCountdown] = useState(20);
  const countdownRef = useRef(null);
  const TIMEOUT_SECONDS = 20; // 匹配服务端 NIGHT_STEP_TIMEOUT

  // 当夜晚步骤变化时重置状态（新步骤 = 新机会）
  useEffect(() => {
    setAction(null);
    setTarget(null);
    setAbility({});
    setSubmitted(false);
    setAutoSubmitted(false);
    setSubmitError(null);
    submittingRef.current = false;
    setCountdown(TIMEOUT_SECONDS);

    // 清除旧定时器
    if (countdownRef.current) clearInterval(countdownRef.current);

    // 启动倒计时
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [nightStep]);

  // 倒计时归零时自动提交当前选择
  useEffect(() => {
    if (countdown === 0 && !submitted && isMyTurn) {
      const autoAction = action || NIGHT_ACTIONS.SLEEP;
      const autoTarget = action ? target : null;
      const autoAbility = action ? ability : null;
      submittingRef.current = true;
      socket.submitNightAction(autoAction, autoTarget, autoAbility);
      setSubmitted(true);
      setAutoSubmitted(true);
    }
  }, [countdown]);

  const alivePlayers = gameState.players?.filter(p => p.alive && p.id !== socket.playerId) || [];

  // 判断是否轮到我行动
  const isMyTurn = checkIsMyTurn(myRole, nightStep, myPrivate, gameState.round);

  // 如果不是我的回合，显示等待画面
  if (!isMyTurn) {
    return (
      <div className="night-panel">
        <div className="night-waiting">
          <h3>🌙 夜晚 - {NIGHT_STEP_NAMES[nightStep] || nightStep}</h3>
          <p className="waiting-text">正在等待 {NIGHT_STEP_NAMES[nightStep]} 行动...</p>
          <div className="night-spinner" />
        </div>
        {!shouldBeAwake(myRole, nightStep) && (
          <button className="btn btn-ghost" onClick={socket.skipNightStep}>
            跳过（与我无关）
          </button>
        )}
      </div>
    );
  }

  // 如果已经提交，等待其他人
  if (submitted) {
    return (
      <div className="night-panel">
        <div className="night-waiting">
          <h3>{autoSubmitted ? '⏰ 已自动提交' : '✅ 行动已提交'}</h3>
          <p>等待其他玩家完成行动...</p>
          {autoSubmitted && <p className="auto-submit-note">倒计时结束，已自动提交当前选择</p>}
          <div className="night-spinner" />
          {submitError && (
            <p className="error-text" style={{marginTop:12}}>{submitError}</p>
          )}
        </div>
      </div>
    );
  }

  // 显示我的角色
  return (
    <div className="night-panel">
      <div className="night-header">
        <RoleIllustration role={myRole} size="small" />
        <h3>🌙 夜晚行动 - {NIGHT_STEP_NAMES[nightStep]}</h3>
        <p className="night-subtitle">选择你今晚的行动</p>
        <div className="night-countdown">
          ⏱️ 剩余时间: {countdown}秒
          <div className="countdown-bar-container">
            <div className="countdown-bar" style={{width: `${(countdown / TIMEOUT_SECONDS) * 100}%`}} />
          </div>
        </div>
      </div>

      {/* 第一步：选择行动类型 */}
      {!action && (
        <ActionSelector myRole={myRole} myPrivate={myPrivate} round={gameState.round} onSelect={setAction} />
      )}

      {/* 第二步：选择目标 + 能力参数 */}
      {action && (
        <ActionDetail
          action={action}
          myRole={myRole}
          myPrivate={myPrivate}
          alivePlayers={alivePlayers}
          allPlayers={gameState.players}
          target={target}
          setTarget={setTarget}
          ability={ability}
          setAbility={setAbility}
          myPlayerId={myPlayerId}
          nightStep={nightStep}
          onBack={() => { setAction(null); setTarget(null); setAbility({}); }}
          onSubmit={() => {
            if (submittingRef.current) return;
            submittingRef.current = true;
            socket.submitNightAction(action, target, ability);
            setSubmitted(true);
            setSubmitError(null);
          }}
        />
      )}

      {/* 种狼特殊：告知被感染者 */}
      {myRole === ROLES.ALPHA_WOLF && myPrivate?.hasUsedInfect && (
        <div className="alpha-notify-section">
          <button
            className="btn btn-secondary alpha-notify-btn"
            onClick={() => {
              if (socket.socket) {
                socket.socket.emit('alpha:notifyInfected');
              }
            }}
          >
            📢 告知被感染者
          </button>
          <p className="alpha-notify-hint">向被你感染的玩家揭露你的身份</p>
        </div>
      )}
    </div>
  );
}

// ==================== 行动类型选择 ====================

function ActionSelector({ myRole, myPrivate, round, onSelect }) {
  const isVillager = isVillagerRole(myRole);

  return (
    <div className="action-selector">
      {/* 出门 */}
      <button className="action-card" onClick={() => onSelect(NIGHT_ACTIONS.GO_OUT)}>
        <span className="action-icon">🚶</span>
        <span className="action-name">出门</span>
        <span className="action-desc">离开自己的屋子去别人家</span>
      </button>

      {/* 使用能力（非村民角色） */}
      {!isVillager && (
        <button className="action-card" onClick={() => onSelect(NIGHT_ACTIONS.USE_ABILITY)}>
          <span className="action-icon">✨</span>
          <span className="action-name">使用能力</span>
          <span className="action-desc">{getAbilityDesc(myRole)}</span>
        </button>
      )}

      {/* 偷听（村民专属） */}
      {isVillager && (
        <button className="action-card eavesdrop-card" onClick={() => onSelect(NIGHT_ACTIONS.EAVESDROP)}>
          <span className="action-icon">👂</span>
          <span className="action-name">偷听</span>
          <span className="action-desc">在目标屋子外偷听，获取模糊情报（不精确）</span>
        </button>
      )}

      {/* 睡觉 */}
      <button className="action-card sleep-card" onClick={() => onSelect(NIGHT_ACTIONS.SLEEP)}>
        <span className="action-icon">😴</span>
        <span className="action-name">睡觉</span>
        <span className="action-desc">留在自己家中，什么也不做</span>
      </button>
    </div>
  );
}

// ==================== 行动详情（选目标 + 选能力） ====================

function ActionDetail({ action, myRole, myPrivate, alivePlayers, allPlayers, target, setTarget, ability, setAbility, onBack, onSubmit, myPlayerId, nightStep }) {
  const needsTarget = action !== NIGHT_ACTIONS.SLEEP;

  // "自己家"按钮 — 选中自己的屋子（以自己 playerId 标识）
  const ownHouseId = myPlayerId;

  // 守卫特殊处理：守护需要选目标，单纯出门不需要
  const canSubmit = action === NIGHT_ACTIONS.SLEEP || target || (action === NIGHT_ACTIONS.GO_OUT && myRole !== ROLES.GUARD);

  return (
    <div className="action-detail">
      <button className="btn-link back-btn" onClick={onBack}>← 重新选择</button>

      <h4>{action === NIGHT_ACTIONS.GO_OUT ? '🚶 出门' : action === NIGHT_ACTIONS.USE_ABILITY ? '✨ 使用能力' : '😴 睡觉'}</h4>

      {/* 目标选择 */}
      {needsTarget && (
        <div className="target-select">
          <p className="select-label">选择目标:</p>
          <div className="player-targets">
            <button
              key="self"
              className={`target-btn ${target === ownHouseId ? 'selected' : ''}`}
              onClick={() => setTarget(ownHouseId)}
            >
              🏠 自己家
            </button>
            {alivePlayers.map(p => (
              <button
                key={p.id}
                className={`target-btn ${target === p.id ? 'selected' : ''}`}
                onClick={() => setTarget(p.id)}
              >
                <span className="target-name">{p.name}</span>
                {p.heavyInjury && <span className="target-tag">重伤</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 能力参数（根据角色不同） */}
      {action === NIGHT_ACTIONS.USE_ABILITY && (
        <AbilityOptions
          myRole={myRole}
          myPrivate={myPrivate}
          ability={ability}
          setAbility={setAbility}
          target={target}
          alivePlayers={alivePlayers}
          nightStep={nightStep}
        />
      )}

      {/* 提交 */}
      <button
        className="btn btn-primary btn-large submit-btn"
        onClick={onSubmit}
        disabled={!canSubmit}
      >
        确认提交
      </button>
    </div>
  );
}

// ==================== 角色能力选项 ====================

function AbilityOptions({ myRole, myPrivate, ability, setAbility, target, alivePlayers, nightStep }) {
  switch (myRole) {
    case ROLES.ALPHA_WOLF:
      return <AlphaWolfOptions ability={ability} setAbility={setAbility} myPrivate={myPrivate} nightStep={nightStep} />;
    case ROLES.GUARD:
      return <p className="ability-note">🏠 前往该玩家家中进行守护（如对方出门则无效）</p>;
    case ROLES.WEREWOLF:
      return <WolfOptions ability={ability} setAbility={setAbility} />;
    case ROLES.SEER:
      return <SeerOptions ability={ability} setAbility={setAbility} />;
    case ROLES.POISON_WITCH:
      return <PoisonWitchOptions ability={ability} setAbility={setAbility} myPrivate={myPrivate} target={target} alivePlayers={alivePlayers} />;
    case ROLES.HEAL_WITCH:
      return <HealWitchOptions ability={ability} setAbility={setAbility} myPrivate={myPrivate} target={target} alivePlayers={alivePlayers} />;
    case ROLES.HUNTER:
      return <HunterOptions ability={ability} setAbility={setAbility} myPrivate={myPrivate} />;
    default:
      return null;
  }
}

function AlphaWolfOptions({ ability, setAbility, myPrivate, nightStep }) {
  const toggle = (key) => setAbility(prev => ({ ...prev, [key]: !prev[key] }));
  const canInfect = !myPrivate?.hasUsedInfect && !myPrivate?.hasKilled;
  // 种狼步骤只能变身/感染；刀人在狼人步骤进行
  const isWolfStep = nightStep === 'WEREWOLF';
  const canKill = isWolfStep && myPrivate?.isTransformed && !myPrivate?.hasKilled;

  return (
    <div className="ability-options">
      {!isWolfStep && !myPrivate?.isTransformed && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.transform} onChange={() => toggle('transform')} />
          <span>🐺 变狼（变狼后可在狼人步骤与同伴一起刀人）</span>
        </label>
      )}
      {!isWolfStep && canInfect && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.infect} onChange={() => toggle('infect')} />
          <span>🦠 感染目标（下个夜晚生效；使用后当前夜晚算狼人）</span>
        </label>
      )}
      {isWolfStep && canKill && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.kill} onChange={() => toggle('kill')} />
          <span>🔪 刀人（作为狼群一员选择击杀目标）</span>
        </label>
      )}
      {isWolfStep && myPrivate?.isTransformed && !canKill && (
        <p className="ability-note" style={{color:'#888', fontSize:'0.9em'}}>🐺 你已变狼，今晚随狼群一起行动（本步骤自动视为刀人目标选择）</p>
      )}
    </div>
  );
}

function WolfOptions({ ability, setAbility }) {
  return (
    <div className="ability-options">
      <label className="ability-check">
        <input type="checkbox" checked={!!ability.kill} onChange={() => setAbility(prev => ({ ...prev, kill: !prev.kill }))} />
        <span>🔪 击杀目标（注意：锁定的是人，不是屋子）</span>
      </label>
    </div>
  );
}

function SeerOptions({ ability, setAbility }) {
  return (
    <div className="ability-options">
      <label className="ability-check">
        <input type="checkbox" checked={!!ability.check} onChange={() => setAbility(prev => ({ ...prev, check: !prev.check }))} />
        <span>🔮 查验目标是否是好人</span>
      </label>
    </div>
  );
}

function PoisonWitchOptions({ ability, setAbility, myPrivate, target, alivePlayers }) {
  return (
    <div className="ability-options">
      <label className="ability-check">
        <input type="checkbox" checked={!!ability.lethalPoison} onChange={() => setAbility(prev => ({ ...prev, lethalPoison: !prev.lethalPoison, lethalPoisonTarget: target }))} />
        <span>☠️ 使用烈性毒药（毒死目标屋子中所有人）</span>
      </label>
      {myPrivate?.hasPotion && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.potion} onChange={() => setAbility(prev => ({ ...prev, potion: !prev.potion, potionTarget: target }))} />
          <span>💊 使用药水救人（不能治疗守卫重伤）</span>
        </label>
      )}
    </div>
  );
}

function HealWitchOptions({ ability, setAbility, myPrivate, target, alivePlayers }) {
  return (
    <div className="ability-options">
      {myPrivate?.hasPotion && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.heal} onChange={() => setAbility(prev => ({ ...prev, heal: !prev.heal, healTarget: target }))} />
          <span>💚 使用万能药（可治疗一切，包括守卫重伤）</span>
        </label>
      )}
      {myPrivate?.hasPoison && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.poison} onChange={() => setAbility(prev => ({ ...prev, poison: !prev.poison, poisonTarget: target }))} />
          <span>🧪 使用毒药（单目标；目标离开屋子则失效或转移）</span>
        </label>
      )}
    </div>
  );
}

function HunterOptions({ ability, setAbility, myPrivate }) {
  const toggleWeapon = (weapon) => setAbility(prev => ({ ...prev, [weapon]: !prev[weapon] }));
  return (
    <div className="ability-options">
      <p className="weapon-note">🔫 选择携带的武器（只有带出门才会腐蚀，留在家中安全）:</p>
      <label className="ability-check">
        <input type="checkbox" checked={!!ability.hasRifle} onChange={() => toggleWeapon('hasRifle')} />
        <span>🔫 猎枪 — 观察目标是否出门，可以射杀（带出门会腐蚀，留在家中安全）</span>
      </label>
      <label className="ability-check">
        <input type="checkbox" checked={!!ability.hasBlunderbuss} onChange={() => toggleWeapon('hasBlunderbuss')} />
        <span>💥 短火铳 — 受到攻击时反杀（带出门会腐蚀，只能保一晚）</span>
      </label>
      {ability.hasRifle && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.useRifle} onChange={() => setAbility(prev => ({ ...prev, useRifle: !prev.useRifle, rifleTarget: target }))} />
          <span>🎯 使用猎枪射杀目标（开枪后猎枪消耗，无论是否出门）</span>
        </label>
      )}
    </div>
  );
}

// ==================== 辅助函数 ====================

function checkIsMyTurn(role, nightStep, myPrivate, round) {
  switch (nightStep) {
    case NIGHT_STEPS.HUNTER:
      return role === ROLES.HUNTER && round >= 2;
    case NIGHT_STEPS.ALPHA_WOLF:
      return role === ROLES.ALPHA_WOLF;
    case NIGHT_STEPS.GUARD:
      return role === ROLES.GUARD;
    case NIGHT_STEPS.WEREWOLF:
      // 普通狼人 + 种狼（种狼在变身/感染后算狼人群，私密状态可能尚未更新故一律放行）
      return role === ROLES.WEREWOLF || role === ROLES.ALPHA_WOLF;
    case NIGHT_STEPS.SEER:
      return role === ROLES.SEER;
    case NIGHT_STEPS.POISON_WITCH:
      return role === ROLES.POISON_WITCH;
    case NIGHT_STEPS.HEAL_WITCH:
      return role === ROLES.HEAL_WITCH;
    case NIGHT_STEPS.VILLAGER:
      return role === ROLES.VILLAGER;
    default:
      return false;
  }
}

function shouldBeAwake(role, nightStep) {
  // 狼人在种狼步骤不醒，除非是种狼
  if (nightStep === NIGHT_STEPS.ALPHA_WOLF && role === ROLES.WEREWOLF) return false;
  // 守卫在猎人步骤不醒
  if (nightStep === NIGHT_STEPS.HUNTER && role === ROLES.GUARD) return false;
  return true;
}

function isVillagerRole(role) {
  return role === ROLES.VILLAGER;
}

function getAbilityDesc(role) {
  const descs = {
    [ROLES.ALPHA_WOLF]: '变狼 / 感染 / 刀人',
    [ROLES.GUARD]: '守护一个人（去其家中）',
    [ROLES.WEREWOLF]: '刀人（锁定人，不锁定屋）',
    [ROLES.SEER]: '查验一个人是否是好人',
    [ROLES.POISON_WITCH]: '烈性毒药 / 药水',
    [ROLES.HEAL_WITCH]: '万能药 / 毒药',
    [ROLES.HUNTER]: '观察 + 猎枪 / 短火铳',
  };
  return descs[role] || '';
}
