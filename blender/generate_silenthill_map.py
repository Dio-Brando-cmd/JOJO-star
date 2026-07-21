"""
============================================================
 狼人杀 3D 地图 — 寂静岭风格神秘遗迹
 兼容 Blender 4.0 ~ 5.x LTS

 地图规模: 80×80m
 包含: 钟楼 / 居住区(15栋) / 教堂+墓地 / 森林(40+树)
        废墟区 / 外围村庄(8栋) / 道路网 / 雾气 / 路灯
============================================================
"""

import bpy, math, random, os

# ====== 兼容层 ======
def safe_del():
    try: bpy.ops.object.delete(use_confirm=False)
    except TypeError: bpy.ops.object.delete()

def safe_rm_mesh(b):
    try: bpy.data.meshes.remove(b)
    except: pass

def safe_rm_mat(b):
    try: bpy.data.materials.remove(b)
    except: pass

def safe_gltf(path, sel=True):
    kw = dict(filepath=path, use_selection=sel)
    for k in ('export_format','export_format_option'):
        try: bpy.ops.export_scene.gltf(**kw, **{k:'GLB'}); return
        except: pass
    try: bpy.ops.export_scene.gltf(**kw)
    except Exception as e: print(f"     ⚠ glTF: {e}")

def mkmat(name, r, g, b, a=1.0, rough=0.8):
    """安全创建材质"""
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True; t = m.node_tree; t.nodes.clear()
    bsdf = None
    for bt in ('ShaderNodeBsdfPrincipled','ShaderNodeBsdfPrincipledv2'):
        try: bsdf = t.nodes.new(bt); break
        except RuntimeError: pass
    if not bsdf: raise RuntimeError("BSDF fail")
    out = None
    for ot in ('ShaderNodeOutputMaterial','ShaderNodeOutput'):
        try: out = t.nodes.new(ot); break
        except RuntimeError: pass
    if not out: raise RuntimeError("Output fail")
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

