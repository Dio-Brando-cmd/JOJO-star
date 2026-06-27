// ============================================================
// 投票面板
// ============================================================

import React, { useState, useRef } from 'react';

export default function VotePanel({ socket }) {
  const { gameState } = socket;
  const [voted, setVoted] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const submittingRef = useRef(false); // 必须在组件顶层调用，不能放在条件分支后面

  const alivePlayers = gameState.players?.filter(p => p.alive && p.id !== socket.playerId) || [];
  const myVote = gameState.votes?.[socket.playerId];

  // 如果已投票
  if (voted || myVote !== undefined) {
    const votedTarget = gameState.players?.find(p => p.id === (myVote || selectedTarget));
    return (
      <div className="vote-panel">
        <h3>✅ 已投票</h3>
        <p>你投给了: <strong>{votedTarget?.name || '弃权'}</strong></p>
        <p className="waiting-hint">等待其他玩家投票...</p>

        {/* 实时票数 */}
        <VoteTally gameState={gameState} />
      </div>
    );
  }

  const handleVote = (targetId) => {
    if (submittingRef.current) return; // 防止重复提交
    submittingRef.current = true;
    setSelectedTarget(targetId);
    setVoted(true);
    socket.submitVote(targetId);
  };

  return (
    <div className="vote-panel">
      <h3>🗳️ 投票放逐</h3>
      <p className="vote-subtitle">选择你要放逐的玩家（或投弃权票）</p>

      <div className="vote-targets">
        {alivePlayers.map(p => (
          <button
            key={p.id}
            className="vote-btn"
            onClick={() => handleVote(p.id)}
          >
            <span className="vote-target-name">{p.name}</span>
          </button>
        ))}
        <button
          className="vote-btn abstain-btn"
          onClick={() => handleVote(null)}
        >
          <span className="vote-target-name">弃权</span>
        </button>
      </div>

      <VoteTally gameState={gameState} />
    </div>
  );
}

function VoteTally({ gameState }) {
  if (!gameState.votes) return null;

  const tally = {};
  gameState.players?.forEach(p => { if (p.alive) tally[p.id] = 0; });
  tally['ABSTAIN'] = 0;

  Object.values(gameState.votes).forEach(targetId => {
    if (targetId && tally[targetId] !== undefined) tally[targetId]++;
    else if (!targetId) tally['ABSTAIN']++;
  });

  return (
    <div className="vote-tally">
      <h4>当前票数</h4>
      {Object.entries(tally)
        .filter(([id, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => {
          const name = id === 'ABSTAIN' ? '弃权' : gameState.players?.find(p => p.id === id)?.name || id;
          return (
            <div key={id} className="tally-row">
              <span className="tally-name">{name}</span>
              <span className="tally-count">{count}票</span>
            </div>
          );
        })}
    </div>
  );
}
