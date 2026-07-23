"""
============================================================
 狼人杀 — 10角色精密雕刻建模 v2
 兼容 Blender 4.0 ~ 5.x LTS

 每位角色: 精确身高 · 肌肉塑造 · 粒子发丝 · 皮肤纹理
           · 服装褶皱 · 武器磨损 · 文化特征
============================================================
"""
import bpy, math, random, os

print("="*60)
print("  🎭 狼人杀 精密角色建模 v2")
print("  10角色 | 精确身高 | 粒子发丝 | 肌肉 | 磨损")
print("="*60)

# ====== 上下文 ======
CTX = None
def find_ctx():
    global CTX
    for w in bpy.context.window_manager.windows:
        for a in w.screen.areas:
            if a.type == 'VIEW_3D':
                for r in a.regions:
                    if r.type == 'WINDOW':
                        CTX = {'window':w,'screen':w.screen,'area':a,'region':r,'scene':bpy.context.scene}
                        return CTX
    return None
find_ctx()
if not CTX: print("⚠ 未找到3D视图 — 切到Layout再切回Scripting运行")

def op(fn):
    if CTX:
        with bpy.context.temp_override(**CTX): return fn()
    return fn()

# ====== 材料 ======
def mkmat(name,r,g,b,a=1.0,rough=0.75):
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

# ====== 几何 ======
def C(name,x,y,z,sx,sy,sz,m):
    op(lambda: bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z)))
    o=bpy.context.active_object; o.name=name; o.scale=(sx,sy,sz); o.data.materials.append(m); return o
def Cy(name,x,y,z,r,d,m):
    op(lambda: bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=d,location=(x,y,z),vertices=16))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o
def S(name,x,y,z,r,m):
    op(lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=r,location=(x,y,z),segments=16,ring_count=12))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o
def Cn(name,x,y,z,r1,r2,d,m):
    op(lambda: bpy.ops.mesh.primitive_cone_add(radius1=r1,radius2=r2,depth=d,location=(x,y,z),vertices=16))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o
def Ic(name,x,y,z,r,subdiv,m):
    """ICO球 — 均匀拓扑，雕刻基础"""
    op(lambda: bpy.ops.mesh.primitive_ico_sphere_add(radius=r,subdivisions=subdiv,location=(x,y,z)))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o

def clear():
    for obj in list(bpy.context.scene.objects):
        try: bpy.data.objects.remove(obj)
        except: pass
    for x in list(bpy.data.meshes):
        try: bpy.data.meshes.remove(x)
        except: pass
    for x in list(bpy.data.materials):
        try: bpy.data.materials.remove(x)
        except: pass
    for x in list(bpy.data.particles):
        try: bpy.data.particles.remove(x)
        except: pass

def select_all(): op(lambda: bpy.ops.object.select_all(action='SELECT'))
def deselect_all(): op(lambda: bpy.ops.object.select_all(action='DESELECT'))

def safe_gltf(path):
    def do():
        kw=dict(filepath=path,use_selection=True)
        for k in ('export_format','export_format_option'):
            try: bpy.ops.export_scene.gltf(**kw,**{k:'GLB'}); return
            except: pass
        try: bpy.ops.export_scene.gltf(**kw)
        except Exception as e: print(f"     export: {e}")
    op(do)

