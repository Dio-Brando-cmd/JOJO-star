# ============================================================
# Blender 4.2 Python 脚本 — 批量生成 15 个角色基础模型
# 使用方法:
#   1. 打开 Blender 4.2
#   2. 切换到 Scripting 工作区
#   3. 打开此文件 → 点击 Run Script
#   4. 模型自动生成到指定输出目录
# ============================================================

import bpy
import os
import math

# ====== 配置 ======
OUTPUT_DIR = r"C:\Users\Lenovo\Desktop\Werewolf_Models"
EXPORT_FORMAT = "FBX"

# ====== 15角色参数表 ======
CHARACTERS = {
    "SIGURD":          {"height": 1.88, "build": "muscular", "shoulder_w": 0.52, "hip_w": 0.36, "head_h": 0.09, "body_fat": 0.08},
    "FREYJA":          {"height": 1.65, "build": "slim",     "shoulder_w": 0.40, "hip_w": 0.34, "head_h": 0.10, "body_fat": 0.05},
    "MORRIGAN":        {"height": 1.72, "build": "athletic", "shoulder_w": 0.44, "hip_w": 0.35, "head_h": 0.10, "body_fat": 0.06},
    "ANUBIS_ACOLYTE":  {"height": 1.82, "build": "thin",     "shoulder_w": 0.38, "hip_w": 0.32, "head_h": 0.09, "body_fat": 0.03},
    "HECTOR":          {"height": 1.95, "build": "burly",    "shoulder_w": 0.56, "hip_w": 0.38, "head_h": 0.08, "body_fat": 0.10},
    "ROMULUS":         {"height": 1.78, "build": "lean",     "shoulder_w": 0.46, "hip_w": 0.34, "head_h": 0.09, "body_fat": 0.06},
    "FENRIR_KIN":      {"height": 1.92, "build": "hulking",  "shoulder_w": 0.58, "hip_w": 0.40, "head_h": 0.07, "body_fat": 0.12},
    "SKADI":           {"height": 1.75, "build": "athletic", "shoulder_w": 0.44, "hip_w": 0.34, "head_h": 0.09, "body_fat": 0.05},
    "HAIKU_MONK":      {"height": 1.70, "build": "thin",     "shoulder_w": 0.40, "hip_w": 0.33, "head_h": 0.10, "body_fat": 0.04},
    "BRIGID":          {"height": 1.63, "build": "slim",     "shoulder_w": 0.39, "hip_w": 0.33, "head_h": 0.10, "body_fat": 0.05},
    "YSERA":           {"height": 1.68, "build": "slim",     "shoulder_w": 0.38, "hip_w": 0.32, "head_h": 0.10, "body_fat": 0.04},
    "GOREN":           {"height": 1.85, "build": "burly",    "shoulder_w": 0.54, "hip_w": 0.38, "head_h": 0.08, "body_fat": 0.11},
    "AILIN":           {"height": 1.70, "build": "thin",     "shoulder_w": 0.40, "hip_w": 0.33, "head_h": 0.10, "body_fat": 0.04},
    "ORIC":            {"height": 1.73, "build": "lean",     "shoulder_w": 0.42, "hip_w": 0.33, "head_h": 0.09, "body_fat": 0.04},
    "NELIA":           {"height": 1.67, "build": "slim",     "shoulder_w": 0.38, "hip_w": 0.32, "head_h": 0.10, "body_fat": 0.04},
}

# ====== 骨架预设 (Mixamo Humanoid 兼容 65 骨骼) ======
BONE_STRUCTURE = {
    "Hips":         (0, 0.5, 0),
    "Spine":        (0, 0.55, 0),
    "Spine1":       (0, 0.60, 0),
    "Spine2":       (0, 0.65, 0),
    "Neck":         (0, 0.78, 0),
    "Head":         (0, 0.84, 0),
    "LeftShoulder": (-0.12, 0.70, 0),
    "LeftArm":      (-0.18, 0.68, 0),
    "LeftForeArm":  (-0.22, 0.58, 0),
    "LeftHand":     (-0.24, 0.49, 0),
    "RightShoulder":(0.12, 0.70, 0),
    "RightArm":     (0.18, 0.68, 0),
    "RightForeArm": (0.22, 0.58, 0),
    "RightHand":    (0.24, 0.49, 0),
    "LeftUpLeg":    (-0.08, 0.42, 0),
    "LeftLeg":      (-0.09, 0.25, 0),
    "LeftFoot":     (-0.09, 0.08, 0),
    "RightUpLeg":   (0.08, 0.42, 0),
    "RightLeg":     (0.09, 0.25, 0),
    "RightFoot":    (0.09, 0.08, 0),
}


# ================================================================
# 核心函数
# ================================================================

