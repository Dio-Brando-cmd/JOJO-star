"""
============================================================
 狼人杀 3D 角色生成器 — 在 Blender 中运行此脚本
 自动生成 8 个低多边形角色模型

 使用方法:
   1. 打开 Blender
   2. 切换到 Scripting 工作区
   3. 打开此文件 (File → Open)
   4. 点击 Run Script (或按 Alt+P)

 生成的角色:
   - 狼人 (Werewolf)       — 暗红色狼形
   - 种狼 (Alpha Wolf)     — 金色王冠狼形
   - 预言家 (Seer)         — 紫色兜帽长袍 + 水晶球
   - 毒巫 (Poison Witch)   — 绿色巫帽 + 毒药瓶
   - 药巫 (Heal Witch)     — 青色巫帽 + 草药
   - 村民 (Villager)       — 棕色草帽 + 锄头
   - 守卫 (Guard)          — 蓝色盔甲 + 盾牌
   - 猎人 (Hunter)         — 橙色宽帽 + 猎枪
============================================================
"""

import bpy
import math
import os

# ====== Blender 版本检查 ======
blender_version = tuple(bpy.app.version)
print(f"Blender 版本: {'.'.join(map(str, blender_version))}")
if blender_version < (4, 0, 0):
    print("⚠️  警告: 此脚本针对 Blender 4.0+ 设计，旧版本可能无法正常运行")
print(f"脚本兼容: 4.0 ~ 5.x\n")

# ====== 配置 ======
OUTPUT_DIR = os.path.join(os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.path.expanduser("~"), "werewolf_models")

# 角色颜色定义 (西式+中式恐怖融合)
ROLE_COLORS = {
    'werewolf':       (0.55, 0.05, 0.05, 1.0),  # 暗血红
    'alpha_wolf':     (0.42, 0.02, 0.02, 1.0),  # 深血红
    'seer':           (0.24, 0.10, 0.36, 1.0),  # 深紫
    'poison_witch':   (0.10, 0.24, 0.12, 1.0),  # 毒绿
    'heal_witch':     (0.10, 0.22, 0.18, 1.0),  # 药绿
    'villager':       (0.24, 0.22, 0.30, 1.0),  # 灰褐
    'guard':          (0.10, 0.18, 0.30, 1.0),  # 深蓝
    'hunter':         (0.30, 0.14, 0.06, 1.0),  # 猎橙
}

ROLE_NAMES_CN = {
    'werewolf': '狼人', 'alpha_wolf': '种狼', 'seer': '预言家',
    'poison_witch': '毒巫', 'heal_witch': '药巫', 'villager': '村民',
    'guard': '守卫', 'hunter': '猎人',
}


def clear_scene():
    """清空场景"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_confirm=False)
    # 清理孤立数据
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)


def create_material(name, color):
    """创建材质 — 兼容 Blender 4.x 和 5.x"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.7
    # Specular IOR Level 在 Blender 5.x 中被移除，用安全方式设置
    for socket_name in ['Specular IOR Level', 'Specular Weight', 'Specular']:
        if socket_name in bsdf.inputs:
            bsdf.inputs[socket_name].default_value = 0.1
            break
    return mat


