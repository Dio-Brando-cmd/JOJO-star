// ============================================================
// 战绩统计面板 — 个人战绩 / 排行榜
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';

export default function StatsPanel({ socket, auth, onBack }) {
  const [tab, setTab] = useState('my'); // 'my' | 'leaderboard'
  const [myStats, setMyStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // 从 socket 或 REST API 获取
      if (socket?.socket) {
        socket.socket.emit('stats:getMyStats', (data) => {
          if (data) setMyStats(data);
        });
        socket.socket.emit('stats:getLeaderboard', (data) => {
          if (data) setLeaderboard(data);
        });
      }
      // REST API 回退
      const resp = await fetch('/api/stats');
      if (resp.ok) {
        const data = await resp.json();
        if (data.myStats) setMyStats(data.myStats);
        if (data.leaderboard) setLeaderboard(data.leaderboard);
      }
    } catch (e) {
      // 静默处理
    }
    setLoading(false);
  }, [socket]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const user = auth?.user;
  const stats = myStats || user?.stats || { gamesPlayed: 0, wins: 0, losses: 0, winRate: 0 };

  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0;

  return (
    <div className="static-page">
      {/* 导航 */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <a className="nav-brand" onClick={onBack}>
            <span className="brand-icon">🐺</span>
            <span className="brand-text">狼人杀</span>
          </a>
          <div className="nav-links">
            <button className="btn btn-text" onClick={onBack}>← 返回</button>
          </div>
        </div>
      </nav>

      <div className="static-content">
        <h1 className="static-title">🏆 战绩统计</h1>

        {/* Tab 切换 */}
        <div className="stats-tabs">
          <button className={`stats-tab ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>
            📊 我的战绩
          </button>
          <button className={`stats-tab ${tab === 'leaderboard' ? 'active' : ''}`} onClick={() => setTab('leaderboard')}>
            🏅 排行榜
          </button>
        </div>

        {loading ? (
          <div className="stats-loading">加载中...</div>
        ) : tab === 'my' ? (
          <div className="stats-my">
            {/* 概览卡片 */}
            <div className="stats-overview">
              <div className="stats-hero-card">
                <div className="stats-winrate-ring">
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke={winRate >= 50 ? '#c9a96e' : '#c41e3a'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${winRate * 3.27} 327`}
                      transform="rotate(-90 60 60)"
                      style={{ transition: 'stroke-dasharray 1s ease' }}
                    />
                    <text x="60" y="56" textAnchor="middle" fill="#e8e8e8" fontSize="24" fontWeight="700">
                      {winRate}%
                    </text>
                    <text x="60" y="74" textAnchor="middle" fill="#8a9bb5" fontSize="11">胜率</text>
                  </svg>
                </div>
                <div className="stats-numbers">
                  <div className="stats-num-item">
                    <span className="stats-num-val">{stats.gamesPlayed || 0}</span>
                    <span className="stats-num-label">总场次</span>
                  </div>
                  <div className="stats-num-item wins">
                    <span className="stats-num-val">{stats.wins || 0}</span>
                    <span className="stats-num-label">胜利</span>
                  </div>
                  <div className="stats-num-item losses">
                    <span className="stats-num-val">{stats.losses || 0}</span>
                    <span className="stats-num-label">失败</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 角色统计 */}
            {stats.roleStats && Object.keys(stats.roleStats).length > 0 && (
              <div className="stats-section">
                <h3>🎭 角色表现</h3>
                <div className="stats-role-list">
                  {Object.entries(stats.roleStats).map(([role, s]) => {
                    const rWinRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
                    return (
                      <div key={role} className="stats-role-item">
                        <span className="stats-role-name">{role}</span>
                        <div className="stats-role-bar-wrap">
                          <div className="stats-role-bar" style={{ width: `${rWinRate}%` }} />
                        </div>
                        <span className="stats-role-rate">{rWinRate}%</span>
                        <span className="stats-role-games">{s.games}场</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 最近对局 */}
            {stats.recentGames && stats.recentGames.length > 0 && (
              <div className="stats-section">
                <h3>📜 最近对局</h3>
                <div className="stats-recent-list">
                  {stats.recentGames.slice(0, 10).map((g, i) => (
                    <div key={i} className={`stats-recent-item ${g.won ? 'won' : 'lost'}`}>
                      <span className="recent-result">{g.won ? '✅' : '❌'}</span>
                      <span className="recent-role">{g.role}</span>
                      <span className="recent-date">{g.date || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 排行榜 */
          <div className="stats-leaderboard">
            {leaderboard.length === 0 ? (
              <p className="stats-empty">暂无排名数据，快去游戏吧！</p>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.map((entry, i) => (
                  <div key={i} className={`leaderboard-item rank-${i + 1}`}>
                    <span className="leaderboard-rank">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <span className="leaderboard-name">{entry.username}</span>
                    <span className="leaderboard-elo">{entry.elo || entry.rating || '-'}</span>
                    <span className="leaderboard-winrate">
                      {entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
