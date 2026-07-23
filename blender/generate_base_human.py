"""
============================================================
 Skin Modifier 人体生成器 — 真正的有机拓扑
 兼容 Blender 4.0 ~ 5.x

 原理: 创建骨骼边链 → Skin修改器生成体积 → SubSurf平滑
 输出: 可直接雕刻的有机人体网格
============================================================
"""
import bpy, math, os

CTX = None
for w in bpy.context.window_manager.windows:
    for a in w.screen.areas:
        if a.type == 'VIEW_3D':
            for r in a.regions:
                if r.type == 'WINDOW':
                    CTX = {'window':w,'screen':w.screen,'area':a,'region':r,'scene':bpy.context.scene}

def op(fn):
    if CTX:
        with bpy.context.temp_override(**CTX): return fn()
    return fn()

def mkmat(name,r,g,b,a=1.0,rough=0.65):
    m=bpy.data.materials.new(name=name); m.use_nodes=True; t=m.node_tree; t.nodes.clear()
    bsdf=None
    for bt in ('ShaderNodeBsdfPrincipled','ShaderNodeBsdfPrincipledv2'):
        try: bsdf=t.nodes.new(bt); break
        except RuntimeError: pass
    out=None
    for ot in ('ShaderNodeOutputMaterial','ShaderNodeOutput'):
        try: out=t.nodes.new(ot); break
        except RuntimeError: pass
    try: t.links.new(bsdf.outputs['BSDF'],out.inputs['Surface'])
    except KeyError:
        so=next((o for o in bsdf.outputs if o.type=='SHADER'),bsdf.outputs[0])
        si=next((i for i in out.inputs if i.type=='SHADER'),out.inputs[0])
        t.links.new(so,si)
    for sn,sv in (('Base Color',(r,g,b,a)),('Roughness',rough)):
        try:
            if sn in bsdf.inputs: bsdf.inputs[sn].default_value=sv
        except: pass
    return m

def clear():
    for obj in list(bpy.context.scene.objects):
        try: bpy.data.objects.remove(obj)
        except: pass
    for x in list(bpy.data.meshes):
        try: bpy.data.meshes.remove(x)
        except: pass

# ====== 人体参数 ======
# 8头身比例，hu = height/8
HUMAN_PRESETS = {
    # 窈窕女性 (莫莉安/布丽吉德/芙蕾雅 1.62-1.67m)
    'slender_female': {
        'height': 1.65, 'torso_r': 0.13, 'limb_r': 0.08,
        'shoulder_w': 0.38, 'hip_w': 0.32, 'neck_r': 0.04,
        'leg_len': 0.50, 'torso_len': 0.28,
    },
    # 运动员女性 (斯卡蒂 1.91m)
    'athletic_female': {
        'height': 1.91, 'torso_r': 0.16, 'limb_r': 0.10,
        'shoulder_w': 0.44, 'hip_w': 0.35, 'neck_r': 0.05,
        'leg_len': 0.52, 'torso_len': 0.27,
    },
    # 瘦削男性 (虚舟/卡赫特 1.70-1.78m)
    'slender_male': {
        'height': 1.74, 'torso_r': 0.15, 'limb_r': 0.09,
        'shoulder_w': 0.42, 'hip_w': 0.30, 'neck_r': 0.045,
        'leg_len': 0.49, 'torso_len': 0.29,
    },
    # 肌肉男性 (西格德/赫克托 1.88-1.91m)
    'muscular_male': {
        'height': 1.89, 'torso_r': 0.20, 'limb_r': 0.13,
        'shoulder_w': 0.50, 'hip_w': 0.32, 'neck_r': 0.06,
        'leg_len': 0.48, 'torso_len': 0.30,
    },
    # 魁梧男性 (哈尔瓦德 1.95m)
    'heavy_male': {
        'height': 1.95, 'torso_r': 0.24, 'limb_r': 0.16,
        'shoulder_w': 0.55, 'hip_w': 0.34, 'neck_r': 0.07,
        'leg_len': 0.47, 'torso_len': 0.31,
    },
}

