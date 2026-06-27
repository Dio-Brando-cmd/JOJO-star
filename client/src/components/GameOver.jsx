// ============================================================
// 游戏结束界面 —— 展示胜者和所有角色
// ============================================================

import React from 'react';
import { ROLE_NAMES, TEAMS, TEAM_NAMES } from '../utils/constants';
import RoleIllustration from './RoleIllustration';

export default function GameOver({ gameState, privateState, playerName, onBackToLobby }) {
  const result = gameState?.gameResult;
  const players = gameState?.players || [];
  const myTeam = privateState?.myTeam;
  const won = myTeam === result?.winner;

  return (
    <div className="screen gameover-screen">
      <div className="gameover-card">
        <div className={`gameover-banner ${won ? 'won' : 'lost'}`}>
          <span className="gameover-icon">{won ? '🎉' : '💀'}</span>
          <h2>{won ? '你赢了！' : '你输了'}</h2>
          <p className="gameover-reason">{result?.reason}</p>
          <p className="winner-team">
            🏆 {TEAM_NAMES[result?.winner]} 获胜
          </p>
        </div>

        {/* 所有玩家角色展示 */}
        <div className="role-reveal">
          <h3>🃏 身份揭晓</h3>
          <div className="reveal-grid">
            {players.map(p => {
              const roleName = ROLE_NAMES[p.role] || '未知';
              const teamName = p.team ? TEAM_NAMES[p.team] : '';
              return (
                <div key={p.id} className={`reveal-item ${!p.alive ? 'dead' : ''}`}>
                  <RoleIllustration role={p.role} size="small" />
                  <div className="reveal-info">
                    <span className="reveal-name">
                      {p.name}
                      {p.id === gameState.hostId && ' 👑'}
                    </span>
                    <span className="reveal-role">
                      {p.role ? roleName : '???'}
                    </span>
                    {teamName && <span className={`reveal-team ${p.team}`}>{teamName}</span>}
                    <span className={`reveal-status ${p.alive ? 'alive' : 'dead'}`}>
                      {p.alive ? '✅ 存活' : '💀 出局'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button className="btn btn-primary btn-large" onClick={onBackToLobby}>
          返回大厅
        </button>
      </div>
    </div>
  );
}
