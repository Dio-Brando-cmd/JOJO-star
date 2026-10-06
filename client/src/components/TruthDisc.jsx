// ============================================================
// 真相盘 · 自生成叙事任务系统 —— Web 客户端
//
// 真相盘（真神池/真伪碎片/契约）× 命运时钟（绝望/帷幕/灵焰）× 契约目标
// 三层系统。所有「秘密」（真神、碎片真伪、阵营、角色）只在服务端与私有
// 状态下发；本组件只负责展示公开状态 + 触发 10 种白名单动作。
//
// 关键：任何动作都通过 socket.truthAction(action) 交给服务端校验，
// 客户端不做任何权威判定 —— 防作弊。
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './truth-disc.css';

// ---- 公开知识（真神池是双方都知道的候选名单，不含本局谜底）----
const GODS = [
  { id: 'harvest', name: '丰收之神', icon: '🌾', rule: '资源效率 +50%，灵焰上限 120' },
  { id: 'war', name: '战争之神', icon: '⚔️', rule: '献祭不涨绝望，死亡绝望 ×2' },
  { id: 'oblivion', name: '遗忘之神', icon: '🌫️', rule: '死亡时全体丢碎片' },
  { id: 'weaver', name: '纺织之神', icon: '🧵', rule: '丝线切割缩圈' },
  { id: 'tide', name: '潮汐之神', icon: '🌊', rule: '区域周期淹没' },
  { id: 'liar', name: '谎言之神', icon: '🎭', rule: '伪碎片 ×2' },
  { id: 'silence', name: '静默之神', icon: '🔇', rule: '净化需 2 人' },
  { id: 'ash', name: '灰烬之神', icon: '💀', rule: '死者身份不公开，净化点隐藏' },
];
const GOD_BY_ID = Object.fromEntries(GODS.map((g) => [g.id, g]));

const TEAM_LABEL = { spirit: '灵焰方', corrupted: '食神者方' };
const TEAM_ICON = { spirit: '🔥', corrupted: '🕳️' };
const PHASE_NAME = { 1: '入幕', 2: '诸神残响', 3: '屠宰场' };
const PHASE_HINT = {
  1: '做任务、攒灵焰、收集碎片，推断本局真神',
  2: '守幕者短铳解锁 —— 追猎开始',
  3: '灵焰可烧穿帷幕 —— 终局将至',
};

