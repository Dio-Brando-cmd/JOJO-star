// ============================================================
// 游戏音效与音乐管理器
// 使用 Web Audio API 生成程序化音效
// 可替换为真实音频文件
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';

export function useAudio() {
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [sfxVolume, setSfxVolume] = useState(0.6);

  const audioCtxRef = useRef(null);
  const musicNodesRef = useRef({});  // 当前播放的音乐节点
  const currentMusicRef = useRef(null);
  const lastTrackRef = useRef(null);  // 记住最后的音轨以便恢复

  // 初始化 AudioContext（在用户手势中调用可避免浏览器 autoplay 策略阻止）
  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      // resume() 在用户手势上下文中才能成功；非手势调用会被浏览器静默忽略
      audioCtxRef.current.resume().catch(() => {
        // 浏览器阻止了——等下次用户点击时通过 resumeOnInteraction 恢复
      });
    }
    return audioCtxRef.current;
  }, []);

  // 在用户交互时尝试恢复 AudioContext（绑定到全局 click 事件）
  const resumeOnInteraction = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().then(() => {
        // 恢复成功，如果之前有音乐被暂停，重新播放
        if (currentMusicRef.current && musicEnabled) {
          // 音乐节点在 AudioContext 恢复后自动恢复
        }
      }).catch(() => {});
    }
  }, [musicEnabled]);

  // 全局事件：用户点击任意位置时尝试恢复 AudioContext
  useEffect(() => {
    const handler = () => resumeOnInteraction();
    window.addEventListener('click', handler, { once: false });
    window.addEventListener('keydown', handler, { once: false });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [resumeOnInteraction]);

  // ---- 音效 ----

  const playSFX = useCallback((soundId) => {
    if (!sfxEnabled) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const vol = sfxVolume;

    switch (soundId) {
      case 'night_start':
        playNightStart(ctx, now, vol);
        break;
      case 'day_start':
        playDayStart(ctx, now, vol);
        break;
      case 'death':
        playDeath(ctx, now, vol);
        break;
      case 'vote':
        playVote(ctx, now, vol);
        break;
      case 'wolf_howl':
        playWolfHowl(ctx, now, vol);
        break;
      case 'gunshot':
        playGunshot(ctx, now, vol);
        break;
      case 'heal':
        playHeal(ctx, now, vol);
        break;
      case 'poison':
        playPoison(ctx, now, vol);
        break;
      case 'button_click':
        playClick(ctx, now, vol);
        break;
      case 'game_start':
        playGameStart(ctx, now, vol);
        break;
      case 'game_over':
        playGameOver(ctx, now, vol);
        break;
      default:
        break;
    }
  }, [sfxEnabled, sfxVolume, getCtx]);

  // ---- 背景音乐 ----

  const playMusic = useCallback((trackId) => {
    stopMusic();
    lastTrackRef.current = trackId;  // 记住当前音轨

    if (!musicEnabled) return;

    const ctx = getCtx();

    switch (trackId) {
      case 'lobby':
        currentMusicRef.current = playLobbyMusic(ctx, musicVolume);
        break;
      case 'night':
        currentMusicRef.current = playNightMusic(ctx, musicVolume);
        break;
      case 'day':
        currentMusicRef.current = playDayMusic(ctx, musicVolume);
        break;
      case 'game_over_win':
        currentMusicRef.current = playWinMusic(ctx, musicVolume);
        break;
      case 'game_over_lose':
        currentMusicRef.current = playLoseMusic(ctx, musicVolume);
        break;
      default:
        break;
    }
  }, [musicEnabled, musicVolume, getCtx]);

  const stopMusic = useCallback(() => {
    if (currentMusicRef.current) {
      const nodes = currentMusicRef.current;
      if (Array.isArray(nodes)) {
        nodes.forEach(n => {
          try { n.stop(); } catch (e) { /* already stopped */ }
        });
      }
      currentMusicRef.current = null;
    }
  }, []);

  // 根据游戏阶段自动切换音乐
  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, [stopMusic]);

  const resumeMusic = useCallback(() => {
    if (musicEnabled && lastTrackRef.current) {
      playMusic(lastTrackRef.current);
    }
  }, [musicEnabled, playMusic]);

  return {
    musicEnabled, setMusicEnabled,
    sfxEnabled, setSfxEnabled,
    musicVolume, setMusicVolume,
    sfxVolume, setSfxVolume,
    playSFX,
    playMusic,
    stopMusic,
    resumeMusic,
    resumeOnInteraction,
  };
}

// ==================== 音效生成函数（Web Audio API 程序化合成） ====================

function gain(ctx, vol) {
  const g = ctx.createGain();
  g.gain.value = vol;
  g.connect(ctx.destination);
  return g;
}

// 夜晚开始 —— 低沉的嗡声
function playNightStart(ctx, now, vol) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(40, now + 2);
  const g = gain(ctx, vol * 0.5);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 2);
}

// 白天开始 —— 公鸡啼鸣版（用上升音阶替代）
function playDayStart(ctx, now, vol) {
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.15);
    osc.connect(g);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.3);
  });
}