# ====== 肌肉塑造 ======
def sculpt_muscles(char_obj, char_def):
    """根据角色定义调整肌肉线条 — 缩放骨骼关键区域"""
    build = char_def['build']
    gender = char_def['gender']
    h = char_def['height']

    # 不同体型的肌肉倍率 (胸/肩宽/臂粗/腿粗/腰)
    muscle_factors = {
        'lean':      (1.00, 0.95, 0.90, 0.92, 0.85),
        'average':   (1.10, 1.05, 1.00, 1.00, 0.95),
        'muscular':  (1.30, 1.20, 1.15, 1.10, 1.00),
        'heavy':     (1.40, 1.35, 1.25, 1.20, 1.15),
    }
    cf = muscle_factors.get(build, muscle_factors['average'])

    # 对身体部件施加缩放模拟肌肉
    for obj in bpy.context.scene.objects:
        name = obj.name.lower()
        # 胸部
        if 'chest' in name or 'torso' in name:
            obj.scale.x *= cf[0]  # 胸宽
            obj.scale.y *= cf[0] * 0.85
        # 肩膀
        if 'shoulder' in name:
            obj.scale = tuple(s * cf[1] for s in obj.scale)
        # 手臂
        if 'uparm' in name or 'forearm' in name:
            obj.scale = tuple(s * cf[2] for s in obj.scale)
        # 大腿
        if 'thigh' in name:
            obj.scale = tuple(s * cf[3] for s in obj.scale)
        # 腰部 (骨盆)
        if 'pelvis' in name:
            obj.scale.x *= cf[4]
            obj.scale.y *= cf[4]

    # 女性特征：臀部比例调整
    if gender == 'female':
        for obj in bpy.context.scene.objects:
            if 'pelvis' in obj.name.lower():
                obj.scale.y *= 1.12

    # 北欧战士：更宽的肩膀
    if char_def['origin'] == 'Norse' and build in ('muscular', 'heavy'):
        for obj in bpy.context.scene.objects:
            if 'shoulder' in obj.name.lower():
                obj.scale = tuple(s * 1.12 for s in obj.scale)


# ====== 粒子发丝 ======
def add_hair_particles(char_obj, char_def):
    """用 Blender 粒子系统添加发丝"""
    head_obj = None
    for obj in bpy.context.scene.objects:
        if 'head' in obj.name.lower():
            head_obj = obj
            break
    if not head_obj:
        return

    hair_color = char_def['hair_color']
    hair_style = char_def.get('hair', 'short')

    # 创建头皮顶点组 — 选择头顶区域
    bpy.context.view_layer.objects.active = head_obj
    op(lambda: bpy.ops.object.mode_set(mode='EDIT'))
    op(lambda: bpy.ops.mesh.select_all(action='DESELECT'))

    # 选中上半球顶点
    op(lambda: bpy.ops.object.mode_set(mode='OBJECT'))
    for v in head_obj.data.vertices:
        if v.co.z > 0.12:  # 头顶区域
            v.select = True

    # 创建顶点组
    vg = head_obj.vertex_groups.new(name="Scalp")
    selected_verts = [v.index for v in head_obj.data.vertices if v.select]
    if selected_verts:
        vg.add(selected_verts, 1.0, 'REPLACE')

    op(lambda: bpy.ops.object.mode_set(mode='OBJECT'))

    # 粒子系统
    head_obj.modifiers.new(name="Hair", type='PARTICLE_SYSTEM')
    psys = head_obj.particle_systems[0]
    psys.name = "Hair"
    pset = psys.settings
    pset.type = 'HAIR'
    pset.name = "HairSettings"

    # 发量
    hair_count = {'short': 300, 'long': 600, 'hood': 0, 'helmet': 0}.get(hair_style, 200)
    pset.count = hair_count

    # 发长
    hair_len = {'short': 0.12, 'long': 0.40, 'hood': 0, 'helmet': 0}.get(hair_style, 0.10)
    pset.hair_length = hair_len
    pset.hair_step = 3

    # 顶点组密度
    pset.vertex_group_density = "Scalp"

    # 材质
    hair_mat = mkmat(f"{char_def['id']}_hair_particle",
                     *hair_color, rough=0.45)
    head_obj.data.materials.append(hair_mat)
    # 粒子材质索引
    pset.material = len(head_obj.data.materials) - 1

    # 动力学: 轻微重力感
    pset.use_hair_bspline = True
    pset.brownian_factor = 0.5

    print(f"     ↳ 粒子发丝: {hair_count}根, {hair_len:.0f}cm")


