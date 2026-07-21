"""
============================================================
 狼人杀 Blender 共享库 — 所有角色脚本引用此文件
 兼容 Blender 4.0 ~ 5.x LTS
============================================================
"""
import bpy, math, random, os, sys

# ====== 上下文 ======
CTX = None
def _find_ctx():
    global CTX
    for w in bpy.context.window_manager.windows:
        for a in w.screen.areas:
            if a.type == 'VIEW_3D':
                for r in a.regions:
                    if r.type == 'WINDOW':
                        CTX = {'window':w,'screen':w.screen,'area':a,'region':r,'scene':bpy.context.scene}
                        return
_find_ctx()

def op(fn):
    if CTX:
        with bpy.context.temp_override(**CTX): return fn()
    return fn()

# ====== 材料 ======
def mkmat(name, r, g, b, a=1.0, rough=0.75):
    m = bpy.data.materials.new(name=name); m.use_nodes = True
    t = m.node_tree; t.nodes.clear()
    bsdf = None
    for bt in ('ShaderNodeBsdfPrincipled', 'ShaderNodeBsdfPrincipledv2'):
        try: bsdf = t.nodes.new(bt); break
        except RuntimeError: pass
    out = None
    for ot in ('ShaderNodeOutputMaterial', 'ShaderNodeOutput'):
        try: out = t.nodes.new(ot); break
        except RuntimeError: pass
    try: t.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    except KeyError:
        so = next((o for o in bsdf.outputs if o.type == 'SHADER'), bsdf.outputs[0])
        si = next((i for i in out.inputs if i.type == 'SHADER'), out.inputs[0])
        t.links.new(so, si)
    for sn, sv in (('Base Color', (r, g, b, a)), ('Roughness', rough)):
        try:
            if sn in bsdf.inputs: bsdf.inputs[sn].default_value = sv
        except: pass
    return m

# ====== 几何体 ======
def C(name, x, y, z, sx, sy, sz, m):
    op(lambda: bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z)))
    o = bpy.context.active_object; o.name = name; o.scale = (sx, sy, sz); o.data.materials.append(m); return o

def Cy(name, x, y, z, r, d, m):
    op(lambda: bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, location=(x, y, z), vertices=16))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(m); return o

def S(name, x, y, z, r, m):
    op(lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z), segments=16, ring_count=12))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(m); return o

def Cn(name, x, y, z, r1, r2, d, m):
    op(lambda: bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=d, location=(x, y, z), vertices=16))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(m); return o

def Ic(name, x, y, z, r, subdiv, m):
    op(lambda: bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=subdiv, location=(x, y, z)))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(m); return o

# ====== 场景 ======
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

def export_glb(path):
    select_all()
    def _do():
        kw = dict(filepath=path, use_selection=True)
        for k in ('export_format', 'export_format_option'):
            try: bpy.ops.export_scene.gltf(**kw, **{k: 'GLB'}); return
            except: pass
        try: bpy.ops.export_scene.gltf(**kw)
        except Exception as e: print(f"     export: {e}")
    op(_do)
    print(f"     📦 → {os.path.basename(path)}")

# ====== 身体 (体型分化版) ======

# 体型签名: (躯干半径, 四肢半径, 体宽, 肩宽因子, 腰窄因子, 臀宽因子, 颈粗因子, 头身比)
BODY_SIGNATURES = {
    # 窈窕纤细型 — 德鲁伊/僧侣/圣女
    'slender_female': (0.12, 0.07, 0.72, 0.85, 0.78, 1.15, 0.75, 7.2),   # 莫莉安/布丽吉德
    'slender_male':   (0.13, 0.08, 0.75, 0.90, 0.82, 0.90, 0.80, 7.0),    # 虚舟/卡赫特
    'petite_female':  (0.11, 0.07, 0.70, 0.82, 0.75, 1.12, 0.72, 7.5),   # 芙蕾雅
    # 运动员型 — 猎手
    'athletic_female':(0.15, 0.10, 0.85, 1.05, 0.88, 1.00, 0.90, 7.0),   # 斯卡蒂
    'athletic_male':  (0.17, 0.12, 0.92, 1.10, 0.90, 0.92, 0.95, 6.8),   # (中等战士)
    # 肌肉型 — 战士
    'muscular_male':  (0.20, 0.14, 1.05, 1.20, 0.95, 0.88, 1.05, 6.5),   # 西格德/赫克托
    'compact_male':   (0.19, 0.13, 1.02, 1.15, 0.92, 0.90, 1.00, 6.6),   # 罗慕路斯
    # 魁梧型
    'heavy_male':     (0.25, 0.17, 1.12, 1.35, 1.00, 0.90, 1.20, 6.2),   # 哈尔瓦德
}

