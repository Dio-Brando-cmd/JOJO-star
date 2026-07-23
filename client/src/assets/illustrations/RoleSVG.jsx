// ============================================================
// 隐藏角色 SVG 插图 — 西式+中式恐怖融合风格
// 8 个角色，每个都有独特的剪影、光晕和装饰元素
// ============================================================

import React from 'react';
import { ROLES } from '../../utils/constants';

const ROLE_DEFS = {
  [ROLES.CORRUPTED]: {
    colors: { primary: '#8b0c0c', glow: '#c41e3a', accent: '#e94560', dark: '#3a0404' },
    size: 0.82,
  },
  [ROLES.NETHER_MONK]: {
    colors: { primary: '#6b0808', glow: '#8b0000', accent: '#c9a96e', dark: '#2a0202' },
    size: 0.9,
  },
  [ROLES.VEIL_SCHOLAR]: {
    colors: { primary: '#3a1a5c', glow: '#7d3c98', accent: '#c9a96e', dark: '#1a0a2e' },
    size: 0.8,
  },
  [ROLES.HERBAL_SAGE]: {
    colors: { primary: '#1a3a2a', glow: '#2d8a1e', accent: '#4ae04a', dark: '#0a1a10' },
    size: 0.78,
  },
  [ROLES.SPIRIT_MENDER]: {
    colors: { primary: '#1a3a2e', glow: '#27ae60', accent: '#5ef0a0', dark: '#0a1a12' },
    size: 0.78,
  },
  [ROLES.SPIRIT_WEAVER]: {
    colors: { primary: '#3a3a4a', glow: '#5d6d7e', accent: '#8a9bb5', dark: '#1a1a28' },
    size: 0.75,
  },
  [ROLES.VEIL_GUARDIAN]: {
    colors: { primary: '#1a2a4a', glow: '#2980b9', accent: '#5aa0e0', dark: '#0a1a2a' },
    size: 0.82,
  },
  [ROLES.FLAME_TRACKER]: {
    colors: { primary: '#4a2a1a', glow: '#d35400', accent: '#e87040', dark: '#2a1008' },
    size: 0.8,
  },
};

/**
 * 生成角色 SVG 插图
 * @param {string} role - ROLES 中的角色 ID
 * @param {number} size - 视图框大小
 */