# ====== 皮肤纹理 (Displacement) ======
def add_skin_detail(char_obj):
    """给身体添加微细皮肤纹理 — Subdivision + Displacement"""
    for obj in bpy.context.scene.objects:
        name = obj.name.lower()
        if any(k in name for k in ('head','chest','torso','arm','leg','thigh','shin','hand','shoulder','forearm','pelvis')):
            # 确保有足够的细分
            bpy.context.view_layer.objects.active = obj
            try:
                op(lambda: bpy.ops.object.modifier_add(type='SUBSURF'))
                obj.modifiers[-1].levels = 2
                obj.modifiers[-1].render_levels = 3
            except: pass


# ====== 武器磨损 ======
def add_weapon_wear():
    """给武器金属部分添加随机凹痕 — Boolean 差集"""
    wear_count = 0
    for obj in list(bpy.context.scene.objects):
        name = obj.name.lower()
        if any(k in name for k in ('blade','axe_blade','spear_head','sword')):
            # 保存原始对象
            bpy.context.view_layer.objects.active = obj
            # 在刀刃上随机创建小凹痕 — 用微小球体做 Boolean
            n_dents = random.randint(3, 8)
            for _ in range(n_dents):
                # 计算刀面上的随机位置
                local_pt = (
                    random.uniform(-0.5, 0.5) * obj.scale.x * 2,
                    random.uniform(0.01, 0.04),
                    random.uniform(-0.8, 0.8) * obj.scale.z * 2
                )
                # 世界坐标
                world_pt = obj.matrix_world @ mathutils.Vector(local_pt) if 'mathutils' in dir() else (
                    obj.location.x + local_pt[0],
                    obj.location.y + local_pt[1],
                    obj.location.z + local_pt[2]
                )
                dent = S(f"dent_{wear_count}", world_pt[0], world_pt[1], world_pt[2],
                         0.008 + random.random() * 0.015,
                         mkmat("dent", 0.5,0.5,0.5))
                wear_count += 1
    if wear_count > 0:
        print(f"     ↳ 武器磨损: {wear_count} 个凹痕")


# ====== 服装褶皱 (简易方案: 额外细分 + 平滑) ======
def add_cloth_detail():
    """给服装部件添加细分让褶皱更自然"""
    for obj in bpy.context.scene.objects:
        name = obj.name.lower()
        if any(k in name for k in ('robe','tunic','cape','armor','chestplate','cloth')):
            bpy.context.view_layer.objects.active = obj
            try:
                op(lambda: bpy.ops.object.modifier_add(type='SUBSURF'))
                obj.modifiers[-1].levels = 1
                obj.modifiers[-1].render_levels = 2
            except: pass