def get_body_shape(char_def):
    """返回角色的体型签名"""
    shape_key = char_def.get('shape', 'slender_male')
    return BODY_SIGNATURES.get(shape_key, BODY_SIGNATURES['slender_male'])

def make_body(char_def):
    h = char_def['height']; gender = char_def['gender']
    tr, lr, body_w, shoulder_w, waist_narrow, hip_wide, neck_thick, head_ratio = get_body_shape(char_def)

    skin = mkmat(f"{char_def['id']}_skin", *char_def['skin'], rough=0.62)
    # 辅助颜色
    lip_color = mkmat(f"{char_def['id']}_lip",
        min(1,char_def['skin'][0]*0.7), min(1,char_def['skin'][1]*0.3), min(1,char_def['skin'][2]*0.25), rough=0.35)
    eye_white = mkmat(f"{char_def['id']}_eyeW", 0.92,0.90,0.88, rough=0.08)
    eye_iris = mkmat(f"{char_def['id']}_eyeI", *[c*0.4 for c in char_def['hair_color']], rough=0.05)
    eye_pupil = mkmat(f"{char_def['id']}_eyeP", 0.02,0.02,0.02, rough=0.02)

    # ══════ 下肢 ══════
    # 脚 — 足弓+脚趾
    C("l_foot", -0.11, 0.06, h*0.015, lr*0.55, lr*1.6, h*0.025, skin)
    C("l_foot_front", -0.11, 0.06, h*0.04, lr*0.5, lr*0.7, h*0.015, skin)
    for tx in [-0.04, -0.02, 0, 0.02, 0.04]:
        S(f"l_toe", -0.11+tx, lr*1.55, h*0.005, 0.01, skin)
    C("r_foot", 0.11, 0.06, h*0.015, lr*0.55, lr*1.6, h*0.025, skin)
    C("r_foot_front", 0.11, 0.06, h*0.04, lr*0.5, lr*0.7, h*0.015, skin)
    for tx in [-0.04, -0.02, 0, 0.02, 0.04]:
        S(f"r_toe", 0.11+tx, lr*1.55, h*0.005, 0.01, skin)

    # 脚踝
    S("l_ankle", -0.10, -0.01, h*0.06, lr*0.45, skin)
    S("r_ankle", 0.10, -0.01, h*0.06, lr*0.45, skin)

    # 小腿 — 胫骨+腓肠肌(小腿肚)
    Cy("l_shin", -0.10, -0.04, h*0.20, lr*0.85, h*0.22, skin)
    S("l_calf", -0.10, -0.06, h*0.22, lr*0.5, skin)  # 小腿肚
    Cy("r_shin", 0.10, -0.04, h*0.20, lr*0.85, h*0.22, skin)
    S("r_calf", 0.10, -0.06, h*0.22, lr*0.5, skin)

    # 膝盖
    S("l_knee", -0.10, -0.01, h*0.32, lr*0.55, skin)
    S("r_knee", 0.10, -0.01, h*0.32, lr*0.55, skin)

    # 大腿 — 股四头肌(前凸)+股二头肌(后凸)
    Cy("l_thigh", -0.11, -0.05, h*0.42, lr*1.15, h*0.18, skin)
    S("l_quad", -0.11, -0.08, h*0.42, lr*0.6, skin)  # 大腿前肌
    Cy("r_thigh", 0.11, -0.05, h*0.42, lr*1.15, h*0.18, skin)
    S("r_quad", 0.11, -0.08, h*0.42, lr*0.6, skin)

    # ══════ 骨盆+躯干 ══════
    p = S("pelvis", 0, 0, h*0.49, tr*1.25, skin)
    p.scale = (1.3, 1.0 if gender=='female' else 0.75, 0.85)

    # 腹肌 — 6块 (muscular/heavy才有)
    if build in ('muscular', 'heavy'):
        for row in range(3):
            for col in range(2):
                ax = (col-0.5)*tr*0.6; az = h*0.56 + row*h*0.03
                C(f"abs_{row}{col}", ax, -tr*0.55, az, tr*0.22, tr*0.08, h*0.022, skin)

    # 腰部
    Cy("waist", 0, -0.01, h*0.57, tr*0.78, h*0.06, skin)

    # 肋骨笼
    C("ribcage", 0, -0.02, h*0.65, tr*body_w*0.9, tr*0.65, h*0.16, skin)
    # 肋骨线 — 侧面弧形
    for i in range(4):
        rx = tr*body_w*0.85; rz = h*0.60 + i*h*0.025
        Cy(f"rib_l{i}", -rx, -0.02, rz, 0.015, tr*0.6, skin)
        bpy.context.active_object.rotation_euler.z = 0.4
        Cy(f"rib_r{i}", rx, -0.02, rz, 0.015, tr*0.6, skin)
        bpy.context.active_object.rotation_euler.z = -0.4

    # 胸肌
    C("chest", 0, -0.03, h*0.73, tr*body_w*(0.95 if gender=='female' else 0.9), tr*0.62, h*0.05, skin)
    # 胸大肌左右分离线
    for sx in (-1, 1):
        S(f"pectoral_{sx}", sx*tr*0.35, -tr*0.45, h*0.725, tr*0.32, skin)
    # 锁骨
    for sx in (-1, 1):
        Cy(f"clavicle_{sx}", sx*tr*0.6, -tr*0.25, h*0.78, 0.02, tr*0.7, skin)
        bpy.context.active_object.rotation_euler.z = sx*0.25

    # ══════ 上肢 ══════
    sl = h*0.80  # 肩高度
    for side, sx in [('l', -1), ('r', 1)]:
        # 肩关节
        S(f"{side}_shoulder", sx*tr*1.35, -0.03, sl, lr*1.2, skin)
        # 三角肌
        S(f"{side}_deltoid", sx*tr*1.55, -0.06, h*0.76, lr*0.55, skin)
        # 上臂 — 肱二头肌+肱三头肌
        Cy(f"{side}_uparm", sx*tr*1.65, -0.04, h*0.71, lr*1.05, h*0.15, skin)
        S(f"{side}_bicep", sx*tr*1.72, -0.07, h*0.72, lr*0.4, skin)
        # 肘
        S(f"{side}_elbow", sx*tr*1.78, -0.02, h*0.63, lr*0.6, skin)
        # 前臂
        Cy(f"{side}_forearm", sx*tr*1.82, -0.04, h*0.56, lr*0.88, h*0.17, skin)
        # 手腕
        S(f"{side}_wrist", sx*tr*1.85, -0.03, h*0.47, lr*0.45, skin)
        # 手掌
        C(f"{side}_palm", sx*tr*1.9, -0.04, h*0.455, lr*0.55, lr*0.2, h*0.03, skin)
        # 手指 — 5根
        finger_base_y = -lr*0.1
        for fi, (fx, fz_off) in enumerate([(-0.04, 0.01), (-0.02, 0.015), (0, 0.015), (0.02, 0.01), (0.04, 0.005)]):
            for seg in range(2):
                fz = h*0.445 + seg*0.025
                Cy(f"{side}_finger{fi}_{seg}", sx*tr*1.92+fx, finger_base_y, fz+fz_off, 0.012, 0.028, skin)
            # 拇指 (只一根，角度不同)
            if fi == 0:
                Cy(f"{side}_thumb", sx*tr*1.88, finger_base_y-0.02, h*0.46, 0.015, 0.03, skin)
                bpy.context.active_object.rotation_euler.z = sx*0.5

    # ══════ 颈部 ══════
    Cy("neck", 0, -0.02, h*0.84, tr*0.30, h*0.06, skin)
    # 喉结 (男性)
    if gender == 'male':
        S("adams_apple", 0, -tr*0.25, h*0.845, 0.015, skin)

    # ══════ 头部+面部 ══════
    head_cy = h*0.91; head_r = tr*0.66
    # 颅骨 — ICO球 (均匀拓扑)
    Ic("head", 0, 0, head_cy, head_r, 3, skin)
    # 下颌
    C("jaw", 0, -head_r*0.1, head_cy-head_r*0.2, head_r*0.65, head_r*0.45, head_r*0.25, skin)
    # 下巴
    S("chin", 0, -head_r*0.35, head_cy-head_r*0.4, head_r*0.18, skin)

    # ── 眼睛 ──
    for sx in (-1, 1):
        eye_x = sx*head_r*0.35; eye_y = -head_r*0.68; eye_z = head_cy+head_r*0.05
        # 眼窝凹陷
        S(f"eye_socket_{sx}", eye_x, eye_y, eye_z, head_r*0.14, skin)
        bpy.context.active_object.scale = (1, 1, 0.6)
        # 眼球
        S(f"eye_ball_{sx}", eye_x, eye_y-0.01, eye_z, head_r*0.11, eye_white)
        # 虹膜
        S(f"eye_iris_{sx}", eye_x, eye_y-0.02, eye_z, head_r*0.06, eye_iris)
        # 瞳孔
        S(f"eye_pupil_{sx}", eye_x, eye_y-0.025, eye_z, head_r*0.025, eye_pupil)

    # ── 眉毛 ──
    for sx in (-1, 1):
        C(f"eyebrow_{sx}", sx*head_r*0.35, -head_r*0.62, head_cy+head_r*0.14, head_r*0.12, 0.01, 0.01,
          mkmat(f"{char_def['id']}_brow", *char_def['hair_color'], rough=0.5))

    # ── 鼻子 ──
    nose_y = -head_r*0.58; nose_z = head_cy
    # 鼻梁
    C("nose_bridge", 0, nose_y, nose_z+head_r*0.08, head_r*0.08, head_r*0.06, head_r*0.1, skin)
    # 鼻尖
    S("nose_tip", 0, nose_y, nose_z-head_r*0.02, head_r*0.07, skin)
    # 鼻翼
    for sx in (-1, 1):
        S(f"nose_wing_{sx}", sx*head_r*0.06, nose_y, nose_z-head_r*0.04, head_r*0.04, skin)

    # ── 嘴唇 ──
    mouth_y = -head_r*0.52; mouth_z = head_cy-head_r*0.25
    # 上唇
    C("upper_lip", 0, mouth_y, mouth_z+head_r*0.02, head_r*0.2, 0.01, head_r*0.02, lip_color)
    # 下唇
    C("lower_lip", 0, mouth_y-0.01, mouth_z-head_r*0.01, head_r*0.18, 0.012, head_r*0.025, lip_color)
    # 嘴角
    for sx in (-1, 1):
        S(f"mouth_corner_{sx}", sx*head_r*0.18, mouth_y, mouth_z, 0.008, skin)

    # ── 耳朵 ──
    for sx in (-1, 1):
        ear_x = sx*head_r*0.98; ear_z = head_cy+head_r*0.02
        # 耳廓
        Cy(f"ear_{sx}", ear_x, 0, ear_z, head_r*0.1, 0.02, skin)
        bpy.context.active_object.rotation_euler.x = math.pi/2
        # 耳垂
        S(f"earlobe_{sx}", ear_x, -head_r*0.02, ear_z-head_r*0.06, head_r*0.04, skin)

    # ── 头发基底 (贴合头皮的几何体) ──
    if char_def.get('hair') not in ('helmet', 'hood'):
        hair_len = {'short': 0.08, 'long': 0.18}.get(char_def.get('hair', 'short'), 0.08)
        hair_color = mkmat(f"{char_def['id']}_hair_geo", *char_def['hair_color'], rough=0.5)
        # 头顶覆盖
        S("hair_top", 0, 0.01, head_cy+head_r*0.7, head_r*0.55, hair_color)
        bpy.context.active_object.scale = (1, 1, 0.5)
        # 后脑勺头发
        S("hair_back", 0, 0.03, head_cy-head_r*0.1, head_r*0.45, hair_color)
        bpy.context.active_object.scale = (1, 0.7, 0.8)
        # 侧发
        for sx in (-1, 1):
            S(f"hair_side_{sx}", sx*head_r*0.7, 0.02, head_cy, head_r*0.2, hair_color)
            bpy.context.active_object.scale = (0.5, 1, 1)

    # ── 胡须 (特定角色) ──
    if char_def.get('extra') == 'beard':
        beard_color = mkmat(f"{char_def['id']}_beard", *char_def['hair_color'], rough=0.55)
        C("beard", 0, -head_r*0.46, head_cy-head_r*0.3, head_r*0.4, 0.01, head_r*0.2, beard_color)
        # 八字胡
        for sx in (-1, 1):
            Cy(f"moustache_{sx}", sx*head_r*0.1, mouth_y-0.01, mouth_z+head_r*0.04, 0.01, head_r*0.12, beard_color)
            bpy.context.active_object.rotation_euler.z = sx*0.3

    # ══════ 体型差异化缩放 ══════
    _apply_body_shape(char_def)

    # 肌肉缩放
    _apply_muscle(char_def, tr, lr)


