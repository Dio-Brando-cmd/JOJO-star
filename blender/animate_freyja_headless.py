"""
══════════════════════════════════════════════════════════════
芙蕾雅动画 — 无头模式 (Blender 5.2 LTS + UniRig 骨架)
══════════════════════════════════════════════════════════════

用法:
  blender --background --python animate_freyja_headless.py

══════════════════════════════════════════════════════════════
"""

import bpy
import os
import sys
import math
import random

# ——— 配置 ————————————————————————————————————————
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PARENT_ROOT = os.path.dirname(PROJECT_ROOT)
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "Freyja_Animations")

CANDIDATE_MODELS = [
    os.path.join(PARENT_ROOT, "芙蕾雅4.glb"),
    os.path.join(PARENT_ROOT, "芙蕾雅4.fbx"),
]

ANIM_LENGTHS = {
    "Idle": 120, "Walk": 32, "Run": 24, "ThrowPotion": 45,
    "UseCharm": 60, "GatherPlant": 50, "HitReaction": 30,
    "Death": 90, "Crouch": 120, "CrouchWalk": 40,
}

FRAME_RATE = 30


# ——— 文件查找 —————————————————————————————————————
def find_model():
    for path in CANDIDATE_MODELS:
        if os.path.exists(path):
            return path
    print("❌ 未找到模型！")
    for p in CANDIDATE_MODELS:
        print(f"   {p}  {'✅' if os.path.exists(p) else '❌'}")
    return None


# ——— 场景清理 & 导入 ——————————————————————————————
def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)
    for block in list(bpy.data.armatures):
        bpy.data.armatures.remove(block)
    for block in list(bpy.data.actions):
        bpy.data.actions.remove(block)


def import_model(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=filepath)
    elif ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=filepath)
    print(f"✅ 导入: {filepath}")


def find_armature():
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            return obj
    for obj in bpy.context.scene.objects:
        for child in obj.children_recursive:
            if child.type == 'ARMATURE':
                return child
    return None


def find_meshes(armature):
    meshes = []
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            for mod in obj.modifiers:
                if mod.type == 'ARMATURE' and mod.object == armature:
                    meshes.append(obj)
                    break
    if not meshes:
        for child in armature.children_recursive:
            if child.type == 'MESH':
                meshes.append(child)
    return meshes


