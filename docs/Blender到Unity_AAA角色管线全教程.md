# 帷幕之地 · Blender→Unity AAA角色管线全教程

> 从Blender基础建模到Unity引擎内可玩的3A级角色——每一步的完整拆解
> 版本：2026-07-23

---

# 第一部分：Blender → Unity 完整管线

## 你目前的情况

根据项目已有资产，你的起点是：
- ✅ Blender自动生成的15个角色基础FBX（`generate_characters.py`）
- ✅ Mixamo自动绑骨+基础动画
- ✅ Blender PBR贴图绘制环境（`setup_pbr_texturing.py`）
- ✅ Unity客户端骨架（`GameManager3D.cs` / `PlayerController3D.cs`）
- ✅ 3D位置同步（`PositionSync.js`）
- ❌ 贴图未实际绘制
- ❌ 模型未精修/雕刻
- ❌ 未导入Unity运行

**目标：从现在的FBX出发，走完整条管线，得到一个能在Unity场景中自由移动、有动画、有材质的角色。**

---

## 第一步：模型精修（Blender雕刻）

### 1.1 理解你现在的模型状态

`generate_characters.py` 生成的是**基础几何体**——由Skin Modifier驱动的、只有大块形状的人体。这离"游戏可用"还差三步：

```
基础几何体 → 精修雕刻(高模) → 重拓扑(低模) → 烘焙(法线贴图)
```

### 1.2 雕刻前的准备

打开Blender，加载你生成的角色FBX（以芙蕾雅为例）：

```
1. File → Import → FBX → 选择 C:/Users/Lenovo/Desktop/Werewolf_Models/Freyja.fbx
2. 选中模型 → Tab进入Edit Mode → 确认网格是三角形还是四边形
   - 如果从generate_characters.py生成，应该是四边形(quads)的Skin Modifier产物
3. 应用所有Modifier：Object Mode → 右侧Modifier面板 → Apply All
4. Ctrl+A → Apply Scale / Apply Rotation（确保变换归零）
```

### 1.3 开启雕刻

```
1. 选中模型 → Tab进入Object Mode
2. 顶部菜单切换到 Sculpting 工作区
3. 右侧选择 Remesh（体素重网格）：
   - Voxel Size: 0.02m（角色高度约1.8m时）
   - 点击 Remesh → 网格变为均匀四边形，适合雕刻
4. 开始雕刻。核心笔刷顺序：
```

**雕刻笔刷使用顺序（从粗到细）：**

| 步骤 | 笔刷 | 快捷键 | 目的 | 用时(单角色) |
|------|------|--------|------|-------------|
| 1 | Clay Strips | 按住Shift+选 | 堆叠大块体积(肌肉群/骨骼突起) | 30min |
| 2 | Smooth | Shift | 平滑粗糙面 | 随用随按 |
| 3 | Grab | G | 调整比例(拉长/缩短部位) | 15min |
| 4 | Crease | Shift+C | 刻画硬边缘(颧骨/下颌线/锁骨) | 20min |
| 5 | Clay | C | 补充中等体积 | 20min |
| 6 | Pinch | P | 收紧边缘(嘴唇/眼睑/指甲) | 15min |
| 7 | Draw Sharp | 自定义 | 细皱纹/皮肤褶皱 | 30min |
| 8 | Multires Displacement | 纹理笔刷 | 皮肤毛孔微细节 | 20min |
| **合计** | | | | **约2.5小时/角色** |

**具体操作：**

```
雕刻时左手操作：
- F键：调整笔刷大小（拖动鼠标）
- Shift+F：调整笔刷强度
- Ctrl+拖动：反转笔刷（挖/填互相切换）
- X键：镜像雕刻（左右对称，做脸时必开）
- /键(小键盘)：隔离显示当前物体
```

**雕刻前的参考准备：**
- 打开PureRef（免费参考图拼接软件），放入：
  - 人体解剖图（肌肉群位置）
  - 角色概念设计图（你已有原画需求规格书中的描述）
  - 类似风格的3A角色截图（暗黑奇幻风格参考：Elden Ring/黑暗之魂/巫师3）

### 1.4 雕刻服装与装备

身体精修完成后，需要给角色做服装。两种方法：

**方法A：直接在角色身上用遮罩提取（Mask Extract）——最快**
```
1. 在Sculpt Mode用Mask笔刷画出衣服区域
2. Ctrl+I 反转遮罩
3. Mesh → Separate → Selection
4. 分离出的部分用Solidify Modifier加厚0.3cm
5. 再用Cloth Filter雕刻出褶皱
```