def create_body(name, color, height=1.8):
    """创建基础人形身体"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, height/2))
    body = bpy.context.active_object
    body.name = name
    body.scale = (0.35, 0.25, height/2)

    # 头部
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(0, 0, height + 0.05))
    head = bpy.context.active_object
    head.name = f"{name}_head"

    # 合并
    mat = create_material(f"{name}_mat", color)
    body.data.materials.append(mat)
    head.data.materials.append(mat)

    # 选中身体作为父级
    bpy.context.view_layer.objects.active = body
    head.select_set(True)
    body.select_set(True)
    bpy.ops.object.join()
    return bpy.context.active_object


def add_cone_hat(body, color_offset):
    """添加锥形帽（村民/猎人）"""
    bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.18, depth=0.18, location=(0, 0, 2.0))
    hat = bpy.context.active_object
    mat = create_material(f"{body.name}_hat", tuple(c * (1 + color_offset) for c in ROLE_COLORS['villager']))
    hat.data.materials.append(mat)
    return hat


def add_witch_hat(body, color, offset=(0, 0, 0.05)):
    """添加巫师帽（女巫/预言家）"""
    z = 2.0 + offset[2]
    # 帽檐
    bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.03, location=(offset[0], offset[1], z))
    brim = bpy.context.active_object
    # 帽尖
    bpy.ops.mesh.primitive_cone_add(radius1=0.08, radius2=0.14, depth=0.35, location=(offset[0], offset[1], z + 0.16))
    tip = bpy.context.active_object
    brim.select_set(True)
    bpy.context.view_layer.objects.active = tip
    tip.select_set(True)
    bpy.ops.object.join()
    hat = bpy.context.active_object
    mat = create_material(f"{body.name}_hat", color)
    hat.data.materials.append(mat)
    return hat


def add_wolf_head(body, color, size=1.0):
    """添加狼头（替换人头）"""
    # 找头部并移除
    for child in body.children:
        if 'head' in child.name.lower():
            bpy.data.objects.remove(child)

    # 狼头 — 拉长的椭圆
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16 * size, location=(0, 0.08, 1.95))
    head = bpy.context.active_object
    head.scale = (1.2, 1.0, 1.4)

    # 耳朵
    bpy.ops.mesh.primitive_cone_add(radius1=0.04, radius2=0.06, depth=0.14, location=(-0.08, 0.04, 2.1))
    ear1 = bpy.context.active_object
    ear1.rotation_euler = (0.3, 0, -0.2)
    bpy.ops.mesh.primitive_cone_add(radius1=0.04, radius2=0.06, depth=0.14, location=(0.08, 0.04, 2.1))
    ear2 = bpy.context.active_object
    ear2.rotation_euler = (0.3, 0, 0.2)

    # 眼睛 — 红色小球
    for x in [-0.05, 0.05]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02 * size, location=(x, 0.14, 2.0))
        eye = bpy.context.active_object
        eye_mat = create_material(f"{body.name}_eye", (0.9, 0.1, 0.1, 1.0))
        eye.data.materials.append(eye_mat)

    mat = create_material(f"{body.name}_wolf", color)
    head.data.materials.append(mat)
    ear1.data.materials.append(mat)
    ear2.data.materials.append(mat)

    # Join
    objs = [head, ear1, ear2]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = head
    bpy.ops.object.join()
    return bpy.context.active_object


def add_shield(body):
    """添加盾牌（守卫）"""
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.03, location=(-0.3, 0.15, 1.2))
    shield = bpy.context.active_object
    shield.rotation_euler = (0.2, 0, 0.3)
    mat = create_material(f"{body.name}_shield", (0.15, 0.35, 0.55, 1.0))
    shield.data.materials.append(mat)
    return shield


def add_rifle(body):
    """添加猎枪（猎人）"""
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.8, location=(0.25, 0.1, 1.3))
    gun = bpy.context.active_object
    gun.rotation_euler = (0.4, 0, 0.5)
    mat = create_material(f"{body.name}_gun", (0.3, 0.25, 0.2, 1.0))
    gun.data.materials.append(mat)
    return gun


def add_crystal_ball(body):
    """添加水晶球（预言家）"""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(0.2, 0.15, 1.1))
    ball = bpy.context.active_object
    mat = create_material(f"{body.name}_ball", (0.6, 0.2, 0.8, 0.7))
    ball.data.materials.append(mat)
    return ball


def add_bottle(body, color):
    """添加药瓶（女巫）"""
    bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.2, location=(0.2, 0.12, 1.05))
    bottle = bpy.context.active_object
    mat = create_material(f"{body.name}_bottle", color)
    bottle.data.materials.append(mat)
    return bottle


def generate_character(role_id):
    """生成单个角色模型"""
    color = ROLE_COLORS[role_id]
    name_en = role_id.replace('_', ' ').title()
    name_cn = ROLE_NAMES_CN[role_id]

    print(f"  生成: {name_cn} ({name_en})...")

    if role_id in ('werewolf', 'alpha_wolf'):
        size = 1.15 if role_id == 'alpha_wolf' else 1.0
        body = create_body(name_en, color, 1.7 * size)
        wolf_head = add_wolf_head(body, color, size)
        # 种狼加王冠
        if role_id == 'alpha_wolf':
            bpy.ops.mesh.primitive_cone_add(
                radius1=0.06, radius2=0.1, depth=0.12,
                location=(0, 0, 2.15)
            )
            crown = bpy.context.active_object
            crown_mat = create_material(f"{body.name}_crown", (0.8, 0.65, 0.2, 1.0))
            crown.data.materials.append(crown_mat)

    elif role_id == 'seer':
        body = create_body(name_en, color, 1.75)
        add_witch_hat(body, (0.35, 0.15, 0.5, 1.0))
        add_crystal_ball(body)
        # 长袍 — 拉伸下半身
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

    # 选择并重命名最终的集合
    return bpy.context.active_object


def export_model(obj, filename):
    """导出为 glTF (.glb) 和 FBX"""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # glTF (推荐 — Unity/Web 兼容)
    glb_path = os.path.join(OUTPUT_DIR, f"{filename}.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        use_selection=True,
        export_format='GLB',
    )
    print(f"     → {glb_path}")

    # FBX (Unity/Unreal 通用)
    fbx_path = os.path.join(OUTPUT_DIR, f"{filename}.fbx")
    bpy.ops.export_scene.fbx(
        filepath=fbx_path,
        use_selection=True,
    )
    print(f"     → {fbx_path}")


def main():
    print("=" * 60)
    print("  🐺 狼人杀 3D 角色生成器")
    print("=" * 60)

    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"\n输出目录: {OUTPUT_DIR}\n")

    # 逐个生成角色
    models = {}
    for role_id in ROLE_COLORS:
        clear_scene()
        obj = generate_character(role_id)
        models[role_id] = obj
        export_model(obj, f"werewolf_{role_id}")
        print()

    # 生成所有角色集合场景
    clear_scene()
    print("生成集合场景 (all_characters)...")
    for i, (role_id, color) in enumerate(ROLE_COLORS.items()):
        x_offset = (i - 3.5) * 2.0
        obj = generate_character(role_id)
        obj.location.x = x_offset

    # 导出完整场景
    bpy.ops.object.select_all(action='SELECT')
    scene_path = os.path.join(OUTPUT_DIR, "werewolf_all_characters.glb")
    bpy.ops.export_scene.gltf(
        filepath=scene_path,
        use_selection=True,
        export_format='GLB',
    )
    print(f"\n集合场景 → {scene_path}")

    print("\n" + "=" * 60)
    print("  ✅ 完成！所有模型已导出到:")
    print(f"     {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
