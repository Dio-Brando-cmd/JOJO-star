// ============================================================
// 角色插图组件 — 使用 SVG 插画系统
// 自动回退到 emoji 占位（离线/旧浏览器）
// ============================================================

import React from 'react';
import { ROLES, ROLE_NAMES } from '../utils/constants';
import { RoleSVG } from '../assets/illustrations';

const SIZE_MAP = {
  large: 160,
  medium: 100,
  small: 56,
  tiny: 36,
};

/**
 * 角色插图组件
 * 使用方式: <RoleIllustration role="WEREWOLF" size="large" />
 */
export default function RoleIllustration({ role, size = 'medium', showLabel = true }) {
  const px = SIZE_MAP[size] || SIZE_MAP.medium;

  return (
    <div className={`role-illustration role-${size}`} title={ROLE_NAMES[role]}>
      <RoleSVG role={role} size={px} />
      {showLabel && (
        <span className="role-label">{ROLE_NAMES[role]}</span>
      )}
    </div>
  );
}

/**
 * 角色列表展示（用于角色展示面板）
 */
export function RoleGallery() {
  const allRoles = [
    ROLES.CORRUPTED, ROLES.NETHER_MONK, ROLES.VEIL_SCHOLAR,
    ROLES.HERBAL_SAGE, ROLES.SPIRIT_MENDER, ROLES.SPIRIT_WEAVER,
    ROLES.VEIL_GUARDIAN, ROLES.FLAME_TRACKER,
  ];

  return (
    <div className="role-gallery">
      {allRoles.map(role => (
        <div key={role} className="role-gallery-item">
          <RoleIllustration role={role} size="small" showLabel={true} />
        </div>
      ))}
    </div>
  );
}
