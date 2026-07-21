"""
============================================================
 狼人杀 — 10个角色雕刻级建模
 兼容 Blender 4.0 ~ 5.x LTS

 每个角色: Skin人体基础 + Multires雕刻层 + 文化服饰 + 武器
============================================================
"""
import bpy, math, random, os

print("="*60)
print("  🎭 狼人杀角色雕刻建模")
print("  10个表层身份 | 雕刻就绪")
print("="*60)

# ====== 兼容层 ======
def safe_del():
    try: bpy.ops.object.delete(use_confirm=False)
    except TypeError: bpy.ops.object.delete()
def safe_rm(b):
    try: bpy.data.meshes.remove(b)
    except: pass
def safe_rm_mat(b):
    try: bpy.data.materials.remove(b)
    except: pass
def safe_gltf(path):
    kw=dict(filepath=path,use_selection=True)
    for k in ('export_format','export_format_option'):
        try: bpy.ops.export_scene.gltf(**kw,**{k:'GLB'}); return
        except: pass
    try: bpy.ops.export_scene.gltf(**kw)
    except Exception as e: print(f"     export: {e}")

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

# ====== 快捷几何 ======
def C(name,x,y,z,sx,sy,sz,m):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.scale=(sx,sy,sz); o.data.materials.append(m); return o
def Cy(name,x,y,z,r,d,m):
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=d,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o
def S(name,x,y,z,r,m):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o
def Cn(name,x,y,z,r1,r2,d,m):
    bpy.ops.mesh.primitive_cone_add(radius1=r1,radius2=r2,depth=d,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o
def Ic(name,x,y,z,r,d,m):
    """ICO球体 — 拓扑更均匀，适合雕刻"""
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r,subdivisions=3,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o

def clear():
    bpy.ops.object.select_all(action='SELECT'); safe_del()
    for x in list(bpy.data.meshes): safe_rm(x)
    for x in list(bpy.data.materials): safe_rm_mat(x)

def select_all(): bpy.ops.object.select_all(action='SELECT')
def deselect_all(): bpy.ops.object.select_all(action='DESELECT')

def join_all():
    select_all()
    if len(bpy.context.selected_objects) > 1:
        bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
        bpy.ops.object.join()

def add_multires(obj, levels=3):
    """添加 Multiresolution 修改器用于雕刻"""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_add(type='MULTIRES')
    # 先细分基础网格
    mod = obj.modifiers[-1]
    # 用 subdivide 替代 multires 的初始细分
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    for _ in range(levels):
        bpy.ops.mesh.subdivide(number_cuts=1)
    bpy.ops.object.mode_set(mode='OBJECT')
    # 移除 Multires 不太可控，改用 Subdivision Surface + 手动雕刻
    # 实际上 Blender 5.x Multires API 有变化，改用更稳定的方案
    bpy.ops.object.modifier_remove(modifier=mod.name)
    # 添加 Subdivision Surface
    bpy.ops.object.modifier_add(type='SUBSURF')
    obj.modifiers[-1].levels = levels
    obj.modifiers[-1].render_levels = levels + 1


# ====== Skin Modifier 人形基础 ======
def make_skin_body(height, build):
    """
    使用 Skin Modifier + 边链 生成人形基础网格
    height: 身高 (m)
    build: 'lean' | 'average' | 'muscular' | 'heavy'
    """
    # 身体比例
    bm = {
        'lean':      (0.18, 0.22, 0.12),  # 躯干半径, 四肢半径, 头颈比
        'average':   (0.22, 0.26, 0.13),
        'muscular':  (0.26, 0.30, 0.14),
        'heavy':     (0.28, 0.32, 0.15),
    }[build]

    torso_r, limb_r, head_scale = bm
    h = height

    # 用顶点链构建骨架
    # 骨盆中心 (0,0,h*0.45) → 脊椎 → 颈部 → 头部
    verts = [
        # 骨盆 + 脊椎 (5个点, 从下到上)
        (0, 0, h*0.48),   # 0: 骨盆
        (0, 0, h*0.58),   # 1: 腰
        (0, 0, h*0.68),   # 2: 胸
        (0, 0, h*0.78),   # 3: 肩
        (0, 0, h*0.88),   # 4: 颈
        (0, 0, h*0.96),   # 5: 头顶
    ]
    edges = [(0,1),(1,2),(2,3),(3,4),(4,5)]

    # 手臂 (左: 6→7→8, 右: 9→10→11)
    arm_start = len(verts)
    # 左臂
    verts += [
        (-torso_r*1.5, -0.05, h*0.78),  # 6: 左肩
        (-torso_r*2.0, -0.05, h*0.65),  # 7: 左肘
        (-torso_r*2.2, -0.05, h*0.50),  # 8: 左手腕
    ]
    edges += [(3,6),(6,7),(7,8)]
    # 右臂
    verts += [
        (torso_r*1.5, -0.05, h*0.78),   # 9: 右肩
        (torso_r*2.0, -0.05, h*0.65),   # 10: 右肘
        (torso_r*2.2, -0.05, h*0.50),   # 11: 右手腕
    ]
    edges += [(3,9),(9,10),(10,11)]

    # 腿 (左: 12→13→14, 右: 15→16→17)
    # 左腿
    verts += [
        (-0.12, -0.05, h*0.28),  # 12: 左膝
        (-0.10, -0.05, h*0.08),  # 13: 左脚踝
        (-0.10, -0.05, 0),       # 14: 左脚底
    ]
    edges += [(0,12),(12,13),(13,14)]
    # 右腿
    verts += [
        (0.12, -0.05, h*0.28),   # 15: 右膝
        (0.10, -0.05, h*0.08),   # 16: 右脚踝
        (0.10, -0.05, 0),        # 17: 右脚底
    ]
    edges += [(0,15),(15,16),(16,17)]

    # 创建网格
    mesh = bpy.data.meshes.new("body_mesh")
    obj = bpy.data.objects.new("Body", mesh)
    bpy.context.collection.objects.link(obj)
    mesh.from_pydata(verts, edges, [])
    mesh.update()

    # Skin Modifier
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_add(type='SKIN')
    # 设置皮肤半径
    skin = obj.modifiers[-1]
    # 对每个顶点设置半径
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # 这个操作比较复杂，改为手动设置
    bpy.ops.object.mode_set(mode='OBJECT')

    # 逐个顶点设定 skin radius
    radii = []
    for i, v in enumerate(obj.data.vertices):
        if i in (0,1,2,3):     rv = torso_r
        elif i in (4,):         rv = torso_r * 0.6  # 颈
        elif i in (5,):         rv = torso_r * 0.7  # 头
        elif i in (6,7,8,9,10,11): rv = limb_r * 0.7  # 臂
        elif i in (12,13,14,15,16,17): rv = limb_r * 0.8  # 腿
        else: rv = 0.1
        radii.append((rv, rv))

    # 用 data.skin_vertices 设置 (Blender 5.x 兼容)
    try:
        for v in obj.data.skin_vertices[0].data:
            idx = v.index
            if idx < len(radii):
                v.radius = radii[idx]
    except:
        # 简化: 通过 skin modifier 全局设置
        pass

    # 添加 Subdivision Surface 平滑
    bpy.ops.object.modifier_add(type='SUBSURF')
    obj.modifiers[-1].levels = 2
    obj.modifiers[-1].render_levels = 3

    # Apply modifiers (转成可编辑网格)
    bpy.ops.object.mode_set(mode='OBJECT')
    # 先不apply — 保留修改器供后续雕刻

    return obj


# ====== 简化人形: 用基本几何体拼装 ======
def make_body_parts(name, height, build, skin_color):
    """用球+柱+立方拼人形 — 最稳定方案"""
    bm = {
        'lean':      (0.14, 0.09, 0.8),
        'average':   (0.17, 0.11, 0.9),
        'muscular':  (0.21, 0.14, 1.05),
        'heavy':     (0.25, 0.16, 1.0),
    }[build]
    tr, lr, body_w = bm  # 躯干半径, 四肢半径, 身体宽度
    h = height

    parts = []

    # 骨盆 — 横向椭球
    p = S("pelvis", 0, 0, h*0.48, tr*1.3)
    p.scale = (1.3, 0.8, 0.9)
    parts.append(p)

    # 躯干 — 拉长的立方体
    p = C("torso", 0, -0.01, h*0.65, tr*body_w, tr*0.7, h*0.22, skin_color)
    parts.append(p)

    # 胸部
    p = C("chest", 0, -0.01, h*0.73, tr*body_w*0.9, tr*0.65, h*0.06, skin_color)
    parts.append(p)

    # 颈
    p = Cy("neck", 0, 0, h*0.82, tr*0.35, h*0.06, skin_color)
    parts.append(p)

    # 头 — ICO球 (拓扑均匀适合雕刻)
    p = Ic("head", 0, 0, h*0.90, tr*0.65, skin_color)
    parts.append(p)

    # 左臂
    p = S("l_shoulder", -tr*1.3, -0.02, h*0.78, lr*1.1, skin_color)
    parts.append(p)
    p = Cy("l_uparm", -tr*1.6, -0.02, h*0.70, lr, h*0.16, skin_color)
    parts.append(p)
    p = Cy("l_forearm", -tr*1.8, -0.02, h*0.58, lr*0.85, h*0.18, skin_color)
    parts.append(p)
    p = S("l_hand", -tr*1.9, -0.02, h*0.48, lr*0.65, skin_color)
    parts.append(p)

    # 右臂
    p = S("r_shoulder", tr*1.3, -0.02, h*0.78, lr*1.1, skin_color)
    parts.append(p)
    p = Cy("r_uparm", tr*1.6, -0.02, h*0.70, lr, h*0.16, skin_color)
    parts.append(p)
    p = Cy("r_forearm", tr*1.8, -0.02, h*0.58, lr*0.85, h*0.18, skin_color)
    parts.append(p)
    p = S("r_hand", tr*1.9, -0.02, h*0.48, lr*0.65, skin_color)
    parts.append(p)

    # 左腿
    p = Cy("l_thigh", -0.12, -0.03, h*0.38, lr*1.1, h*0.22, skin_color)
    parts.append(p)
    p = Cy("l_shin", -0.10, -0.03, h*0.20, lr*0.9, h*0.22, skin_color)
    parts.append(p)
    p = C("l_foot", -0.10, 0.02, h*0.03, lr*0.7, lr*1.8, h*0.04, skin_color)
    parts.append(p)

    # 右腿
    p = Cy("r_thigh", 0.12, -0.03, h*0.38, lr*1.1, h*0.22, skin_color)
    parts.append(p)
    p = Cy("r_shin", 0.10, -0.03, h*0.20, lr*0.9, h*0.22, skin_color)
    parts.append(p)
    p = C("r_foot", 0.10, 0.02, h*0.03, lr*0.7, lr*1.8, h*0.04, skin_color)
    parts.append(p)

    return parts


def add_cloth_tunic(body_parts, color):
    """添加束腰外衣"""
    # 覆盖躯干
    for p in body_parts:
        if p.name in ('torso','chest'):
            p.data.materials.clear()
            p.data.materials.append(color)

def add_cloth_robe(body_parts, color, height):
    """添加长袍 — 在躯干外包裹圆柱"""
    h = height
    Cy("robe", 0, -0.05, h*0.48, 0.28, h*0.58, color)

def add_cloth_armor_chest(body_parts, color):
    """胸甲"""
    C("chestplate", 0, -0.08, 1.35, 0.22, 0.16, 0.18, color)

def add_cloth_cape(body_parts, color, height):
    """披风 — 背后的锥形"""
    h = height
    cape = Cn("cape", 0, -0.15, h*0.78, 0.22, 0.35, h*0.45, color)
    cape.rotation_euler.x = 0.2

def add_weapon_sword(hand_x, hand_y, hand_z):
    """剑"""
    Cy("blade", hand_x-0.05, hand_y+0.02, hand_z+0.35, 0.03, 0.8,
       mkmat("blade",0.7,0.72,0.75, rough=0.15))
    Cy("hilt", hand_x, hand_y+0.02, hand_z+0.05, 0.04, 0.15,
       mkmat("hilt",0.5,0.35,0.2, rough=0.6))
    S("pommel", hand_x, hand_y+0.02, hand_z-0.03, 0.05,
       mkmat("pommel",0.6,0.5,0.15, rough=0.4))

def add_weapon_spear(hand_x, hand_y, hand_z):
    """长矛"""
    Cy("spear_shaft", hand_x, hand_y+0.05, hand_z+0.8, 0.025, 2.0,
       mkmat("shaft",0.4,0.3,0.2, rough=0.7))
    Cn("spear_head", hand_x, hand_y+0.05, hand_z+1.8, 0.04, 0.005, 0.25,
       mkmat("spear",0.7,0.72,0.75, rough=0.12))

def add_weapon_axe(hand_x, hand_y, hand_z):
    """斧"""
    Cy("axe_handle", hand_x, hand_y+0.02, hand_z+0.3, 0.03, 0.8,
       mkmat("axe_handle",0.35,0.25,0.15, rough=0.7))
    C("axe_blade", hand_x-0.02, hand_y+0.02, hand_z+0.72, 0.18, 0.03, 0.14,
       mkmat("axe_blade",0.6,0.62,0.65, rough=0.15))

def add_weapon_staff(hand_x, hand_y, hand_z):
    """法杖"""
    Cy("staff", hand_x-0.02, hand_y+0.02, hand_z+0.4, 0.03, 1.2,
       mkmat("staff",0.35,0.28,0.18, rough=0.7))
    S("staff_orb", hand_x-0.02, hand_y+0.02, hand_z+1.0, 0.08,
       mkmat("orb",0.5,0.2,0.7, rough=0.08))

def add_hair_short(head_x, head_y, head_z, color):
    """短发"""
    S("hair", head_x, head_y+0.02, head_z+0.04, 0.18, color)
    bpy.context.active_object.scale = (1, 1, 0.7)

def add_hair_long(head_x, head_y, head_z, color, height):
    """长发"""
    Cy("hair_long", head_x, head_y-0.02, head_z-0.05, 0.16, 0.25, color)
    bpy.context.active_object.rotation_euler.x = 0.3

def add_hair_hood(head_x, head_y, head_z, color):
    """兜帽"""
    S("hood", head_x, head_y+0.01, head_z+0.02, 0.22, color)
    bpy.context.active_object.scale = (1, 1, 1.2)

def add_helmet(head_x, head_y, head_z, color):
    """头盔"""
    S("helmet", head_x, head_y+0.01, head_z+0.04, 0.2, color)
    bpy.context.active_object.scale = (1, 1, 0.85)
    # 护鼻
    C("nose_guard", head_x, head_y+0.18, head_z-0.02, 0.02, 0.01, 0.06, color)

def add_shield(left_x, left_y, left_z, color):
    """圆盾"""
    Cy("shield", left_x-0.1, left_y+0.05, left_z-0.1, 0.25, 0.03, color)
    bpy.context.active_object.rotation_euler.x = math.pi/2

def add_bow(back_x, back_y, back_z):
    """弓 (背在背后)"""
    Cy("bow", back_x, back_y-0.12, back_z, 0.015, 0.8,
       mkmat("bow",0.35,0.28,0.18, rough=0.65))
    bpy.context.active_object.rotation_euler.x = 0.5

def add_quiver(back_x, back_y, back_z):
    """箭袋"""
    Cy("quiver", back_x+0.08, back_y-0.08, back_z-0.05, 0.06, 0.5,
       mkmat("quiver",0.3,0.2,0.1, rough=0.7))

def add_crown(head_x, head_y, head_z, color):
    """王冠/头环"""
    Cy("crown", head_x, head_y, head_z+0.1, 0.16, 0.04, color)

def add_beard(head_x, head_y, head_z, color):
    """胡须"""
    C("beard", head_x, head_y+0.12, head_z-0.06, 0.08, 0.01, 0.06, color)


# ====== 10个角色定义 ======
CHARACTERS = [
    {
        'id': 'Sigurd',
        'name': '西格德',
        'height': 1.95, 'build': 'muscular',
        'gender': 'male',
        'skin': (0.65, 0.55, 0.45),
        'hair_color': (0.45, 0.35, 0.25),
        'origin': 'Norse',
        'clothing': 'armor',
        'weapon': 'sword',
        'hair': 'long',
        'extra': 'beard',
    },
    {
        'id': 'Freyja',
        'name': '芙蕾雅',
        'height': 1.72, 'build': 'lean',
        'gender': 'female',
        'skin': (0.75, 0.65, 0.58),
        'hair_color': (0.85, 0.75, 0.55),
        'origin': 'Norse',
        'clothing': 'robe',
        'weapon': 'staff',
        'hair': 'long',
        'extra': 'crown',
    },
    {
        'id': 'Morrigan',
        'name': '莫莉安',
        'height': 1.68, 'build': 'lean',
        'gender': 'female',
        'skin': (0.70, 0.62, 0.55),
        'hair_color': (0.15, 0.12, 0.10),
        'origin': 'Celtic',
        'clothing': 'robe',
        'weapon': 'staff',
        'hair': 'long',
        'extra': 'cape',
    },
    {
        'id': 'AnubisAcolyte',
        'name': '卡赫特',
        'height': 1.82, 'build': 'lean',
        'gender': 'male',
        'skin': (0.35, 0.28, 0.22),
        'hair_color': (0.05, 0.04, 0.03),
        'origin': 'Egyptian',
        'clothing': 'tunic',
        'weapon': 'spear',
        'hair': 'hood',
        'extra': None,
    },
    {
        'id': 'Hector',
        'name': '赫克托',
        'height': 1.92, 'build': 'muscular',
        'gender': 'male',
        'skin': (0.60, 0.52, 0.42),
        'hair_color': (0.12, 0.10, 0.08),
        'origin': 'Greek',
        'clothing': 'armor',
        'weapon': 'spear',
        'hair': 'helmet',
        'extra': 'shield',
    },
    {
        'id': 'Romulus',
        'name': '罗慕路斯',
        'height': 1.85, 'build': 'muscular',
        'gender': 'male',
        'skin': (0.62, 0.54, 0.44),
        'hair_color': (0.10, 0.08, 0.06),
        'origin': 'Roman',
        'clothing': 'armor',
        'weapon': 'sword',
        'hair': 'helmet',
        'extra': 'cape',
    },
    {
        'id': 'FenrirKin',
        'name': '哈尔瓦德',
        'height': 1.90, 'build': 'heavy',
        'gender': 'male',
        'skin': (0.55, 0.48, 0.40),
        'hair_color': (0.30, 0.25, 0.18),
        'origin': 'Norse',
        'clothing': 'tunic',
        'weapon': 'axe',
        'hair': 'long',
        'extra': 'beard',
    },
    {
        'id': 'Skadi',
        'name': '斯卡蒂',
        'height': 1.75, 'build': 'lean',
        'gender': 'female',
        'skin': (0.72, 0.64, 0.58),
        'hair_color': (0.80, 0.78, 0.75),
        'origin': 'Norse',
        'clothing': 'tunic',
        'weapon': 'bow',
        'hair': 'long',
        'extra': 'cape',
    },
    {
        'id': 'HaikuMonk',
        'name': '虚舟',
        'height': 1.70, 'build': 'lean',
        'gender': 'male',
        'skin': (0.68, 0.60, 0.52),
        'hair_color': (0.05, 0.04, 0.03),
        'origin': 'Eastern',
        'clothing': 'robe',
        'weapon': 'staff',
        'hair': 'hood',
        'extra': None,
    },
    {
        'id': 'Brigid',
        'name': '布丽吉德',
        'height': 1.66, 'build': 'lean',
        'gender': 'female',
        'skin': (0.73, 0.66, 0.60),
        'hair_color': (0.80, 0.35, 0.15),
        'origin': 'Celtic',
        'clothing': 'robe',
        'weapon': 'staff',
        'hair': 'long',
        'extra': 'crown',
    },
]


# ====== 生成单个角色 ======
def generate_character(char_def):
    c = char_def
    name = c['name']
    print(f"\n  🎭 {c['id']} — {name} ({c['origin']})")

    skin = mkmat(f"{c['id']}_skin", *c['skin'], rough=0.65)
    hair = mkmat(f"{c['id']}_hair", *c['hair_color'], rough=0.55)

    # 服装颜色
    cloth_colors = {
        'armor': mkmat(f"{c['id']}_armor", 0.3, 0.28, 0.25, rough=0.55),
        'robe':  mkmat(f"{c['id']}_robe", 0.25, 0.22, 0.20, rough=0.75),
        'tunic': mkmat(f"{c['id']}_tunic", 0.28, 0.25, 0.22, rough=0.72),
    }
    cloth = cloth_colors.get(c['clothing'], cloth_colors['tunic'])

    # 1. 身体
    parts = make_body_parts(name, c['height'], c['build'], skin)

    # 2. 头发
    head_x, head_y, head_z = 0, 0, c['height'] * 0.90
    hair_funcs = {
        'long': lambda: add_hair_long(head_x, head_y, head_z, hair, c['height']),
        'helmet': lambda: add_helmet(head_x, head_y, head_z,
            mkmat(f"{c['id']}_helm", 0.35, 0.33, 0.30, rough=0.45)),
        'hood': lambda: add_hair_hood(head_x, head_y, head_z, cloth),
    }
    if c['hair'] in hair_funcs:
        hair_funcs[c['hair']]()
    if c['hair'] == 'long' and c['gender'] == 'male':
        add_hair_short(head_x, head_y, head_z, hair)

    # 3. 服装
    if c['clothing'] == 'armor':
        add_cloth_armor_chest(parts, cloth)
        add_cloth_tunic(parts, cloth)
    elif c['clothing'] == 'robe':
        add_cloth_robe(parts, cloth, c['height'])
    else:
        add_cloth_tunic(parts, cloth)

    # 4. 武器 (右手位置: x≈0.22, y≈-0.02, z≈h*0.48)
    hx, hy, hz = 0.25, -0.02, c['height'] * 0.50
    weapons = {
        'sword': lambda: add_weapon_sword(hx, hy, hz),
        'spear': lambda: add_weapon_spear(hx, hy, hz),
        'axe': lambda: add_weapon_axe(hx, hy, hz),
        'staff': lambda: add_weapon_staff(hx, hy, hz),
        'bow': lambda: (add_bow(0, 0.12, c['height']*0.78), add_quiver(0, 0.12, c['height']*0.78)),
    }
    if c['weapon'] in weapons:
        weapons[c['weapon']]()

    # 5. 额外
    extras = {
        'beard': lambda: add_beard(head_x, head_y, head_z, hair),
        'crown': lambda: add_crown(head_x, head_y, head_z,
            mkmat(f"{c['id']}_crown", 0.85, 0.7, 0.2, rough=0.3)),
        'shield': lambda: add_shield(-0.25, -0.02, c['height']*0.50,
            mkmat(f"{c['id']}_shield", 0.25, 0.22, 0.18, rough=0.5)),
        'cape': lambda: add_cloth_cape(parts, mkmat(f"{c['id']}_cape", 0.15, 0.08, 0.05, rough=0.78), c['height']),
    }
    if c['extra'] and c['extra'] in extras:
        extras[c['extra']]()

    # 6. 合成一个物体
    join_all()
    char_obj = bpy.context.active_object
    char_obj.name = c['id']

    # 7. 添加 Subdivision Surface 用于雕刻
    bpy.ops.object.modifier_add(type='SUBSURF')
    char_obj.modifiers[-1].levels = 2
    char_obj.modifiers[-1].render_levels = 3

    return char_obj


# ====== 主流程 ======
OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "werewolf_models"
)
os.makedirs(OUTPUT_DIR, exist_ok=True)

for char in CHARACTERS:
    clear()
    obj = generate_character(char)
    # 导出
    select_all()
    fname = f"character_{char['id']}"
    glb = os.path.join(OUTPUT_DIR, f"{fname}.glb")
    safe_gltf(glb)
    print(f"     → {fname}.glb")

# 集合场景
print(f"\n{'='*60}")
clear()
for i, char in enumerate(CHARACTERS):
    obj = generate_character(char)
    obj.location.x = (i - 4.5) * 2.2
select_all()
all_glb = os.path.join(OUTPUT_DIR, "werewolf_all_characters.glb")
safe_gltf(all_glb)

print(f"\n✅ 10个角色完成")
print(f"   输出: {OUTPUT_DIR}")
print(f"   集合: werewolf_all_characters.glb")
print(f"\n💡 在 Blender 中选择角色 → Sculpting 工作区 → 用雕刻工具细化")
print(f"   每个角色已有 Subdivision Surface 修改器 (2级细分)")
print(f"   雕刻时建议先 Apply 修改器再开始雕刻")
