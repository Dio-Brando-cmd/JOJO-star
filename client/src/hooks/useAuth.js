// ============================================================
// 用户认证 Hook — 注册/登录/状态管理
// ============================================================

import { useState, useCallback } from 'react';

export function useAuth(socketRef) {
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const login = useCallback((username, password) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ error: '未连接到服务器' });
        return;
      }
      setAuthLoading(true);
      setAuthError(null);
      socketRef.current.emit('auth:login', { username, password }, (result) => {
        setAuthLoading(false);
        if (result.success) {
          setUser(result.user);
          setAuthError(null);
        } else {
          setAuthError(result.error);
        }
        resolve(result);
      });
    });
  }, []);

  const register = useCallback((username, password) => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ error: '未连接到服务器' });
        return;
      }
      setAuthLoading(true);
      setAuthError(null);
      socketRef.current.emit('auth:register', { username, password }, (result) => {
        setAuthLoading(false);
        if (result.success) {
          // 注册成功后自动登录
          socketRef.current.emit('auth:login', { username, password }, (loginResult) => {
            if (loginResult.success) {
              setUser(loginResult.user);
            }
            resolve(loginResult);
          });
        } else {
          setAuthError(result.error);
          resolve(result);
        }
      });
    });
  }, []);

  const logout = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('auth:logout');
    }
    setUser(null);
  }, []);

  const updateStats = useCallback((won) => {
    if (socketRef.current && user) {
      socketRef.current.emit('auth:updateStats', { won });
    }
  }, [user]);

  return {
    user,
    setUser,
    authError,
    setAuthError,
    authLoading,
    login,
    register,
    logout,
    updateStats,
  };
}
