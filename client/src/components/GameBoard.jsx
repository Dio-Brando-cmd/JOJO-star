// ============================================================
// 游戏主界面 —— 玩家列表 + 阶段面板 + 语音 + 聊天 + 音效
// ============================================================

import React, { useEffect } from 'react';
import PlayerList from './PlayerList';
import NightPhase from './NightPhase';
import DayPhase from './DayPhase';
import VotePanel from './VotePanel';
import ChatBox from './ChatBox';
import RoleCard from './RoleCard';
import { VoiceChatContainer } from './VoiceChat';
import AudioControls from './AudioControls';
import { PHASES } from '../utils/constants';

export default function GameBoard({ socket, playerName, audio, voiceChat, onOpenSettings }) {
  const { gameState, privateState } = socket;
  const { playSFX, playMusic } = audio;

  // 根据游戏阶段切换背景音乐
  useEffect(() => {
    if (!gameState) return;
    switch (gameState.phase) {
      case PHASES.NIGHT:
        playMusic('night');
        break;
      case PHASES.DAY:
      case PHASES.VOTE:
        playMusic('day');
        break;
      default:
        break;
    }
  }, [gameState?.phase, gameState?.round]);

  // 夜晚->白天切换时播放音效
  useEffect(() => {
    if (gameState?.phase === PHASES.DAY && gameState.round > 0) {
      playSFX('day_start');
    }
  }, [gameState?.phase]);

  if (!gameState) {
    return (
      <div className="screen">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  const myPlayer = gameState.players?.find(p => p.id === socket.playerId);
  const isAlive = myPlayer?.alive;

  return (
    <div className="screen game-screen">
      {/* 顶部栏 */}
      <header className="game-header">
        <div className="header-left">
          <span className="room-badge">房间: {gameState.id}</span>
          <span className="round-badge">第 {gameState.round} 回合</span>
        </div>
        <div className="header-center">
          <PhaseIndicator phase={gameState.phase} nightStep={gameState.nightStep} />
        </div>
        <div className="header-right">
          <AudioControls audio={audio} />
          <span className="player-badge">{playerName}</span>
          <span className={`status-badge ${isAlive ? 'alive' : 'dead'}`}>
            {isAlive ? '存活' : '已出局'}
          </span>
          {onOpenSettings && (
            <button className="btn btn-small btn-ghost" onClick={onOpenSettings} title="设置">
              ⚙️
            </button>
          )}
        </div>
      </header>

      {/* 主体内容区 */}
      <div className="game-body">
        {/* 左侧：玩家列表 + 语音 */}
        <aside className="game-sidebar">
          <PlayerList
            players={gameState.players}
            privateState={privateState}
            myId={socket.playerId}
            votes={gameState.votes}
          />
          {voiceChat && (
            <div className="sidebar-voice">
              <VoiceChatContainer
                voiceChat={voiceChat}
                players={gameState.players}
                myId={socket.playerId}
              />
            </div>
          )}
        </aside>

        {/* 中间：游戏主面板 */}
        <main className="game-main">
          {gameState.phase === PHASES.NIGHT && isAlive && (
            <NightPhase socket={socket} audio={audio} />
          )}
          {gameState.phase === PHASES.NIGHT && !isAlive && (
            <NightWaitPanel />
          )}
          {gameState.phase === PHASES.DAY && (
            <DayPhase socket={socket} />
          )}
          {gameState.phase === PHASES.VOTE && isAlive && (
            <VotePanel socket={socket} />
          )}
          {gameState.phase === PHASES.VOTE && !isAlive && (
            <div className="dead-notice">
              <span className="dead-icon">💀</span>
              <p>你已出局，请等待投票结束</p>
            </div>
          )}

          {/* 夜晚日志 */}
          {gameState.nightLog && gameState.nightLog.length > 0 && gameState.phase === PHASES.DAY && (
            <div className="night-log">
              <h4>🏙️ 夜晚事件</h4>
              {gameState.nightLog.map((entry, i) => (
                <div key={i} className="log-entry">
                  {formatLogEntry(entry, gameState.players)}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* 右侧：角色卡 + 聊天 */}
        <aside className="game-rightbar">
          {privateState && <RoleCard privateState={privateState} />}
          <ChatBox socket={socket} playerName={playerName} />
        </aside>
      </div>
    </div>
  );
}

// ==================== 阶段指示器 ====================

function PhaseIndicator({ phase, nightStep }) {
  const phaseNames = {
    LOBBY: '等待中',
    NIGHT: '🌙 夜晚',
    DAY: '☀️ 白天',
    VOTE: '🗳️ 投票',
    GAME_OVER: '游戏结束',
  };

  const stepNames = {
    HUNTER: '猎人行动',
    ALPHA_WOLF: '种狼行动',
    GUARD: '守卫行动',
    WEREWOLF: '狼人行动',
    SEER: '预言家行动',
    POISON_WITCH: '毒巫行动',
    HEAL_WITCH: '药巫行动',
    RESOLUTION: '结算中',
  };

  return (
    <div className="phase-indicator">
      <span className="phase-name">{phaseNames[phase] || phase}</span>
      {phase === 'NIGHT' && nightStep && (
        <span className="night-step-name">→ {stepNames[nightStep] || nightStep}</span>
      )}
    </div>
  );
}

// ==================== 死亡等待面板 ====================

function NightWaitPanel() {
  return (
    <div className="dead-notice">
      <span className="dead-icon">💀</span>
      <p>你已出局，夜晚无法行动</p>
      <p className="dead-hint">请等待天亮...</p>
    </div>
  );
}

// ==================== 日志格式化 ====================

function formatLogEntry(entry, players) {
  const getName = (id) => {
    const p = players?.find(pl => pl.id === id);
    return p ? p.name : id;
  };

  switch (entry.type) {
    case 'death':
      return <span>💀 <strong>{getName(entry.player)}</strong> 死亡（{entry.reason}）</span>;
    case 'wolf_kill':
      return <span>🐺 狼人袭击了某个目标</span>;
    case 'lethal_poison':
      return <span>☠️ 某间屋子被烈性毒药覆盖</span>;
    case 'hunter_shoot':
      return <span>🔫 猎人扣动了扳机</span>;
    case 'potion_save':
      return <span>💚 有人被解药救活</span>;
    case 'heal_save':
      return <span>💚 万能药救活了一人</span>;
    case 'poison_transferred':
      return <span>🧪 毒药转移到了别人身上</span>;
    case 'hunter_defend':
      return <span>💥 猎人的短火铳击杀了攻击者</span>;
    case 'became_wolf':
      return <span>🐺 有人变成了狼人</span>;
    case 'house_visit':
      return <span>🏠 你去了 <strong>{getName(entry.target)}</strong> 的家 — {entry.desc || (entry.count === -1 ? '很多人' : `${entry.count}人`)}</span>;
    default:
      return <span>{entry.msg || entry.type}</span>;
  }
}
