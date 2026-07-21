// ============================================================
// 狼人杀官网 —— 下载PC端页面
// ============================================================

import React, { useState } from 'react';

const DOWNLOAD_INFO = {
  version: '2.11.0',
  releaseDate: '2026-07-21',
  fileSize: '约 117 MB',
  platform: 'Windows 10/11 (64位)',
  minSpecs: [
    '操作系统：Windows 10 或更高版本（64位）',
    '处理器：Intel Core i3 或同等性能',
    '内存：4 GB RAM',
    '存储空间：500 MB 可用空间',
    '网络：宽带互联网连接',
  ],
  recSpecs: [
    '操作系统：Windows 11（64位）',
    '处理器：Intel Core i5 或同等性能',
    '内存：8 GB RAM',
    '存储空间：1 GB 可用空间',
    '网络：低延迟宽带连接',
  ],
  features: [
    '🖥️ 独立桌面窗口，无需浏览器',
    '🎙️ 内置语音聊天',
    '🔔 系统通知，不会错过回合',
    '🚀 更快加载速度，离线资源缓存',
    '🎵 完整BGM和音效支持',
    '🔄 自动检查更新',
  ],
  changelog: [
    { ver: 'v2.11.0', date: '2026-07-21', changes: ['修复Game类语法错误', '优化服务器部署流程', '新增官网页面'] },
    { ver: 'v2.10.0', date: '2026-07-20', changes: ['新增Android客户端支持', '排位系统优化', '断线重连增强'] },
    { ver: 'v1.4.0', date: '2026-06-26', changes: ['修复角色信息泄露', '猎人武器修复', '断线重连机制', '弃权投票修复', '阶段计时器'] },
  ],
};

export default function DownloadPage({ onNavigate }) {
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleDownload = () => {
    setDownloadStarted(true);
    // 触发浏览器下载（从服务器下载 EXE 文件）
    const link = document.createElement('a');
    link.href = '/download/Werewolf_Setup_2.11.0.exe';
    link.download = `狼人杀_Werewolf_Setup_${DOWNLOAD_INFO.version}.exe`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="static-page">
      {/* 导航栏 */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <a className="nav-brand" onClick={() => onNavigate('home')}>
            <span className="brand-icon">🐺</span>
            <span className="brand-text">狼人杀</span>
          </a>
          <div className="nav-links">
            <a onClick={() => onNavigate('home')}>首页</a>
            <a onClick={() => onNavigate('download')} className="active">下载PC端</a>
            <a onClick={() => onNavigate('contact')}>联系我们</a>
            <button className="btn btn-primary btn-small" onClick={() => onNavigate('play')}>
              🎮 开始游戏
            </button>
          </div>
        </div>
      </nav>

      <div className="static-content">
        <h1 className="static-title">💻 下载PC客户端</h1>
        <p className="static-desc">
          下载桌面版客户端，获得更流畅的游戏体验
        </p>

        {/* 下载卡片 */}
        <div className="download-hero">
          <div className="download-main-card">
            <div className="download-platform-icon">🖥️</div>
            <h2>Windows 桌面版</h2>
            <p className="download-ver">
              版本 {DOWNLOAD_INFO.version} · {DOWNLOAD_INFO.releaseDate} · {DOWNLOAD_INFO.fileSize}
            </p>

            {downloadStarted ? (
              <div className="download-started">
                <div className="download-spinner" />
                <h3>下载已开始！</h3>
                <p>如果没有自动下载，请点击下方按钮：</p>
                <button className="btn btn-primary btn-large" onClick={handleDownload}>
                  📥 重新下载
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-download" onClick={handleDownload}>
                <span className="download-btn-icon">📥</span>
                <span>
                  <strong>立即下载</strong>
                  <small>Windows 64位 · {DOWNLOAD_INFO.fileSize}</small>
                </span>
              </button>
            )}

            <p className="download-note">
              下载后双击运行即可安装，无需额外配置
            </p>
          </div>
        </div>

        {/* 客户端特色 */}
        <section className="download-features">
          <h3>PC客户端亮点</h3>
          <div className="dl-features-grid">
            {DOWNLOAD_INFO.features.map((f, i) => (
              <div key={i} className="dl-feature-item">{f}</div>
            ))}
          </div>
        </section>

        {/* 系统要求 */}
        <div className="specs-grid">
          <div className="specs-card">
            <h3>📋 最低配置</h3>
            <ul>
              {DOWNLOAD_INFO.minSpecs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="specs-card">
            <h3>✨ 推荐配置</h3>
            <ul>
              {DOWNLOAD_INFO.recSpecs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 安装步骤 */}
        <section className="install-guide">
          <h3>📖 安装指南</h3>
          <div className="install-steps">
            <div className="install-step">
              <span className="step-badge">1</span>
              <div>
                <h4>下载安装包</h4>
                <p>点击上方按钮下载 Werewolf_Setup_{DOWNLOAD_INFO.version}.exe</p>
              </div>
            </div>
            <div className="install-step">
              <span className="step-badge">2</span>
              <div>
                <h4>运行安装</h4>
                <p>双击运行下载的 EXE 文件，选择安装位置</p>
              </div>
            </div>
            <div className="install-step">
              <span className="step-badge">3</span>
              <div>
                <h4>开始游戏</h4>
                <p>安装完成后桌面会出现"狼人杀"快捷方式，双击启动即可</p>
              </div>
            </div>
          </div>
        </section>

        {/* 更新日志 */}
        <section className="changelog">
          <h3>📝 更新日志</h3>
          <div className="changelog-list">
            {DOWNLOAD_INFO.changelog.map((entry, i) => (
              <div key={i} className="changelog-entry">
                <div className="changelog-header">
                  <span className="changelog-ver">{entry.ver}</span>
                  <span className="changelog-date">{entry.date}</span>
                </div>
                <ul>
                  {entry.changes.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 网页版入口 */}
        <div className="web-version-banner">
          <p>
            💡 <strong>不想下载？</strong>
            直接点击下方按钮在浏览器中玩 —— 功能和桌面版完全一致！
          </p>
          <button className="btn btn-secondary btn-large" onClick={() => onNavigate('play')}>
            🌐 在浏览器中玩
          </button>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>🐺</span>
            <strong>狼人杀 在线联机版</strong>
          </div>
          <div className="footer-links">
            <a onClick={() => onNavigate('home')}>首页</a>
            <a onClick={() => onNavigate('download')}>下载PC端</a>
            <a onClick={() => onNavigate('contact')}>联系我们</a>
          </div>
          <p className="footer-copy">© 2026 Werewolf Online. 为朋友聚会而生 🐺</p>
        </div>
      </footer>
    </div>
  );
}
