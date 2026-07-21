# Blender PBR 贴图绘制 — 免费 ArmorPaint 替代方案

---

## 快速开始（2 分钟）

```
1. Blender → 导入 Meshy 生成的 FBX 模型
2. 右键选中角色
3. Scripting 工作区 → Open → blender/setup_pbr_texturing.py → Run Script
4. 自动完成: 创建 2K PBR 贴图 + 材质节点 + 切换绘制模式
5. 开始画
```

脚本自动做的事：
- 创建 4 张 2048×2048 贴图（BaseColor / Roughness / Normal / Metallic）
- 连好 Principled BSDF 材质节点
- 自动 UV 展开（如果没 UV）
- 切换为 Texture Paint 模式 + 材质预览

---

## 贴图通道解释

| 通道 | 作用 | 底 |
|------|------|-----|
| **Base Color** | 固有色 | 中灰 |
| **Roughness** | 粗糙度（白=粗糙，黑=光滑） | 全白 |
| **Metallic** | 金属度（白=金属，黑=非金属） | 全黑 |
| **Normal** | 法线凹凸（不画也行） | 平面蓝 |

---

## 怎么画不同材质

### 皮肤
```
Base Color: 肉色 #E8C9A0（取色器直接在你模型上吸 Meshy 的贴图颜色）
Roughness: 涂浅灰（~0.4）— 皮肤微粗糙
Metallic: 全黑 — 皮肤不是金属
```

### 金属盔甲
```
Base Color: 铁灰色 #6B6B70
Roughness: 涂深色（~0.2）— 金属光滑，但边缘画白（磨损处粗糙）
Metallic: 涂白色 — 这是金属
```

### 皮革
```
Base Color: 棕色 #5C3A21
Roughness: 涂浅灰（~0.6）— 皮革比金属粗糙
Metallic: 全黑
```

### 布料/亚麻
```
Base Color: 米白/深绿等
Roughness: 涂接近白色（~0.8-1.0）— 布料很粗糙
Metallic: 全黑
```

---

## 实用技巧

### 技巧 1：从 Meshy 贴图吸色

Meshy 生成的贴图虽然整体不好看，但**颜色是对的**。

```
1. 先不跑脚本
2. 切到 Material Preview 看 Meshy 贴图
3. 按 S 键（吸管）→ 在模型上点 → 取到准确颜色
4. 再跑脚本 → 用取的色画
```

### 技巧 2：照片纹理投影（最像 AAA 的做法）

```
1. 网上找皮肤/金属/布料的高清照片
2. Texture Paint 模式 → 左侧 Tool → Texture → 点 New
3. 选 Image → Open → 选你的照片
4. 上方 Texture Slot → 选刚导入的照片
5. Tool 面板 → Brush → Texture → 选照片
6. 右上角 Stroke Method → 改为 Stencil
7. 画！照片纹理直接投影到模型上
```

### 技巧 3：边缘磨损（Roughness 通道画）

```
1. 右侧 Image Editor → 切换到 Roughness 贴图
2. 用白色画笔在边缘、凹陷处画 — 表示粗糙/磨损
3. 这是 Substance Painter 的核心技巧
```

### 技巧 4：粗糙度变化画皮肤

```
Roughness 通道:
  T区（额头/鼻梁/颧骨）→ 涂 ~0.3（略光滑，出油）
  脸颊/下巴 → 涂 ~0.5
  眼皮/嘴唇 → 涂 ~0.2（最光滑）
  衣物覆盖区 → 涂 ~0.6
```

---

## 导出贴图进 Unity

```
1. 画完后：每个贴图窗口 → Image → Save As → PNG
2. 存到 Unity 项目的 Assets/Textures/ 文件夹
3. Unity 中选贴图 → Inspector:
   sRGB: ✅ 对 BaseColor 勾选
   sRGB: ❌ 对 Roughness/Metallic/Normal 不勾选
4. 在材质里拖入对应贴图槽
```

---

## 一个角色大概多久

| 熟练度 | 时间 |
|--------|------|
| 第一次 | 2-3 小时 |
| 第 3 个角色之后 | 45-60 分钟 |
| 熟练后 | 30 分钟 |

**最省时间的方法：** 第一个角色画好后，后面的角色复用同一个 Roughness/Metallic 贴图（皮肤粗糙度都一样），只换 Base Color 颜色。
