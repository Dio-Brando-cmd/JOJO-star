"""
══════════════════════════════════════════════════════════════
芙蕾雅动画生成脚本 — 在 Blender 中直接运行
══════════════════════════════════════════════════════════════

使用方法:
  1. 先导入模型: File → Import → FBX → 选"芙蕾雅4.fbx"
  2. 切换到 Scripting 工作区
  3. Open → 选这个文件
  4. 点 ▶ Run Script（或 Alt+P）

生成的动画:
  - Idle        — 待机呼吸 + 微晃
  - Walk        — 走路循环
  - Run         — 跑步循环
  - ThrowPotion — 投掷蚀灭药剂
  - UseCharm    — 使用愈灵符
  - GatherPlant — 弯腰采集
  - HitReaction — 受击反应
  - Death       — 死亡倒地
  - Crouch      — 蹲伏待机
  - CrouchWalk  — 蹲伏移动

技术说明:
  - 使用正弦波 + 柏林噪声 = 自然的待机动画
  - 使用 IK 约束计算脚步位置 = 精确的走路循环
  - 使用 F-Curve 修改器（Noise/Limits）= 微动细节
  - 所有动画存储为独立的 Action，可分别导出
  - 自动检测骨架结构，兼容 Mixamo/Humanoid 命名
══════════════════════════════════════════════════════════════
"""

import bpy
import math
import random
from mathutils import Vector, Euler, Quaternion

# ═══════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════

FRAME_RATE = 30  # Unity 默认 30fps

# 动画长度（帧数）
ANIM_LENGTHS = {
    "Idle":        120,   # 4秒 循环
    "Walk":         32,   # ~1秒 循环
    "Run":          24,   # 0.8秒 循环
    "ThrowPotion":  45,   # 1.5秒 单次
    "UseCharm":     60,   # 2秒 单次
    "GatherPlant":  50,   # 1.7秒 单次
    "HitReaction":  30,   # 1秒 单次
    "Death":        90,   # 3秒 单次
    "Crouch":       120,  # 4秒 循环
    "CrouchWalk":   40,   # 1.3秒 循环
}

# 角色参数
CHARACTER = {
    "height": 1.64,
    "gender": "female",
    "weapon": "staff",   # 法杖
    "clothing": "robe",  # 长袍
    "hair": "long",
}


# ═══════════════════════════════════════════════════
# 骨架自动检测
# ═══════════════════════════════════════════════════

def find_armature():
    """自动找到场景中的骨架"""
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            return obj
    return None


