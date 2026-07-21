"""
============================================================
 狼人杀 Blender 共享库 v4 — 8头身人体比例精雕
 兼容 Blender 4.0 ~ 5.x LTS
============================================================
"""
import bpy, math, random, os

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
    op(lambda: bpy.ops.mesh.primitive_ico_sphere_add(radius=r,subdivisions=subdiv,location=(x,y,z)))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o

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
        kw=dict(filepath=path,use_selection=True)
        for k in ('export_format','export_format_option'):
            try: bpy.ops.export_scene.gltf(**kw,**{k:'GLB'}); return
            except: pass
        try: bpy.ops.export_scene.gltf(**kw)
        except Exception as e: print(f"     export: {e}")
    op(_do)
    print(f"     📦 → {os.path.basename(path)}")

# ====== 体型系统 ======
# 体型签名: (躯干半径, 四肢半径, 体宽, 肩宽因子, 腰窄因子, 臀宽因子, 颈粗因子, 头身比)
BODY_SHAPES = {
    'slender_female':  (0.12,0.07,0.72,0.82,0.78,1.18,0.72,7.5),
    'slender_male':    (0.13,0.08,0.75,0.88,0.82,0.90,0.78,7.3),
    'petite_female':   (0.11,0.065,0.68,0.78,0.75,1.12,0.70,7.8),
    'athletic_female': (0.15,0.10,0.85,1.02,0.88,1.00,0.88,7.2),
    'muscular_male':   (0.20,0.14,1.05,1.20,0.95,0.88,1.05,6.8),
    'compact_male':    (0.19,0.13,1.02,1.15,0.92,0.90,1.00,6.9),
    'heavy_male':      (0.25,0.17,1.12,1.35,1.00,0.90,1.20,6.5),
}

