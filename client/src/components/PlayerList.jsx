// ============================================================
// 玩家列表面板
// ============================================================

import React from 'react';
import { ROLE_ICONS } from '../utils/constants';

export default function PlayerList({ players, privateState, myId, votes, seerCheckResults }) {
  if (!players) return null;

  // 判断是否能看到某玩家的角色
  const canSeeRole = (player) => {
    if (!privateState) return false;
    if (player.id === myId) return true;
    if (!player.alive) return true;
    // 狼人相认
    if (privateState.myPrivateState?.knownWolves?.includes(player.id)) return true;
    return false;
  };

  const alivePlayers = players.filter(p => p.alive);
  const deadPlayers = players.filter(p => !p.alive);

  return (
    <div className="player-list">
      <h3 className="player-list-title">
        玩家 ({alivePlayers.length}/{players.length})
      </h3>

      {/* 存活玩家 */}
      <div className="player-list-group">
        {alivePlayers.map(p => (
          <PlayerItem
            key={p.id}
            player={p}
            isSelf={p.id === myId}
            showRole={canSeeRole(p)}
            votedFor={votes?.[p.id]}
            voters={getVoters(p.id, votes)}
            checkResult={seerCheckResults?.[p.id]}
          />
        ))}
      </div>

      {/* 死亡玩家 */}
      {deadPlayers.length > 0 && (
        <div className="player-list-group dead-group">
          <h4 className="dead-label">已出局</h4>
          {deadPlayers.map(p => (
            <PlayerItem
              key={p.id}
              player={p}
              isSelf={p.id === myId}
              showRole={true}
              dead
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerItem({ player, isSelf, showRole, dead, votedFor, voters, checkResult }) {
  const icon = ROLE_ICONS[player.role] || '❓';
  const hasVoters = voters && voters.length > 0;

  // 预言家查验反馈：金色=好人，银白=狼人
  let avatarStyle = {};
  if (checkResult === 'GOOD') {
    avatarStyle = { background: 'linear-gradient(135deg, #FFD700, #FFA500)', boxShadow: '0 0 10px rgba(255, 215, 0, 0.6)' };
  } else if (checkResult === 'WOLF') {
    avatarStyle = { background: 'linear-gradient(135deg, #C0C0C0, #808080)', boxShadow: '0 0 10px rgba(192, 192, 192, 0.6)' };
  }

  return (
    <div className={`player-item ${dead ? 'dead' : ''} ${isSelf ? 'self' : ''} ${hasVoters ? 'voted' : ''}`}>
      <div className="player-avatar" style={avatarStyle}>
        {showRole ? <span className="avatar-role">{icon}</span> : <span className="avatar-unknown">❓</span>}
      </div>
      <div className="player-info">
        <span className="player-name">
          {player.name}
          {player.isBot && <span className="bot-badge">🤖人机</span>}
          {isSelf && <span className="self-tag">你</span>}
          {player.heavyInjury && <span className="injury-tag">重伤</span>}
          {player.isGuarding && <span className="guard-tag">守护中</span>}
        </span>
        {showRole && player.role && (
          <span className="player-role-tag">{player.role === 'VILLAGER' ? `村民${player.villagerIndex || ''}` : ''}</span>
        )}
      </div>
      {dead && <span className="dead-mark">💀</span>}
      {hasVoters && <span className="vote-count">{voters.length}票</span>}
    </div>
  );
}

function getVoters(targetId, votes) {
  if (!votes) return [];
  return Object.entries(votes)
    .filter(([voterId, target]) => target === targetId)
    .map(([voterId]) => voterId);
}