# ——— UniRig 骨骼识别 ——————————————————————————————
def detect_unirig_bones(armature):
    """
    UniRig 使用 Bone_000 ~ Bone_0XX 通用命名。
    典型结构:
      Root(Bone_000) → Hips(Bone_001) → [Spine(Bone_005), Leg_L(Bone_010), Leg_R(Bone_015)]
      Spine → ... → Chest(Bone_002) → [Head, Arm_L(Bone_025), Arm_R(Bone_033)]
    通过层级深度和子树特征来推断骨骼角色。
    """
    all_bones = armature.data.bones
    bone_map = {}

    def chain_depth(bone):
        if not bone.children:
            return 1
        return 1 + max(chain_depth(c) for c in bone.children)

    def collect_chain(bone):
        chain = [bone]
        while bone.children:
            bone = max(bone.children, key=lambda c: chain_depth(c))
            chain.append(bone)
        return chain

    # 1. 找根骨骼 (Bone_000)
    roots = [b for b in all_bones if b.parent is None]
    if not roots:
        print("   ⚠️  没有根骨骼！")
        return bone_map
    root = roots[0]
    print(f"   根: {root.name}")

    # 2. 找髋部 = 根的唯一子骨骼 (Bone_001)
    root_kids = list(root.children)
    if not root_kids:
        print("   ⚠️  根骨骼没有子骨骼！")
        return bone_map

    hips = root_kids[0]  # UniRig 中根只有一个子骨骼 = 髋部
    bone_map["hips"] = hips.name
    print(f"   髋: {hips.name}")

    # 3. 髋的子骨骼: 脊椎 + 两条腿
    hip_kids = sorted(hips.children, key=lambda c: chain_depth(c), reverse=True)
    print(f"   髋的子骨骼 ({len(hip_kids)}): {[f'{k.name}(depth={chain_depth(k)})' for k in hip_kids]}")

    if len(hip_kids) >= 3:
        spine_root = hip_kids[0]   # 最深 → 脊椎
        leg_a = hip_kids[1]        # 腿
        leg_b = hip_kids[2]        # 腿
    elif len(hip_kids) == 2:
        spine_root = hip_kids[0]
        leg_a = hip_kids[1]
        leg_b = None
    else:
        spine_root = hip_kids[0]
        leg_a = leg_b = None

    # — 4. 分析脊椎链 → 找到分叉点 (胸/肩) ————————————
    # 脊椎链沿最长子链走: Bone_005→004→003→002→033→...→026
    # 在分叉点 Bone_002 有 3 个子骨骼（头+左臂+右臂）
    spine_chain = collect_chain(spine_root)
    print(f"   脊椎链: {[b.name for b in spine_chain]}")

    # 在脊椎链中找 "分叉点"：子骨骼 ≥ 3 的骨骼
    fork_bone = None
    fork_idx = -1
    for i, bone in enumerate(spine_chain):
        if len(bone.children) >= 3:
            fork_bone = bone
            fork_idx = i
            break

    if fork_bone:
        print(f"   分叉点: {fork_bone.name} (子: {[c.name for c in fork_bone.children]})")

        # 分叉点之前的脊柱骨骼
        if fork_idx >= 1:
            bone_map["spine_upper"] = spine_chain[fork_idx - 1].name
        if fork_idx >= 2:
            bone_map["spine_lower"] = spine_chain[fork_idx - 2].name

        # 分叉点的子骨骼: 头(最浅) + 左臂 + 右臂
        fork_children = sorted(fork_bone.children, key=lambda c: chain_depth(c))
        print(f"   分叉子骨骼(按深度): {[(c.name, chain_depth(c)) for c in fork_children]}")

        if len(fork_children) >= 3:
            head_root = fork_children[0]   # 最浅 = 头颈
            arm_a = fork_children[1]
            arm_b = fork_children[2]

            # 头链
            head_chain = collect_chain(head_root)
            bone_map["neck"] = head_root.name
            bone_map["head"] = head_chain[-1].name
            print(f"   头链: {[b.name for b in head_chain]}")

            # 用骨骼 X 坐标区分左右臂 (负X=左, 正X=右)
            def bone_x(b):
                return b.head_local.x

            # 对于手臂链，取整条链的平均 X
            def chain_avg_x(bone):
                chain = collect_chain(bone)
                return sum(b.head_local.x for b in chain) / len(chain)

            x_a = chain_avg_x(arm_a)
            x_b = chain_avg_x(arm_b)

            left_arm = arm_a if x_a > x_b else arm_b   # Blender中负X方向可能是左臂
            right_arm = arm_b if x_a > x_b else arm_a

            # 直接用 head 坐标判断：正X侧 → 左臂
            head_x = bone_map["head"] and all_bones[bone_map["head"]].head_local.x or 0
            x_a = arm_a.head_local.x
            x_b = arm_b.head_local.x
            left_arm = arm_a if x_a > x_b else arm_b
            right_arm = arm_b if x_a > x_b else arm_a

            for side, arm_root in [("left", left_arm), ("right", right_arm)]:
                arm_chain = collect_chain(arm_root)
                print(f"   {'左手' if side=='left' else '右手'}臂链: {[b.name for b in arm_chain]}")
                if len(arm_chain) >= 1:
                    bone_map[f"upperarm_{side}"] = arm_chain[0].name
                if len(arm_chain) >= 2:
                    bone_map[f"forearm_{side}"] = arm_chain[1].name
                if len(arm_chain) >= 3:
                    bone_map[f"hand_{side}"] = arm_chain[2].name

        elif len(fork_children) == 2:
            # 没有独立的头，两个是手臂
            x_a = fork_children[0].head_local.x
            x_b = fork_children[1].head_local.x
            left_arm = fork_children[0] if x_a > x_b else fork_children[1]
            right_arm = fork_children[1] if x_a > x_b else fork_children[0]
            for side, arm_root in [("left", left_arm), ("right", right_arm)]:
                arm_chain = collect_chain(arm_root)
                if len(arm_chain) >= 1:
                    bone_map[f"upperarm_{side}"] = arm_chain[0].name
                if len(arm_chain) >= 2:
                    bone_map[f"forearm_{side}"] = arm_chain[1].name

    # — 5. 腿 ————————————————————————————————————
    for i, leg_root in enumerate([leg_a, leg_b]):
        if leg_root is None:
            continue
        leg_chain = collect_chain(leg_root)
        # 用 X 坐标判断左右腿
        x = leg_root.head_local.x
        # 正X = 左腿（与手臂同理）
        side = "left" if x > 0 else "right"
        # 如果两条腿都在同一侧（不太可能），用顺序区分
        if f"thigh_{side}" in bone_map:
            side = "left" if i == 0 else "right"

        print(f"   {'左' if side=='left' else '右'}腿链: {[b.name for b in leg_chain]}")
        if len(leg_chain) >= 1:
            bone_map[f"thigh_{side}"] = leg_chain[0].name
        if len(leg_chain) >= 2:
            bone_map[f"shin_{side}"] = leg_chain[1].name
        if len(leg_chain) >= 3:
            bone_map[f"foot_{side}"] = leg_chain[2].name
        if len(leg_chain) >= 4:
            bone_map[f"toe_{side}"] = leg_chain[3].name

    print(f"\n   📋 映射结果 ({len(bone_map)} 个骨骼):")
    for key in sorted(bone_map):
        print(f"     {key:20s} → {bone_map[key]}")

    return bone_map