def _apply_body_shape(char_def):
    """根据体型签名调整全身比例 — 肩宽/腰细/臀宽/颈粗/头身比"""
    shape = get_body_shape(char_def)
    tr, lr, body_w, shoulder_w, waist_narrow, hip_wide, neck_thick, head_ratio = shape
    h = char_def['height']

    for obj in bpy.context.scene.objects:
        n = obj.name.lower()
        # 肩宽 — 锁骨/肩关节/三角肌/上臂起点
        if any(k in n for k in ('shoulder','deltoid','clavicle')):
            obj.location.x *= shoulder_w
            obj.scale = tuple(s * shoulder_w for s in obj.scale)
        # 腰细
        if 'waist' in n and 'l_' not in n and 'r_' not in n:
            obj.scale.x *= waist_narrow
            obj.scale.y *= waist_narrow
        # 臀宽
        if 'pelvis' in n:
            obj.scale.y *= hip_wide
            if char_def['gender'] == 'female':
                obj.scale.y *= 1.15  # 女性额外臀宽
        # 颈粗
        if 'neck' in n:
            obj.scale.x *= neck_thick
            obj.scale.y *= neck_thick
        # 胸肌 (女性缩小)
        if 'pectoral' in n and char_def['gender'] == 'female':
            obj.scale = tuple(s * 0.75 for s in obj.scale)
        # 头身比
        if 'head' in n:
            factor = 6.5 / head_ratio
            obj.scale = tuple(s * factor for s in obj.scale)
        # 腹肌 (瘦子隐藏)
        if 'abs' in n and char_def.get('shape','').startswith('slender'):
            obj.scale = (0, 0, 0)  # 瘦子无腹肌
        # 血管 (瘦子隐藏)
        if 'vein' in n and char_def.get('shape','').startswith('slender'):
            obj.scale = (0, 0, 0)
        # 斜方肌 (魁梧型加粗)
        if 'torso' in n and char_def.get('shape') == 'heavy_male':
            obj.scale.x *= 1.15; obj.scale.y *= 1.10