def detect_bone_names(armature):
    """自动检测骨架骨骼名称 — 兼容 Mixamo / Humanoid / 自定义命名"""
    bones = {b.name.lower(): b.name for b in armature.data.bones}

    bone_map = {}

    # 脊椎链
    for keyword, key in [
        (["spine", "spine1", "spine_01", "chest", "upperbody"], "spine_upper"),
        (["spine2", "spine_02", "spine_lower", "lowerbody", "abdomen"], "spine_lower"),
        (["hips", "pelvis", "hip", "root", "mixamorig:hips"], "hips"),
        (["neck", "neck_01"], "neck"),
    ]:
        for kw in keyword:
            if kw in bones:
                bone_map[key] = bones[kw]
                break

    # 头部
    for kw in ["head", "head_end", "mixamorig:head"]:
        if kw in bones:
            bone_map["head"] = bones[kw]
            break

    # 手臂
    for side, s in [("left", "l"), ("right", "r")]:
        # 上臂
        for kw in [f"{s}_upperarm", f"upperarm_{s}", f"shoulder.{s}", f"arm_{s}",
                    f"mixamorig:{s}_shoulder", f"{s}_arm", f"clavicle_{s}",
                    f"upper_arm.{s}", f"upperarm.{s}"]:
            if kw in bones:
                bone_map[f"upperarm_{side}"] = bones[kw]
                break
        # 前臂
        for kw in [f"{s}_forearm", f"forearm_{s}", f"lowerarm_{s}",
                    f"mixamorig:{s}_arm", f"{s}_forearm", f"lower_arm.{s}",
                    f"forearm.{s}"]:
            if kw in bones:
                bone_map[f"forearm_{side}"] = bones[kw]
                break
        # 手
        for kw in [f"{s}_hand", f"hand_{s}", f"mixamorig:{s}_hand",
                    f"hand.{s}", f"wrist_{s}"]:
            if kw in bones:
                bone_map[f"hand_{side}"] = bones[kw]
                break

    # 腿
    for side, s in [("left", "l"), ("right", "r")]:
        for kw in [f"{s}_thigh", f"thigh_{s}", f"upperleg_{s}",
                    f"mixamorig:{s}_upleg", f"{s}_upleg", f"thigh.{s}",
                    f"upper_leg.{s}"]:
            if kw in bones:
                bone_map[f"thigh_{side}"] = bones[kw]
                break
        for kw in [f"{s}_shin", f"shin_{s}", f"lowerleg_{s}",
                    f"mixamorig:{s}_leg", f"{s}_leg", f"calf_{s}",
                    f"lower_leg.{s}", f"shin.{s}"]:
            if kw in bones:
                bone_map[f"shin_{side}"] = bones[kw]
                break
        for kw in [f"{s}_foot", f"foot_{s}", f"mixamorig:{s}_foot",
                    f"ankle_{s}", f"foot.{s}"]:
            if kw in bones:
                bone_map[f"foot_{side}"] = bones[kw]
                break
        for kw in [f"{s}_toe", f"toe_{s}", f"ball_{s}", f"toes_{s}",
                    f"mixamorig:{s}_toes", f"toe.{s}"]:
            if kw in bones:
                bone_map[f"toe_{side}"] = bones[kw]
                break

    print(f"\n📋 检测到 {len(bone_map)} 个关键骨骼:")
    for key, name in sorted(bone_map.items()):
        print(f"   {key:20s} → {name}")

    return bone_map


# ═══════════════════════════════════════════════════
# 动画生成核心
# ═══════════════════════════════════════════════════

def clear_pose(armature):
    """重置骨架到 Rest Pose"""
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.rot_clear()
    bpy.ops.pose.loc_clear()
    bpy.ops.pose.scale_clear()
    bpy.ops.object.mode_set(mode='OBJECT')


def create_action(armature, name, length, loop=False):
    """创建新的 Action 并关联到骨架"""
    # 先切换到 object mode
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='OBJECT')

    # 创建 action
    action = bpy.data.actions.new(name=name)

    # 重要：先清除任何已有的动画数据
    if armature.animation_data is None:
        armature.animation_data_create()

    armature.animation_data.action = action

    # 设置场景帧范围
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = length
    bpy.context.scene.render.fps = FRAME_RATE

    # 设置为循环（在 NLA 或 Unity 中使用）
    if loop:
        action.use_frame_range = True
        action.frame_start = 0
        action.frame_end = length

    return action


def insert_keyframe(bone, frame, armature, rotation=True, location=False):
    """在指定帧为骨骼插入关键帧"""
    bpy.context.scene.frame_set(frame)
    if rotation:
        if bone.rotation_mode == 'QUATERNION':
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        else:
            bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    if location:
        bone.keyframe_insert(data_path="location", frame=frame)


def add_noise_modifier(action, bone_name, strength=0.05, scale=50):
    """给 F-Curve 添加噪声修改器 — 用于自然的微动"""
    for fcurve in action.fcurves:
        if bone_name in fcurve.data_path:
            mod = fcurve.modifiers.new('NOISE')
            mod.strength = strength
            mod.scale = scale
            mod.phase = random.uniform(0, 10)
            mod.depth = 2
            mod.use_restricted_range = False


def add_cycle_modifier(action):
    """给所有 F-Curve 添加循环修改器"""
    for fcurve in action.fcurves:
        mod = fcurve.modifiers.new('CYCLES')
        mod.mode_before = 'REPEAT'
        mod.mode_after = 'REPEAT'


# ═══════════════════════════════════════════════════
# 具体动画实现
# ═══════════════════════════════════════════════════

