// ============================================================
// 白天阶段 —— 讨论 + 触发投票 + 追猎者射击
// ============================================================

import React from 'react';
import { ROLES, ROLE_NAMES } from '../utils/constants';

export default function DayPhase({ socket }) {
  const { gameState, privateState } = socket;
  const isHost = gameState.hostId === socket.playerId;

  const myRole = privateState?.myRole;
  const myPrivate = privateState?.myPrivateState;
  const isHunter = myRole === ROLES.FLAME_TRACKER;
  const canShoot = isHunter && myPrivate?.hasRifle && myPrivate?.rifleUsable;

  return (
    <div className="day-panel">
      <div className="day-header">
        <h3>☀️ 白天 — 第 {gameState.round} 回合</h3>
        <p className="day-subtitle">讨论阶段 — 自由发言，辨识蚀者</p>
      </div>

      {/* 死亡公告 */}
      {gameState.nightLog?.filter(e => e.type === 'death').length > 0 && (
        <div className="death-announcement">
          <h4>💀 昨晚死亡:</h4>
          {gameState.nightLog
            .filter(e => e.type === 'death')
            .map((e, i) => {
              const p = gameState.players?.find(pl => pl.id === e.player);
              return <p key={i} className="death-name">{p?.name || e.player}</p>;
            })}
        </div>
      )}

      {gameState.nightLog?.filter(e => e.type === 'death').length === 0 && (
        <div className="peace-announcement">
          <p>🕊️ 昨晚是平安夜，没有人死亡</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="day-actions">
        {isHost && (
          <button className="btn btn-primary" onClick={socket.startVote}>
            🗳️ 开始投票
          </button>
        )}
        {!isHost && (
          <p className="waiting-hint">等待主持人开始投票...</p>
        )}
      </div>

      {/* 追猎者白昼追猎 */}
      {canShoot && (
        <div className="hunter-day-shoot">
          <h4>🔫 追猎者射击（白天必杀）</h4>
          <p>选择你要射杀的目标:</p>
          <div className="shoot-targets">
            {gameState.players
              ?.filter(p => p.alive && p.id !== socket.playerId)
              .map(p => (
                <button
                  key={p.id}
                  className="btn btn-danger shoot-btn"
                  onClick={() => { if (window.confirm(`确认射杀 ${p.name}?`)) socket.hunterDayShoot(p.id); }}
                >
                  🔫 {p.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