def _apply_muscle(char_def, tr, lr):
    mf = {'lean':(1.00,0.95,0.90,0.92,0.85),'average':(1.10,1.05,1.00,1.00,0.95),
          'muscular':(1.30,1.20,1.15,1.10,1.00),'heavy':(1.40,1.35,1.25,1.20,1.15)}[char_def['build']]
    for obj in bpy.context.scene.objects:
        n = obj.name.lower()
        if 'chest' in n or 'torso' in n or 'ribcage' in n:
            obj.scale.x *= mf[0]; obj.scale.y *= mf[0]*0.85
        if 'pectoral' in n: obj.scale = tuple(s*mf[0]*0.9 for s in obj.scale)
        if 'shoulder' in n or 'deltoid' in n:
            obj.scale = tuple(s*mf[1] for s in obj.scale)
        if 'uparm' in n or 'forearm' in n or 'bicep' in n:
            obj.scale = tuple(s*mf[2] for s in obj.scale)
        if 'thigh' in n or 'quad' in n:
            obj.scale = tuple(s*mf[3] for s in obj.scale)
        if 'pelvis' in n: obj.scale.x *= mf[4]; obj.scale.y *= mf[4]
        if 'calf' in n: obj.scale = tuple(s*mf[3]*0.8 for s in obj.scale)
        if char_def['gender']=='female' and 'pelvis' in n: obj.scale.y *= 1.12
        if char_def['origin']=='Norse' and char_def['build'] in ('muscular','heavy') and 'shoulder' in n:
            obj.scale = tuple(s*1.12 for s in obj.scale)