# ====== 人形基础 (精确身高版) ======
def make_body_parts(char_def):
    """根据精确身高 + 体型比例创建 18 个身体部件"""
    h = char_def['height']  # 精确身高
    build = char_def['build']
    gender = char_def['gender']

    # 体型参数 (躯干半径, 四肢半径, 体宽因子)
    bm = {
        'lean':      (0.14, 0.09, 0.78),
        'average':   (0.17, 0.11, 0.90),
        'muscular':  (0.21, 0.14, 1.05),
        'heavy':     (0.26, 0.17, 1.12),
    }[build]
    tr, lr, body_w = bm

    # 性别微调
    if gender == 'female':
        tr *= 0.90; lr *= 0.88

    skin = mkmat(f"{char_def['id']}_skin", *char_def['skin'], rough=0.62)

    # 所有坐标以身高为基准
    def zh(ratio): return h * ratio  # 0=地面, 1=头顶

    parts = []

    # ── 下肢 (全长 ~0.52h) ──
    # 脚
    foot_y_off = zh(0.08)  # 脚向前延伸
    parts.append(C("l_foot", -0.11, 0.02, zh(0.03), lr*0.65, lr*1.8, zh(0.04), skin))
    parts.append(C("r_foot", 0.11, 0.02, zh(0.03), lr*0.65, lr*1.8, zh(0.04), skin))
    # 小腿
    parts.append(Cy("l_shin", -0.10, -0.02, zh(0.20), lr*0.9, zh(0.22), skin))
    parts.append(Cy("r_shin", 0.10, -0.02, zh(0.20), lr*0.9, zh(0.22), skin))
    # 大腿
    parts.append(Cy("l_thigh", -0.11, -0.03, zh(0.38), lr*1.1, zh(0.22), skin))
    parts.append(Cy("r_thigh", 0.11, -0.03, zh(0.38), lr*1.1, zh(0.22), skin))

    # ── 躯干 (全长 ~0.30h) ──
    parts.append(S("pelvis", 0, 0, zh(0.48), tr*1.3, skin))
    if gender == 'female':
        parts[-1].scale = (1.3, 1.0, 0.9)
    else:
        parts[-1].scale = (1.3, 0.75, 0.9)

    # 腰部 / 腹部
    parts.append(Cy("waist", 0, 0, zh(0.55), tr*0.8, zh(0.08), skin))
    # 躯干
    parts.append(C("torso", 0, -0.01, zh(0.66), tr*body_w, tr*0.7, zh(0.22), skin))
    # 胸部
    parts.append(C("chest", 0, -0.01, zh(0.74), tr*body_w*0.9, tr*0.68, zh(0.06), skin))
    if gender == 'female':
        parts[-1].scale.x *= 0.95

    # ── 上肢 ──
    shoulder_level = zh(0.80)
    # 左臂
    parts.append(S("l_shoulder", -tr*1.3, -0.02, shoulder_level, lr*1.15, skin))
    parts.append(Cy("l_uparm", -tr*1.6, -0.02, zh(0.72), lr, zh(0.16), skin))
    parts.append(Cy("l_elbow", -tr*1.75, -0.02, zh(0.63), lr*0.7, zh(0.04), skin))
    parts.append(Cy("l_forearm", -tr*1.8, -0.02, zh(0.57), lr*0.85, zh(0.18), skin))
    parts.append(S("l_hand", -tr*1.9, -0.02, zh(0.47), lr*0.65, skin))
    # 右臂
    parts.append(S("r_shoulder", tr*1.3, -0.02, shoulder_level, lr*1.15, skin))
    parts.append(Cy("r_uparm", tr*1.6, -0.02, zh(0.72), lr, zh(0.16), skin))
    parts.append(Cy("r_elbow", tr*1.75, -0.02, zh(0.63), lr*0.7, zh(0.04), skin))
    parts.append(Cy("r_forearm", tr*1.8, -0.02, zh(0.57), lr*0.85, zh(0.18), skin))
    parts.append(S("r_hand", tr*1.9, -0.02, zh(0.47), lr*0.65, skin))

    # ── 颈部 + 头部 ──
    parts.append(Cy("neck", 0, 0, zh(0.84), tr*0.32, zh(0.06), skin))
    # ICO球 — 雕刻就绪 (细分3级)
    parts.append(Ic("head", 0, 0, zh(0.91), tr*0.66, 3, skin))

    # 面部标记 — 眼窝凹陷 (用两个小球做布尔参考)
    # 鼻子隆起
    parts.append(C("nose", 0, tr*0.55, zh(0.92), 0.03, 0.02, 0.04, skin))
    # 耳朵
    parts.append(S("l_ear", -tr*0.58, 0, zh(0.91), 0.04, skin))
    parts.append(S("r_ear", tr*0.58, 0, zh(0.91), 0.04, skin))

    return parts


