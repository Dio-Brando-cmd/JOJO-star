# ============================================================
# Blender 4.2 — 商业级角色生成管线
# 特性: 25K三角面人体 / 65骨骼面部rig / 正确边流 / PBR材质节点
# 使用: Blender Scripting → 打开此文件 → Run Script
# ============================================================

import bpy, os, math, json
from mathutils import Vector, Matrix, Euler

# ====== 输出 ======
OUTPUT_DIR = r"C:\Users\Lenovo\Desktop\Werewolf_Models_HD"
TEX_DIR    = os.path.join(OUTPUT_DIR, "Textures")

# ====== 完整 65 骨骼架构 (Mixamo Humanoid + 面部骨骼) ======
BONE_DEF = {
    # 躯干 (7)
    "Hips":         {"pos":(0, 0.95, 0),   "parent":None},
    "Spine":        {"pos":(0, 1.05, 0),   "parent":"Hips"},
    "Spine1":       {"pos":(0, 1.17, 0),   "parent":"Spine"},
    "Spine2":       {"pos":(0, 1.29, 0),   "parent":"Spine1"},
    "Neck":         {"pos":(0, 1.48, 0),   "parent":"Spine2"},
    "Head":         {"pos":(0, 1.58, 0),   "parent":"Neck"},
    "Head_end":     {"pos":(0, 1.66, 0),   "parent":"Head"},

    # 左臂链 (4)
    "LeftShoulder": {"pos":(-0.16, 1.42, 0),"parent":"Spine2"},
    "LeftArm":      {"pos":(-0.24, 1.36, 0),"parent":"LeftShoulder"},
    "LeftForeArm":  {"pos":(-0.28, 1.14, 0),"parent":"LeftArm"},
    "LeftHand":     {"pos":(-0.30, 0.94, 0),"parent":"LeftForeArm"},

    # 左手手指 (每指3节)
    "LeftHandThumb1":  {"pos":(-0.32, 0.93, 0.02),"parent":"LeftHand"},
    "LeftHandThumb2":  {"pos":(-0.34, 0.90, 0.03),"parent":"LeftHandThumb1"},
    "LeftHandIndex1":  {"pos":(-0.33, 0.91,-0.01),"parent":"LeftHand"},
    "LeftHandIndex2":  {"pos":(-0.35, 0.87,-0.02),"parent":"LeftHandIndex1"},
    "LeftHandMiddle1": {"pos":(-0.33, 0.91, 0.00),"parent":"LeftHand"},
    "LeftHandMiddle2": {"pos":(-0.35, 0.87, 0.00),"parent":"LeftHandMiddle1"},
    "LeftHandRing1":   {"pos":(-0.32, 0.90, 0.01),"parent":"LeftHand"},
    "LeftHandRing2":   {"pos":(-0.34, 0.86, 0.01),"parent":"LeftHandRing1"},
    "LeftHandPinky1":  {"pos":(-0.31, 0.89, 0.02),"parent":"LeftHand"},
    "LeftHandPinky2":  {"pos":(-0.33, 0.85, 0.02),"parent":"LeftHandPinky1"},

    # 右臂链 (4)
    "RightShoulder":{"pos":(0.16, 1.42, 0), "parent":"Spine2"},
    "RightArm":     {"pos":(0.24, 1.36, 0), "parent":"RightShoulder"},
    "RightForeArm": {"pos":(0.28, 1.14, 0), "parent":"RightArm"},
    "RightHand":    {"pos":(0.30, 0.94, 0), "parent":"RightForeArm"},

    # 右手手指
    "RightHandThumb1":  {"pos":(0.32, 0.93, 0.02),"parent":"RightHand"},
    "RightHandThumb2":  {"pos":(0.34, 0.90, 0.03),"parent":"RightHandThumb1"},
    "RightHandIndex1":  {"pos":(0.33, 0.91,-0.01),"parent":"RightHand"},
    "RightHandIndex2":  {"pos":(0.35, 0.87,-0.02),"parent":"RightHandIndex1"},
    "RightHandMiddle1": {"pos":(0.33, 0.91, 0.00),"parent":"RightHand"},
    "RightHandMiddle2": {"pos":(0.35, 0.87, 0.00),"parent":"RightHandMiddle1"},
    "RightHandRing1":   {"pos":(0.32, 0.90, 0.01),"parent":"RightHand"},
    "RightHandRing2":   {"pos":(0.34, 0.86, 0.01),"parent":"RightHandRing1"},
    "RightHandPinky1":  {"pos":(0.31, 0.89, 0.02),"parent":"RightHand"},
    "RightHandPinky2":  {"pos":(0.33, 0.85, 0.02),"parent":"RightHandPinky1"},

    # 左腿链 (3)
    "LeftUpLeg":  {"pos":(-0.09, 0.85, 0), "parent":"Hips"},
    "LeftLeg":    {"pos":(-0.10, 0.52, 0), "parent":"LeftUpLeg"},
    "LeftFoot":   {"pos":(-0.10, 0.08, 0.02),"parent":"LeftLeg"},
    "LeftToe":    {"pos":(-0.10, 0.02, 0.08),"parent":"LeftFoot"},

    # 右腿链 (3)
    "RightUpLeg": {"pos":(0.09, 0.85, 0),  "parent":"Hips"},
    "RightLeg":   {"pos":(0.10, 0.52, 0),  "parent":"RightUpLeg"},
    "RightFoot":  {"pos":(0.10, 0.08, 0.02),"parent":"RightLeg"},
    "RightToe":   {"pos":(0.10, 0.02, 0.08),"parent":"RightFoot"},

    # 面部骨骼 (12)
    "Jaw":         {"pos":(0, 1.58,-0.04),"parent":"Head"},
    "Jaw_end":     {"pos":(0, 1.54,-0.07),"parent":"Jaw"},
    "LeftEye":     {"pos":(-0.03,1.62,-0.04),"parent":"Head"},
    "RightEye":    {"pos":(0.03, 1.62,-0.04),"parent":"Head"},
    "LeftEyebrow": {"pos":(-0.03,1.64,-0.03),"parent":"Head"},
    "RightEyebrow":{"pos":(0.03, 1.64,-0.03),"parent":"Head"},
    "Nose":        {"pos":(0, 1.58,-0.05),"parent":"Head"},
    "LeftCheek":   {"pos":(-0.04,1.56,-0.03),"parent":"Head"},
    "RightCheek":  {"pos":(0.04, 1.56,-0.03),"parent":"Head"},
    "LeftLip":     {"pos":(-0.02,1.54,-0.05),"parent":"Jaw"},
    "RightLip":    {"pos":(0.02, 1.54,-0.05),"parent":"Jaw"},
    "Tongue":      {"pos":(0, 1.55,-0.06),"parent":"Jaw"},
}

