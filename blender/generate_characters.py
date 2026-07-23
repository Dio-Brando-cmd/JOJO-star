"""
============================================================
 帷幕之地 3D 角色生成器 — 兼容 Blender 4.0 ~ 5.x LTS
 在 Blender Scripting 工作区运行此脚本 (Alt+P)
============================================================
"""

import bpy
import math
import os
import sys

# ====== 版本 ======
bv = tuple(bpy.app.version)
print(f"Blender {'.'.join(map(str, bv))}")

# ====== 兼容层 ======

def safe_delete():
    """安全删除 — 4.x 用 use_confirm, 5.x 不需要"""
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
    """安全导出 glTF — 兼容各版本参数差异"""
    kwargs = dict(filepath=filepath, use_selection=use_selection)
    # 尝试 export_format
    for fmt_key in ('export_format', 'export_format_option'):
        try:
            bpy.ops.export_scene.gltf(**kwargs, **{fmt_key: 'GLB'})
            return
        except (TypeError, AttributeError):
            pass
    # 最终回退 — 不带格式参数
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except Exception as e:
        print(f"     ⚠️  glTF 导出失败: {e}")

def safe_export_fbx(filepath, use_selection=True):
    try:
        bpy.ops.export_scene.fbx(filepath=filepath, use_selection=use_selection)
    except Exception as e:
        print(f"     ⚠️  FBX 导出失败: {e}")

def mat_socket(bsdf, name, value):
    """安全设置材质节点值"""
    try:
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = value
    except Exception:
        pass

# ====== 配置 ======
OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "veilland_models"
)

ROLE_COLORS = {
    'werewolf':       (0.55, 0.05, 0.05, 1.0),
    'alpha_corrupted':     (0.42, 0.02, 0.02, 1.0),
    'seer':           (0.24, 0.10, 0.36, 1.0),
    'poison_witch':   (0.10, 0.24, 0.12, 1.0),
    'heal_witch':     (0.10, 0.22, 0.18, 1.0),
    'villager':       (0.24, 0.22, 0.30, 1.0),
    'guard':          (0.10, 0.18, 0.30, 1.0),
    'hunter':         (0.30, 0.14, 0.06, 1.0),
}

ROLE_NAMES_CN = {
    'werewolf': '狼人', 'alpha_corrupted': '种狼', 'seer': '预言家',
    'poison_witch': '毒巫', 'heal_witch': '药巫', 'villager': '村民',
    'guard': '守卫', 'hunter': '猎人',
}

# ====== 核心函数 ======

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    safe_delete()
    for m in list(bpy.data.meshes): safe_remove_mesh(m)
    for m in list(bpy.data.materials): safe_remove_mat(m)


def create_material(name, color):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    bsdf = None
    for bsdf_type in ('ShaderNodeBsdfPrincipled', 'ShaderNodeBsdfPrincipledv2'):
        try:
            bsdf = tree.nodes.new(bsdf_type)
            break
        except RuntimeError:
            continue
    if bsdf is None:
        raise RuntimeError("无法创建 Principled BSDF 节点 — 不支持的 Blender 版本")
    bsdf.location = (0, 0)
    out = None
    for out_type in ('ShaderNodeOutputMaterial', 'ShaderNodeOutput'):
        try:
            out = tree.nodes.new(out_type)
            break
        except RuntimeError:
            continue
    if out is None:
        raise RuntimeError("无法创建 Output 节点 — 不支持的 Blender 版本")
    out.location = (300, 0)
    try:
        tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    except KeyError:
        shader_out = next((o for o in bsdf.outputs if o.type == 'SHADER'), bsdf.outputs[0])
        surface_in = next((i for i in out.inputs if i.type == 'SHADER'), out.inputs[0])
        tree.links.new(shader_out, surface_in)
    mat_socket(bsdf, 'Base Color', color)
    mat_socket(bsdf, 'Roughness', 0.7)
    return mat


def create_body(name, color, height=1.8):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, height/2))
    body = bpy.context.active_object
    body.name = name
    body.scale = (0.35, 0.25, height/2)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(0, 0, height + 0.05))
    head = bpy.context.active_object
    head.name = f"{name}_head"

    m = create_material(f"{name}_mat", color)
    body.data.materials.append(m)
    head.data.materials.append(m)

    bpy.context.view_layer.objects.active = body
    for o in (head, body): o.select_set(True)
    bpy.ops.object.join()
    return bpy.context.active_object


def add_cone_hat(body, color_offset):
    bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.18, depth=0.18, location=(0, 0, 2.0))
    hat = bpy.context.active_object
    hat.data.materials.append(
        create_material(f"{body.name}_hat",
            tuple(c * (1 + color_offset) for c in ROLE_COLORS['villager'])))
    return hat


def add_witch_hat(body, color, offset=(0, 0, 0.05)):
    z = 2.0 + offset[2]
    bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.03, location=(offset[0], offset[1], z))
    brim = bpy.context.active_object
    bpy.ops.mesh.primitive_cone_add(radius1=0.08, radius2=0.14, depth=0.35,
                                     location=(offset[0], offset[1], z + 0.16))
    tip = bpy.context.active_object
    for o in (brim, tip): o.select_set(True)
    bpy.context.view_layer.objects.active = tip
    bpy.ops.object.join()
    hat = bpy.context.active_object
    hat.data.materials.append(create_material(f"{body.name}_hat", color))
    return hat