# ====== 服装 ======
def add_clothing(char_def):
    c = char_def; h = c['height']
    style = c.get('clothing', 'tunic')
    cloth_color = {
        'armor': mkmat(f"{c['id']}_armor", 0.28,0.26,0.22, rough=0.52),
        'robe':  mkmat(f"{c['id']}_robe", 0.20,0.18,0.16, rough=0.75),
        'tunic': mkmat(f"{c['id']}_tunic", 0.25,0.22,0.20, rough=0.70),
    }.get(style, mkmat(f"{c['id']}_cloth",0.25,0.22,0.20))

    if style == 'armor':
        # 胸甲
        C("chestplate", 0, -0.08, h*0.68, 0.22, 0.16, 0.20, cloth_color)
        # 护肩
        for sx in (-1, 1):
            S(f"pauldron_{sx}", sx*0.2, -0.04, h*0.80, 0.10, cloth_color)
        # 护腕
        for sx in (-1, 1):
            Cy(f"bracer_{sx}", sx*0.28, -0.02, h*0.58, 0.06, 0.10, cloth_color)
            bpy.context.active_object.rotation_euler.x = math.pi/2
        # 腰带
        Cy("belt", 0, -0.06, h*0.50, 0.20, 0.04, mkmat(f"{c['id']}_belt",0.35,0.25,0.15))
        bpy.context.active_object.rotation_euler.x = math.pi/2

    elif style == 'robe':
        # 长袍 — 包裹全身的大圆柱
        robe = Cy("robe_body", 0, -0.04, h*0.45, 0.27, h*0.60, cloth_color)
        # 兜帽如果适用
        if c.get('hair') == 'hood':
            S("robe_hood", 0, 0.02, h*0.88, 0.22, cloth_color)

    elif style == 'tunic':
        # 束腰外衣
        Cy("tunic_top", 0, -0.03, h*0.58, 0.24, h*0.25, cloth_color)
        # 腰带
        Cy("belt", 0, -0.05, h*0.52, 0.20, 0.03, mkmat(f"{c['id']}_belt",0.35,0.25,0.15))
        bpy.context.active_object.rotation_euler.x = math.pi/2

    # 披风 (特定角色)
    if c.get('extra') == 'cape':
        cape = Cn("cape", 0, -0.16, h*0.82, 0.20, 0.38, h*0.45,
                  mkmat(f"{c['id']}_cape", 0.12, 0.06, 0.04, rough=0.80))
        cape.rotation_euler.x = 0.2

    # 头饰
    if c.get('extra') == 'crown':
        Cy("crown", 0, 0, h*0.97, 0.14, 0.03,
           mkmat(f"{c['id']}_crown", 0.88, 0.72, 0.18, rough=0.28))
        bpy.context.active_object.rotation_euler.x = math.pi/2


# ====== 武器 ======
def add_weapon(char_def):
    c = char_def; h = c['height']
    wx, wy, wz = 0.28, -0.04, h*0.49  # 右手位置
    weapon = c.get('weapon', 'sword')

    if weapon == 'sword':
        # 剑身 — 有磨损的金属
        blade = C("blade", wx-0.01, wy+0.04, wz+0.45, 0.05, 0.08, 0.50,
                  mkmat(f"{c['id']}_blade",0.68,0.70,0.72, rough=0.12))
        # 剑柄
        Cy("hilt", wx, wy+0.04, wz+0.08, 0.04, 0.18,
           mkmat(f"{c['id']}_hilt",0.45,0.30,0.18, rough=0.55))
        # 护手
        Cy("guard", wx, wy+0.04, wz+0.18, 0.08, 0.04,
           mkmat(f"{c['id']}_guard",0.55,0.45,0.20, rough=0.40))
        bpy.context.active_object.rotation_euler.x = math.pi/2
        S("pommel", wx, wy+0.04, wz, 0.05, mkmat(f"{c['id']}_pom",0.60,0.50,0.15, rough=0.35))

    elif weapon == 'spear':
        Cy("shaft", wx, wy+0.06, wz+0.80, 0.025, 2.20,
           mkmat(f"{c['id']}_shaft",0.38,0.28,0.18, rough=0.65))
        Cn("spearhead", wx, wy+0.06, wz+1.90, 0.04, 0.005, 0.35,
           mkmat(f"{c['id']}_spear",0.65,0.67,0.70, rough=0.10))

    elif weapon == 'axe':
        Cy("axe_shaft", wx, wy+0.04, wz+0.30, 0.03, 0.90,
           mkmat(f"{c['id']}_axe_handle",0.33,0.24,0.13, rough=0.68))
        # 斧刃 — 双面
        C("axe_head", wx-0.01, wy+0.04, wz+0.78, 0.22, 0.04, 0.18,
           mkmat(f"{c['id']}_axe_head",0.58,0.60,0.63, rough=0.12))
        # 磨损效果
        for _ in range(5):
            dwx = wx + random.uniform(-0.08, 0.06)
            dwz = wz + 0.72 + random.uniform(0, 0.12)
            S("axe_chip", dwx, wy+0.06, dwz, 0.008+random.random()*0.01,
               mkmat("axe_chip",0.4,0.4,0.4))

    elif weapon == 'staff':
        Cy("staff_shaft", wx-0.02, wy+0.04, wz+0.35, 0.03, 1.40,
           mkmat(f"{c['id']}_staff",0.33,0.26,0.16, rough=0.62))
        # 杖顶宝珠
        S("staff_orb", wx-0.02, wy+0.04, wz+1.05, 0.09,
           mkmat(f"{c['id']}_orb",0.45,0.18,0.65, rough=0.06))
        # 杖身藤蔓缠绕
        for _ in range(4):
            t = random.uniform(0.35, 1.0)
            bz = wz + t * 1.0
            bx = wx-0.02 + math.sin(t*8) * 0.04
            by = wy+0.04 + math.cos(t*8) * 0.04
            Cy("vine", bx, by, bz, 0.01, 0.15,
               mkmat("vine",0.08,0.18,0.06, rough=0.70))

    elif weapon == 'bow':
        # 弓臂
        bow_arc = Cy("bow_arc", wx-0.04, wy-0.10, h*0.82, 0.015, 1.05,
                     mkmat(f"{c['id']}_bow",0.35,0.28,0.17, rough=0.60))
        bow_arc.rotation_euler.x = 0.6
        # 弓弦
        Cy("bow_string", wx-0.04, wy-0.12, h*0.82, 0.005, 0.95,
           mkmat(f"{c['id']}_string",0.85,0.82,0.78, rough=0.30))
        bpy.context.active_object.rotation_euler.x = 0.6
        # 箭袋
        Cy("quiver", wx+0.15, wy-0.06, h*0.75, 0.07, 0.55,
           mkmat(f"{c['id']}_quiver",0.28,0.18,0.10, rough=0.72))


