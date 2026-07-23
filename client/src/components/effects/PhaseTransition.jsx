// ============================================================
// 电影化阶段转场 — 昼夜切换 / 死亡 / 结算
// ============================================================

import React, { useEffect, useState } from 'react';

const TRANSITIONS = {
  /** 进入夜晚 */
  NIGHT: {
    text: '夜幕降临...',
    subText: '血月升起，帷幕之外的存在开始呼吸',
    gradient: 'linear-gradient(180deg, rgba(4,4,20,0) 0%, rgba(8,4,28,0.97) 100%)',
    accent: '#8b3a3a',
    icon: '🌑',
    duration: 2200,
  },
  /** 黎明到来 */
  DAY: {
    text: '黎明破晓...',
    subText: '日舟的光芒穿透帷幕——昨夜有人再也不会醒来',
    gradient: 'linear-gradient(0deg, rgba(190,150,80,0.18) 0%, rgba(50,35,20,0.5) 50%, rgba(4,4,20,0) 100%)',
    accent: '#c9a050',
    icon: '☀️',
    duration: 2400,
  },
  /** 投票审判 */
  VOTE: {
    text: '放逐裁决...',
    subText: '聚落公投——将可疑之人送入帷幕裂隙',
    gradient: 'radial-gradient(ellipse at center, rgba(120,20,30,0.25) 0%, rgba(4,4,20,0.95) 100%)',
    accent: '#c41e3a',
    icon: '⚖️',
    duration: 1800,
  },
  /** 游戏结束 — 胜利 */
  WIN: {
    text: '灵焰不灭',
    subText: '你在黑暗中守住了最后的光',
    gradient: 'radial-gradient(ellipse at center, rgba(180,140,50,0.2) 0%, rgba(8,6,20,0.97) 100%)',
    accent: '#c9a96e',
    icon: '✨',
    duration: 2800,
  },
  /** 游戏结束 — 失败 */
  LOSE: {
    text: '灵焰消散...',
    subText: '蚀痕已覆盖一切——但帷幕还记得你的名字',
    gradient: 'radial-gradient(ellipse at center, rgba(100,15,25,0.25) 0%, rgba(6,3,18,0.97) 100%)',
    accent: '#8b0c2c',
    icon: '🕯️',
    duration: 2800,
  },
  /** 序幕 */
  PROLOGUE: {
    text: '帷幕之地的钟声已经敲响...',
    subText: '诸神已死。故事才刚刚开始。',
    gradient: 'radial-gradient(ellipse at center, rgba(120,140,170,0.1) 0%, rgba(4,4,20,0.92) 100%)',
    accent: '#8a9bb5',
    icon: '📜',
    duration: 2500,
  },
  /** 角色选择 */
  CHARACTER_SELECT: {
    text: '选择你的魂印',
    subText: '十五位帷幕遗民——面具之下，真实身份无人知晓',
    gradient: 'radial-gradient(ellipse at center, rgba(130,150,175,0.08) 0%, rgba(4,4,20,0.92) 100%)',
    accent: '#a0b8d0',
    icon: '🎭',
    duration: 2000,
  },
  /** 讨论阶段 */
  DISCUSSION: {
    text: '聚落会议...',
    subText: '在猜疑与信任之间——每一个字都可能改变命运',
    gradient: 'radial-gradient(ellipse at center, rgba(100,120,160,0.1) 0%, rgba(4,4,20,0.9) 100%)',
    accent: '#7a9ab5',
    icon: '🗣️',
    duration: 1600,
  },
};