**方法B：用Marvelous Designer做布料（专业）→ 导出OBJ→导入Blender**
```
流程：MD中设计版型→解算布料→导出OBJ→Blender中雕刻细化褶皱
```

**方法C：用Blender的Cloth笔刷（中策）**
```
在Sculpt Mode用Cloth笔刷：画褶皱、布料堆积效果
```

对于帷幕之地的角色，建议：
- 蚀者/冥僧人：破烂长袍+蚀痕纹理(用遮罩提取+Cloth笔刷)
- 帷幕守卫：灵质铠甲(用基本几何体拼接+Cube Dyntopo雕刻)
- 草药学者：多口袋外套(遮罩提取+Solidify)
- 灵织者：朴素布衣(遮罩提取+Cloth褶皱)

---

## 第二步：重拓扑（高模→低模）

雕刻完的高模可能有50万-200万面——Unity里不可能直接跑。需要做一个低面版本。

### 2.1 自动重拓扑（推荐，最快）

```
方法1：Quad Remesher插件（$85，物超所值）
1. Blender安装Quad Remesher插件
2. Edit Mode → 全选 → Quad Remesher按钮
3. Target Count: 15000-25000（角色）+ 5000-10000（服装）
4. 等待10-30秒 → 自动生成完美四边形低模

方法2：Blender自带Remesh（免费）
1. Object Data Properties → Remesh
2. Mode: Quad
3. Octree Depth: 6-7（越高越密）
```

### 2.2 手动重拓扑（最精确，角色面部推荐）

```
1. 高模上右键 → Snap → Face Project（吸附到高模面）
2. 创建一个Plane，进入Edit Mode
3. 打开Snapping（磁铁图标）→ Snap to Face
4. 在Plane上按E挤出→新顶点自动吸附到高模表面
5. 一块一块地手动铺面：
   - 眼睛周围：环形面流(Edge Loop)
   - 嘴巴周围：环形面流
   - 鼻子：从眉心向下铺
   - 后脑：可以用较大面
```

**重拓扑面数预算（移动端/PC端）：**

| 部位 | 移动端 | PC端 |
|------|--------|------|
| 头部(含五官) | 2000面 | 5000面 |
| 身体 | 3000面 | 7000面 |
| 服装/装备 | 3000面 | 8000面 |
| 头发(面片) | 1000面 | 3000面 |
| **合计** | **~9000面** | **~23000面** |

### 2.3 重拓扑检查清单

- [ ] 面部有环形眼窝流(Eye Loop)
- [ ] 面部有环形口轮流(Mouth Loop)
- [ ] 关节处(肩/肘/腕/膝/踝)有三条环形边（用于变形缓冲）
- [ ] 三角面全部转换为四边形(Edit Mode → Face → Tris to Quads)
- [ ] 没有N-gon（5边以上面）
- [ ] 镜像对称部分中线顶点已合并

---

## 第三步：UV展开

### 3.1 Blender UV展开流程

```
1. Tab进入Edit Mode → 按3进入Face Select
2. 选中需要单独UV的缝合边(Seam)：
   - 头顶一圈(发际线)
   - 耳后→下颌线→耳后(面部分离)
   - 手臂内侧(腋下到手腕)
   - 腿内侧(胯下到脚踝)
   - 手指/脚趾根部
3. Ctrl+E → Mark Seam（标记缝合边）
4. A全选 → U → Unwrap → Angle Based
5. 左上角切换到UV Editing工作区查看展开结果
```

### 3.2 UV布局优化

- 面部UV占用最大面积（最重要的视觉区域）
- 身体UV放次大面积
- 手/脚UV缩小（不经常被看到）
- UV岛之间留4-6像素间距（防止烘焙时溢出）
- 所有UV放在0-1象限内（U1=右半边，U2=左半边，U3/U4=不重要区）
- 对称的身体部分可以重叠UV（左右手用同一UV）→节省空间

---

## 第四步：烘焙（高模细节→低模贴图）

这是AAA画质最关键的一步。高模的雕刻细节不是直接用在游戏里的——而是"烤"成贴图贴在低模上。

### 4.1 准备工作

