# 芙蕾雅（Freyja）— Meshy 完整工作流

> 从 0 到 Unity 可用的带骨骼+动画 3D 角色，全流程操作清单

---

## 流程总览

```
阶段1: Meshy → 生成3D模型 (Text-to-3D 或 Image-to-3D)
阶段2: Meshy → AI 贴图 (AI Texturing)
阶段3: Blender → 检查 + 缩放 + 精修（可选）
阶段4: Meshy → 自动绑骨 (Auto Rig)
阶段5: Meshy → 套动画 (Animation)
阶段6: Unity → 导入使用
```

---

## 阶段1：生成 3D 模型

### 方案 A：Text-to-3D（纯文本生成）

```
1. 打开 https://www.meshy.ai → 登录 Pro 账号
2. 点击 Text to 3D
3. 引擎选 Meshy 6（Pro 才有）
4. Mode: PBR
5. Style: Realistic
6. Poly Count: High (50K-100K)
7. 粘贴以下 prompt → Generate
8. 等 ~90 秒出 4 个候选
9. 选最好的 → Download FBX
```

**Prompt（英文，直接粘贴）：**

```
petite slender young female herbal scholar character, 1.65 meters height,
elegant delicate figure, slender hands with long fingers,
porcelain fair skin with subtle rosy cheeks, serene knowing expression,
silver-white long flowing hair reaching waist with two thin braids at temples,
wearing a cream-white linen headscarf wrapping around head, fabric draping softly at sides,
wearing a dark forest green scholar robe with open collar revealing cream linen inner shirt,
silver herbal pattern embroidery at collar and cuffs, patched elbows showing wear,
dark brown leather tool belt at waist with small glass vials attached,
vials filled with glowing green blue red purple liquid, semi-transparent glass,
long dark green skirt with side slit for walking,
dark brown soft leather short boots,
dried flower bracelet on left wrist, thin chain necklace with hidden locket at neck,
right hand raised palm up, several glowing translucent emerald green leaves floating above palm,
leaves with golden vein patterns, surrounded by tiny green floating light particles,
soft magical herbal glow illuminating hand and face from below,
gentle focused expression, scholarly herbalist aura,
T-pose, full body, centered, white background, game character, PBR,
even studio lighting, clean silhouette, high detail, 8K
```

### 方案 B：Image-to-3D（用原画生成，质量更高）

```
1. 先用 AI 画图工具（Midjourney / Stable Diffusion / Leonardo.ai）生成 T-pose 角色全身图
   提示词：方案A的prompt + "full body character sheet, front view, T-pose, white background"
2. Meshy → Image to 3D
3. 上传正面图 → 引擎选 Meshy 6 → PBR → High
4. 等 ~90 秒 → 选最好的 → Download FBX
```

### 阶段1产出

```
文件: Freyja_model.fbx
面数: 50K-100K 三角面
贴图: 自带 PBR（Base Color + Normal + Roughness + Metallic）
```

---

## 阶段2：AI 贴图（如需要重新贴图）

> 如果阶段1生成的模型贴图效果已经满意，可跳过此阶段

```
1. Meshy → AI Texturing
2. 上传阶段1的 FBX 模型
3. 引擎: Meshy 6
4. Resolution: 2K（PC）/ 4K（过场特写）
5. Style: Realistic
6. ☑ Base Color ☑ Normal ☑ Roughness ☑ Metallic
7. 粘贴以下 prompt → Generate
```

**贴图 Prompt：**

```
ethereal young herbal scholar, flawless porcelain skin with subtle rosy cheeks and light freckles,
silver-white hair like spun silk with natural cool-toned highlights,
cream-white linen headscarf with soft fabric folds and subtle weave texture,
dark forest green scholar robe with visible cotton weave, silver herbal embroidery at hems,
worn leather tool belt with darkened edges from years of use,
small glass potion vials with colored glowing liquid inside, semi-transparent glass with reflections,
dried flower bracelet with organic petal textures,
floating emerald green translucent leaves with glowing golden vein patterns,
PBR textures, subsurface scattering on skin, silk specular highlights on hair,
rough matte cotton on robe, polished glass on vials, worn leather on belt
```

### 阶段2产出

```
文件: Freyja_textured.fbx（或 glb）
贴图文件: Freyja_BaseColor.png / Freyja_Normal.png / Freyja_Roughness.png / Freyja_Metallic.png
分辨率: 2K (2048x2048) 或 4K (4096x4096)
```

