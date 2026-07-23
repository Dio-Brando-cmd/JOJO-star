// ============================================================
// 大厅界面 —— 创建/加入房间 + 公开房间列表
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RoleGallery } from './RoleIllustration';
import RoleSelector from './RoleSelector';
import RoleIntroModal from './RoleIntroModal';
import SettingsPanel from './SettingsPanel';

export default function Lobby({ socket, playerName, bgm, onJoined, onChangeName }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [roomCode, setRoomCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showRoleIntro, setShowRoleIntro] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 创建房间选项
  const [createPrivate, setCreatePrivate] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [createMaxPlayers, setCreateMaxPlayers] = useState(12);

  // 公开房间列表
  const [publicRooms, setPublicRooms] = useState([]);
  const refreshTimerRef = useRef(null);

  const fetchLobby = useCallback(async () => {
    if (!socket.connected) return;
    const rooms = await socket.getLobbyList();
    setPublicRooms(rooms || []);
  }, [socket]);

  useEffect(() => {
    fetchLobby();
    // 使用服务器推送替代轮询
    if (socket.socket) {
      socket.socket.on('lobby:updated', ({ rooms }) => {
        setPublicRooms(rooms || []);
      });
    }
    // 保留30秒轮询作为备份（防止推送丢失）
    refreshTimerRef.current = setInterval(fetchLobby, 30000);
    return () => {
      clearInterval(refreshTimerRef.current);
      if (socket.socket) {
        socket.socket.off('lobby:updated');
      }
    };
  }, [fetchLobby]);

  const handleCreate = async () => {
    setLoading(true);
    setLocalError('');
    const result = await socket.createRoom(playerName, {
      isPrivate: createPrivate,
      password: createPassword || null,
      maxPlayers: createMaxPlayers,
    });
    setLoading(false);
    if (result.success) {
      onJoined();
    } else {
      setLocalError(result.error || '创建失败');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setLocalError('请输入房间号');
      return;
    }
    setLoading(true);
    setLocalError('');
    const result = await socket.joinRoom(roomCode.trim().toUpperCase(), playerName, password || null);
    setLoading(false);
    if (result.success) {
      onJoined();
    } else {
      setLocalError(result.error || '加入失败');
    }
  };

  const handleJoinFromList = async (roomId, isPrivate, hasPassword) => {
    setRoomCode(roomId);
    setMode('join');
    if (!isPrivate && !hasPassword) {
      // 公开无密码房间直接加入
      setLoading(true);
      setLocalError('');
      const result = await socket.joinRoom(roomId, playerName, null);
      setLoading(false);
      if (result.success) {
        onJoined();
      } else {
        setLocalError(result.error || '加入失败');
      }
    }
  };

  // 如果已经在房间中（等待中）
  if (socket.gameState && socket.gameState.phase === 'LOBBY') {
    return (
      <LobbyRoom
        socket={socket}
        playerName={playerName}
        bgm={bgm}
        onLeave={() => {
          socket.leaveRoom();
          setMode(null);
          fetchLobby();
        }}
        onShowSettings={() => setShowSettings(true)}
      />
    );
  }

  return (
    <div className="screen lobby-screen">
      <div className="lobby-card lobby-card-wide">
        <div className="lobby-header">
          <span className="logo-icon">🌑</span>
          <h1>帷幕之地</h1>
          <p className="player-name-display">
            玩家: <strong>{playerName}</strong>
            <button className="btn-link" onClick={onChangeName}>改名</button>
            <button className="btn-link" onClick={() => setShowSettings(true)}>⚙️</button>
          </p>
        </div>

        {!mode ? (
          <>
            <div className="lobby-actions">
              <button className="btn btn-primary btn-large" onClick={() => setMode('create')} disabled={loading}>
                🏠 创建房间
              </button>
              <button className="btn btn-secondary btn-large" onClick={() => setMode('join')} disabled={loading}>
                🚪 加入房间
              </button>
            </div>

            {/* 公开房间列表 */}
            <div className="lobby-public">
              <h3>🌐 公开房间 ({publicRooms.length})</h3>
              {publicRooms.length === 0 ? (
                <p className="lobby-empty">暂无公开房间，创建一个吧！</p>
              ) : (
                <div className="lobby-room-list">
                  {publicRooms.map(room => (
                    <div
                      key={room.id}
                      className={`lobby-room-card ${room.isPrivate ? 'private' : ''}`}
                      onClick={() => handleJoinFromList(room.id, room.isPrivate, room.hasPassword)}
                    >
                      <div className="lobby-room-left">
                        <span className="lobby-room-code">{room.id}</span>
                        <span className="lobby-room-host">房主: {room.hostName}</span>
                      </div>
                      <div className="lobby-room-right">
                        <span className="lobby-room-players">
                          👥 {room.playerCount}/{room.maxPlayers}
                        </span>
                        {room.isPrivate && <span className="lobby-room-lock">🔒</span>}
                        {room.hasPassword && <span className="lobby-room-key">🔑</span>}
                        {!room.isPrivate && <span className="lobby-room-public-tag">公开</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-small btn-ghost" onClick={fetchLobby} style={{marginTop:8}}>
                🔄 刷新列表
              </button>
            </div>
          </>
        ) : mode === 'create' ? (
          <div className="create-section">
            <h3>创建房间</h3>

            <div className="create-options">
              <label className="settings-toggle">
                <span>🔒 私密房间（不在大厅显示）</span>
                <input
                  type="checkbox"
                  checked={createPrivate}
                  onChange={e => setCreatePrivate(e.target.checked)}
                />
              </label>

              {createPrivate && (
                <div className="create-field">
                  <label>房间密码（可选）</label>
                  <input
                    type="text"
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    placeholder="不设置则无密码"
                    maxLength={10}
                  />
                </div>
              )}

              <div className="create-field">
                <label>最大人数 (5-18)</label>
                <input
                  type="number"
                  value={createMaxPlayers}
                  onChange={e => setCreateMaxPlayers(Math.max(5, Math.min(18, parseInt(e.target.value) || 12)))}
                  min={5}
                  max={18}
                />
              </div>
            </div>

            {localError && <p className="error-text">{localError}</p>}
            <div className="btn-row">
              <button className="btn btn-primary btn-large" onClick={handleCreate} disabled={loading}>
                {loading ? '创建中...' : '🎮 创建'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setLocalError(''); }}>
                返回
              </button>
            </div>
          </div>
        ) : mode === 'join' ? (
          <div className="join-section">
            <h3>加入房间</h3>
            <form onSubmit={handleJoin}>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setLocalError(''); }}
                placeholder="输入6位房间号 (如: ABC123)"
                maxLength={6}
                autoFocus
                className="room-code-input"
              />
              <input
                type="text"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLocalError(''); }}
                placeholder="房间密码（如需要）"
                maxLength={10}
                style={{marginTop:8}}
              />
              {localError && <p className="error-text">{localError}</p>}
              <div className="btn-row">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '加入中...' : '加入'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setMode(null); setLocalError(''); setPassword(''); }}>
                  返回
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <button className="btn btn-secondary" style={{marginTop:16,width:'100%'}} onClick={() => setShowRoleIntro(true)}>
          📜 查看角色简介
        </button>

        {!socket.connected && (
          <div className="connection-warning">
            ⚠️ 未连接到服务器，请确认服务器已启动
          </div>
        )}

        {/* 角色展示 */}
        <div className="lobby-roles">
          <h4>游戏角色</h4>
          <RoleGallery />
        </div>
      </div>

      <RoleIntroModal show={showRoleIntro} onClose={() => setShowRoleIntro(false)} />
    </div>
  );
}

// ==================== 房间等待界面 ====================

function LobbyRoom({ socket, playerName, bgm, onLeave, onShowSettings }) {
  const { gameState } = socket;
  const playerCount = gameState.players?.length || 0;
  const maxPlayers = gameState.maxPlayers || 12;
  const minPlayers = gameState.minPlayers || 2;
  // 房主检测：hostId 匹配 或 是首位玩家（兜底）
  const isHost = gameState.hostId === socket.playerId ||
    (gameState.players?.length > 0 && gameState.players[0]?.id === socket.playerId);
  const canStart = playerCount >= minPlayers;
  const [showRoleIntro, setShowRoleIntro] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showName, setShowName] = useState(() => {
    return localStorage.getItem('veilland_show_name') !== 'false';
  });
  const [privacyMsg, setPrivacyMsg] = useState('');
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);

  const handleRoleConfigUpdate = useCallback((roleConfig) => {
    socket.socket?.emit('room:updateRoleConfig', { roleConfig }, (res) => {
      if (!res?.success) {
        alert(res?.error || '配置更新失败');
      }
    });
  }, [socket]);

  const handleStartGame = useCallback(() => {
    if (starting) return;
    setStarting(true);
    setStartError('');
    socket.socket?.emit('game:start', {
      roleConfig: gameState.customRoleConfig,
    }, (response) => {
      setStarting(false);
      if (response?.error) {
        setStartError(response.error);
      }
    });
  }, [socket, gameState, starting]);

  // 键盘快捷键：Enter 或 3 开始游戏（仅房主）
  useEffect(() => {
    if (!isHost) return;
    const handleKeyDown = (e) => {
      // 忽略在输入框中按下的键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if ((e.key === 'Enter' || e.key === '3') && !starting) {
        e.preventDefault();
        handleStartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, starting, handleStartGame]);

  const handleToggleShowName = () => {
    const next = !showName;
    setShowName(next);
    localStorage.setItem('veilland_show_name', String(next));
  };

  const handleTogglePrivacy = async (isPrivate, password) => {
    return await socket.toggleRoomPrivacy(isPrivate, password);
  };

  const handleSetPassword = async (password) => {
    return await socket.setRoomPassword(password);
  };

  const handleUpdateMaxPlayers = async (max) => {
    return await socket.updateMaxPlayers(max);
  };

  const handleLeaveRoom = () => {
    socket.leaveRoom();
    onLeave();
  };

  return (
    <div className="screen lobby-screen">
      <div className="lobby-card lobby-card-wide">
        <div className="room-info">
          <h2>房间号: <span className="room-code">{gameState.id}</span></h2>
          <div className="room-meta">
            {gameState.isPrivate ? (
              <span className="room-privacy-badge private">🔒 私密</span>
            ) : (
              <span className="room-privacy-badge public">🌐 公开</span>
            )}
            {gameState.hasPassword && <span className="room-privacy-badge password">🔑 有密码</span>}
            <span className="room-privacy-badge players">👥 {playerCount}/{maxPlayers}</span>
          </div>
          <p className="room-hint">将房间号发送给朋友即可加入</p>
          <div className="room-header-btns">
            <button className="btn btn-small btn-secondary" onClick={() => setShowRoleIntro(true)}>
              📜 角色简介
            </button>
            <button className="btn btn-small btn-secondary" onClick={() => setShowSettings(true)}>
              ⚙️ 设置
            </button>
          </div>
        </div>

        <div className="player-list-section">
          <h3>玩家列表 ({playerCount}/{maxPlayers})</h3>
          <div className="player-grid">
            {gameState.players.map((p, i) => (
              <div key={p.id} className={`player-tag ${p.id === socket.playerId ? 'is-self' : ''} ${p.id === gameState.hostId ? 'is-host' : ''}`}>
                <span className="player-index">{i + 1}</span>
                <span className="player-name">{p.name}</span>
                {p.id === gameState.hostId && <span className="host-badge">👑</span>}
                {p.id === socket.playerId && <span className="self-badge">你</span>}
              </div>
            ))}
          </div>
        </div>

        {/* 房主角色选择 */}
        <RoleSelector
          isHost={isHost}
          playerCount={playerCount}
          currentConfig={gameState.customRoleConfig}
          onUpdate={handleRoleConfigUpdate}
          disabled={false}
        />

        {/* 房间隐私状态摘要 */}
        {!isHost && (
          <div className="room-privacy-summary">
            {gameState.isPrivate ? '🔒 私密房间' : '🌐 公开房间'}
            {gameState.hasPassword ? ' （有密码保护）' : ''}
          </div>
        )}

        {/* 房主人机开关 */}
        {isHost && (
          <div className="bot-toggle-section">
            <label className="bot-toggle-label">
              <input
                type="checkbox"
                checked={gameState.enableBots !== false}
                onChange={async (e) => {
                  await socket.toggleBots(e.target.checked);
                }}
              />
              <span>🤖 自动补足人机至6人</span>
            </label>
            <p className="bot-toggle-hint">人数不足时自动添加AI机器人补齐</p>
          </div>
        )}

        <div className="lobby-buttons">
          {isHost && (
            <>
              <button
                className="btn btn-primary btn-large start-game-btn"
                onClick={handleStartGame}
                disabled={starting}
              >
                {starting ? '⏳ 正在开始...' : canStart
                  ? `🎮 开始游戏 (Enter/3)`
                  : `⚠️ 人数不足 (${playerCount}/${minPlayers}) — 点此强制开始`}
              </button>
              {!canStart && (
                <p className="warning-text">⚠️ 当前仅{playerCount}人，低于推荐{minPlayers}人，但可强制开始测试</p>
              )}
              {canStart && (
                <p className="keyboard-hint">💡 按 <kbd>Enter</kbd> 或 <kbd>3</kbd> 快速开始游戏</p>
              )}
            </>
          )}
          {!isHost && !canStart && (
            <p className="waiting-hint">等待房主开始游戏...（至少需要{minPlayers}人）</p>
          )}
          {!isHost && canStart && (
            <p className="waiting-hint">等待房主开始游戏...</p>
          )}
          {startError && <p className="error-text">❌ {startError}</p>}
          <button className="btn btn-ghost" onClick={handleLeaveRoom}>离开房间</button>
        </div>
      </div>

      <RoleIntroModal show={showRoleIntro} onClose={() => setShowRoleIntro(false)} />

      <SettingsPanel
        show={showSettings}
        onClose={() => setShowSettings(false)}
        playerName={playerName}
        showName={showName}
        onToggleShowName={handleToggleShowName}
        isHost={isHost}
        isPrivate={gameState.isPrivate}
        hasPassword={gameState.hasPassword}
        onTogglePrivacy={handleTogglePrivacy}
        onSetPassword={handleSetPassword}
        maxPlayers={maxPlayers}
        onUpdateMaxPlayers={handleUpdateMaxPlayers}
        playerCount={playerCount}
        onLeaveRoom={handleLeaveRoom}
        onExitGame={null}
        isInGame={false}
        bgm={bgm}
        enableBots={gameState.enableBots}
        botCount={gameState.botCount || 0}
        onSetBotCount={async (count) => {
          await socket.setBotCount(count);
        }}
      />
    </div>
  );
}