```
1. 确保高模和低模在同一个位置（原点对齐）
2. 低模：给予一个新材质，命名为 "Freyja_LP"
3. 在Shader Editor中为低模材质创建：
   - Image Texture节点：新建2048×2048，命名为 "Freyja_Normal"（32-bit Float）
   - Image Texture节点：新建2048×2048，命名为 "Freyja_Curvature"
   - Image Texture节点：新建2048×2048，命名为 "Freyja_AO"
```

### 4.2 烘焙操作

```
1. 先选高模 → Shift+选低模（低模最后选=Active）
2. 右侧Render Properties → Render Engine: Cycles
3. 右侧Render Properties → Bake：
   - Bake Type: Normal
   - Cage Extrusion: 0.02m（根据模型大小调整）
   - Max Ray Distance: 0.1m
   - 勾选 Selected to Active
4. 点击 Bake → 等待（2K贴图约2-5分钟）
5. 重复烘焙其他贴图：
   - Ambient Occlusion（AO）
   - Curvature（曲率）
   - Thickness（厚度）
```

**烘焙失败的常见原因：**
- 高模低模距离太远→Cage Extrusion调大
- 法线方向反了→Shift+N重新计算法线
- UV岛重叠→检查UV Editor中是否有重叠面

---

## 第五步：PBR贴图绘制

### 5.1 Substance Painter路径（行业标准，$20/月）

```
1. 导出低模为FBX（File → Export → FBX）
2. 导入Substance Painter
3. Bake Mesh Maps（工具自动烘焙所有贴图）
4. 分层绘制：
   a. 基础材质层（皮肤/布料/金属/皮革）
   b. 颜色变化层（色相/饱和度微调）
   c. 粗糙度变化层（皮肤T区更光滑/指尖更粗糙）
   d. 脏旧层（边缘磨损/衣物折痕处积灰）
   e. 特效层（灵焰发光/蚀痕暗斑）
5. 导出为Unity HDRP模板
```

### 5.2 Blender PBR免费路径（你已有setup_pbr_texturing.py）

```
1. 在Blender中运行 setup_pbr_texturing.py
2. 切换到Texture Paint模式
3. 左手操作：
   - 直接在模型上画(3D View)
   - 或在UV Editor的2D视图上画
4. 分层画法：
   - 底色层：纯色填充→用noise纹理叠加微变化
   - 粗糙度层：白色打底→用Stencil笔刷刷出粗糙区域
   - 金属度层：只在金属部件上画白色
```

### 5.3 帷幕之地角色贴图需求

| 角色类型 | BaseColor要点 | Roughness要点 | 特殊效果 |
|---------|--------------|---------------|---------|
| 蚀者 | 苍白肤色、暗紫血管可见 | 皮肤偏油(低粗糙度) | 灵焰吸收的黑光区域(Emission=负值) |
| 冥僧人 | 灰袍、念珠微光 | 布料粗糙、念珠光滑 | 一半眼睛暗紫色HDR发光 |
| 帷幕学者 | 朴实学者袍、霜星单片镜 | 布料粗糙、镜片光滑 | 镜片反射灵焰微光 |
| 草药学者 | 多口袋外套、灵植染色的手指 | 皮革粗糙、灵液瓶光滑 | 符纸上的金色符文Emissive |
| 愈灵师 | 普通衣着、半透明掌心 | 皮肤正常、手心发亮 | 掌心微弱的金色Subsurface Scattering |
| 帷幕守卫 | 灵质轻甲、旧伤裂纹臂 | 金属粗糙、皮肤正常 | 盾面微弱审判符文Emissive |
| 灵痕追猎者 | 深色猎装、白色狼皮短斗篷 | 猎装粗糙、枪管光滑 | 猎枪管口微弱的灵焰Emissive |
| 灵织者 | 朴素日常衣、腰间灵质织机 | 布料粗糙、织机金属 | 织机上金/银/灰/黑四色微光 |

---

## 第六步：绑定（Rigging）

### 6.1 Mixamo自动绑定（你已有，最快）

```
1. mixamo.com → Upload Character → 选择你的FBX
2. 放置标记点：
   - 下巴(Chin)
   - 手腕(Wrists)
   - 肘部(Elbows)
   - 膝盖(Knees)
   - 胯部(Groin)
3. 等待自动绑定（10-30秒）
4. 下载动画 → FBX, With Skin, 30fps
```

### 6.2 需要下载的动画列表（免费）