def build_human(preset_name='slender_female'):
    """用 Skin Modifier 构建有机人体"""
    p = HUMAN_PRESETS[preset_name]
    h = p['height']
    tr = p['torso_r']; lr = p['limb_r']
    sw = p['shoulder_w']; hw = p['hip_w']
    nr = p['neck_r']
    ll = p['leg_len']; tl = p['torso_len']
    skin_mat = mkmat("skin", 0.70, 0.62, 0.55)

    clear()

    # ── 构建边链骨架 ──
    # 骨盆 → 脊椎 → 颈 → 头
    # 肩 → 肘 → 腕 → 指尖
    # 髋 → 膝 → 踝 → 脚底

    verts = []
    edges = []

    def add_verts(*positions):
        """批量添加顶点，返回起始索引"""
        start = len(verts)
        verts.extend(positions)
        return start

    def add_chain(indices):
        """将索引列表串联为边链"""
        for i in range(len(indices)-1):
            edges.append((indices[i], indices[i+1]))

    # ── 脊椎中心线 (骨盆→头顶) ──
    spine_idx = add_verts(
        (0, 0, h*0.48),    # 0: 骨盆
        (0, 0, h*0.55),    # 1: 腰
        (0, 0, h*0.63),    # 2: 胸下
        (0, 0, h*0.70),    # 3: 胸
        (0, 0, h*0.78),    # 4: 肩
        (0, 0, h*0.85),    # 5: 颈
        (0, 0, h*0.92),    # 6: 下巴
        (0, 0, h*0.96),    # 7: 鼻子
        (0, 0, h),         # 8: 头顶
    )
    add_chain(range(spine_idx, spine_idx+9))

    # ── 左臂 (肩→手) ──
    la_idx = add_verts(
        (-sw, 0, h*0.78),         # 左肩
        (-sw*1.3, 0, h*0.69),     # 左肘
        (-sw*1.5, 0, h*0.58),     # 左腕
        (-sw*1.55, 0, h*0.53),    # 左掌
        (-sw*1.55, 0, h*0.50),    # 左指尖
    )
    edges.append((spine_idx+4, la_idx))  # 肩→脊椎
    add_chain(range(la_idx, la_idx+5))

    # ── 右臂 ──
    ra_idx = add_verts(
        (sw, 0, h*0.78),
        (sw*1.3, 0, h*0.69),
        (sw*1.5, 0, h*0.58),
        (sw*1.55, 0, h*0.53),
        (sw*1.55, 0, h*0.50),
    )
    edges.append((spine_idx+4, ra_idx))
    add_chain(range(ra_idx, ra_idx+5))

    # ── 左腿 (骨盆→脚) ──
    ll_idx = add_verts(
        (-hw*0.45, 0, h*0.28),    # 左膝
        (-hw*0.4, 0, h*0.08),     # 左踝
        (-hw*0.4, hw*0.8, 0),     # 左脚尖
    )
    edges.append((spine_idx, ll_idx))
    add_chain(range(ll_idx, ll_idx+3))

    # ── 右腿 ──
    rl_idx = add_verts(
        (hw*0.45, 0, h*0.28),
        (hw*0.4, 0, h*0.08),
        (hw*0.4, hw*0.8, 0),
    )
    edges.append((spine_idx, rl_idx))
    add_chain(range(rl_idx, rl_idx+3))

    # ── 创建网格 ──
    mesh = bpy.data.meshes.new("human_base")
    obj = bpy.data.objects.new("HumanBase", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.from_pydata(verts, edges, [])
    mesh.update()

    # ── Skin Modifier ──
    bpy.context.view_layer.objects.active = obj
    op(lambda: bpy.ops.object.modifier_add(type='SKIN'))

    # ── 设置每根"骨骼"的粗细 ──
    skin_radii = []
    for i, v in enumerate(mesh.vertices):
        if i <= spine_idx+8:
            # 脊椎线：骨盆粗→腰细→胸宽→颈细→头圆
            z_ratio = (v.co.z / h)
            if z_ratio > 0.90:     rv = 0.13        # 头
            elif z_ratio > 0.82:   rv = nr          # 颈
            elif z_ratio > 0.70:   rv = tr*1.1      # 肩/胸
            elif z_ratio > 0.60:   rv = tr*0.85     # 腰
            else:                  rv = tr*1.05      # 骨盆
            skin_radii.append((rv*0.7, rv))
        elif i in range(la_idx, la_idx+5) or i in range(ra_idx, ra_idx+5):
            if (i-la_idx) in (0,) or (i-ra_idx) in (0,):
                rv = lr*1.2  # 肩部
            elif (i-la_idx) in (1,2) or (i-ra_idx) in (1,2):
                rv = lr     # 上臂/前臂
            else:
                rv = lr*0.7  # 手
            skin_radii.append((rv*0.7, rv))
        elif i in range(ll_idx, ll_idx+3) or i in range(rl_idx, rl_idx+3):
            if (i-ll_idx) in (0,) or (i-rl_idx) in (0,):
                rv = lr*1.3  # 大腿
            elif (i-ll_idx) in (1,) or (i-rl_idx) in (1,):
                rv = lr*0.9  # 小腿
            else:
                rv = lr*0.5  # 脚
            skin_radii.append((rv*0.7, rv))
        else:
            skin_radii.append((0.08, 0.08))

    # 写入 skin_vertices (需要编辑模式)
    op(lambda: bpy.ops.object.mode_set(mode='EDIT'))
    try:
        skin_data = obj.data.skin_vertices[0].data
        for i, sv in enumerate(skin_data):
            if i < len(skin_radii):
                sv.radius = skin_radii[i]
    except:
        pass
    op(lambda: bpy.ops.object.mode_set(mode='OBJECT'))

    # ── Subdivision Surface (平滑) ──
    op(lambda: bpy.ops.object.modifier_add(type='SUBSURF'))
    obj.modifiers[-1].levels = 2
    obj.modifiers[-1].render_levels = 3

    # ── 应用材质 ──
    obj.data.materials.append(skin_mat)

    print(f"  ✅ {preset_name}: {h}m 人体网格生成 ({len(verts)}节点)")
    return obj


def main():
    print("="*55)
    print("  Skin Modifier 人体生成器")
    print("  有机拓扑 | 可直接雕刻")
    print("="*55)

    OUTPUT = os.path.join(os.path.expanduser("~"), "veilland_models", "base_humans")
    os.makedirs(OUTPUT, exist_ok=True)

    for preset in HUMAN_PRESETS:
        clear()
        obj = build_human(preset)
        # 导出
        bpy.ops.object.select_all(action='SELECT')
        path = os.path.join(OUTPUT, f"human_base_{preset}.glb")
        try:
            kw = dict(filepath=path, use_selection=True)
            for k in ('export_format','export_format_option'):
                try: bpy.ops.export_scene.gltf(**kw,**{k:'GLB'}); break
                except: pass
            else: bpy.ops.export_scene.gltf(**kw)
            print(f"     → {os.path.basename(path)}")
        except Exception as e:
            print(f"     export: {e}")

    print(f"\n📁 输出: {OUTPUT}")
    print("💡 在 Blender Sculpting 工作区打开，直接雕刻")


if __name__ == "__main__":
    main()