def add_corrupted_head(body, color, size=1.0):
    # 从 body children 移除旧 head
    for ch in [c for c in body.children if 'head' in c.name.lower()]:
        try: bpy.data.objects.remove(ch)
        except Exception: pass

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16 * size, location=(0, 0.08, 1.95))
    head = bpy.context.active_object
    head.scale = (1.2, 1.0, 1.4)

    bpy.ops.mesh.primitive_cone_add(radius1=0.04, radius2=0.06, depth=0.14, location=(-0.08, 0.04, 2.1))
    ear1 = bpy.context.active_object
    ear1.rotation_euler = (0.3, 0, -0.2)
    bpy.ops.mesh.primitive_cone_add(radius1=0.04, radius2=0.06, depth=0.14, location=(0.08, 0.04, 2.1))
    ear2 = bpy.context.active_object
    ear2.rotation_euler = (0.3, 0, 0.2)

    for x in (-0.05, 0.05):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02 * size, location=(x, 0.14, 2.0))
        eye = bpy.context.active_object
        eye.data.materials.append(create_material(f"{body.name}_eye", (0.9, 0.1, 0.1, 1.0)))

    m = create_material(f"{body.name}_corrupted", color)
    for o in (head, ear1, ear2): o.data.materials.append(m)

    for o in (head, ear1, ear2): o.select_set(True)
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.join()
    return bpy.context.active_object


def add_shield(body):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.03, location=(-0.3, 0.15, 1.2))
    shield = bpy.context.active_object
    shield.rotation_euler = (0.2, 0, 0.3)
    shield.data.materials.append(create_material(f"{body.name}_shield", (0.15, 0.35, 0.55, 1.0)))
    return shield


def add_rifle(body):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.8, location=(0.25, 0.1, 1.3))
    gun = bpy.context.active_object
    gun.rotation_euler = (0.4, 0, 0.5)
    gun.data.materials.append(create_material(f"{body.name}_gun", (0.3, 0.25, 0.2, 1.0)))
    return gun


def add_crystal_ball(body):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(0.2, 0.15, 1.1))
    ball = bpy.context.active_object
    ball.data.materials.append(create_material(f"{body.name}_ball", (0.6, 0.2, 0.8, 0.7)))
    return ball


def add_bottle(body, color):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.2, location=(0.2, 0.12, 1.05))
    bottle = bpy.context.active_object
    bottle.data.materials.append(create_material(f"{body.name}_bottle", color))
    return bottle


def generate_character(role_id):
    color = ROLE_COLORS[role_id]
    name_en = role_id.replace('_', ' ').title()
    print(f"  生成: {ROLE_NAMES_CN[role_id]} ({name_en})...")

    if role_id in ('corrupted', 'nether_monk'):
        size = 1.15 if role_id == 'alpha_corrupted' else 1.0
        body = create_body(name_en, color, 1.7 * size)
        add_corrupted_head(body, color, size)
        if role_id == 'alpha_corrupted':
            bpy.ops.mesh.primitive_cone_add(radius1=0.06, radius2=0.1, depth=0.12, location=(0, 0, 2.15))
            crown = bpy.context.active_object
            crown.data.materials.append(create_material(f"{body.name}_crown", (0.8, 0.65, 0.2, 1.0)))

    elif role_id == 'seer':
        body = create_body(name_en, color, 1.75)
        add_witch_hat(body, (0.35, 0.15, 0.5, 1.0))
        add_crystal_ball(body)
        body.scale = (0.32, 0.28, 1.1)

    elif role_id == 'poison_witch':
        body = create_body(name_en, color, 1.65)
        add_witch_hat(body, (0.15, 0.35, 0.2, 1.0))
        add_bottle(body, (0.2, 0.8, 0.2, 1.0))

    elif role_id == 'heal_witch':
        body = create_body(name_en, color, 1.65)
        add_witch_hat(body, (0.2, 0.5, 0.3, 1.0))
        add_bottle(body, (0.3, 0.9, 0.4, 1.0))

    elif role_id == 'villager':
        body = create_body(name_en, color, 1.7)
        add_cone_hat(body, 0.15)

    elif role_id == 'guard':
        body = create_body(name_en, color, 1.85)
        add_shield(body)
        body.scale = (0.38, 0.28, 1.05)

    elif role_id == 'hunter':
        body = create_body(name_en, color, 1.78)
        add_cone_hat(body, -0.1)
        add_rifle(body)

    return bpy.context.active_object


def export_model(obj, filename):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    glb = os.path.join(OUTPUT_DIR, f"{filename}.glb")
    safe_export_gltf(glb)
    print(f"     → {glb}")


def main():
    print("=" * 60)
    print("  🌑 帷幕之地 3D 角色生成器")
    print(f"  兼容 Blender 4.0 ~ 5.x")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"\n输出目录: {OUTPUT_DIR}\n")

    for role_id in ROLE_COLORS:
        clear_scene()
        obj = generate_character(role_id)
        export_model(obj, f"veilland_{role_id}")
        print()

    # 集合场景
    clear_scene()
    print("生成集合场景 (all_characters)...")
    for i, role_id in enumerate(ROLE_COLORS):
        obj = generate_character(role_id)
        obj.location.x = (i - 3.5) * 2.0

    bpy.ops.object.select_all(action='SELECT')
    scene_glb = os.path.join(OUTPUT_DIR, "veilland_all_characters.glb")
    safe_export_gltf(scene_glb)
    print(f"\n集合场景 → {scene_glb}")

    print("\n" + "=" * 60)
    print(f"  ✅ 完成！模型已导出到: {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
