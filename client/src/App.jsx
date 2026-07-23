// ============================================================
// 主应用组件
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { useAudio } from './hooks/useAudio';
import { useBGM } from './hooks/useBGM';
import { useAuth } from './hooks/useAuth';
import { useVoiceChat } from './hooks/useVoiceChat';
import LandingPage from './components/LandingPage';
import ContactPage from './components/ContactPage';
import DownloadPage from './components/DownloadPage';
import StatsPanel from './components/StatsPanel';
import ParticleBackground from './components/effects/ParticleBackground';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';
import SettingsPanel from './components/SettingsPanel';
import UpdatePrompt from './components/UpdatePrompt';

// 当前客户端版本号（与服务端比较判断是否需要更新）
const CLIENT_VERSION = '2.13.1';

// 简易版本比较：返回 1 表示 v1 > v2, -1 表示 v1 < v2, 0 表示相等
function compareVersion(v1, v2) {
  const parts1 = (v1 || '0.0.0').split('.').map(Number);
  const parts2 = (v2 || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((parts1[i] || 0) > (parts2[i] || 0)) return 1;
    if ((parts1[i] || 0) < (parts2[i] || 0)) return -1;
  }
  return 0;
}

export default function App() {
  const socket = useSocket();
  const audio = useAudio();
  const bgm = useBGM();
  const auth = useAuth(socket.socket ? { current: socket.socket } : { current: null });
  // 更新 auth hook 的 socket 引用（注意：必须 mutate 已有对象，不能替换！
  // 因为 useAuth 内的 useCallback 闭包捕获了首次渲染时的 socketRef 对象引用）
  useEffect(() => { auth.socketRef.current = socket.socket; }, [socket.socket]);

  // 官网页面路由: 'home' | 'download' | 'contact' | 'play'
  const [page, setPage] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [showName, setShowName] = useState(() => {
    return localStorage.getItem('werewolf_show_name') !== 'false';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  const handleNavigate = useCallback((target) => {
    setPage(target);
  }, []);

  // 粒子背景类型映射
  const getParticleType = useCallback(() => {
    if (page !== 'play') {
      const pageMap = { home: 'fireflies', download: 'embers', contact: 'embers' };
      return pageMap[page] || 'fireflies';
    }
    // 游戏中根据阶段切换
    const phase = socket.gameState?.phase;
    const phaseMap = {
      LOBBY: 'embers', NIGHT: 'night', DAY: 'day',
      VOTE: 'blood', DISCUSSION: 'day', GAME_OVER: 'ashFall',
      CHARACTER_SELECT: 'fireflies', PROLOGUE: 'fireflies',
    };
    // 结算时判断胜负
    if (phase === 'GAME_OVER' && socket.privateState?.myTeam && socket.gameState?.gameResult?.winner) {
      return socket.privateState.myTeam === socket.gameState.gameResult.winner ? 'goldRain' : 'ashFall';
    }
    return phaseMap[phase] || 'embers';
  }, [page, socket.gameState?.phase, socket.privateState?.myTeam, socket.gameState?.gameResult?.winner]);

  // 自动检查版本更新
  useEffect(() => {
    const doCheck = () => {
      if (socket.socket) {
        socket.socket.emit('app:checkVersion', (info) => {
          if (info) {
            setUpdateInfo(info);
            if (compareVersion(info.version, CLIENT_VERSION) > 0) {
              setShowUpdate(true);
            }
          }
        });
      }
    };
    // 连接后自动检查
    if (socket.connected && socket.socket) {
      doCheck();
    }
    // 移动端额外通过 REST API 检查（socket 可能不稳定）
    if (typeof window !== 'undefined') {
      fetch('/api/version').then(r => r.json()).then(info => {
        if (info && compareVersion(info.version, CLIENT_VERSION) > 0) {
          setUpdateInfo(info);
          setShowUpdate(true);
        }
      }).catch(() => {});
    }
  }, [socket.connected]);

  const handleCheckUpdate = useCallback(() => {
    if (socket.socket) {
      socket.socket.emit('app:checkVersion', (info) => {
        if (info) {
          setUpdateInfo(info);
          setShowUpdate(true);
        }
      });
    } else {
      // 离线时用 REST API
      fetch('/api/version').then(r => r.json()).then(info => {
        setUpdateInfo(info);
        setShowUpdate(true);
      }).catch(() => {});
    }
  }, [socket.socket]);

  // 语音聊天（有游戏状态时才初始化）
  const gamePhase = socket.gameState?.phase;
  const voiceChat = useVoiceChat(socket.socket, socket.playerId, socket.gameState);

  // 游戏阶段切换 BGM
  useEffect(() => {
    const phase = socket.gameState?.phase;
    if (!phase) return;

    // BGM 优先（使用真实MP3）
    if (bgm.bgmEnabled) {
      const phaseMap = { LOBBY: 'lobby', NIGHT: 'night', DAY: 'day', VOTE: 'vote', GAME_OVER: 'gameOver' };
      const mappedPhase = phaseMap[phase] || 'lobby';
      bgm.playForPhase(mappedPhase);
      // 同时停止程序化音乐
      audio.stopMusic();
    } else {
      // 回退到程序化音乐
      bgm.stop();
      switch (phase) {
        case 'LOBBY': audio.playMusic('lobby'); break;
        case 'NIGHT': audio.playMusic('night'); break;
        case 'DAY': case 'VOTE': audio.playMusic('day'); break;
        default: break;
      }
    }

    return () => {
      if (phase === 'GAME_OVER') {
        bgm.stop();
        audio.stopMusic();
      }
    };
  }, [socket.gameState?.phase, bgm.bgmEnabled]);

  // 游戏结束播放对应音乐 + 更新战绩
  useEffect(() => {
    if (socket.gameState?.phase === 'GAME_OVER') {
      const myTeam = socket.privateState?.myTeam;
      const winner = socket.gameState.gameResult?.winner;
      const won = myTeam === winner;
      if (won) {
        audio.playMusic('game_over_win');
      } else {
        audio.playMusic('game_over_lose');
      }
      voiceChat.leaveVoice();
      // 更新用户战绩
      if (auth.user) {
        auth.updateStats(won);
      }
    }
  }, [socket.gameState?.phase]);

  const handleToggleShowName = useCallback(() => {
    const next = !showName;
    setShowName(next);
    localStorage.setItem('werewolf_show_name', String(next));
  }, [showName]);

  // ==================== 官网页面路由 ====================

  if (page === 'download') {
    return (
      <>
        <ParticleBackground type="embers" density={0.6} />
        <DownloadPage onNavigate={handleNavigate} />
      </>
    );
  }

  if (page === 'contact') {
    return (
      <>
        <ParticleBackground type="embers" density={0.5} />
        <ContactPage onNavigate={handleNavigate} />
      </>
    );
  }

  if (page === 'stats') {
    return (
      <>
        <ParticleBackground type="embers" density={0.5} />
        <StatsPanel socket={socket} auth={auth} onBack={() => setPage('home')} />
      </>
    );
  }

  if (page === 'home') {
    return (
      <>
        <ParticleBackground type="fireflies" density={0.8} />
        <LandingPage onNavigate={handleNavigate} />
      </>
    );
  }

  // ==================== 游戏流程（page === 'play'） ====================

  // 未登录 → 登录/注册界面
  if (!auth.user && !playerName) {
    return (
      <>
        <ParticleBackground type={getParticleType()} density={0.6} />
        <LoginScreen
        auth={auth}
        socketConnected={socket.connected}
        onQuickPlay={(name) => {
          setPlayerName(name);
          auth.setUser({ username: name, stats: { gamesPlayed: 0, wins: 0, losses: 0, winRate: 0 } });
        }}
        onCheckUpdate={handleCheckUpdate}
        updateInfo={updateInfo}
        onNavigate={handleNavigate}
      />
      </>
    );
  }

  // 已登录/已设置名字 → 进入大厅
  const displayName = auth.user?.username || playerName;

  // 未加入房间 或 在房间大厅等待中 → 大厅界面
  if (!socket.gameState || socket.gameState.phase === 'LOBBY') {
    return (
      <>
        <ParticleBackground type={getParticleType()} density={0.6} />
        <Lobby
          socket={socket}
          playerName={displayName}
          bgm={bgm}
          onJoined={() => {
            setJoined(true);
            audio.playSFX('button_click');
          }}
          onChangeName={() => {
            setPlayerName('');
            auth.logout();
            socket.leaveRoom();
          }}
          onCheckUpdate={handleCheckUpdate}
        />
        <UpdatePrompt
          show={showUpdate}
          onClose={() => setShowUpdate(false)}
          updateInfo={updateInfo}
        />
      </>
    );
  }

  // 游戏结束 → 结算界面
  if (socket.gameState?.phase === 'GAME_OVER') {
    return (
      <>
        <ParticleBackground type={getParticleType()} density={0.7} />
        <GameOver
        gameState={socket.gameState}
        privateState={socket.privateState}
        playerName={displayName}
        onBackToLobby={() => {
          socket.backToLobby();
          setJoined(false);
          audio.playSFX('button_click');
          audio.playMusic('lobby');
        }}
      />
      </>
    );
  }

  // 游戏中 → 游戏主界面
  return (
    <>
      <ParticleBackground type={getParticleType()} density={0.7} />
      <GameBoard
        socket={socket}
        playerName={showName ? displayName : '***'}
        audio={audio}
        voiceChat={voiceChat}
        bgm={bgm}
        onOpenSettings={() => setShowSettings(true)}
        auth={auth}
      />
      <SettingsPanel
        show={showSettings}
        onClose={() => setShowSettings(false)}
        playerName={displayName}
        showName={showName}
        onToggleShowName={handleToggleShowName}
        isHost={socket.gameState?.hostId === socket.playerId}
        isPrivate={socket.gameState?.isPrivate}
        hasPassword={false}
        onTogglePrivacy={socket.toggleRoomPrivacy}
        onSetPassword={socket.setRoomPassword}
        maxPlayers={socket.gameState?.maxPlayers || 12}
        onUpdateMaxPlayers={socket.updateMaxPlayers}
        playerCount={socket.gameState?.players?.length || 0}
        onLeaveRoom={null}
        onExitGame={() => {
          socket.backToLobby();
          setJoined(false);
          audio.playSFX('button_click');
        }}
        isInGame={true}
        bgm={bgm}
        audio={audio}
        user={auth.user}
        onCheckUpdate={handleCheckUpdate}
        enableBots={socket.gameState?.enableBots}
        botCount={socket.gameState?.botCount || 0}
        onSetBotCount={async (count) => {
          await socket.setBotCount(count);
        }}
      />
      <UpdatePrompt
        show={showUpdate}
        onClose={() => setShowUpdate(false)}
        updateInfo={updateInfo}
      />
    </>
  );
}

// ==================== 登录/注册界面 ====================

function LoginScreen({ auth, socketConnected, onQuickPlay, onCheckUpdate, updateInfo, onNavigate }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'quick'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [serverUrl, setServerUrl] = useState(() => {
    return localStorage.getItem('werewolf_server_url') || '';
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) { setLocalError('请输入用户名'); return; }
    if (!password) { setLocalError('请输入密码'); return; }
    setLocalError('');
    // auth hook 会自动等待 socket 连接，无需手动检查
    const result = await auth.login(username.trim(), password);
    if (result.error) setLocalError(result.error);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username.trim()) { setLocalError('请输入用户名'); return; }
    if (username.trim().length < 2) { setLocalError('用户名至少2个字符'); return; }
    if (!password || password.length < 4) { setLocalError('密码至少4个字符'); return; }
    setLocalError('');
    // auth hook 会自动等待 socket 连接
    const result = await auth.register(username.trim(), password);
    if (result.error) setLocalError(result.error);
  };

  const handleQuickPlay = async (e) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) { setLocalError('请输入昵称'); return; }
    if (name.length > 10) { setLocalError('昵称最长10个字符'); return; }
    setLocalError('');
    if (serverUrl.trim()) localStorage.setItem('werewolf_server_url', serverUrl.trim());
    // 等待连接后再进入
    const ok = await auth.quickPlay(name);
    if (ok) onQuickPlay(name);
  };

  return (
    <div className="screen login-screen">
      <div className="login-card">
        <div className="game-logo">
          <span className="logo-icon">🐺</span>
          <h1>帷幕之地</h1>
          <p className="subtitle">在线联机版</p>
        </div>

        {/* 标签切换 */}
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setLocalError(''); }}>
            登录
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setLocalError(''); }}>
            注册
          </button>
          <button className={`auth-tab ${tab === 'quick' ? 'active' : ''}`} onClick={() => { setTab('quick'); setLocalError(''); }}>
            快速游戏
          </button>
        </div>

        {tab === 'quick' ? (
          <form onSubmit={handleQuickPlay} className="login-form">
            <label>输入你的昵称（无需注册）</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setLocalError(''); }}
              placeholder="游戏昵称..."
              maxLength={10}
              autoFocus
            />
            <label>服务器地址（留空自动检测）</label>
            <input
              type="text"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder="例: http://123.456.789.0:4000"
            />
            {localError && <p className="error-text">{localError}</p>}
            <button type="submit" className="btn btn-primary btn-large" disabled={auth.authLoading}>
              {auth.authLoading ? '⏳ 连接中...' : '进入游戏'}
            </button>
          </form>
        ) : (
          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="login-form">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setLocalError(''); }}
              placeholder="2-12个字符"
              maxLength={12}
              autoFocus
            />
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setLocalError(''); }}
              placeholder={tab === 'register' ? '至少4个字符' : '输入密码'}
              maxLength={30}
            />
            {localError && <p className="error-text">{localError}</p>}
            {auth.authError && <p className="error-text">{auth.authError}</p>}
            <button type="submit" className="btn btn-primary btn-large" disabled={auth.authLoading}>
              {auth.authLoading ? '⏳ 连接中...' : tab === 'login' ? '登录' : '注册'}
            </button>
          </form>
        )}

        {/* 连接状态和版本 */}
        <div className="login-update">
          {!socketConnected ? (
            <div className="connection-warning">
              <div className="connecting-spinner" />
              <div>
                <strong>正在连接服务器...</strong>
                <p style={{margin:0, fontSize:'0.8em'}}>请确认服务器已启动且网络可达</p>
              </div>
            </div>
          ) : (
            <div className="connection-ok">
              ✅ 已连接到服务器
              {updateInfo && <span> (v{updateInfo.version})</span>}
            </div>
          )}
          {updateInfo && (
            <button className="btn btn-small btn-secondary" onClick={onCheckUpdate} style={{width:'100%', marginTop:8}}>
              🔄 检查更新
            </button>
          )}
        </div>

        <p className="login-footer">
          注册账号可记录战绩 | 快速游戏无需注册
        </p>
        <button className="btn btn-text btn-back-home" onClick={() => onNavigate && onNavigate('home')}>
          ← 返回首页
        </button>
      </div>
    </div>
  );
}