| 动画 | Mixamo名称 | 用途 |
|------|-----------|------|
| 待机 | Idle | 默认站立 |
| 走路 | Walking | 正常移动 |
| 跑步 | Running | 冲刺 |
| 蹲伏 | Crouch Walking | 隐匿移动 |
| 攻击 | Stab / Punch / Swing | 近战攻击 |
| 受击 | Hit Reaction | 被攻击反馈 |
| 死亡 | Dying | 死亡倒地 |
| 交互 | Pick Up | 拾取道具 |

### 6.3 手动绑定（需要面部表情时必做）

Mixamo只能绑身体。如果你需要面部表情（暗幕推理模式的会议特写镜头），必须手动绑脸：

```
1. Blender中：Object Mode → Add → Armature → Human (Meta-Rig)
2. 进入Edit Mode调整骨骼位置匹配角色
3. Generate Rig → 生成完整Rigify骨架
4. 选中模型→Shift选骨架→Ctrl+P→With Automatic Weights
5. 面部骨骼手动Weight Paint调整（嘴/眼/眉/脸颊）
```

**面部Blend Shapes（表情融合变形）：**
```
创建以下Blend Shapes（每个约15分钟）：
- 嘴: 微笑/愤怒/悲伤/惊讶/说"啊"形/说"呜"形
- 眼: 闭眼/怒视/惊恐/眯眼
- 眉: 上扬/皱眉/八字眉
```

---

## 第七步：导入Unity

### 7.1 导出为FBX

```
Blender: File → Export → FBX
设置：
- Scale: 1.00
- Apply Scalings: FBX All
- Forward: -Z Forward（Unity是Z轴向前）
- Up: Y Up
- 勾选: Selected Objects / Mesh / Armature / Animation
```

### 7.2 Unity导入设置

```
1. 将FBX文件拖入Unity的 Assets/Models/Characters/ 目录
2. 选中FBX → Inspector面板：
   - Model标签：
     - Scale Factor: 1
     - Convert Units: 勾选
     - Mesh Compression: Low(角色) / Medium(远处NPC)
     - Read/Write: 如果运行时改Mesh则勾选
   - Rig标签：
     - Animation Type: Humanoid
     - Avatar Definition: Create From This Model
     - 检查骨骼映射是否正确(Unity自动匹配)
   - Materials标签：
     - Location: Use External Materials (Legacy)
     - 点击 Extract Materials → 选择 Materials/ 子目录
```

### 7.3 材质设置（URP Lit Shader）

```
1. Assets/ 右键 → Create → Material → 命名 "M_Freyja"
2. Shader: Universal Render Pipeline/Lit
3. 贴图赋值：
   - Base Map: 你的BaseColor贴图
   - Normal Map: 你的Normal贴图（Texture Type必须设为Normal Map）
   - Metallic Map: 金属度贴图
   - Smoothness: 从Roughness反相
   - Emission Map: 灵焰发光区域（角色胸口的灵焰微光）
4. 将Material拖到模型上
```

### 7.4 预制体（Prefab）设置

```
1. Hierarchy中：
   - 将角色FBX拖入场景
   - 添加组件：
     - Animator（拖入Animator Controller）
     - Character Controller或Capsule Collider + Rigidbody
     - PlayerController3D（你们已有的C#脚本）
     - NetworkManager脚本（网络同步）
2. 调整Capsule Collider大小包裹角色
3. 将整个GameObject拖入Assets/Prefabs/
```

### 7.5 动画控制器（Animator Controller）

```
1. Assets/ 右键 → Create → Animator Controller → 命名 "AC_Freyja"
2. 双击打开Animator窗口
3. 创建状态：
   - Idle → Walking (条件: Speed > 0.1)
   - Walking → Running (条件: Speed > 3.0)
   - Running → Walking (条件: Speed < 3.0)
   - Any State → Hit (Trigger: Hit)
   - Any State → Death (Trigger: Death)
4. 在角色的Animator组件中拖入AC_Freyja
```

### 7.6 角色在场景中跑起来

```
1. 在Unity场景中创建一个Plane作为地面
2. 将角色Prefab拖入场景
3. PlayerController3D脚本会处理：
   - WASD移动 → 设置Animator的Speed参数
   - Shift冲刺 → Speed > 3.0触发Running动画
   - 鼠标旋转视角
4. 点击Play → 角色应该能自由移动+播放行走/跑步动画
```

---

## 第八步：场景搭建（暮色聚落）

### 8.1 已有的场景生成

