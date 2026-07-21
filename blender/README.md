# 🐺 狼人杀 3D 建模脚本

在 Blender 中运行这些 Python 脚本，自动生成游戏所需的 3D 角色模型和地形场景。

## 环境要求

- **Blender 4.0+** (下载: https://www.blender.org/download/)
- 无需额外插件，使用 Blender 内置 `bpy` API

## 快速开始

### 1. 生成角色模型

```
1. 打开 Blender
2. 顶部菜单 → Scripting (脚本工作区)
3. 点击 Open → 选择 blender/generate_characters.py
4. 点击 Run Script (或按 Alt+P)
```

生成的 8 个角色：
| 角色 | 文件名 | 特色 |
|------|--------|------|
| 狼人 | `werewolf_werewolf.glb` | 暗红狼头 + 发光红眼 |
| 种狼 | `werewolf_alpha_wolf.glb` | 金冠狼形 |
| 预言家 | `werewolf_seer.glb` | 紫袍 + 水晶球 |
| 毒巫 | `werewolf_poison_witch.glb` | 绿帽 + 毒药瓶 |
| 药巫 | `werewolf_heal_witch.glb` | 青帽 + 治愈药瓶 |
| 村民 | `werewolf_villager.glb` | 斗笠 + 中式村民 |
| 守卫 | `werewolf_guard.glb` | 盔甲 + 盾牌 |
| 猎人 | `werewolf_hunter.glb` | 宽帽 + 猎枪 |

### 2. 生成地形场景

```
同样方式运行 blender/generate_terrain.py
```

生成的 4 个场景：
| 场景 | 文件名 | 描述 |
|------|--------|------|
| 村庄 | `werewolf_village.glb` | 5栋房屋 + 灯笼 + 水井 + 枯树 |
| 森林 | `werewolf_forest.glb` | 30棵树 + 迷雾 + 月光 |
| 墓地 | `werewolf_graveyard.glb` | 12座墓碑 + 教堂 + 铁栅栏 |
| 完整地图 | `werewolf_full_map.glb` | 三大区域合一的圆形游戏地图 |

## 导出格式

- **glTF (.glb)** — 推荐格式，Unity / Web / Godot 原生支持
- **FBX (.fbx)** — Unity / Unreal 通用格式

所有文件导出到 `~/werewolf_models/` 目录。

## 导入到 Unity

```
1. 将 .glb 文件拖入 Unity Assets 窗口
2. Unity 自动导入为 Prefab
3. 拖入场景即可使用
```

## 自定义

- 修改 `ROLE_COLORS` 字典调整角色颜色
- 修改房屋数量/树木密度调整场景复杂度
- 修改 `OUTPUT_DIR` 更改导出路径

## 后续可扩展

- 为每个角色添加骨骼动画 (rigging)
- 生成 LOD (Level of Detail) 多级精度模型
- 添加材质贴图 (PBR textures)
- 生成室内场景 (酒馆/教堂内部)
