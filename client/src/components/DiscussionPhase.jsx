// ============================================================
// 讨论阶段 — 投票后轮流发言，每人30秒
// 按 U 键语音发言，按 Q 键跳过自己的发言
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';

export default function DiscussionPhase({ socket, playerName, voiceChat }) {
  const { gameState } = socket;
  const { currentSpeakerId, discussionOrder, discussionTimeLeft } = gameState;
  const myPlayerId = socket.playerId;

  const isMyTurn = currentSpeakerId === myPlayerId;
  const currentSpeaker = gameState.players?.find(p => p.id === currentSpeakerId);
  const myIndex = discussionOrder.indexOf(myPlayerId);
  const currentIndex = discussionOrder.indexOf(currentSpeakerId);

  // 语音状态
  const [voiceActive, setVoiceActive] = useState(false);

  // 按 Q 跳过自己的发言
  const handleSkip = useCallback(() => {
    if (isMyTurn && socket.socket) {
      socket.socket.emit('discussion:skip');
    }
  }, [isMyTurn, socket.socket]);

  // 按 U 切换语音
  const handleToggleVoice = useCallback(() => {
    if (!isMyTurn) return;
    const next = !voiceActive;
    setVoiceActive(next);
    if (voiceChat?.setPTT) {
      voiceChat.setPTT(next);
    }
    if (voiceChat?.resumeAudioContext) {
      voiceChat.resumeAudioContext();
    }
  }, [isMyTurn, voiceActive, voiceChat]);

  // 键盘监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        handleSkip();
      }
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        handleToggleVoice();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip, handleToggleVoice]);

  // 发言者切换时自动关闭语音
  useEffect(() => {
    if (!isMyTurn && voiceActive) {
      setVoiceActive(false);
      if (voiceChat?.setPTT) voiceChat.setPTT(false);
    }
  }, [currentSpeakerId]);

  return (
    <div className="discussion-panel">
      <div className="discussion-header">
        <h3>🗣️ 轮流发言</h3>
        <span className="discussion-round">第 {gameState.round} 轮</span>
      </div>

      {/* 当前发言者 */}
      <div className={`discussion-current ${isMyTurn ? 'my-turn' : ''}`}>
        <div className="discussion-speaker">
          <span className="speaker-icon">{isMyTurn ? '🎙️' : '👤'}</span>
          <span className="speaker-name">
            {isMyTurn ? `轮到你了！(${playerName})` : `当前发言: ${currentSpeaker?.name || '...'}`}
          </span>
        </div>
        <div className={`discussion-timer ${discussionTimeLeft <= 10 ? 'urgent' : ''}`}>
          ⏱ {discussionTimeLeft || 0}s
        </div>
      </div>

      {/* 操作按钮 (仅自己的回合) */}
      {isMyTurn && (
        <div className="discussion-actions">
          <button
            className={`discussion-btn voice-btn ${voiceActive ? 'active' : ''}`}
            onClick={handleToggleVoice}
          >
            {voiceActive ? '🔴 关闭语音' : '🎤 语音发言 (U)'}
          </button>
          <button className="discussion-btn skip-btn" onClick={handleSkip}>
            ⏭ 跳过发言 (Q)
          </button>
        </div>
      )}

      {!isMyTurn && (
        <div className="discussion-waiting">
          <div className="night-spinner" />
          <p>等待 {currentSpeaker?.name || '...'} 发言完毕...</p>
        </div>
      )}

      {/* 发言顺序 */}
      <div className="discussion-order">
        <h4>发言顺序</h4>
        <div className="discussion-order-list">
          {discussionOrder.map((pid, idx) => {
            const p = gameState.players?.find(pl => pl.id === pid);
            const isDone = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const isMe = pid === myPlayerId;
            return (
              <div
                key={pid}
                className={`order-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isMe ? 'me' : ''}`}
              >
                <span className="order-idx">{idx + 1}</span>
                <span className="order-name">{p?.name || '?'}{isMe ? ' (你)' : ''}</span>
                {isDone && <span className="order-done">✅</span>}
                {isCurrent && <span className="order-speaking">🔊</span>}
                {!isDone && !isCurrent && <span className="order-waiting">⏳</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 快捷键提示 */}
      <div className="discussion-help">
        <kbd>U</kbd> 语音发言 · <kbd>Q</kbd> 跳过发言
      </div>
    </div>
  );
}
