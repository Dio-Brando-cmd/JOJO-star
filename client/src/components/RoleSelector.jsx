// ============================================================
// 角色选择器 —— 房主在大厅配置本局角色池（随机分配）
// 支持同名角色多选（如2蚀者、3灵织者）
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { ROLES, ROLE_NAMES, ROLE_ICONS } from '../utils/constants';

// 所有可选角色（带推荐最大数量）
const ALL_ROLES = [
  { id: ROLES.NETHER_MONK, name: '冥僧人', icon: '🕯️🌑', team: 'CORRUPTED', desc: '堕化他人·蚀变·噬灵·灵焰遮蔽', max: 1 },
  { id: ROLES.CORRUPTED, name: '蚀者', icon: '🌑', team: 'CORRUPTED', desc: '夜晚噬灵，吞噬他人灵焰', max: 5 },
  { id: ROLES.VEIL_SCHOLAR, name: '帷幕学者', icon: '👁️', team: 'VEIL_KEEPERS', desc: '察灵辨识纯净/蚀痕', max: 1 },
  { id: ROLES.HERBAL_SAGE, name: '草药学者', icon: '🌿📜', team: 'VEIL_KEEPERS', desc: '蚀灭符阵+灵符', max: 1 },
  { id: ROLES.SPIRIT_MENDER, name: '愈灵师', icon: '💫', team: 'VEIL_KEEPERS', desc: '灵焰修复+蚀痕净化', max: 1 },
  { id: ROLES.VEIL_GUARDIAN, name: '帷幕守卫', icon: '🛡️✨', team: 'VEIL_KEEPERS', desc: '灵焰庇护一人，可灵蚀重伤', max: 1 },
  { id: ROLES.FLAME_TRACKER, name: '灵痕追猎者', icon: '🎯', team: 'VEIL_KEEPERS', desc: '灵焰猎枪+噬灭短铳', max: 1 },
  { id: ROLES.SPIRIT_WEAVER, name: '灵织者', icon: '🧵', team: 'VEIL_KEEPERS', desc: '灵焰感知·帷幕低语·灵织术', max: 8 },
];

// 默认推荐配置
function getDefaultConfig(playerCount) {
  const configs = {
    5: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.SPIRIT_MENDER, ROLES.SPIRIT_WEAVER],
    6: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.SPIRIT_WEAVER],
    7: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
    8: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
    9: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
    10: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
    11: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
    12: [ROLES.NETHER_MONK, ROLES.CORRUPTED, ROLES.CORRUPTED, ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER, ROLES.SPIRIT_WEAVER],
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
    const hasWolf = config.some(r => r === ROLES.NETHER_MONK || r === ROLES.CORRUPTED);
    if (!hasWolf) return '必须至少有一个蚀者阵营角色';
    const hasVillage = config.some(r =>
      [ROLES.VEIL_SCHOLAR, ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.SPIRIT_WEAVER, ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER].includes(r)
    );
    if (!hasVillage) return '必须至少有一个守幕者阵营角色';
    const wolves = config.filter(r => r === ROLES.CORRUPTED || r === ROLES.NETHER_MONK).length;
    const village = config.length - wolves;
    if (wolves >= village) return '蚀者数量不能≥守幕者数量';
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

  const wolfCount = (roleCounts[ROLES.NETHER_MONK] || 0) + (roleCounts[ROLES.CORRUPTED] || 0);
  const villageCount = totalSelected - wolfCount;
  const validationError = totalSelected > 0 ? validate() : null;

  return (
    <div className="role-selector">
      <h4>🎭 角色配置（房主 — 随机分配）</h4>
      <p className="select-hint">
        玩家 {playerCount} 人 | 已配置 {totalSelected}/{playerCount} 个角色 |
        🌑蚀者 {wolfCount} | ✨守幕者 {villageCount}
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
