"""
模型分析器 — 导入 FBX 并报告所有问题
用法: Blender → Scripting → 打开此文件 → 修改 FBX_PATH → Run
"""
import bpy, os, math

# ═══ 改这里！你的 FBX 路径 ═══
FBX_PATH = r"E:\无敌狼人杀文件\芙蕾雅3.fbx"

def main():
    # 清场景
    for obj in list(bpy.context.scene.objects):
        try: bpy.data.objects.remove(obj)
        except: pass

    # 导入 FBX
    print(f"\n📂 导入: {FBX_PATH}")
    try:
        bpy.ops.import_scene.fbx(filepath=FBX_PATH)
    except Exception as e:
        print(f"❌ 导入失败: {e}")
        return

    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        print("❌ 没有找到网格")
        return

    obj = meshes[0]
    mesh = obj.data
    print(f"\n{'='*55}")
    print(f"  🔍 {os.path.basename(FBX_PATH)} 分析报告")
    print(f"{'='*55}")

    # ── 1. 基本信息 ──
    print(f"\n📐 基本信息:")
    print(f"   名称: {obj.name}")
    print(f"   三角面: {len(mesh.polygons):,}")
    print(f"   顶点:   {len(mesh.vertices):,}")
    print(f"   边:     {len(mesh.edges):,}")

    # ── 2. 尺寸 ──
    dims = obj.dimensions
    bbox_z = max(v.co.z for v in mesh.vertices) - min(v.co.z for v in mesh.vertices)
    print(f"\n📏 尺寸 (m):")
    print(f"   宽(X): {dims.x:.2f}m")
    print(f"   深(Y): {dims.y:.2f}m")
    print(f"   高(Z): {dims.z:.2f}m  ← {'✅ 正常人身高' if 1.4 < dims.z < 2.2 else '⚠️ 可能需要缩放'}")

    # ── 3. 中心点 ──
    loc = obj.location
    bbox_min_z = min(v.co.z for v in mesh.vertices)
    print(f"\n📍 位置:")
    print(f"   原点偏移: X={loc.x:.2f} Y={loc.y:.2f} Z={loc.z:.2f}")
    print(f"   最低点Z:  {bbox_min_z:.2f} {'✅ 脚底在地面' if abs(bbox_min_z) < 0.05 else '⚠️ 未对齐地面'}")

    # ── 4. UV ──
    uv_count = len(mesh.uv_layers)
    print(f"\n🗺️ UV:")
    print(f"   UV 通道数: {uv_count} {'✅' if uv_count > 0 else '❌ 没有 UV！无法画贴图'}")

    # ── 5. 材质/贴图 ──
    print(f"\n🎨 材质:")
    mat_count = len(obj.data.materials)
    print(f"   材质数: {mat_count}")
    for i, mat in enumerate(obj.data.materials):
        print(f"   [{i}] {mat.name}")
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    w, h = node.image.size
                    print(f"       📷 {node.image.name} ({w}×{h}) — {'✅' if w >= 1024 else '⚠️ 贴图太小'}")

    # ── 6. 修改器 ──
    mods = obj.modifiers
    if mods:
        print(f"\n🔧 修改器:")
        for m in mods:
            print(f"   {m.name}: {m.type}")
    else:
        print(f"\n🔧 修改器: 无")

    # ── 7. 骨骼/顶点组 ──
    vg_count = len(obj.vertex_groups)
    armature = any(o.type == 'ARMATURE' for o in bpy.context.scene.objects)
    print(f"\n🦴 骨骼:")
    print(f"   顶点组: {vg_count} 个")
    print(f"   骨架:   {'✅ 有' if armature else '❌ 无骨架（需要去 Mixamo 绑骨）'}")

    # ── 8. 面数评估 ──
    tris = len(mesh.polygons)
    if tris < 10000:
        quality = "🔴 低（手机可以，PC偏少）"
    elif tris < 30000:
        quality = "🟡 中（PC独立游戏够用）"
    elif tris < 60000:
        quality = "🟢 好（PC标准）"
    else:
        quality = "🟢 高（可减面优化）"
    print(f"\n📊 面数评估: {quality}")

    # ── 9. 贴图检查 ──
    has_textures = False
    for mat in obj.data.materials:
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    has_textures = True
    if not has_textures:
        print(f"   ⚠️ 没有贴图！需要画贴图或用 setup_pbr_texturing.py")

    # ── 10. 拓扑检查 ──
    ngons = sum(1 for p in mesh.polygons if len(p.vertices) > 4)
    print(f"\n🔺 拓扑:")
    print(f"   非四边面: {ngons} {'⚠️ 有N-gon' if ngons > 0 else '✅ 全三角面'}")

    # ── 居中显示 ──
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces[0].shading.type = 'SOLID'
            for region in area.regions:
                if region.type == 'WINDOW':
                    override = {'area': area, 'region': region}
                    try:
                        with bpy.context.temp_override(**override):
                            bpy.ops.view3d.view_all()
                    except: pass
            break

    print(f"\n{'='*55}")
    print(f"  ✅ 分析完成")
    print(f"  💡 下一步:")
    if uv_count == 0:
        print(f"     → 需要 UV 展开：Edit Mode → U → Smart UV Project")
    if not has_textures:
        print(f"     → 运行 setup_pbr_texturing.py 创建贴图环境")
    if not armature:
        print(f"     → 去 mixamo.com 上传模型自动绑骨")
    if abs(bbox_min_z) > 0.05:
        print(f"     → 选中模型 → G → Z → 拖到脚底对齐地面原点")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
