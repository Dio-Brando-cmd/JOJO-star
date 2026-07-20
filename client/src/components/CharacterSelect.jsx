// ============================================================
// CharacterSelect — 表层身份选择界面（v2.0）
// 玩家主动选择自己的表层身份（外表人物）
// 选择后系统根据推荐匹配隐藏职业
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  CHARACTER_IDENTITIES,
  MYTH_ORIGIN_NAMES,
} from '../utils/constants';

// 按神话来源分组
function groupByOrigin(characters) {
  const groups = {};
  for (const [id, char] of Object.entries(characters)) {
    const origin = char.origin || 'FOLK';
    if (!groups[origin]) groups[origin] = [];
    groups[origin].push({ id, ...char });
  }
  return groups;
}

export default function CharacterSelect({ gameState, socket, onSelected }) {
  const available = gameState?.characterSelect?.availableCharacters || [];
  const selections = gameState?.characterSelect?.selections || {};
  const timeLeft = gameState?.characterSelect?.timeLeft || 30;
  const players = gameState?.players || [];

  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [hoveredChar, setHoveredChar] = useState(null);

  // 构建可用角色详情
  const availableChars = available
    .map(id => ({ id, ...CHARACTER_IDENTITIES[id] }))
    .filter(c => c.name);

  const grouped = groupByOrigin(
    Object.fromEntries(availableChars.map(c => [c.id, c]))
  );

  // 某角色是否已被别人选走
  const takenBy = {};
  for (const [pid, cid] of Object.entries(selections)) {
    if (pid !== socket?.id) takenBy[cid] = pid;
  }

  const handleSelect = (charId) => {
    if (confirmed) return;
    if (takenBy[charId]) return;
    setSelected(charId);
  };

  const handleConfirm = () => {
    if (!selected || confirmed) return;
    socket.emit('character:select', { characterId: selected }, (res) => {
      if (res?.success) {
        setConfirmed(true);
        onSelected?.(selected);
      }
    });
  };

  // 我已选的角色
  const mySelection = selections[socket?.id];
  const myChar = mySelection ? { id: mySelection, ...CHARACTER_IDENTITIES[mySelection] } : null;
  const alreadySelected = !!mySelection || confirmed;

  return (
    <div className="character-select-overlay">
      <div className="character-select-container">
        {/* 头部 */}
        <div className="char-select-header">
          <h2>🧬 选择你的表层身份</h2>
          <p className="char-select-subtitle">
            这是你在帷幕之地呈现给众人的面貌。
            <br/>选择之后，系统将基于你的身份分配合适的隐藏职业。
          </p>
          <div className="char-select-timer">
            ⏱️ 剩余时间: <strong>{timeLeft}</strong> 秒
          </div>
        </div>

        {/* 已选状态 */}
        {alreadySelected && myChar && (
          <div className="char-selected-banner">
            ✅ 你已选择: <strong>{myChar.name}</strong> — {myChar.title}
            <span className="char-origin-tag">
              {MYTH_ORIGIN_NAMES[myChar.origin] || myChar.origin}
            </span>
          </div>
        )}

        {/* 角色网格（按神话来源分组） */}
        <div className="char-select-body">
          {Object.entries(grouped).map(([origin, chars]) => (
            <div key={origin} className="char-origin-group">
              <h3 className="origin-label">
                {MYTH_ORIGIN_NAMES[origin] || origin}
              </h3>
              <div className="char-grid">
                {chars.map(char => {
                  const taken = takenBy[char.id];
                  const isSelected = selected === char.id || mySelection === char.id;
                  const isTakenByOther = taken && taken !== socket?.id;

                  return (
                    <div
                      key={char.id}
                      className={`char-card ${isSelected ? 'selected' : ''} ${isTakenByOther ? 'taken' : ''} ${alreadySelected ? 'locked' : ''}`}
                      onClick={() => handleSelect(char.id)}
                      onMouseEnter={() => setHoveredChar(char.id)}
                      onMouseLeave={() => setHoveredChar(null)}
                    >
                      {/* 性别标识 */}
                      <span className={`char-gender ${char.gender}`}>
                        {char.gender === 'male' ? '♂' : '♀'}
                      </span>

                      {/* 名字 */}
                      <h4 className="char-name">{char.name}</h4>
                      <p className="char-title">{char.title}</p>

                      {/* 特质预览 */}
                      <div className="char-traits-mini">
                        {char.externalTraits?.slice(0, 2).map((t, i) => (
                          <span key={i} className="mini-trait" title={t.effect}>
                            {t.icon} {t.name}
                          </span>
                        ))}
                      </div>

                      {/* 他人已选标识 */}
                      {isTakenByOther && (
                        <div className="taken-overlay">
                          🔒 已被选择
                        </div>
                      )}

                      {/* 选中标记 */}
                      {isSelected && !isTakenByOther && (
                        <div className="selected-mark">✓</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 详情面板 */}
        {hoveredChar && (
          <div className="char-detail-panel">
            {(() => {
              const c = CHARACTER_IDENTITIES[hoveredChar];
              if (!c) return null;
              return (
                <>
                  <h4>{c.name} — {c.title}</h4>
                  <p className="char-story">{c.story}</p>
                  <div className="char-traits-full">
                    {c.externalTraits?.map((t, i) => (
                      <div key={i} className={`trait-full trait-${t.type?.toLowerCase()}`}>
                        <span className="trait-icon">{t.icon}</span>
                        <div>
                          <strong>{t.name}</strong>
                          <span className={`trait-type-badge ${t.type?.toLowerCase()}`}>
                            {t.type === 'ACTIVE' ? '主动' : t.type === 'PASSIVE' ? '被动' : t.type === 'WEAKNESS' ? '弱点' : t.type === 'SOCIAL' ? '社交' : '生存'}
                          </span>
                          <p>{t.effect}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="char-recommend">
                    🎯 推荐隐藏职业: {c.recommendedHiddenRoles?.join(' / ')}
                  </p>
                </>
              );
            })()}
          </div>
        )}

        {/* 底部按钮 */}
        <div className="char-select-footer">
          {!alreadySelected && (
            <button
              className="btn btn-primary btn-confirm"
              disabled={!selected}
              onClick={handleConfirm}
            >
              {selected ? `确认选择「${CHARACTER_IDENTITIES[selected]?.name || selected}」` : '请选择一个角色'}
            </button>
          )}
          {alreadySelected && (
            <p className="waiting-text">
              {Object.keys(selections).length >= players.length
                ? '所有人都已选择完毕，即将进入序幕...'
                : '等待其他玩家选择...'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
