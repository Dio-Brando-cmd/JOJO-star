"""
============================================================
 Blender PBR 贴图绘制环境 — 一键配置（免费 ArmorPaint 替代）
 兼容 Blender 4.0 ~ 5.x

 选中模型 → Run Script → 开始画贴图
============================================================
"""
import bpy, os

CTX = None
for w in bpy.context.window_manager.windows:
    for a in w.screen.areas:
        if a.type == 'VIEW_3D':
            for r in a.regions:
                if r.type == 'WINDOW':
                    CTX = {'window':w,'screen':w.screen,'area':a,'region':r,'scene':bpy.context.scene}

def op(fn):
    if CTX:
        try:
            with bpy.context.temp_override(**CTX): return fn()
        except: pass
    return fn()

def main():
    # ── 找选中的模型 ──
    obj = bpy.context.active_object
    if not obj or obj.type != 'MESH':
        print("❌ 请先选中一个网格模型！")
        return

    print(f"\n🎨 PBR 贴图环境: {obj.name}")
    print("="*50)

    # ── 输出目录 ──
    blend_dir = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.path.expanduser("~")
    tex_dir = os.path.join(blend_dir, "textures", obj.name)
    os.makedirs(tex_dir, exist_ok=True)
    print(f"   贴图目录: {tex_dir}")

    # ── 分辨率 ──
    RES = 2048  # 2K (改 4096 就是 4K)

    # ── 创建 4 张 PBR 贴图 ──
    images = {}
    channels = {
        'BaseColor':  (0.5, 0.5, 0.5, 1.0),  # 中灰底
        'Roughness':  (1.0, 1.0, 1.0, 1.0),  # 白=全粗糙
        'Normal':     (0.5, 0.5, 1.0, 1.0),  # 平面法线
        'Metallic':   (0.0, 0.0, 0.0, 1.0),  # 黑=非金属
    }

    for name, fill in channels.items():
        img = bpy.data.images.new(
            name=f"{obj.name}_{name}",
            width=RES, height=RES,
            alpha=(name == 'BaseColor'),
            float_buffer=False
        )
        # 填充底色（按像素填入）
        pixels = [v for _ in range(RES * RES) for v in fill]
        img.pixels = pixels
        img.file_format = 'PNG'
        img.filepath_raw = os.path.join(tex_dir, f"{obj.name}_{name}.png")
        img.save()
        images[name] = img
        print(f"   ✅ {name} ({RES}×{RES})")

    # ── 智能 UV 展开（如果没有 UV） ──
    if not obj.data.uv_layers:
        bpy.context.view_layer.objects.active = obj
        op(lambda: bpy.ops.object.mode_set(mode='EDIT'))
        op(lambda: bpy.ops.mesh.select_all(action='SELECT'))
        op(lambda: bpy.ops.uv.smart_project(angle_limit=66, island_margin=0.02))
        op(lambda: bpy.ops.object.mode_set(mode='OBJECT'))
        print("   ✅ 自动展开 UV")

    # ── 创建 PBR 材质节点 ──
    mat = bpy.data.materials.new(name=f"{obj.name}_PBR")
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()

    # Principled BSDF
    bsdf = None
    for bt in ('ShaderNodeBsdfPrincipled','ShaderNodeBsdfPrincipledv2'):
        try: bsdf = tree.nodes.new(bt); break
        except RuntimeError: pass
    bsdf.location = (400, 200)

    # Output
    out = tree.nodes.new('ShaderNodeOutputMaterial')
    out.location = (700, 200)
    try: tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    except KeyError:
        so = next((o for o in bsdf.outputs if o.type=='SHADER'), bsdf.outputs[0])
        si = next((i for i in out.inputs if i.type=='SHADER'), out.inputs[0])
        tree.links.new(so, si)

    # 4 个 Image Texture 节点
    tex_nodes = {}
    for i, (name, img) in enumerate(images.items()):
        tex = tree.nodes.new('ShaderNodeTexImage')
        tex.name = name
        tex.image = img
        tex.location = (0, -i * 240)
        tex_nodes[name] = tex

    # 连线到 BSDF
    tree.links.new(tex_nodes['BaseColor'].outputs['Color'], bsdf.inputs['Base Color'])
    try:
        tree.links.new(tex_nodes['Roughness'].outputs['Color'], bsdf.inputs['Roughness'])
        tree.links.new(tex_nodes['Metallic'].outputs['Color'], bsdf.inputs['Metallic'])
        # Normal 需要 Normal Map 节点
        normal_map = tree.nodes.new('ShaderNodeNormalMap')
        normal_map.location = (200, -480)
        tree.links.new(tex_nodes['Normal'].outputs['Color'], normal_map.inputs['Color'])
        tree.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    except KeyError:
        pass  # BSDF 输入不同名

    obj.data.materials.clear()
    obj.data.materials.append(mat)
    print("   ✅ PBR 材质节点已连接")

    # ── 配置画笔 ──
    # 设置默认画笔参数
    bpy.context.scene.tool_settings.unified_paint_settings.use_unified_size = False
    bpy.context.scene.tool_settings.unified_paint_settings.use_unified_strength = False

    print("   ✅ 画笔已配置")

    # ── 提示 ──
    print(f"\n{'='*50}")
    print("  🖌️ 开始绘制！")
    print(f"  左侧顶栏 → Texture Paint 工作区")
    print(f"  右侧 Image Editor → 选要画的贴图通道")
    print(f"     BaseColor = 颜色  |  Roughness = 粗糙度")
    print(f"     Metallic  = 金属  |  Normal    = 法线凹凸")
    print(f"\n  💡 快捷键:")
    print(f"     F  = 画笔大小    Shift+F = 力度")
    print(f"     S  = 吸管取色    Ctrl+Z = 撤销")
    print(f"     X  = 切换前景/背景色")
    print(f"\n  📦 导出贴图: Image → Save As → PNG")
    print(f"     路径: {tex_dir}")
    print(f"{'='*50}")

    # ── 切换到 Texture Paint 模式 ──
    bpy.context.view_layer.objects.active = obj
    op(lambda: bpy.ops.object.mode_set(mode='TEXTURE_PAINT'))

    # 选择 BaseColor 作为当前绘制的贴图
    if 'BaseColor' in tex_nodes:
        obj.active_material.node_tree.nodes.active = tex_nodes['BaseColor']

    # 设置 3D 视图为材质预览
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces[0].shading.type = 'MATERIAL'
            break


if __name__ == "__main__":
    main()