// ---- 主组件 ----
export default function TruthDisc({ socket, playerName, onExit }) {
  const state = socket.truthState;                 // 公开状态（大厅 / 对局 / 终局）
  const priv = socket.truthPrivateState;           // 私有状态（角色/碎片/契约）
  const phase = state?.phase;                       // LOBBY | PLAYING | GAME_OVER

  // 断线重连：本地缓存座次 + 一次性凭证，刷新/断线后自动恢复
  useEffect(() => {
    if (!socket.connected || socket.truthState) return;
    const raw = localStorage.getItem('veilland_truth_rejoin');
    if (!raw) return;
    try {
      const { roomCode, seat, token } = JSON.parse(raw);
      if (roomCode && seat && token) {
        socket.truthRejoin(roomCode, seat, token).then((r) => {
          if (!r?.success) localStorage.removeItem('veilland_truth_rejoin');
        });
      }
    } catch (e) { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.connected, socket.truthState]);

  // 游戏中缓存重连凭证
  useEffect(() => {
    if (socket.truthRoomCode && priv?.mySeat && priv?.myRejoinToken && phase === 'PLAYING') {
      localStorage.setItem('veilland_truth_rejoin', JSON.stringify({
        roomCode: socket.truthRoomCode, seat: priv.mySeat, token: priv.myRejoinToken,
      }));
    }
  }, [socket.truthRoomCode, priv, phase]);

  // 终局清缓存
  useEffect(() => {
    if (phase === 'GAME_OVER') localStorage.removeItem('veilland_truth_rejoin');
  }, [phase]);

  const handleExit = useCallback(() => {
    localStorage.removeItem('veilland_truth_rejoin');
    socket.leaveTruthRoom();
    onExit?.();
  }, [socket, onExit]);

  // 未连接提示
  if (!socket.connected) {
    return (
      <div className="td-screen">
        <div className="td-card td-center">
          <div className="td-logo">🌑</div>
          <h2>正在连接服务器…</h2>
          <p className="td-dim">请确认服务器已启动且网络可达</p>
          <button className="btn btn-secondary" onClick={handleExit}>返回</button>
        </div>
      </div>
    );
  }

  if (!state) {
    return <HomePanel socket={socket} playerName={playerName} onExit={handleExit} />;
  }

  if (phase === 'LOBBY') {
    return <LobbyPanel socket={socket} state={state} playerName={playerName} onExit={handleExit} />;
  }

  if (phase === 'GAME_OVER') {
    return <GameOverPanel socket={socket} state={state} ended={socket.truthEnded} onExit={handleExit} />;
  }

  return <GamePanel socket={socket} state={state} priv={priv} onExit={handleExit} />;
}

// ==================== 创建 / 加入 ====================
function HomePanel({ socket, playerName, onExit }) {
  const [tab, setTab] = useState('create');
  const [roomCode, setRoomCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const doCreate = async () => {
    setBusy(true); setErr('');
    const r = await socket.createTruthRoom(playerName || '玩家');
    setBusy(false);
    if (!r?.success) setErr(r?.error || '创建失败');
  };

  const doJoin = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) { setErr('请输入房间码'); return; }
    setBusy(true); setErr('');
    const r = await socket.joinTruthRoom(code, playerName || '玩家');
    setBusy(false);
    if (!r?.success) setErr(r?.error || '加入失败');
  };

  return (
    <div className="td-screen">
      <div className="td-card td-center">
        <div className="td-logo">🧭</div>
        <h1 className="td-title">真相盘</h1>
        <p className="td-sub">自生成叙事 · 每局摇出一个新故事</p>

        <div className="td-tabs">
          <button className={`td-tab ${tab === 'create' ? 'active' : ''}`} onClick={() => { setTab('create'); setErr(''); }}>
            创建房间
          </button>
          <button className={`td-tab ${tab === 'join' ? 'active' : ''}`} onClick={() => { setTab('join'); setErr(''); }}>
            加入房间
          </button>
        </div>

        {tab === 'create' ? (
          <div className="td-col">
            <p className="td-dim">创建一间真相盘对局（4–8 人），房主开局后系统摇出真神与契约。</p>
            <button className="btn btn-primary btn-large" onClick={doCreate} disabled={busy}>
              {busy ? '⏳ …' : '🕯️ 创建真相盘房间'}
            </button>
          </div>
        ) : (
          <div className="td-col">
            <p className="td-dim">输入房主分享的 6 位房间码加入。</p>
            <input
              className="td-input td-code"
              value={roomCode}
              onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setErr(''); }}
              placeholder="例如 3K7Q2M"
              maxLength={6}
              autoFocus
            />
            <button className="btn btn-primary btn-large" onClick={doJoin} disabled={busy || roomCode.trim().length < 4}>
              {busy ? '⏳ …' : '🚪 加入房间'}
            </button>
          </div>
        )}

        {err && <p className="td-error">{err}</p>}

        <div className="td-rules">
          <h4>📜 玩法三问</h4>
          <p><b>猜</b>：本局真神是谁？（做任务 / 收集碎片来推断）</p>
          <p><b>攒</b>：灵焰值满 100，并完成该神的净化条件。</p>
          <p><b>防</b>：食神者在献祭、破坏任务、把绝望推到 100。</p>
        </div>

        <button className="btn btn-text" onClick={onExit}>← 返回</button>
      </div>
    </div>
  );
}

