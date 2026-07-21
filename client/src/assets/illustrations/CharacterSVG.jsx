// ============================================================
// 表层身份 SVG 插图 — 10 个来自不同神话源头的战士
// 北欧 / 凯尔特 / 希腊 / 埃及 / 罗马 / 东方
// ============================================================

import React from 'react';

const IDENTITY_DEFS = {
  SIGURD: {
    colors: { primary: '#2a3a5a', glow: '#5a7aaa', accent: '#c9a96e', dark: '#0e1a2e' },
    origin: 'NORSE', label: '维京老战士',
  },
  FREYJA: {
    colors: { primary: '#3a1a3a', glow: '#8a4aaa', accent: '#d4a0d0', dark: '#1a0e1a' },
    origin: 'NORSE', label: '华纳末裔',
  },
  MORRIGAN: {
    colors: { primary: '#1a3a2a', glow: '#3a8a4a', accent: '#8ac0a0', dark: '#0a1a10' },
    origin: 'CELTIC', label: '最后的德鲁伊',
  },
  ANUBIS_ACOLYTE: {
    colors: { primary: '#3a2a1a', glow: '#c8a040', accent: '#f0c860', dark: '#1a1008' },
    origin: 'EGYPTIAN', label: '冥界侍僧',
  },
  HECTOR: {
    colors: { primary: '#2a2a4a', glow: '#5a5aaa', accent: '#c9a96e', dark: '#0e0e2e' },
    origin: 'GREEK', label: '特洛伊之盾',
  },
  ROMULUS: {
    colors: { primary: '#3a2020', glow: '#8a3030', accent: '#c9a96e', dark: '#1a0808' },
    origin: 'ROMAN', label: '狼养之子',
  },
  FENRIR_KIN: {
    colors: { primary: '#1a1a3a', glow: '#4a4a8a', accent: '#8a8ac0', dark: '#0a0a1e' },
    origin: 'NORSE', label: '魔狼血裔',
  },
  SKADI: {
    colors: { primary: '#2a3a4a', glow: '#5a8aaa', accent: '#a0c8e0', dark: '#0e1a2a' },
    origin: 'NORSE', label: '雪山猎手',
  },
  HAIKU_MONK: {
    colors: { primary: '#2a2a2a', glow: '#5a5a5a', accent: '#c9a96e', dark: '#0e0e0e' },
    origin: 'EASTERN', label: '流浪僧人',
  },
  BRIGID: {
    colors: { primary: '#3a2a1a', glow: '#d07030', accent: '#f0a060', dark: '#1a1008' },
    origin: 'CELTIC', label: '圣火侍女',
  },
};

/**
 * 生成表层身份 SVG 插图
 */
export default function CharacterSVG({ identityId, size = 140 }) {
  const def = IDENTITY_DEFS[identityId];
  if (!def) return <FallbackSVG size={size} />;

  const { primary, glow, accent, dark } = def.colors;
  const cx = size / 2, cy = size / 2;
  const r = (size / 2) * 0.78;
  const glowId = `char-glow-${identityId}`;
  const clipId = `char-clip-${identityId}`;

  const originDecor = getOriginDecor(def.origin, cx, cy, r, accent);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.4" />
          <stop offset="50%" stopColor={primary} stopOpacity="0.12" />
          <stop offset="100%" stopColor={dark} stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r + 2} />
        </clipPath>
      </defs>

      {/* 背景 */}
      <circle cx={cx} cy={cy} r={r} fill={dark} stroke={glow} strokeWidth="0.8" opacity="0.5" />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${glowId})`} />

      {/* 神话起源纹样 */}
      {originDecor}

      {/* 人物半身像 */}
      <g clipPath={`url(#${clipId})`}>
        <BustSilhouette cx={cx} cy={cy} r={r} identityId={identityId} primary={primary} glow={glow} />
      </g>

      {/* 边框 */}
      <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke={accent} strokeWidth="0.4" opacity="0.2" strokeDasharray="2 6" />
      <circle cx={cx} cy={cy} r={r + 1} fill="none" stroke={glow} strokeWidth="0.6" opacity="0.12" />

      {/* 四角符号 */}
      {[0, 90, 180, 270].map(deg => {
        const rad = (deg * Math.PI) / 180;
        const dx = cx + (r + 5) * Math.cos(rad);
        const dy = cy + (r + 5) * Math.sin(rad);
        return <circle key={deg} cx={dx} cy={dy} r="1.5" fill={accent} opacity="0.35" />;
      })}
    </svg>
  );
}

/** 半身剪影 */
function BustSilhouette({ cx, cy, r, identityId, primary, glow }) {
  const s = r / 70;
  const bx = cx - 35 * s;
  const by = cy - 50 * s;

  // 各角色有微小差异：肩宽、头型、饰品
  const isFemale = ['FREYJA', 'MORRIGAN', 'BRIGID', 'SKADI'].includes(identityId);
  const shoulderW = isFemale ? 32 : 36;

  return (
    <g transform={`translate(${bx}, ${by}) scale(${s})`} opacity="0.82">
      {/* 肩膀 */}
      <ellipse cx="35" cy="62" rx={shoulderW} ry="18" fill={primary} stroke={glow} strokeWidth="0.4" opacity="0.7" />
      {/* 颈部 */}
      <rect x="30" y="38" width="10" height="24" rx="3" fill={primary} opacity="0.5" />
      {/* 头部 */}
      <ellipse cx="35" cy="24" rx={isFemale ? "13" : "13"} ry={isFemale ? "15" : "14"} fill={primary} stroke={glow} strokeWidth="0.5" opacity="0.75" />
      {/* 兜帽/头巾 */}
      <path d={`M18 20 C20 5 50 5 52 20 C50 12 20 12 18 20Z`} fill={primary} opacity="0.5" />
      {/* 装饰线 */}
      <line x1="10" y1="62" x2={10 + shoulderW * 2} y2="62" stroke={glow} strokeWidth="0.3" opacity="0.25" />
    </g>
  );
}

