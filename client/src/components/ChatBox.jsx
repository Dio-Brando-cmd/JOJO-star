// ============================================================
// 聊天框组件
// ============================================================

import React, { useState, useRef, useEffect } from 'react';

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

  return (
    <div className="chat-box">
      <h4 className="chat-title">💬 聊天</h4>

      <div className="chat-messages">
        {socket.chatMessages.length === 0 && (
          <p className="chat-empty">暂无消息</p>
        )}
        {socket.chatMessages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.playerId === socket.playerId ? 'own' : ''}`}>
            <span className="chat-author">{msg.playerName}</span>
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
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
        <button type="submit" className="btn btn-small">发送</button>
      </form>
    </div>
  );
}