# ——— 动画工具 —————————————————————————————————————
def clear_pose(armature):
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.rot_clear()
    bpy.ops.pose.loc_clear()
    bpy.ops.pose.scale_clear()
    bpy.ops.object.mode_set(mode='OBJECT')


def create_action(armature, name, length, loop=False):
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='OBJECT')
    action = bpy.data.actions.new(name=name)
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action
    if loop:
        action.use_frame_range = True
        action.frame_start = 0
        action.frame_end = length
    return action


def insert_keyframe(bone, frame, armature, rotation=True, location=False):
    bpy.context.scene.frame_set(frame)
    if rotation:
        if bone.rotation_mode == 'QUATERNION':
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        else:
            bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    if location:
        bone.keyframe_insert(data_path="location", frame=frame)


def add_cycle_modifier(action):
    """给 F-Curve 添加循环修改器 (兼容 Blender 5.2)"""
    try:
        fcurves = action.fcurves
        if fcurves is None or len(fcurves) == 0:
            return
        for fcurve in fcurves:
            mod = fcurve.modifiers.new('CYCLES')
            mod.mode_before = 'REPEAT'
            mod.mode_after = 'REPEAT'
    except (AttributeError, TypeError):
        pass  # 无关键帧时不报错


# ——— 动画生成 —————————————————————————————————————
def animate_idle(armature, bones):
    length = ANIM_LENGTHS["Idle"]
    action = create_action(armature, "Idle", length, loop=True)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length
        breath = math.sin(t * math.pi * 2 * 1.5) * 0.03

        if "spine_upper" in bones:
            pb[bones["spine_upper"]].rotation_euler.x = breath
            insert_keyframe(pb[bones["spine_upper"]], frame, armature)
        if "spine_lower" in bones:
            pb[bones["spine_lower"]].rotation_euler.x = breath * 0.5
            insert_keyframe(pb[bones["spine_lower"]], frame, armature)

        arm_sway = math.sin(t * math.pi * 2 * 0.8 + 1.2) * 0.02
        for side in ["left", "right"]:
            key = f"upperarm_{side}"
            if key in bones:
                pb[bones[key]].rotation_euler.z = arm_sway if side == "right" else -arm_sway
                insert_keyframe(pb[bones[key]], frame, armature)

        if "head" in bones:
            pb[bones["head"]].rotation_euler.z = math.sin(t * math.pi * 2 * 0.3) * 0.04
            insert_keyframe(pb[bones["head"]], frame, armature)
        if "hips" in bones:
            pb[bones["hips"]].rotation_euler.z = math.sin(t * math.pi * 2 * 0.6) * 0.015
            insert_keyframe(pb[bones["hips"]], frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Idle — 呼吸待机")


def animate_walk(armature, bones):
    length = ANIM_LENGTHS["Walk"]
    action = create_action(armature, "Walk", length, loop=True)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length
        phase_r = t * math.pi * 2
        phase_l = phase_r + math.pi

        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"thigh_{side}" in bones:
                pb[bones[f"thigh_{side}"]].rotation_euler.x = math.sin(phase) * 0.35
                insert_keyframe(pb[bones[f"thigh_{side}"]], frame, armature)
            if f"shin_{side}" in bones:
                pb[bones[f"shin_{side}"]].rotation_euler.x = max(0, -math.cos(phase)) * 0.4
                insert_keyframe(pb[bones[f"shin_{side}"]], frame, armature)

        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"upperarm_{side}" in bones:
                pb[bones[f"upperarm_{side}"]].rotation_euler.x = math.cos(phase) * 0.2
                insert_keyframe(pb[bones[f"upperarm_{side}"]], frame, armature)

        if "hips" in bones:
            pb[bones["hips"]].location.z = abs(math.sin(t * math.pi * 2)) * 0.04
            insert_keyframe(pb[bones["hips"]], frame, armature, location=True)
        if "spine_upper" in bones:
            pb[bones["spine_upper"]].rotation_euler.y = math.sin(t * math.pi * 2) * 0.08
            insert_keyframe(pb[bones["spine_upper"]], frame, armature)

    add_cycle_modifier(action)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Walk — 走路循环")


def animate_run(armature, bones):
    length = ANIM_LENGTHS["Run"]
    action = create_action(armature, "Run", length, loop=True)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length
        phase_r = t * math.pi * 2
        phase_l = phase_r + math.pi

        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"thigh_{side}" in bones:
                pb[bones[f"thigh_{side}"]].rotation_euler.x = math.sin(phase) * 0.55
                insert_keyframe(pb[bones[f"thigh_{side}"]], frame, armature)
            if f"shin_{side}" in bones:
                pb[bones[f"shin_{side}"]].rotation_euler.x = max(0, -math.cos(phase)) * 0.7
                insert_keyframe(pb[bones[f"shin_{side}"]], frame, armature)

        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"upperarm_{side}" in bones:
                pb[bones[f"upperarm_{side}"]].rotation_euler.x = math.cos(phase) * 0.45
                insert_keyframe(pb[bones[f"upperarm_{side}"]], frame, armature)
            if f"forearm_{side}" in bones:
                pb[bones[f"forearm_{side}"]].rotation_euler.x = -0.5
                insert_keyframe(pb[bones[f"forearm_{side}"]], frame, armature)

        if "spine_lower" in bones:
            pb[bones["spine_lower"]].rotation_euler.x = 0.25
            insert_keyframe(pb[bones["spine_lower"]], frame, armature)

    add_cycle_modifier(action)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Run — 跑步循环")


def animate_throw_potion(armature, bones):
    length = ANIM_LENGTHS["ThrowPotion"]
    action = create_action(armature, "ThrowPotion", length, loop=False)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    def ease(t):
        return t * t * (3 - 2 * t)

    for frame in range(0, length, 3):
        t = frame / length
        if t < 0.15:
            p = t / 0.15
            if "upperarm_right" in bones:
                pb[bones["upperarm_right"]].rotation_euler.x = 0.2 * p
                pb[bones["upperarm_right"]].rotation_euler.z = -0.3 * p
                insert_keyframe(pb[bones["upperarm_right"]], frame, armature)
            if "forearm_right" in bones:
                pb[bones["forearm_right"]].rotation_euler.x = -0.5 * p
                insert_keyframe(pb[bones["forearm_right"]], frame, armature)
        elif t < 0.35:
            p = ease((t - 0.15) / 0.2)
            if "upperarm_right" in bones:
                pb[bones["upperarm_right"]].rotation_euler.x = 0.2 - p * 1.5
                pb[bones["upperarm_right"]].rotation_euler.z = -0.3
                insert_keyframe(pb[bones["upperarm_right"]], frame, armature)
            if "forearm_right" in bones:
                pb[bones["forearm_right"]].rotation_euler.x = -0.5 + p * 0.3
                insert_keyframe(pb[bones["forearm_right"]], frame, armature)
        elif t < 0.6:
            p = ease((t - 0.35) / 0.25)
            if "upperarm_right" in bones:
                pb[bones["upperarm_right"]].rotation_euler.x = -1.3 - p * 0.8
                insert_keyframe(pb[bones["upperarm_right"]], frame, armature)
            if "forearm_right" in bones:
                pb[bones["forearm_right"]].rotation_euler.x = -0.2 - p * 0.8
                insert_keyframe(pb[bones["forearm_right"]], frame, armature)
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = p * 0.15
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)
        elif t < 0.75:
            p = (t - 0.6) / 0.15
            if "upperarm_right" in bones:
                pb[bones["upperarm_right"]].rotation_euler.x = -2.1 + p * 3.3
                insert_keyframe(pb[bones["upperarm_right"]], frame, armature)
            if "forearm_right" in bones:
                pb[bones["forearm_right"]].rotation_euler.x = -1.0 + p * 1.5
                insert_keyframe(pb[bones["forearm_right"]], frame, armature)
        else:
            p = (t - 0.75) / 0.25
            if "upperarm_right" in bones:
                pb[bones["upperarm_right"]].rotation_euler.x = 1.2 * (1 - p)
                pb[bones["upperarm_right"]].rotation_euler.z = -0.3 * (1 - p)
                insert_keyframe(pb[bones["upperarm_right"]], frame, armature)
            if "forearm_right" in bones:
                pb[bones["forearm_right"]].rotation_euler.x = 0.5 * (1 - p)
                insert_keyframe(pb[bones["forearm_right"]], frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ ThrowPotion — 投掷药剂")


def animate_use_charm(armature, bones):
    length = ANIM_LENGTHS["UseCharm"]
    action = create_action(armature, "UseCharm", length, loop=False)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 3):
        t = frame / length
        if t < 0.3:
            p = t / 0.3
            for side in ["left", "right"]:
                if f"upperarm_{side}" in bones:
                    pb[bones[f"upperarm_{side}"]].rotation_euler.x = 0.8 * p
                    pb[bones[f"upperarm_{side}"]].rotation_euler.z = (0.3 if side == "left" else -0.3) * p
                    insert_keyframe(pb[bones[f"upperarm_{side}"]], frame, armature)
                if f"forearm_{side}" in bones:
                    pb[bones[f"forearm_{side}"]].rotation_euler.x = -1.2 * p
                    insert_keyframe(pb[bones[f"forearm_{side}"]], frame, armature)
        elif t < 0.6:
            p = (t - 0.3) / 0.3
            tremble = math.sin(p * math.pi * 6) * 0.03 * (1 - p * 0.5)
            for side in ["left", "right"]:
                if f"upperarm_{side}" in bones:
                    pb[bones[f"upperarm_{side}"]].rotation_euler.x = 0.8 + tremble
                    pb[bones[f"upperarm_{side}"]].rotation_euler.z = (0.3 if side == "left" else -0.3) + tremble
                    insert_keyframe(pb[bones[f"upperarm_{side}"]], frame, armature)
        elif t < 0.85:
            p = (t - 0.6) / 0.25
            for side in ["left", "right"]:
                if f"upperarm_{side}" in bones:
                    pb[bones[f"upperarm_{side}"]].rotation_euler.x = 0.8 - p * 1.5
                    insert_keyframe(pb[bones[f"upperarm_{side}"]], frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ UseCharm — 愈灵符")


def animate_gather_plant(armature, bones):
    length = ANIM_LENGTHS["GatherPlant"]
    action = create_action(armature, "GatherPlant", length, loop=False)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 3):
        t = frame / length
        if t < 0.3:
            p = t / 0.3
            if "spine_lower" in bones:
                pb[bones["spine_lower"]].rotation_euler.x = p * 0.6
                insert_keyframe(pb[bones["spine_lower"]], frame, armature)
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = p * 0.8
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)
            if "upperarm_right" in bones:
                pb[bones["upperarm_right"]].rotation_euler.x = p * 1.2
                insert_keyframe(pb[bones["upperarm_right"]], frame, armature)
        elif t < 0.8:
            p = (t - 0.6) / 0.2
            if "upperarm_right" in bones:
                pb[bones["upperarm_right"]].rotation_euler.x = 1.2 - p * 0.8
                insert_keyframe(pb[bones["upperarm_right"]], frame, armature)
        else:
            p = (t - 0.8) / 0.2
            if "spine_lower" in bones:
                pb[bones["spine_lower"]].rotation_euler.x = 0.6 * (1 - p)
                insert_keyframe(pb[bones["spine_lower"]], frame, armature)
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = 0.8 * (1 - p)
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ GatherPlant — 弯腰采集")


