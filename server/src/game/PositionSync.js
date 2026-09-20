// ============================================================
// PositionSync.js — 3D位置同步模块 (服务端)
// 接收Unity客户端上报位置 → 校验 → 广播给同房间其他玩家
// ============================================================

export class PositionSync {
  constructor(game) {
    this.game = game;
    this.positions = new Map();       // playerId → { x, y, z, rotY, timestamp }
    this._dirty = false;              // 脏标记: 有位置变化才广播
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

    // 反作弊: 拒绝 NaN/Infinity 坐标 (否则 Math.sqrt(NaN)=NaN 会让速度/瞬移检测全部失效)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      console.log(`[反作弊] ${playerId} 上报非法坐标: ${x}, ${y}, ${z}`);
      return false;
    }
    if (rotY != null && !Number.isFinite(rotY)) return false;

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

    const moving = !!isMoving;
    const sprinting = !!isSprinting;

    // 静止且与上一帧完全一致 → 仅刷新活跃时间戳, 不标记脏 (省 10Hz 全量重发)
    if (prev && prev.x === x && prev.y === y && prev.z === z &&
        prev.rotY === rotY && prev.isMoving === moving && prev.isSprinting === sprinting) {
      prev.timestamp = Date.now();
      return true;
    }

    // 存储
    this.positions.set(playerId, {
      x, y, z, rotY,
      isMoving: moving,
      isSprinting: sprinting,
      timestamp: Date.now(),
    });

    // 更新Player对象（用于游戏逻辑判断"谁出门了"）
    player._posX = x;
    player._posY = y;
    player._posZ = z;

    this._dirty = true;
    return true;
  }

  /**
   * 定时广播所有玩家位置给同房间客户端
   */
  broadcastIfNeeded() {
    const now = Date.now();
    if (now - this.lastBroadcast < this.BROADCAST_INTERVAL) return;
    this.lastBroadcast = now;

    // 无新位置变化 → 跳过广播 (脏标记, 避免 10Hz 全量重发)
    if (!this._dirty) return;
    this._dirty = false;

    if (!this.game._io) return;

    const positionData = {};
    for (const [playerId, pos] of this.positions) {
      // 只广播最近2秒内有更新的玩家
      if (now - pos.timestamp > 2000) continue;
      // 量化坐标 (2 位小数) 减小 JSON 载荷, 客户端插值无感
      positionData[playerId] = {
        x: Math.round(pos.x * 100) / 100,
        y: Math.round(pos.y * 100) / 100,
        z: Math.round(pos.z * 100) / 100,
        rotY: Math.round(pos.rotY * 100) / 100,
        isMoving: pos.isMoving,
        isSprinting: pos.isSprinting,
      };
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
      '灵痕追猎者屋', '帷幕守卫屋', '冥僧人屋', '蚀者屋',
      '察灵家屋', '草药学者屋', '愈灵师屋', '灵织者1屋',
      '灵织者2屋', '灵织者3屋', '灵织者4屋', '灵织者5屋',
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