# ====== 服装 ======
def add_clothing(char_def):
    c=char_def; h=c['height']; style=c.get('clothing','tunic')
    cc={'armor':mkmat(f"{c['id']}_armor",0.28,0.26,0.22,rough=0.52),
        'robe':mkmat(f"{c['id']}_robe",0.20,0.18,0.16,rough=0.75),
        'tunic':mkmat(f"{c['id']}_tunic",0.25,0.22,0.20,rough=0.70)}.get(style,mkmat(f"{c['id']}_cloth",0.25,0.22,0.20))
    if style=='armor':
        C("chestplate",0,-0.08,h*0.68,0.22,0.16,0.20,cc)
        for sx in(-1,1): S(f"pauldron_{sx}",sx*0.2,-0.04,h*0.80,0.10,cc)
        for sx in(-1,1): o=Cy(f"bracer_{sx}",sx*0.28,-0.02,h*0.58,0.06,0.10,cc); o.rotation_euler.x=math.pi/2
        o=Cy("belt",0,-0.06,h*0.50,0.20,0.04,mkmat(f"{c['id']}_belt",0.35,0.25,0.15)); o.rotation_euler.x=math.pi/2
    elif style=='robe':
        Cy("robe_body",0,-0.04,h*0.45,0.27,h*0.60,cc)
        if c.get('hair')=='hood': S("robe_hood",0,0.02,h*0.88,0.22,cc)
    elif style=='tunic':
        Cy("tunic_top",0,-0.03,h*0.58,0.24,h*0.25,cc)
        o=Cy("belt",0,-0.05,h*0.52,0.20,0.03,mkmat(f"{c['id']}_belt",0.35,0.25,0.15)); o.rotation_euler.x=math.pi/2
    if c.get('extra')=='cape':
        o=Cn("cape",0,-0.16,h*0.82,0.20,0.38,h*0.45,mkmat(f"{c['id']}_cape",0.12,0.06,0.04,rough=0.80)); o.rotation_euler.x=0.2
    if c.get('extra')=='crown':
        o=Cy("crown",0,0,h*0.97,0.14,0.03,mkmat(f"{c['id']}_crown",0.88,0.72,0.18,rough=0.28)); o.rotation_euler.x=math.pi/2