你们已有 `VillageSceneSetup.cs` —— 自动生成12栋环形屋子+4个地标。检查：

```
1. 打开Unity → 打开场景
2. 在Hierarchy中找VillageSceneSetup对象
3. 确保脚本的引用完整（屋子prefab、地标prefab等）
4. 点击Play → 场景自动生成
```

### 8.2 手动优化场景

自动生成的场景通常需要手动精修：

```
1. 屋子内部：导入你做的Blender室内模型(FBX)
   - 前厅：壁炉、桌椅
   - 卧室：床、衣柜
   - 地下室：藏匿点
2. 地标细化：
   - 枯树广场：导入世界树残枝模型
   - 水井：石头井口+绳索+水桶
   - 铁匠铺：铁砧+锻炉+墙上挂的门锁
   - 观测塔：石塔废墟+桌上散落的笔记+水晶碎片
3. 灯光布置：
   - 血月：Directional Light 偏红色温
   - 屋内的炉火：Point Light 暖橙色
   - 帷幕极光：天空盒使用自定义PBR天空
```

### 8.3 导入你已有的角色到场景

```
1. 将15个角色的Prefab全部放在Assets/Prefabs/Characters/
2. 在NetworkManager或GameManager中配置：
   - 玩家选择角色 → 实例化对应Prefab
   - Prefab上的PlayerController3D自动接管移动
```

---

# 第二部分：AAA角色建模 —— 全部步骤拆解

以下将一个AAA级游戏角色的建模过程，从零开始，拆解为18个独立步骤。每个步骤标注了所需技能、时间、常用工具和交付标准。这是大型工作室(如育碧、CDPR、FromSoftware)的完整管线。

## 第一步：概念设计与参考收集

**工时：** 1-2天
**工具：** PureRef(免费) / Photoshop / 概念设计图

```
1. 收集50-100张参考图：
   - 解剖参考(肌肉/骨骼)
   - 服装参考(你角色的时代/风格)
   - 材质参考(旧皮/生锈金属/粗糙布料)
   - 类似风格角色参考(如Elden Ring的角色设计)
2. 用PureRef拼成一块参考板(Mood Board)
3. 确定角色三视图(Front/Side/Back)的比例数据
4. 标注每个部位的特殊要求(如"蚀者胸口有黑光吸收区域")
```

## 第二步：基础网格（Blockout / Base Mesh）

**工时：** 0.5-1天
**工具：** Blender / Maya / ZBrush

```
1. 用简单几何体(Cube/Sphere/Cylinder)搭建角色的基本比例
2. 只关注大块形状和比例关系——不做任何细节
3. 确保：
   - 全身高度准确（约7-8头身，按角色设定）
   - 肩宽/腰宽/臀宽比例对
   - 四肢长度和粗细对
4. 此时的面数：约2000-4000面
```

**这一阶段的交付标准：** 只看剪影(silhouette)就能认出是这个角色。

## 第三步：人体基础雕刻（Primary Forms）

**工时：** 2-3天
**工具：** ZBrush（行业标准）/ Blender Sculpt Mode（替代）

```
1. 将基础网格细分到约100万面(Dynamesh或Remesh)
2. 雕刻大块解剖结构：
   - 颅骨形状
   - 颈部肌肉(胸锁乳突肌)
   - 肩部三角肌
   - 胸部胸大肌
   - 腹部腹直肌(六块腹肌)
   - 背部背阔肌、斜方肌
   - 手臂肱二头肌/肱三头肌
   - 前臂屈肌/伸肌群
   - 大腿股四头肌/股二头肌
   - 小腿腓肠肌
3. 男性角色：肌肉线条更分明
4. 女性角色：柔和的解剖过渡，更多皮下脂肪层
```

**关键原则：** 永远从最大块开始，逐步向下。不要在没有做好大块形状时就去雕锁骨。

## 第四步：次级细节雕刻（Secondary Forms）

**工时：** 3-5天
**工具：** ZBrush（行业标准）/ Blender Sculpt Mode

```
1. 在大块解剖正确的基础上，雕刻：
   - 面部特征（眼窝深度、鼻翼形状、嘴唇厚度）
   - 锁骨和胸骨突起
   - 手部关节和肌腱
   - 脚踝骨突起
   - 膝盖髌骨
   - 肘部鹰嘴突
2. 继续细分到约500万-1000万面
3. 每一个解剖细节都要有参考——不要凭想象
```

