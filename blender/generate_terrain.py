"""
============================================================
 狼人杀 3D 地形场景生成器 — 在 Blender 中运行此脚本
 生成: 村庄 / 森林 / 墓地 / 完整游戏地图

 使用方法:
   1. 打开 Blender → Scripting 工作区
   2. 打开此文件 → Run Script (Alt+P)
============================================================
"""

import bpy
import math
import random
import os

# ====== Blender 版本检查 ======
blender_version = tuple(bpy.app.version)
print(f"Blender 版本: {'.'.join(map(str, blender_version))}")
if blender_version < (4, 0, 0):
    print("⚠️  警告: 此脚本针对 Blender 4.0+ 设计，旧版本可能无法正常运行")
print(f"脚本兼容: 4.0 ~ 5.x\n")

OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "werewolf_models"
)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ====== 工具函数 ======

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_confirm=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)


def mat(name, r, g, b, a=1.0, rough=0.8):
    """创建材质 — 兼容 Blender 4.x 和 5.x"""
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    try:
        bsdf.inputs['Base Color'].default_value = (r, g, b, a)
    except KeyError:
        bsdf.inputs['Base Color'].default_value = (r, g, b, 1.0)
    try:
        bsdf.inputs['Roughness'].default_value = rough
    except KeyError:
        pass
    return m


def plane(name, x, y, z, sx, sy, material):
    """创建平面"""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, 1)
    obj.data.materials.append(material)
    return obj