def animate_hit_reaction(armature, bones):
    length = ANIM_LENGTHS["HitReaction"]
    action = create_action(armature, "HitReaction", length, loop=False)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length
        if t < 0.15:
            p = t / 0.15
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = -p * 0.4
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)
        elif t < 0.4:
            p = (t - 0.15) / 0.25
            wobble = math.sin(p * math.pi * 3) * 0.06 * (1 - p)
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = -0.4 + wobble
                pb[bones["spine_upper"]].rotation_euler.z = wobble * 1.5
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)
        elif t < 0.7:
            p = (t - 0.4) / 0.3
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = -0.4 * (1 - p * 0.7)
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)
        else:
            p = (t - 0.7) / 0.3
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = -0.12 * (1 - p)
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ HitReaction — 受击反应")


def animate_death(armature, bones):
    length = ANIM_LENGTHS["Death"]
    action = create_action(armature, "Death", length, loop=False)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 3):
        t = frame / length
        if t < 0.2:
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = -0.15
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)
        elif t < 0.45:
            p = (t - 0.2) / 0.25
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = -0.15 - p * 0.6
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)
            if "upperarm_right" in bones:
                pb[bones["upperarm_right"]].rotation_euler.x = p * 0.5
                pb[bones["upperarm_right"]].rotation_euler.z = -p * 0.5
                insert_keyframe(pb[bones["upperarm_right"]], frame, armature)
            if "forearm_right" in bones:
                pb[bones["forearm_right"]].rotation_euler.x = -p * 1.2
                insert_keyframe(pb[bones["forearm_right"]], frame, armature)
        elif t < 0.7:
            p = (t - 0.45) / 0.25
            if "hips" in bones:
                pb[bones["hips"]].location.z = -p * 0.8
                insert_keyframe(pb[bones["hips"]], frame, armature, location=True)
            for side in ["left", "right"]:
                if f"thigh_{side}" in bones:
                    pb[bones[f"thigh_{side}"]].rotation_euler.x = p * 0.7
                    insert_keyframe(pb[bones[f"thigh_{side}"]], frame, armature)
                if f"shin_{side}" in bones:
                    pb[bones[f"shin_{side}"]].rotation_euler.x = -p * 1.2
                    insert_keyframe(pb[bones[f"shin_{side}"]], frame, armature)
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = -0.75 - p * 0.5
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)
        else:
            p = (t - 0.7) / 0.3
            if "spine_upper" in bones:
                pb[bones["spine_upper"]].rotation_euler.x = -1.25 * (1 + p * 0.2)
                pb[bones["spine_upper"]].rotation_euler.z = p * 0.8
                insert_keyframe(pb[bones["spine_upper"]], frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Death — 死亡倒地")


def animate_crouch(armature, bones):
    length = ANIM_LENGTHS["Crouch"]
    action = create_action(armature, "Crouch", length, loop=True)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length
        breath = math.sin(t * math.pi * 2 * 1.8) * 0.02
        if "hips" in bones:
            pb[bones["hips"]].location.z = -0.5
            insert_keyframe(pb[bones["hips"]], frame, armature, location=True)
        for side in ["left", "right"]:
            if f"thigh_{side}" in bones:
                pb[bones[f"thigh_{side}"]].rotation_euler.x = 0.6 + breath
                insert_keyframe(pb[bones[f"thigh_{side}"]], frame, armature)
            if f"shin_{side}" in bones:
                pb[bones[f"shin_{side}"]].rotation_euler.x = -1.0 + breath * 0.5
                insert_keyframe(pb[bones[f"shin_{side}"]], frame, armature)
        if "spine_upper" in bones:
            pb[bones["spine_upper"]].rotation_euler.x = 0.15 + breath
            insert_keyframe(pb[bones["spine_upper"]], frame, armature)

    add_cycle_modifier(action)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Crouch — 蹲伏")


def animate_crouch_walk(armature, bones):
    length = ANIM_LENGTHS["CrouchWalk"]
    action = create_action(armature, "CrouchWalk", length, loop=True)
    bpy.ops.object.mode_set(mode='POSE')
    pb = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length
        phase_r = t * math.pi * 2
        phase_l = phase_r + math.pi
        if "hips" in bones:
            pb[bones["hips"]].location.z = -0.5
            insert_keyframe(pb[bones["hips"]], frame, armature, location=True)
        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"thigh_{side}" in bones:
                pb[bones[f"thigh_{side}"]].rotation_euler.x = 0.6 + math.sin(phase) * 0.2
                insert_keyframe(pb[bones[f"thigh_{side}"]], frame, armature)
            if f"shin_{side}" in bones:
                pb[bones[f"shin_{side}"]].rotation_euler.x = -1.0 + max(0, -math.cos(phase)) * 0.3
                insert_keyframe(pb[bones[f"shin_{side}"]], frame, armature)

    add_cycle_modifier(action)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ CrouchWalk — 蹲伏移动")


# ——— 导出 ————————————————————————————————————————

def export_fbx_all_in_one(armature, meshes, output_dir):
    """所有动画打包在一个 FBX 中（Unity 推荐方式）"""
    os.makedirs(output_dir, exist_ok=True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='OBJECT')

    # 把 action 推入 NLA tracks
    if armature.animation_data:
        for track in list(armature.animation_data.nla_tracks):
            armature.animation_data.nla_tracks.remove(track)

    for action in bpy.data.actions:
        track = armature.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, int(action.frame_range[0]), action)
        strip.name = action.name

    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    for m in meshes:
        m.select_set(True)

    filepath = os.path.join(output_dir, "Freyja_AllAnimations.fbx")
    bpy.ops.export_scene.fbx(
        filepath=filepath,
        use_selection=True,
        object_types={'ARMATURE', 'MESH'},
        bake_anim=True,
        bake_anim_use_all_actions=False,
        bake_anim_use_nla_strips=True,
        bake_anim_force_startend_keying=True,
        bake_anim_step=1.0,
        bake_anim_simplify_factor=0.0,
    )
    print(f"   📦 {filepath}")


