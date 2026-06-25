// ============================================================
// 角色插图占位组件
// 每个角色一个占位框 → 后续替换为你找的插画
// ============================================================

import React from 'react';
import { ROLES, ROLE_NAMES, ROLE_ICONS } from '../utils/constants';

/**
 * 角色插图组件
 * 使用方式: <RoleIllustration role="WEREWOLF" size="large" />
 *
 * 【替换插画方法】
 * 将 public/illustrations/ 目录下的图片命名为对应角色:
 *   werewolf.png, alpha_wolf.png, seer.png,
 *   poison_witch.png, heal_witch.png, villager.png,
 *   guard.png, hunter.png
 * 然后在下方 ROLE_IMAGES 中引用即可。
 */
export default function RoleIllustration({ role, size = 'medium', showLabel = true }) {
  // ---- 插图占位区 ----
  // 如果你有图片，取消下面的注释并替换路径：
  // const ROLE_IMAGES = {
  //   [ROLES.WEREWOLF]: '/illustrations/werewolf.png',
  //   [ROLES.ALPHA_WOLF]: '/illustrations/alpha_wolf.png',
  //   [ROLES.SEER]: '/illustrations/seer.png',
  //   [ROLES.POISON_WITCH]: '/illustrations/poison_witch.png',
  //   [ROLES.HEAL_WITCH]: '/illustrations/heal_witch.png',
  //   [ROLES.VILLAGER]: '/illustrations/villager.png',
  //   [ROLES.GUARD]: '/illustrations/guard.png',
  //   [ROLES.HUNTER]: '/illustrations/hunter.png',
  // };
  // const imgSrc = ROLE_IMAGES[role];
  // if (imgSrc) {
  //   return (
  //     <div className={`role-illustration role-${size}`}>
  //       <img src={imgSrc} alt={ROLE_NAMES[role]} />
  //       {showLabel && <span className="role-label">{ROLE_NAMES[role]}</span>}
  //     </div>
  //   );
  // }

  // 占位：用图标 + 边框表示
  const icon = ROLE_ICONS[role] || '❓';
  const colors = {
    [ROLES.WEREWOLF]: '#c0392b',
    [ROLES.ALPHA_WOLF]: '#8b0000',
    [ROLES.SEER]: '#7d3c98',
    [ROLES.POISON_WITCH]: '#2e7d32',
    [ROLES.HEAL_WITCH]: '#27ae60',
    [ROLES.VILLAGER]: '#5d6d7e',
    [ROLES.GUARD]: '#2980b9',
    [ROLES.HUNTER]: '#d35400',
  };

  const color = colors[role] || '#888';

  return (
    <div
      className={`role-illustration role-${size}`}
      style={{ borderColor: color }}
      title={ROLE_NAMES[role]}
    >
      <div className="role-icon-placeholder" style={{ backgroundColor: color + '22' }}>
        <span className="role-emoji">{icon}</span>
        <span className="role-img-hint">插画位</span>
      </div>
      {showLabel && <span className="role-label" style={{ color }}>{ROLE_NAMES[role]}</span>}
    </div>
  );
}

/**
 * 角色列表展示（用于角色展示面板）
 */
export function RoleGallery() {
  const allRoles = [
    ROLES.WEREWOLF, ROLES.ALPHA_WOLF, ROLES.SEER,
    ROLES.POISON_WITCH, ROLES.HEAL_WITCH, ROLES.VILLAGER,
    ROLES.GUARD, ROLES.HUNTER,
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
