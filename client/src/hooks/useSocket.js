// ============================================================
// Socket.IO 连接 Hook
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// 自动检测服务器地址：
// 1. 环境变量（开发用）
// 2. 本地存储（用户手动输入的服务器地址）
// 3. 当前页面的 host（适配公网/局域网）
function getServerURL() {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('werewolf_server_url') : null;
  if (stored) return stored;
  return window.location.origin;
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

    socket.on('game:phaseChange', ({ phase, round, nightStep }) => {
      setGameState(prev => prev ? { ...prev, phase, round, nightStep } : prev);
    });

    socket.on('game:voteResults', (results) => {
      setGameState(prev => prev ? { ...prev, voteResults: results } : prev);
    });

    socket.on('game:over', (result) => {
      setGameState(prev => prev ? { ...prev, phase: 'GAME_OVER', gameResult: result } : prev);
    });

    socket.on('game:nightStep', ({ nightStep }) => {
      setGameState(prev => prev ? { ...prev, nightStep } : prev);
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

  const startGame = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('game:start');
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
    updateMaxPlayers,
    getHouseVisitors,
    playerId: socketRef.current?.id || null,
  };
}
