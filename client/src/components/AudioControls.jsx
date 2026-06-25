// ============================================================
// 音效控制面板 —— 音乐/音效开关 + 音量滑块
// ============================================================

import React, { useState } from 'react';

export default function AudioControls({ audio }) {
  const [showSliders, setShowSliders] = useState(false);
  const {
    musicEnabled, setMusicEnabled,
    sfxEnabled, setSfxEnabled,
    musicVolume, setMusicVolume,
    sfxVolume, setSfxVolume,
    stopMusic,
  } = audio;

  const toggleMusic = () => {
    if (musicEnabled) {
      stopMusic();
    }
    setMusicEnabled(!musicEnabled);
    // 重新开启时恢复播放
    if (musicEnabled) {
      // 正在关闭，不恢复
    } else {
      // 正在开启，延迟恢复让状态先生效
      setTimeout(() => audio.resumeMusic?.(), 50);
    }
  };

  return (
    <div className="audio-controls">
      <button
        className={`audio-btn ${musicEnabled ? 'on' : 'off'}`}
        onClick={toggleMusic}
        title={musicEnabled ? '关闭音乐' : '开启音乐'}
      >
        {musicEnabled ? '🎵' : '🔇'}
      </button>
      <button
        className={`audio-btn ${sfxEnabled ? 'on' : 'off'}`}
        onClick={() => setSfxEnabled(!sfxEnabled)}
        title={sfxEnabled ? '关闭音效' : '开启音效'}
      >
        {sfxEnabled ? '🔊' : '🔇'}
      </button>
      <button
        className="audio-btn settings-btn"
        onClick={() => setShowSliders(!showSliders)}
        title="音量设置"
      >
        ⚙️
      </button>

      {showSliders && (
        <div className="volume-sliders">
          <div className="volume-row">
            <span>🎵</span>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume * 100}
              onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
            />
            <span className="vol-val">{Math.round(musicVolume * 100)}%</span>
          </div>
          <div className="volume-row">
            <span>🔊</span>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVolume * 100}
              onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
            />
            <span className="vol-val">{Math.round(sfxVolume * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