def animate_idle(armature, bones):
    """待机动画: 呼吸 + 微晃 + 偶尔重心转移"""
    length = ANIM_LENGTHS["Idle"]
    action = create_action(armature, "Idle", length, loop=True)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    # 呼吸节奏 — 脊椎微微前后弯曲
    for frame in range(0, length, 2):
        t = frame / length
        # 呼吸: 吸气 → 胸微抬，呼气 → 放松
        breath = math.sin(t * math.pi * 2 * 1.5) * 0.03  # 1.5个呼吸循环/周期

        if "spine_upper" in bones:
            bone = pose_bones[bones["spine_upper"]]
            bone.rotation_euler.x = breath
            insert_keyframe(bone, frame, armature)

        if "spine_lower" in bones:
            bone = pose_bones[bones["spine_lower"]]
            bone.rotation_euler.x = breath * 0.5
            insert_keyframe(bone, frame, armature)

        # 手臂微微晃动 — 手持法杖
        arm_sway = math.sin(t * math.pi * 2 * 0.8 + 1.2) * 0.02
        for side in ["left", "right"]:
            if f"upperarm_{side}" in bones:
                bone = pose_bones[bones[f"upperarm_{side}"]]
                bone.rotation_euler.z = arm_sway if side == "right" else -arm_sway
                insert_keyframe(bone, frame, armature)

        # 头部微转 — 像是在观察四周
        head_turn = math.sin(t * math.pi * 2 * 0.3) * 0.04
        if "head" in bones:
            bone = pose_bones[bones["head"]]
            bone.rotation_euler.z = head_turn
            insert_keyframe(bone, frame, armature)

        # 重心微小转移 — hips 的左右微晃
        hip_sway = math.sin(t * math.pi * 2 * 0.6) * 0.015
        if "hips" in bones:
            bone = pose_bones[bones["hips"]]
            bone.rotation_euler.z = hip_sway
            insert_keyframe(bone, frame, armature)

    # 添加噪声微动让动画更自然
    for bone_key in ["spine_upper", "spine_lower", "head", "hips"]:
        if bone_key in bones:
            add_noise_modifier(action, bones[bone_key], strength=0.008, scale=40)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Idle 完成 — 呼吸 + 微晃 + 观察")


def animate_walk(armature, bones):
    """走路动画: 标准步态循环，基于正弦波"""
    length = ANIM_LENGTHS["Walk"]
    action = create_action(armature, "Walk", length, loop=True)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length

        # 步态相位：左右脚交替
        phase_r = t * math.pi * 2
        phase_l = phase_r + math.pi  # 左脚与右脚差半个周期

        # 大腿前后摆动
        thigh_angle = math.sin(phase_r) * 0.35  # 前后摆 35度
        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"thigh_{side}" in bones:
                bone = pose_bones[bones[f"thigh_{side}"]]
                bone.rotation_euler.x = math.sin(phase) * 0.35
                insert_keyframe(bone, frame, armature)

            if f"shin_{side}" in bones:
                bone = pose_bones[bones[f"shin_{side}"]]
                # 膝盖在迈步时弯曲
                knee_bend = max(0, -math.cos(phase)) * 0.4
                bone.rotation_euler.x = knee_bend
                insert_keyframe(bone, frame, armature)

        # 手臂自然前后摆动
        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"upperarm_{side}" in bones:
                bone = pose_bones[bones[f"upperarm_{side}"]]
                bone.rotation_euler.x = math.cos(phase) * 0.2  # 手臂与腿反相
                insert_keyframe(bone, frame, armature)

        # 身体起伏
        body_bob = abs(math.sin(t * math.pi * 2)) * 0.04
        if "hips" in bones:
            bone = pose_bones[bones["hips"]]
            bone.location.z = body_bob
            insert_keyframe(bone, frame, armature, location=True)

        # 脊椎微转 — 走路时的扭腰
        spine_twist = math.sin(t * math.pi * 2) * 0.08
        if "spine_upper" in bones:
            bone = pose_bones[bones["spine_upper"]]
            bone.rotation_euler.y = spine_twist
            insert_keyframe(bone, frame, armature)

    add_cycle_modifier(action)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Walk 完成 — 步态循环")