## 第五步：三级细节雕刻（Tertiary Details）

**工时：** 2-3天
**工具：** ZBrush + Alpha Brushes / Blender + Multires Displacement

```
1. 最细层面的雕刻：
   - 皮肤毛孔（用Alpha笔刷一张一张地在T区/脸颊/鼻翼处印上去）
   - 细皱纹（眼角鱼尾纹、额头横纹、法令纹）
   - 疤痕（角色的旧伤）
   - 血管（手背/前臂/太阳穴的静脉微微隆起）
   - 指甲和甲床
   - 嘴唇纹路
2. 面数可达2000万-5000万面
3. 这个细节永远不用在游戏中——它会被烘焙成法线贴图
```

## 第六步：服装建模（Marvelous Designer）

**工时：** 2-4天
**工具：** Marvelous Designer（$50/月）/ Blender Cloth笔刷（免费替代）

```
Marvelous Designer流程：
1. 导入角色高模（OBJ格式）
2. 创建服装版型（2D平面的缝纫版）：
   - 拖动每个点确定领口/袖口/下摆位置
   - 缝合对应的边(Seam)
3. 设置布料物理参数：
   - 棉布：较低弹性、中等厚度
   - 皮革：极低弹性、高厚度
   - 丝绸：高弹性、极低厚度
4. 启动Simulate(解算)——布料自然落在角色身上
5. 手动干预：在关键位置Pin住布料、调整褶皱
6. 导出OBJ → 导入Blender做进一步雕刻细化

Blender Cloth笔刷流程（免费替代）：
1. 用Mask Extract提取衣服基本形状
2. Solidify给厚度
3. Sculpt Mode → Cloth笔刷 → 在关键褶皱位置涂抹
4. 用Cloth Filter → 全局添加微褶皱
```

## 第七步：装备/道具建模

**工时：** 2-5天
**工具：** Blender / Maya / ZBrush

```
对帷幕之地角色需要建的装备：
- 灵焰猎枪（追猎者）
- 噬灭短铳（追猎者）
- 灵质盾牌（帷幕守卫）
- 灵焰弩/符笔/符囊（草药学者）
- 观测镜片/笔记（帷幕学者）
- 灵质织机（灵织者）
- 冥僧人念珠/长杖
- 灵质铠甲片/门锁

对每个装备：
1. 中模：在Blender中用标准建模(Extrude/Bevel/Loop Cut)
2. 高模：导入ZBrush或Blender雕刻，添加使用痕迹(磨损/划痕/凹坑)
3. 低模：将高模的面数降到游戏可用(500-3000面)
4. UV展开
5. 烘焙高模到低模
```

## 第八步：重拓扑（Retopology）

**工时：** 2-4天
**工具：** TopoGun / Maya Quad Draw / Blender / Quad Remesher

```
这是把高模"翻译"成低模的步骤。游戏引擎跑的是低模。

1. 身体重拓扑：目标8000-15000面
   - 面部必须有正确的环形面流(眼/口/鼻)
   - 关节处3条环形边(变形缓冲)
2. 服装重拓扑：目标3000-8000面
3. 装备重拓扑：目标每件500-3000面
4. 头发面片：目标2000-5000面

总计：一个AAA角色约20000-40000三角面(LOD0)
```

## 第九步：UV展开

**工时：** 1-2天
**工具：** RizomUV / Blender UV Editor

```
UV布局原则：
1. 身体用2个UV象限：
   - U1M1(0-1, 0-1)：头部(最大面积) + 上肢
   - U1M2(0-1, 1-2)：下肢 + 脚
2. 服装用1个UV象限：
   - U1M3(0-1, 2-3)：全部服装
3. 装备用1个UV象限：
   - U1M4(0-1, 3-4)：全部装备
4. 所有UV岛间距≥4像素(防止烘焙溢出)
```

## 第十步：贴图烘焙

**工时：** 半天（技术操作）+ 可能的1-2天（调整修复）
**工具：** Substance Painter / Marmoset Toolbag / Blender Cycles

```
从高模烘焙到低模的贴图列表：

1. Normal Map（法线贴图）：高模的所有细节→RGB像素
2. Ambient Occlusion（环境光遮蔽）：角落的阴影信息
3. Curvature（曲率）：凸=白，凹=黑——用于自动生成边缘磨损
4. Thickness（厚度）：薄=白，厚=黑——用于SSS效果
5. Position Map（位置渐变）：从上到下渐变——用于添加灰尘渐变
6. World Space Normal：世界空间的法线方向
7. ID Map（材质ID）：不同颜色标记不同材质区域——用于Substance Painter中快速选遮罩
```