export default function PhaseTransition({ type, onComplete }) {
  const [phase, setPhase] = useState('enter');
  const [visible, setVisible] = useState(true);
  const [particles, setParticles] = useState([]);

  const config = TRANSITIONS[type] || TRANSITIONS.NIGHT;

  // 生成微尘粒子
  useEffect(() => {
    if (!visible) return;
    const count = type === 'NIGHT' ? 30 : type === 'WIN' ? 40 : 15;
    const pts = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.3 + 0.05,
      delay: Math.random() * 1.5,
      duration: Math.random() * 2 + 1.5,
    }));
    setParticles(pts);
  }, [type, visible]);

  useEffect(() => {
    setPhase('enter');
    setVisible(true);

    const holdTimer = setTimeout(() => setPhase('hold'), 500);
    const exitTimer = setTimeout(() => setPhase('exit'), config.duration - 500);
    const doneTimer = setTimeout(() => { setVisible(false); onComplete?.(); }, config.duration);

    return () => { clearTimeout(holdTimer); clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [type]);

  if (!visible) return null;

  return (
    <div
      className={`phase-transition phase-transition-${phase}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
        transition: 'opacity 0.5s ease',
        opacity: phase === 'exit' ? 0 : 1,
      }}
    >
      {/* 渐变遮罩 */}
      <div style={{ position: 'absolute', inset: 0, background: config.gradient }} />

      {/* 暗角 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center, transparent 25%, rgba(4,4,16,0.75) 100%)`,
      }} />

      {/* 电影遮幅 letterbox */}
      <div style={{
        position: 'absolute', inset: 0,
        borderTop: '4vh solid rgba(0,0,0,0.85)',
        borderBottom: '4vh solid rgba(0,0,0,0.85)',
        transition: 'border-width 0.8s ease',
      }} />

      {/* 漂浮粒子 */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: `${p.size}px`, height: `${p.size}px`,
          borderRadius: '50%',
          background: config.accent,
          opacity: phase === 'enter' ? 0 : p.opacity,
          animation: `float-up ${p.duration}s ${p.delay}s ease-out forwards`,
          boxShadow: `0 0 ${p.size * 2}px ${config.accent}44`,
        }} />
      ))}

      {/* 图标 */}
      <div
        className={`phase-transition-icon phase-transition-icon-${phase}`}
        style={{
          fontSize: '3.2rem', marginBottom: '18px',
          transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
          transform: phase === 'enter' ? 'scale(0.3) rotate(-10deg)' : 'scale(1) rotate(0deg)',
          opacity: phase === 'enter' ? 0 : 1,
          filter: `drop-shadow(0 0 20px ${config.accent}44)`,
        }}
      >
        {config.icon}
      </div>

      {/* 主文字 */}
      <h2 style={{
        fontFamily: 'var(--font-display, serif)',
        fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
        color: config.accent,
        margin: '0 0 8px',
        textShadow: `0 0 40px ${config.accent}33, 0 2px 4px rgba(0,0,0,0.5)`,
        letterSpacing: '0.12em',
        transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
        transform: phase === 'enter' ? 'translateY(24px)' : 'translateY(0)',
        opacity: phase === 'enter' ? 0 : 1,
        transitionDelay: '0.12s',
      }}>
        {config.text}
      </h2>

      {/* 副文字 */}
      <p style={{
        fontFamily: 'var(--font-chinese, serif)',
        fontSize: 'clamp(0.9rem, 2.2vw, 1.1rem)',
        color: 'var(--color-mist-light, #8a9bb5)',
        margin: 0, maxWidth: '80vw', textAlign: 'center',
        transition: 'transform 0.5s ease, opacity 0.5s ease',
        transform: phase === 'enter' ? 'translateY(18px)' : 'translateY(0)',
        opacity: phase === 'enter' ? 0 : 0.75,
        transitionDelay: '0.2s',
      }}>
        {config.subText}
      </p>

      {/* 底部装饰线 */}
      <div style={{
        width: phase === 'enter' ? '0%' : '120px',
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${config.accent}88, transparent)`,
        marginTop: '24px',
        transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transitionDelay: '0.3s',
      }} />
    </div>
  );
}

/**
 * 调试：根据新旧阶段确定转场类型
 */
export function getTransitionType(prevPhase, nextPhase, gameResult) {
  if (nextPhase === 'GAME_OVER' && gameResult) {
    return gameResult === 'win' ? 'WIN' : 'LOSE';
  }
  if (nextPhase === 'NIGHT' && prevPhase !== 'NIGHT') return 'NIGHT';
  if (nextPhase === 'DAY' && prevPhase === 'NIGHT') return 'DAY';
  if (nextPhase === 'VOTE') return 'VOTE';
  if (nextPhase === 'DISCUSSION') return 'DISCUSSION';
  if (nextPhase === 'CHARACTER_SELECT') return 'CHARACTER_SELECT';
  if (nextPhase === 'PROLOGUE') return 'PROLOGUE';
  return null;
}

// 浮动粒子动画样式注入（组件挂载时执行一次）
let _styleInjected = false;
if (typeof document !== 'undefined' && !_styleInjected) {
  _styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes float-up {
      0% { transform: translateY(0) scale(1); opacity: 1; }
      100% { transform: translateY(-120px) scale(0); opacity: 0; }
    }
    @keyframes phase-shimmer {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);
}