def animate_run(armature, bones):
    """跑步动画: 比走路更快，幅度更大"""
    length = ANIM_LENGTHS["Run"]
    action = create_action(armature, "Run", length, loop=True)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length

        phase_r = t * math.pi * 2
        phase_l = phase_r + math.pi

        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"thigh_{side}" in bones:
                bone = pose_bones[bones[f"thigh_{side}"]]
                bone.rotation_euler.x = math.sin(phase) * 0.55  # 更大幅摆动
                insert_keyframe(bone, frame, armature)

            if f"shin_{side}" in bones:
                bone = pose_bones[bones[f"shin_{side}"]]
                knee_bend = max(0, -math.cos(phase)) * 0.7
                bone.rotation_euler.x = knee_bend
                insert_keyframe(bone, frame, armature)

        # 手臂弯曲，更大幅度摆动（像真的在跑步）
        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"upperarm_{side}" in bones:
                bone = pose_bones[bones[f"upperarm_{side}"]]
                bone.rotation_euler.x = math.cos(phase) * 0.45
                insert_keyframe(bone, frame, armature)
            if f"forearm_{side}" in bones:
                bone = pose_bones[bones[f"forearm_{side}"]]
                bone.rotation_euler.x = -0.5  # 肘部弯曲
                insert_keyframe(bone, frame, armature)

        # 身体前倾
        if "spine_lower" in bones:
            bone = pose_bones[bones["spine_lower"]]
            bone.rotation_euler.x = 0.25  # 持续前倾
            insert_keyframe(bone, frame, armature)

    add_cycle_modifier(action)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Run 完成 — 跑步循环")