# ====== 身体 ======
def make_body(c):
    h=c['height']; g=c['gender']
    tr,lr,bw,sw,wn,hw,nt,hr=BODY_SHAPES.get(c.get('shape','slender_male'),BODY_SHAPES['slender_male'])
    hu=h/8.0  # 1头身单位 — 所有比例基准

    skin=mkmat(f"{c['id']}_skin",*c['skin'],rough=0.62)
    lip=mkmat(f"{c['id']}_lip",min(1,c['skin'][0]*0.7),min(1,c['skin'][1]*0.3),min(1,c['skin'][2]*0.25),rough=0.35)
    ew=mkmat(f"{c['id']}_eyeW",0.92,0.90,0.88,rough=0.08)
    ei=mkmat(f"{c['id']}_eyeI",*[x*0.4 for x in c['hair_color']],rough=0.05)
    ep=mkmat(f"{c['id']}_eyeP",0.02,0.02,0.02,rough=0.02)

    # 体型参数
    sw_abs=hu*2.0*sw; hw_abs=hu*(1.55 if g=='female' else 1.45)*hw
    cw_abs=hu*1.4*bw; ww_abs=hu*1.1*wn
    nw_abs=hu*0.32*nt
    at=hu*0.35*lr*8; ft=hu*0.28*lr*8; tt=hu*0.52*lr*8; ct=hu*0.38*lr*8

    # ══ 下肢 (0→0.5hu踝→2hu膝→4hu骨盆) ══
    for side,sx in [('l',-1),('r',1)]:
        # 脚跟
        S(f"{side}_heel",sx*hw_abs*0.2,-hu*0.08,hu*0.08,hu*0.06,skin)
        # 足弓
        C(f"{side}_arch",sx*hw_abs*0.2,0.02,hu*0.14,hu*0.1,hu*0.25,hu*0.06,skin)
        # 前脚掌
        C(f"{side}_ball",sx*hw_abs*0.2,0.06,hu*0.20,hu*0.12,hu*0.22,hu*0.04,skin)
        # 5根脚趾 (渐小: 大趾→小趾)
        toe_sizes=[(0.04,0.028),(0.03,0.024),(0.025,0.020),(0.02,0.016),(0.015,0.012)]
        for ti,(tl,tw) in enumerate(toe_sizes):
            tx_offset=-0.04+ti*0.02
            Cy(f"{side}_toe{ti}",sx*hw_abs*0.2+tx_offset,hu*0.35,hu*0.24,tw*0.5,tl,skin)
        S(f"{side}_ankle",sx*hw_abs*0.2,0,hu*0.5,hu*0.08,skin)
        Cy(f"{side}_shin",sx*hw_abs*0.2,-0.02,hu*1.25,ct*0.5,hu*1.8,skin)
        S(f"{side}_calf",sx*hw_abs*0.2,-0.04,hu*1.3,ct*0.45,skin)
        S(f"{side}_knee",sx*hw_abs*0.2,0,hu*2.0,hu*0.1,skin)
        Cy(f"{side}_thigh",sx*hw_abs*0.22,-0.04,hu*3.0,tt*0.5,hu*2.0,skin)
        S(f"{side}_quad",sx*hw_abs*0.22,-0.06,hu*3.0,tt*0.4,skin)

    # ══ 骨盆+躯干 (4hu→6.5hu肩) ══
    p=S("pelvis",0,0,hu*4.0,hw_abs*0.55,skin)
    p.scale=(1.2,0.72,0.8)
    S("glutes",0,-hw_abs*0.2,hu*3.9,hw_abs*0.35,skin)
    bpy.context.active_object.scale=(1,0.6,0.7)

    # 腹肌
    if c.get('shape','').startswith(('muscular','heavy','compact')):
        for row in range(3):
            for col in range(2):
                C(f"abs_{row}{col}",(col-0.5)*hu*0.25,-hw_abs*0.15,hu*(4.3+row*0.12),hu*0.09,hu*0.04,hu*0.1,skin)

    Cy("waist",0,-0.01,hu*4.5,ww_abs*0.5,hu*0.15,skin)
    C("ribcage",0,-0.02,hu*5.3,cw_abs*0.48,cw_abs*0.35,hu*0.8,skin)
    for i in range(4):
        for sx in(-1,1):
            Cy(f"rib_{sx}{i}",sx*cw_abs*0.45,-0.02,hu*(4.8+i*0.18),0.01,cw_abs*0.35,skin)
            bpy.context.active_object.rotation_euler.z=sx*0.4
    C("chest",0,-0.03,hu*5.9,cw_abs*0.45,cw_abs*0.35,hu*0.35,skin)
    for sx in(-1,1):
        S(f"pectoral_{sx}",sx*hu*0.2,-cw_abs*0.2,hu*5.9,hu*0.15,skin)
        Cy(f"clavicle_{sx}",sx*hu*0.35,-hu*0.1,hu*6.35,0.01,hu*0.5,skin)
        bpy.context.active_object.rotation_euler.z=sx*0.2

    # ══ 上肢 (肩6.5hu→肘5.2→腕4.0→指尖3.5) ══
    for side,sx in [('l',-1),('r',1)]:
        S(f"{side}_shoulder",sx*sw_abs*0.48,-0.02,hu*6.5,hu*0.18,skin)
        S(f"{side}_deltoid",sx*sw_abs*0.52,-0.04,hu*6.3,hu*0.15,skin)
        Cy(f"{side}_uparm",sx*sw_abs*0.55,-0.03,hu*5.85,at*0.5,hu*1.6,skin)
        S(f"{side}_bicep",sx*sw_abs*0.56,-0.05,hu*5.9,at*0.35,skin)
        S(f"{side}_elbow",sx*sw_abs*0.57,-0.01,hu*5.2,hu*0.1,skin)
        Cy(f"{side}_forearm",sx*sw_abs*0.58,-0.03,hu*4.6,ft*0.5,hu*1.4,skin)
        S(f"{side}_wrist",sx*sw_abs*0.59,-0.02,hu*4.0,hu*0.07,skin)
        # 手掌 — 梯形(掌根窄掌前宽)
        C(f"{side}_palm",sx*sw_abs*0.6,-0.03,hu*3.85,hu*0.07,hu*0.06,hu*0.06,skin)
        C(f"{side}_palm_front",sx*sw_abs*0.6,-0.03,hu*3.90,hu*0.09,hu*0.05,hu*0.03,skin)
        # 五指 — 3节指骨 食指最长
        finger_lens=[(0.06,0.05,0.04),(0.07,0.055,0.045),(0.065,0.05,0.04),(0.06,0.045,0.035),(0.04,0.03,0.02)]
        finger_xs=[-0.035,-0.018,0,0.018,0.035]
        for fi,(fx,(l1,l2,l3)) in enumerate(zip(finger_xs,finger_lens)):
            fbx,fby,fbz=sx*sw_abs*0.6+fx,-hu*0.03,hu*3.92
            # 近节
            Cy(f"{side}_f{fi}_p",fbx,fby,fbz+l1/2,hu*0.014,l1,skin)
            # 中节
            Cy(f"{side}_f{fi}_m",fbx,fby-0.004,fbz+l1+l2/2,hu*0.011,l2,skin)
            # 远节
            Cy(f"{side}_f{fi}_d",fbx,fby-0.006,fbz+l1+l2+l3/2,hu*0.008,l3,skin)
            # 指关节凸起
            for jz in (fbz+l1-0.005,fbz+l1+l2-0.005):
                S(f"{side}_kn{fi}_{jz:.2f}",fbx,fby-0.008,jz,hu*0.012,skin)
        # 拇指 — 2节，从掌侧伸出
        C(f"{side}_thumb_palm",sx*sw_abs*0.56,-hu*0.06,hu*3.86,hu*0.03,hu*0.03,hu*0.025,skin)
        Cy(f"{side}_thumb_p",sx*sw_abs*0.54,-hu*0.07,hu*3.88+0.025,hu*0.013,0.04,skin)
        bpy.context.active_object.rotation_euler.x=-sx*0.3
        Cy(f"{side}_thumb_d",sx*sw_abs*0.53,-hu*0.08,hu*3.88+0.06,hu*0.01,0.035,skin)
        bpy.context.active_object.rotation_euler.x=-sx*0.3

    # ══ 颈部 (6.8hu→7.15hu) ══
    Cy("neck",0,-0.02,hu*7.0,nw_abs*0.5,hu*0.4,skin)
    if g=='male':
        S("adams_apple",0,-nw_abs*0.4,hu*7.0,hu*0.025,skin)

    # ══ 头部 (7.15hu→8hu) ══
    head_r=h/hr/2; head_cy=hu*7.55
    Ic("head",0,0,head_cy,head_r,3,skin)
    C("jaw",0,-head_r*0.05,head_cy-head_r*0.35,head_r*0.65,head_r*0.4,head_r*0.3,skin)
    S("chin",0,-head_r*0.3,head_cy-head_r*0.55,head_r*0.14,skin)

    # ══ 眼睛 ══
    for sx in(-1,1):
        ex=sx*head_r*0.35; ey=-head_r*0.6; ez=head_cy+head_r*0.15
        # 眼窝
        S(f"eye_s_{sx}",ex,ey,ez,head_r*0.13,skin); bpy.context.active_object.scale=(1,1,0.5)
        # 眼球 (白)
        S(f"eye_b_{sx}",ex,ey-0.008,ez,head_r*0.1,ew)
        # 虹膜
        S(f"eye_i_{sx}",ex,ey-0.018,ez+0.005,head_r*0.05,ei)
        # 瞳孔
        S(f"eye_p_{sx}",ex,ey-0.022,ez+0.007,head_r*0.018,ep)
        # 上眼睑 (覆盖眼球上缘)
        Cy(f"eye_lid_u{sx}",ex,ey-0.005,ez+head_r*0.04,head_r*0.1,0.005,skin)
        bpy.context.active_object.rotation_euler.x=math.pi/2.2
        # 下眼睑
        Cy(f"eye_lid_l{sx}",ex,ey-0.005,ez-head_r*0.04,head_r*0.1,0.004,skin)
        bpy.context.active_object.rotation_euler.x=-math.pi/2.2
        # 泪腺 (内眼角)
        S(f"tear_{sx}",ex+sx*head_r*0.08,ey-0.005,ez,head_r*0.015,skin)
        # 眉毛
        C(f"brow_{sx}",sx*head_r*0.35,-head_r*0.54,head_cy+head_r*0.28,head_r*0.11,0.006,0.007,
          mkmat(f"{c['id']}_brow",*c['hair_color'],rough=0.5))

    # ══ 鼻子 ══
    ny=-head_r*0.48; nz=head_cy-head_r*0.08
    # 鼻根 (眉心)
    S("nose_root",0,-head_r*0.55,head_cy+head_r*0.2,head_r*0.04,skin)
    # 鼻梁
    C("nose_br",0,ny,nz+head_r*0.12,head_r*0.055,head_r*0.045,head_r*0.13,skin)
    # 鼻软骨 (鼻梁下半)
    C("nose_cart",0,ny,nz+head_r*0.02,head_r*0.065,head_r*0.05,head_r*0.06,skin)
    # 鼻尖
    S("nose_tip",0,ny,nz-head_r*0.06,head_r*0.07,skin)
    # 鼻翼 (左右)
    for sx in(-1,1): S(f"nose_w{sx}",sx*head_r*0.055,ny,nz-head_r*0.08,head_r*0.04,skin)
    # 鼻孔
    for sx in(-1,1): S(f"nostril{sx}",sx*head_r*0.03,ny+0.005,nz-head_r*0.1,head_r*0.015,lip)

    # ══ 嘴 ══
    my=-head_r*0.43; mz=head_cy-head_r*0.38
    # 人中
    C("philtrum",0,my-0.02,mz+head_r*0.06,head_r*0.03,0.005,head_r*0.04,skin)
    # 上唇
    C("upper_lip",0,my,mz+head_r*0.03,head_r*0.2,0.008,head_r*0.02,lip)
    # 下唇
    C("lower_lip",0,my-0.006,mz-head_r*0.03,head_r*0.18,0.01,head_r*0.028,lip)
    # 唇沟 (上下唇之间)
    Cy("lip_line",0,my,mz,head_r*0.18,0.003,skin); bpy.context.active_object.rotation_euler.x=math.pi/2
    # 嘴角
    for sx in(-1,1): S(f"mouth_c{sx}",sx*head_r*0.18,my,mz,0.006,skin)
    # 颧骨
    for sx in(-1,1): S(f"cheek_{sx}",sx*head_r*0.5,-head_r*0.4,head_cy+head_r*0.05,head_r*0.08,skin)
    bpy.context.active_object.scale=(1,0.4,0.6)

    # ══ 耳朵 ══
    for sx in(-1,1):
        ex=sx*head_r*0.95; ez=head_cy+head_r*0.02
        # 耳轮 (外缘)
        Cy(f"ear_helix_{sx}",ex,0.005,ez,head_r*0.09,0.012,skin); bpy.context.active_object.rotation_euler.x=math.pi/2
        # 对耳轮 (内缘)
        Cy(f"ear_anti_{sx}",ex*0.92,0.002,ez,head_r*0.06,0.01,skin); bpy.context.active_object.rotation_euler.x=math.pi/2
        # 耳垂
        S(f"earlobe_{sx}",ex,-head_r*0.02,ez-head_r*0.09,head_r*0.04,skin)
        # 耳屏
        S(f"tragus_{sx}",ex*0.8,-head_r*0.01,ez,head_r*0.015,skin)

    # ══ 头发 ══
    if c.get('hair') not in ('helmet','hood'):
        hc=mkmat(f"{c['id']}_hair_geo",*c['hair_color'],rough=0.5)
        is_long=c.get('hair')=='long'
        # 前发 (刘海)
        C("hair_bangs",0,-head_r*0.45,head_cy+head_r*0.3,head_r*0.45,0.008,head_r*0.12,hc)
        # 顶发
        S("hair_top",0,0.01,head_cy+head_r*0.55,head_r*0.5,hc); bpy.context.active_object.scale=(1,1,0.4)
        # 后发
        S("hair_back",0,0.04,head_cy-head_r*0.2,head_r*0.45,hc); bpy.context.active_object.scale=(1,0.6,0.7)
        # 侧发 ×2层
        for sx in(-1,1):
            S(f"hair_s1_{sx}",sx*head_r*0.6,0.02,head_cy+head_r*0.1,head_r*0.2,hc); bpy.context.active_object.scale=(0.4,1,0.8)
            S(f"hair_s2_{sx}",sx*head_r*0.55,0.01,head_cy-head_r*0.1,head_r*0.16,hc); bpy.context.active_object.scale=(0.4,0.8,0.8)
        # 长发拖尾
        if is_long:
            Cy("hair_tail",0,0.06,head_cy-head_r*0.6,head_r*0.3,head_r*0.8,hc)
            bpy.context.active_object.rotation_euler.x=-0.15
        # 发旋
        Cy("hair_whorl",0,0,head_cy+head_r*0.75,head_r*0.1,0.01,hc)

    # ══ 睫毛 ══
    lash_color=mkmat(f"{c['id']}_lash",0.04,0.03,0.02,rough=0.5)
    for sx in(-1,1):
        ex=sx*head_r*0.35; ez=head_cy+head_r*0.15
        for li in range(5):
            lx=ex+sx*random.uniform(-0.04,0.04)
            lz=ez+head_r*0.04+random.uniform(0,0.02)
            Cy(f"lash_{sx}_{li}",lx,-head_r*0.57,lz,0.003,head_r*0.03,lash_color)
            bpy.context.active_object.rotation_euler.x=0.3

    # ══ 胡须 ══
    if c.get('extra')=='beard':
        bc=mkmat(f"{c['id']}_beard",*c['hair_color'],rough=0.55)
        # 下颌须
        C("beard_jaw",0,-head_r*0.38,head_cy-head_r*0.45,head_r*0.35,0.006,head_r*0.22,bc)
        # 下唇须
        C("beard_soul",0,-head_r*0.42,head_cy-head_r*0.32,head_r*0.08,0.004,head_r*0.06,bc)
        # 八字胡 (左右+中间)
        for sx in(-1,1):
            Cy(f"moustache_{sx}",sx*head_r*0.1,-head_r*0.44,head_cy-head_r*0.30,0.006,head_r*0.13,bc)
            bpy.context.active_object.rotation_euler.z=sx*0.25
        # 络腮胡
        for sx in(-1,1):
            Cy(f"sideburn_{sx}",sx*head_r*0.55,0,head_cy-head_r*0.15,head_r*0.04,head_r*0.2,bc)
            bpy.context.active_object.rotation_euler.z=sx*0.15

    # ══ 体型差异化缩放 ══
    _apply_body_shape(c,hu,sw_abs,hw_abs,cw_abs,ww_abs,nw_abs)


