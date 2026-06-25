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

  const [action, setAction] = useState(null);
  const [target, setTarget] = useState(null);
  const [ability, setAbility] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const submittingRef = useRef(false);

  // 当夜晚步骤变化时重置状态（新步骤 = 新机会）
  useEffect(() => {
    setAction(null);
    setTarget(null);
    setAbility({});
    setSubmitted(false);
    setSubmitError(null);
    submittingRef.current = false;
  }, [nightStep]);

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
          <h3>✅ 行动已提交</h3>
          <p>等待其他玩家完成行动...</p>
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
    </div>
  );
}

// ==================== 行动类型选择 ====================

function ActionSelector({ myRole, myPrivate, round, onSelect }) {
  const canGoOut = true; // 所有角色都可以出门

  return (
    <div className="action-selector">
      {/* 出门 */}
      <button className="action-card" onClick={() => onSelect(NIGHT_ACTIONS.GO_OUT)}>
        <span className="action-icon">🚶</span>
        <span className="action-name">出门</span>
        <span className="action-desc">离开自己的屋子</span>
      </button>

      {/* 使用能力（根据角色不同） */}
      {!isVillagerRole(myRole) && (
        <button className="action-card" onClick={() => onSelect(NIGHT_ACTIONS.USE_ABILITY)}>
          <span className="action-icon">✨</span>
          <span className="action-name">使用能力</span>
          <span className="action-desc">{getAbilityDesc(myRole)}</span>
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

function ActionDetail({ action, myRole, myPrivate, alivePlayers, allPlayers, target, setTarget, ability, setAbility, onBack, onSubmit }) {
  const needsTarget = action !== NIGHT_ACTIONS.SLEEP;

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
              className={`target-btn ${target === socketPlayerId() ? 'selected' : ''}`}
              onClick={() => setTarget(null)}
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

function AbilityOptions({ myRole, myPrivate, ability, setAbility, target, alivePlayers }) {
  switch (myRole) {
    case ROLES.ALPHA_WOLF:
      return <AlphaWolfOptions ability={ability} setAbility={setAbility} myPrivate={myPrivate} />;
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

function AlphaWolfOptions({ ability, setAbility, myPrivate }) {
  const toggle = (key) => setAbility(prev => ({ ...prev, [key]: !prev[key] }));
  const canInfect = !myPrivate?.hasUsedInfect;
  // 种狼可在同一晚变狼+刀人：变狼 action 先执行，然后刀人
  const canKill = myPrivate?.isTransformed || !myPrivate?.isTransformed;

  return (
    <div className="ability-options">
      {!myPrivate?.isTransformed && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.transform} onChange={() => toggle('transform')} />
          <span>🐺 变狼（变狼前不会被预言家查出；变狼后可在同一晚刀人）</span>
        </label>
      )}
      {canInfect && !ability.kill && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.infect} onChange={() => toggle('infect')} />
          <span>🦠 感染目标（下个夜晚生效；使用后当前夜晚算狼人；与刀人互斥）</span>
        </label>
      )}
      {canKill && !ability.infect && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.kill} onChange={() => toggle('kill')} />
          <span>🔪 刀人（刀人后无法再使用感染；可与变狼在同一晚）</span>
        </label>
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
      <p className="weapon-note">🔫 选择携带的武器（不带出门则会腐蚀）:</p>
      <label className="ability-check">
        <input type="checkbox" checked={!!ability.hasRifle} onChange={() => toggleWeapon('hasRifle')} />
        <span>🔫 猎枪 — 观察目标是否出门，可以射杀（不带出门会腐蚀）</span>
      </label>
      <label className="ability-check">
        <input type="checkbox" checked={!!ability.hasBlunderbuss} onChange={() => toggleWeapon('hasBlunderbuss')} />
        <span>💥 短火铳 — 受到攻击时反杀（带出门只能保一晚）</span>
      </label>
      {ability.hasRifle && (
        <label className="ability-check">
          <input type="checkbox" checked={!!ability.useRifle} onChange={() => setAbility(prev => ({ ...prev, useRifle: !prev.useRifle, rifleTarget: target }))} />
          <span>🎯 使用猎枪射杀目标（今晚如没出门则猎枪腐蚀不可用）</span>
        </label>
      )}
    </div>
  );
}

// ==================== 辅助函数 ====================

function socketPlayerId() {
  return null; // placeholder for "own house" option
}

function checkIsMyTurn(role, nightStep, myPrivate, round) {
  switch (nightStep) {
    case NIGHT_STEPS.HUNTER:
      return role === ROLES.HUNTER && round >= 2;
    case NIGHT_STEPS.ALPHA_WOLF:
      return role === ROLES.ALPHA_WOLF;
    case NIGHT_STEPS.GUARD:
      return role === ROLES.GUARD;
    case NIGHT_STEPS.WEREWOLF:
      return role === ROLES.WEREWOLF || (role === ROLES.ALPHA_WOLF && (myPrivate?.isTransformed || myPrivate?.hasUsedInfect));
    case NIGHT_STEPS.SEER:
      return role === ROLES.SEER;
    case NIGHT_STEPS.POISON_WITCH:
      return role === ROLES.POISON_WITCH;
    case NIGHT_STEPS.HEAL_WITCH:
      return role === ROLES.HEAL_WITCH;
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
