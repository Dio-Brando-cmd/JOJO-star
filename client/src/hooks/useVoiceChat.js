// ============================================================
// WebRTC 语音聊天 Hook
// 基于 Socket.IO 信令的 P2P 语音通话
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useVoiceChat(socket, playerId, gameState) {
  const [isVoiceJoined, setIsVoiceJoined] = useState(false);
  const [isPTT, setIsPTT] = useState(false); // Push-to-talk 状态
  const [speakingPeers, setSpeakingPeers] = useState(new Set());
  const [error, setError] = useState(null);

  const localStreamRef = useRef(null);
  const peerConnections = useRef(new Map()); // peerId -> RTCPeerConnection
  const audioElements = useRef(new Map());    // peerId -> HTMLAudioElement
  const audioContextRef = useRef(null);
  const analysersRef = useRef(new Map());     // peerId -> AnalyserNode
  const rafIdsRef = useRef(new Set());        // requestAnimationFrame IDs for cleanup

  // 请求麦克风权限
  const requestMicPermission = useCallback(async () => {
    try {
      // 先检查是否已有权限
      const permissions = await navigator.permissions?.query?.({ name: 'microphone' });
      if (permissions?.state === 'denied') {
        setError('麦克风权限已被拒绝，请在浏览器设置中允许麦克风访问');
        return false;
      }
      // 尝试获取权限（浏览器会弹出询问）
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // 获取成功后立即停止流，仅用于权限检查
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (err) {
      console.error('麦克风权限请求失败:', err);
      if (err.name === 'NotAllowedError') {
        setError('需要在浏览器设置中允许麦克风访问，才能使用语音');
      } else if (err.name === 'NotFoundError') {
        setError('未检测到麦克风设备');
      } else {
        setError('无法访问麦克风：' + (err.message || '未知错误'));
      }
      return false;
    }
  }, []);

  // 初始化本地音频流
  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('麦克风访问失败:', err);
      if (err.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在浏览器设置中允许后重试');
      } else if (err.name === 'NotFoundError') {
        setError('未检测到麦克风设备');
      } else {
        setError('无法访问麦克风：' + (err.message || '未知错误'));
      }
      return null;
    }
  }, []);

  // 加入语音频道
  const joinVoice = useCallback(async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    setIsVoiceJoined(true);
    socket.emit('voice:join');

    // 初始化 AudioContext 用于检测说话状态
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // 创建本地音频分析器
    const localSource = audioContextRef.current.createMediaStreamSource(stream);
    const localAnalyser = audioContextRef.current.createAnalyser();
    localAnalyser.fftSize = 256;
    localSource.connect(localAnalyser);

    // 定期检测本地音量，发送说话状态
    let stopped = false;
    const checkSpeaking = () => {
      if (stopped || !localAnalyser) return;
      const data = new Uint8Array(localAnalyser.frequencyBinCount);
      localAnalyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const speaking = avg > 30 && isPTT;
      socket.emit('voice:speaking', { isSpeaking: speaking });
      const id = requestAnimationFrame(checkSpeaking);
      rafIdsRef.current.add(id);
    };
    checkSpeaking();
    // 返回停止函数供 leaveVoice 使用
    return () => { stopped = true; };
  }, [socket, isPTT, isVoiceJoined, initLocalStream]);

  // 离开语音频道
  const leaveVoice = useCallback(() => {
    setIsVoiceJoined(false);
    socket.emit('voice:leave');

    // 取消所有 requestAnimationFrame 循环（防止 CPU 泄漏）
    for (const id of rafIdsRef.current) {
      cancelAnimationFrame(id);
    }
    rafIdsRef.current.clear();

    // 关闭所有对等连接
    peerConnections.current.forEach((pc, peerId) => {
      pc.close();
    });
    peerConnections.current.clear();

    // 清理音频元素
    audioElements.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    audioElements.current.clear();

    // 清理分析器
    analysersRef.current.clear();

    // 停止本地流
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [socket]);

  // 创建与一个对等端的连接
  const createPeerConnection = useCallback((peerId) => {
    if (peerConnections.current.has(peerId)) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current.set(peerId, pc);

    // 添加本地音频流
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // 接收远程音频流
    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.autoplay = true;
      audio.volume = 0.8;
      audioElements.current.set(peerId, audio);

      // 分析远程音频以显示说话状态
      if (audioContextRef.current) {
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
      }
    };

    // ICE候选
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('voice:iceCandidate', {
          targetId: peerId,
          candidate: event.candidate,
        });
      }
    };

    // 如果是发起方，创建Offer
    return pc;
  }, [socket]);

  // 发起连接（作为Offer方）
  const initiateCall = useCallback(async (peerId) => {
    const pc = createPeerConnection(peerId);
    if (!pc) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice:offer', {
        targetId: peerId,
        offer: pc.localDescription,
      });
    } catch (err) {
      console.error('创建Offer失败:', err);
    }
  }, [socket, createPeerConnection]);

  // 处理收到的Offer
  const handleOffer = useCallback(async (peerId, offer) => {
    const pc = createPeerConnection(peerId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice:answer', {
        targetId: peerId,
        answer: pc.localDescription,
      });
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
      if (pc) {
        pc.close();
        peerConnections.current.delete(peerId);
      }
      const audio = audioElements.current.get(peerId);
      if (audio) {
        audio.srcObject = null;
        audio.remove();
        audioElements.current.delete(peerId);
      }
      analysersRef.current.delete(peerId);
      setSpeakingPeers(prev => {
        const next = new Set(prev);
        next.delete(peerId);
        return next;
      });
    };

    const onOffer = ({ peerId, offer }) => {
      handleOffer(peerId, offer);
    };

    const onAnswer = ({ peerId, answer }) => {
      handleAnswer(peerId, answer);
    };

    const onIceCandidate = ({ peerId, candidate }) => {
      handleIceCandidate(peerId, candidate);
    };

    const onSpeaking = ({ peerId, isSpeaking }) => {
      setSpeakingPeers(prev => {
        const next = new Set(prev);
        if (isSpeaking) next.add(peerId);
        else next.delete(peerId);
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

  // 不再自动加入语音 — 用户需显式点击"加入语音"按钮授权
  // useEffect(() => {
  //   if (gameState?.phase && gameState.phase !== 'LOBBY' && !isVoiceJoined) {
  //     joinVoice();
  //   }
  // }, [gameState?.phase]);

  // PTT按键监听（空格键，忽略输入框中的空格）
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && isVoiceJoined && !e.repeat) {
        // 不在输入框中时不触发PTT
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        e.preventDefault();
        setIsPTT(true);
        // 启用音频轨道
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = true));
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isVoiceJoined) {
        e.preventDefault();
        setIsPTT(false);
        // 禁用音频轨道（静音但保持连接）
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
  }, [isVoiceJoined]);

  const setPTT = useCallback((val) => {
    setIsPTT(val);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = val));
    }
  }, []);

  return {
    isVoiceJoined,
    isPTT,
    speakingPeers,
    error,
    joinVoice,
    leaveVoice,
    setPTT,  // 暴露给 VoiceChat 组件的PTT按钮使用
    requestMicPermission,  // 显式请求麦克风权限
  };
}