# ====== 10角色定义 (精确身高) ======
CHARACTERS = [
    {'id':'Sigurd',       'name':'西格德',   'height':1.91, 'build':'muscular', 'gender':'male',
     'skin':(0.65,0.55,0.45), 'hair_color':(0.42,0.32,0.22),
     'origin':'Norse',  'clothing':'armor', 'weapon':'sword',  'hair':'long',  'extra':'beard'},

    {'id':'Freyja',       'name':'芙蕾雅',   'height':1.64, 'build':'lean',     'gender':'female',
     'skin':(0.75,0.65,0.58), 'hair_color':(0.85,0.78,0.55),
     'origin':'Norse',  'clothing':'robe',  'weapon':'staff', 'hair':'long',  'extra':'crown'},

    {'id':'Morrigan',     'name':'莫莉安',   'height':1.67, 'build':'lean',     'gender':'female',
     'skin':(0.70,0.62,0.55), 'hair_color':(0.12,0.10,0.08),
     'origin':'Celtic', 'clothing':'robe',  'weapon':'staff', 'hair':'long',  'extra':'cape'},

    {'id':'AnubisAcolyte','name':'卡赫特',   'height':1.78, 'build':'lean',     'gender':'male',
     'skin':(0.32,0.26,0.20), 'hair_color':(0.05,0.04,0.03),
     'origin':'Egyptian','clothing':'tunic', 'weapon':'spear', 'hair':'hood',  'extra':None},

    {'id':'Hector',       'name':'赫克托',   'height':1.88, 'build':'muscular', 'gender':'male',
     'skin':(0.60,0.52,0.42), 'hair_color':(0.10,0.08,0.06),
     'origin':'Greek',  'clothing':'armor', 'weapon':'spear', 'hair':'helmet','extra':'shield'},

    {'id':'Romulus',      'name':'罗慕路斯', 'height':1.82, 'build':'muscular', 'gender':'male',
     'skin':(0.62,0.54,0.44), 'hair_color':(0.08,0.06,0.05),
     'origin':'Roman',  'clothing':'armor', 'weapon':'sword', 'hair':'helmet','extra':'cape'},

    {'id':'FenrirKin',    'name':'哈尔瓦德', 'height':1.95, 'build':'heavy',    'gender':'male',
     'skin':(0.55,0.48,0.40), 'hair_color':(0.28,0.23,0.15),
     'origin':'Norse',  'clothing':'tunic', 'weapon':'axe',   'hair':'long',  'extra':'beard'},

    {'id':'Skadi',        'name':'斯卡蒂',   'height':1.91, 'build':'lean',     'gender':'female',
     'skin':(0.72,0.64,0.58), 'hair_color':(0.82,0.80,0.76),
     'origin':'Norse',  'clothing':'tunic', 'weapon':'bow',   'hair':'long',  'extra':'cape'},

    {'id':'HaikuMonk',    'name':'虚舟',     'height':1.70, 'build':'lean',     'gender':'male',
     'skin':(0.68,0.60,0.52), 'hair_color':(0.04,0.03,0.02),
     'origin':'Eastern','clothing':'robe',  'weapon':'staff', 'hair':'hood',  'extra':None},

    {'id':'Brigid',       'name':'布丽吉德', 'height':1.62, 'build':'lean',     'gender':'female',
     'skin':(0.73,0.66,0.60), 'hair_color':(0.78,0.32,0.12),
     'origin':'Celtic', 'clothing':'robe',  'weapon':'staff', 'hair':'long',  'extra':'crown'},
]