// 死亡 —— 低沉和弦
function playDeath(ctx, now, vol) {
  [130, 110, 98].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.2);
    osc.connect(g);
    osc.start(now + i * 0.3);
    osc.stop(now + i * 0.3 + 1.5);
  });
}

// 投票 —— 敲击声
function playVote(ctx, now, vol) {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 800;
  const g = gain(ctx, vol * 0.08);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.05);
  // 双音
  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.value = 600;
  const g2 = gain(ctx, vol * 0.06);
  osc2.connect(g2);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.13);
}

// 狼嚎 —— 滑音
function playWolfHowl(ctx, now, vol) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(600, now + 0.5);
  osc.frequency.linearRampToValueAtTime(400, now + 1);
  osc.frequency.linearRampToValueAtTime(300, now + 1.5);
  const g = gain(ctx, vol * 0.2);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 1.5);
}

// 枪声 —— 噪声爆发
function playGunshot(ctx, now, vol) {
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const g = gain(ctx, vol * 0.4);
  source.connect(g);
  source.start(now);
}

// 治疗 —— 柔和上升
function playHeal(ctx, now, vol) {
  [440, 554, 659].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.12);
    osc.connect(g);
    osc.start(now + i * 0.2);
    osc.stop(now + i * 0.2 + 0.6);
  });
}

// 毒药 —— 刺耳下降
function playPoison(ctx, now, vol) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1000, now);
  osc.frequency.linearRampToValueAtTime(100, now + 1.5);
  const g = gain(ctx, vol * 0.1);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 1.5);
}

// 按钮点击
function playClick(ctx, now, vol) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1000;
  const g = gain(ctx, vol * 0.05);
  osc.connect(g);
  osc.start(now);
  osc.stop(now + 0.03);
}

// 游戏开始
function playGameStart(ctx, now, vol) {
  [262, 330, 392, 523].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.15);
    osc.connect(g);
    osc.start(now + i * 0.2);
    osc.stop(now + i * 0.2 + 0.4);
  });
}

// 游戏结束
function playGameOver(ctx, now, vol) {
  [523, 494, 440, 392, 349, 330, 294, 262].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.12);
    osc.connect(g);
    osc.start(now + i * 0.25);
    osc.stop(now + i * 0.25 + 0.5);
  });
}

// ==================== 背景音乐（程序化氛围音） ====================

// 大厅音乐 —— 轻松的环境音
function playLobbyMusic(ctx, vol) {
  const nodes = [];
  // 低音铺垫
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 130;
  const g1 = gain(ctx, vol * 0.08);
  osc1.connect(g1);
  osc1.start();
  nodes.push(osc1);

  // 高音点缀循环
  const notes = [523, 587, 659, 523, 659, 698, 587, 523];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.04);
    osc.connect(g);
    const startTime = ctx.currentTime + i * 1.5;
    osc.start(startTime);
    osc.stop(startTime + 1.2);
    nodes.push(osc);

    // 循环
    const totalLoop = notes.length * 1.5;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq;
    const g2 = gain(ctx, vol * 0.04);
    osc2.connect(g2);
    osc2.start(startTime + totalLoop);
    osc2.stop(startTime + totalLoop + 1.2);
    nodes.push(osc2);
  });

  return nodes;
}

// 夜晚音乐 —— 低沉紧张的氛围
function playNightMusic(ctx, vol) {
  const nodes = [];
  // 持续低音
  [55, 65, 55].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.04);
    osc.connect(g);
    osc.start();
    nodes.push(osc);
  });

  // 不规则的打击
  for (let i = 0; i < 12; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 40 + Math.random() * 20;
    const g = gain(ctx, vol * 0.06);
    osc.connect(g);
    const startTime = ctx.currentTime + Math.random() * 20;
    osc.start(startTime);
    osc.stop(startTime + 0.5 + Math.random() * 1);
    nodes.push(osc);
  }

  return nodes;
}

// 白天音乐 —— 明亮轻松的
function playDayMusic(ctx, vol) {
  const nodes = [];
  const chords = [
    [262, 330, 392],
    [294, 349, 440],
    [330, 392, 523],
    [262, 330, 392],
  ];

  chords.forEach((chord, ci) => {
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = gain(ctx, vol * 0.04);
      osc.connect(g);
      const startTime = ctx.currentTime + ci * 4;
      osc.start(startTime);
      osc.stop(startTime + 3.5);
      nodes.push(osc);
    });
  });

  return nodes;
}

// 胜利音乐
function playWinMusic(ctx, vol) {
  const nodes = [];
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.1);
    osc.connect(g);
    osc.start(ctx.currentTime + i * 0.3);
    osc.stop(ctx.currentTime + i * 0.3 + 1);
    nodes.push(osc);
  });
  return nodes;
}

// 失败音乐
function playLoseMusic(ctx, vol) {
  const nodes = [];
  [392, 349, 330, 262].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = gain(ctx, vol * 0.1);
    osc.connect(g);
    osc.start(ctx.currentTime + i * 0.5);
    osc.stop(ctx.currentTime + i * 0.5 + 1.2);
    nodes.push(osc);
  });
  return nodes;
}
