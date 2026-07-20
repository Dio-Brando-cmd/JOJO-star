// ============================================================
// PositionSync.js — 3D位置同步模块 (服务端)
// 接收Unity客户端上报位置 → 校验 → 广播给同房间其他玩家
// ============================================================

export class PositionSync {
  constructor(game) {
    this.game = game;
    this.positions = new Map();       // playerId → { x, y, z, rotY, timestamp }
    this.lastBroadcast = 0;
    this.BROADCAST_INTERVAL = 100;    // 100ms = 10Hz
    this.MAX_SPEED = 10;              // 最大移动速度 (m/s)，超过视为作弊
    this.MAX_TELEPORT_DISTANCE = 5;   // 单次更新最大位移 (m)
  }

  /**
   * 客户端上报位置 → 服务端校验并存储
   */
  updatePosition(playerId, { x, y, z, rotY, isMoving, isSprinting }) {
    const player = this.game.getPlayer(playerId);
    if (!player || !player.alive) return false;

    const prev = this.positions.get(playerId);

    // 反作弊：检测瞬移
    if (prev) {
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dz = z - prev.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dt = (Date.now() - prev.timestamp) / 1000;

      if (dt > 0 && distance / dt > this.MAX_SPEED * 1.5) {
        // 速度异常 → 可能是加速挂
        console.log(`[反作弊] ${playerId} 移动速度异常: ${(distance/dt).toFixed(1)}m/s`);
        // 回退到上一帧位置
        return false;
      }

      if (distance > this.MAX_TELEPORT_DISTANCE && dt < 0.5) {
        console.log(`[反作弊] ${playerId} 瞬移检测: ${distance.toFixed(1)}m in ${dt.toFixed(2)}s`);
        return false;
      }
    }

    // 存储
    this.positions.set(playerId, {
      x, y, z, rotY,
      isMoving: !!isMoving,
      isSprinting: !!isSprinting,
      timestamp: Date.now(),
    });

    // 更新Player对象（用于游戏逻辑判断"谁出门了"）
    player._posX = x;
    player._posY = y;
    player._posZ = z;

    return true;
  }

  /**
   * 定时广播所有玩家位置给同房间客户端
   */
  broadcastIfNeeded() {
    const now = Date.now();
    if (now - this.lastBroadcast < this.BROADCAST_INTERVAL) return;
    this.lastBroadcast = now;

    if (!this.game._io) return;

    const positionData = {};
    for (const [playerId, pos] of this.positions) {
      // 只广播最近2秒内有更新的玩家
      if (now - pos.timestamp > 2000) continue;
      positionData[playerId] = pos;
    }

    if (Object.keys(positionData).length === 0) return;

    this.game._io.to(this.game.id).emit('players:positions', {
      positions: positionData,
      timestamp: now,
    });
  }

  /**
   * 判断玩家是否在某个屋子附近（用于交互判定）
   */
  isPlayerNearHouse(playerId, houseOwnerId, radius = 3) {
    const playerPos = this.positions.get(playerId);
    const housePos = this.positions.get(houseOwnerId);
    if (!playerPos || !housePos) return false;

    const dx = playerPos.x - housePos.x;
    const dz = playerPos.z - housePos.z;
    return Math.sqrt(dx * dx + dz * dz) <= radius;
  }

  /**
   * 判断两个玩家是否在交互距离内
   */
  arePlayersClose(playerId1, playerId2, maxDistance = 2) {
    const pos1 = this.positions.get(playerId1);
    const pos2 = this.positions.get(playerId2);
    if (!pos1 || !pos2) return false;

    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= maxDistance;
  }

  /**
   * 获取玩家当前位置
   */
  getPlayerPosition(playerId) {
    return this.positions.get(playerId) || null;
  }

  /**
   * 清理断线玩家的位置数据
   */
  cleanupPlayer(playerId) {
    this.positions.delete(playerId);
  }

  /**
   * 生成房屋位置布局（暮色村12栋屋子 + 广场古树 + 水井 + 铁匠铺 + 墓地）
   */
  static generateVillageLayout() {
    // 环形布局，直径60米
    const houses = [];
    const names = [
      '猎人屋', '守卫屋', '种狼屋', '狼人屋',
      '预言家屋', '毒巫屋', '药巫屋', '村民1屋',
      '村民2屋', '村民3屋', '村民4屋', '村民5屋',
    ];

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const radius = 30;
      houses.push({
        id: `house_${i}`,
        name: names[i],
        position: {
          x: Math.round(Math.cos(angle) * radius * 10) / 10,
          y: 0,
          z: Math.round(Math.sin(angle) * radius * 10) / 10,
        },
        rotation: angle * (180 / Math.PI),
      });
    }

    return {
      houses,
      landmarks: [
        { id: 'village_tree', name: '广场古树', x: 0, y: 0, z: 0 },
        { id: 'village_well', name: '水井', x: -5, y: 0, z: 8 },
        { id: 'blacksmith', name: '铁匠铺', x: 8, y: 0, z: -5 },
        { id: 'graveyard', name: '南山墓地', x: 0, y: 0, z: -50 },
      ],
      bounds: { minX: -55, maxX: 55, minZ: -60, maxZ: 40 },
    };
  }
}