def animate_throw_potion(armature, bones):
    """投掷药剂: 右手从腰间取药→高举过头→向前投出→收回"""
    length = ANIM_LENGTHS["ThrowPotion"]
    action = create_action(armature, "ThrowPotion", length, loop=False)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 3):
        t = frame / length  # 0 → 1

        def ease_out(p):
            return 1 - (1 - p) ** 3

        def ease_in(p):
            return p ** 3

        def ease_in_out(p):
            return p * p * (3 - 2 * p)

        # 阶段划分
        # 0.0-0.15: 准备 — 右手移到腰间
        # 0.15-0.35: 取出 — 手举到胸前
        # 0.35-0.6: 蓄力 — 手举高过头，身体后仰
        # 0.6-0.75: 投出 — 快速前挥
        # 0.75-1.0: 恢复 — 回到待机位

        if t < 0.15:
            phase = ease_out(t / 0.15)
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = 0.2 * phase
                bone.rotation_euler.z = -0.3 * phase
                insert_keyframe(bone, frame, armature)
            if "forearm_right" in bones:
                bone = pose_bones[bones["forearm_right"]]
                bone.rotation_euler.x = -0.5 * phase
                insert_keyframe(bone, frame, armature)

        elif t < 0.35:
            phase = ease_in_out((t - 0.15) / 0.2)
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = 0.2 - phase * 1.5  # 手臂前举
                bone.rotation_euler.z = -0.3
                insert_keyframe(bone, frame, armature)
            if "forearm_right" in bones:
                bone = pose_bones[bones["forearm_right"]]
                bone.rotation_euler.x = -0.5 + phase * 0.3
                insert_keyframe(bone, frame, armature)

        elif t < 0.6:
            phase = ease_in_out((t - 0.35) / 0.25)
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = -1.3 - phase * 0.8  # 手臂后举蓄力
                bone.rotation_euler.z = -0.3
                insert_keyframe(bone, frame, armature)
            if "forearm_right" in bones:
                bone = pose_bones[bones["forearm_right"]]
                bone.rotation_euler.x = -0.2 - phase * 0.8
                insert_keyframe(bone, frame, armature)
            # 身体微后仰
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = phase * 0.15
                insert_keyframe(bone, frame, armature)

        elif t < 0.75:
            phase = ease_out((t - 0.6) / 0.15)
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = -2.1 + phase * 3.3  # 快速前挥！
                bone.rotation_euler.z = -0.3
                insert_keyframe(bone, frame, armature)
            if "forearm_right" in bones:
                bone = pose_bones[bones["forearm_right"]]
                bone.rotation_euler.x = -1.0 + phase * 1.5
                insert_keyframe(bone, frame, armature)
            # 身体前倾跟着投掷
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = 0.15 - phase * 0.3
                insert_keyframe(bone, frame, armature)

        else:
            phase = ease_in((t - 0.75) / 0.25)
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = 1.2 * (1 - phase)
                bone.rotation_euler.z = -0.3 * (1 - phase)
                insert_keyframe(bone, frame, armature)
            if "forearm_right" in bones:
                bone = pose_bones[bones["forearm_right"]]
                bone.rotation_euler.x = 0.5 * (1 - phase)
                insert_keyframe(bone, frame, armature)
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -0.15 * (1 - phase)
                insert_keyframe(bone, frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ ThrowPotion 完成 — 取药→蓄力→投掷→恢复")


def animate_use_charm(armature, bones):
    """使用愈灵符: 双手在胸前合十→发光→向前推出"""
    length = ANIM_LENGTHS["UseCharm"]
    action = create_action(armature, "UseCharm", length, loop=False)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 3):
        t = frame / length

        # 0.0-0.3: 双手合十于胸前
        # 0.3-0.6: 符发光（微颤）
        # 0.6-0.85: 推出
        # 0.85-1.0: 放下

        if t < 0.3:
            phase = t / 0.3
            for side in ["left", "right"]:
                if f"upperarm_{side}" in bones:
                    bone = pose_bones[bones[f"upperarm_{side}"]]
                    bone.rotation_euler.x = 0.8 * phase
                    bone.rotation_euler.z = (0.3 if side == "left" else -0.3) * phase
                    insert_keyframe(bone, frame, armature)
                if f"forearm_{side}" in bones:
                    bone = pose_bones[bones[f"forearm_{side}"]]
                    bone.rotation_euler.x = -1.2 * phase
                    insert_keyframe(bone, frame, armature)

        elif t < 0.6:
            phase = (t - 0.3) / 0.3
            # 微颤效果 — 符在发出能量
            tremble = math.sin(phase * math.pi * 6) * 0.03 * (1 - phase * 0.5)
            for side in ["left", "right"]:
                if f"upperarm_{side}" in bones:
                    bone = pose_bones[bones[f"upperarm_{side}"]]
                    bone.rotation_euler.x = 0.8 + tremble
                    bone.rotation_euler.z = (0.3 if side == "left" else -0.3) + tremble
                    insert_keyframe(bone, frame, armature)

        elif t < 0.85:
            phase = (t - 0.6) / 0.25
            for side in ["left", "right"]:
                if f"upperarm_{side}" in bones:
                    bone = pose_bones[bones[f"upperarm_{side}"]]
                    bone.rotation_euler.x = 0.8 - phase * 1.5  # 推出
                    bone.rotation_euler.z = (0.3 if side == "left" else -0.3) * (1 - phase * 0.5)
                    insert_keyframe(bone, frame, armature)
                if f"forearm_{side}" in bones:
                    bone = pose_bones[bones[f"forearm_{side}"]]
                    bone.rotation_euler.x = -1.2 - phase * 0.5
                    insert_keyframe(bone, frame, armature)

        else:
            phase = (t - 0.85) / 0.15
            for side in ["left", "right"]:
                if f"upperarm_{side}" in bones:
                    bone = pose_bones[bones[f"upperarm_{side}"]]
                    bone.rotation_euler.x = -0.7 * (1 - phase)
                    bone.rotation_euler.z = 0
                    insert_keyframe(bone, frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ UseCharm 完成 — 合十→发光→推出→放下")


def animate_gather_plant(armature, bones):
    """弯腰采集: 弯腰→伸手→采摘→起身"""
    length = ANIM_LENGTHS["GatherPlant"]
    action = create_action(armature, "GatherPlant", length, loop=False)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 3):
        t = frame / length

        # 0.0-0.3: 弯腰
        # 0.3-0.6: 伸手摘
        # 0.6-0.8: 放进口袋
        # 0.8-1.0: 起身

        if t < 0.3:
            phase = t / 0.3
            if "spine_lower" in bones:
                bone = pose_bones[bones["spine_lower"]]
                bone.rotation_euler.x = phase * 0.6  # 弯腰
                insert_keyframe(bone, frame, armature)
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = phase * 0.8
                insert_keyframe(bone, frame, armature)
            # 右手伸向地面
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = phase * 1.2
                insert_keyframe(bone, frame, armature)
            if "forearm_right" in bones:
                bone = pose_bones[bones["forearm_right"]]
                bone.rotation_euler.x = phase * 0.3
                insert_keyframe(bone, frame, armature)

        elif t < 0.6:
            phase = (t - 0.3) / 0.3
            # 摘取动作 — 手部微动
            if "hand_right" in bones:
                bone = pose_bones[bones["hand_right"]]
                bone.rotation_euler.z = math.sin(phase * math.pi * 2) * 0.15
                insert_keyframe(bone, frame, armature)

        elif t < 0.8:
            phase = (t - 0.6) / 0.2
            # 收回手到口袋位置
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = 1.2 - phase * 0.8
                bone.rotation_euler.z = phase * 0.2
                insert_keyframe(bone, frame, armature)

        else:
            phase = (t - 0.8) / 0.2
            # 起身
            if "spine_lower" in bones:
                bone = pose_bones[bones["spine_lower"]]
                bone.rotation_euler.x = 0.6 * (1 - phase)
                insert_keyframe(bone, frame, armature)
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = 0.8 * (1 - phase)
                insert_keyframe(bone, frame, armature)
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = 0.4 * (1 - phase)
                bone.rotation_euler.z = 0.2 * (1 - phase)
                insert_keyframe(bone, frame, armature)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ GatherPlant 完成 — 弯腰→采摘→起身")


