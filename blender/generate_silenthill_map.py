"""
============================================================
 狼人杀 3D 大型地图 — 寂静岭风格神秘遗迹
 兼容 Blender 4.0 ~ 5.x LTS
 规模 150×150m，地形起伏，多地面纹理
============================================================
"""
import bpy, math, random, os

print("="*60)
print("  🌫 寂静岭大型遗迹地图")
print("  规模: 150×150m | 目标: 自由奔跑追逐")
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
    kw = dict(filepath=path, use_selection=True)
    for k in ('export_format','export_format_option'):
        try: bpy.ops.export_scene.gltf(**kw, **{k:'GLB'}); return
        except: pass
    try: bpy.ops.export_scene.gltf(**kw)
    except Exception as e: print(f"     export err: {e}")

def mkmat(name, r, g, b, a=1.0, rough=0.8):
    m = bpy.data.materials.new(name=name); m.use_nodes = True
    t = m.node_tree; t.nodes.clear()
    bsdf = None
    for bt in ('ShaderNodeBsdfPrincipled','ShaderNodeBsdfPrincipledv2'):
        try: bsdf = t.nodes.new(bt); break
        except RuntimeError: pass
    out = None
    for ot in ('ShaderNodeOutputMaterial','ShaderNodeOutput'):
        try: out = t.nodes.new(ot); break
        except RuntimeError: pass
    try: t.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    except KeyError:
        so = next((o for o in bsdf.outputs if o.type=='SHADER'), bsdf.outputs[0])
        si = next((i for i in out.inputs if i.type=='SHADER'), out.inputs[0])
        t.links.new(so, si)
    for sn, sv in (('Base Color',(r,g,b,a)),('Roughness',rough)):
        try:
            if sn in bsdf.inputs: bsdf.inputs[sn].default_value = sv
        except: pass
    return m

# ====== 地形系统 ======
def make_terrain():
    """150x150 起伏地形 + 多纹理地面"""
    print("  [地形] 生成 150m 起伏地形...")
    MAP = 75  # 半边长

    # ----- 主地形网格 (带起伏) -----
    # 创建细分平面并用顶点位移制造起伏
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=60, y_subdivisions=60, size=MAP*2, location=(0,0,-0.1))
    terrain = bpy.context.active_object
    terrain.name = "Terrain"

    # 顶点位移 — 模拟自然丘陵
    import math as m
    for v in terrain.data.vertices:
        x, y = v.co.x, v.co.y
        # 多层噪声叠加模拟自然地形
        d = v.co.z  # 保留原始
        # 大尺度起伏 (山丘)
        h1 = m.sin(x * 0.02) * m.cos(y * 0.025) * 4.0
        # 中尺度起伏
        h2 = m.sin(x * 0.06 + 1.5) * m.cos(y * 0.07 + 0.8) * 2.0
        # 小尺度细节
        h3 = m.sin(x * 0.15 + 2.3) * m.cos(y * 0.13 + 1.1) * 0.7
        # 中心区域略微抬高 (城镇所在地)
        dist = m.sqrt(x*x + y*y)
        h4 = max(0, 60 - dist) * 0.06 if dist < 60 else 0
        v.co.z = h1 + h2 + h3 + h4

    # 材质 — 暗色泥土基底
    terrain_mat = mkmat("terrain_base", 0.10, 0.09, 0.07, rough=0.95)
    terrain.data.materials.append(terrain_mat)

    # ----- 地面纹理层 (叠加平面) -----
    # 中央城镇区 — 暗色碎石地面
    P("ground_town", 0, 0, 0.02, 38, 38, mkmat("g_town", 0.16, 0.14, 0.13, rough=0.90))
    # 草地斑块 — 散布在非建筑区
    for i, (gx, gy, gr) in enumerate([
        (-40, 40, 18), (35, 45, 16), (-45, -35, 20), (40, -40, 17),
        (-20, 55, 14), (50, 20, 15), (-50, -10, 13), (20, -55, 16),
        (55, -15, 14), (-35, 20, 15), (10, 50, 12), (-55, 30, 13),
    ]):
        P(f"grass_{i}", gx, gy, 0.025, gr, gr, mkmat(f"grass_{i}",
            random.uniform(0.08,0.13), random.uniform(0.14,0.20), random.uniform(0.04,0.08), rough=0.92))
    # 沙土区 — 废墟和外围
    for i, (sx, sy, sr) in enumerate([
        (-55, -55, 22), (-60, 50, 18), (55, -55, 20), (60, 40, 16),
        (-40, -60, 15), (40, 60, 17), (-60, -30, 14), (60, -30, 18),
    ]):
        P(f"sand_{i}", sx, sy, 0.022, sr, sr, mkmat(f"sand_{i}",
            random.uniform(0.18,0.22), random.uniform(0.15,0.18), random.uniform(0.10,0.13), rough=0.93))
    # 碎石/废墟地面 — 废墟区
    for i, (rx, ry, rr) in enumerate([
        (-50, -15, 12), (-60, -20, 10), (-45, -25, 8), (-55, -5, 9),
    ]):
        P(f"rubble_{i}", rx, ry, 0.028, rr, rr, mkmat(f"rbl_{i}",
            random.uniform(0.13,0.16), random.uniform(0.12,0.14), random.uniform(0.11,0.13), rough=0.94))

    print("     ↳ 多纹理地面完成 (泥土+草地+沙土+碎石)")

