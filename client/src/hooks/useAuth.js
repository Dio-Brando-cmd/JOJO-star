// ============================================================
// 用户认证 Hook — 注册/登录/状态管理
// 自动等待 socket 连接，无需用户手动等待
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';

export function useAuth(socketRef) {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // 使用 ref 追踪最新的 socketRef，防止 useCallback 闭包捕获到 null socket
  // （首次渲染时 socket 尚未连接，socketRef = { current: null }）
  const latestSocketRef = useRef(socketRef);
  useEffect(() => { latestSocketRef.current = socketRef; }, [socketRef]);

  // 等待 socket 连接（最多等 15 秒）
  const waitForConnection = useCallback((timeoutMs = 15000) => {
    return new Promise((resolve) => {
      const socket = latestSocketRef.current.current;
      // 已经连接，直接返回
      if (socket && socket.connected) {
        resolve(true);
        return;
      }

      // 如果 socket 还没创建，等待它出现
      const startTime = Date.now();
      const check = () => {
        const s = latestSocketRef.current.current;
        if (s && s.connected) {
          resolve(true);
          return;
        }
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(check, 300);
      };
      check();
    });
  }, []);

  // 带超时和自动等待连接的 socket emit
  const emitWithTimeout = useCallback(async (event, data, timeoutMs = 10000) => {
    // 先等待连接
    const connected = await waitForConnection(15000);
    if (!connected) {
      return { error: '无法连接到服务器，请检查网络后刷新页面重试' };
    }

    return new Promise((resolve) => {
      const socket = latestSocketRef.current.current;
      if (!socket || !socket.connected) {
        resolve({ error: '连接已断开，请刷新页面重试' });
        return;
      }

      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ error: '服务器响应超时，请稍后重试' });
        }
      }, timeoutMs);

      socket.emit(event, data, (result) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(result || { error: '服务器返回异常' });
        }
      });
    });
  }, [waitForConnection]);

  const login = useCallback(async (username, password) => {
    setAuthLoading(true);
    setAuthError(null);
    const result = await emitWithTimeout('auth:login', { username, password }, 15000);
    setAuthLoading(false);
    if (result.success) {
      setUser(result.user);
      setAuthError(null);
    } else {
      setAuthError(result.error);
    }
    return result;
  }, [emitWithTimeout]);

  const register = useCallback(async (username, password) => {
    setAuthLoading(true);
    setAuthError(null);

    // 注册
    const result = await emitWithTimeout('auth:register', { username, password }, 15000);
    if (!result.success) {
      setAuthLoading(false);
      setAuthError(result.error);
      return result;
    }

    // 注册成功后自动登录
    const loginResult = await emitWithTimeout('auth:login', { username, password }, 15000);
    setAuthLoading(false);
    if (loginResult.success) {
      setUser(loginResult.user);
    } else {
      setAuthError(loginResult.error);
    }
    return loginResult;
  }, [emitWithTimeout]);

  // 快速游戏（无需注册，仅检查连接）
  const quickPlay = useCallback(async (name) => {
    setAuthLoading(true);
    setAuthError(null);
    const connected = await waitForConnection(10000);
    setAuthLoading(false);
    if (!connected) {
      setAuthError('无法连接到服务器，请检查网络后刷新页面');
      return false;
    }
    return true;
  }, [waitForConnection]);

  const logout = useCallback(() => {
    const s = latestSocketRef.current.current;
    if (s) {
      s.emit('auth:logout');
    }
    setUser(null);
  }, []);

  const updateStats = useCallback((won) => {
    const s = latestSocketRef.current.current;
    if (s && user) {
      s.emit('auth:updateStats', { won });
    }
  }, [user]);

  const getReplays = useCallback(() => {
    return emitWithTimeout('auth:replays', {}, 10000);
  }, [emitWithTimeout]);

  const getProfile = useCallback(() => {
    return emitWithTimeout('auth:profile', {}, 10000);
  }, [emitWithTimeout]);

  return {
    user,
    setUser,
    authError,
    setAuthError,
    authLoading,
    login,
    register,
    quickPlay,
    logout,
    updateStats,
    getReplays,
    getProfile,
    socketRef,
  };
}