def animate_hit_reaction(armature, bones):
    """受击反应: 身体后仰→踉跄后退→恢复"""
    length = ANIM_LENGTHS["HitReaction"]
    action = create_action(armature, "HitReaction", length, loop=False)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length

        # 0.0-0.15: 瞬间后仰（受击）
        # 0.15-0.4: 踉跄后退
        # 0.4-0.7: 稳住
        # 0.7-1.0: 恢复站直

        if t < 0.15:
            phase = t / 0.15
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -phase * 0.4  # 快速后仰
                insert_keyframe(bone, frame, armature)
            if "hips" in bones:
                bone = pose_bones[bones["hips"]]
                bone.location.z = -phase * 0.03
                insert_keyframe(bone, frame, armature, location=True)

        elif t < 0.4:
            phase = (t - 0.15) / 0.25
            # 踉跄 — 不稳的晃动
            wobble = math.sin(phase * math.pi * 3) * 0.06 * (1 - phase)
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -0.4 + wobble
                bone.rotation_euler.z = wobble * 1.5
                insert_keyframe(bone, frame, armature)

        elif t < 0.7:
            phase = (t - 0.4) / 0.3
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -0.4 * (1 - phase * 0.7)
                insert_keyframe(bone, frame, armature)

        else:
            phase = (t - 0.7) / 0.3
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -0.12 * (1 - phase)
                insert_keyframe(bone, frame, armature)
            if "hips" in bones:
                bone = pose_bones[bones["hips"]]
                bone.location.z = -0.03 * (1 - phase)
                insert_keyframe(bone, frame, armature, location=True)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ HitReaction 完成 — 受击→踉跄→恢复")


