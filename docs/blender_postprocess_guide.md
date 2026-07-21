# Blender FBX 导入 + 精修完整流程

---

## 第1步：导入 FBX

```
Blender → File → Import → FBX (.fbx)
→ 选你下载的 fbx 文件
→ 右侧 Import FBX 面板检查：
   Scale: 1.0
   Forward: -Z Forward
   Up: Y Up
→ 点 Import
```

导入后如果模型**是灰色/没有颜色**，正常——需要切换到材质预览模式。

---

## 第2步：看到颜色

Blender 右上角有 4 个球体图标：

```
⊙ Wireframe    — 线框（看不到颜色）
◉ Solid        — 纯色（默认，看不到贴图）
◉ Material Preview — ⭐ 材质预览（看得到颜色和贴图）
◉ Rendered     — 渲染（最真实，但慢）
```

**点第三个球（Material Preview）就能看到 Meshy 生成的 PBR 贴图了。**

如果还是灰的：
```
右上角 Shading 区域 → 点 ▼ 下拉 → 选 MatCap 以外的选项
或者：右侧面板 → Material Properties（红球图标）→ 检查材质是否加载
```

---

## 第3步：当前面数够不够？

你的模型：**21,654 三角面 / 10,884 顶点**

| 用途 | 推荐面数 | 你当前 |
|------|---------|--------|
| 手机游戏 | 5K-15K | ✅ 够 |
| PC 独立游戏 | 15K-35K | ⚠️ 偏少 |
| PC AAA | 50K-100K | ❌ 不够 |
| 过场动画特写 | 100K+ | ❌ 不够 |

**21K 面在 PC 上跑没问题，但不够精细。** 增加面数的方法：

---

## 第4步：增加面数 + 平滑

### 方法 A：Subdivision Surface（推荐，不破坏拓扑）

```
1. 选中角色模型（右键点击）
2. 右侧扳手图标（Modifiers）→ Add Modifier → Subdivision Surface
3. Levels: 2（Viewport）/ 3（Render）
4. 勾选 ☑ Catmull-Clark
5. 面数变成原来的 4 倍 → ~86K 三角面
```

### 方法 B：在 Meshy 里重新生成

下次生成时选 **High Poly** 模式，直接出高面模型。

---

## 第5步：雕刻面部

```
1. 选中角色
2. 顶部菜单 → Sculpting（切换到雕刻工作区）
3. 左侧出现雕刻笔刷：
   - Grab (G)      → 拉扯大型（调头型、下巴、鼻子）
   - Clay Strips   → 堆肌肉（颧骨、眉弓）
   - Smooth (Shift)→ 平滑过渡
   - Draw          → 画细节
   - Crease        → 刻皱纹、唇线
4. 按住 F 拖动调笔刷大小
5. Shift+F 调笔刷力度
```

**面部雕刻重点区域：**
- 眉弓 → Clay Strips 堆出凸起
- 颧骨 → Grab 往外拉
- 下颌线 → Grab 拉出棱角
- 嘴唇 → Crease 刻出唇线
- 鼻翼 → Grab 往两侧拉
- 眼窝 → Draw 往里推（按住 Ctrl）

---

## 第6步：模型缩放到真实身高

Meshy 出来的模型比例不一定是 1:1 米。需要校准：

```
1. 在 Blender 中：Add → Mesh → Cube
2. 右侧面板 Item → Dimensions → 设为 1m × 1m × 1m
3. 把立方体放在角色旁边对比
4. 选中角色 → S 键缩放 → 拖到和立方体比例正确
   （例如角色应该大约 1.7-1.9 个立方体高）
5. 缩放完成后：Ctrl+A → Scale（应用缩放）
```

---

## 第7步：减面优化（导出到 Unity 前）

如果面数太高（>50K），需要减面：

```
1. 选中角色
2. Modifiers → Add Modifier → Decimate
3. Ratio: 0.5（减到一半面数）
4. 观察细节是否丢失
5. 满意后 Apply
```

---

## 第8步：导出到 Unity

```
File → Export → FBX (.fbx)

重要设置：
  Scale: 1.0
  Forward: -Z Forward
  Up: Y Up
  ☑ Selected Objects（只导出选中的）
  ☑ Apply Modifiers
  ☑ Mesh → Apply Modifiers
  Path Mode: Copy
  ☑ Embed Textures
```

---

## 一键自动化脚本

在 Blender 中运行这个脚本，自动完成导入后的清理：

Blender → Scripting → 新建 → 粘贴下面代码 → Run Script：

```python
import bpy

# 1. 选中导入的角色（假设场景中只有一个mesh）
char = None
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        char = obj
        break

if not char:
    print("没找到网格对象！")
else:
    print(f"处理: {char.name}")
    print(f"  原始面数: {len(char.data.polygons)}")

    # 2. 添加 Subdivision Surface
    bpy.context.view_layer.objects.active = char
    bpy.ops.object.modifier_add(type='SUBSURF')
    char.modifiers[-1].levels = 2
    char.modifiers[-1].render_levels = 3
    print("  ✅ 已加 Subdivision Surface (×4面数)")

    # 3. 添加 Decimate（可选，注释掉下面两行以启用）
    # bpy.ops.object.modifier_add(type='DECIMATE')
    # char.modifiers[-1].ratio = 0.7

    # 4. 切换到 Material Preview
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces[0].shading.type = 'MATERIAL'
            print("  ✅ 已切换到材质预览")
            break

    print("  完成！现在去 Sculpting 工作区雕刻面部")
```

---

## 快速总结

| 步骤 | 操作 | 快捷键/位置 |
|------|------|------------|
| 导入 FBX | File → Import → FBX | - |
| 看颜色 | 右上角第三个球 | 鼠标点 |
| 加面数 | Modifiers → Subdivision Surface Level 2 | - |
| 雕面部 | 顶栏 → Sculpting | - |
| 调笔刷 | F = 大小, Shift+F = 力度 | - |
| 缩放 | S 键 | - |
| 导出 | File → Export → FBX | - |
| 绑骨 | 打开 mixamo.com 上传 | 免费 |
