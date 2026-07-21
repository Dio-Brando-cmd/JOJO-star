// ============================================================
// 聊天框组件 — 气泡/时间戳/打字指示器
// ============================================================

import React, { useState, useRef, useEffect } from 'react';

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatBox({ socket, playerName }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    socket.sendChatMessage(input.trim());
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [socket.chatMessages]);

  const messages = socket.chatMessages || [];

  return (
    <div className="chat-box">
      <h4 className="chat-title">💬 聊天</h4>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">暂无消息，开始聊天吧</p>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.playerId === socket.playerId;
          const isSystem = msg.type === 'system';

          if (isSystem) {
            return (
              <div key={i} className="chat-msg chat-msg-system">
                <span className="chat-system-text">{msg.message}</span>
              </div>
            );
          }

          const showAuthor = i === 0 || messages[i - 1]?.playerId !== msg.playerId;

          return (
            <div key={i} className={`chat-msg ${isOwn ? 'chat-msg-own' : 'chat-msg-other'}`}>
              {showAuthor && !isOwn && (
                <span className="chat-author">{msg.playerName}</span>
              )}
              <div className="chat-bubble-row">
                <span className="chat-bubble">{msg.message}</span>
                <span className="chat-time">{formatTime(msg.time || Date.now())}</span>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入消息..."
          maxLength={200}
        />
        <button type="submit" className="btn btn-small btn-primary chat-send-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
