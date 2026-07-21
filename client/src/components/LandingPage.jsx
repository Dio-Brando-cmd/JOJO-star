// ============================================================
// 狼人杀官网 —— 首页
// ============================================================

import React, { useState, useEffect } from 'react';

const HERO_TITLES = [
  '月圆之夜，狼人出没',
  '猜疑与信任的较量',
  '你，能活到最后吗？',
];

export default function LandingPage({ onNavigate }) {
  const [titleIndex, setTitleIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTitleIndex(i => (i + 1) % HERO_TITLES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="landing-page">
      {/* ===== 导航栏 ===== */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <a className="nav-brand" onClick={() => onNavigate('home')}>
            <span className="brand-icon">🐺</span>
            <span className="brand-text">狼人杀</span>
          </a>
          <div className="nav-links">
            <a onClick={() => onNavigate('home')} className="active">首页</a>
            <a onClick={() => onNavigate('download')}>下载PC端</a>
            <a onClick={() => onNavigate('contact')}>联系我们</a>
            <button className="btn btn-primary btn-small" onClick={() => onNavigate('play')}>
              🎮 开始游戏
            </button>
          </div>
        </div>
      </nav>

      {/* ===== Hero 区域 ===== */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <div className="hero-logo">
            <span className="hero-icon">🐺</span>
            <h1 className="hero-title">狼人杀</h1>
            <p className="hero-subtitle">在线联机版</p>
          </div>
          <p className="hero-tagline fade-in" key={titleIndex}>
            {HERO_TITLES[titleIndex]}
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-hero" onClick={() => onNavigate('play')}>
              🎮 立刻开始游戏
            </button>
            <button className="btn btn-secondary btn-hero" onClick={() => onNavigate('download')}>
              💻 下载PC客户端
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-num">10+</span>
              <span className="stat-label">角色身份</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">12</span>
              <span className="stat-label">最大玩家数</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">24/7</span>
              <span className="stat-label">服务器在线</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 特色区域 ===== */}
      <section className="features">
        <h2 className="section-title">🎯 游戏特色</h2>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">🌐</span>
            <h3>全球联机</h3>
            <p>无需下载，打开浏览器即可与朋友随时随地联机对战</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🎭</span>
            <h3>丰富角色</h3>
            <p>10+ 种隐藏职业，每局随机分配，永不重复的游戏体验</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🎙️</span>
            <h3>语音聊天</h3>
            <p>内置实时语音，像面对面一样与朋友斗智斗勇</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📜</span>
            <h3>剧情驱动</h3>
            <p>每局生成独特的世界故事和序幕，沉浸式角色扮演</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🏆</span>
            <h3>排位系统</h3>
            <p>ELO 积分排名，赛季更替，证明你的实力</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🤖</span>
            <h3>智能机器人</h3>
            <p>人不够也能玩！AI 补位，自动推理和投票</p>
          </div>
        </div>
      </section>

      {/* ===== 如何开始 ===== */}
      <section className="how-to-play">
        <h2 className="section-title">🚀 三步开始游戏</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h3>创建或加入房间</h3>
            <p>输入昵称进入大厅，创建房间或输入房间号加入</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>选择身份</h3>
            <p>从可选身份中挑选你的表层角色，隐藏职业随机分配</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>开始推理</h3>
            <p>白天讨论、投票放逐，夜晚使用技能，活到最后！</p>
          </div>
        </div>
        <div className="steps-action">
          <button className="btn btn-primary btn-large" onClick={() => onNavigate('play')}>
            🎮 立即体验
          </button>
        </div>
      </section>

      {/* ===== 页脚 ===== */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>🐺</span>
            <strong>狼人杀 在线联机版</strong>
          </div>
          <div className="footer-links">
            <a onClick={() => onNavigate('download')}>下载PC端</a>
            <a onClick={() => onNavigate('contact')}>联系我们</a>
            <span className="footer-ver">v2.11.0</span>
          </div>
          <p className="footer-copy">© 2026 Werewolf Online. 为朋友聚会而生 🐺</p>
        </div>
      </footer>
    </div>
  );
}