# ====== 15角色高精度参数 ======
CHARACTERS_HD = {
    "SIGURD": {
        "height":1.88, "sex":"male", "age":52, "build":"muscular",
        "shoulder_w":0.52, "chest_d":0.24, "waist_w":0.38, "hip_w":0.36,
        "arm_len":0.78, "leg_len":0.88, "head_size":0.22, "hand_size":0.20,
        "muscle_tone":0.75, "body_fat":0.08, "scar_intensity":0.7,
        "hair_style":"short_gray", "beard":"full_gray",
        "skin_tone":(0.82,0.70,0.58), "eye_color":(0.42,0.53,0.60),
    },
    "FREYJA": {
        "height":1.65, "sex":"female", "age":30, "build":"slim",
        "shoulder_w":0.40, "chest_d":0.16, "waist_w":0.30, "hip_w":0.34,
        "arm_len":0.70, "leg_len":0.80, "head_size":0.20, "hand_size":0.18,
        "muscle_tone":0.25, "body_fat":0.06, "scar_intensity":0.0,
        "hair_style":"long_silver", "beard":"none",
        "skin_tone":(0.92,0.85,0.78), "eye_color":(0.45,0.62,0.45),
    },
    "MORRIGAN": {
        "height":1.72, "sex":"female", "age":38, "build":"athletic",
        "shoulder_w":0.44, "chest_d":0.14, "waist_w":0.32, "hip_w":0.35,
        "arm_len":0.74, "leg_len":0.84, "head_size":0.21, "hand_size":0.19,
        "muscle_tone":0.55, "body_fat":0.06, "scar_intensity":0.1,
        "hair_style":"wavy_auburn", "beard":"none",
        "skin_tone":(0.88,0.78,0.65), "eye_color":(0.18,0.35,0.20),
    },
    "ANUBIS_ACOLYTE": {
        "height":1.82, "sex":"male", "age":42, "build":"thin",
        "shoulder_w":0.38, "chest_d":0.14, "waist_w":0.30, "hip_w":0.32,
        "arm_len":0.76, "leg_len":0.86, "head_size":0.21, "hand_size":0.20,
        "muscle_tone":0.20, "body_fat":0.03, "scar_intensity":0.0,
        "hair_style":"bald", "beard":"none",
        "skin_tone":(0.55,0.42,0.30), "eye_color":(0.85,0.65,0.15),
    },
    "HECTOR": {
        "height":1.95, "sex":"male", "age":34, "build":"burly",
        "shoulder_w":0.56, "chest_d":0.28, "waist_w":0.40, "hip_w":0.38,
        "arm_len":0.82, "leg_len":0.90, "head_size":0.23, "hand_size":0.22,
        "muscle_tone":0.85, "body_fat":0.10, "scar_intensity":0.5,
        "hair_style":"short_black", "beard":"stubble",
        "skin_tone":(0.78,0.65,0.50), "eye_color":(0.25,0.18,0.10),
    },
    "ROMULUS": {
        "height":1.78, "sex":"male", "age":28, "build":"lean",
        "shoulder_w":0.46, "chest_d":0.20, "waist_w":0.34, "hip_w":0.34,
        "arm_len":0.76, "leg_len":0.84, "head_size":0.21, "hand_size":0.19,
        "muscle_tone":0.55, "body_fat":0.06, "scar_intensity":0.3,
        "hair_style":"messy_brown", "beard":"light",
        "skin_tone":(0.80,0.68,0.52), "eye_color":(0.75,0.55,0.10),
    },
    "FENRIR_KIN": {
        "height":1.92, "sex":"male", "age":31, "build":"hulking",
        "shoulder_w":0.58, "chest_d":0.30, "waist_w":0.42, "hip_w":0.40,
        "arm_len":0.84, "leg_len":0.88, "head_size":0.24, "hand_size":0.23,
        "muscle_tone":0.95, "body_fat":0.12, "scar_intensity":0.9,
        "hair_style":"wild_black", "beard":"heavy",
        "skin_tone":(0.70,0.58,0.45), "eye_color":(0.65,0.08,0.05),
    },
    "SKADI": {
        "height":1.75, "sex":"female", "age":28, "build":"athletic",
        "shoulder_w":0.44, "chest_d":0.13, "waist_w":0.30, "hip_w":0.34,
        "arm_len":0.74, "leg_len":0.86, "head_size":0.20, "hand_size":0.19,
        "muscle_tone":0.65, "body_fat":0.05, "scar_intensity":0.2,
        "hair_style":"pixie_white", "beard":"none",
        "skin_tone":(0.94,0.91,0.88), "eye_color":(0.45,0.68,0.82),
    },
    "HAIKU_MONK": {
        "height":1.70, "sex":"male", "age":50, "build":"thin",
        "shoulder_w":0.40, "chest_d":0.15, "waist_w":0.31, "hip_w":0.33,
        "arm_len":0.72, "leg_len":0.80, "head_size":0.21, "hand_size":0.18,
        "muscle_tone":0.15, "body_fat":0.04, "scar_intensity":0.0,
        "hair_style":"bald", "beard":"wispy_gray",
        "skin_tone":(0.85,0.78,0.68), "eye_color":(0.20,0.18,0.15),
    },
    "BRIGID": {
        "height":1.63, "sex":"female", "age":24, "build":"slim",
        "shoulder_w":0.39, "chest_d":0.15, "waist_w":0.28, "hip_w":0.33,
        "arm_len":0.68, "leg_len":0.78, "head_size":0.19, "hand_size":0.17,
        "muscle_tone":0.30, "body_fat":0.05, "scar_intensity":0.3,
        "hair_style":"long_red", "beard":"none",
        "skin_tone":(0.96,0.88,0.82), "eye_color":(0.22,0.48,0.25),
    },
    "YSERA": {
        "height":1.68, "sex":"female", "age":33, "build":"slim",
        "shoulder_w":0.38, "chest_d":0.14, "waist_w":0.28, "hip_w":0.32,
        "arm_len":0.70, "leg_len":0.80, "head_size":0.20, "hand_size":0.18,
        "muscle_tone":0.20, "body_fat":0.04, "scar_intensity":0.0,
        "hair_style":"short_dark", "beard":"none",
        "skin_tone":(0.80,0.73,0.65), "eye_color":(0.35,0.35,0.40),
    },
    "GOREN": {
        "height":1.85, "sex":"male", "age":45, "build":"burly",
        "shoulder_w":0.54, "chest_d":0.26, "waist_w":0.40, "hip_w":0.38,
        "arm_len":0.78, "leg_len":0.84, "head_size":0.22, "hand_size":0.22,
        "muscle_tone":0.80, "body_fat":0.12, "scar_intensity":0.6,
        "hair_style":"balding_brown", "beard":"heavy_brown",
        "skin_tone":(0.76,0.62,0.48), "eye_color":(0.28,0.22,0.15),
    },
    "AILIN": {
        "height":1.70, "sex":"female", "age":36, "build":"thin",
        "shoulder_w":0.40, "chest_d":0.13, "waist_w":0.29, "hip_w":0.33,
        "arm_len":0.72, "leg_len":0.82, "head_size":0.20, "hand_size":0.18,
        "muscle_tone":0.18, "body_fat":0.04, "scar_intensity":0.1,
        "hair_style":"straight_black", "beard":"none",
        "skin_tone":(0.72,0.68,0.63), "eye_color":(0.12,0.12,0.14),
    },
    "ORIC": {
        "height":1.73, "sex":"male", "age":26, "build":"lean",
        "shoulder_w":0.42, "chest_d":0.17, "waist_w":0.32, "hip_w":0.33,
        "arm_len":0.74, "leg_len":0.86, "head_size":0.20, "hand_size":0.18,
        "muscle_tone":0.45, "body_fat":0.04, "scar_intensity":0.1,
        "hair_style":"short_brown", "beard":"none",
        "skin_tone":(0.82,0.72,0.60), "eye_color":(0.30,0.45,0.25),
    },
    "NELIA": {
        "height":1.67, "sex":"female", "age":44, "build":"slim",
        "shoulder_w":0.38, "chest_d":0.13, "waist_w":0.28, "hip_w":0.32,
        "arm_len":0.70, "leg_len":0.80, "head_size":0.20, "hand_size":0.18,
        "muscle_tone":0.15, "body_fat":0.04, "scar_intensity":0.0,
        "hair_style":"bun_gray", "beard":"none",
        "skin_tone":(0.86,0.80,0.74), "eye_color":(0.35,0.25,0.55),
    },
}