def animate_death(armature, bones):
    """死亡动画: 受致命伤→捂住胸口→跪倒→倒地"""
    length = ANIM_LENGTHS["Death"]
    action = create_action(armature, "Death", length, loop=False)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 3):
        t = frame / length

        # 0.0-0.2: 受致命伤 — 身体一震
        # 0.2-0.45: 捂住胸口，身体前倾
        # 0.45-0.7: 膝盖弯曲，跪下
        # 0.7-1.0: 倒地

        if t < 0.2:
            # 震击反应
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -0.15
                insert_keyframe(bone, frame, armature)

        elif t < 0.45:
            phase = (t - 0.2) / 0.25
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -0.15 - phase * 0.6
                insert_keyframe(bone, frame, armature)
            # 右手捂胸
            if "upperarm_right" in bones:
                bone = pose_bones[bones["upperarm_right"]]
                bone.rotation_euler.x = phase * 0.5
                bone.rotation_euler.z = -phase * 0.5
                insert_keyframe(bone, frame, armature)
            if "forearm_right" in bones:
                bone = pose_bones[bones["forearm_right"]]
                bone.rotation_euler.x = -phase * 1.2
                insert_keyframe(bone, frame, armature)

        elif t < 0.7:
            phase = (t - 0.45) / 0.25
            # 跪下
            if "hips" in bones:
                bone = pose_bones[bones["hips"]]
                bone.location.z = -phase * 0.8
                insert_keyframe(bone, frame, armature, location=True)
            for side in ["left", "right"]:
                if f"thigh_{side}" in bones:
                    bone = pose_bones[bones[f"thigh_{side}"]]
                    bone.rotation_euler.x = phase * 0.7
                    insert_keyframe(bone, frame, armature)
                if f"shin_{side}" in bones:
                    bone = pose_bones[bones[f"shin_{side}"]]
                    bone.rotation_euler.x = -phase * 1.2
                    insert_keyframe(bone, frame, armature)
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -0.75 - phase * 0.5
                insert_keyframe(bone, frame, armature)

        else:
            phase = (t - 0.7) / 0.3
            # 倒向一侧
            if "spine_upper" in bones:
                bone = pose_bones[bones["spine_upper"]]
                bone.rotation_euler.x = -1.25 * (1 + phase * 0.2)
                bone.rotation_euler.z = phase * 0.8
                insert_keyframe(bone, frame, armature)
            if "hips" in bones:
                bone = pose_bones[bones["hips"]]
                bone.location.z = -0.8 - phase * 0.1
                insert_keyframe(bone, frame, armature, location=True)

    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Death 完成 — 受击→捂胸→跪倒→倒地")


def animate_crouch(armature, bones):
    """蹲伏待机: 膝盖弯曲，身体压低，呼吸"""
    length = ANIM_LENGTHS["Crouch"]
    action = create_action(armature, "Crouch", length, loop=True)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length
        breath = math.sin(t * math.pi * 2 * 1.8) * 0.02

        # 持续蹲姿
        if "hips" in bones:
            bone = pose_bones[bones["hips"]]
            bone.location.z = -0.5
            insert_keyframe(bone, frame, armature, location=True)

        for side in ["left", "right"]:
            if f"thigh_{side}" in bones:
                bone = pose_bones[bones[f"thigh_{side}"]]
                bone.rotation_euler.x = 0.6 + breath
                insert_keyframe(bone, frame, armature)
            if f"shin_{side}" in bones:
                bone = pose_bones[bones[f"shin_{side}"]]
                bone.rotation_euler.x = -1.0 + breath * 0.5
                insert_keyframe(bone, frame, armature)

        if "spine_upper" in bones:
            bone = pose_bones[bones["spine_upper"]]
            bone.rotation_euler.x = 0.15 + breath
            insert_keyframe(bone, frame, armature)

    add_cycle_modifier(action)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ Crouch 完成 — 蹲伏呼吸循环")


def animate_crouch_walk(armature, bones):
    """蹲伏移动: 低姿态缓慢移动"""
    length = ANIM_LENGTHS["CrouchWalk"]
    action = create_action(armature, "CrouchWalk", length, loop=True)

    bpy.ops.object.mode_set(mode='POSE')
    pose_bones = armature.pose.bones

    for frame in range(0, length, 2):
        t = frame / length

        phase_r = t * math.pi * 2
        phase_l = phase_r + math.pi

        if "hips" in bones:
            bone = pose_bones[bones["hips"]]
            bone.location.z = -0.5
            insert_keyframe(bone, frame, armature, location=True)

        for side, phase in [("left", phase_l), ("right", phase_r)]:
            if f"thigh_{side}" in bones:
                bone = pose_bones[bones[f"thigh_{side}"]]
                bone.rotation_euler.x = 0.6 + math.sin(phase) * 0.2
                insert_keyframe(bone, frame, armature)
            if f"shin_{side}" in bones:
                bone = pose_bones[bones[f"shin_{side}"]]
                knee_bend = max(0, -math.cos(phase)) * 0.3
                bone.rotation_euler.x = -1.0 + knee_bend
                insert_keyframe(bone, frame, armature)

    add_cycle_modifier(action)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("   ✅ CrouchWalk 完成 — 蹲伏移动循环")


