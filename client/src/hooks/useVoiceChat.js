// ============================================================
// WebRTC 语音聊天 Hook
// 基于 Socket.IO 信令的 P2P 语音通话
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

function isSecureContext() {
  if (typeof window === 'undefined') return true;
  const ua = window.navigator?.userAgent || '';
  if (ua.includes('Electron') || ua.includes('Werewolf')) return true;
  if (window.isSecureContext) return true;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function supportsGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function useVoiceChat(socket, playerId, gameState) {
  const [isVoiceJoined, setIsVoiceJoined] = useState(false);
  const [isPTT, setIsPTT] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState(new Set());
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt');
  const [speakerTestResult, setSpeakerTestResult] = useState(null);

  const localStreamRef = useRef(null);
  const peerConnections = useRef(new Map());
  const audioElements = useRef(new Map());
  const audioContextRef = useRef(null);
  const analysersRef = useRef(new Map());
  const rafIdsRef = useRef(new Set());
  const isPTTRef = useRef(false);
  const initiateCallRef = useRef(null); // 避免循环依赖

  const resumeAudioContext = useCallback(async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try { await audioContextRef.current.resume(); } catch (e) { /* ignore */ }
    }
  }, []);

  // 测试扬声器
  const testSpeaker = useCallback(async () => {
    setSpeakerTestResult(null);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.stop(ctx.currentTime + 0.25);
      setSpeakerTestResult('✅ 扬声器正常');
      return true;
    } catch (e) {
      setSpeakerTestResult('⚠️ 扬声器测试失败');
      return false;
    }
  }, []);

  // 请求麦克风权限
  const requestMicPermission = useCallback(async () => {
    if (!supportsGetUserMedia()) {
      setError('你的浏览器不支持语音功能，请使用 Chrome/Edge/Firefox 最新版');
      return false;
    }
    if (!isSecureContext()) {
      setError('语音聊天需要 HTTPS 或 localhost');
      return false;
    }
    try {
      const perms = await navigator.permissions?.query?.({ name: 'microphone' });
      if (perms) {
        setPermissionState(perms.state);
        if (perms.state === 'denied') {
          setError('麦克风权限已被浏览器阻止');
          return false;
        }
        perms.onchange = () => setPermissionState(perms.state);
      }
    } catch (e) { /* ignore */ }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.getTracks().forEach(t => t.stop());
      setPermissionState('granted');
      return true;
    } catch (err) {
      setPermissionState('denied');
      if (err.name === 'NotAllowedError') setError('麦克风权限被拒绝');
      else if (err.name === 'NotFoundError') setError('未检测到麦克风设备');
      else setError('无法访问麦克风：' + (err.message || ''));
      return false;
    }
  }, []);

  // 初始化本地音频流
  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(t => (t.enabled = false));
      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError') setError('麦克风权限被拒绝');
      else if (err.name === 'NotFoundError') setError('未检测到麦克风设备');
      else setError('无法访问麦克风：' + (err.message || ''));
      return null;
    }
  }, []);

  // 创建与一个对等端的连接（不再依赖 initiateCall）
  const createPeerConnection = useCallback((peerId) => {
    if (peerConnections.current.has(peerId)) return null;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current.set(peerId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      audio.volume = 0.8;
      audio.play().catch(e => {
        const resume = () => {
          audio.play().catch(() => {});
          document.removeEventListener('click', resume);
          document.removeEventListener('keydown', resume);
        };
        document.addEventListener('click', resume, { once: true });
        document.addEventListener('keydown', resume, { once: true });
      });
      audioElements.current.set(peerId, audio);

      if (audioContextRef.current) {
        try {
          const source = audioContextRef.current.createMediaStreamSource(event.streams[0]);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analysersRef.current.set(peerId, analyser);

          const checkRemoteSpeaking = () => {
            if (!analysersRef.current.has(peerId)) return;
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            setSpeakingPeers(prev => {
              const next = new Set(prev);
              if (avg > 20) next.add(peerId);
              else next.delete(peerId);
              return next;
            });
            if (analysersRef.current.has(peerId)) {
              const id = requestAnimationFrame(checkRemoteSpeaking);
              rafIdsRef.current.add(id);
            }
          };
          checkRemoteSpeaking();
        } catch (e) { /* ignore */ }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice:iceCandidate', { targetId: peerId, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        pc.restartIce();
        setTimeout(() => {
          if (pc.iceConnectionState === 'failed' && peerConnections.current.has(peerId)) {
            peerConnections.current.delete(peerId);
            pc.close();
            // 通过 ref 调用避免循环依赖
            if (initiateCallRef.current) initiateCallRef.current(peerId);
          }
        }, 5000);
      }
    };

    return pc;
  }, [socket]); // 不再依赖 initiateCall

  // 发起连接
  const initiateCall = useCallback(async (peerId) => {
    const pc = createPeerConnection(peerId);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice:offer', { targetId: peerId, offer: pc.localDescription });
    } catch (err) {
      console.error('创建Offer失败:', err);
    }
  }, [socket, createPeerConnection]);

  // 同步 initiateCall 到 ref
  useEffect(() => {
    initiateCallRef.current = initiateCall;
  }, [initiateCall]);

  // 处理收到的Offer
  const handleOffer = useCallback(async (peerId, offer) => {
    const pc = createPeerConnection(peerId);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice:answer', { targetId: peerId, answer: pc.localDescription });
    } catch (err) {
      console.error('处理Offer失败:', err);
    }
  }, [socket, createPeerConnection]);

  // 处理收到的Answer
  const handleAnswer = useCallback(async (peerId, answer) => {
    const pc = peerConnections.current.get(peerId);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('处理Answer失败:', err);
    }
  }, []);

  // 处理ICE候选
  const handleIceCandidate = useCallback(async (peerId, candidate) => {
    const pc = peerConnections.current.get(peerId);
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('添加ICE失败:', err);
    }
  }, []);

  // 加入语音频道
  const joinVoice = useCallback(async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    setIsVoiceJoined(true);
    socket.emit('voice:join');

    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { /* ignore */ }
    }

    if (audioContextRef.current) {
      try {
        const localSource = audioContextRef.current.createMediaStreamSource(stream);
        const localAnalyser = audioContextRef.current.createAnalyser();
        localAnalyser.fftSize = 256;
        localSource.connect(localAnalyser);

        let stopped = false;
        let lastSpeaking = false;
        const checkSpeaking = () => {
          if (stopped || !localAnalyser) return;
          const data = new Uint8Array(localAnalyser.frequencyBinCount);
          localAnalyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          const speaking = avg > 30 && isPTTRef.current;
          if (speaking !== lastSpeaking) {
            lastSpeaking = speaking;
            socket.emit('voice:speaking', { isSpeaking: speaking });
          }
          const id = requestAnimationFrame(checkSpeaking);
          rafIdsRef.current.add(id);
        };
        checkSpeaking();
        return () => { stopped = true; };
      } catch (e) { /* ignore */ }
    }
  }, [socket, initLocalStream]);

  // 离开语音频道
  const leaveVoice = useCallback(() => {
    setIsVoiceJoined(false);
    socket.emit('voice:leave');

    for (const id of rafIdsRef.current) cancelAnimationFrame(id);
    rafIdsRef.current.clear();

    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    audioElements.current.forEach(audio => {
      try { audio.srcObject = null; audio.remove(); } catch (e) { /* ignore */ }
    });
    audioElements.current.clear();
    analysersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, [socket]);

  // 注册Socket事件
  useEffect(() => {
    if (!socket) return;

    const onPeerJoined = ({ peerId }) => {
      if (isVoiceJoined && peerId !== playerId) {
        initiateCall(peerId);
      }
    };

    const onPeerLeft = ({ peerId }) => {
      const pc = peerConnections.current.get(peerId);
      if (pc) { pc.close(); peerConnections.current.delete(peerId); }
      const audio = audioElements.current.get(peerId);
      if (audio) { try { audio.srcObject = null; audio.remove(); } catch (e) {}; audioElements.current.delete(peerId); }
      analysersRef.current.delete(peerId);
      setSpeakingPeers(prev => { const next = new Set(prev); next.delete(peerId); return next; });
    };

    const onOffer = ({ peerId, offer }) => handleOffer(peerId, offer);
    const onAnswer = ({ peerId, answer }) => handleAnswer(peerId, answer);
    const onIceCandidate = ({ peerId, candidate }) => handleIceCandidate(peerId, candidate);
    const onSpeaking = ({ peerId, isSpeaking }) => {
      setSpeakingPeers(prev => {
        const next = new Set(prev);
        if (isSpeaking) next.add(peerId); else next.delete(peerId);
        return next;
      });
    };

    socket.on('voice:peerJoined', onPeerJoined);
    socket.on('voice:peerLeft', onPeerLeft);
    socket.on('voice:offer', onOffer);
    socket.on('voice:answer', onAnswer);
    socket.on('voice:iceCandidate', onIceCandidate);
    socket.on('voice:speaking', onSpeaking);

    return () => {
      socket.off('voice:peerJoined', onPeerJoined);
      socket.off('voice:peerLeft', onPeerLeft);
      socket.off('voice:offer', onOffer);
      socket.off('voice:answer', onAnswer);
      socket.off('voice:iceCandidate', onIceCandidate);
      socket.off('voice:speaking', onSpeaking);
    };
  }, [socket, playerId, isVoiceJoined, initiateCall, handleOffer, handleAnswer, handleIceCandidate]);

  // PTT按键监听（空格键）
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && isVoiceJoined && !e.repeat) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        e.preventDefault();
        isPTTRef.current = true;
        setIsPTT(true);
        resumeAudioContext();
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = true));
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isVoiceJoined) {
        e.preventDefault();
        isPTTRef.current = false;
        setIsPTT(false);
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = false));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isVoiceJoined, resumeAudioContext]);

  const setPTT = useCallback((val) => {
    isPTTRef.current = val;
    setIsPTT(val);
    if (val) resumeAudioContext();
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = !!val));
    }
  }, [resumeAudioContext]);

  return {
    isVoiceJoined, isPTT, speakingPeers, error, permissionState, speakerTestResult,
    joinVoice, leaveVoice, setPTT, testSpeaker, requestMicPermission, resumeAudioContext,
    isSecureCtx: isSecureContext(),
  };
}