# ====== 几何工具 ======
def P(name,x,y,z,sx,sy,m):          # 平面
    bpy.ops.mesh.primitive_plane_add(size=1,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.scale=(sx,sy,1); o.data.materials.append(m); return o

def C(name,x,y,z,sx,sy,sz,m):       # 立方体
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.scale=(sx,sy,sz); o.data.materials.append(m); return o

def Cy(name,x,y,z,r,d,m):           # 圆柱
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=d,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o

def S(name,x,y,z,r,m):              # 球
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o

def Cn(name,x,y,z,r1,r2,d,m):       # 锥
    bpy.ops.mesh.primitive_cone_add(radius1=r1,radius2=r2,depth=d,location=(x,y,z))
    o=bpy.context.active_object; o.name=name; o.data.materials.append(m); return o

def clear():
    bpy.ops.object.select_all(action='SELECT'); safe_del()
    for x in list(bpy.data.meshes): safe_rm_mesh(x)
    for x in list(bpy.data.materials): safe_rm_mat(x)

# ====== 材质预设 ======
# 地面
M_GROUND     = lambda: mkmat("grnd", 0.08,0.07,0.06, rough=0.95)
M_ROAD       = lambda: mkmat("road", 0.14,0.13,0.12, rough=0.92)
M_PATH       = lambda: mkmat("path", 0.10,0.09,0.08, rough=0.93)
M_PLAZA      = lambda: mkmat("plaza", 0.16,0.15,0.14, rough=0.88)
M_GRAVEL     = lambda: mkmat("gravel",0.12,0.11,0.10, rough=0.96)
# 建筑
M_HOUSE_WALL = lambda: mkmat("hwall", 0.09,0.07,0.06, rough=0.88)
M_HOUSE_WALL2= lambda: mkmat("hwall2",0.11,0.09,0.07, rough=0.90)
M_HOUSE_RUIN = lambda: mkmat("hruin",0.07,0.06,0.05, rough=0.94)
M_ROOF       = lambda: mkmat("roof", 0.06,0.04,0.03, rough=0.85)
M_ROOF_RED   = lambda: mkmat("roofR",0.18,0.06,0.04, rough=0.82)
M_WOOD       = lambda: mkmat("wood", 0.20,0.14,0.08, rough=0.85)
M_STONE      = lambda: mkmat("stone",0.22,0.20,0.18, rough=0.82)
M_STONE_DARK = lambda: mkmat("stoneD",0.14,0.13,0.12, rough=0.80)
M_BRICK      = lambda: mkmat("brick",0.18,0.10,0.06, rough=0.86)
# 教堂
M_CHURCH     = lambda: mkmat("church",0.08,0.07,0.07, rough=0.83)
M_ROOF_DARK  = lambda: mkmat("roofDk",0.04,0.03,0.03, rough=0.80)
M_WINDOW     = lambda: mkmat("window",0.8,0.2,0.1, rough=0.10)
M_WINDOW_DIM = lambda: mkmat("winDim",0.4,0.3,0.15, rough=0.15)
# 钟楼
M_CLOCK_WALL = lambda: mkmat("clockW",0.13,0.11,0.09, rough=0.80)
M_CLOCK_FACE = lambda: mkmat("clockF",0.85,0.80,0.70, rough=0.10)
M_CLOCK_HAND = lambda: mkmat("clockH",0.05,0.04,0.03, rough=0.30)
# 废墟
M_RUIN       = lambda: mkmat("ruin",0.12,0.11,0.10, rough=0.90)
M_PILLAR     = lambda: mkmat("pillar",0.18,0.17,0.16, rough=0.78)
# 自然
M_TREE_TRUNK = lambda: mkmat("ttrunk",0.06,0.05,0.04, rough=0.94)
M_TREE_LEAF  = lambda: mkmat("tleaf",0.03,0.06,0.02, rough=0.70)
M_DEAD_TREE  = lambda: mkmat("deadT",0.08,0.07,0.05, rough=0.95)
M_FOG        = lambda: mkmat("fog",0.65,0.67,0.66,0.05, rough=1.0)  # 半透明雾
M_WATER      = lambda: mkmat("water",0.02,0.04,0.06,0.4, rough=0.05)
# 细节
M_LAMP_POST  = lambda: mkmat("lampP",0.08,0.07,0.06, rough=0.75)
M_LAMP_GLOW  = lambda: mkmat("lampG",0.9,0.60,0.20, rough=0.10)
M_FENCE      = lambda: mkmat("fence",0.10,0.09,0.08, rough=0.78)
M_TOMB       = lambda: mkmat("tomb",0.16,0.15,0.14, rough=0.85)
M_DEBRIS     = lambda: mkmat("debris",0.13,0.12,0.11, rough=0.92)
M_MUD        = lambda: mkmat("mud",0.07,0.06,0.05, rough=0.97)

# ====== 场景组件 ======

def make_house(x, y, angle, w, d, h, wall_mat, roof_mat, ruined=False):
    """建造一栋房屋"""
    cos_a = math.cos(angle); sin_a = math.sin(angle)
    # 墙体
    body = C("house_body", x, y, h/2, w, d, h/2, wall_mat)
    body.rotation_euler.z = angle
    # 屋顶
    rr = max(w, d) * 1.05
    roof_h = h * 0.4
    roof = Cn("house_roof", x, y, h + roof_h/2, rr, 0.03, roof_h, roof_mat)
    roof.rotation_euler.z = angle
    if ruined:
        # 随机破洞 — 旋转墙体模拟倾斜
        body.rotation_euler.x = random.uniform(-0.08, 0.08)
        body.rotation_euler.y = random.uniform(-0.06, 0.06)
        body.scale.z *= random.uniform(0.6, 0.9)
    # 门
    door_x = x + cos_a * d * 0.85
    door_y = y + sin_a * d * 0.85
    C("door", door_x, door_y, 0.9, 0.2, 0.03, 0.9, M_WOOD())
    # 窗户
    for side in (-0.55, 0.55):
        wx = x + sin_a * w * side
        wy = y + cos_a * w * side * (-1)
        wm = M_WINDOW_DIM() if not ruined else M_WINDOW_DIM()
        C("win", wx, wy, h*0.6, 0.15, 0.01, 0.2, wm)
        if random.random() < 0.3 and not ruined:
            C("win2", wx, wy, h*0.3, 0.15, 0.01, 0.2, wm)


def make_clock_tower(x, y):
    """中心钟楼 — 地图最高点，寂静岭地标"""
    h = 20.0  # 总高度 20米
    # 基座 — 石质，3×3×4
    C("clock_base", x, y, 2, 1.5, 1.5, 2, M_STONE_DARK())
    # 塔身 — 逐层变细
    C("clock_body1", x, y, 6.5, 1.2, 1.2, 5, M_CLOCK_WALL())
    C("clock_body2", x, y, 11, 0.9, 0.9, 4, M_CLOCK_WALL())
    C("clock_body3", x, y, 14.5, 0.7, 0.7, 3, M_CLOCK_WALL())
    # 钟面 — 四个方向
    for i, (dx, dy, rz) in enumerate([
        (0, -1.25, 0), (0, 1.25, math.pi),
        (-1.25, 0, -math.pi/2), (1.25, 0, math.pi/2)
    ]):
        Cy(f"clock_face_{i}", x+dx, y+dy, 11.5, 0.55, 0.05, M_CLOCK_FACE())
        bpy.context.active_object.rotation_euler.x = math.pi/2
        # 指针
        C(f"hand_h_{i}", x+dx, y+dy+0.05, 11.5+0.1, 0.25, 0.015, 0.015, M_CLOCK_HAND())
        C(f"hand_m_{i}", x+dx+0.1, y+dy+0.05, 11.5, 0.015, 0.015, 0.35, M_CLOCK_HAND())
    # 尖顶
    Cn("clock_spire", x, y, 19, 0.55, 0.02, 2.5, M_ROOF_DARK())
    # 顶部十字/尖刺
    Cy("clock_pin", x, y, 21, 0.06, 0.8, M_CLOCK_HAND())
    print(f"    钟楼完成 — {h}m")


def make_church(x, y, angle):
    """教堂 — 哥特式，带玫瑰窗和尖顶"""
    cos_a = math.cos(angle); sin_a = math.sin(angle)
    # 主体
    C("church_nave", x, y, 3.5, 3, 6, 3.5, M_CHURCH())
    bpy.context.active_object.rotation_euler.z = angle
    # 尖顶
    Cn("church_spire", x, y, 8.5, 3.2, 0.03, 5.5, M_ROOF_DARK())
    bpy.context.active_object.rotation_euler.z = angle
    # 钟楼小塔
    C("church_tower", x + cos_a*2.5, y + sin_a*2.5, 5, 1.5, 1.5, 5, M_CHURCH())
    bpy.context.active_object.rotation_euler.z = angle
    Cn("church_tower_spire", x + cos_a*2.5, y + sin_a*2.5, 8.5, 1.2, 0.02, 2.5, M_ROOF_DARK())
    bpy.context.active_object.rotation_euler.z = angle
    # 玫瑰窗
    S("rose", x, y + sin_a*6.1, 5, 0.8, M_WINDOW())
    # 大门
    C("church_door", x + cos_a*6.1, y + sin_a*6.1, 2, 0.4, 0.03, 2, M_WOOD())
    bpy.context.active_object.rotation_euler.z = angle
    # 侧窗
    for s in (-1, 1):
        wx = x - sin_a * 3 * s
        wy = y - cos_a * 3 * s
        C("ch_win", wx, wy, 4, 0.15, 0.01, 1.8, M_WINDOW_DIM())
    print("    教堂完成")


def make_ruin_wall(x1, y1, x2, y2, h=2.5):
    """一段废墟墙壁 — 不规则石堆"""
    dx = x2 - x1; dy = y2 - y1
    length = math.sqrt(dx*dx + dy*dy)
    angle = math.atan2(dy, dx)
    segs = max(1, int(length / 1.5))
    for i in range(segs):
        t = i / segs
        sx = x1 + dx * t + random.uniform(-0.3, 0.3)
        sy = y1 + dy * t + random.uniform(-0.3, 0.3)
        sh = h * random.uniform(0.4, 1.0)
        C(f"wall_{i}", sx, sy, sh/2, 0.6+random.random()*0.4, 0.2, sh/2, M_RUIN())
        bpy.context.active_object.rotation_euler.z = angle + random.uniform(-0.1, 0.1)
        bpy.context.active_object.rotation_euler.x = random.uniform(-0.03, 0.03)


def make_pillar(x, y, h=4):
    """倒下的石柱或立着的柱子"""
    Cy(f"pillar", x, y, h/2, 0.3, h, M_PILLAR())
    if random.random() < 0.35:
        # 部分倒塌
        bpy.context.active_object.rotation_euler.x = random.uniform(0.3, 0.8)
        bpy.context.active_object.rotation_euler.y = random.uniform(0, 1.5)
        bpy.context.active_object.location.z = h * 0.3


def make_tombstone(x, y):
    """一块墓碑"""
    C("tomb", x, y, 0.3, 0.18, 0.05, 0.6, M_TOMB())
    S("tomb_top", x, y, 0.65, 0.1, M_TOMB())
    if random.random() > 0.4:
        # 十字架
        Cy("cross_v", x, y, 0.7, 0.015, 0.4, M_TOMB())
        Cy("cross_h", x, y, 0.85, 0.015, 0.2, M_TOMB())
        bpy.context.active_object.rotation_euler.y = math.pi/2


def make_tree(x, y, h=4.0):
    """一棵树 — 树干+树冠"""
    tr = h * 0.04
    Cy("trunk", x, y, h/2, tr, h, M_TREE_TRUNK())
    for j in range(3):
        cr = tr * 4 * (1 + j*0.4)
        cz = h + j * 0.5
        S(f"leaf", x, y, cz, cr, M_TREE_LEAF())


def make_dead_tree(x, y, h=3.0):
    """枯树 — 只有树干和枯枝"""
    Cy("dead_trunk", x, y, h/2, 0.08, h, M_DEAD_TREE())
    for j in range(random.randint(2, 4)):
        ba = random.uniform(0, math.pi*2)
        br = random.uniform(0.3, 0.7)
        bx = x + math.cos(ba) * br
        bz = h * random.uniform(0.4, 0.8)
        Cy("branch", bx, y, bz, 0.02, br*2, M_DEAD_TREE())
        bpy.context.active_object.rotation_euler.x = math.pi/3 + random.uniform(-0.3, 0.3)
        bpy.context.active_object.rotation_euler.z = ba


def make_lamp(x, y, h=3.5):
    """路灯 — 生锈铁质"""
    Cy("lamp_post", x, y, h/2, 0.04, h, M_LAMP_POST())
    # 灯罩
    S("lamp_glow", x, y, h + 0.1, 0.15, M_LAMP_GLOW())


def make_fence_line(x1, y1, x2, y2, h=1.2):
    """一段栅栏"""
    dx = x2 - x1; dy = y2 - y1
    length = math.sqrt(dx*dx + dy*dy)
    angle = math.atan2(dy, dx)
    posts = max(2, int(length / 0.5))
    for i in range(posts):
        t = i / (posts - 1)
        px = x1 + dx * t; py = y1 + dy * t
        Cy("fpost", px, py, h/2, 0.02, h, M_FENCE())
    # 横梁
    top_z = h * 0.75
    Cy("fbeam", (x1+x2)/2, (y1+y2)/2, top_z, 0.015, length, M_FENCE())
    bpy.context.active_object.rotation_euler.z = angle
    bpy.context.active_object.rotation_euler.x = math.pi/2


def make_fog_sphere(x, y, z, r):
    """一团雾"""
    S("fog", x, y, z, r, M_FOG())


# ====== 主地图生成 ======

def generate_map():
    """生成完整的寂静岭风格地图"""
    random.seed(42)
    MAP = 38  # 半边长，总地图 76×76

    print("="*60)
    print("  🌫 寂静岭风格神秘遗迹地图生成器")
    print("  规模: 76×76m")
    print("="*60)

    # ===== 第1步: 地形基底 =====
    print("\n[1/9] 地形基底...")
    # 主地面 — 稍微不平
    ground = M_GROUND()
    P("base_ground", 0, 0, -0.02, MAP, MAP, ground)
    # 略微隆起的中心区域
    P("center_rise", 0, 0, 0, MAP*0.6, MAP*0.6, M_GRAVEL())

    # ===== 第2步: 道路网 =====
    print("[2/9] 道路网...")
    road = M_ROAD()
    path = M_PATH()
    # 主干道 — 十字形
    P("main_NS", 0, 0, 0.02, 4, MAP, road)     # 南北
    P("main_EW", 0, 0, 0.02, MAP, 4, road)      # 东西
    # 环形路
    for r, name in [(18, "ring1"), (28, "ring2")]:
        for cx, cy, sx, sy in [
            (r, 0, 3, r), (-r, 0, 3, r),
            (0, r, r, 3), (0, -r, r, 3),
        ]:
            P(f"r_{name}", cx, cy, 0.015, sx, sy, road)
    # 居住区街道 (网格)
    for sx in (-14, -8, 2, 8, 14):
        P(f"st_v_{sx}", sx, 10, 0.015, 1.8, 14, path)
    for sy in (0, 7, 14):
        P(f"st_h_{sy}", -6, sy, 0.015, 16, 1.8, path)

    # 中央广场
    P("plaza", 0, 0, 0.04, 12, 12, M_PLAZA())

    # ===== 第3步: 钟楼 (地图正中心) =====
    print("[3/9] 钟楼...")
    make_clock_tower(0, 0)

    # ===== 第4步: 居住区 (北部) =====
    print("[4/9] 居住区 — 15栋废弃房屋...")
    house_configs = [
        # (x, y, angle, w, h, ruined)
        (-15, 18, 0.1, 3.0, 2.2, 4.5, False),
        (-10, 19, -0.1, 2.8, 2.0, 4.0, False),
        (-6, 17, 0.05, 3.2, 2.4, 4.8, True),
        (-1, 20, 0.0, 3.5, 2.8, 5.0, False),
        (4, 18, -0.05, 2.6, 1.8, 3.5, False),
        (8, 19, 0.08, 3.0, 2.2, 4.2, True),
        (13, 17, 0.0, 3.3, 2.5, 4.6, False),
        (16, 20, -0.1, 2.7, 2.0, 3.8, False),
        (-18, 10, 0.15, 2.5, 1.8, 3.5, False),
        (-15, 2, -0.05, 3.0, 2.3, 4.3, True),
        (-8, 4, 0.02, 3.4, 2.6, 5.0, False),
        (-2, 3, 0.0, 2.9, 2.1, 4.0, False),
        (5, 5, -0.08, 3.1, 2.3, 4.5, True),
        (12, 3, 0.06, 2.8, 2.0, 3.8, False),
        (17, 6, 0.0, 3.2, 2.4, 4.7, False),
    ]
    for x, y, a, w, d, h, ruined in house_configs:
        make_house(x, y, a, w, d, h, M_HOUSE_WALL() if not ruined else M_HOUSE_RUIN(),
                   M_ROOF() if not ruined else M_ROOF_RED(), ruined)

    # ===== 第5步: 教堂+墓地 (东北) =====
    print("[5/9] 教堂+墓地...")
    make_church(22, 18, -0.3)
    # 墓碑
    for i in range(25):
        gx = 20 + random.uniform(-5, 8)
        gy = 10 + random.uniform(-5, 5)
        if abs(gx-22) < 2.5 and abs(gy-18) < 3: continue  # 避开教堂
        make_tombstone(gx, gy)
    # 墓地围墙
    make_fence_line(15, 8, 30, 8, 1.5)
    make_fence_line(30, 8, 30, 16, 1.5)
    make_fence_line(15, 16, 30, 16, 1.5)

    # ===== 第6步: 废墟区 (西部) =====
    print("[6/9] 废墟区...")
    # 不规则废墟墙
    for i in range(8):
        x1 = -22 + random.uniform(-5, 5)
        y1 = -5 + random.uniform(-8, 8)
        x2 = x1 + random.uniform(2, 6)
        y2 = y1 + random.uniform(-2, 3)
        make_ruin_wall(x1, y1, x2, y2, h=random.uniform(1.8, 4.0))
    # 散落石柱
    for i in range(10):
        make_pillar(-25 + random.uniform(-8, 8), -5 + random.uniform(-10, 10), h=random.uniform(2, 5))
    # 倒塌建筑残骸
    for i in range(6):
        dx = -24 + random.uniform(-4, 4)
        dy = -3 + random.uniform(-6, 6)
        C(f"debris_{i}", dx, dy, 0.3, random.uniform(1,2.5), random.uniform(0.8,1.5), random.uniform(0.2,0.8), M_DEBRIS())
        bpy.context.active_object.rotation_euler.z = random.uniform(0, math.pi)

    # ===== 第7步: 森林 (南部) =====
    print("[7/9] 南部森林 — 40+ 棵树...")
    for i in range(45):
        tx = random.uniform(-30, 30)
        ty = random.uniform(-35, -10)
        # 避免道路
        if abs(tx) < 5 and abs(ty + 18) < 6: continue
        if abs(ty + 15) < 3: continue
        th = random.uniform(3.5, 7.0)
        if random.random() < 0.25:
            make_dead_tree(tx, ty, th*0.7)
        else:
            make_tree(tx, ty, th)
    # 迷雾粒子
    for i in range(40):
        fx = random.uniform(-35, 35)
        fy = random.uniform(-35, -10)
        fz = random.uniform(0.3, 3.0)
        fr = random.uniform(1.5, 4.0)
        make_fog_sphere(fx, fy, fz, fr)

    # 森林小径
    P("forest_path", 0, -22, 0.015, 2, 18, M_PATH())

    # ===== 第8步: 外围村庄 =====
    print("[8/9] 外围村庄 — 8栋散落农舍...")
    outskirts = [
        (-30, 25, 0.2, 2.2, 1.6, 3.0),
        (-28, -25, -0.1, 2.0, 1.5, 2.8),
        (28, -28, 0.15, 2.3, 1.7, 3.2),
        (30, 20, 0.0, 2.4, 1.8, 3.5),
        (-25, 5, -0.1, 2.1, 1.5, 2.8),
        (28, 5, 0.05, 2.5, 1.9, 3.3),
        (5, -30, 0.0, 2.0, 1.5, 2.7),
        (-8, 30, -0.08, 2.2, 1.6, 3.0),
    ]
    for x, y, a, w, d, h in outskirts:
        make_house(x, y, a, w, d, h, M_HOUSE_WALL2(), M_ROOF())
        # 栅栏
        make_fence_line(x-2, y-2, x+2, y-2, 1.0)
        make_fence_line(x+2, y-2, x+2, y+2, 1.0)

    # ===== 第9步: 细节装饰 =====
    print("[9/9] 细节装饰...")
    # 路灯 — 沿主干道
    for i in range(-30, 31, 8):
        make_lamp(i, -2.5); make_lamp(i, 2.5)
        make_lamp(-2.5, i); make_lamp(2.5, i)
    # 环形路灯
    for i in range(8):
        a = i * math.pi / 4
        make_lamp(math.cos(a)*18, math.sin(a)*18, 3.0)

    # 中央广场装饰 — 石墩/长椅
    for i in range(4):
        a = i * math.pi/2 + 0.3
        bx = math.cos(a) * 4; by = math.sin(a) * 4
        C("bench", bx, by, 0.3, 1.0, 0.25, 0.3, M_WOOD())
        bpy.context.active_object.rotation_euler.z = a

    # 全局雾层 — 高处的薄雾
    for i in range(25):
        make_fog_sphere(
            random.uniform(-32, 32),
            random.uniform(-32, 32),
            random.uniform(1.5, 5.0),
            random.uniform(3.0, 8.0)
        )

    # 水洼/沼泽 (南部)
    S("pond", 15, -25, 0.02, 4.5, M_WATER())
    S("pond2", -18, -20, 0.02, 3.0, M_WATER())
    S("pond3", 22, -15, 0.02, 2.5, M_WATER())

    print("\n" + "="*60)
    print("  ✅ 地图生成完成！")
    print("="*60)


# ====== 导出 ======
OUTPUT_DIR = os.path.join(
    os.path.dirname(bpy.data.filepath) if bpy.data.filepath
    else os.path.expanduser("~"), "werewolf_models"
)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    clear()
    generate_map()

    bpy.ops.object.select_all(action='SELECT')
    glb = os.path.join(OUTPUT_DIR, "werewolf_silenthill_map.glb")
    print(f"\n导出: {glb}")
    safe_gltf(glb)
    print(f"\n输出目录: {OUTPUT_DIR}")
    print("文件: werewolf_silenthill_map.glb")

if __name__ == "__main__":
    main()