def clear_scene():
    """清空场景"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def create_armature(name, height):
    """创建 Mixamo 兼容骨架"""
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    armature = bpy.context.object
    armature.name = name
    armature.data.name = name + "_Armature"

    # 删除默认骨骼
    for bone in armature.data.edit_bones:
        armature.data.edit_bones.remove(bone)

    bones = {}
    scale = height / 1.7  # 基准身高1.7m

    for bone_name, (x, y, z) in BONE_STRUCTURE.items():
        bone = armature.data.edit_bones.new(bone_name)
        bone.head = (x * scale, z * scale * 1.7, y * scale * 1.7)  # Blender: Z-up
        bone.tail = (x * scale, z * scale * 1.7 + 0.05, y * scale * 1.7)
        bones[bone_name] = bone

    # 设置父子关系
    parents = {
        "Spine": "Hips", "Spine1": "Spine", "Spine2": "Spine1", "Neck": "Spine2", "Head": "Neck",
        "LeftShoulder": "Spine2", "RightShoulder": "Spine2",
        "LeftArm": "LeftShoulder", "LeftForeArm": "LeftArm", "LeftHand": "LeftForeArm",
        "RightArm": "RightShoulder", "RightForeArm": "RightArm", "RightHand": "RightForeArm",
        "LeftUpLeg": "Hips", "LeftLeg": "LeftUpLeg", "LeftFoot": "LeftLeg",
        "RightUpLeg": "Hips", "RightLeg": "RightUpLeg", "RightFoot": "RightLeg",
    }
    for child, parent in parents.items():
        if child in bones and parent in bones:
            bones[child].parent = bones[parent]

    bpy.ops.object.mode_set(mode='OBJECT')
    return armature


def create_body_mesh(name, params):
    """基于参数生成简易人体网格"""
    h = params["height"]
    sw = params["shoulder_w"]
    hw = params["hip_w"]

    # 使用 Metaball 生成身体轮廓
    bpy.ops.object.metaball_add(type='BALL', location=(0, 0, h * 0.85))
    mball = bpy.context.object
    mball.name = name + "_body"

    # 转为网格
    bpy.ops.object.convert(target='MESH')
    mesh = bpy.context.object
    mesh.name = name + "_BodyMesh"

    # 添加细分 + 平滑
    mod = mesh.modifiers.new(name="Subdivide", type='SUBSURF')
    mod.levels = 2
    mod.render_levels = 2

    return mesh


def create_head(name, params):
    """生成头部网格"""
    hh = params["head_h"] * params["height"]

    bpy.ops.mesh.primitive_uv_sphere_add(radius=hh * 0.5, location=(0, 0, params["height"] * 0.92))
    head = bpy.context.object
    head.name = name + "_Head"
    return head


def create_limbs(name, params):
    """生成四肢"""
    h = params["height"]
    limb_r = 0.04 * h

    limbs = []
    # 左臂
    bpy.ops.mesh.primitive_cylinder_add(radius=limb_r, depth=h * 0.28, location=(-0.15 * h, 0, h * 0.62))
    limbs.append(bpy.context.object)
    # 右臂
    bpy.ops.mesh.primitive_cylinder_add(radius=limb_r, depth=h * 0.28, location=(0.15 * h, 0, h * 0.62))
    limbs.append(bpy.context.object)
    # 左腿
    bpy.ops.mesh.primitive_cylinder_add(radius=limb_r * 1.2, depth=h * 0.40, location=(-0.06 * h, 0, h * 0.25))
    limbs.append(bpy.context.object)
    # 右腿
    bpy.ops.mesh.primitive_cylinder_add(radius=limb_r * 1.2, depth=h * 0.40, location=(0.06 * h, 0, h * 0.25))
    limbs.append(bpy.context.object)
    return limbs


def join_and_parent(objects, armature, name):
    """合并网格并绑定到骨架"""
    # 合并所有网格
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

    if len(objects) > 1:
        bpy.ops.object.join()
    body = bpy.context.object
    body.name = name + "_Mesh"

    # 绑定到骨架
    body.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return body


def export_fbx(name, output_dir):
    """导出为 FBX"""
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, f"{name}.fbx")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.fbx(
        filepath=filepath,
        use_selection=True,
        apply_scale_options='FBX_SCALE_ALL',
        object_types={'ARMATURE', 'MESH'},
        use_mesh_modifiers=True,
        add_leaf_bones=False,
        bake_anim=False,
    )
    print(f"  ✅ Exported: {filepath}")
    return filepath


# ================================================================
# 主流程: 逐一生成 15 个角色
# ================================================================
def generate_all():
    print("=" * 60)
    print("🐺 帷幕之地 — 批量角色模型生成")
    print("=" * 60)

    for char_id, params in CHARACTERS.items():
        print(f"\n🔨 Generating: {char_id} (height={params['height']}m, build={params['build']})")

        # 1. 清场景
        clear_scene()

        # 2. 创建骨架
        armature = create_armature(char_id, params["height"])

        # 3. 创建身体部件
        body = create_body_mesh(char_id, params)
        head = create_head(char_id, params)
        limbs = create_limbs(char_id, params)

        # 4. 合并并绑定
        all_parts = [body, head] + limbs
        final_mesh = join_and_parent(all_parts, armature, char_id)

        # 5. 导出
        export_fbx(char_id, OUTPUT_DIR)
        print(f"  📦 {char_id}: {final_mesh.name} with {len(armature.data.bones)} bones")

    print(f"\n{'=' * 60}")
    print(f"✅ 完成! 15 个角色模型已导出到:")
    print(f"   {OUTPUT_DIR}")
    print(f"{'=' * 60}")


# ====== 一键生成单个角色（用于调试） ======
def generate_single(char_id):
    if char_id not in CHARACTERS:
        print(f"Unknown character: {char_id}")
        print(f"Available: {list(CHARACTERS.keys())}")
        return
    params = CHARACTERS[char_id]
    clear_scene()
    armature = create_armature(char_id, params["height"])
    body = create_body_mesh(char_id, params)
    head = create_head(char_id, params)
    limbs = create_limbs(char_id, params)
    join_and_parent([body, head] + limbs, armature, char_id)
    export_fbx(char_id, OUTPUT_DIR)
    print(f"✅ {char_id} done")


# ====== 运行 ======
if __name__ == "__main__":
    generate_all()
    # generate_single("SIGURD")  # 取消注释以调试单个角色