export default function RoleSVG({ role, size = 160 }) {
  const def = ROLE_DEFS[role] || ROLE_DEFS[ROLES.SPIRIT_WEAVER];
  const { primary, glow, accent, dark } = def.colors;
  const s = def.size;
  const cx = size / 2, cy = size / 2;
  const r = (size / 2) * s;

  const clipId = `role-clip-${role}`;
  const glowId = `role-glow-${role}`;
  const grainId = `role-grain-${role}`;
  const vignetteId = `role-vignette-${role}`;

  const renderSilhouette = () => {
    switch (role) {
      case ROLES.CORRUPTED:
        return <VeilLandSilhouette cx={cx} cy={cy} r={r} />;
      case ROLES.NETHER_MONK:
        return <AlphaWolfSilhouette cx={cx} cy={cy} r={r} />;
      case ROLES.VEIL_SCHOLAR:
        return <SeerSilhouette cx={cx} cy={cy} r={r} />;
      case ROLES.HERBAL_SAGE:
        return <PoisonWitchSilhouette cx={cx} cy={cy} r={r} />;
      case ROLES.SPIRIT_MENDER:
        return <HealWitchSilhouette cx={cx} cy={cy} r={r} />;
      case ROLES.VEIL_GUARDIAN:
        return <GuardSilhouette cx={cx} cy={cy} r={r} />;
      case ROLES.FLAME_TRACKER:
        return <HunterSilhouette cx={cx} cy={cy} r={r} />;
      case ROLES.SPIRIT_WEAVER:
      default:
        return <WeaverSilhouette cx={cx} cy={cy} r={r} />;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {/* 径向光晕 */}
        <radialGradient id={glowId} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.45" />
          <stop offset="50%" stopColor={primary} stopOpacity="0.15" />
          <stop offset="100%" stopColor={dark} stopOpacity="0" />
        </radialGradient>

        {/* 暗角 */}
        <radialGradient id={vignetteId} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="70%" stopColor="transparent" />
          <stop offset="100%" stopColor={dark} stopOpacity="0.6" />
        </radialGradient>

        {/* 噪点纹理 */}
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.08" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>

        {/* 裁剪 */}
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r + 4} />
        </clipPath>
      </defs>

      {/* 背景圆 + 光晕 */}
      <circle cx={cx} cy={cy} r={r} fill={dark} stroke={glow} strokeWidth="1.2" opacity="0.6" />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${glowId})`} />

      {/* 中式纹样装饰环 */}
      <circle cx={cx} cy={cy} r={r - 3} fill="none" stroke={accent} strokeWidth="0.5" opacity="0.25"
        strokeDasharray="3 8" />

      {/* 内环 */}
      <circle cx={cx} cy={cy} r={r - 8} fill="none" stroke={glow} strokeWidth="0.4" opacity="0.15" />

      {/* 角色剪影 */}
      <g clipPath={`url(#${clipId})`}>
        {renderSilhouette()}
      </g>

      {/* 噪点纹理覆盖 */}
      <circle cx={cx} cy={cy} r={r} fill={dark} opacity="0.06" filter={`url(#${grainId})`} />

      {/* 暗角 */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${vignetteId})`} />

      {/* 外环装饰 — 哥特+云纹混合 */}
      <g opacity="0.18">
        <circle cx={cx} cy={cy} r={r + 1} fill="none" stroke={glow} strokeWidth="0.8" />
        {/* 四角装饰点 */}
        {[0, 90, 180, 270].map(deg => {
          const rad = (deg * Math.PI) / 180;
          const dx = cx + (r + 4) * Math.cos(rad);
          const dy = cy + (r + 4) * Math.sin(rad);
          return <circle key={deg} cx={dx} cy={dy} r="2" fill={accent} opacity="0.6" />;
        })}
      </g>
    </svg>
  );
}

// ====== 各角色剪影 ======

function VeilLandSilhouette({ cx, cy, r }) {
  const scale = r / 80;
  return (
    <g transform={`translate(${cx - 40 * scale}, ${cy - 55 * scale}) scale(${scale})`} opacity="0.85">
      {/* 狼头 */}
      <path d="M40 10 C25 8 12 20 10 35 C8 48 15 55 20 55 C22 50 26 45 28 40 C26 48 22 52 25 58 C28 62 32 65 40 68 C48 65 52 62 55 58 C58 52 54 48 52 40 C54 45 58 50 60 55 C65 55 72 48 70 35 C68 20 55 8 40 10Z" fill="#1a0404" stroke="#c41e3a" strokeWidth="0.8" />
      {/* 眼睛 — 红光 */}
      <ellipse cx="28" cy="32" rx="4" ry="3" fill="#c41e3a" opacity="0.9" />
      <ellipse cx="52" cy="32" rx="4" ry="3" fill="#c41e3a" opacity="0.9" />
      <ellipse cx="28" cy="32" rx="1.5" ry="2" fill="#fff" opacity="0.6" />
      <ellipse cx="52" cy="32" rx="1.5" ry="2" fill="#fff" opacity="0.6" />
      {/* 耳朵 */}
      <path d="M22 18 L18 5 L30 15Z" fill="#1a0404" stroke="#8b0c0c" strokeWidth="0.5" />
      <path d="M58 18 L62 5 L50 15Z" fill="#1a0404" stroke="#8b0c0c" strokeWidth="0.5" />
      {/* 爪痕装饰 */}
      <line x1="15" y1="58" x2="10" y2="68" stroke="#c41e3a" strokeWidth="1.2" opacity="0.5" />
      <line x1="20" y1="60" x2="16" y2="72" stroke="#c41e3a" strokeWidth="1.2" opacity="0.5" />
      <line x1="25" y1="58" x2="23" y2="70" stroke="#c41e3a" strokeWidth="1.2" opacity="0.5" />
    </g>
  );
}

function AlphaWolfSilhouette({ cx, cy, r }) {
  const scale = r / 80;
  return (
    <g transform={`translate(${cx - 42 * scale}, ${cy - 60 * scale}) scale(${scale})`} opacity="0.9">
      {/* 王冠 */}
      <path d="M28 10 L20 0 L30 5 L40 0 L40 10Z" fill="#c9a96e" opacity="0.7" />
      <path d="M22 2 L30 7 L38 2" fill="none" stroke="#f0c060" strokeWidth="0.8" opacity="0.8" />
      {/* 狼头（更大） */}
      <path d="M42 12 C26 10 8 22 6 38 C4 52 14 60 20 60 C22 54 26 48 30 42 C28 52 22 58 26 64 C30 70 36 74 46 78 C56 74 62 70 66 64 C70 58 64 52 62 42 C64 48 70 54 72 60 C78 60 88 52 86 38 C84 22 66 10 42 12Z" fill="#1a0202" stroke="#8b0000" strokeWidth="1" />
      {/* 眼睛 */}
      <ellipse cx="30" cy="34" rx="5" ry="3.5" fill="#c41e3a" opacity="0.95" />
      <ellipse cx="62" cy="34" rx="5" ry="3.5" fill="#c41e3a" opacity="0.95" />
      <ellipse cx="30" cy="34" rx="2" ry="2.5" fill="#f0c060" opacity="0.7" />
      <ellipse cx="62" cy="34" rx="2" ry="2.5" fill="#f0c060" opacity="0.7" />
      {/* 耳朵（更大） */}
      <path d="M24 20 L16 2 L32 16Z" fill="#1a0202" stroke="#6b0808" strokeWidth="0.8" />
      <path d="M68 20 L76 2 L60 16Z" fill="#1a0202" stroke="#6b0808" strokeWidth="0.8" />
    </g>
  );
}

function SeerSilhouette({ cx, cy, r }) {
  const scale = r / 80;
  return (
    <g transform={`translate(${cx - 40 * scale}, ${cy - 50 * scale}) scale(${scale})`} opacity="0.85">
      {/* 兜帽披风 */}
      <path d="M40 8 C20 10 5 30 5 55 C5 80 15 90 30 95 C35 95 38 90 40 85 C42 90 45 95 50 95 C65 90 75 80 75 55 C75 30 60 10 40 8Z" fill="#1a0a2e" stroke="#7d3c98" strokeWidth="0.8" />
      {/* 水晶球 */}
      <circle cx="40" cy="50" r="16" fill="#2a1a4a" stroke="#c9a96e" strokeWidth="1.2" opacity="0.85" />
      <circle cx="40" cy="50" r="10" fill="none" stroke="#f0c060" strokeWidth="0.4" opacity="0.4" />
      {/* 星光 */}
      {[30, 50, 35, 45, 40].map((x, i) => {
        const y = 38 + i * 6;
        if (i >= 2 && i <= 3) return null;
        return (
          <g key={i}>
            <line x1={x - 2.5} y1={y} x2={x + 2.5} y2={y} stroke="#f0c060" strokeWidth="0.6" opacity="0.6" />
            <line x1={x} y1={y - 2.5} x2={x} y2={y + 2.5} stroke="#f0c060" strokeWidth="0.6" opacity="0.6" />
          </g>
        );
      })}
      {/* 八卦元素 */}
      <circle cx="55" cy="25" r="8" fill="none" stroke="#c9a96e" strokeWidth="0.6" opacity="0.4" />
      <path d="M55 21 C58 25 58 25 55 29 C52 25 52 25 55 21Z" fill="#c9a96e" opacity="0.3" />
    </g>
  );
}

function PoisonWitchSilhouette({ cx, cy, r }) {
  const scale = r / 80;
  return (
    <g transform={`translate(${cx - 38 * scale}, ${cy - 50 * scale}) scale(${scale})`} opacity="0.85">
      {/* 巫师帽 */}
      <path d="M38 5 C30 5 10 15 10 30 L66 30 C66 15 46 5 38 5Z" fill="#0a1a10" stroke="#2d8a1e" strokeWidth="0.8" />
      <path d="M10 30 C10 28 66 28 66 30" fill="#0a1a10" stroke="#2d8a1e" strokeWidth="0.8" />
      {/* 身体 */}
      <path d="M18 30 C15 60 20 85 25 95 L51 95 C56 85 61 60 58 30Z" fill="#0a1a10" opacity="0.8" />
      {/* 毒药瓶 */}
      <rect x="30" y="48" width="16" height="22" rx="4" fill="#1a3a2a" stroke="#4ae04a" strokeWidth="0.8" opacity="0.7" />
      <rect x="34" y="44" width="8" height="6" rx="1" fill="none" stroke="#4ae04a" strokeWidth="0.6" opacity="0.5" />
      <circle cx="38" cy="56" r="3" fill="#4ae04a" opacity="0.35" />
      {/* 蚀雾 */}
      {[30, 38, 46].map((x, i) => (
        <circle key={i} cx={x} cy={72 + i * 4} r={3 + i} fill="none" stroke="#4ae04a" strokeWidth="0.4" opacity={0.3 - i * 0.08} />
      ))}
    </g>
  );
}

function HealWitchSilhouette({ cx, cy, r }) {
  const scale = r / 80;
  return (
    <g transform={`translate(${cx - 38 * scale}, ${cy - 50 * scale}) scale(${scale})`} opacity="0.85">
      {/* 巫师帽 */}
      <path d="M38 5 C30 5 10 15 10 30 L66 30 C66 15 46 5 38 5Z" fill="#0a1a12" stroke="#27ae60" strokeWidth="0.8" />
      <path d="M10 30 C10 28 66 28 66 30" fill="#0a1a12" stroke="#27ae60" strokeWidth="0.8" />
      {/* 身体 */}
      <path d="M18 30 C15 60 20 85 25 95 L51 95 C56 85 61 60 58 30Z" fill="#0a1a12" opacity="0.8" />
      {/* 治愈之手 */}
      <path d="M28 55 C22 48 20 52 24 58 C18 54 14 58 18 64 L28 72Z" fill="none" stroke="#5ef0a0" strokeWidth="1.5" opacity="0.7" />
      <path d="M48 55 C54 48 56 52 52 58 C58 54 62 58 58 64 L48 72Z" fill="none" stroke="#5ef0a0" strokeWidth="1.5" opacity="0.7" />
      {/* 草药 */}
      <ellipse cx="34" cy="78" rx="6" ry="3" fill="#27ae60" opacity="0.4" />
      <line x1="34" y1="75" x2="34" y2="85" stroke="#5ef0a0" strokeWidth="0.6" opacity="0.35" />
      {/* 光芒 */}
      <circle cx="38" cy="62" r="14" fill="none" stroke="#5ef0a0" strokeWidth="0.5" opacity="0.2" />
    </g>
  );
}

function GuardSilhouette({ cx, cy, r }) {
  const scale = r / 80;
  return (
    <g transform={`translate(${cx - 38 * scale}, ${cy - 50 * scale}) scale(${scale})`} opacity="0.85">
      {/* 头盔 */}
      <path d="M38 5 C22 5 8 18 8 32 L68 32 C68 18 54 5 38 5Z" fill="#0a1a2a" stroke="#2980b9" strokeWidth="0.8" />
      {/* 盔甲身体 */}
      <path d="M14 32 C12 55 18 80 24 95 L52 95 C58 80 64 55 62 32Z" fill="#0a1a2a" opacity="0.8" />
      {/* 盾牌 */}
      <path d="M32 50 L24 60 L24 80 C24 82 52 82 52 80 L52 60 L44 50Z" fill="#1a2a4a" stroke="#5aa0e0" strokeWidth="1" opacity="0.75" />
      <line x1="38" y1="55" x2="38" y2="77" stroke="#5aa0e0" strokeWidth="0.8" opacity="0.5" />
      <line x1="28" y1="65" x2="48" y2="65" stroke="#5aa0e0" strokeWidth="0.8" opacity="0.5" />
      {/* 城墙装饰 */}
      <rect x="20" y="88" width="36" height="8" rx="1" fill="none" stroke="#2980b9" strokeWidth="0.6" opacity="0.4" />
      <rect x="24" y="86" width="6" height="4" fill="#2980b9" opacity="0.3" />
      <rect x="34" y="86" width="6" height="4" fill="#2980b9" opacity="0.3" />
      <rect x="44" y="86" width="6" height="4" fill="#2980b9" opacity="0.3" />
    </g>
  );
}

function HunterSilhouette({ cx, cy, r }) {
  const scale = r / 80;
  return (
    <g transform={`translate(${cx - 42 * scale}, ${cy - 52 * scale}) scale(${scale})`} opacity="0.85">
      {/* 宽檐帽 */}
      <ellipse cx="42" cy="14" rx="28" ry="5" fill="#2a1008" stroke="#d35400" strokeWidth="0.6" />
      <path d="M32 14 C32 6 52 6 52 14Z" fill="#2a1008" stroke="#d35400" strokeWidth="0.5" />
      {/* 身体 */}
      <path d="M22 16 C18 45 22 70 28 95 L56 95 C62 70 66 45 62 16Z" fill="#2a1008" opacity="0.8" />
      {/* 灵焰猎枪 */}
      <line x1="62" y1="30" x2="78" y2="20" stroke="#8a9bb5" strokeWidth="2.5" opacity="0.7" />
      <rect x="58" y="28" width="6" height="12" rx="1" fill="#5a3a2a" stroke="#8a9bb5" strokeWidth="0.5" opacity="0.6" />
      {/* 枪口烟雾 */}
      <circle cx="82" cy="18" r="4" fill="none" stroke="#bcc8d6" strokeWidth="0.5" opacity="0.3" />
      <circle cx="86" cy="14" r="5" fill="none" stroke="#bcc8d6" strokeWidth="0.4" opacity="0.2" />
      <circle cx="84" cy="22" r="3" fill="none" stroke="#bcc8d6" strokeWidth="0.4" opacity="0.2" />
      {/* 子弹带 */}
      <ellipse cx="32" cy="52" rx="6" ry="2" fill="none" stroke="#c9a96e" strokeWidth="0.4" opacity="0.4" />
      <ellipse cx="32" cy="58" rx="6" ry="2" fill="none" stroke="#c9a96e" strokeWidth="0.4" opacity="0.4" />
    </g>
  );
}

function WeaverSilhouette({ cx, cy, r }) {
  const scale = r / 80;
  return (
    <g transform={`translate(${cx - 36 * scale}, ${cy - 48 * scale}) scale(${scale})`} opacity="0.85">
      {/* 头 */}
      <circle cx="36" cy="16" r="10" fill="#1a1a28" stroke="#8a9bb5" strokeWidth="0.5" />
      {/* 身体 */}
      <path d="M18 28 C14 50 18 75 22 95 L50 95 C54 75 58 50 54 28Z" fill="#1a1a28" opacity="0.8" />
      {/* 草帽（中式笠帽） */}
      <ellipse cx="36" cy="10" rx="18" ry="4" fill="none" stroke="#bcc8d6" strokeWidth="0.6" opacity="0.45" />
      {/* 锄头/工具 */}
      <line x1="10" y1="55" x2="14" y2="85" stroke="#8a9bb5" strokeWidth="1.5" opacity="0.5" />
      <path d="M7 53 Q10 50 13 53" fill="none" stroke="#8a9bb5" strokeWidth="1" opacity="0.5" />
      {/* 灯笼 */}
      <rect x="52" y="38" width="6" height="10" rx="2" fill="#1a1a28" stroke="#e87040" strokeWidth="0.4" opacity="0.4" />
      <circle cx="55" cy="43" r="1.5" fill="#e87040" opacity="0.4" />
    </g>
  );
}
