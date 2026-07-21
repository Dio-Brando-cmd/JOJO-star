// ============================================================
// 粒子背景系统 — Canvas-based 粒子引擎
// 多种预设：萤火虫 / 灰烬 / 迷雾 / 血滴 / 光雨
// ============================================================

import React, { useRef, useEffect, useCallback } from 'react';

const PRESETS = {
  /** 首页 — 萤火虫 + 飘浮光点 */
  fireflies: {
    count: 45,
    speed: 0.4,
    size: [1.5, 4],
    colors: ['#f0c060', '#c9a96e', '#e87040', '#e8c880'],
    spawnEdge: 'random',
    lifetime: Infinity,
    behavior: 'float',
    blend: 'lighter',
  },
  /** 大厅 — 缓慢飘落的灰烬 */
  embers: {
    count: 30,
    speed: 0.3,
    size: [1, 3],
    colors: ['#c41e3a', '#e87040', '#8b0c0c', '#d4a840'],
    spawnEdge: 'bottom',
    lifetime: [4000, 10000],
    behavior: 'rise',
    blend: 'lighter',
  },
  /** 夜晚 — 深蓝迷雾 + 暗红眼影 */
  night: {
    count: 25,
    speed: 0.15,
    size: [48, 120],
    colors: ['rgba(10,15,40,0.04)', 'rgba(20,30,60,0.03)', 'rgba(139,12,12,0.02)'],
    spawnEdge: 'random',
    lifetime: [8000, 20000],
    behavior: 'drift',
    blend: 'normal',
  },
  /** 白天 — 薄雾 + 阳光微粒 */
  day: {
    count: 20,
    speed: 0.2,
    size: [60, 140],
    colors: ['rgba(200,180,140,0.025)', 'rgba(180,160,120,0.02)', 'rgba(220,200,160,0.015)'],
    spawnEdge: 'left',
    lifetime: [10000, 25000],
    behavior: 'drift',
    blend: 'normal',
  },
  /** 投票 — 紧张血滴 */
  blood: {
    count: 15,
    speed: 0.5,
    size: [2, 6],
    colors: ['#8b0c0c', '#a31525', '#6b0808'],
    spawnEdge: 'top',
    lifetime: [2000, 6000],
    behavior: 'fall',
    blend: 'normal',
  },
  /** 结算胜 — 金色光雨 */
  goldRain: {
    count: 60,
    speed: 0.7,
    size: [1, 3],
    colors: ['#f0c060', '#c9a96e', '#e8d080', '#d4a840'],
    spawnEdge: 'top',
    lifetime: [2000, 5000],
    behavior: 'fall',
    blend: 'lighter',
  },
  /** 结算败 — 暗红灰烬 */
  ashFall: {
    count: 40,
    speed: 0.4,
    size: [1, 4],
    colors: ['#4a4a5a', '#3a3a4a', '#6a3a3a', '#8a9bb5'],
    spawnEdge: 'top',
    lifetime: [3000, 8000],
    behavior: 'fallSway',
    blend: 'normal',
  },
};

export default function ParticleBackground({ type = 'fireflies', density = 1, className = '' }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const dimensionsRef = useRef({ w: 0, h: 0 });

  const preset = PRESETS[type] || PRESETS.fireflies;

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { innerWidth: w, innerHeight: h } = window;
    canvas.width = w;
    canvas.height = h;
    dimensionsRef.current = { w, h };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    // 初始化粒子
    const count = Math.floor(preset.count * density);
    const { w, h } = dimensionsRef.current;
    particlesRef.current = Array.from({ length: count }, () => spawnParticle(preset, w, h));

    function animate() {
      const { w, h } = dimensionsRef.current;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        updateParticle(p, preset, w, h);
        drawParticle(ctx, p, preset);
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [type, density]);

  return (
    <canvas
      ref={canvasRef}
      className={`particle-canvas ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

// ====== 粒子工具函数 ======

function spawnParticle(p, w, h) {
  const [minSize, maxSize] = p.size;
  return {
    x: p.spawnEdge === 'left' ? -20 : p.spawnEdge === 'top' ? Math.random() * w : Math.random() * w,
    y: p.spawnEdge === 'bottom' ? h + 20 : p.spawnEdge === 'top' ? -20 : p.spawnEdge === 'left' ? Math.random() * h : Math.random() * h,
    r: minSize + Math.random() * (maxSize - minSize),
    vx: (Math.random() - 0.5) * p.speed * 2,
    vy: (Math.random() - 0.5) * p.speed * 2,
    opacity: 0.2 + Math.random() * 0.6,
    color: p.colors[Math.floor(Math.random() * p.colors.length)],
    age: 0,
    lifetime: Array.isArray(p.lifetime)
      ? p.lifetime[0] + Math.random() * (p.lifetime[1] - p.lifetime[0])
      : p.lifetime,
    phase: Math.random() * Math.PI * 2,
  };
}

function updateParticle(p, preset, w, h) {
  p.age += 16; // ~60fps

  // 过期重生
  if (p.lifetime !== Infinity && p.age > p.lifetime) {
    Object.assign(p, spawnParticle(preset, w, h));
  }

  const s = preset.speed;
  switch (preset.behavior) {
    case 'float':
      p.x += Math.sin(p.age * 0.002 + p.phase) * s * 0.4;
      p.y += Math.cos(p.age * 0.003 + p.phase) * s * 0.3 - s * 0.15;
      p.opacity = 0.3 + Math.sin(p.age * 0.003 + p.phase) * 0.3;
      break;
    case 'rise':
      p.y -= s * (0.5 + Math.random() * 0.2);
      p.x += Math.sin(p.age * 0.002 + p.phase) * s * 0.5;
      p.opacity = Math.max(0, 1 - p.age / p.lifetime);
      break;
    case 'drift':
      p.x += p.vx * 0.3;
      p.y += p.vy * 0.3;
      p.opacity = 0.5 + Math.sin(p.age * 0.001) * 0.5;
      break;
    case 'fall':
      p.y += s * 2;
      p.x += Math.sin(p.age * 0.005 + p.phase) * s * 0.3;
      p.opacity = Math.max(0, 1 - p.age / p.lifetime);
      break;
    case 'fallSway':
      p.y += s * 1.5;
      p.x += Math.sin(p.age * 0.003 + p.phase) * s * 0.8;
      p.opacity = Math.max(0, 1 - p.age / p.lifetime);
      break;
    default:
      break;
  }

  // 边界循环
  const margin = p.r * 3;
  if (p.x < -margin) p.x = w + margin;
  if (p.x > w + margin) p.x = -margin;
  if (p.y < -margin) p.y = h + margin;
  if (p.y > h + margin) {
    if (preset.behavior === 'rise' || preset.behavior === 'fall' || preset.behavior === 'fallSway') {
      p.y = -margin;
      p.x = Math.random() * w;
    } else {
      p.y = -margin;
    }
  }
}

function drawParticle(ctx, p, preset) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));

  if (preset.blend === 'lighter') {
    ctx.globalCompositeOperation = 'lighter';
  }

  // 大粒子（迷雾）用径向渐变
  if (p.r > 40) {
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    gradient.addColorStop(0, p.color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = p.color;
  }

  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();

  // 小粒子加光晕
  if (p.r < 8 && preset.blend === 'lighter') {
    ctx.globalAlpha = Math.max(0, p.opacity * 0.3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
