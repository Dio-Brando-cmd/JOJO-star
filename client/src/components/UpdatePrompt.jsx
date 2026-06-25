// ============================================================
// 版本更新提示 — 检测新版本并提供下载
// ============================================================

import React, { useState } from 'react';

export default function UpdatePrompt({ show, onClose, updateInfo }) {
  const [downloading, setDownloading] = useState(false);

  if (!show || !updateInfo) return null;

  const isElectron = typeof window !== 'undefined' && window.navigator?.userAgent?.includes('Electron');

  const handleDownload = () => {
    setDownloading(true);
    if (updateInfo.downloadUrl) {
      // 直接触发浏览器下载
      const a = document.createElement('a');
      a.href = updateInfo.downloadUrl;
      a.download = '狼人杀_Setup.exe';
      a.click();
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  const handleUpdateCheck = () => {
    // 跳转到版本API获取最新信息
    fetch('/api/version')
      .then(r => r.json())
      .then(info => {
        window.location.reload();
      })
      .catch(() => {
        alert('无法连接到服务器，请稍后重试');
      });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content update-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔄 版本更新</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body update-body">
          <div className="update-version-info">
            <span className="update-version-badge">v{updateInfo.version}</span>
            <span className="update-date">{updateInfo.releaseDate}</span>
          </div>

          <div className="update-notes">
            <h4>更新内容：</h4>
            <p>{updateInfo.releaseNotes}</p>
          </div>

          {updateInfo.fileSize && (
            <p className="update-size">
              安装包大小: {Math.round(updateInfo.fileSize / 1024 / 1024)}MB
            </p>
          )}

          <div className="update-actions">
            <button
              className="btn btn-primary btn-large"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? '⏳ 下载中...' : '📥 下载最新安装包'}
            </button>
            {isElectron && (
              <button className="btn btn-secondary" onClick={handleUpdateCheck}>
                🔄 刷新页面
              </button>
            )}
          </div>

          <p className="update-hint">
            下载完成后运行新安装包即可自动覆盖更新
          </p>
        </div>
      </div>
    </div>
  );
}
