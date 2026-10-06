// ============================================================
// 确定性随机源 —— 真相盘系统的地基
// 保证：同一个 seed，永远摇出完全相同的一局（赛后回放逐帧可复现）。
// 全程不使用 Math.random。
// ============================================================

/** 把任意字符串（或数字）转成 32 位无符号整数种子（FNV-1a）。 */
export function hashSeed(input) {
  let h = 0x811c9dc5;
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 —— 高质量、极小、可复现的 PRNG。 */
function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 创建可复现的随机源。
 * @param {string|number} seed 任意种子（字符串会被哈希）
 * @returns {{seed:number, next:Function, int:Function, pick:Function, shuffle:Function, chance:Function}}
 */
export function createRng(seed) {
  const s = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const next = mulberry32(s);

  return {
    seed: s,

    /** [0,1) 浮点 */
    next,

    /** [min, max] 闭区间整数 */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },

    /** 从数组随机取一个元素 */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },

    /** 返回打乱后的新数组（不修改原数组，保证确定性） */
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    /** 以概率 p 返回 true */
    chance(p) {
      return next() < p;
    },
  };
}
