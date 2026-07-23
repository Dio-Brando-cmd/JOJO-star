// ============================================================
// Socket.IO 连接 Hook
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// 检测是否在 Capacitor 原生 APP 中运行
function isCapacitorNative() {
  if (typeof window === 'undefined') return false;
  // Capacitor 核心注入的全局对象
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch (e) { /* ignore */ }
  // 备用: Android WebView 特征 (Capacitor 在 Android 上用 WebView)
  const ua = window.navigator?.userAgent || '';
  if (ua.includes('Android') && ua.includes('wv')) return true;
  if (ua.includes('VeilLandApp')) return true;
  return false;
}

// 服务器地址: 优先级从高到低
function getServerURL() {
  // 1. 构建时环境变量（VITE_SERVER_URL=http://...）
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  // 2. 用户手动保存的服务器地址
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('veilland_server_url') : null;
  if (stored) return stored;
  // 3. 移动端原生APP → 硬编码公网服务器
  if (isCapacitorNative()) return 'http://210.16.170.144:4000';
  // 4. 浏览器环境: 同源
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return origin;
    }
  }
  // 5. 兜底
  return 'http://210.16.170.144:4000';
}
const SERVER_URL = getServerURL();

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [privateState, setPrivateState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [error, setError] = useState(null);
  // 断线重连数据
  const reconnectRef = useRef({ roomCode: null, oldPlayerId: null, playerName: null });

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] 已连接:', socket.id);
      setConnected(true);
      setError(null);

      // 断线重连：自动尝试恢复游戏状态
      if (reconnectRef.current.roomCode && reconnectRef.current.oldPlayerId) {
        const { roomCode, oldPlayerId } = reconnectRef.current;
        console.log('[Socket] 尝试重连到房间:', roomCode, '旧ID:', oldPlayerId);
        socket.emit('room:rejoin', { roomCode, oldPlayerId }, (response) => {
          if (response?.success) {
            console.log('[Socket] 重连成功');
            setGameState(response.gameState);
          } else {
            console.log('[Socket] 重连失败:', response?.error);
            reconnectRef.current = { roomCode: null, oldPlayerId: null, playerName: null };
          }
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] 断开:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] 连接错误:', err.message);
      setError('无法连接到服务器，请确认服务器已启动');
    });

    // --- 游戏状态事件 ---
    socket.on('game:state', (state) => {
      setGameState(state);
    });

    socket.on('game:privateState', (state) => {
      setPrivateState(state);
    });

    socket.on('game:phaseChange', ({ phase, round, nightStep, timeLeft }) => {
      setGameState(prev => prev ? { ...prev, phase, round, nightStep, timeLeft } : prev);
    });

    socket.on('game:voteResults', (results) => {
      setGameState(prev => prev ? { ...prev, voteResults: results } : prev);
    });

    // v2.0: 序幕数据
    socket.on('game:prologue', (prologue) => {
      setGameState(prev => prev ? { ...prev, prologue } : prev);
    });

    socket.on('game:over', (result) => {
      setGameState(prev => {
        if (!prev) return prev;
        // 合并 game:over 中的完整玩家信息（含所有角色）
        const updatedPlayers = result.players
          ? prev.players.map(p => {
              const revealed = result.players.find(r => r.id === p.id);
              return revealed ? { ...p, role: revealed.role, alive: revealed.alive } : p;
            })
          : prev.players;
        return { ...prev, phase: 'GAME_OVER', gameResult: result, players: updatedPlayers };
      });
    });

    socket.on('game:nightStep', ({ nightStep, timeLeft }) => {
      setGameState(prev => prev ? { ...prev, nightStep, timeLeft } : prev);
    });

    // --- 聊天 ---
    socket.on('chat:message', (msg) => {
      setChatMessages(prev => [...prev.slice(-99), msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // --- 辅助方法 ---

  const createRoom = useCallback((playerName, options = {}) => {
    return new Promise((resolve) => {
      const { isPrivate, password, maxPlayers, roleConfig } = options;
      socketRef.current.emit('room:create', {
        playerName,
        isPrivate,
        password,
        maxPlayers,
        roleConfig,
      }, (response) => {
        if (response.success) {
          setGameState(response.gameState);
          // 保存重连信息
          reconnectRef.current = {
            roomCode: response.roomCode,
            oldPlayerId: socketRef.current?.id,
            playerName,
          };
        } else {
          setError(response.error);
        }
        resolve(response);
      });
    });
  }, []);

  const joinRoom = useCallback((roomCode, playerName, password = null) => {
    return new Promise((resolve) => {
      socketRef.current.emit('room:join', { roomCode, playerName, password }, (response) => {
        if (response.success) {
          setGameState(response.gameState);
          // 保存重连信息
          reconnectRef.current = {
            roomCode,
            oldPlayerId: socketRef.current?.id,
            playerName,
          };
        } else {
          setError(response.error);
        }
        resolve(response);
      });
    });
  }, []);

  const leaveRoom = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('room:leave');
    setGameState(null);
    setPrivateState(null);
    reconnectRef.current = { roomCode: null, oldPlayerId: null, playerName: null };
  }, []);

  const backToLobby = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('room:backToLobby');
    setGameState(null);
    setPrivateState(null);
    reconnectRef.current = { roomCode: null, oldPlayerId: null, playerName: null };
  }, []);

  // 游戏结束后返回房间大厅（保留房间）
  const returnToRoomLobby = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('room:returnToLobby');
  }, []);

  // 监听返回大厅事件（游戏结束自动触发）
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = (data) => {
      // 服务器发出了 returnToLobby 事件，状态由 game:state 处理
    };
    socket.on('game:returnToLobby', handler);
    return () => { socket.off('game:returnToLobby', handler); };
  }, [socketRef.current]);

  const startGame = useCallback((roleConfig) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: '未连接到服务器' });
        return;
      }
      socketRef.current.emit('game:start', { roleConfig }, (response) => {
        resolve(response || { success: false, error: '服务器无响应' });
      });
    });
  }, []);

  const submitNightAction = useCallback((action, target, ability) => {
    if (!socketRef.current) return;
    socketRef.current.emit('night:action', { action, target, ability });
  }, []);

  const skipNightStep = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('night:skip');
  }, []);

  const startVote = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('day:startVote');
  }, []);

  const submitVote = useCallback((targetId) => {
    if (!socketRef.current) return;
    socketRef.current.emit('vote:submit', { targetId });
  }, []);

  const hunterDayShoot = useCallback((targetId) => {
    if (!socketRef.current) return;
    socketRef.current.emit('hunter:dayShoot', { targetId });
  }, []);

  const sendChatMessage = useCallback((message) => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat:message', { message });
  }, []);

  const requestState = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('game:requestState');
  }, []);

  // 获取大厅房间列表
  const getLobbyList = useCallback(() => {
    return new Promise((resolve) => {
      socketRef.current.emit('lobby:list', (response) => {
        resolve(response?.rooms || []);
      });
    });
  }, []);

  // 切换房间隐私
  const toggleRoomPrivacy = useCallback((isPrivate, password) => {
    return new Promise((resolve) => {
      socketRef.current.emit('room:togglePrivacy', { isPrivate, password }, (response) => {
        resolve(response);
      });
    });
  }, []);

  // 设置房间密码
  const setRoomPassword = useCallback((password) => {
    return new Promise((resolve) => {
      socketRef.current.emit('room:setPassword', { password }, (response) => {
        resolve(response);
      });
    });
  }, []);

  // 切换人机模式
  const toggleBots = useCallback((enabled) => {
    return new Promise((resolve) => {
      socketRef.current.emit('room:toggleBots', { enabled }, (response) => {
        resolve(response);
      });
    });
  }, []);

  // 设置人机数量
  const setBotCount = useCallback((count) => {
    return new Promise((resolve) => {
      socketRef.current.emit('room:setBotCount', { count }, (response) => {
        resolve(response);
      });
    });
  }, []);

  // 修改最大人数
  const updateMaxPlayers = useCallback((maxPlayers) => {
    return new Promise((resolve) => {
      socketRef.current.emit('room:updateMaxPlayers', { maxPlayers }, (response) => {
        resolve(response);
      });
    });
  }, []);

  // 获取屋子访客数量
  const getHouseVisitors = useCallback((houseId) => {
    return new Promise((resolve) => {
      socketRef.current.emit('room:houseVisitors', { houseId }, (response) => {
        resolve(response);
      });
    });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    gameState,
    privateState,
    chatMessages,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    backToLobby,
    returnToRoomLobby,
    startGame,
    submitNightAction,
    skipNightStep,
    startVote,
    submitVote,
    hunterDayShoot,
    sendChatMessage,
    requestState,
    getLobbyList,
    toggleRoomPrivacy,
    setRoomPassword,
    toggleBots,
    setBotCount,
    updateMaxPlayers,
    getHouseVisitors,
    playerId: socketRef.current?.id || null,
  };
}
