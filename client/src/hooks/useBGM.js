// ============================================================
// BGM 音乐播放器 —— 使用真实 MP3 文件替代程序化合成
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';

// BGM 曲目列表
const BGM_TRACKS = [
  { id: 'none', name: '无（程序化音乐）', file: null },
  { id: 'JO飞', name: 'JO飞', file: '/bgm/JO飞.mp3' },
  { id: 'JO二', name: 'JO二', file: '/bgm/JO二.mp3' },
  { id: 'JO大', name: 'JO大', file: '/bgm/JO大.mp3' },
  { id: '虫二', name: '虫二', file: '/bgm/虫二.mp3' },
  { id: '虫大', name: '虫大', file: '/bgm/虫大.mp3' },
];

// 默认各场景使用的曲目
const DEFAULT_PHASE_TRACKS = {
  lobby: 'JO飞',
  night: 'JO二',
  day: 'JO大',
  vote: 'JO大',
  gameOver: '虫二',
};

export function useBGM() {
  const [bgmEnabled, setBgmEnabled] = useState(() => {
    return localStorage.getItem('veilland_bgm_enabled') !== 'false';
  });
  const [bgmVolume, setBgmVolume] = useState(() => {
    return parseFloat(localStorage.getItem('veilland_bgm_volume') || '0.5');
  });
  const [currentTrack, setCurrentTrack] = useState(() => {
    return localStorage.getItem('veilland_bgm_track') || 'JO飞';
  });
  const [phaseTracks, setPhaseTracks] = useState(() => {
    try {
      const saved = localStorage.getItem('veilland_bgm_phase_tracks');
      return saved ? JSON.parse(saved) : { ...DEFAULT_PHASE_TRACKS };
    } catch { return { ...DEFAULT_PHASE_TRACKS }; }
  });

  const audioRef = useRef(null);
  const currentFileRef = useRef(null);

  // 初始化 Audio 元素
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = bgmVolume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // 更新音量
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgmVolume;
    }
  }, [bgmVolume]);

  // 播放指定曲目
  const play = useCallback((trackFile) => {
    const audio = audioRef.current;
    if (!audio || !bgmEnabled) return;

    if (currentFileRef.current === trackFile) {
      // 已是同一首，只确保在播放
      if (audio.paused) audio.play().catch(() => {});
      return;
    }

    currentFileRef.current = trackFile;
    audio.src = trackFile;
    audio.play().catch((e) => {
      console.log('[BGM] 播放失败（等待用户交互）:', e.message);
    });
  }, [bgmEnabled]);

  // 停止
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    currentFileRef.current = null;
  }, []);

  // 根据场景播放
  const playForPhase = useCallback((phase) => {
    if (!bgmEnabled) return;
    const trackId = phaseTracks[phase] || phaseTracks.lobby || 'JO飞';
    const track = BGM_TRACKS.find(t => t.id === trackId);
    if (track && track.file) {
      play(track.file);
    }
  }, [bgmEnabled, phaseTracks, play]);

  // 切换曲目
  const setTrack = useCallback((trackId) => {
    setCurrentTrack(trackId);
    localStorage.setItem('veilland_bgm_track', trackId);
    const track = BGM_TRACKS.find(t => t.id === trackId);
    if (track && track.file) {
      play(track.file);
    } else if (trackId === 'none') {
      stop();
    }
  }, [play, stop]);

  // 设置场景曲目映射
  const setPhaseTrack = useCallback((phase, trackId) => {
    setPhaseTracks(prev => {
      const next = { ...prev, [phase]: trackId };
      localStorage.setItem('veilland_bgm_phase_tracks', JSON.stringify(next));
      return next;
    });
  }, []);

  // 开关BGM
  const toggleBGM = useCallback(() => {
    setBgmEnabled(prev => {
      const next = !prev;
      localStorage.setItem('veilland_bgm_enabled', String(next));
      if (!next) stop();
      return next;
    });
  }, [stop]);

  // 设置音量
  const setVolume = useCallback((vol) => {
    setBgmVolume(vol);
    localStorage.setItem('veilland_bgm_volume', String(vol));
  }, []);

  return {
    bgmEnabled, setBgmEnabled, toggleBGM,
    bgmVolume, setVolume,
    currentTrack, setTrack,
    phaseTracks, setPhaseTrack,
    playForPhase, play, stop,
    BGM_TRACKS,
  };
}
