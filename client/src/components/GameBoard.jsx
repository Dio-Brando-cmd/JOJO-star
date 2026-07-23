// ============================================================
// 游戏主界面 —— 玩家列表 + 阶段面板 + 语音 + 聊天 + 音效
// ============================================================

import React, { useEffect, useState } from 'react';
import PlayerList from './PlayerList';
import NightPhase from './NightPhase';
import DayPhase from './DayPhase';
import VotePanel from './VotePanel';
import DiscussionPhase from './DiscussionPhase';
import ChatBox from './ChatBox';
import CharacterSelect from './CharacterSelect';
import RoleCard from './RoleCard';
import RoleIntroModal from './RoleIntroModal';
import { VoiceChatContainer } from './VoiceChat';
import AudioControls from './AudioControls';
import { PHASES } from '../utils/constants';

export default function GameBoard({ socket, playerName, audio, voiceChat, bgm, onOpenSettings }) {
  const { gameState, privateState } = socket;
  const { playSFX, playMusic } = audio;
  const [showRules, setShowRules] = useState(false);
  const [lastWords, setLastWords] = useState('');
  const [lastWordsSent, setLastWordsSent] = useState(false);

  // 根据游戏阶段切换背景音乐
  useEffect(() => {
    if (!gameState) return;
    switch (gameState.phase) {
      case 'CHARACTER_SELECT':
      case 'PROLOGUE':
        playMusic('lobby');
        break;
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
      {/* v2.0: 选人阶段全屏覆盖 */}
      {gameState.phase === 'CHARACTER_SELECT' && (
        <CharacterSelect
          gameState={gameState}
          socket={socket}
          onSelected={() => {}}
        />
      )}

      {/* v2.0: 序幕阶段 */}
      {gameState.phase === 'PROLOGUE' && (
        <PrologueScreen prologue={gameState.prologue} />
      )}

      {/* 正常游戏UI（选人/序幕阶段隐藏） */}
      {gameState.phase !== 'CHARACTER_SELECT' && gameState.phase !== 'PROLOGUE' && (
      <>
      <header className="game-header">
        <div className="header-left">
          <span className="room-badge">房间: {gameState.id}</span>
          <span className="round-badge">第 {gameState.round} 回合</span>
        </div>
        <div className="header-center">
          <PhaseIndicator phase={gameState.phase} nightStep={gameState.nightStep} />
        </div>
        <div className="header-right">
          <AudioControls audio={audio} bgm={bgm} />
          <span className="player-badge">{playerName}</span>
          <span className={`status-badge ${isAlive ? 'alive' : 'dead'}`}>
            {isAlive ? '存活' : '已出局'}
          </span>
          <button className="btn btn-small btn-ghost" onClick={() => setShowRules(true)} title="规则说明">
            📜
          </button>
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
            seerCheckResults={privateState?.seerCheckResults}
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
          {gameState.phase === PHASES.DISCUSSION && (
            <DiscussionPhase socket={socket} playerName={playerName} voiceChat={voiceChat} />
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

      {/* 遗言输入（死亡玩家可见） */}
      {!isAlive && !lastWordsSent && gameState.phase !== 'GAME_OVER' && (
        <div className="last-words-bar">
          <span className="last-words-label">💀 遗言:</span>
          <input
            type="text"
            value={lastWords}
            onChange={e => setLastWords(e.target.value)}
            placeholder="留下你的最后遗言..."
            maxLength={100}
            className="last-words-input"
            onKeyDown={e => {
              if (e.key === 'Enter' && lastWords.trim()) {
                socket.socket?.emit('player:lastWords', { message: lastWords.trim() });
                setLastWordsSent(true);
              }
            }}
          />
          <button
            className="btn btn-small btn-ghost"
            disabled={!lastWords.trim()}
            onClick={() => {
              socket.socket?.emit('player:lastWords', { message: lastWords.trim() });
              setLastWordsSent(true);
            }}
          >
            发送
          </button>
        </div>
      )}

      <RoleIntroModal show={showRules} onClose={() => setShowRules(false)} />
      </>
      )}
    </div>
  );
}

// ==================== 阶段指示器 ====================

// ==================== 序幕屏幕 ====================

function PrologueScreen({ prologue }) {
  if (!prologue) {
    return (
      <div className="prologue-screen">
        <div className="prologue-content">
          <h1>🌑 帷幕之地</h1>
          <p className="prologue-subtitle">诸神已死。帷幕之外，混沌在呼吸。</p>
          <p>正在准备你的故事...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="prologue-screen">
      <div className="prologue-content">
        <h1>🌑 {prologue.title || '帷幕之地'}</h1>
        <p className="prologue-subtitle">{prologue.subtitle || ''}</p>
        <div className="prologue-excerpt">
          <p>{prologue.excerpt || ''}</p>
        </div>

        {prologue.playerNarratives?.map((pn, i) => (
          pn.story && (
            <div key={i} className="prologue-player-card">
              <div className="prologue-char-name">
                {pn.characterId || '未知'} — {pn.story.characterTitle || ''}
              </div>
              <p className="prologue-char-intro"
                 dangerouslySetInnerHTML={{ __html: pn.story.intro || '' }} />
              {pn.story.quote && (
                <p className="prologue-char-quote">"{pn.story.quote}"</p>
              )}
            </div>
          )
        ))}

        <div className="prologue-waiting">
          <p>⚡ 即将进入游戏...</p>
          <div className="prologue-progress-bar" />
        </div>
      </div>
    </div>
  );
}

// ==================== 阶段指示器 ====================

function PhaseIndicator({ phase, nightStep }) {
  const phaseNames = {
    LOBBY: '等待中',
    CHARACTER_SELECT: '🧬 选择身份',
    PROLOGUE: '📖 序幕',
    NIGHT: '🌙 夜晚',
    DAY: '☀️ 白天',
    DISCUSSION: '🗣️ 发言',
    VOTE: '🗳️ 投票',
    GAME_OVER: '游戏结束',
  };

  const stepNames = {
    FLAME_TRACKER: '追猎行动',
    NETHER_MONK: '冥僧入定',
    VEIL_GUARDIAN: '帷幕庇护',
    CORRUPTED: '蚀者噬灵',
    VEIL_SCHOLAR: '学者察灵',
    HERBAL_SAGE: '草药炼剂',
    SPIRIT_MENDER: '愈灵修复',
    VILLAGER: '灵织守夜',
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
      return <span>🐺 蚀者噬灵了某个目标</span>;
    case 'mass_seal':
      return <span>☠️ 某间屋子被蚀灭符阵覆盖</span>;
    case 'hunter_shoot':
      return <span>🔫 猎人扣动了扳机</span>;
    case 'talisman_save':
      return <span>💚 有人被愈灵符救回</span>;
    case 'heal_save':
      return <span>💚 灵焰修复救回了一人</span>;
    case 'seal_transferred':
      return <span>🧪 蚀痕净化转移到了别人身上</span>;
    case 'hunter_defend':
      return <span>💥 猎人的短火铳击杀了攻击者</span>;
    case 'became_wolf':
      return <span>🐺 有人蚀变为蚀者</span>;
    case 'house_visit':
      return <span>🏠 你去了 <strong>{getName(entry.target)}</strong> 的家 — {entry.desc || (entry.count === -1 ? '很多人' : `${entry.count}人`)}</span>;
    default:
      return <span>{entry.msg || entry.type}</span>;
  }
}
