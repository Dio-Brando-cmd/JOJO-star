"""
══════════════════════════════════════════════════════════════
看板娘跳跃动画 — 无头模式 (Blender 5.2 LTS)
══════════════════════════════════════════════════════════════

从 E:\\veiland\\看版娘-01.blend 的骨架「骨架」(17骨, 扁平层级, 无共同 hips 根)
生成单一 Jump 动作, 导出独立 FBX:
  unity-client/Assets/Models/Characters/KanbanPlayer_Jump.fbx

与主 FBX (KanbanPlayer_Animated.fbx, 含 Idle/Walk/Run) 分开,
避免破坏已验证的 Idle/Walk/Run。Unity 侧 SetupKanbanAnimations 会在
存在该 FBX 时把 Jump clip 挂进 controller; 不存在则优雅跳过。

用法:
  blender --background --python animate_kanban_jump.py
══════════════════════════════════════════════════════════════
"""

import bpy
import os
import sys
import math

SRC = r"E:\veiland\看版娘-01.blend"
OUT = os.path.abspath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "unity-client", "Assets", "Models", "Characters", "KanbanPlayer_Jump.fbx"
))

LENGTH = 30
FRAME_RATE = 30


def find_armature():
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            return obj
    return None


def find_mesh():
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            return obj
    return None


def main():
    if not os.path.exists(SRC):
        print("NO_SOURCE_BLEND: " + SRC)
        sys.exit(1)

    bpy.ops.wm.open_mainfile(filepath=SRC)

    arm = find_armature()
    if not arm:
        print("NO_ARMATURE")
        sys.exit(1)

    mesh = find_mesh()
    print("ARMATURE", arm.name, "bones", len(arm.data.bones))
    print("MESH", mesh.name if mesh else None)
    print("BONES", [b.name for b in arm.data.bones])

    pb = arm.pose.bones

    def has(n):
        return n in pb

    # 已知扁平结构 (依据原动画管线): 腿 Bone/Bone.001 与 Bone.002/Bone.003,
    # 脊柱 Bone.004..Bone.010, 臂 Bone.011..013 / Bone.014..016
    thighs = ["Bone", "Bone.002"]
    shins = ["Bone.001", "Bone.003"]
    spine = ["Bone.004", "Bone.005", "Bone.006"]
    arms = ["Bone.011", "Bone.014"]

    act = bpy.data.actions.new(name="Jump")
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = act
    act.use_frame_range = True
    act.frame_start = 0
    act.frame_end = LENGTH

    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.rot_clear()

    def key(bone, frame):
        bpy.context.scene.frame_set(frame)
        if bone.rotation_mode == 'QUATERNION':
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        else:
            bone.keyframe_insert(data_path="rotation_euler", frame=frame)

    for frame in range(0, LENGTH + 1):
        t = frame / LENGTH
        if t < 0.3:                       # 下蹲蓄力
            p = t / 0.3
            crouch = p * 0.5
            lean = p * 0.25
        elif t < 0.7:                     # 起跳: 腿向前收 / 手臂上摆
            p = (t - 0.3) / 0.4
            crouch = 0.5 * (1 - p) - p * 0.6
            lean = 0.25 - p * 0.5
        else:                             # 落地还原
            p = (t - 0.7) / 0.3
            crouch = -0.6 * (1 - p)
            lean = -0.25 * (1 - p)

        for n in thighs:
            if has(n):
                pb[n].rotation_euler.x = crouch
                key(pb[n], frame)
        for n in shins:
            if has(n):
                pb[n].rotation_euler.x = max(0.0, -crouch) * 0.6
                key(pb[n], frame)
        for n in spine:
            if has(n):
                pb[n].rotation_euler.x = lean
                key(pb[n], frame)
        for n in arms:
            if has(n):
                pb[n].rotation_euler.x = -0.8 * (0.5 + 0.5 * math.sin(t * math.pi))
                key(pb[n], frame)

    bpy.ops.object.mode_set(mode='OBJECT')

    # 推入 NLA 并导出 armature + mesh (与主 FBX 同源, 骨骼路径一致)
    if arm.animation_data:
        for track in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(track)
        trk = arm.animation_data.nla_tracks.new()
        trk.name = "Jump"
        strip = trk.strips.new("Jump", int(act.frame_range[0]), act)
        strip.name = "Jump"

    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    if mesh:
        mesh.select_set(True)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.fbx(
        filepath=OUT,
        use_selection=True,
        object_types={'ARMATURE', 'MESH'},
        bake_anim=True,
        bake_anim_use_all_actions=False,
        bake_anim_use_nla_strips=True,
        bake_anim_force_startend_keying=True,
        bake_anim_step=1.0,
        bake_anim_simplify_factor=0.0,
    )

    size = os.path.getsize(OUT) if os.path.exists(OUT) else -1
    print("EXPORTED", OUT, "bytes", size)
    if size <= 0:
        sys.exit(2)


if __name__ == "__main__":
    main()
