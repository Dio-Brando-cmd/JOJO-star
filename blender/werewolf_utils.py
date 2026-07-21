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

# ====== 身体 ======
def make_body(char_def):
    h = char_def['height']; build = char_def['build']; gender = char_def['gender']
    bm = {'lean':(0.14,0.09,0.78),'average':(0.17,0.11,0.90),
          'muscular':(0.21,0.14,1.05),'heavy':(0.26,0.17,1.12)}[build]
    tr, lr, body_w = bm
    if gender == 'female': tr *= 0.90; lr *= 0.88

    skin = mkmat(f"{char_def['id']}_skin", *char_def['skin'], rough=0.62)

    # 脚 / 小腿 / 大腿
    C("l_foot",-0.11,0.02,h*0.03,lr*0.65,lr*1.8,h*0.04,skin)
    C("r_foot",0.11,0.02,h*0.03,lr*0.65,lr*1.8,h*0.04,skin)
    Cy("l_shin",-0.10,-0.02,h*0.20,lr*0.9,h*0.22,skin)
    Cy("r_shin",0.10,-0.02,h*0.20,lr*0.9,h*0.22,skin)
    Cy("l_thigh",-0.11,-0.03,h*0.38,lr*1.1,h*0.22,skin)
    Cy("r_thigh",0.11,-0.03,h*0.38,lr*1.1,h*0.22,skin)

    # 骨盆 / 腰 / 躯干 / 胸
    p=S("pelvis",0,0,h*0.48,tr*1.3,skin)
    p.scale=(1.3,1.0 if gender=='female' else 0.75,0.9)
    Cy("waist",0,0,h*0.55,tr*0.8,h*0.08,skin)
    C("torso",0,-0.01,h*0.66,tr*body_w,tr*0.7,h*0.22,skin)
    C("chest",0,-0.01,h*0.74,tr*body_w*(0.95 if gender=='female' else 0.9),tr*0.68,h*0.06,skin)

    # 手臂
    sl=h*0.80
    for side, sx in [('l',-1),('r',1)]:
        S(f"{side}_shoulder",sx*tr*1.3,-0.02,sl,lr*1.15,skin)
        Cy(f"{side}_uparm",sx*tr*1.6,-0.02,h*0.72,lr,h*0.16,skin)
        Cy(f"{side}_elbow",sx*tr*1.75,-0.02,h*0.63,lr*0.7,h*0.04,skin)
        Cy(f"{side}_forearm",sx*tr*1.8,-0.02,h*0.57,lr*0.85,h*0.18,skin)
        S(f"{side}_hand",sx*tr*1.9,-0.02,h*0.47,lr*0.65,skin)

    # 颈 + 头
    Cy("neck",0,0,h*0.84,tr*0.32,h*0.06,skin)
    Ic("head",0,0,h*0.91,tr*0.66,3,skin)
    C("nose",0,tr*0.55,h*0.92,0.03,0.02,0.04,skin)
    S("l_ear",-tr*0.58,0,h*0.91,0.04,skin); S("r_ear",tr*0.58,0,h*0.91,0.04,skin)

    # 肌肉
    _apply_muscle(char_def, tr, lr)


def _apply_muscle(char_def, tr, lr):
    mf = {'lean':(1.00,0.95,0.90,0.92,0.85),'average':(1.10,1.05,1.00,1.00,0.95),
          'muscular':(1.30,1.20,1.15,1.10,1.00),'heavy':(1.40,1.35,1.25,1.20,1.15)}[char_def['build']]
    for obj in bpy.context.scene.objects:
        n = obj.name.lower()
        if 'chest' in n or 'torso' in n: obj.scale.x *= mf[0]; obj.scale.y *= mf[0]*0.85
        if 'shoulder' in n: obj.scale = tuple(s*mf[1] for s in obj.scale)
        if 'uparm' in n or 'forearm' in n: obj.scale = tuple(s*mf[2] for s in obj.scale)
        if 'thigh' in n: obj.scale = tuple(s*mf[3] for s in obj.scale)
        if 'pelvis' in n: obj.scale.x *= mf[4]; obj.scale.y *= mf[4]
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
    ps.type = 'HAIR'; ps.count = cnt; ps.hair_length = length
    ps.hair_step = 3; ps.vertex_group_density = "Scalp"
    ps.use_hair_bspline = True
    hm = mkmat(f"{char_def['id']}_hair_particle", *hc, rough=0.45)
    head_obj.data.materials.append(hm)
    ps.material = len(head_obj.data.materials) - 1


# ====== 细分 ======
def add_subdiv():
    for obj in bpy.context.scene.objects:
        name = obj.name.lower()
        if any(k in name for k in ('head','chest','torso','arm','leg','thigh','shin','hand','shoulder','forearm','pelvis')):
            bpy.context.view_layer.objects.active = obj
            try:
                op(lambda: bpy.ops.object.modifier_add(type='SUBSURF'))
                obj.modifiers[-1].levels = 2
            except: pass
        if any(k in name for k in ('robe','tunic','cape','armor','chestplate','cloth')):
            bpy.context.view_layer.objects.active = obj
            try:
                op(lambda: bpy.ops.object.modifier_add(type='SUBSURF'))
                obj.modifiers[-1].levels = 1
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
    make_body(c);                    print("     ↳ 身体")
    add_clothing(c);                 print("     ↳ 服装")
    add_weapon(c);                   print("     ↳ 武器")
    add_hair(c);                     print("     ↳ 发丝")
    add_subdiv();                    print("     ↳ 细分")
    select_all()
    path = os.path.join(OUTPUT_DIR, f"character_{c['id']}.glb")
    export_glb(path)
    print(f"  ✅ {c['name']} 完成")