def _apply_body_shape(c,hu,sw_abs,hw_abs,cw_abs,ww_abs,nw_abs):
    """根据体型签名二次调整"""
    shape=c.get('shape','')
    for obj in bpy.context.scene.objects:
        n=obj.name.lower()
        # 女性臀宽
        if c['gender']=='female' and 'pelvis' in n: obj.scale.y*=1.15
        # 瘦子无腹肌无血管
        if shape.startswith(('slender','petite')) and ('abs' in n or 'vein' in n): obj.scale=(0,0,0)
        # 女性缩小胸肌
        if c['gender']=='female' and 'pectoral' in n: obj.scale=tuple(s*0.65 for s in obj.scale)
        # 魁梧加粗斜方肌
        if shape=='heavy_male' and 'torso' in n: obj.scale.x*=1.15; obj.scale.y*=1.10
        # 北欧战士宽肩
        if c['origin']=='Norse' and shape.startswith(('muscular','heavy')) and 'shoulder' in n:
            obj.scale=tuple(s*1.12 for s in obj.scale)

# ====== 服装 ======
def add_clothing(c):
    h=c['height']; s=c.get('clothing','tunic')
    cc={'armor':mkmat(f"{c['id']}_armor",0.28,0.26,0.22,rough=0.52),
        'robe':mkmat(f"{c['id']}_robe",0.20,0.18,0.16,rough=0.75),
        'tunic':mkmat(f"{c['id']}_tunic",0.25,0.22,0.20,rough=0.70)}.get(s,mkmat(f"{c['id']}_cloth",0.25,0.22,0.20))
    if s=='armor':
        C("chestplate",0,-0.08,h*0.68,0.22,0.16,0.20,cc)
        for sx in(-1,1): S(f"pauldron_{sx}",sx*0.2,-0.04,h*0.80,0.10,cc)
        for sx in(-1,1): o=Cy(f"bracer_{sx}",sx*0.28,-0.02,h*0.58,0.06,0.10,cc); o.rotation_euler.x=math.pi/2
        o=Cy("belt",0,-0.06,h*0.50,0.20,0.04,mkmat(f"{c['id']}_belt",0.35,0.25,0.15)); o.rotation_euler.x=math.pi/2
    elif s=='robe':
        Cy("robe_body",0,-0.04,h*0.45,0.27,h*0.60,cc)
        if c.get('hair')=='hood': S("robe_hood",0,0.02,h*0.88,0.22,cc)
    elif s=='tunic':
        Cy("tunic_top",0,-0.03,h*0.58,0.24,h*0.25,cc)
        o=Cy("belt",0,-0.05,h*0.52,0.20,0.03,mkmat(f"{c['id']}_belt",0.35,0.25,0.15)); o.rotation_euler.x=math.pi/2
    if c.get('extra')=='cape':
        o=Cn("cape",0,-0.16,h*0.82,0.20,0.38,h*0.45,mkmat(f"{c['id']}_cape",0.12,0.06,0.04,rough=0.80)); o.rotation_euler.x=0.2
    if c.get('extra')=='crown':
        o=Cy("crown",0,0,h*0.97,0.14,0.03,mkmat(f"{c['id']}_crown",0.88,0.72,0.18,rough=0.28)); o.rotation_euler.x=math.pi/2