## 第十一步：PBR贴图制作

**工时：** 3-7天
**工具：** Substance Painter / Mari / Blender Texture Paint

```
Substance Painter标准图层结构(从底到顶)：

底层层级：
1. Base Material（基础材质，如"人皮肤"、"粗棉布"、"旧铁"）
2. Color Variation（颜色微变化层——用Mask+Noise让颜色不太均匀）
3. Roughness Variation（粗糙度微变化层）

中层层级：
4. Dirt/Dust（灰尘积累——用Position Map确定灰尘从上到下渐增）
5. Edge Wear（边缘磨损——用Curvature Map自动生成）
6. 特定污渍（角色的职业痕迹，如草药学者的手指被灵植染色）

顶层层级：
7. 强调细节（某个自定义区域的颜色加强）
8. 特效层（灵焰发光区域用Emissive通道）

导出为Unity URP Template：
- BaseColor.png (RGB+sRGB)
- Normal.png (RGBA, DX11格式Normal)
- MaskMap.png (R=Metallic, G=AmbientOcclusion, B=不用的空通道, A=Smoothness)
- Emissive.png (RGB)
```

## 第十二步：头发/毛发

**工时：** 2-4天
**工具：** Blender Hair System / XGen(Maya) / FiberMesh(ZBrush)

```
方法A：面片头发（Game-ready, 推荐）
1. 在Blender中创建发片面：
   - 头冠：3-5个大面片（遮住头顶）
   - 两侧：2-3个中面片（鬓发）
   - 刘海：4-6个小面片（随意散落）
2. 给面片赋予"头发"材质
3. 面片上的发丝纹理来自贴图（不是每根独立建模）

方法B：粒子头发（Blender Hair System，可选高清截图用）
1. Particle System → Hair
2. 用Comb工具梳理
3. Children设置≈50-100根子发
4. 渲染为发丝截图 → PS合成 → 作为发片面片的贴图

头发贴图（自己做或买）：
- 需要4张贴图：BaseColor（发束颜色）/ Normal（发丝方向）/ Alpha（透明通道）/ Roughness
```

## 第十三步：骨骼绑定（Rigging + Skinning）

**工时：** 1-3天
**工具：** Maya / Blender / Mixamo

```
身体绑定：
1. Mixamo自动绑定（最快，如果需要面部则不行）
2. 或Blender Rigify手动绑定：
   - 添加Human Meta-Rig
   - 对齐骨骼到角色关节位置
   - Generate Rig
   - 自动权重绑定

面部绑定（如果需要表情）：
1. 创建面部骨骼：
   - 下颌骨1根（张嘴）
   - 上唇2根
   - 下唇1根
   - 左右嘴角各1根
   - 左右眉毛各2根
   - 左右眼睑各1根
2. Weight Paint调整每根骨骼的影响范围

蒙皮(Skinning)检查清单：
- 肩膀旋转90°→腋下不过度拉伸
- 肘部弯曲→肱二头肌不过度压扁
- 膝盖弯曲→膝后部不过度拉伸
- 手指握拳→指关节自然膨出
```

## 第十四步：面部表情（Blend Shapes）

**工时：** 2-3天
**工具：** Blender Shape Keys / Maya Blend Shapes

```
基本Blend Shapes（52个FACS标准表情单元的最小子集）：

嘴部(8个):
- JawOpen（张嘴）
- LipsFunnel（嘟嘴）
- LipsPucker（撇嘴）
- MouthSmile_L / MouthSmile_R（微笑）
- MouthFrown_L / MouthFrown_R（沮丧）
- MouthStretch_L / MouthStretch_R（嘴角拉伸）

眼部(6个):
- EyeBlink_L / EyeBlink_R（眨眼）
- EyeSquint_L / EyeSquint_R（眯眼）
- EyeWide_L / EyeWide_R（瞪眼）

眉毛(8个):
- BrowDown_L / BrowDown_R（皱眉）
- BrowRaise_L / BrowRaise_R（扬眉）
- BrowFurrow_L / BrowFurrow_R（眉间紧缩）
- BrowOuterUp_L / BrowOuterUp_R（八字眉外端上扬）
```

## 第十五步：LOD生成

