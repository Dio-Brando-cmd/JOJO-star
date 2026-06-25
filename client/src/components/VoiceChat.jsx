// ============================================================
// 语音聊天面板 —— 权限确认 + PTT按钮 + 说话指示灯
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';

export default function VoiceChat({ voiceChat, players, myId }) {
  const { isVoiceJoined, isPTT, speakingPeers, error, joinVoice, leaveVoice, requestMicPermission, setPTT } = voiceChat;

  // 权限流程状态
  const [permissionPhase, setPermissionPhase] = useState('idle'); // idle | asking | requesting | granted | denied
  const [permissionError, setPermissionError] = useState(null);

  // 用户点击"加入语音"
  const handleStartVoiceFlow = useCallback(() => {
    setPermissionPhase('asking');
  }, []);

  // 用户同意权限请求
  const handleGrantPermission = useCallback(async () => {
    setPermissionPhase('requesting');
    setPermissionError(null);

    try {
      // 1. 请求麦克风权限
      const micGranted = await requestMicPermission();
      if (!micGranted) {
        setPermissionPhase('denied');
        setPermissionError('麦克风权限被拒绝，无法使用语音');
        return;
      }

      // 2. 尝试枚举扬声器设备（非必须，但尝试获取）
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const speakers = devices.filter(d => d.kind === 'audiooutput');
          const mics = devices.filter(d => d.kind === 'audioinput');
          console.log(`[VoiceChat] 设备: ${mics.length} 个麦克风, ${speakers.length} 个扬声器`);
        }
      } catch (e) {
        // 扬声器枚举失败不影响语音
        console.log('[VoiceChat] 扬声器枚举跳过:', e.message);
      }

      // 3. 成功 — 加入语音
      setPermissionPhase('granted');
      joinVoice();
    } catch (e) {
      setPermissionPhase('denied');
      setPermissionError(e.message || '未知错误');
    }
  }, [requestMicPermission, joinVoice]);

  // 用户拒绝
  const handleDenyPermission = useCallback(() => {
    setPermissionPhase('idle');
    setPermissionError(null);
  }, []);

  // 重试
  const handleRetry = useCallback(() => {
    setPermissionPhase('idle');
    setPermissionError(null);
  }, []);

  // ====== 已加入语音 ======
  if (isVoiceJoined) {
    const handlePTTDown = () => { if (setPTT) setPTT(true); };
    const handlePTTUp = () => { if (setPTT) setPTT(false); };

    return (
      <div className="voice-chat voice-chat-active">
        <div className="voice-header">
          <span className="voice-title">🎤 语音聊天</span>
          <span className="voice-status-dot active" />
          <button className="voice-leave-btn" onClick={leaveVoice} title="离开语音">
            ✕
          </button>
        </div>

        <div className="voice-ptt-section">
          <button
            className={`ptt-button ${isPTT ? 'active' : ''}`}
            onMouseDown={handlePTTDown}
            onMouseUp={handlePTTUp}
            onMouseLeave={handlePTTUp}
            onTouchStart={handlePTTDown}
            onTouchEnd={handlePTTUp}
          >
            {isPTT ? '🔴 说话中...' : '🎙️ 按住说话'}
          </button>
          <span className="ptt-hint">或按住空格键说话</span>
        </div>

        <div className="voice-speakers">
          {players?.filter(p => p.id !== myId && p.alive).map(p => {
            const isSpeaking = speakingPeers?.has(p.id);
            return (
              <div key={p.id} className={`speaker-item ${isSpeaking ? 'speaking' : ''}`}>
                <span className={`speaker-dot ${isSpeaking ? 'active' : ''}`} />
                <span className="speaker-name">{p.name}</span>
                {isSpeaking && <span className="speaking-wave">〰️</span>}
              </div>
            );
          })}
          {players?.filter(p => p.id !== myId && p.alive).length === 0 && (
            <span className="no-speakers">等待其他玩家...</span>
          )}
        </div>
      </div>
    );
  }

  // ====== 权限确认弹窗 ======
  if (permissionPhase === 'asking') {
    return (
      <div className="voice-chat voice-permission-modal">
        <div className="voice-permission-content">
          <span className="voice-permission-icon">🎤</span>
          <h4>语音聊天权限</h4>
          <p>狼人杀需要使用你的<strong>麦克风</strong>来进行语音交流。</p>
          <p className="voice-permission-note">
            只有在你按住说话按钮时才会发送语音，你的隐私受到保护。
          </p>
          <div className="voice-permission-buttons">
            <button className="btn btn-primary" onClick={handleGrantPermission}>
              ✅ 允许
            </button>
            <button className="btn btn-ghost" onClick={handleDenyPermission}>
              ❌ 拒绝
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ====== 请求中 ======
  if (permissionPhase === 'requesting') {
    return (
      <div className="voice-chat voice-permission-modal">
        <div className="voice-permission-content">
          <div className="night-spinner" style={{margin: '0 auto 12px'}} />
          <p>正在获取麦克风权限...</p>
          <p className="voice-permission-note">浏览器会弹出权限请求对话框</p>
        </div>
      </div>
    );
  }

  // ====== 被拒绝 ======
  if (permissionPhase === 'denied') {
    return (
      <div className="voice-chat">
        <div className="voice-error">
          <span>🎤 {permissionError || '无法访问麦克风'}</span>
          <p className="voice-permission-note" style={{marginTop: 8}}>
            请在浏览器设置中允许麦克风访问，然后重试
          </p>
          <button
            className="btn btn-small btn-secondary"
            style={{marginTop:8,width:'100%'}}
            onClick={handleRetry}
          >
            🔄 重新尝试
          </button>
        </div>
      </div>
    );
  }

  // ====== 服务端错误 ======
  if (error) {
    return (
      <div className="voice-chat">
        <div className="voice-error">
          <span>🎤 {error}</span>
          <button
            className="btn btn-small btn-secondary"
            style={{marginTop:8,width:'100%'}}
            onClick={handleRetry}
          >
            🔄 重新尝试
          </button>
        </div>
      </div>
    );
  }

  // ====== 初始状态：邀请加入 ======
  return (
    <div className="voice-chat">
      <div className="voice-join-prompt">
        <span className="voice-join-icon">🎤</span>
        <p className="voice-prompt-text">加入语音与其他玩家交流</p>
        <button className="voice-join-btn" onClick={handleStartVoiceFlow}>
          🎤 加入语音
        </button>
      </div>
    </div>
  );
}

// VoiceChatContainer 包装器
export function VoiceChatContainer({ voiceChat, players, myId }) {
  return <VoiceChat voiceChat={voiceChat} players={players} myId={myId} />;
}
