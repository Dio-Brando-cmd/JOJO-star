"""
============================================================
 狼人杀 3D 地形场景生成器 — 兼容 Blender 4.0 ~ 5.x LTS
 在 Blender Scripting 工作区运行此脚本 (Alt+P)
============================================================
"""

import bpy
import math
import random
import os

# ====== 版本 ======
bv = tuple(bpy.app.version)
print(f"Blender {'.'.join(map(str, bv))}")

# ====== 兼容层 ======

def safe_delete():
    try:
        bpy.ops.object.delete(use_confirm=False)
    except TypeError:
        bpy.ops.object.delete()

def safe_remove_mesh(block):
    try: bpy.data.meshes.remove(block)
    except Exception: pass

def safe_remove_mat(block):
    try: bpy.data.materials.remove(block)
    except Exception: pass

def safe_export_gltf(filepath, use_selection=True):
    kwargs = dict(filepath=filepath, use_selection=use_selection)
    for fmt_key in ('export_format', 'export_format_option'):
        try:
            bpy.ops.export_scene.gltf(**kwargs, **{fmt_key: 'GLB'})
            return
        except (TypeError, AttributeError):
            pass
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except Exception as e:
        print(f"     ⚠️  glTF 导出失败: {e}")

def mat_socket(bsdf, name, value):
    try:
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = value
    except Exception:
        pass

# ====== 配置 ======
OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "werewolf_models"
)

# ====== 工具函数 ======

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    safe_delete()
    for m in list(bpy.data.meshes): safe_remove_mesh(m)
    for m in list(bpy.data.materials): safe_remove_mat(m)


def mat(name, r, g, b, a=1.0, rough=0.8):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    mat_socket(bsdf, 'Base Color', (r, g, b, a))
    mat_socket(bsdf, 'Roughness', rough)
    return m


def plane(name, x, y, z, sx, sy, material):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, 1)
    obj.data.materials.append(material)
    return obj