---

## 阶段3：Blender 检查 + 精修（可选）

> 如果模型效果已经满意，可直接跳到阶段4绑骨

### 3.1 导入 FBX

```
Blender → File → Import → FBX
  Scale: 1.0
  Forward: -Z Forward
  Up: Y Up
```

### 3.2 查看贴图

```
右上角四个球体图标 → 点第三个（Material Preview）
→ 看颜色和贴图是否正常显示
```

### 3.3 缩放到真实身高（1.65m）

```
1. Add → Mesh → Cube
2. 右侧 Item → Dimensions → 设为 1m × 1m × 1m
3. 把立方体放在角色旁边对比
4. 选中角色 → S 键缩放 → 拖到约 1.65 个立方体高
5. Ctrl+A → Scale（应用缩放）
```

### 3.4 检查面数

| 用途 | 推荐面数 |
|------|---------|
| 手机 | 5K-15K ✅ |
| PC 独立 | 15K-35K ✅ |
| PC AAA | 50K-100K |
| 过场特写 | 100K+ |

### 3.5 雕刻面部（推荐）

```
1. 顶栏 → Sculpting（切换到雕刻工作区）
2. 笔刷说明：
   - Grab (G)         → 拉扯大型（调头型、下巴、鼻子）
   - Clay Strips       → 堆肌肉（颧骨、眉弓）
   - Smooth (Shift)    → 平滑过渡
   - Draw              → 画细节
   - Crease            → 刻皱纹、唇线
   - 按住 F 拖动       → 调笔刷大小
   - Shift+F           → 调笔刷力度

重点区域：
  - 颧骨        → Clay Strips 堆出凸起
  - 下颌线      → Grab 拉出棱角
  - 嘴唇        → Crease 刻出唇线
  - 鼻翼        → Grab 往两侧拉
  - 眼窝        → Draw 往里推（按住 Ctrl）
```

### 3.6 导出

```
File → Export → FBX
  Scale: 1.0
  Forward: -Z Forward
  Up: Y Up
  ☑ Selected Objects（只导出选中）
  ☑ Apply Modifiers
  ☑ Embed Textures
```

---

## 阶段4：Meshy 自动绑骨（Auto Rig）⭐ 核心步骤

> **把你的已有模型上传给 Meshy，AI 自动构建骨骼 + 蒙皮权重**
> 整个过程约 30 秒，零手动操作

### 操作步骤

```
1. 打开 https://www.meshy.ai → 登录
2. 顶部导航 → Animation（或 Rigging）
3. 点击 Upload Model → 选择你的 FBX 文件
   （支持 FBX / OBJ / GLB / GLTF / USDZ 格式）
4. Meshy AI 自动检测角色类型（人形 Humanoid）→ 无需手动选择
5. 点击 Auto Rig（自动绑定）
6. 等待约 30 秒：
   ✅ 自动构建完整骨骼层级（脊柱、四肢、手指、头部链）
   ✅ 自动计算平滑蒙皮权重
   ✅ 骨骼命名符合 Mixamo 规范
7. 预览绑骨效果 → 旋转看关节是否正常弯曲
```

### 如果绑骨不理想

```
常见问题：
  手指穿透/扭曲 → 先用 Meshy 的 Remesh 工具优化拓扑，再重新绑骨
  关节位置偏移 → Meshy 支持手动微调骨骼位置
  蒙皮权重不对 → 支持手动重绘权重

面数过高（10万+）可能变慢 → 等 3-5 分钟即可
```

### 阶段4产出

```
文件: Freyja_rigged.fbx
内容: 原始模型 + 完整人形骨骼 + 蒙皮权重
骨骼: 符合 Mixamo 规范，兼容 Unity Mecanim
```

---

## 阶段5：套动画（Animation）

> 绑骨完成后，在同一页面直接从内置动画库套用

### 操作步骤

```
1. 绑骨完成后，进入 Animation 页面
2. 从内置动画库中浏览和选择动作
3. 点击动画 → 实时预览效果
4. 不满意换一个 → 直到满意
5. 可以为一个角色选多个动画，批量下载
```

### 必须下载的基础动画（P0 优先级）

| 动画 | 用途 |
|------|------|
| Idle | 待机（含呼吸微动） |
| Walk | 行走 |
| Run | 奔跑 |
| Crouch Idle | 蹲伏待机 |
| Death | 死亡倒地 |
| Hit Reaction | 被攻击反馈 |
| Attack | 近战攻击 |

