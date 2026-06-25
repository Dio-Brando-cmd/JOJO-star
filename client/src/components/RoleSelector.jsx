// ============================================================
// 角色选择器 —— 房主在大厅配置本局角色池（随机分配）
// 支持同名角色多选（如2狼人、3村民）
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { ROLES, ROLE_NAMES, ROLE_ICONS } from '../utils/constants';

// 所有可选角色（带推荐最大数量）
const ALL_ROLES = [
  { id: ROLES.ALPHA_WOLF, name: '种狼', icon: '👑🐺', team: 'WOLF', desc: '可变狼/感染/刀人', max: 1 },
  { id: ROLES.WEREWOLF, name: '狼人', icon: '🐺', team: 'WOLF', desc: '夜晚刀人，锁定人而非屋', max: 5 },
  { id: ROLES.SEER, name: '预言家', icon: '🔮', team: 'VILLAGE', desc: '查验好人/狼人', max: 1 },
  { id: ROLES.POISON_WITCH, name: '毒巫', icon: '☠️🧪', team: 'VILLAGE', desc: '烈性毒药+药水', max: 1 },
  { id: ROLES.HEAL_WITCH, name: '药巫', icon: '💚🧪', team: 'VILLAGE', desc: '万能药+单目标毒药', max: 1 },
  { id: ROLES.GUARD, name: '守卫', icon: '🛡️', team: 'VILLAGE', desc: '守护一人，可重伤', max: 1 },
  { id: ROLES.HUNTER, name: '猎人', icon: '🔫', team: 'VILLAGE', desc: '猎枪+短火铳', max: 1 },
  { id: ROLES.VILLAGER, name: '村民', icon: '👨‍🌾', team: 'VILLAGE', desc: '普通村民', max: 8 },
];

// 默认推荐配置
function getDefaultConfig(playerCount) {
  const configs = {
    5: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.HEAL_WITCH, ROLES.VILLAGER],
    6: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.VILLAGER],
    7: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.VILLAGER, ROLES.VILLAGER],
    8: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.VILLAGER, ROLES.VILLAGER],
    9: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.VILLAGER, ROLES.VILLAGER],
    10: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER],
    11: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
    12: [ROLES.ALPHA_WOLF, ROLES.WEREWOLF, ROLES.WEREWOLF, ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.GUARD, ROLES.HUNTER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER],
  };
  return configs[playerCount] || [];
}