# ====== 武器 ======
def add_weapon(c):
    h=c['height']; wx,wy,wz=0.28,-0.04,h*0.49; w=c.get('weapon','sword')
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
def add_hair(c):
    if c.get('hair') in ('helmet',): return
    head_obj=None
    for obj in bpy.context.scene.objects:
        if 'head' in obj.name.lower(): head_obj=obj; break
    if not head_obj: return
    bpy.context.view_layer.objects.active=head_obj
    style=c.get('hair','short')
    cnt={'short':300,'long':600,'hood':0}.get(style,200)
    length={'short':0.12,'long':0.40,'hood':0}.get(style,0.10)
    if cnt==0: return
    vg=head_obj.vertex_groups.new(name="Scalp")
    sel=[v.index for v in head_obj.data.vertices if v.co.z>0.10]
    if sel: vg.add(sel,1.0,'REPLACE')
    head_obj.modifiers.new(name="Hair",type='PARTICLE_SYSTEM')
    ps=head_obj.particle_systems[0].settings
    try: ps.type='HAIR'
    except: pass
    ps.count=cnt
    try: ps.hair_length=length
    except: pass
    try: ps.hair_step=3
    except: pass
    for attr in ('vertex_group_density','vertex_group_length','vertex_group'):
        try: setattr(ps,attr,"Scalp"); break
        except: pass
    try: ps.use_hair_bspline=True
    except: pass
    try:
        hm=mkmat(f"{c['id']}_hair_particle",*c['hair_color'],rough=0.45)
        head_obj.data.materials.append(hm)
        ps.material=len(head_obj.data.materials)-1
    except: pass

