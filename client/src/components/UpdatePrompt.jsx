// ============================================================
// 版本更新提示 — 自动检测新版本并提供 APK/EXE 下载
// ============================================================

import React, { useState, useEffect } from 'react';

// 客户端版本号（与服务端比较）
const CLIENT_VERSION = '1.5.0';

// 检测运行环境
function getPlatform() {
  if (typeof window === 'undefined') return 'web';
  const ua = window.navigator?.userAgent || '';
  if (ua.includes('Electron') || ua.includes('Werewolf')) return 'electron';
  // Capacitor 注入的 native 桥
  if (window.Capacitor?.isNativePlatform?.()) return 'android';
  // 备用检测: Android WebView
  if (ua.includes('Android') && ua.includes('wv')) return 'android';
  return 'web';
}

export default function UpdatePrompt({ show, onClose, updateInfo }) {
  const [downloading, setDownloading] = useState(false);
  const [platform, setPlatform] = useState('web');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setPlatform(getPlatform());
  }, []);

  if (!show || !updateInfo) return null;
  if (dismissed) return null;

  const isNewer = compareVersion(updateInfo.version, CLIENT_VERSION) > 0;
  const isMobile = platform === 'android';

  const handleDownload = () => {
    setDownloading(true);
    // 移动端：使用原生 DownloadManager 自动下载+安装
    if (isMobile) {
      const apkUrl = updateInfo.apkDownloadUrl || '/download/werewolf.apk';
      const fullUrl = apkUrl.startsWith('http') ? apkUrl : `${window.location.origin}${apkUrl}`;
      try {
        // 调用 Android 原生下载接口
        if (window.AndroidBridge?.downloadAndInstall) {
          window.AndroidBridge.downloadAndInstall(fullUrl, 'werewolf.apk');
          setTimeout(() => setDownloading(false), 2000);
          return;
        }
      } catch (e) { /* fallback */ }
      // 回退：浏览器下载
      const a = document.createElement('a');
      a.href = fullUrl;
      a.download = '狼人杀.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => setDownloading(false), 3000);
      return;
    }
    // 桌面端下载 EXE
    if (updateInfo.downloadUrl) {
      const a = document.createElement('a');
      a.href = updateInfo.downloadUrl;
      a.download = '狼人杀_Setup.exe';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  // 移动端: 如果是新版本，不允许关闭（强制更新）
  const canClose = !isMobile || !isNewer;

  return (
    <div className="modal-overlay" onClick={canClose ? onClose : undefined}>
      <div className="modal-content update-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNewer ? '🔄 发现新版本！' : '📋 版本信息'}</h3>
          {canClose && (
            <button className="modal-close" onClick={onClose}>✕</button>
          )}
        </div>

        <div className="modal-body update-body">
          {/* 版本对比 */}
          <div className="update-version-info">
            {isNewer ? (
              <>
                <span className="update-version-badge old">v{CLIENT_VERSION}</span>
                <span className="update-arrow">→</span>
                <span className="update-version-badge new">v{updateInfo.version}</span>
              </>
            ) : (
              <span className="update-version-badge current">v{CLIENT_VERSION} (已是最新)</span>
            )}
            <span className="update-date">{updateInfo.releaseDate}</span>
          </div>

          {/* 新版本提示 */}
          {isNewer && (
            <div className="update-new-available">
              <p>🎉 <strong>发现新版本 v{updateInfo.version}！</strong></p>
              <p className="update-new-hint">
                {isMobile
                  ? '请下载并安装最新 APK 以体验新功能和修复。'
                  : '请下载最新安装包更新，支持自动覆盖安装。'}
              </p>
            </div>
          )}

          {/* 更新公告 */}
          <div className="update-notes">
            <h4>{isNewer ? '🆕 更新内容：' : '📝 当前版本更新：'}</h4>
            <div className="update-notes-content">
              {updateInfo.releaseNotes}
            </div>
          </div>

          {/* 历史公告 */}
          {updateInfo.changelog && updateInfo.changelog.length > 0 && (
            <div className="update-changelog">
              <h4>📚 历史更新</h4>
              {updateInfo.changelog.map((entry, i) => (
                <div key={i} className="changelog-entry">
                  <span className="changelog-ver">v{entry.version}</span>
                  <span className="changelog-date">{entry.date}</span>
                  <p className="changelog-notes">{entry.notes}</p>
                </div>
              ))}
            </div>
          )}

          {/* 文件大小 */}
          {updateInfo.fileSize && (
            <p className="update-size">
              安装包大小: {Math.round(updateInfo.fileSize / 1024 / 1024)}MB
            </p>
          )}

          {/* 操作按钮 */}
          <div className="update-actions">
            {isNewer ? (
              <button
                className="btn btn-primary btn-large"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading
                  ? '⏳ 下载中...'
                  : isMobile
                    ? '📱 下载最新 APK'
                    : '📥 下载最新安装包'}
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={onClose}>
                关闭
              </button>
            )}
          </div>

          {/* 移动端安装提示 */}
          {isMobile && isNewer && (
            <div className="update-install-hint">
              <p>📱 <strong>安装步骤：</strong></p>
              <ol>
                <li>点击上方按钮下载 APK</li>
                <li>打开通知栏或文件管理器找到下载的 APK</li>
                <li>点击安装（如提示"未知来源"请允许）</li>
                <li>安装完成后打开新版本即可</li>
              </ol>
            </div>
          )}

          {/* 非强制更新时可跳过 */}
          {!isNewer && (
            <p className="update-hint" style={{marginTop: 8}}>
              已是最新版本，无需更新
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// 版本号比较
function compareVersion(v1, v2) {
  const parts1 = (v1 || '0.0.0').split('.').map(Number);
  const parts2 = (v2 || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((parts1[i] || 0) > (parts2[i] || 0)) return 1;
    if ((parts1[i] || 0) < (parts2[i] || 0)) return -1;
  }
  return 0;
}