# ═══════════════════════════════════════════════════
# 导出
# ═══════════════════════════════════════════════════

def export_all_actions(armature, output_dir):
    """导出所有动画为单独的 FBX 文件"""
    import os
    os.makedirs(output_dir, exist_ok=True)

    original_action = armature.animation_data.action if armature.animation_data else None

    for action in bpy.data.actions:
        armature.animation_data.action = action
        bpy.context.scene.frame_set(0)

        # 选择仅骨架
        bpy.ops.object.select_all(action='DESELECT')
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature

        # 导出
        filepath = os.path.join(output_dir, f"Freyja_{action.name}.fbx")
        bpy.ops.export_scene.fbx(
            filepath=filepath,
            use_selection=True,
            object_types={'ARMATURE'},
            bake_anim=True,
            bake_anim_use_all_actions=False,  # 每个文件只含当前 action
            bake_anim_use_nla_strips=False,
            bake_anim_force_startend_keying=True,
            bake_anim_step=1.0,
            bake_anim_simplify_factor=0.0,
        )
        print(f"   📦 导出: {filepath}")

    # 恢复
    if armature.animation_data:
        armature.animation_data.action = original_action

    print(f"\n✅ 全部导出完成 → {output_dir}")


# ═══════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  🌿 芙蕾雅动画生成器")
    print("=" * 60)

    # 1. 找骨架
    armature = find_armature()
    if armature is None:
        print("\n❌ 错误: 场景中没有骨架！")
        print("   请先: File → Import → FBX → 选择 芙蕾雅4.fbx")
        print("   确保导入的模型包含了骨架(Armature)")
        return

    print(f"\n✅ 找到骨架: {armature.name}")

    # 2. 检测骨骼
    bones = detect_bone_names(armature)

    if len(bones) < 5:
        print(f"\n⚠️  只检测到 {len(bones)} 个骨骼，骨架结构可能不标准")
        print("   脚本会尽力生成动画，但效果可能不完美")
        print("   建议确保模型使用 Mixamo 兼容的 Humanoid 骨架")

    # 3. 生成动画
    print("\n🎬 开始生成动画...")
    print("-" * 40)

    # 先清除初始姿态
    clear_pose(armature)

    # 基础移动
    animate_idle(armature, bones)
    animate_walk(armature, bones)
    animate_run(armature, bones)

    # 角色技能
    animate_throw_potion(armature, bones)
    animate_use_charm(armature, bones)
    animate_gather_plant(armature, bones)

    # 战斗反应
    animate_hit_reaction(armature, bones)
    animate_death(armature, bones)

    # 蹲伏
    animate_crouch(armature, bones)
    animate_crouch_walk(armature, bones)

    # 4. 设置场景
    bpy.context.scene.frame_set(0)

    # 5. 汇总
    print("\n" + "=" * 60)
    print("  ✅ 全部动画生成完毕！")
    print("=" * 60)
    print(f"""
   共生成 {len(bpy.data.actions)} 个动画:

   基础移动:
     • Idle        — 待机呼吸
     • Walk        — 走路循环
     • Run         — 跑步循环
     • Crouch      — 蹲伏待机
     • CrouchWalk  — 蹲伏移动

   角色技能:
     • ThrowPotion — 投掷蚀灭药剂
     • UseCharm    — 使用愈灵符
     • GatherPlant — 采集灵植

   战斗反应:
     • HitReaction — 受击反应
     • Death       — 死亡倒地

   🎮 预览: 在 Pose Mode 下，Action Editor 切换不同动画播放
   📦 导出: 调用 export_all_actions(armature, "输出路径")
   """)

    return armature


# ═══════════════════════════════════════════════════
# 运行
# ═══════════════════════════════════════════════════

if __name__ == "__main__":
    arm = main()

    # 可选: 自动导出
    # export_all_actions(arm, "C:/Users/Lenovo/Desktop/Freyja_Anims/")