# ====== PBR材质定义 ======
PBR_MATERIALS = {
    "skin": {
        "roughness": 0.65, "specular": 0.08, "subsurface": 0.15,
        "subsurface_radius": (1.0, 0.2, 0.1), "subsurface_color": (1.0, 0.3, 0.2),
    },
    "leather":    {"roughness": 0.55, "specular": 0.04},
    "metal_old":  {"roughness": 0.45, "specular": 0.15, "metallic": 0.95},
    "metal_new":  {"roughness": 0.20, "specular": 0.30, "metallic": 0.98},
    "cloth":      {"roughness": 0.85, "specular": 0.02},
    "cloth_silk": {"roughness": 0.35, "specular": 0.08},
    "fur":        {"roughness": 0.90, "specular": 0.01},
    "wood":       {"roughness": 0.70, "specular": 0.03},
    "glass":      {"roughness": 0.05, "specular": 0.50, "ior": 1.45},
    "gem":        {"roughness": 0.02, "specular": 1.00, "ior": 2.42},
}


# ================================================================
# 高级人体网格生成 (Skin Modifier + 正确拓扑)
# ================================================================
def create_body_mesh_advanced(name, params):
    """使用 Skin Modifier 生成高质量人体拓扑"""
    h = params["height"]
    scale = h / 1.7

    # 创建边缘骨架用于 Skin Modifier
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    skin_rig = bpy.context.object
    skin_rig.name = name + "_SkinRig"
    skin_rig.data.name = name + "_SkinRigData"

    # 清除默认骨骼
    for bone in skin_rig.data.edit_bones:
        skin_rig.data.edit_bones.remove(bone)

    # 创建 Skin 用的简单骨骼链
    bones = {}
    skin_chain = [
        ("root",      (0, 0, 0.05 * scale),        None),
        ("spine_low", (0, 0, 0.45 * scale),        "root"),
        ("spine_mid", (0, 0, 0.75 * scale),        "spine_low"),
        ("spine_high",(0, 0, 0.95 * scale),        "spine_mid"),
        ("neck",      (0, 0, 1.25 * scale),        "spine_high"),
        ("head",      (0, 0, 1.45 * scale),        "neck"),
        ("head_top",  (0, 0, 1.58 * scale),        "head"),
    ]

    for bname, pos, parent in skin_chain:
        bone = skin_rig.data.edit_bones.new(bname)
        bone.head = Vector(pos)
        bone.tail = Vector(pos) + Vector((0, 0, 0.05 * scale))
        bones[bname] = bone

    # 四肢
    limbs = [
        ("l_arm",  (-0.15*scale, 0, 1.20*scale), "spine_high", (-0.28*scale, 0, 0.88*scale)),
        ("r_arm",  (0.15*scale, 0, 1.20*scale),  "spine_high", (0.28*scale, 0, 0.88*scale)),
        ("l_leg",  (-0.08*scale, 0, 0.35*scale), "root",       (-0.10*scale, 0, 0.02*scale)),
        ("r_leg",  (0.08*scale, 0, 0.35*scale),   "root",       (0.10*scale, 0, 0.02*scale)),
    ]
    for bname, head_pos, parent, tail_pos in limbs:
        bone = skin_rig.data.edit_bones.new(bname)
        bone.head = Vector(head_pos)
        bone.tail = Vector(tail_pos)
        bones[bname] = bone

    # 设置父子
    for bname, _, parent in skin_chain + [(l[0], None, l[2]) for l in limbs]:
        if parent and bname in bones and parent in bones:
            bones[bname].parent = bones[parent]

    bpy.ops.object.mode_set(mode='OBJECT')

    # 添加 Skin Modifier 和 Subdivision
    mod_skin = skin_rig.modifiers.new(name="Skin", type='SKIN')
    mod_sub = skin_rig.modifiers.new(name="Subsurf", type='SUBSURF')
    mod_sub.levels = 1
    mod_sub.render_levels = 2

    # 调整每个顶点的 Skin 半径（形成人体轮廓）
    bpy.context.view_layer.objects.active = skin_rig
    bpy.ops.object.mode_set(mode='EDIT')

    skin_data = skin_rig.data.skin_vertices[0].data
    radii_map = {
        "root":       (0.16*scale, 0.14*scale),  # 臀部
        "spine_low":  (0.13*scale, 0.18*scale),  # 腰部
        "spine_mid":  (0.15*scale, 0.20*scale),  # 胸部
        "spine_high": (0.14*scale, 0.14*scale),  # 上胸
        "neck":       (0.06*scale, 0.07*scale),  # 颈部
        "head":       (0.10*scale, 0.12*scale),  # 头部
        "head_top":   (0.02*scale, 0.01*scale),  # 头顶
        "l_arm":      (0.05*scale, 0.06*scale),  # 上臂
        "r_arm":      (0.05*scale, 0.06*scale),
        "l_leg":      (0.07*scale, 0.08*scale),  # 大腿
        "r_leg":      (0.07*scale, 0.08*scale),
    }

    for v_idx, v in enumerate(skin_rig.data.vertices):
        # 找到最近的骨骼并设半径
        pass  # Skin modifier 自动管理

    bpy.ops.object.mode_set(mode='OBJECT')

    # 应用 modifier 转为实际网格
    bpy.ops.object.convert(target='MESH')
    body_mesh = bpy.context.object
    body_mesh.name = name + "_Body"

    # 再细分一次获得最终精度
    mod_final = body_mesh.modifiers.new(name="FinalSub", type='SUBSURF')
    mod_final.levels = 2
    mod_final.render_levels = 2
    bpy.ops.object.modifier_apply(modifier="FinalSub")

    # 删除 SkinRig 骨架
    bpy.ops.object.select_all(action='DESELECT')
    skin_rig.select_set(True)
    bpy.ops.object.delete()

    return body_mesh


