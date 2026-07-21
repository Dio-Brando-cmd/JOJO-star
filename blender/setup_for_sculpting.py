"""
Meshy 模型导入后一键设置 — 加细分/切换材质预览/设置雕刻环境
在 Blender Scripting 工作区运行
"""
import bpy

# 找导入的角色模型
chars = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not chars:
    print("❌ 没找到网格，先 File → Import → FBX")
else:
    for char in chars:
        bpy.context.view_layer.objects.active = char
        print(f"\n处理: {char.name}")
        old_tris = len(char.data.polygons)
        print(f"  原始三角面: {old_tris}")

        # Subdivision Surface — 增加面数
        bpy.ops.object.modifier_add(type='SUBSURF')
        char.modifiers[-1].levels = 2
        char.modifiers[-1].render_levels = 3
        print(f"  ✅ 加 SubSurf Lv.2 → 约 {old_tris*4} 面")

    # 切换材质预览
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces[0].shading.type = 'MATERIAL'
            print("  ✅ 材质预览模式")
            break

    print("\n🎨 现在去 Sculpting 工作区开始雕刻")
    print("   Grab(G)拉大型 | Clay Strips堆肌肉 | Smooth平滑 | Crease刻皱纹")