def cube(name, x, y, z, sx, sy, sz, material):
    """创建立方体"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    obj.data.materials.append(material)
    return obj


def cylinder(name, x, y, z, r, depth, material):
    """创建圆柱"""
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def sphere(name, x, y, z, r, material):
    """创建球体"""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def cone(name, x, y, z, r1, r2, depth, material):
    """创建锥体"""
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


# ====== 场景生成 ======

def generate_village():
    """生成村庄场景 — 中式+西式融合恐怖村庄"""
    print("  生成村庄场景...")

    # 地面 — 暗色泥土
    ground_mat = mat("ground_village", 0.15, 0.12, 0.08, rough=0.95)
    plane("ground", 0, 0, 0, 20, 20, ground_mat)

    # 房屋 — 3-5 栋，随机分布
    house_mat = mat("house", 0.12, 0.08, 0.06, rough=0.9)
    roof_mat = mat("roof", 0.08, 0.04, 0.02, rough=0.85)

    random.seed(42)
    for i in range(5):
        angle = (i / 5) * math.pi * 2 + random.uniform(-0.2, 0.2)
        dist = 5 + random.uniform(1, 5)
        cx = math.cos(angle) * dist
        cy = math.sin(angle) * dist

        # 屋体
        hw, hd, hh = 1.2 + random.random() * 0.8, 0.8 + random.random() * 0.6, 2.0 + random.random() * 1.5
        cube(f"house_{i}_body", cx, cy, hh/2, hw, hd, hh/2, house_mat)

        # 屋顶
        cone(f"house_{i}_roof", cx, cy, hh + 0.3, hw * 1.1, 0.05, 1.0, roof_mat)

        # 门
        door_mat = mat(f"door_{i}", 0.3, 0.2, 0.1, rough=0.7)
        cube(f"house_{i}_door", cx, cy + hd * 0.9, 1.0, 0.3, 0.05, 1.0, door_mat)

        # 窗户 — 暖黄色发光
        for wx in [-0.5, 0.5]:
            win_mat = mat(f"win_{i}_{wx}", 0.8, 0.6, 0.2, rough=0.2)
            cube(f"house_{i}_win_{wx}", cx + wx, cy, hh * 0.6, 0.25, 0.02, 0.3, win_mat)

    # 路 — 中央十字
    path_mat = mat("path", 0.18, 0.15, 0.12, rough=0.9)
    plane("path_ns", 0, 0, 0.01, 1.5, 18, path_mat)
    plane("path_ew", 0, 0, 0.01, 18, 1.5, path_mat)

    # 中式灯笼柱
    lantern_mat = mat("lantern", 0.9, 0.4, 0.1, rough=0.2)
    for i in range(4):
        a = i * math.pi / 2 + 0.3
        lx, ly = math.cos(a) * 4, math.sin(a) * 4
        cylinder(f"lantern_pole_{i}", lx, ly, 0, 0.06, 2.5, mat("pole", 0.2, 0.15, 0.1))
        sphere(f"lantern_{i}", lx, ly, 2.5, 0.2, lantern_mat)

    # 中心水井
    stone_mat = mat("stone", 0.25, 0.22, 0.2, rough=0.85)
    cylinder("well_outer", 0, 0, 0.4, 0.7, 0.8, stone_mat)
    cylinder("well_inner", 0, 0, 0.45, 0.55, 0.7, mat("well_dark", 0.05, 0.04, 0.03))

    # 枯树
    tree_mat = mat("dead_tree", 0.1, 0.08, 0.05, rough=0.95)
    for i in range(3):
        tx = -7 + i * 7
        ty = 6 - abs(i - 1) * 3
        cylinder(f"tree_trunk_{i}", tx, ty, 1.2, 0.15, 2.4, tree_mat)
        # 枯枝
        for j in range(3):
            branch_angle = j * 2.1 + i
            bx = tx + math.cos(branch_angle) * 0.4
            bz = 1.5 + j * 0.6
            cylinder(f"branch_{i}_{j}", bx, ty, bz, 0.03, 0.8, tree_mat)


def generate_forest():
    """生成森林场景 — 神秘幽暗"""
    print("  生成森林场景...")

    ground_mat = mat("ground_forest", 0.06, 0.08, 0.04, rough=0.95)
    plane("ground", 0, 0, 0, 25, 25, ground_mat)

    random.seed(123)
    # 树木群
    for i in range(30):
        tx = random.uniform(-10, 10)
        ty = random.uniform(-10, 10)
        th = random.uniform(2.5, 6.0)
        tr = random.uniform(0.1, 0.25)

        tree_mat = mat(f"tree_{i}", 0.04 + random.random() * 0.04, 0.06 + random.random() * 0.06, 0.02 + random.random() * 0.03)
        cylinder(f"tree_{i}_trunk", tx, ty, th/2, tr, th, tree_mat)

        # 树冠 — 多层叠加
        for j in range(3):
            leaf_mat = mat(f"leaf_{i}_{j}", 0.02 + j * 0.02, 0.08 + j * 0.03, 0.03, rough=0.7)
            cr = (0.6 + j * 0.5) * tr * 4
            cz = th + j * 0.4
            sphere(f"leaf_{i}_{j}", tx, ty, cz, cr, leaf_mat)

    # 迷雾粒子 — 半透明球体
    for i in range(15):
        fx = random.uniform(-8, 8)
        fy = random.uniform(-8, 8)
        fz = random.uniform(0.5, 2.5)
        fr = random.uniform(0.8, 2.5)
        fog_mat = mat(f"fog_{i}", 0.7, 0.72, 0.68, 0.08, rough=1.0)
        sphere(f"fog_{i}", fx, fy, fz, fr, fog_mat)

    # 月光 — 一个大的发光球在天空
    moon_mat = mat("moon", 0.9, 0.85, 0.7, 1.0, rough=0.1)
    sphere("moon", 0, -12, 8, 1.2, moon_mat)

    # 路径
    path_mat = mat("forest_path", 0.1, 0.09, 0.06, rough=0.9)
    plane("path", 0, 0, 0.01, 1.2, 22, path_mat)


def generate_graveyard():
    """生成墓地和教堂场景 — 哥特恐怖"""
    print("  生成墓地场景...")

    ground_mat = mat("ground_grave", 0.08, 0.08, 0.07, rough=0.95)
    plane("ground", 0, 0, 0, 18, 18, ground_mat)

    random.seed(777)
    # 墓碑
    for i in range(12):
        angle = random.uniform(0, math.pi * 2)
        dist = random.uniform(2, 8)
        gx = math.cos(angle) * dist
        gy = math.sin(angle) * dist

        stone_mat = mat(f"tombstone_{i}", 0.2 + random.random() * 0.1, 0.2 + random.random() * 0.05, 0.18 + random.random() * 0.05)
        # 碑体
        cube(f"tomb_{i}", gx, gy, 0.35, 0.25, 0.08, 0.7, stone_mat)
        # 碑顶 — 圆弧
        sphere(f"tomb_top_{i}", gx, gy, 0.75, 0.13, stone_mat)
        # 十字架（部分墓碑）
        if random.random() > 0.4:
            cylinder(f"cross_v_{i}", gx, gy, 0.7, 0.02, 0.5, stone_mat)
            cylinder(f"cross_h_{i}", gx, gy, 0.85, 0.02, 0.3, stone_mat)

    # 中心教堂
    church_mat = mat("church", 0.1, 0.08, 0.08, rough=0.85)
    cube("church_body", 0, 0, 2.5, 2.5, 4.0, 2.5, church_mat)
    # 尖顶
    roof_mat = mat("church_roof", 0.06, 0.04, 0.04, rough=0.8)
    cone("church_spire", 0, 0, 5.5, 2.5, 0.02, 3.5, roof_mat)
    # 玫瑰窗
    rose_mat = mat("rose_window", 0.8, 0.2, 0.2, rough=0.1)
    sphere("rose", 0, 4.0, 3.5, 0.6, rose_mat)
    # 大门
    door_mat = mat("church_door", 0.15, 0.1, 0.05, rough=0.7)
    cube("door", 0, 3.9, 1.5, 0.8, 0.05, 3.0, door_mat)

    # 铁栅栏
    fence_mat = mat("fence", 0.15, 0.13, 0.12, rough=0.8)
    for i in range(36):
        a = i * math.pi * 2 / 36
        fx = math.cos(a) * 7.5
        fy = math.sin(a) * 7.5
        cylinder(f"fence_{i}", fx, fy, 0.4, 0.03, 0.8, fence_mat)

    # 枯树
    tree_mat = mat("grave_tree", 0.06, 0.04, 0.03, rough=0.95)
    for i, (tx, ty) in enumerate([(-4, -4), (4, -3), (-3, 5)]):
        cylinder(f"dead_tree_{i}", tx, ty, 1.0, 0.12, 2.0, tree_mat)


def generate_full_map():
    """生成完整游戏地图 — 村庄 + 森林 + 墓地"""
    print("  生成完整游戏地图...")

    # 地面 — 圆形大平台
    ground_mat = mat("map_ground", 0.13, 0.11, 0.08, rough=0.95)
    cylinder("map_base", 0, 0, -0.05, 15, 0.1, ground_mat)

    # 三个区域 — 用不同颜色地面区分
    # 村庄区 (北)
    village_mat = mat("zone_village", 0.14, 0.11, 0.08, rough=0.9)
    plane("zone_village", 0, 4, 0.02, 7, 8, village_mat)

    # 森林区 (西)
    forest_mat = mat("zone_forest", 0.06, 0.08, 0.04, rough=0.9)
    plane("zone_forest", -4, -2, 0.02, 8, 7, forest_mat)

    # 墓地区 (东南)
    grave_mat = mat("zone_grave", 0.09, 0.08, 0.07, rough=0.9)
    plane("zone_grave", 4, -2, 0.02, 7, 8, grave_mat)

    random.seed(999)

    # 村庄区域 — 3 栋房
    house_mat = mat("map_house", 0.13, 0.09, 0.07, rough=0.9)
    roof_mat = mat("map_roof", 0.08, 0.05, 0.03, rough=0.85)
    for i in range(3):
        hx = -3 + i * 3
        hy = 6 + random.uniform(-1, 1)
        cube(f"v_house_{i}", hx, hy, 1.2, 1.0, 0.8, 1.2, house_mat)
        cone(f"v_roof_{i}", hx, hy, 2.5, 1.1, 0.03, 0.8, roof_mat)

    # 灯笼
    lantern_mat = mat("map_lantern", 0.9, 0.45, 0.1, rough=0.2)
    for i in range(3):
        lx = -3 + i * 3
        ly = 2
        cylinder(f"map_pole_{i}", lx, ly, 0, 0.04, 1.8, mat("map_pole_mat", 0.18, 0.14, 0.1))
        sphere(f"map_lantern_{i}", lx, ly, 1.8, 0.15, lantern_mat)

    # 森林区域 — 树木
    for i in range(20):
        tx = -8 + random.uniform(0, 6)
        ty = -6 + random.uniform(0, 6)
        if abs(tx) > 6 or abs(ty) > 6:
            continue
        th = random.uniform(1.5, 3.5)
        tr = random.uniform(0.06, 0.15)
        t_mat = mat(f"map_tree_{i}", 0.04, 0.06, 0.03)
        cylinder(f"map_tree_{i}", tx, ty, th/2, tr, th, t_mat)
        for j in range(2):
            l_mat = mat(f"map_leaf_{i}_{j}", 0.03, 0.07 + j * 0.02, 0.03)
            sphere(f"map_leaf_{i}_{j}", tx, ty, th + j * 0.3, tr * 3, l_mat)

    # 墓地区 — 墓碑
    for i in range(8):
        gx = 4 + random.uniform(-3, 3)
        gy = -4 + random.uniform(-3, 3)
        s_mat = mat(f"map_tomb_{i}", 0.18, 0.17, 0.15)
        cube(f"map_tomb_{i}", gx, gy, 0.25, 0.18, 0.06, 0.5, s_mat)
        sphere(f"map_tomb_top_{i}", gx, gy, 0.55, 0.09, s_mat)

    # 中央 — 圆形广场
    center_mat = mat("center", 0.2, 0.18, 0.15, rough=0.8)
    cylinder("center_plaza", 0, 0, 0.05, 2.0, 0.08, center_mat)


# ====== 主入口 ======

def main():
    print("=" * 60)
    print("  🏞️ 狼人杀 3D 地形生成器")
    print("=" * 60)
    print(f"\n输出目录: {OUTPUT_DIR}\n")

    scenes = [
        ("village", generate_village),
        ("forest", generate_forest),
        ("graveyard", generate_graveyard),
        ("full_map", generate_full_map),
    ]

    for scene_name, generator in scenes:
        clear_scene()
        generator()

        # 全部选中导出
        bpy.ops.object.select_all(action='SELECT')
        path = os.path.join(OUTPUT_DIR, f"werewolf_{scene_name}.glb")
        bpy.ops.export_scene.gltf(
            filepath=path,
            use_selection=True,
            export_format='GLB',
        )
        print(f"     → {path}\n")

    print("=" * 60)
    print("  ✅ 完成！所有场景已导出到:")
    print(f"     {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