### 建议下载的扩展动画（P1 优先级）

| 动画 | 用途 |
|------|------|
| Sprint | 冲刺 |
| Pickup | 拾取道具/采集草药 |
| Throw | 投掷药瓶 |
| Open Door | 开门 |

### 导出动画设置

```
下载格式: FBX
  ☑ With Skin（包含蒙皮）
  Frame Rate: 30fps
  一个 FBX 可以包含多段动画，也可以分别下载每段
```

### 阶段5产出

```
Freyja_Idle.fbx
Freyja_Walk.fbx
Freyja_Run.fbx
Freyja_Crouch.fbx
Freyja_Death.fbx
Freyja_HitReaction.fbx
Freyja_Attack.fbx
...
（或一个包含所有动画的合并 FBX）
```

---

## 阶段6：Unity 导入

### 6.1 导入模型

```
1. Unity → Assets → 右键 → Import New Asset
2. 选择 Freyja_rigged.fbx（或带动画的 FBX）
3. 等待导入完成
```

### 6.2 配置 Rig

```
1. 在 Project 窗口选中 FBX
2. Inspector → Rig 标签页
3. Animation Type: Humanoid
4. Avatar Definition: Create From This Model
5. 点击 Apply
6. 点击 Configure → 检查骨骼映射是否正确
   （绿色对勾 = 映射正确，红色 = 需要手动指定）
```

### 6.3 配置材质

```
1. Inspector → Materials 标签页
2. Location: Use External Materials (Legacy) 或 Use Embedded Materials
3. 贴图自动关联 PBR 贴图
4. 如果贴图丢失：手动拖入 BaseColor / Normal / Roughness / Metallic 贴图
```

### 6.4 配置动画

```
1. Inspector → Animation 标签页
2. 勾选 ☑ Import Animation
3. 确认动画片段分割正确
4. 设置 Loop Time（Idle / Walk / Run 需要循环）
```

### 6.5 放入场景测试

```
1. 把 FBX 拖入 Hierarchy
2. 挂上 Animator Controller
3. 点击 Play → 测试 Idle / Walk / Run 等动画是否正常
```

---

## 快速检查清单

```
□ 阶段1: Meshy Text-to-3D → 生成模型 → 下载 FBX（50K-100K 面）
□ 阶段2: Meshy AI Texturing → 贴图 → 2K PBR（可选，自带贴图够好就跳过）
□ 阶段3: Blender → 导入检查 → 缩放到 1.65m → 雕刻面部 → 导出（可选）
□ 阶段4: Meshy → Upload → Auto Rig → 30秒自动绑骨
□ 阶段5: Meshy → Animation → 预览选择 → 下载 7+ 动画 FBX
□ 阶段6: Unity → Import → Humanoid Rig → 配置材质/动画 → 场景测试
```

---

## 积分预算（Meshy Pro 500积分/月）

| 操作 | 预估积分 |
|------|---------|
| Text-to-3D (Meshy 6, PBR, High) | ~20-30 积分/次 |
| AI Texturing (2K) | ~10-15 积分/次 |
| Auto Rig（自动绑骨） | ~10-15 积分/次 |
| Animation（每个动画） | ~5-10 积分/个 |

> 芙蕾雅一个角色完整跑通约需：生成(30) + 贴图(15) + 绑骨(15) + 动画7个(50) = **~110 积分**
> 10 个角色全部跑完约 1100 积分，分 2-3 个月完成

---

## 关键文件位置

| 用途 | 路径 |
|------|------|
| 本工作流文档 | `docs/芙蕾雅_Meshy完整工作流.md` |
| 原画参考 | `E:\veiland\芙蕾雅原画.jpg` |
| 已生成模型 | `E:\无敌帷幕之地文件\芙蕾雅3.fbx` |
| Meshy 生成 Prompt | `docs/meshy_pro_guide.md` |
| Meshy 贴图 Prompt | `docs/meshy_texturing_prompts.md` |
| Blender 精修脚本 | `blender/setup_for_sculpting.py` |
| 建模进度存档 | `docs/建模工作进度_可随时恢复.md` |
| 角色规格书 | `docs/3D角色建模规格书.md` |
| 原画需求文档 | `docs/原画需求文档.tex` |