**工时：** 0.5天
**工具：** Simplygon / Unity AutoLOD / Blender手动

```
LOD层级（PC端）：
- LOD0: 25000面 — 0-10米距离
- LOD1: 12000面 — 10-25米（去掉手指骨骼/Blend Shapes）
- LOD2: 5000面 — 25-50米（简化服装/装备/头发）
- LOD3: 2000面 — 50米+
- LOD4: 500面 — 极远(Impostor贴片)

移动端：
- LOD0: 8000面
- LOD1: 4000面
- LOD2: 1500面
- LOD3: 300面(Impostor)
```

## 第十六步：Unity最终集成

**工时：** 1-2天

```
1. 全部FBX+贴图导入Unity
2. 设置Material(URP Lit或HDRP Lit)
3. 创建Prefab → 添加脚本组件
4. 配置Animator Controller
5. LOD Group组件：
   - 选中Prefab → Add Component → LOD Group
   - 拖入LOD1/LOD2/LOD3的Mesh
6. 测试：
   - 所有动画是否正确过渡
   - 材质在游戏光照下是否正常
   - 占用的Draw Call是否可接受(1个角色≈3-5个Draw Call)
```

## 第十七步：光照与后期展示

**工时：** 0.5天

```
角色展示灯光方案（三点布光法）：
- Key Light（主光）：Directional Light，暖色温(~4500K)，角度约30°侧上方
- Fill Light（补光）：Point Light，冷色温(~6500K)，填充暗部，强度约主光的40%
- Rim Light（轮廓光）：Spot Light，纯白或微蓝(~7000K)，从后方侧面打亮角色轮廓

帷幕之地特殊光源：
- 角色胸口的灵焰作为第四光源（Point Light，淡金色，范围小但近处强度高）
- 血月环境光使用Volume中的Procedural Sky + 暗红调的Ambient Light
```

## 第十八步：优化与性能

**工时：** 1-2天

```
优化清单：
1. 贴图合并(Texture Atlas)：多个角色的共用贴图(如皮肤共用一张)合并
2. Mesh合并：静态不动的装备可以合并Mesh减少Draw Call
3. Shader优化：不使用Parallax/Tessellation等昂贵功能
4. 骨骼数量：≤80根（Unity Quality Settings可限制）
5. Blend Shape数量：≤15个（超出影响GPU性能）
6. 反射探针(Reflection Probe)：在聚落中放置，让金属装备获得正确反射
```

---

# 第三部分：你当前的最短路径

基于你已有的资产，**从现在到"角色在Unity场景中跑起来"的最短路径**：

```
Day 1-2: Blender雕刻精修芙蕾雅(作为第一个测试角色)
         - Remesh → Clay Strips大块 → Smooth → Crease细节
         - 按角色原画需求规格书中的描述定做外观

Day 3:   重拓扑+UV展开
         - 安装Quad Remesher → 自动生成15000面低模
         - 标记Seam → Unwrap → 优化UV布局

Day 4:   烘焙+Substance Painter 30天试用
         - Blender中烘焙Normal/AO/Curvature
         - Substance Painter中分层绘制贴图
         - 导出Unity URP贴图包

Day 5:   Mixamo绑骨+下载动画 → Blender导出FBX
         - mixamo.com → Upload → Auto-Rig → Download Walking/Idle/Run

Day 6:   Unity导入+材质+Prefab+Animator
         - 拖FBX进Unity → 设置Humanoid Rig → 创建Material
         - 配置Animator Controller → 创建Prefab → 加PlayerController3D

Day 7:   场景中测试
         - 将Prefab拖入暮色聚落场景 → Play → WASD移动
         - 调整光照 → 调整碰撞体 → 迭代优化

后续:    重复Day 1-7处理其余14个角色
         从第二个角色起每个约2-3天（经验增加了）
```

**总工时估算：**
- 第一个角色（学习管线）：7天
- 后续14个角色：3天 × 14 = 42天
- 场景细化+灯光+优化：10天
- **合计约60天（2个月）达到15个可玩角色的完整3D版本**

---

> 本教程配套文件：
> - `docs/原画需求文档.pdf` — 15个魂印者+8个职业的外观描述
> - `blender/generate_characters.py` — 自动生成基础FBX
> - `blender/setup_pbr_texturing.py` — PBR贴图绘制环境
> - `blender/analyze_model.py` — 模型面数/骨骼/贴图分析脚本
