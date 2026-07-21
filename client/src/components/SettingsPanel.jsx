// ============================================================
// 设置面板 —— 显示名字、退出房间、隐私设置等
// ============================================================

import React, { useState } from 'react';

export default function SettingsPanel({
  show,
  onClose,
  playerName,
  showName,
  onToggleShowName,
  isHost,
  isPrivate,
  hasPassword,
  onTogglePrivacy,
  onSetPassword,
  maxPlayers,
  onUpdateMaxPlayers,
  playerCount,
  onLeaveRoom,
  onExitGame,
  isInGame,
  bgm,       // BGM MP3 系统
  audio,     // Web Audio 程序化音乐系统
  enableBots,
  botCount,
  onSetBotCount,
}) {
  const [passwordInput, setPasswordInput] = useState('');
  const [maxPlayersInput, setMaxPlayersInput] = useState(maxPlayers || 12);
  const [msg, setMsg] = useState('');

  if (!show) return null;

  const handleTogglePrivacy = async () => {
    const newPrivate = !isPrivate;
    // 确保空字符串转为 null（避免服务端收到空密码）
    const pwd = newPrivate && passwordInput.trim() ? passwordInput.trim() : null;
    const result = await onTogglePrivacy(newPrivate, pwd);
    if (result?.success) {
      setMsg(newPrivate ? '已设为私密房间' : '已设为公开房间');
    } else {
      setMsg(result?.error || '操作失败');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSetPassword = async () => {
    const result = await onSetPassword(passwordInput);
    if (result?.success) {
      setMsg(passwordInput ? '密码已更新' : '密码已清除');
    } else {
      setMsg(result?.error || '设置失败');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleUpdateMaxPlayers = async () => {
    const val = parseInt(maxPlayersInput, 10);
    if (isNaN(val) || val < 5 || val > 18) {
      setMsg('人数需在5-18之间');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    const result = await onUpdateMaxPlayers(val);
    if (result?.success) {
      setMsg(`人数上限已更新为 ${val}`);
    } else {
      setMsg(result?.error || '更新失败');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙️ 设置</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body settings-body">
          {/* 显示名字 */}
          <div className="settings-section">
            <h4>👤 显示设置</h4>
            <label className="settings-toggle">
              <span>在游戏中显示我的名字</span>
              <input
                type="checkbox"
                checked={showName}
                onChange={onToggleShowName}
              />
            </label>
            <p className="settings-hint">
              当前昵称: <strong>{playerName}</strong>
            </p>
          </div>

          {/* BGM 音乐设置 */}
          {bgm && (
            <div className="settings-section">
              <h4>🎵 全部音乐</h4>
              <label className="settings-toggle">
                <span>启用背景音乐</span>
                <input
                  type="checkbox"
                  checked={bgm.bgmEnabled}
                  onChange={() => {
                    bgm.toggleBGM();
                    // 同步控制程序化音乐
                    if (bgm.bgmEnabled) {
                      // 正在关闭BGM → 也停掉程序化音乐
                      if (audio) {
                        audio.setMusicEnabled(false);
                        audio.stopMusic();
                      }
                    } else {
                      // 正在开启BGM → 确保程序化音乐也关闭（用BGM替代）
                      if (audio) {
                        audio.setMusicEnabled(false);
                        audio.stopMusic();
                      }
                    }
                  }}
                />
              </label>
              {bgm.bgmEnabled && (
                <>
                  <div className="settings-row" style={{marginTop:10}}>
                    <label className="settings-label">当前曲目</label>
                    <select
                      value={bgm.currentTrack}
                      onChange={e => bgm.setTrack(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 'var(--radius)',
                        background: 'var(--bg-input)', color: 'var(--text-primary)',
                        border: '1px solid var(--border)', fontSize: '0.9em',
                      }}
                    >
                      {bgm.BGM_TRACKS.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="settings-row">
                    <label className="settings-label">音量: {Math.round(bgm.bgmVolume * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={bgm.bgmVolume * 100}
                      onChange={e => bgm.setVolume(Number(e.target.value) / 100)}
                      style={{width:'100%', accentColor:'var(--accent)'}}
                    />
                  </div>
                </>
              )}
              <p className="settings-hint">
                {bgm.bgmEnabled
                  ? '正在播放真实音乐 (MP3)'
                  : '已关闭所有背景音乐（含BGM和程序化音乐）'}
              </p>
            </div>
          )}

          {/* 房主专有设置 */}
          {isHost && (
            <div className="settings-section">
              <h4>👑 房主设置</h4>

              {/* 隐私切换 */}
              <div className="settings-row">
                <label className="settings-toggle">
                  <span>私密房间</span>
                  <input
                    type="checkbox"
                    checked={!!isPrivate}
                    onChange={handleTogglePrivacy}
                  />
                </label>
                <p className="settings-hint">
                  {isPrivate ? '🔒 仅知道房间号的人可以加入' : '🌐 任何人都可以在大厅看到并加入'}
                </p>
              </div>

              {/* 密码设置 */}
              <div className="settings-row">
                <label className="settings-label">房间密码（可选）</label>
                <div className="settings-input-row">
                  <input
                    type="text"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="留空则无密码"
                    maxLength={10}
                  />
                  <button className="btn btn-small btn-secondary" onClick={handleSetPassword}>
                    设置密码
                  </button>
                </div>
              </div>

              {/* 最大人数 */}
              <div className="settings-row">
                <label className="settings-label">
                  房间人数上限（当前 {playerCount}/{maxPlayers}）
                </label>
                <div className="settings-input-row">
                  <input
                    type="number"
                    value={maxPlayersInput}
                    onChange={e => setMaxPlayersInput(e.target.value)}
                    min={Math.max(5, playerCount)}
                    max={18}
                  />
                  <button className="btn btn-small btn-secondary" onClick={handleUpdateMaxPlayers}>
                    更新
                  </button>
                </div>
              </div>

              {/* 人机数量 */}
              <div className="settings-row">
                <label className="settings-label">
                  🤖 人机数量：<strong>{botCount > 0 ? `${botCount}个` : '自动'}</strong>
                </label>
                <p className="settings-hint">
                  {botCount === 0
                    ? '自动补足至6人；设为0恢复自动模式'
                    : `本局将加入 ${botCount} 个人机`}
                </p>
                <div className="settings-input-row" style={{gap:8, marginTop:8}}>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => onSetBotCount(Math.max(0, (botCount || 0) - 1))}
                    disabled={botCount <= 0}
                  >
                    ➖ 减少
                  </button>
                  <span style={{minWidth:40, textAlign:'center', fontWeight:'bold', fontSize:'1.1em'}}>
                    {botCount || 0}
                  </span>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => onSetBotCount(Math.min(12, (botCount || 0) + 1))}
                    disabled={botCount >= 12}
                  >
                    ➕ 增加
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 离开房间 / 退出 */}
          <div className="settings-section settings-danger">
            <h4>🚪 退出</h4>
            {!isInGame && onLeaveRoom && (
              <button className="btn btn-danger" onClick={onLeaveRoom}>
                离开当前房间
              </button>
            )}
            {isInGame && onExitGame && (
              <button className="btn btn-danger" onClick={onExitGame}>
                退出游戏（视为逃跑）
              </button>
            )}
            <p className="settings-hint">
              退出后可以重新加入或创建其他房间
            </p>
          </div>

          {msg && <p className="settings-msg">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