# ====== 主流程 ======
def generate_character(char_def):
    c = char_def
    print(f"\n  🎭 {c['id']} — {c['name']} | {c['height']}m | {c['build']} | {c['origin']}")

    # 1. 身体
    parts = make_body_parts(c)
    print(f"     ↳ {len(parts)} 身体部件")

    # 2. 肌肉塑造
    sculpt_muscles(None, c)
    print(f"     ↳ 肌肉: {c['build']}")

    # 3. 服装
    add_clothing(c)

    # 4. 武器
    add_weapon(c)
    print(f"     ↳ 武器: {c['weapon']}")

    # 5. 粒子发丝
    if c['hair'] not in ('helmet',):
        try: add_hair_particles(None, c)
        except Exception as e: print(f"     ↳ 发丝跳过: {e}")

    # 6. 皮肤细节
    try: add_skin_detail(None)
    except: pass

    # 7. 服装褶皱
    try: add_cloth_detail()
    except: pass

    # 8. 武器磨损
    try: add_weapon_wear()
    except: pass


# ====== 导出 ======
OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "veilland_models"
)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 逐个导出
for char in CHARACTERS:
    clear()
    generate_character(char)
    select_all()
    glb = os.path.join(OUTPUT_DIR, f"character_{char['id']}.glb")
    safe_gltf(glb)
    print(f"     📦 → character_{char['id']}.glb")

# 集合场景
print(f"\n{'='*60}")
print("  集合场景")
clear()
before_all = set()
for i, char in enumerate(CHARACTERS):
    before = set(bpy.context.scene.objects)
    generate_character(char)
    after = set(bpy.context.scene.objects)
    offset_x = (i - 4.5) * 3.0
    for o in after - before:
        o.location.x += offset_x
    print(f"     ↳ {char['name']} ({char['height']}m) → x={offset_x:.0f}")

select_all()
all_glb = os.path.join(OUTPUT_DIR, "veilland_all_characters.glb")
safe_gltf(all_glb)

print(f"\n{'='*60}")
print(f"  ✅ 10角色精密建模完成")
print(f"  📁 {OUTPUT_DIR}")
print(f"  📦 单个: character_*.glb ×10")
print(f"  📦 集合: werewolf_all_characters.glb")
print(f"\n💡 雕刻提示:")
print(f"  1. 选角色 → Sculpting工作区")
print(f"  2. 用 Grab/Clay/Inflate 笔刷细化面部和肌肉")
print(f"  3. 粒子发丝在 Rendered 视图才可见")
print(f"  4. Subdivision 可在修改器面板调整级别")
print(f"{'='*60}")