# ====== 皮肤细节 ======
def add_skin_details(c):
    skin=mkmat(f"{c['id']}_skin",*c['skin'],rough=0.62)
    nm=mkmat(f"{c['id']}_nail",min(1,c['skin'][0]*0.85),min(1,c['skin'][1]*0.75),min(1,c['skin'][2]*0.65),rough=0.3)
    # 指甲
    for side,sx in [('l',-1),('r',1)]:
        for fi,fx in enumerate([-0.03,-0.015,0,0.015,0.03]):
            Cy(f"{side}_nail{fi}",sx*0.22+fx,-0.12,0.475,0.01,0.015,nm)
        for ti,tx in enumerate([-0.03,-0.015,0,0.015,0.03]):
            Cy(f"{side}_tn{ti}",sx*0.11+tx,0.05,0.04,0.008,0.012,nm)
    # 肚脐
    S("navel",0,-0.16,0.55,0.02,skin)
    Cy("navel_rim",0,-0.16,0.55,0.022,0.005,skin); bpy.context.active_object.rotation_euler.x=math.pi/2
    # 关节皱纹
    wm=mkmat(f"{c['id']}_wrinkle",c['skin'][0]*0.7,c['skin'][1]*0.6,c['skin'][2]*0.5,rough=0.75)
    for side,sx in[('l',-1),('r',1)]:
        for j in range(3):
            Cy(f"{side}_ewr{j}",sx*0.22,-0.07+0.01*j,0.63+0.01*j,0.05,0.005,wm); bpy.context.active_object.rotation_euler.x=math.pi/2
            Cy(f"{side}_kwr{j}",sx*0.10,-0.07+0.01*j,0.33+0.01*j,0.06,0.005,wm); bpy.context.active_object.rotation_euler.x=math.pi/2
        for fi in range(5):
            for seg in range(2):
                Cy(f"{side}_kn{fi}_{seg}",sx*0.24-0.04+fi*0.02,-0.1,0.46+seg*0.022,0.012,0.003,wm)
    # 血管
    if c.get('shape','').startswith(('muscular','heavy','compact')):
        vm=mkmat(f"{c['id']}_vein",0.15,0.22,0.28,rough=0.45)
        for side,sx in[('l',-1),('r',1)]:
            for v in range(3):
                Cy(f"{side}_vein{v}",sx*0.22+random.uniform(-0.02,0.02),-0.08,0.56+random.uniform(0,0.06),0.004,random.uniform(0.04,0.08),vm)
            Cy(f"{side}_vein_h",sx*0.24,-0.08,0.46,0.003,0.05,vm)