def cube(name, x, y, z, sx, sy, sz, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    obj.data.materials.append(material)
    return obj


def cylinder(name, x, y, z, r, depth, material):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def sphere(name, x, y, z, r, material):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def cone(name, x, y, z, r1, r2, depth, material):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    return obj


# ====== 场景生成 ======

def generate_village():
    print("  生成村庄场景...")
    ground_mat = mat("ground_village", 0.15, 0.12, 0.08, rough=0.95)
    plane("ground", 0, 0, 0, 20, 20, ground_mat)

    house_mat = mat("house", 0.12, 0.08, 0.06, rough=0.9)
    roof_mat = mat("roof", 0.08, 0.04, 0.02, rough=0.85)

    random.seed(42)
    for i in range(5):
        angle = (i / 5) * math.pi * 2 + random.uniform(-0.2, 0.2)
        dist = 5 + random.uniform(1, 5)
        cx = math.cos(angle) * dist
        cy = math.sin(angle) * dist
        hw, hd, hh = 1.2 + random.random() * 0.8, 0.8 + random.random() * 0.6, 2.0 + random.random() * 1.5
        cube(f"house_{i}_body", cx, cy, hh/2, hw, hd, hh/2, house_mat)
        cone(f"house_{i}_roof", cx, cy, hh + 0.3, hw * 1.1, 0.05, 1.0, roof_mat)
        door_mat = mat(f"door_{i}", 0.3, 0.2, 0.1, rough=0.7)
        cube(f"house_{i}_door", cx, cy + hd * 0.9, 1.0, 0.3, 0.05, 1.0, door_mat)
        for wx in (-0.5, 0.5):
            cube(f"house_{i}_win_{wx}", cx + wx, cy, hh * 0.6, 0.25, 0.02, 0.3,
                 mat(f"win_{i}_{wx}", 0.8, 0.6, 0.2, rough=0.2))

    path_mat = mat("path", 0.18, 0.15, 0.12, rough=0.9)
    plane("path_ns", 0, 0, 0.01, 1.5, 18, path_mat)
    plane("path_ew", 0, 0, 0.01, 18, 1.5, path_mat)

    lantern_mat = mat("lantern", 0.9, 0.4, 0.1, rough=0.2)
    for i in range(4):
        a = i * math.pi / 2 + 0.3
        lx, ly = math.cos(a) * 4, math.sin(a) * 4
        cylinder(f"lantern_pole_{i}", lx, ly, 0, 0.06, 2.5, mat("pole", 0.2, 0.15, 0.1))
        sphere(f"lantern_{i}", lx, ly, 2.5, 0.2, lantern_mat)

    stone_mat = mat("stone", 0.25, 0.22, 0.2, rough=0.85)
    cylinder("well_outer", 0, 0, 0.4, 0.7, 0.8, stone_mat)
    cylinder("well_inner", 0, 0, 0.45, 0.55, 0.7, mat("well_dark", 0.05, 0.04, 0.03))

    tree_mat = mat("dead_tree", 0.1, 0.08, 0.05, rough=0.95)
    for i in range(3):
        tx = -7 + i * 7; ty = 6 - abs(i - 1) * 3
        cylinder(f"tree_trunk_{i}", tx, ty, 1.2, 0.15, 2.4, tree_mat)
        for j in range(3):
            ba = j * 2.1 + i
            cylinder(f"branch_{i}_{j}", tx + math.cos(ba) * 0.4, ty, 1.5 + j * 0.6, 0.03, 0.8, tree_mat)


def generate_forest():
    print("  生成森林场景...")
    plane("ground", 0, 0, 0, 25, 25, mat("ground_forest", 0.06, 0.08, 0.04, rough=0.95))

    random.seed(123)
    for i in range(30):
        tx = random.uniform(-10, 10); ty = random.uniform(-10, 10)
        th = random.uniform(2.5, 6.0); tr = random.uniform(0.1, 0.25)
        t_mat = mat(f"tree_{i}", 0.04 + random.random() * 0.04, 0.06 + random.random() * 0.06, 0.02 + random.random() * 0.03)
        cylinder(f"tree_{i}_trunk", tx, ty, th/2, tr, th, t_mat)
        for j in range(3):
            cr = (0.6 + j * 0.5) * tr * 4
            sphere(f"leaf_{i}_{j}", tx, ty, th + j * 0.4, cr,
                   mat(f"leaf_{i}_{j}", 0.02 + j * 0.02, 0.08 + j * 0.03, 0.03, rough=0.7))

    for i in range(15):
        fx = random.uniform(-8, 8); fy = random.uniform(-8, 8)
        fz = random.uniform(0.5, 2.5); fr = random.uniform(0.8, 2.5)
        sphere(f"fog_{i}", fx, fy, fz, fr, mat(f"fog_{i}", 0.7, 0.72, 0.68, 0.08, rough=1.0))

    sphere("moon", 0, -12, 8, 1.2, mat("moon", 0.9, 0.85, 0.7, 1.0, rough=0.1))
    plane("path", 0, 0, 0.01, 1.2, 22, mat("forest_path", 0.1, 0.09, 0.06, rough=0.9))


def generate_graveyard():
    print("  生成墓地场景...")
    plane("ground", 0, 0, 0, 18, 18, mat("ground_grave", 0.08, 0.08, 0.07, rough=0.95))

    random.seed(777)
    for i in range(12):
        angle = random.uniform(0, math.pi * 2); dist = random.uniform(2, 8)
        gx = math.cos(angle) * dist; gy = math.sin(angle) * dist
        s_mat = mat(f"tombstone_{i}", 0.2 + random.random() * 0.1, 0.2 + random.random() * 0.05, 0.18 + random.random() * 0.05)
        cube(f"tomb_{i}", gx, gy, 0.35, 0.25, 0.08, 0.7, s_mat)
        sphere(f"tomb_top_{i}", gx, gy, 0.75, 0.13, s_mat)
        if random.random() > 0.4:
            cylinder(f"cross_v_{i}", gx, gy, 0.7, 0.02, 0.5, s_mat)
            cylinder(f"cross_h_{i}", gx, gy, 0.85, 0.02, 0.3, s_mat)

    church_mat = mat("church", 0.1, 0.08, 0.08, rough=0.85)
    cube("church_body", 0, 0, 2.5, 2.5, 4.0, 2.5, church_mat)
    cone("church_spire", 0, 0, 5.5, 2.5, 0.02, 3.5, mat("church_roof", 0.06, 0.04, 0.04, rough=0.8))
    sphere("rose", 0, 4.0, 3.5, 0.6, mat("rose_window", 0.8, 0.2, 0.2, rough=0.1))
    cube("door", 0, 3.9, 1.5, 0.8, 0.05, 3.0, mat("church_door", 0.15, 0.1, 0.05, rough=0.7))

    fence_mat = mat("fence", 0.15, 0.13, 0.12, rough=0.8)
    for i in range(36):
        a = i * math.pi * 2 / 36
        cylinder(f"fence_{i}", math.cos(a) * 7.5, math.sin(a) * 7.5, 0.4, 0.03, 0.8, fence_mat)

    tree_mat = mat("grave_tree", 0.06, 0.04, 0.03, rough=0.95)
    for i, (tx, ty) in enumerate([(-4, -4), (4, -3), (-3, 5)]):
        cylinder(f"dead_tree_{i}", tx, ty, 1.0, 0.12, 2.0, tree_mat)


def generate_full_map():
    print("  生成完整游戏地图...")
    cylinder("map_base", 0, 0, -0.05, 15, 0.1, mat("map_ground", 0.13, 0.11, 0.08, rough=0.95))
    plane("zone_village", 0, 4, 0.02, 7, 8, mat("zone_village", 0.14, 0.11, 0.08, rough=0.9))
    plane("zone_forest", -4, -2, 0.02, 8, 7, mat("zone_forest", 0.06, 0.08, 0.04, rough=0.9))
    plane("zone_grave", 4, -2, 0.02, 7, 8, mat("zone_grave", 0.09, 0.08, 0.07, rough=0.9))

    random.seed(999)
    house_mat = mat("map_house", 0.13, 0.09, 0.07, rough=0.9)
    roof_mat = mat("map_roof", 0.08, 0.05, 0.03, rough=0.85)
    for i in range(3):
        hx = -3 + i * 3; hy = 6 + random.uniform(-1, 1)
        cube(f"v_house_{i}", hx, hy, 1.2, 1.0, 0.8, 1.2, house_mat)
        cone(f"v_roof_{i}", hx, hy, 2.5, 1.1, 0.03, 0.8, roof_mat)

    lantern_mat = mat("map_lantern", 0.9, 0.45, 0.1, rough=0.2)
    for i in range(3):
        lx = -3 + i * 3
        cylinder(f"map_pole_{i}", lx, 2, 0, 0.04, 1.8, mat("map_pole_mat", 0.18, 0.14, 0.1))
        sphere(f"map_lantern_{i}", lx, 2, 1.8, 0.15, lantern_mat)

    for i in range(20):
        tx = -8 + random.uniform(0, 6); ty = -6 + random.uniform(0, 6)
        if abs(tx) > 6 or abs(ty) > 6: continue
        th = random.uniform(1.5, 3.5); tr = random.uniform(0.06, 0.15)
        t_mat = mat(f"map_tree_{i}", 0.04, 0.06, 0.03)
        cylinder(f"map_tree_{i}", tx, ty, th/2, tr, th, t_mat)
        for j in range(2):
            sphere(f"map_leaf_{i}_{j}", tx, ty, th + j * 0.3, tr * 3,
                   mat(f"map_leaf_{i}_{j}", 0.03, 0.07 + j * 0.02, 0.03))

    for i in range(8):
        gx = 4 + random.uniform(-3, 3); gy = -4 + random.uniform(-3, 3)
        s_mat = mat(f"map_tomb_{i}", 0.18, 0.17, 0.15)
        cube(f"map_tomb_{i}", gx, gy, 0.25, 0.18, 0.06, 0.5, s_mat)
        sphere(f"map_tomb_top_{i}", gx, gy, 0.55, 0.09, s_mat)

    cylinder("center_plaza", 0, 0, 0.05, 2.0, 0.08, mat("center", 0.2, 0.18, 0.15, rough=0.8))


# ====== 主入口 ======

def main():
    print("=" * 60)
    print("  🏞️ 狼人杀 3D 地形生成器")
    print(f"  兼容 Blender 4.0 ~ 5.x")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
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
        bpy.ops.object.select_all(action='SELECT')
        glb = os.path.join(OUTPUT_DIR, f"werewolf_{scene_name}.glb")
        safe_export_gltf(glb)
        print(f"     → {glb}\n")

    print("=" * 60)
    print(f"  ✅ 完成！所有场景已导出到: {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
