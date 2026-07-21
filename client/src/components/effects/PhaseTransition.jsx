// ============================================================
// 电影化阶段转场 — 昼夜切换 / 死亡 / 结算
// ============================================================

import React, { useEffect, useState } from 'react';

const TRANSITIONS = {
  /** 进入夜晚 */
  NIGHT: {
    text: '夜幕降临...',
    subText: '狼人开始行动',
    gradient: 'linear-gradient(180deg, rgba(4,4,16,0) 0%, rgba(4,8,24,0.95) 100%)',
    accent: '#8b0c0c',
    icon: '🌑',
    duration: 1800,
  },
  /** 黎明到来 */
  DAY: {
    text: '黎明到来...',
    subText: '昨夜有人永远闭上了眼睛',
    gradient: 'linear-gradient(0deg, rgba(200,160,100,0.15) 0%, rgba(40,30,20,0.4) 50%, rgba(4,4,16,0) 100%)',
    accent: '#c9a96e',
    icon: '☀️',
    duration: 2000,
  },
  /** 投票审判 */
  VOTE: {
    text: '审判时刻...',
    subText: '用你的票决定命运',
    gradient: 'radial-gradient(ellipse at center, rgba(139,12,12,0.2) 0%, rgba(4,4,16,0.9) 100%)',
    accent: '#c41e3a',
    icon: '⚖️',
    duration: 1500,
  },
  /** 游戏结束 — 胜利 */
  WIN: {
    text: '命运已定',
    subText: '你在黑暗中活了下来',
    gradient: 'radial-gradient(ellipse at center, rgba(201,169,110,0.15) 0%, rgba(4,4,16,0.95) 100%)',
    accent: '#c9a96e',
    icon: '🏆',
    duration: 2500,
  },
  /** 游戏结束 — 失败 */
  LOSE: {
    text: '夜色吞噬了你...',
    subText: '下一次，命运或许不同',
    gradient: 'radial-gradient(ellipse at center, rgba(139,12,12,0.2) 0%, rgba(4,4,16,0.95) 100%)',
    accent: '#8b0c0c',
    icon: '💀',
    duration: 2500,
  },
  /** 序幕 */
  PROLOGUE: {
    text: '故事即将开始...',
    subText: '帷幕之地的钟声已经敲响',
    gradient: 'radial-gradient(ellipse at center, rgba(138,155,181,0.08) 0%, rgba(4,4,16,0.9) 100%)',
    accent: '#8a9bb5',
    icon: '📜',
    duration: 2000,
  },
  /** 角色选择 */
  CHARACTER_SELECT: {
    text: '选择你的面貌',
    subText: '伪装之下，真实的你无人知晓',
    gradient: 'radial-gradient(ellipse at center, rgba(138,155,181,0.06) 0%, rgba(4,4,16,0.9) 100%)',
    accent: '#bcc8d6',
    icon: '🎭',
    duration: 1800,
  },
};

export default function PhaseTransition({ type, onComplete }) {
  const [phase, setPhase] = useState('enter'); // enter | hold | exit
  const [visible, setVisible] = useState(true);

  const config = TRANSITIONS[type] || TRANSITIONS.NIGHT;

  useEffect(() => {
    setPhase('enter');
    setVisible(true);

    const holdTimer = setTimeout(() => {
      setPhase('hold');
    }, 400);

    const exitTimer = setTimeout(() => {
      setPhase('exit');
    }, config.duration - 400);

    const doneTimer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, config.duration);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [type]);

  if (!visible) return null;

  return (
    <div
      className={`phase-transition phase-transition-${phase}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 600,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        transition: 'opacity 0.4s ease',
        opacity: phase === 'exit' ? 0 : 1,
      }}
    >
      {/* 渐变遮罩 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: config.gradient,
        }}
      />

      {/* 暗角 vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(4,4,12,0.7) 100%)`,
        }}
      />

      {/* 图标 */}
      <div
        className={`phase-transition-icon phase-transition-icon-${phase}`}
        style={{
          fontSize: '3rem',
          marginBottom: '16px',
          transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
          transform: phase === 'enter' ? 'scale(0.5)' : 'scale(1)',
          opacity: phase === 'enter' ? 0 : 1,
        }}
      >
        {config.icon}
      </div>

      {/* 主文字 */}
      <h2
        style={{
          fontFamily: 'var(--font-display, serif)',
          fontSize: '2rem',
          color: config.accent,
          margin: '0 0 6px',
          textShadow: `0 0 30px ${config.accent}44`,
          letterSpacing: '0.1em',
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
          transform: phase === 'enter' ? 'translateY(20px)' : 'translateY(0)',
          opacity: phase === 'enter' ? 0 : 1,
          transitionDelay: '0.1s',
        }}
      >
        {config.text}
      </h2>

      {/* 副文字 */}
      <p
        style={{
          fontFamily: 'var(--font-chinese, serif)',
          fontSize: '1.05rem',
          color: 'var(--color-mist-light, #8a9bb5)',
          margin: 0,
          opacity: 0.7,
          transition: 'transform 0.5s ease, opacity 0.4s ease',
          transform: phase === 'enter' ? 'translateY(16px)' : 'translateY(0)',
          opacity: phase === 'enter' ? 0 : 0.7,
          transitionDelay: '0.2s',
        }}
      >
        {config.subText}
      </p>
    </div>
  );
}

/**
 * 调试：根据新旧阶段确定转场类型
 */
export function getTransitionType(prevPhase, nextPhase) {
  if (nextPhase === 'NIGHT' && prevPhase !== 'NIGHT') return 'NIGHT';
  if (nextPhase === 'DAY' && prevPhase === 'NIGHT') return 'DAY';
  if (nextPhase === 'VOTE') return 'VOTE';
  if (nextPhase === 'CHARACTER_SELECT') return 'CHARACTER_SELECT';
  if (nextPhase === 'PROLOGUE') return 'PROLOGUE';
  return null;
}