# ====== 快捷几何 ======
def P(name,x,y,z,sx,sy,m):
    bpy.ops.mesh.primitive_plane_add(size=1,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.scale=(sx,sy,1); o.data.materials.append(m); return o
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

def clear():
    bpy.ops.object.select_all(action='SELECT'); safe_del()
    for x in list(bpy.data.meshes): safe_rm(x)
    for x in list(bpy.data.materials): safe_rm_mat(x)

# ====== 组件库 ======

def make_tree(x, y, h=5.0):
    tr = h * 0.04
    Cy("trunk", x, y, h/2, tr, h, mkmat("ttrunk",0.06,0.05,0.04, rough=0.95))
    for j in range(3):
        S("leaf", x, y, h + j*0.6, tr*4*(1+j*0.4),
          mkmat(f"tleaf", random.uniform(0.03,0.06), random.uniform(0.08,0.13), random.uniform(0.02,0.04), rough=0.70))

def make_dead_tree(x, y, h=3.5):
    Cy("deadT", x, y, h/2, 0.08, h, mkmat("deadT",0.08,0.07,0.05, rough=0.96))
    for j in range(random.randint(2,5)):
        ba = random.uniform(0, math.pi*2)
        Cy("branch", x+math.cos(ba)*random.uniform(0.3,0.7), y+math.sin(ba)*random.uniform(0.3,0.7),
           h*random.uniform(0.4,0.8), 0.02, random.uniform(0.5,1.5),
           mkmat("br",0.08,0.07,0.05, rough=0.96))

def make_house(x, y, angle, w, d, h, ruined=False):
    cos_a = math.cos(angle); sin_a = math.sin(angle)
    wall = mkmat("hwall", random.uniform(0.10,0.14), random.uniform(0.07,0.10), random.uniform(0.05,0.08), rough=0.88)
    roof = mkmat("hroof", random.uniform(0.04,0.07), random.uniform(0.02,0.05), random.uniform(0.01,0.04), rough=0.84)
    # 墙体
    body = C("house", x, y, h/2, w, d, h/2, wall)
    body.rotation_euler.z = angle
    if ruined:
        body.rotation_euler.x = random.uniform(-0.06, 0.06)
        body.scale.z *= random.uniform(0.5, 0.85)
    # 屋顶
    rr = max(w,d)*1.08
    Cn("roof", x, y, h + h*0.35/2, rr, 0.02, h*0.35, roof)
    bpy.context.active_object.rotation_euler.z = angle
    # 烟囱
    C("chimney", x+w*0.3, y+d*0.3, h+0.15, 0.15, 0.12, 0.15,
      mkmat("chim",0.12,0.08,0.05, rough=0.85))
    # 门
    C("door", x+cos_a*d*0.85, y+sin_a*d*0.85, 0.8, 0.18, 0.02, 0.8,
      mkmat("door",0.22,0.15,0.08, rough=0.82))
    # 窗户
    for s in (-0.5, 0.5):
        wx = x - sin_a*w*s; wy = y - cos_a*w*s
        C("win", wx, wy, h*0.62, 0.12, 0.005, 0.18,
          mkmat("win",0.7,0.55,0.20, rough=0.12))

def make_clock_tower(x, y):
    h = 24.0
    # 底座
    C("cbase", x, y, 2.2, 2.2, 2.2, 2.2, mkmat("cbase",0.14,0.12,0.10, rough=0.82))
    # 塔身逐层
    for i, (z, sx, sz) in enumerate([(7, 1.8, 5.5), (12, 1.3, 4.5), (16, 0.9, 3.5)]):
        C(f"ctower{i}", x, y, z, sx, sx, sz, mkmat("ctower",0.13,0.11,0.09, rough=0.80))
    # 四面钟
    for i, (dx, dy, rz) in enumerate([(0,-1.5,0),(0,1.5,math.pi),(-1.5,0,-math.pi/2),(1.5,0,math.pi/2)]):
        Cy(f"cface{i}", x+dx, y+dy, 13, 0.7, 0.04, mkmat("cface",0.88,0.82,0.72, rough=0.08))
        bpy.context.active_object.rotation_euler.x = math.pi/2
    # 尖顶
    Cn("cspire", x, y, 21, 0.7, 0.02, 5, mkmat("cspire",0.04,0.03,0.03, rough=0.78))
    # 顶部
    Cy("cpin", x, y, 24, 0.07, 1.2, mkmat("cpin",0.06,0.05,0.04, rough=0.30))
    print(f"     🕰 钟楼 {h}m")

def make_church(x, y, angle):
    cos_a=math.cos(angle); sin_a=math.sin(angle)
    C("cnave", x, y, 4, 4, 8, 4, mkmat("cnave",0.09,0.08,0.07, rough=0.83))
    bpy.context.active_object.rotation_euler.z = angle
    Cn("cspire", x, y, 10.5, 4.5, 0.03, 7, mkmat("cspire",0.05,0.04,0.03, rough=0.80))
    bpy.context.active_object.rotation_euler.z = angle
    S("rose", x, y+sin_a*8.1, 5.5, 1.0, mkmat("rose",0.85,0.22,0.18, rough=0.08))
    C("cdoor", x+cos_a*8.1, y+sin_a*8.1, 2.5, 0.5, 0.03, 2.5, mkmat("cdoor",0.14,0.10,0.05, rough=0.78))
    bpy.context.active_object.rotation_euler.z = angle
    for s in (-1,1):
        C("cwin", x-sin_a*4*s, y-cos_a*4*s, 5, 0.12, 0.005, 2.0, mkmat("cwin",0.45,0.35,0.15, rough=0.12))
    print("     ⛪ 教堂")

def make_ruin_wall(x1,y1,x2,y2,h=3):
    dx=x2-x1; dy=y2-y1; length=math.sqrt(dx*dx+dy*dy); angle=math.atan2(dy,dx)
    for i in range(max(1,int(length/2))):
        t=i/max(1,int(length/2)-1) if int(length/2)>1 else 0.5
        sx=x1+dx*t+random.uniform(-0.4,0.4); sy=y1+dy*t+random.uniform(-0.4,0.4)
        sh=h*random.uniform(0.3,1.0)
        C(f"rw{i}",sx,sy,sh/2,0.8+random.random(),0.25,sh/2,mkmat("ruin",0.13,0.12,0.11, rough=0.90))
        bpy.context.active_object.rotation_euler.z=angle+random.uniform(-0.15,0.15)

def make_pillar(x,y,h=5):
    Cy("pil",x,y,h/2,0.35,h,mkmat("pil",0.19,0.18,0.16, rough=0.78))
    if random.random()<0.35:
        bpy.context.active_object.rotation_euler.x=random.uniform(0.3,1.0)
        bpy.context.active_object.rotation_euler.y=random.uniform(0,1.5)
        bpy.context.active_object.location.z=h*0.25

def make_tombstone(x,y):
    C("tb",x,y,0.3,0.2,0.06,0.7,mkmat("tb",0.17,0.16,0.15, rough=0.84))
    S("tb_top",x,y,0.7,0.12,mkmat("tb",0.17,0.16,0.15, rough=0.84))
    if random.random()>0.35:
        Cy("crv",x,y,0.8,0.015,0.5,mkmat("tb",0.17,0.16,0.15, rough=0.84))
        Cy("crh",x,y,0.95,0.015,0.25,mkmat("tb",0.17,0.16,0.15, rough=0.84))
        bpy.context.active_object.rotation_euler.y=math.pi/2

def make_lamp(x,y,h=4):
    Cy("lp",x,y,h/2,0.05,h,mkmat("lp",0.09,0.08,0.07, rough=0.75))
    S("lg",x,y,h+0.15,0.18,mkmat("lg",0.9,0.55,0.18, rough=0.08))

def make_fog(x,y,z,r):
    S("fog",x,y,z,r,mkmat("fog",0.62,0.64,0.63,0.04, rough=1.0))

def make_fence(x1,y1,x2,y2,h=1.4):
    dx=x2-x1; dy=y2-y1; L=math.sqrt(dx*dx+dy*dy); a=math.atan2(dy,dx)
    n=max(2,int(L/0.6))
    for i in range(n):
        t=i/(n-1); Cy("fp",x1+dx*t,y1+dy*t,h/2,0.022,h,mkmat("fp",0.10,0.09,0.08, rough=0.78))
    Cy("fb",(x1+x2)/2,(y1+y2)/2,h*0.75,0.018,L,mkmat("fb",0.10,0.09,0.08, rough=0.78))
    bpy.context.active_object.rotation_euler.z=a; bpy.context.active_object.rotation_euler.x=math.pi/2


# ====== 主流程 ======
def main():
    random.seed(42)
    MAP = 75
    clear()

    # ── 1. 地形 ──
    print("\n━━━ 1/10 地形 ━━━")
    make_terrain()

    # ── 2. 道路 ──
    print("\n━━━ 2/10 道路网 ━━━")
    road = mkmat("road",0.15,0.14,0.13, rough=0.91)
    path = mkmat("path",0.11,0.10,0.09, rough=0.92)
    # 主干道
    P("mainNS",0,0,0.03,5.5,MAP,road)
    P("mainEW",0,0,0.03,MAP,5.5,road)
    # 环线
    for r in (25, 45, 65):
        for cx,cy,sx,sy in [(r,0,3.5,r),(0,r,r,3.5),(-r,0,3.5,r),(0,-r,r,3.5)]:
            P(f"r{r}",cx,cy,0.025,sx,sy,road)
    # 网格街道
    for sx in range(-50, 55, 12):
        P(f"st{sx}",sx,12,0.025,1.8,18,path)
    for sy in range(-5, 22, 10):
        P(f"sth{sy}",-10,sy,0.025,22,1.8,path)
    # 中央广场
    P("plaza",0,0,0.04,16,16,mkmat("plaza",0.18,0.17,0.16, rough=0.87))

    # ── 3. 钟楼 ──
    print("\n━━━ 3/10 钟楼 ━━━")
    make_clock_tower(0, 0)

    # ── 4. 居住区 (北部) ──
    print("\n━━━ 4/10 居住区 (22栋) ━━━")
    houses_north = [
        (-20,35,0.1,3.5,2.5,5.0,False), (-12,38,-0.1,3.2,2.3,4.5,False),
        (-5,34,0.05,3.8,2.8,5.5,False), (2,37,0.0,3.0,2.2,4.2,False),
        (8,35,-0.05,3.4,2.6,4.8,True), (15,38,0.08,3.1,2.3,4.3,False),
        (22,34,0.0,3.6,2.7,5.2,False), (29,37,-0.1,3.3,2.4,4.6,True),
        (35,33,0.1,3.0,2.2,4.0,False), (42,36,0.0,3.5,2.6,5.0,False),
        (-25,22,0.15,3.2,2.3,4.5,False), (-18,15,-0.05,3.5,2.6,5.0,True),
        (-9,18,0.02,3.3,2.4,4.6,False), (-2,14,0.0,3.7,2.8,5.3,False),
        (6,17,-0.08,3.1,2.2,4.2,True), (14,15,0.06,3.4,2.5,4.8,False),
        (22,18,0.0,3.2,2.3,4.4,False), (30,15,-0.1,3.6,2.7,5.1,False),
        (38,20,0.05,3.0,2.2,4.0,True), (-20,28,0.0,3.5,2.6,4.9,False),
        (10,28,-0.05,3.3,2.4,4.5,False), (25,28,0.08,3.1,2.3,4.3,False),
    ]
    for x,y,a,w,d,h,ruined in houses_north:
        make_house(x,y,a,w,d,h,ruined)
    print(f"     ↳ {len(houses_north)}栋 完成")

    # ── 5. 教堂+墓地 (东) ──
    print("\n━━━ 5/10 教堂+墓地 ━━━")
    make_church(40, 30, -0.3)
    for i in range(35):
        gx=40+random.uniform(-8,12); gy=22+random.uniform(-6,8)
        if abs(gx-40)<3 and abs(gy-30)<4: continue
        make_tombstone(gx,gy)
    make_fence(32,18,52,18,1.6); make_fence(52,18,52,28,1.6); make_fence(32,28,52,28,1.6)
    print("     ↳ 35座墓碑 + 围墙")

    # ── 6. 废墟区 (西) ──
    print("\n━━━ 6/10 废墟区 ━━━")
    for i in range(14):
        x1=-50+random.uniform(-10,10); y1=random.uniform(-20,20)
        make_ruin_wall(x1,y1,x1+random.uniform(3,8),y1+random.uniform(-3,4),random.uniform(2,5))
    for i in range(18):
        make_pillar(-55+random.uniform(-15,15),random.uniform(-25,25),random.uniform(2.5,6))
    for i in range(10):
        C(f"debris{i}",-52+random.uniform(-12,12),random.uniform(-20,20),0.35,
          random.uniform(1.5,3.5),random.uniform(1,2.5),random.uniform(0.2,0.9),
          mkmat("debris",0.12,0.11,0.10, rough=0.93))
    print("     ↳ 14段墙 + 18石柱 + 10残骸")

    # ── 7. 南部森林 ──
    print("\n━━━ 7/10 森林 (70+棵树) ━━━")
    for i in range(75):
        tx=random.uniform(-55,55); ty=random.uniform(-65,-12)
        if abs(tx)<8 and abs(ty+20)<8: continue
        th=random.uniform(4,8)
        if random.random()<0.3: make_dead_tree(tx,ty,th*0.7)
        else: make_tree(tx,ty,th)
    for i in range(55):
        make_fog(random.uniform(-60,60),random.uniform(-70,-12),random.uniform(0.3,4),random.uniform(2,6))
    P("forest_path",0,-30,0.025,2.5,22,mkmat("fpath",0.10,0.09,0.08, rough=0.93))
    print("     ↳ 75棵 + 55团雾")

    # ── 8. 外围村庄 ──
    print("\n━━━ 8/10 外围散落农舍 ━━━")
    outskirts=[
        (-55,55,0.2,2.8,2.0,3.8),(-60,-50,-0.1,2.5,1.8,3.5),
        (55,-58,0.15,2.9,2.1,4.0),(58,50,0.0,3.0,2.2,4.2),
        (-50,30,-0.1,2.6,1.9,3.6),(55,20,0.05,2.8,2.0,3.8),
        (20,-60,0.0,2.7,1.9,3.7),(-20,60,-0.08,2.5,1.8,3.4),
        (50,-20,0.1,3.0,2.2,4.1),(-40,-40,0.0,2.6,1.9,3.5),
    ]
    for x,y,a,w,d,h in outskirts:
        make_house(x,y,a,w,d,h,False)
        make_fence(x-3,y-3,x+3,y-3,1.1); make_fence(x+3,y-3,x+3,y+3,1.1)
    print(f"     ↳ {len(outskirts)}栋")

    # ── 9. 路灯 ──
    print("\n━━━ 9/10 路灯 + 水洼 ━━━")
    for i in range(-60,61,10):
        make_lamp(i,-3.5); make_lamp(i,3.5)
        make_lamp(-3.5,i); make_lamp(3.5,i)
    for i in range(12):
        a=i*math.pi/6
        make_lamp(math.cos(a)*25,math.sin(a)*25,4)
        make_lamp(math.cos(a)*45,math.sin(a)*45,4)
        make_lamp(math.cos(a)*65,math.sin(a)*65,4)
    # 水洼
    for px,py,pr in [(30,-45,6),(-28,-35,5),(40,-30,4),(-35,-50,7),(10,-58,5)]:
        S("pond",px,py,0.02,pr,mkmat("water",0.03,0.05,0.08,0.35, rough=0.05))

    print(f"     ↳ 路灯 + 5水洼")

    # ── 10. 全局雾 ──
    print("\n━━━ 10/10 全局雾层 ━━━")
    for i in range(45):
        make_fog(random.uniform(-65,65),random.uniform(-65,65),random.uniform(1.5,6),random.uniform(4,12))
    print("     ↳ 45团高空雾")

    print("\n"+"="*60)
    print("  ✅ 地图完成!")
    print(f"  规模: 150×150m | 22住宅+8农舍 | 75树 | 钟楼24m")
    print(f"  地形起伏 | 多纹理地面 | 自由奔跑宽敞")
    print("="*60)

# ====== 导出 ======
OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "werewolf_models"
)
os.makedirs(OUTPUT_DIR, exist_ok=True)

clear()
main()
bpy.ops.object.select_all(action='SELECT')
glb = os.path.join(OUTPUT_DIR, "werewolf_silenthill_map.glb")
print(f"\n导出: {glb}")
safe_gltf(glb)
print(f"文件: werewolf_silenthill_map.glb")