# ====== 武器 ======
def add_weapon(char_def):
    c=char_def; h=c['height']; wx,wy,wz=0.28,-0.04,h*0.49; w=c.get('weapon','sword')
    if w=='sword':
        C("blade",wx-0.01,wy+0.04,wz+0.45,0.05,0.08,0.50,mkmat(f"{c['id']}_blade",0.68,0.70,0.72,rough=0.12))
        Cy("hilt",wx,wy+0.04,wz+0.08,0.04,0.18,mkmat(f"{c['id']}_hilt",0.45,0.30,0.18,rough=0.55))
        o=Cy("guard",wx,wy+0.04,wz+0.18,0.08,0.04,mkmat(f"{c['id']}_guard",0.55,0.45,0.20,rough=0.40)); o.rotation_euler.x=math.pi/2
        S("pommel",wx,wy+0.04,wz,0.05,mkmat(f"{c['id']}_pom",0.60,0.50,0.15,rough=0.35))
        for _ in range(random.randint(4,8)):
            S("blade_nick",wx+random.uniform(-0.04,0.02),wy+0.06,wz+0.3+random.uniform(0,0.5),0.008+random.random()*0.012,mkmat("nick",0.5,0.5,0.5))
    elif w=='spear':
        Cy("shaft",wx,wy+0.06,wz+0.80,0.025,2.20,mkmat(f"{c['id']}_shaft",0.38,0.28,0.18,rough=0.65))
        Cn("spearhead",wx,wy+0.06,wz+1.90,0.04,0.005,0.35,mkmat(f"{c['id']}_spear",0.65,0.67,0.70,rough=0.10))
    elif w=='axe':
        Cy("axe_shaft",wx,wy+0.04,wz+0.30,0.03,0.90,mkmat(f"{c['id']}_axe_handle",0.33,0.24,0.13,rough=0.68))
        C("axe_head",wx-0.01,wy+0.04,wz+0.78,0.22,0.04,0.18,mkmat(f"{c['id']}_axe_head",0.58,0.60,0.63,rough=0.12))
        for _ in range(6):
            S("axe_chip",wx+random.uniform(-0.08,0.06),wy+0.06,wz+0.72+random.uniform(0,0.12),0.008+random.random()*0.01,mkmat("chip",0.4,0.4,0.4))
    elif w=='staff':
        Cy("staff_shaft",wx-0.02,wy+0.04,wz+0.35,0.03,1.40,mkmat(f"{c['id']}_staff",0.33,0.26,0.16,rough=0.62))
        S("staff_orb",wx-0.02,wy+0.04,wz+1.05,0.09,mkmat(f"{c['id']}_orb",0.45,0.18,0.65,rough=0.06))
        for _ in range(4):
            t=random.uniform(0.35,1.0)
            Cy("vine",wx-0.02+math.sin(t*8)*0.04,wy+0.04+math.cos(t*8)*0.04,wz+t*1.0,0.01,0.15,mkmat("vine",0.08,0.18,0.06,rough=0.70))
    elif w=='bow':
        o=Cy("bow_arc",wx-0.04,wy-0.10,h*0.82,0.015,1.05,mkmat(f"{c['id']}_bow",0.35,0.28,0.17,rough=0.60)); o.rotation_euler.x=0.6
        o=Cy("bow_string",wx-0.04,wy-0.12,h*0.82,0.005,0.95,mkmat(f"{c['id']}_string",0.85,0.82,0.78,rough=0.30)); o.rotation_euler.x=0.6
        Cy("quiver",wx+0.15,wy-0.06,h*0.75,0.07,0.55,mkmat(f"{c['id']}_quiver",0.28,0.18,0.10,rough=0.72))