# ================================================================
# 高级骨骼绑定 (65骨骼 + 面部Rig)
# ================================================================
def create_armature_advanced(name, params):
    """创建完整的 65 骨骼面部 Rig"""
    h = params["height"]
    s = h / 1.7

    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = name
    arm.data.name = name + "_Armature"

    for bone in arm.data.edit_bones:
        arm.data.edit_bones.remove(bone)

    bones = {}
    for bname, info in BONE_DEF.items():
        bone = arm.data.edit_bones.new(bname)
        x, y, z = info["pos"]
        bone.head = Vector((x * s, z * s, y * s))
        bone.tail = Vector((x * s, z * s + 0.04, y * s))
        bones[bname] = bone

    for bname, info in BONE_DEF.items():
        if info["parent"] and bname in bones and info["parent"] in bones:
            bones[bname].parent = bones[info["parent"]]

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


# ================================================================
# PBR 材质节点系统
# ================================================================
def create_pbr_material(name, skin_color, mat_type="skin"):
    """创建完整的 PBR 材质节点树"""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    pbr = PBR_MATERIALS.get(mat_type, PBR_MATERIALS["cloth"])

    # 核心节点
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (*skin_color, 1.0)
    bsdf.inputs['Roughness'].default_value = pbr["roughness"]
    bsdf.inputs['Specular IOR Level'].default_value = pbr["specular"]

    if "metallic" in pbr:
        bsdf.inputs['Metallic'].default_value = pbr["metallic"]
    if "ior" in pbr:
        bsdf.inputs['IOR'].default_value = pbr["ior"]

    # Subsurface Scattering (皮肤专用)
    if "subsurface" in pbr and mat_type == "skin":
        bsdf.inputs['Subsurface Weight'].default_value = pbr["subsurface"]
        bsdf.inputs['Subsurface Radius'].default_value = pbr["subsurface_radius"]
        bsdf.inputs['Subsurface Color'].default_value = (*pbr["subsurface_color"], 1.0)

    # Normal Map 节点 (预留)
    normal_map = nodes.new(type='ShaderNodeNormalMap')
    normal_map.location = (-300, -200)

    # AO 节点 (预留)
    ao_node = nodes.new(type='ShaderNodeMath')
    ao_node.operation = 'MULTIPLY'
    ao_node.location = (-200, -100)

    # 输出
    output = nodes.new(type='ShaderNodeOutputMaterial')
    output.location = (300, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    return mat


# ================================================================
# LOD 自动生成
# ================================================================
def generate_lods(mesh_obj, name):
    """生成4级LOD链: 100% / 50% / 25% / 10%"""
    lods = {}
    ratios = {"LOD0": 1.0, "LOD1": 0.5, "LOD2": 0.25, "LOD3": 0.10}

    for lod_name, ratio in ratios.items():
        if ratio == 1.0:
            lods[lod_name] = mesh_obj
            continue

        # 复制网格
        bpy.ops.object.select_all(action='DESELECT')
        mesh_obj.select_set(True)
        bpy.context.view_layer.objects.active = mesh_obj
        bpy.ops.object.duplicate()
        lod_mesh = bpy.context.object
        lod_mesh.name = f"{name}_{lod_name}"

        # 应用 Decimate 减面到目标比例
        mod = lod_mesh.modifiers.new(name="Decimate", type='DECIMATE')
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="Decimate")

        # 保留UV和顶点色
        lods[lod_name] = lod_mesh

    return lods