// ==================== 大厅 ====================
function LobbyPanel({ socket, state, playerName, onExit }) {
  const isHost = state.hostId === socket.playerId;
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const players = state.players || [];
  const ready = players.length >= state.minPlayers;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // 剪贴板不可用时的兜底
      window.prompt('复制房间码：', state.id);
    }
  };

  const doStart = async () => {
    setBusy(true); setErr('');
    const r = await socket.startTruthGame();
    setBusy(false);
    if (!r?.success) setErr(r?.error || '开局失败');
  };

  return (
    <div className="td-screen">
      <div className="td-card">
        <div className="td-topbar">
          <h1 className="td-title">🧭 真相盘 · 大厅</h1>
          <button className="btn btn-secondary btn-small" onClick={onExit}>退出</button>
        </div>

        <div className="td-roomcode">
          <span className="td-dim">房间码</span>
          <button className="td-code-big" onClick={copyCode} title="点击复制">
            {state.id} {copied ? '✅ 已复制' : '📋'}
          </button>
        </div>

        <div className="td-players">
          <h3>玩家（{players.length}/{state.maxPlayers}）</h3>
          <div className="td-player-grid">
            {players.map((p, i) => (
              <div key={p.id} className="td-player-chip">
                <span className="td-seat">{i === 0 ? '👑' : '👤'}</span>
                <span className="td-name">{p.name}</span>
                {p.id === socket.playerId && <span className="td-me">（你）</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="td-lobby-actions">
          {isHost ? (
            <button className="btn btn-primary btn-large" onClick={doStart} disabled={busy || !ready}>
              {busy ? '⏳ …' : ready ? `🕯️ 开始（${players.length} 人）` : `等待玩家（≥${state.minPlayers}）`}
            </button>
          ) : (
            <p className="td-dim td-center">⏳ 等待房主开始游戏…</p>
          )}
        </div>

        {err && <p className="td-error">{err}</p>}
        <p className="td-dim td-center">阵营与真神将在开局后由种子秘密决定，终局才揭晓。</p>
      </div>
    </div>
  );
}

// ==================== 对局主界面 ====================
function GamePanel({ socket, state, priv, onExit }) {
  const [pick, setPick] = useState(null);   // 目标选择面板
  const [feedback, setFeedback] = useState([]); // 最近一次动作返回的事件
  const [busy, setBusy] = useState(false);

  const mySeat = priv?.mySeat;
  const me = state.players?.find((p) => p.id === mySeat) || null;
  const myTeam = priv?.myTeam;
  const myRole = priv?.myRole;

  // 私有状态尚未下发（开局瞬间）→ 短暂占位，避免误判「已出局」
  if (!priv) {
    return (
      <div className="td-screen">
        <div className="td-card td-center">
          <div className="td-logo">🕯️</div>
          <h2>正在同步你的身份…</h2>
        </div>
      </div>
    );
  }

  const clocks = state.clocks || { spirit: 0, despair: 0, veil: 0 };
  const rules = state.rules || {};
  const enginePhase = state.enginePhase || 1;
  const unlocks = state.unlocks || {};

  const doAction = useCallback(async (action) => {
    setBusy(true);
    const r = await socket.truthAction(action);
    setBusy(false);
    setFeedback(r?.events?.length ? r.events : (r?.ok === false ? ['（无返回）'] : ['（已执行）']));
    setPick(null);
  }, [socket]);

  // 我可以执行的动作集
  const can = useMemo(() => {
    const isSpirit = myTeam === 'spirit';
    const isKeeper = myRole === '守幕者';
    const isAlive = me?.alive;
    if (!isAlive) return { dead: true };
    return {
      dead: false,
      task: isSpirit,
      sabotage: !isSpirit,
      sacrifice: true,                       // 任何人可献祭（全局 30s 冷却）
      blunderbuss: isKeeper && enginePhase >= 2,
      burnVeil: isSpirit && enginePhase >= 3 && unlocks.spiritCanBurnVeil,
      guess: true,
      burnFalse: true,
      reveal: true,
      purify: isSpirit && clocks.spirit >= (rules.spiritMax || 100),
    };
  }, [myTeam, myRole, me, enginePhase, unlocks, clocks.spirit, rules.spiritMax]);

  const log = state.log || [];
  const zones = state.zones || [];
  const tasks = state.tasks || [];
  const purifyPoint = state.purifyPoint?.zone || null;

  return (
    <div className="td-screen td-game">
      {/* 顶栏 */}
      <div className="td-topbar">
        <div className="td-id">
          <span className={`td-phase-badge p${enginePhase}`}>阶段{enginePhase} · {PHASE_NAME[enginePhase]}</span>
          <span className="td-hint">{PHASE_HINT[enginePhase]}</span>
        </div>
        <div className="td-myid">
          <span className="td-team">{TEAM_ICON[myTeam]} {TEAM_LABEL[myTeam]}</span>
          <span className="td-role">{myRole}</span>
          <span className="td-dim">· {mySeat}</span>
        </div>
        <button className="btn btn-secondary btn-small" onClick={onExit}>退出</button>
      </div>

      {/* 命运时钟 */}
      <ClockBar clocks={clocks} rules={rules} enginePhase={enginePhase} />

      <div className="td-columns">
        {/* 左：地图 + 任务 */}
        <div className="td-col-map">
          <h3>🗺️ 帷幕之域</h3>
          <div className="td-zones">
            {zones.map((z) => {
              const cls = [
                'td-zone',
                z.consumed ? 'consumed' : '',
                z.name === me?.zone ? 'here' : '',
                z.name === purifyPoint ? 'purify' : '',
              ].join(' ');
              return (
                <div key={z.name} className={cls}>
                  <span>{z.consumed ? '🕳️' : z.name}</span>
                  {z.name === me?.zone && <em>你</em>}
                  {z.name === purifyPoint && <em className="pp">净化点</em>}
                </div>
              );
            })}
          </div>
          {!purifyPoint && <p className="td-dim">⚠️ 净化点位置未知（需靠碎片线索推断）</p>}

          <h3>🛠️ 灵焰任务</h3>
          <div className="td-tasks">
            {tasks.map((t) => (
              <div
                key={t.id}
                className={`td-task ${t.completed ? 'done' : ''} ${t.sabotaged ? 'broken' : ''}`}
              >
                <span className="td-task-name">{t.name}</span>
                <span className="td-task-state">
                  {t.completed ? '✅' : t.sabotaged ? '💥' : '▢'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 中：玩家 */}
        <div className="td-col-players">
          <h3>👥 在场者</h3>
          <div className="td-people">
            {(state.players || []).map((p) => (
              <div key={p.id} className={`td-person ${p.alive ? '' : 'dead'} ${p.id === mySeat ? 'me' : ''}`}>
                <span className="td-p-status">{p.alive ? '🕯️' : '💀'}</span>
                <span className="td-p-name">{p.name}</span>
                <span className="td-p-zone">{p.alive ? (p.zone || '游荡') : '已逝'}</span>
                {p.id === mySeat && <span className="td-me-tag">你</span>}
              </div>
            ))}
          </div>
          {priv?.fellowCorrupted?.length > 0 && (
            <div className="td-allies">
              <h4>🤝 同阵营</h4>
              {priv.fellowCorrupted.map((f) => (
                <span key={f.seat} className="td-ally-chip">{f.name}</span>
              ))}
            </div>
          )}
        </div>

        {/* 右：我的碎片 + 契约 */}
        <div className="td-col-me">
          <h3>🧩 我的记忆碎片（{priv?.myShards?.length || 0}）</h3>
          <div className="td-shards">
            {(priv?.myShards || []).map((s) => (
              <div key={s.id} className="td-shard">
                <p className="td-shard-text">“{s.text}”</p>
                <span className="td-shard-hint">→ 指向 {s.hintGod?.icon} {s.hintGod?.name}</span>
              </div>
            ))}
            {(priv?.myShards || []).length === 0 && <p className="td-dim">暂无碎片</p>}
          </div>

          <h3>📜 我的契约</h3>
          {priv?.myContract ? (
            <div className="td-contract">
              <span className="td-contract-icon">{priv.myContract.icon}</span>
              <div>
                <b>{priv.myContract.name}</b>
                <p className="td-dim">{priv.myContract.desc}（+{priv.myContract.points}）</p>
              </div>
            </div>
          ) : <p className="td-dim">无契约</p>}

          {priv?.guardTarget && (
            <p className="td-dim">🛡️ 守护目标：{priv.guardTarget.name}</p>
          )}
          {priv?.reincarnationOf && (
            <p className="td-dim">🌀 转世真名线索：{priv.reincarnationOf.name}</p>
          )}
        </div>
      </div>

      {/* 动作栏 */}
      <ActionBar can={can} onPick={setPick} busy={busy} purifyReady={can.purify} />

      {/* 事件日志 */}
      <div className="td-log">
        <h3>📖 事件流水</h3>
        <div className="td-log-scroll">
          {log.slice(-40).map((l, i) => <p key={i} className="td-log-line">{l}</p>)}
          {log.length === 0 && <p className="td-dim">对局尚未产生事件</p>}
        </div>
      </div>

      {/* 反馈浮层 */}
      {feedback.length > 0 && (
        <div className="td-feedback">
          {feedback.map((f, i) => <p key={i}>{f}</p>)}
          <button className="btn btn-text btn-small" onClick={() => setFeedback([])}>知道了</button>
        </div>
      )}

      {/* 目标选择面板 */}
      {pick && (
        <Picker
          pick={pick}
          state={state}
          mySeat={mySeat}
          onCancel={() => setPick(null)}
          onSelect={(action) => doAction(action)}
        />
      )}
    </div>
  );
}

// ---- 命运时钟 ----
function ClockBar({ clocks, rules, enginePhase }) {
  const spiritMax = rules.spiritMax || 100;
  const despairMax = rules.despairMax || 100;
  const veilMax = rules.veilConsumeMax || 5;
  const p2 = rules.phase2Despair || 50;
  const p3 = rules.phase3Despair || 75;

  return (
    <div className="td-clocks">
      <Clock label="🔥 灵焰值" value={clocks.spirit} max={spiritMax} tone="spirit" />
      <Clock label="🕳️ 绝望度" value={clocks.despair} max={despairMax} tone="despair"
        marks={[{ at: p2, label: '阶段2' }, { at: p3, label: '阶段3' }]} />
      <Clock label="🌫️ 帷幕吞噬" value={clocks.veil} max={veilMax} tone="veil" />
    </div>
  );
}

function Clock({ label, value, max, tone, marks = [] }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className={`td-clock ${tone}`}>
      <div className="td-clock-label">{label} <b>{value}</b><span className="td-dim">/{max}</span></div>
      <div className="td-clock-track">
        <div className="td-clock-fill" style={{ width: `${pct}%` }} />
        {marks.map((m) => (
          <span key={m.label} className="td-clock-mark" style={{ left: `${m.at}%` }} title={m.label} />
        ))}
      </div>
    </div>
  );
}

// ---- 动作栏 ----
function ActionBar({ can, onPick, busy, purifyReady }) {
  if (can.dead) {
    return <div className="td-actions td-center"><p className="td-dim">💀 你已出局，静候终局</p></div>;
  }

  const btns = [];
  if (can.task) btns.push({ key: 'task', label: '🛠️ 完成任务', type: 'task', tone: 'spirit' });
  if (can.sabotage) btns.push({ key: 'sabotage', label: '💥 破坏任务', type: 'sabotage', tone: 'corrupt' });
  btns.push({ key: 'move', label: '🚶 移动', type: 'move', tone: '' });
  btns.push({ key: 'sacrifice', label: '🗡️ 献祭', type: 'sacrifice', tone: 'corrupt' });
  if (can.blunderbuss) btns.push({ key: 'blunderbuss', label: '🔫 短铳', type: 'blunderbuss', tone: 'corrupt' });
  btns.push({ key: 'guess', label: '👁️ 猜真神', type: 'guess', tone: '' });
  if (can.burnVeil) btns.push({ key: 'burnVeil', label: '🔥 烧帷幕', type: 'burnVeil', tone: 'spirit' });
  if (can.burnFalse) btns.push({ key: 'burnFalse', label: '📛 焚伪碎片', type: 'burnFalse', tone: '' });
  if (can.reveal) btns.push({ key: 'reveal', label: '🌀 揭露真名', type: 'reveal', tone: '' });
  if (can.purify) btns.push({ key: 'purify', label: '✨ 净化仪式', type: 'purify', tone: 'spirit', big: true });

  return (
    <div className="td-actions">
      {btns.map((b) => (
        <button
          key={b.key}
          className={`btn td-action ${b.tone ? `td-${b.tone}` : ''} ${b.big ? 'td-big' : ''}`}
          disabled={busy}
          onClick={() => onPick({ type: b.type, label: b.label })}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

// ---- 目标选择面板 ----
function Picker({ pick, state, mySeat, onCancel, onSelect }) {
  const opts = useMemo(() => {
    switch (pick.type) {
      case 'task':
        return (state.tasks || [])
          .filter((t) => !t.completed && !t.sabotaged)
          .map((t) => ({ value: t.id, label: `🛠️ ${t.name}` }));
      case 'sabotage':
        return (state.tasks || [])
          .filter((t) => !t.completed && !t.sabotaged)
          .map((t) => ({ value: t.id, label: `💥 ${t.name}` }));
      case 'move':
        return (state.zones || [])
          .filter((z) => !z.consumed)
          .map((z) => ({ value: z.name, label: `🚶 ${z.name}` }));
      case 'sacrifice':
        return (state.players || [])
          .filter((p) => p.alive && p.id !== mySeat)
          .map((p) => ({ value: p.id, label: `🗡️ 献祭 ${p.name}` }));
      case 'blunderbuss':
        return (state.players || [])
          .filter((p) => p.alive && p.id !== mySeat)
          .map((p) => ({ value: p.id, label: `🔫 击毙 ${p.name}` }));
      case 'guess':
        return GODS.map((g) => ({ value: g.id, label: `${g.icon} ${g.name}（${g.rule}）` }));
      default:
        return [];
    }
  }, [pick, state, mySeat]);

  const buildAction = (value) => {
    switch (pick.type) {
      case 'task': return { type: 'task', taskId: value };
      case 'sabotage': return { type: 'taskFail', taskId: value };
      case 'move': return { type: 'move', zone: value };
      case 'sacrifice': return { type: 'sacrifice', victimId: value };
      case 'blunderbuss': return { type: 'blunderbuss', targetId: value };
      case 'guess': return { type: 'guess', godId: value };
      default: return { type: pick.type };
    }
  };

  return (
    <div className="td-modal">
      <div className="td-modal-card">
        <h3>{pick.label}</h3>
        <div className="td-modal-opts">
          {opts.length === 0 && <p className="td-dim">没有可选目标</p>}
          {opts.map((o) => (
            <button key={o.value} className="btn td-opt" onClick={() => onSelect(buildAction(o.value))}>
              {o.label}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-small" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

// ==================== 终局 ====================
function GameOverPanel({ socket, state, ended, onExit }) {
  const god = state?.god || ended?.god || null;
  const winner = state?.winner || ended?.winner;
  const reason = state?.reason || ended?.reason;
  const scores = state?.scores || ended?.scores || [];
  const mySeat = socket.truthPrivateState?.mySeat;
  const myTeam = socket.truthPrivateState?.myTeam;

  const spiritWon = winner === 'spirit';
  const iWon = myTeam === winner;

  return (
    <div className="td-screen">
      <div className="td-card">
        <div className={`td-result ${iWon ? 'win' : 'lose'}`}>
          <div className="td-result-icon">{iWon ? '🏆' : '☠️'}</div>
          <h1>{iWon ? '你所属阵营胜利' : '你所属阵营落败'}</h1>
          <p className="td-sub">{spiritWon ? '🔥 灵焰方净化成功' : '🕳️ 食神者方吞噬完成'}</p>
          <p className="td-dim">{reason}</p>
        </div>

        {god && (
          <div className="td-god-reveal">
            <h3>🎭 本局真神揭晓</h3>
            <div className="td-god-big">
              <span className="td-god-icon">{god.icon}</span>
              <div>
                <b>{god.name}</b>
                <p className="td-dim">{GOD_BY_ID[god.id]?.rule || ''}</p>
              </div>
            </div>
            {ended?.seed && <p className="td-seed">种子（供回放/裁判）：<code>{ended.seed}</code></p>}
          </div>
        )}

        <div className="td-reveal">
          <h3>🧾 身份揭晓</h3>
          <table className="td-table">
            <thead>
              <tr><th>玩家</th><th>阵营</th><th>角色</th><th>状态</th></tr>
            </thead>
            <tbody>
              {(state.players || []).map((p) => (
                <tr key={p.id} className={p.alive ? '' : 'dead'}>
                  <td>{p.name}{p.id === mySeat ? '（你）' : ''}</td>
                  <td>{TEAM_ICON[p.team]} {TEAM_LABEL[p.team] || '—'}</td>
                  <td>{p.role || '—'}</td>
                  <td>{p.alive ? '存活' : '已逝'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {scores.length > 0 && (
          <div className="td-scores">
            <h3>🏅 契约积分（个人排名）</h3>
            <table className="td-table">
              <thead>
                <tr><th>#</th><th>玩家</th><th>契约</th><th>得分</th></tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={s.playerId} className={s.playerId === mySeat ? 'me' : ''}>
                    <td>{i + 1}</td>
                    <td>{s.name}</td>
                    <td>{s.contract}</td>
                    <td><b>{s.points}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="td-center" style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-large" onClick={onExit}>返回主界面</button>
        </div>
      </div>
    </div>
  );
}