# ====== 粒子发丝 ======
def add_hair(char_def):
    if char_def.get('hair') in ('helmet',): return
    head_obj = None
    for obj in bpy.context.scene.objects:
        if 'head' in obj.name.lower(): head_obj = obj; break
    if not head_obj: return
    bpy.context.view_layer.objects.active = head_obj
    hc = char_def['hair_color']; style = char_def.get('hair','short')
    cnt = {'short':300,'long':600,'hood':0}.get(style,200)
    length = {'short':0.12,'long':0.40,'hood':0}.get(style,0.10)
    if cnt == 0: return
    # 顶点组
    vg = head_obj.vertex_groups.new(name="Scalp")
    sel = [v.index for v in head_obj.data.vertices if v.co.z > 0.10]
    if sel: vg.add(sel, 1.0, 'REPLACE')
    # 粒子系统
    head_obj.modifiers.new(name="Hair", type='PARTICLE_SYSTEM')
    ps = head_obj.particle_systems[0].settings
    try: ps.type = 'HAIR'
    except: pass
    ps.count = cnt
    try: ps.hair_length = length
    except: pass
    try: ps.hair_step = 3
    except: pass
    # vertex_group_density 在 Blender 5.x 中已改名/移除，用安全方式设置
    for attr in ('vertex_group_density', 'vertex_group_length', 'vertex_group'):
        try: setattr(ps, attr, "Scalp"); break
        except: pass
    try: ps.use_hair_bspline = True
    except: pass
    try:
        hm = mkmat(f"{char_def['id']}_hair_particle", *hc, rough=0.45)
        head_obj.data.materials.append(hm)
        ps.material = len(head_obj.data.materials) - 1
    except: pass


# ====== 细分 ======
def add_skin_details(char_def):
    """皮肤纹理 + 指甲 + 肚脐 + 关节皱纹 + 血管"""
    skin = mkmat(f"{char_def['id']}_skin", *char_def['skin'], rough=0.62)
    nail_mat = mkmat(f"{char_def['id']}_nail",
        min(1,char_def['skin'][0]*0.85), min(1,char_def['skin'][1]*0.75), min(1,char_def['skin'][2]*0.65), rough=0.3)

    # ── 指甲 (手指+脚趾) ──
    for side, sx in [('l',-1),('r',1)]:
        for fi, fx in enumerate([-0.035,-0.015,0,0.015,0.035]):
            Cy(f"{side}_nail{fi}", sx*0.22+fx, -0.12, 0.475, 0.01, 0.015, nail_mat)
        # 脚趾甲
        for ti, tx in enumerate([-0.04,-0.02,0,0.02,0.04]):
            Cy(f"{side}_toenail{ti}", sx*0.11+tx, 0.05, 0.038, 0.008, 0.012, nail_mat)

    # ── 肚脐 ──
    S("navel", 0, -0.16, 0.55, 0.02, skin)
    # 肚脐凹陷用小圆环
    Cy("navel_rim", 0, -0.16, 0.55, 0.022, 0.005, skin)
    bpy.context.active_object.rotation_euler.x = math.pi/2

    # ── 关节皱纹 ──
    wrinkle_mat = mkmat(f"{char_def['id']}_wrinkle",
        char_def['skin'][0]*0.7, char_def['skin'][1]*0.6, char_def['skin'][2]*0.5, rough=0.75)
    # 肘关节
    for side, sx in [('l',-1),('r',1)]:
        for j in range(3):
            Cy(f"{side}_elbow_wrinkle{j}", sx*0.22, -0.07+0.01*j, 0.63+0.01*j, 0.05, 0.005, wrinkle_mat)
            bpy.context.active_object.rotation_euler.x = math.pi/2
    # 膝关节
    for side, sx in [('l',-1),('r',1)]:
        for j in range(3):
            Cy(f"{side}_knee_wrinkle{j}", sx*0.10, -0.07+0.01*j, 0.33+0.01*j, 0.06, 0.005, wrinkle_mat)
            bpy.context.active_object.rotation_euler.x = math.pi/2
    # 指关节
    for side, sx in [('l',-1),('r',1)]:
        for fi in range(5):
            for seg in range(2):
                Cy(f"{side}_knuckle{fi}_{seg}", sx*0.24-0.04+fi*0.02, -0.1, 0.46+seg*0.022, 0.012, 0.003, wrinkle_mat)

    # ── 血管 (muscular/heavy) ──
    if char_def['build'] in ('muscular', 'heavy'):
        vein_mat = mkmat(f"{char_def['id']}_vein", 0.15, 0.22, 0.28, rough=0.45)
        for side, sx in [('l',-1),('r',1)]:
            # 前臂血管
            for v in range(3):
                Cy(f"{side}_vein_arm{v}", sx*0.22+random.uniform(-0.02,0.02), -0.08, 0.56+random.uniform(0,0.06), 0.004, random.uniform(0.04,0.08), vein_mat)
                bpy.context.active_object.rotation_euler.x = random.uniform(-0.1,0.1)
            # 手背血管
            Cy(f"{side}_vein_hand", sx*0.24, -0.08, 0.46, 0.003, 0.05, vein_mat)