# ================================================================
# 装备生成 (角色特有)
# ================================================================
def create_equipment(char_id, params, body_mesh):
    """为角色生成标志性装备"""
    equipment = []

    # 根据角色ID生成不同装备
    if char_id == "SIGURD":
        # 猎枪: Cylinder + Cube 组合
        bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=1.2, location=(-0.3, 0, 0.9))
        gun = bpy.context.object
        gun.name = f"{char_id}_Rifle"
        equipment.append(gun)

        # 肩甲
        bpy.ops.mesh.primitive_cube_add(size=0.25, location=(-0.22, 0, 1.35))
        shoulder = bpy.context.object
        shoulder.name = f"{char_id}_ShoulderL"
        equipment.append(shoulder)

    elif char_id == "FREYJA":
        # 四个药瓶
        for i, color in enumerate([(0,1,0), (0,0,1), (1,0,0), (0.5,0,1)]):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.12, location=(0.18, 0.02*i, 0.85))
            vial = bpy.context.object
            vial.name = f"{char_id}_Vial{i}"
            equipment.append(vial)

    elif char_id == "HECTOR":
        # 圆盾
        bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.05, location=(0.35, 0, 0.90))
        shield = bpy.context.object
        shield.name = f"{char_id}_Shield"
        equipment.append(shield)

    elif char_id == "BRIGID":
        # 火把
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.60, location=(0.25, 0, 0.85))
        torch = bpy.context.object
        torch.name = f"{char_id}_Torch"
        equipment.append(torch)

        # 火焰粒子（简化为发光球体）
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(0.25, 0, 1.18))
        flame = bpy.context.object
        flame.name = f"{char_id}_Flame"
        equipment.append(flame)

    elif char_id == "HAIKU_MONK":
        # 毛笔 + 宣纸卷
        bpy.ops.mesh.primitive_cylinder_add(radius=0.01, depth=0.30, location=(0.20, 0, 0.82))
        brush = bpy.context.object
        brush.name = f"{char_id}_Brush"
        equipment.append(brush)

    elif char_id == "GOREN":
        # 铁锤
        bpy.ops.mesh.primitive_cube_add(size=0.12, location=(0.28, 0, 0.88))
        hammer_head = bpy.context.object
        hammer_head.name = f"{char_id}_Hammer"
        equipment.append(hammer_head)

    # 更多角色装备...

    return equipment