/** 按神话起源生成边框装饰 */
function getOriginDecor(origin, cx, cy, r, accent) {
  const elements = [];
  const opacity = 0.15;

  switch (origin) {
    case 'NORSE':
      // 如尼符文风格三角
      elements.push(
        <g key="norse" opacity={opacity}>
          <polygon points={`${cx},${cy - r + 6} ${cx - 8},${cy - r + 18} ${cx + 8},${cy - r + 18}`}
            fill="none" stroke={accent} strokeWidth="0.5" />
          <polygon points={`${cx},${cy + r - 6} ${cx - 8},${cy + r - 18} ${cx + 8},${cy + r - 18}`}
            fill="none" stroke={accent} strokeWidth="0.5" />
          <line x1={cx - r + 6} y1={cy} x2={cx - r + 16} y2={cy - 4} stroke={accent} strokeWidth="0.4" />
          <line x1={cx - r + 6} y1={cy} x2={cx - r + 16} y2={cy + 4} stroke={accent} strokeWidth="0.4" />
          <line x1={cx + r - 6} y1={cy} x2={cx + r - 16} y2={cy - 4} stroke={accent} strokeWidth="0.4" />
          <line x1={cx + r - 6} y1={cy} x2={cx + r - 16} y2={cy + 4} stroke={accent} strokeWidth="0.4" />
        </g>
      );
      break;
    case 'CELTIC':
      // 凯尔特绳结
      elements.push(
        <g key="celtic" opacity={opacity}>
          <circle cx={cx} cy={cy - r + 10} r="6" fill="none" stroke={accent} strokeWidth="0.5" />
          <circle cx={cx} cy={cy + r - 10} r="6" fill="none" stroke={accent} strokeWidth="0.5" />
          <path d={`M${cx - 6},${cy - r + 10} Q${cx},${cy - r + 4} ${cx + 6},${cy - r + 10}`}
            fill="none" stroke={accent} strokeWidth="0.4" />
        </g>
      );
      break;
    case 'GREEK':
      // 希腊回纹
      elements.push(
        <g key="greek" opacity={opacity}>
          <path d={`M${cx - r + 10},${cy - 6} L${cx - r + 16},${cy - 6} L${cx - r + 16},${cy} L${cx - r + 10},${cy} L${cx - r + 10},${cy + 6} L${cx - r + 16},${cy + 6}`}
            fill="none" stroke={accent} strokeWidth="0.5" />
          <path d={`M${cx + r - 10},${cy - 6} L${cx + r - 16},${cy - 6} L${cx + r - 16},${cy} L${cx + r - 10},${cy} L${cx + r - 10},${cy + 6} L${cx + r - 16},${cy + 6}`}
            fill="none" stroke={accent} strokeWidth="0.5" />
        </g>
      );
      break;
    case 'EGYPTIAN':
      // 埃及方尖碑+眼
      elements.push(
        <g key="egypt" opacity={opacity}>
          <rect x={cx - 4} y={cy - r + 4} width="8" height="14" rx="1" fill="none" stroke={accent} strokeWidth="0.5" />
          <polygon points={`${cx - 6},${cy - r + 4} ${cx + 6},${cy - r + 4} ${cx},${cy - r - 2}`}
            fill="none" stroke={accent} strokeWidth="0.5" />
          <ellipse cx={cx} cy={cy + r - 8} rx="8" ry="5" fill="none" stroke={accent} strokeWidth="0.5" />
        </g>
      );
      break;
    case 'ROMAN':
      // 罗马月桂花环
      elements.push(
        <g key="roman" opacity={opacity}>
          <path d={`M${cx - r + 8},${cy} Q${cx},${cy - r + 4} ${cx + r - 8},${cy}`}
            fill="none" stroke={accent} strokeWidth="0.5" />
          <path d={`M${cx - r + 6},${cy + 2} Q${cx},${cy - r + 6} ${cx + r - 6},${cy + 2}`}
            fill="none" stroke={accent} strokeWidth="0.3" />
        </g>
      );
      break;
    case 'EASTERN':
      // 东方云纹
      elements.push(
        <g key="eastern" opacity={opacity}>
          <path d={`M${cx - r + 8},${cy - 8} Q${cx - r + 10},${cy - 14} ${cx - r + 18},${cy - 10} Q${cx - r + 24},${cy - 6} ${cx - r + 20},${cy - 2}`}
            fill="none" stroke={accent} strokeWidth="0.6" />
          <path d={`M${cx + r - 8},${cy + 8} Q${cx + r - 10},${cy + 14} ${cx + r - 18},${cy + 10} Q${cx + r - 24},${cy + 6} ${cx + r - 20},${cy + 2}`}
            fill="none" stroke={accent} strokeWidth="0.6" />
        </g>
      );
      break;
    default:
      break;
  }
  return elements;
}

/** 回退占位 */
function FallbackSVG({ size }) {
  const cx = size / 2, cy = size / 2, r = (size / 2) * 0.78;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="#1a1a2e" stroke="#5a5a6e" strokeWidth="0.8" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#5a5a6e" fontSize="12">?</text>
    </svg>
  );
}