# ——— 主入口 ——————————————————————————————————————

def main():
    print("\n" + "=" * 60)
    print("  🌿 芙蕾雅动画 — Blender 5.2 + UniRig 全自动")
    print("=" * 60)

    # 1. 导入模型
    model_path = find_model()
    if not model_path:
        sys.exit(1)

    clear_scene()
    import_model(model_path)

    # 2. 定位骨架
    armature = find_armature()
    if not armature:
        print("\n❌ 未找到骨架！场景内容:")
        for obj in bpy.context.scene.objects:
            print(f"     {obj.name} ({obj.type})")
        sys.exit(1)

    print(f"\n✅ 骨架: {armature.name} ({len(armature.data.bones)} 骨骼)")

    # 3. 定位网格
    meshes = find_meshes(armature)
    print(f"✅ 网格: {len(meshes)} 个")
    for m in meshes:
        print(f"     {m.name} ({len(m.data.vertices)} 顶点)")

    # 4. UniRig 骨骼检测
    print(f"\n🔍 UniRig 骨骼分析...")
    bones = detect_unirig_bones(armature)

    if len(bones) < 5:
        print(f"\n⚠️  仅检测到 {len(bones)} 个关键骨骼，尝试降级方案...")
        # 降级：直接用层级编号映射
        # 分析骨架结构
        all_bones = list(armature.data.bones)
        roots = [b for b in all_bones if b.parent is None]
        if roots:
            root = roots[0]
            children = list(root.children)
            if len(children) >= 1:
                # 第一个子骨骼当做 hips，其余的当做腿
                bones["hips"] = children[0].name
                spine_children = list(children[0].children)
                if spine_children:
                    bones["spine_lower"] = spine_children[0].name
                    spine_children2 = list(spine_children[0].children)
                    if spine_children2:
                        bones["spine_upper"] = spine_children2[0].name

                        # 从 spine_upper 的子骨骼中找头和手臂
                        upper_children = list(spine_children2[0].children)
                        if len(upper_children) >= 3:
                            bones["neck"] = upper_children[0].name
                            bones["head"] = upper_children[0].name
                            bones["upperarm_left"] = upper_children[1].name
                            bones["upperarm_right"] = upper_children[2].name
                            # 前臂
                            la_children = list(upper_children[1].children)
                            ra_children = list(upper_children[2].children)
                            if la_children:
                                bones["forearm_left"] = la_children[0].name
                            if ra_children:
                                bones["forearm_right"] = ra_children[0].name

                if len(children) >= 2:
                    bones["thigh_left"] = children[1].name
                    bones["thigh_right"] = children[-1].name

        print(f"   📋 降级映射结果 ({len(bones)} 个骨骼):")
        for key in sorted(bones):
            print(f"     {key:20s} → {bones[key]}")

    if len(bones) < 3:
        print(f"\n❌ 骨骼识别失败，无法生成动画")
        # 打印所有骨骼名称帮助调试
        print(f"\n   骨架全部骨骼:")
        for b in armature.data.bones:
            print(f"     {b.name} (parent: {b.parent.name if b.parent else 'ROOT'})")
        sys.exit(1)

    # 5. 生成动画
    print(f"\n🎬 生成动画...")
    clear_pose(armature)

    animate_idle(armature, bones)
    animate_walk(armature, bones)
    animate_run(armature, bones)
    animate_throw_potion(armature, bones)
    animate_use_charm(armature, bones)
    animate_gather_plant(armature, bones)
    animate_hit_reaction(armature, bones)
    animate_death(armature, bones)
    animate_crouch(armature, bones)
    animate_crouch_walk(armature, bones)

    # 6. 导出
    print(f"\n📦 导出到: {OUTPUT_DIR}")
    export_fbx_all_in_one(armature, meshes, OUTPUT_DIR)

    # 保存 .blend
    blend_path = os.path.join(OUTPUT_DIR, "Freyja_Animations.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"   📦 {blend_path}")

    # 汇总
    print("\n" + "=" * 60)
    print("  ✅ 全部完成！")
    print("=" * 60)
    print(f"""
   Blender 5.2 LTS ✓
   UniRig 骨架 ✓
   生成 {len(bpy.data.actions)} 个动画 ✓
   导出 → {OUTPUT_DIR}

   导入 Unity 步骤:
   1. 把 Freyja_AllAnimations.fbx 拖入 Unity Assets
   2. Rig → Animation Type: Generic (UniRig 不是标准 Humanoid)
   3. Avatar Definition → Create From This Model
   4. 创建 Animator Controller → 拖入动画 clip
   5. 在 Animation 标签页确认每个 clip 的起止帧
   """)


if __name__ == "__main__":
    main()
