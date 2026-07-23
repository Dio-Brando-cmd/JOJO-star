// 帷幕之地 —— 首页
import React, { useState, useEffect } from 'react';

const HERO_QUOTES = [
  { text: '诸神已死。帷幕之外，混沌在呼吸。', src: '——《帷幕观测录》' },
  { text: '灵焰不可创造，不可毁灭。它先于诸神存在。', src: '——奈莉娅第一定律' },
  { text: '每一次噬灵，都在喂养帷幕之外的古老存在。', src: '——《帷幕观测录》第七卷' },
  { text: '信任是血月之夜唯一的光源。', src: '——暮色聚落谚语' },
];

const LORE_FRAGMENTS = [
  { title: '灵焰', desc: '每个人的生命本质。金色为纯净，黑色为蚀痕。不可创造，不可毁灭。' },
  { title: '帷幕', desc: '诸神以自身编织的屏障。它是活的——在呼吸，在等待。' },
  { title: '蚀者', desc: '灵焰被蚀痕完全侵蚀的堕落者。以他人灵焰为食。' },
  { title: '守幕者', desc: '守护聚落的遗民。八种传承，一个誓言。' },
];

export default function LandingPage({ onNavigate }) {
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % HERO_QUOTES.length), 4000);
    return () => clearInterval(t);
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
            <a onClick={() => onNavigate('download')}>下载</a>
            <a onClick={() => onNavigate('contact')}>联系</a>
            <button className="btn btn-primary btn-small" onClick={() => onNavigate('play')}>
              🎮 开始游戏
            </button>
          </div>
        </div>
      </nav>

      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-particles" />
        <div className="hero-content">
          <div className="hero-logo">
            <span className="hero-icon">🌑</span>
            <h1 className="hero-title">帷幕之地</h1>
            <p className="hero-subtitle">灵 焰 纪 元</p>
          </div>

          {/* 世界观引言轮播 */}
          <div className="hero-quote-wrap fade-in" key={quoteIdx}>
            <p className="hero-quote">{HERO_QUOTES[quoteIdx].text}</p>
            <p className="hero-quote-src">{HERO_QUOTES[quoteIdx].src}</p>
          </div>

          <div className="hero-actions">
            <button className="btn btn-primary btn-hero" onClick={() => onNavigate('play')}>
              🕯️ 进入帷幕之地
            </button>
            <button className="btn btn-secondary btn-hero" onClick={() => onNavigate('download')}>
              💻 下载客户端
            </button>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-num">8</span>
              <span className="stat-label">隐藏职业</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-num">15</span>
              <span className="stat-label">魂印身份</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-num">12</span>
              <span className="stat-label">聚落席位</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 世界观精髓 ===== */}
      <section className="lore-strip">
        <div className="lore-strip-inner">
          {LORE_FRAGMENTS.map((f, i) => (
            <div key={i} className="lore-fragment">
              <span className="lore-dot" />
              <div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 世界之貌 ===== */}
      <section className="features">
        <h2 className="section-title">
          <span className="section-title-icon">🌑</span>
          帷幕之域
        </h2>
        <p className="section-desc">六座已死圣座的残骸拼接成这片破碎之地。每一寸土地都埋藏着众神的记忆。</p>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">🕯️</span>
            <h3>灵焰不灭</h3>
            <p>每个人的生命本质都是一团灵焰。它先于诸神存在，在你死后仍将继续燃烧——只是更换了住所。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🌑</span>
            <h3>蚀痕蔓延</h3>
            <p>帷幕裂隙中渗出的黑暗，正在侵蚀一个又一个灵焰。被完全侵蚀者化为蚀者——以他人灵焰为食。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🛡️</span>
            <h3>守幕之誓</h3>
            <p>帷幕学者、草药学者、愈灵师、帷幕守卫、灵痕追猎者、灵织者——六道传承守护聚落的最后微光。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📖</span>
            <h3>诸神遗产</h3>
            <p>永冬山脉的冰封巨灵、裂霆高地的天穹之冠、幽翠残林的渡鸦冢、骨灰平原的亿万名字——诸神的记忆散落各处。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🎭</span>
            <h3>魂印身份</h3>
            <p>选择你的表层身份——十五位来自帷幕各处的遗民。系统将基于你的魂印分配合适的隐藏职业。</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🌙</span>
            <h3>血月裁决</h3>
            <p>白昼聚落会议——辨识蚀痕或隐藏身份。夜晚使用能力——噬灵或守护。每一次选择都在改写帷幕的命运。</p>
          </div>
        </div>
      </section>

      {/* ===== 引用分隔 ===== */}
      <div className="quote-divider">
        <span className="quote-divider-line" />
        <span className="quote-divider-text">"帷幕是活的。它在呼吸。它在等。"</span>
        <span className="quote-divider-line" />
      </div>

      {/* ===== 踏入帷幕 ===== */}
      <section className="how-to-play">
        <h2 className="section-title">踏入帷幕</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h3>选择魂印</h3>
            <p>从十五位帷幕遗民中挑选你的表层身份，系统匹配隐藏职业</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>序幕降临</h3>
            <p>阅读你的角色故事——了解你为何来到暮色聚落</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>血月升起</h3>
            <p>夜晚行动，白昼裁决。活到黎明的，是最后的守幕者，还是潜伏的蚀者？</p>
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
        <div className="footer-lore">"我把借的都还了。" ——余烬，冥僧人，最后一年</div>
        <div className="footer-content">
          <div className="footer-brand">
            <span>🌑</span>
            <strong>帷幕之地 · 灵焰纪元</strong>
          </div>
          <div className="footer-links">
            <a onClick={() => onNavigate('download')}>下载</a>
            <a onClick={() => onNavigate('contact')}>联系</a>
            <span className="footer-ver">v2.13.1</span>
          </div>
          <p className="footer-copy">© 2026 帷幕之地 VeilLand. 在灵焰的微光中守望。</p>
        </div>
      </footer>
    </div>
  );
}