# ====== 细分+纹理 ======
def add_subdiv():
    body_kw=('head','chest','torso','arm','leg','thigh','shin','hand','shoulder','forearm','pelvis',
             'jaw','chin','nose','ear','foot','ankle','calf','knee','quad','bicep','deltoid',
             'pectoral','ribcage','waist','neck','wrist','palm','glutes')
    cloth_kw=('robe','tunic','cape','armor','chestplate','cloth')
    for obj in bpy.context.scene.objects:
        n=obj.name.lower()
        bpy.context.view_layer.objects.active=obj
        if any(k in n for k in body_kw):
            try: op(lambda:bpy.ops.object.modifier_add(type='SUBSURF')); obj.modifiers[-1].levels=2
            except: pass
        elif any(k in n for k in cloth_kw):
            try: op(lambda:bpy.ops.object.modifier_add(type='SUBSURF')); obj.modifiers[-1].levels=1
            except: pass
    # 皮肤毛孔位移
    for obj in list(bpy.context.scene.objects):
        if obj.name.lower() in ('head','chest','torso','jaw'):
            bpy.context.view_layer.objects.active=obj
            try:
                op(lambda:bpy.ops.object.modifier_add(type='DISPLACE'))
                disp=obj.modifiers[-1]; disp.strength=0.002; disp.mid_level=0.5
                try:
                    tex=bpy.data.textures.new(name=f"{obj.name}_skin_tex",type='CLOUDS')
                    tex.noise_scale=0.5; tex.noise_depth=2; disp.texture=tex
                except:
                    try: tex=bpy.data.textures.new(name=f"{obj.name}_skin_tex",type='NOISE'); disp.texture=tex
                    except: pass
            except: pass

# ====== 导出 ======
OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "werewolf_models"
)
os.makedirs(OUTPUT_DIR,exist_ok=True)

def generate(c):
    print(f"\n  🎭 {c['id']} — {c['name']} | {c['height']}m | {c.get('shape','?')} | {c['origin']}")
    clear()
    make_body(c);                   print("     ↳ 身体(8头身比例)")
    add_skin_details(c);            print("     ↳ 皮肤(指甲/皱纹/血管)")
    add_clothing(c);                print("     ↳ 服装")
    add_weapon(c);                  print("     ↳ 武器")
    add_hair(c);                    print("     ↳ 发丝")
    add_subdiv();                   print("     ↳ 细分+纹理")
    select_all()
    path=os.path.join(OUTPUT_DIR,f"character_{c['id']}.glb")
    export_glb(path)
    print(f"  ✅ {c['name']} 完成")