def add_subdiv():
    """细分 + 皮肤位移纹理"""
    for obj in bpy.context.scene.objects:
        name = obj.name.lower()
        # 身体 — 2级细分
        if any(k in name for k in ('head','chest','torso','arm','leg','thigh','shin','hand',
                                     'shoulder','forearm','pelvis','jaw','chin','nose','ear',
                                     'foot','ankle','calf','knee','quad','bicep','deltoid',
                                     'pectoral','ribcage','waist','neck','wrist','palm')):
            bpy.context.view_layer.objects.active = obj
            try:
                op(lambda: bpy.ops.object.modifier_add(type='SUBSURF'))
                obj.modifiers[-1].levels = 2
            except: pass
        # 服装 — 1级细分
        if any(k in name for k in ('robe','tunic','cape','armor','chestplate','cloth')):
            bpy.context.view_layer.objects.active = obj
            try:
                op(lambda: bpy.ops.object.modifier_add(type='SUBSURF'))
                obj.modifiers[-1].levels = 1
            except: pass

    # ── 皮肤位移纹理 (给头部和躯干) ──
    for obj in bpy.context.scene.objects:
        name = obj.name.lower()
        if name in ('head','chest','torso','jaw'):
            bpy.context.view_layer.objects.active = obj
            try:
                op(lambda: bpy.ops.object.modifier_add(type='DISPLACE'))
                disp = obj.modifiers[-1]
                disp.strength = 0.002  # 微细毛孔级位移
                disp.mid_level = 0.5
                try:
                    tex = bpy.data.textures.new(name=f"{obj.name}_skin_tex", type='CLOUDS')
                    tex.noise_scale = 0.5
                    tex.noise_depth = 2
                    disp.texture = tex
                except:
                    try: tex = bpy.data.textures.new(name=f"{obj.name}_skin_tex", type='NOISE')
                    except: pass
            except: pass


# ====== 完整生成 ======
OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "werewolf_models"
)
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate(char_def):
    c = char_def
    print(f"\n  🎭 {c['id']} — {c['name']} | {c['height']}m | {c['build']} | {c['origin']}")
    clear()
    make_body(c);                    print("     ↳ 身体(120+部件)")
    add_skin_details(c);             print("     ↳ 皮肤(指甲/皱纹/血管/肚脐)")
    add_clothing(c);                 print("     ↳ 服装")
    add_weapon(c);                   print("     ↳ 武器")
    add_hair(c);                     print("     ↳ 发丝")
    add_subdiv();                    print("     ↳ 细分+皮肤纹理")
    select_all()
    path = os.path.join(OUTPUT_DIR, f"character_{c['id']}.glb")
    export_glb(path)
    print(f"  ✅ {c['name']} 完成")
