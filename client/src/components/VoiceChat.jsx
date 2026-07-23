// ============================================================
// 语音聊天面板 —— 权限确认 + PTT按钮 + 说话指示灯
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';

export default function VoiceChat({ voiceChat, players, myId }) {
  const {
    isVoiceJoined, isPTT, speakingPeers, error,
    joinVoice, leaveVoice, requestMicPermission, setPTT,
    resumeAudioContext, permissionState, isSecureCtx,
    testSpeaker, speakerTestResult,
  } = voiceChat;

  const [permissionPhase, setPermissionPhase] = useState('idle');
  const [permissionError, setPermissionError] = useState(null);
  const [speakerTesting, setSpeakerTesting] = useState(false);

  // 用户点击"加入语音"
  const handleStartVoiceFlow = useCallback(() => {
    if (resumeAudioContext) resumeAudioContext();
    setPermissionPhase('asking');
  }, [resumeAudioContext]);

  // 用户同意权限请求
  const handleGrantPermission = useCallback(async () => {
    setPermissionPhase('requesting');
    setPermissionError(null);

    try {
      const micGranted = await requestMicPermission();
      if (!micGranted) {
        setPermissionPhase('denied');
        setPermissionError('麦克风权限被拒绝。请检查：1.浏览器是否HTTPS/localhost 2.系统麦克风是否插入 3.浏览器权限设置');
        return;
      }

      setPermissionPhase('granted');
      joinVoice();
    } catch (e) {
      setPermissionPhase('denied');
      setPermissionError(e.message || '未知错误');
    }
  }, [requestMicPermission, joinVoice, voiceChat.error]);

  const handleDenyPermission = useCallback(() => {
    setPermissionPhase('idle');
    setPermissionError(null);
  }, []);

  const handleRetry = useCallback(() => {
    setPermissionPhase('idle');
    setPermissionError(null);
  }, []);

  // 测试扬声器
  const handleTestSpeaker = useCallback(async () => {
    setSpeakerTesting(true);
    try {
      await testSpeaker?.();
    } finally {
      setSpeakerTesting(false);
    }
  }, [testSpeaker]);

  // ====== HTTP 不安全上下文警告 ======
  if (!isSecureCtx) {
    return (
      <div className="voice-chat">
        <div className="voice-error">
          <span className="voice-error-icon">🔒</span>
          <strong>语音功能不可用</strong>
          <p style={{margin: '8px 0', fontSize: '0.82em', color: 'var(--text-secondary)'}}>
            当前浏览器因安全策略禁止了麦克风访问。
          </p>
          <div style={{fontSize: '0.78em', color: 'var(--text-muted)', marginBottom: '8px'}}>
            <p><strong>✅ 解决方案（任选其一）：</strong></p>
            <p>1. 使用 <strong>桌面客户端</strong>（推荐，无限制）</p>
            <p>2. 通过 <strong>http://localhost:4000</strong> 访问（本地开发）</p>
            <p>3. 通过 <strong>HTTPS</strong> 访问（需配置证书）</p>
          </div>
          {speakerTestResult && (
            <p style={{fontSize: '0.78em', color: 'var(--text-muted)', marginTop: 6}}>
              {speakerTestResult}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ====== 已加入语音 ======
  if (isVoiceJoined) {
    const handlePTTDown = (e) => {
      e.preventDefault();
      if (setPTT) setPTT(true);
    };
    const handlePTTUp = (e) => {
      e.preventDefault();
      if (setPTT) setPTT(false);
    };

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
            onTouchCancel={handlePTTUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            {isPTT ? '🔴 说话中（松开停止）' : '🎙️ 按住说话'}
          </button>
          <span className="ptt-hint">按住按钮或空格键说话 · PTT按键模式</span>
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
            <span className="no-speakers">等待其他玩家加入语音...</span>
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
          <h4>语音聊天需要权限</h4>
          <p>帷幕之地需要使用你的<strong>麦克风</strong>进行语音交流，以及<strong>扬声器</strong>播放其他玩家的声音。</p>
          <p className="voice-permission-note">
            PTT按键说话模式 — 只有按住按钮时才发送语音，保护你的隐私。
          </p>
          <div className="voice-permission-buttons">
            <button className="btn btn-primary" onClick={handleGrantPermission}>
              ✅ 允许麦克风权限
            </button>
            <button className="btn btn-ghost" onClick={handleTestSpeaker} disabled={speakerTesting}>
              {speakerTesting ? '⏳ 测试中...' : '🔊 先测试扬声器'}
            </button>
            <button className="btn btn-ghost" onClick={handleDenyPermission}>
              ❌ 暂不使用语音
            </button>
          </div>
          {speakerTestResult && (
            <p style={{fontSize: '0.78em', color: speakerTestResult.includes('成功') ? 'var(--success)' : 'var(--text-muted)', marginTop: 8}}>
              {speakerTestResult}
            </p>
          )}
          <p className="voice-permission-note" style={{marginTop: 12}}>
            💡 <strong>提示：</strong>如果浏览器弹出权限对话框，请点击<strong>「允许」</strong>。
            <br/>如果误点了「禁止」，可以在地址栏左侧 🔒 图标中重新开启。
          </p>
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
          <p>正在请求麦克风权限...</p>
          <p className="voice-permission-note">浏览器会弹出权限对话框 — 请点击「允许」</p>
        </div>
      </div>
    );
  }

  // ====== 被拒绝 ======
  if (permissionPhase === 'denied') {
    return (
      <div className="voice-chat">
        <div className="voice-error">
          <span className="voice-error-icon">🚫</span>
          <strong>麦克风权限未授予</strong>
          <p style={{margin: '6px 0', fontSize: '0.82em'}}>
            {permissionError || voiceChat.error || '无法访问麦克风'}
          </p>
          <div style={{fontSize: '0.78em', color: 'var(--text-secondary)', lineHeight: 1.6}}>
            <p><strong>🔧 如何恢复权限：</strong></p>
            <p>1. 点击地址栏左侧的 <strong>🔒/ⓘ 图标</strong></p>
            <p>2. 找到「麦克风」选项 → 改为<strong>「允许」</strong></p>
            <p>3. <strong>刷新页面</strong>后重新加入语音</p>
          </div>
          <button
            className="btn btn-small btn-secondary"
            style={{marginTop: 8, width: '100%'}}
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
          <span className="voice-error-icon">⚠️</span>
          <strong>语音出错</strong>
          <p style={{margin: '6px 0', fontSize: '0.82em', whiteSpace: 'pre-line'}}>{error}</p>
          <button
            className="btn btn-small btn-secondary"
            style={{marginTop: 8, width: '100%'}}
            onClick={handleRetry}
          >
            🔄 重新尝试
          </button>
        </div>
      </div>
    );
  }

  // ====== 初始状态 ======
  return (
    <div className="voice-chat">
      <div className="voice-join-prompt">
        <span className="voice-join-icon">🎤</span>
        <p className="voice-prompt-text">加入语音与其他玩家交流</p>
        <button className="voice-join-btn" onClick={handleStartVoiceFlow}>
          🎤 加入语音
        </button>
        <div className="voice-extra-actions">
          <button
            className="btn btn-ghost btn-small"
            onClick={handleTestSpeaker}
            disabled={speakerTesting}
            style={{marginTop: 8, width: '100%'}}
          >
            {speakerTesting ? '⏳ 测试中...' : '🔊 测试扬声器'}
          </button>
        </div>
        {speakerTestResult && (
          <p style={{fontSize: '0.75em', color: 'var(--text-muted)', marginTop: 6}}>
            {speakerTestResult}
          </p>
        )}
        <p style={{fontSize: '0.7em', color: 'var(--text-muted)', marginTop: 6}}>
          PTT按键说话 · 按住空格键或点击按钮
        </p>
      </div>
    </div>
  );
}

// VoiceChatContainer 包装器
export function VoiceChatContainer({ voiceChat, players, myId }) {
  return <VoiceChat voiceChat={voiceChat} players={players} myId={myId} />;
}