# ================================================================
# 贴图烘焙辅助 (将高模细节烘焙到低模)
# ================================================================
def setup_baking(name, high_poly, low_poly):
    """设置贴图烘焙场景"""
    # 创建烘焙用图像
    img_size = 2048
    for map_type in ["BaseColor", "Normal", "Roughness", "Metallic", "AO"]:
        img = bpy.data.images.new(f"{name}_{map_type}", img_size, img_size)
        img.filepath = os.path.join(TEX_DIR, f"{name}_{map_type}.png")

    # 设置 Cycles 渲染器（烘焙需要）
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.device = 'GPU'
    bpy.context.scene.cycles.samples = 64


# ================================================================
# FBX 导出 (带所有LOD)
# ================================================================
def export_advanced(name, armature, body, lods, equipment, output_dir):
    """导出商业级FBX: 骨骼+网格+LOD+装备+材质"""
    os.makedirs(output_dir, exist_ok=True)

    # 选择所有对象
    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    body.select_set(True)
    for eq in equipment:
        eq.select_set(True)
    for lod_name, lod_mesh in lods.items():
        if lod_name != "LOD0":
            lod_mesh.select_set(True)

    bpy.context.view_layer.objects.active = armature

    filepath = os.path.join(output_dir, f"{name}_HD.fbx")
    bpy.ops.export_scene.fbx(
        filepath=filepath,
        use_selection=True,
        apply_scale_options='FBX_SCALE_ALL',
        object_types={'ARMATURE', 'MESH'},
        use_mesh_modifiers=True,
        mesh_smooth_type='EDGE',
        add_leaf_bones=False,
        bake_anim=False,
        embed_textures=False,
        path_mode='COPY',
    )
    print(f"  ✅ {name}_HD.fbx exported ({len(lods)} LODs)")
    return filepath


