// ============================================================
// 帷幕之地官网 —— 首页
// ============================================================

import React, { useState, useEffect } from 'react';

const HERO_TITLES = [
  '诸神已死。帷幕之外，混沌在呼吸。',
  '灵焰不灭——它只是更换了住所。',
  '每一次噬灵，都在喂养帷幕之外的古老存在。',
  '信任是黑暗中唯一的光源。',
  '你看到的真相，只是灵焰的一个侧面。',
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
            <span className="brand-icon">🌑</span>
            <span className="brand-text">帷幕之地</span>
          </a>
          <div className="nav-links">
            <a onClick={() => onNavigate('home')} className="active">首页</a>
            <a onClick={() => onNavigate('download')}>下载PC端</a>
            <a onClick={() => onNavigate('contact')}>联系我们</a>
            <a onClick={() => onNavigate('stats')}>🏆 战绩</a>
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
            <span className="hero-icon">🌑</span>
            <h1 className="hero-title">帷幕之地</h1>
            <p className="hero-subtitle">灵 焰 纪 元</p>
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
              <span className="stat-num">8</span>
              <span className="stat-label">隐藏职业</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">15</span>
              <span className="stat-label">魂印身份</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">12</span>
              <span className="stat-label">聚落席位</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 世界观引述 ===== */}
      <section className="features">
        <h2 className="section-title">🌑 帷幕之域</h2>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">🕯️</span>
            <h3>灵焰不灭</h3>
            <p>每个人的生命本质都是一团灵焰——不可创造，不可毁灭。它先于诸神存在，在你死后仍将继续燃烧。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🌑</span>
            <h3>蚀痕蔓延</h3>
            <p>帷幕裂隙中渗出的蚀痕，正在侵蚀一个又一个灵焰。被完全侵蚀者，将化为以他人灵焰为食的蚀者。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🛡️</span>
            <h3>守幕之誓</h3>
            <p>帷幕学者、草药学者、愈灵师、帷幕守卫、灵痕追猎者、灵织者——六道传承守护着聚落的最后一缕灵焰微光。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📖</span>
            <h3>诸神遗产</h3>
            <p>六座已死圣座的残骸拼接成这片破碎之地。永冬山脉、裂霆高地、幽翠残林、骨灰平原——每一寸土地都埋藏着众神的记忆。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🎭</span>
            <h3>双重身份</h3>
            <p>选择你的表层魂印身份——十五位来自帷幕各处的遗民——系统将基于你的选择分配合适的隐藏职业。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🌙</span>
            <h3>血月之夜</h3>
            <p>每当血月升起，聚落陷入黑暗。蚀者出没，守幕者夜行。每一个选择都在喂养帷幕外的古老存在——或者加固诸神最后的屏障。</p>
          </div>
        </div>
      </section>

      {/* ===== 如何开始 ===== */}
      <section className="how-to-play">
        <h2 className="section-title">🚀 踏入帷幕</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h3>选择魂印</h3>
            <p>从十五位帷幕遗民中挑选你的表层身份，系统将为你匹配隐藏职业</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>进入聚落</h3>
            <p>阅读序幕故事，了解你的角色为何来到暮色聚落</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>血月降临</h3>
            <p>夜晚使用能力——噬灵或守护。白昼聚落会议——辨识蚀痕或隐藏身份。活到黎明的，是最后的守幕者，还是潜伏的蚀者？</p>
          </div>
        </div>
        <div className="steps-action">
          <button className="btn btn-primary btn-large" onClick={() => onNavigate('play')}>
            🌑 进入帷幕之地
          </button>
        </div>
      </section>

      {/* ===== 页脚 ===== */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>🌑</span>
            <strong>帷幕之地 · 灵焰纪元</strong>
          </div>
          <div className="footer-links">
            <a onClick={() => onNavigate('download')}>下载PC端</a>
            <a onClick={() => onNavigate('contact')}>联系我们</a>
            <span className="footer-ver">v2.13.1</span>
          </div>
          <p className="footer-copy">© 2026 帷幕之地 VeilLand. 在灵焰的微光中守望 🌑</p>
        </div>
      </footer>
    </div>
  );
}