export default function RoleSelector({ isHost, playerCount, currentConfig, onUpdate, disabled }) {
  // roleCounts: { [roleId]: count } — 当前各角色数量
  const [roleCounts, setRoleCounts] = useState({});
  const [error, setError] = useState('');

  // 从currentConfig初始化
  useEffect(() => {
    if (currentConfig && Array.isArray(currentConfig)) {
      const counts = {};
      currentConfig.forEach(r => {
        counts[r] = (counts[r] || 0) + 1;
      });
      setRoleCounts(counts);
    } else if (!currentConfig && isHost) {
      // 自动加载推荐配置
      const defaults = getDefaultConfig(playerCount);
      if (defaults.length > 0) {
        const counts = {};
        defaults.forEach(r => {
          counts[r] = (counts[r] || 0) + 1;
        });
        setRoleCounts(counts);
      }
    }
  }, [currentConfig, playerCount, isHost]);

  const totalSelected = Object.values(roleCounts).reduce((a, b) => a + b, 0);

  // 增加角色
  const addRole = (roleId) => {
    setError('');
    const role = ALL_ROLES.find(r => r.id === roleId);
    if (!role) return;
    const current = roleCounts[roleId] || 0;
    if (current >= role.max) {
      setError(`${role.name}最多${role.max}个`);
      return;
    }
    if (totalSelected >= playerCount) {
      setError(`角色总数(${totalSelected})已达到玩家数(${playerCount})`);
      return;
    }
    setRoleCounts(prev => ({ ...prev, [roleId]: current + 1 }));
  };

  // 减少角色
  const removeRole = (roleId) => {
    setError('');
    const current = roleCounts[roleId] || 0;
    if (current <= 0) return;
    if (current === 1) {
      const next = { ...roleCounts };
      delete next[roleId];
      setRoleCounts(next);
    } else {
      setRoleCounts(prev => ({ ...prev, [roleId]: current - 1 }));
    }
  };

  // 应用推荐
  const applyDefault = () => {
    setError('');
    const defaults = getDefaultConfig(playerCount);
    if (defaults.length === 0) {
      setError(`没有${playerCount}人推荐配置`);
      return;
    }
    const counts = {};
    defaults.forEach(r => {
      counts[r] = (counts[r] || 0) + 1;
    });
    setRoleCounts(counts);
  };

  // 清空
  const clearAll = () => {
    setError('');
    setRoleCounts({});
  };

  // 生成配置数组
  const buildConfig = useCallback(() => {
    const config = [];
    for (const [roleId, count] of Object.entries(roleCounts)) {
      for (let i = 0; i < count; i++) {
        config.push(roleId);
      }
    }
    return config;
  }, [roleCounts]);

  // 验证
  const validate = useCallback(() => {
    const config = buildConfig();
    if (config.length === 0) return '请选择至少一个角色';
    if (config.length !== playerCount) return `角色数量(${config.length})与玩家数量(${playerCount})不匹配`;
    const hasWolf = config.some(r => r === ROLES.ALPHA_WOLF || r === ROLES.WEREWOLF);
    if (!hasWolf) return '必须至少有一个狼人阵营角色';
    const hasVillage = config.some(r =>
      [ROLES.SEER, ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.VILLAGER, ROLES.GUARD, ROLES.HUNTER].includes(r)
    );
    if (!hasVillage) return '必须至少有一个好人阵营角色';
    const wolves = config.filter(r => r === ROLES.WEREWOLF || r === ROLES.ALPHA_WOLF).length;
    const village = config.length - wolves;
    if (wolves >= village) return '狼人数量不能≥好人数量';
    return null;
  }, [buildConfig, playerCount]);

  const handleSave = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    onUpdate(buildConfig());
  };

  if (!isHost) {
    if (!currentConfig || currentConfig.length === 0) return null;
    const counts = {};
    currentConfig.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    return (
      <div className="role-selector readonly">
        <h4>🎭 本局角色配置</h4>
        <div className="role-config-display">
          {Object.entries(counts).map(([roleId, count]) => {
            const role = ALL_ROLES.find(r => r.id === roleId);
            return (
              <span key={roleId} className={`config-role-tag ${role?.team}`}>
                {role?.icon} {role?.name || roleId} ×{count}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  const wolfCount = (roleCounts[ROLES.ALPHA_WOLF] || 0) + (roleCounts[ROLES.WEREWOLF] || 0);
  const villageCount = totalSelected - wolfCount;
  const validationError = totalSelected > 0 ? validate() : null;

  return (
    <div className="role-selector">
      <h4>🎭 角色配置（房主 — 随机分配）</h4>
      <p className="select-hint">
        玩家 {playerCount} 人 | 已配置 {totalSelected}/{playerCount} 个角色 |
        🐺狼人 {wolfCount} | 👥好人 {villageCount}
      </p>
      {totalSelected > 0 && totalSelected !== playerCount && (
        <p className="warning-text">⚠️ 角色数量需等于玩家数量</p>
      )}
      {error && <p className="error-text">{error}</p>}
      {validationError && <p className="warning-text">⚠️ {validationError}</p>}

      <div className="role-grid">
        {ALL_ROLES.map(role => {
          const count = roleCounts[role.id] || 0;
          const isSelected = count > 0;
          return (
            <div key={role.id} className={`role-option ${isSelected ? 'selected' : ''} ${role.team}`}>
              <span className="role-option-icon">{role.icon}</span>
              <span className="role-option-name">{role.name}</span>
              <span className="role-option-desc">{role.desc}</span>
              <div className="role-count-controls">
                <button
                  className="btn btn-small btn-secondary"
                  onClick={() => removeRole(role.id)}
                  disabled={disabled || count <= 0}
                >
                  −
                </button>
                <span className="role-count-display">{count}</span>
                <button
                  className="btn btn-small btn-secondary"
                  onClick={() => addRole(role.id)}
                  disabled={disabled || count >= role.max || totalSelected >= playerCount}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="role-actions">
        <button className="btn btn-small btn-secondary" onClick={applyDefault} disabled={disabled}>
          📋 推荐配置
        </button>
        <button className="btn btn-small btn-ghost" onClick={clearAll} disabled={disabled}>
          清空
        </button>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={disabled || (totalSelected !== playerCount) || !!validationError}
      >
        💾 应用角色配置（角色将随机分配）
      </button>
    </div>
  );
}