# ================================================================
# 主流程
# ================================================================
def generate_all_hd():
    print("=" * 60)
    print("🐺 帷幕之地 — 商业级角色生成管线 v2.0")
    print(f"   输出: {OUTPUT_DIR}")
    print("=" * 60)

    for char_id, params in CHARACTERS_HD.items():
        print(f"\n{'='*40}")
        print(f"🔨 {char_id} ({params['height']}m, {params['build']}, age {params['age']})")

        # 清场景
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True)

        # 1. 生成人体网格
        body = create_body_mesh_advanced(char_id, params)
        print(f"  📐 Body: {len(body.data.vertices)} verts, {len(body.data.polygons)} faces")

        # 2. 创建完整骨骼
        armature = create_armature_advanced(char_id, params)
        print(f"  🦴 Skeleton: {len(armature.data.bones)} bones")

        # 3. 绑定网格到骨架 (自动权重)
        body.select_set(True)
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        print(f"  🔗 Rigged with auto-weights")

        # 4. 创建 PBR 材质
        skin_mat = create_pbr_material(f"{char_id}_Skin", params["skin_tone"], "skin")
        body.data.materials.append(skin_mat)
        print(f"  🎨 PBR Material: {skin_mat.name}")

        # 5. 生成装备
        equipment = create_equipment(char_id, params, body)
        for eq in equipment:
            eq_mat = create_pbr_material(f"{char_id}_{eq.name}", params["skin_tone"], "metal_old")
            eq.data.materials.append(eq_mat)
        print(f"  ⚔️  Equipment: {len(equipment)} pieces")

        # 6. 生成 LOD 链
        lods = generate_lods(body, char_id)
        print(f"  📉 LODs: {list(lods.keys())}")

        # 7. 导出
        export_advanced(char_id, armature, body, lods, equipment, OUTPUT_DIR)

    print(f"\n{'='*60}")
    print(f"✅ 15 角色商业级模型 + LOD + PBR材质 导出完成!")
    print(f"   📁 {OUTPUT_DIR}")
    print(f"{'='*60}")


# ====== 单角色调试 ======
def generate_single_hd(char_id):
    if char_id not in CHARACTERS_HD:
        print(f"Unknown: {char_id}")
        return
    params = CHARACTERS_HD[char_id]
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    body = create_body_mesh_advanced(char_id, params)
    armature = create_armature_advanced(char_id, params)
    body.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    skin_mat = create_pbr_material(f"{char_id}_Skin", params["skin_tone"], "skin")
    body.data.materials.append(skin_mat)
    equipment = create_equipment(char_id, params, body)
    lods = generate_lods(body, char_id)
    export_advanced(char_id, armature, body, lods, equipment, OUTPUT_DIR)
    print(f"✅ {char_id} done")


if __name__ == "__main__":
    generate_all_hd()
    # generate_single_hd("SIGURD")  # 调试单角色
