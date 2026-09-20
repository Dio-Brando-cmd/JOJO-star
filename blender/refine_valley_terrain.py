# ============================================================
# refine_valley_terrain.py — 桃花源山谷地形精修 (Blender 无头)
# 精修: 山崖(Cliff) 细分+岩石位移 + 地面(Terrain) 细分+微起伏
# 流程: 导入 Valley.glb → 渲染前 → 精修 → 渲染后 → 导出 Valley_refined.glb
# 用法: blender --background --python refine_valley_terrain.py
# ============================================================

import bpy, os, math, time, sys

GLB       = r"E:\veiland\werewolf-online\unity-client\Assets\Models\Environment\Valley.glb"
OUT_GLB   = r"E:\veiland\werewolf-online\unity-client\Assets\Models\Environment\Valley_refined.glb"
BEFORE_PNG= r"E:\veiland\werewolf-online\valley_before.png"
AFTER_PNG = r"E:\veiland\werewolf-online\valley_after.png"
LOG       = r"E:\veiland\werewolf-online\refine_log.txt"

def log(msg):
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(msg + "\n")

# ---------------- 程序化噪声 ----------------
def hash3(x, y, z, seed):
    n = (int(x*127.1) + int(y*311.7)*193 + int(z*74.7)*101 + seed*1000003)
    n = (n * 8192) ^ n
    n = n & 0x7fffffff
    return (n % 100000) / 100000.0

def _smooth(t): return t*t*(3-2*t)

def vnoise(x, y, z, seed=0):
    xi = math.floor(x); yi = math.floor(y); zi = math.floor(z)
    xf = x-xi; yf = y-yi; zf = z-zi
    u = _smooth(xf); v = _smooth(yf); w = _smooth(zf)
    c000=hash3(xi,yi,zi,seed);   c100=hash3(xi+1,yi,zi,seed)
    c010=hash3(xi,yi+1,zi,seed); c110=hash3(xi+1,yi+1,zi,seed)
    c001=hash3(xi,yi,zi+1,seed); c101=hash3(xi+1,yi,zi+1,seed)
    c011=hash3(xi,yi+1,zi+1,seed); c111=hash3(xi+1,yi+1,zi+1,seed)
    x00=c000*(1-u)+c100*u; x10=c010*(1-u)+c110*u
    x01=c001*(1-u)+c101*u; x11=c011*(1-u)+c111*u
    y0=x00*(1-v)+x10*v; y1=x01*(1-v)+x11*v
    return y0*(1-w)+y1*w

def fbm(x, y, z, octaves=4, seed=0):
    total=0.0; amp=1.0; freq=1.0; norm=0.0
    for i in range(octaves):
        total += amp*vnoise(x*freq, y*freq, z*freq, seed+i*137)
        norm += amp
        amp *= 0.5; freq *= 2.1
    return total/norm

# ---------------- 网格处理 ----------------
def subdivide(obj, levels, catmull=False):
    mod = obj.modifiers.new("RefineSubdiv", 'SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    if catmull:
        mod.subdivision_type = 'CATMULL_CLARK'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="RefineSubdiv")

def displace_verts(obj, amplitude, octaves, seed, mask_fn=None):
    """沿顶点法线做 fbm 位移。mask_fn(worldx,worldy)->0..1 可选。"""
    me = obj.data
    mw = obj.matrix_world
    n_ok = 0
    for v in me.vertices:
        wx, wy, wz = mw @ v.co
        m = 1.0
        if mask_fn is not None:
            m = mask_fn(wx, wy)
        if m <= 0.001:
            continue
        n = v.normal
        d = (fbm(wx, wy, wz, octaves, seed) - 0.5) * 2.0 * amplitude * m
        v.co = v.co + n * d
        n_ok += 1
    return n_ok

def smooth_normals(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.shade_smooth()

# ---------------- 渲染 ----------------
def setup_scene():
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        try:
            sc.render.engine = 'BLENDER_EEVEE'
        except Exception:
            pass
    sc.render.resolution_x = 1280
    sc.render.resolution_y = 720
    sc.render.film_transparent = False
    # 相机
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (0, -58, 30)
    cam.rotation_euler = (math.radians(65), 0, 0)
    cam.data.lens = 45
    sc.camera = cam
    # 太阳光
    sun_data = bpy.data.lights.new("Sun", 'SUN')
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun)
    sun.location = (18, -30, 45)
    sun.rotation_euler = (math.radians(50), math.radians(15), math.radians(30))
    sun.data.energy = 4.0
    # 世界
    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg is not None:
        bg.inputs[0].default_value = (0.10, 0.12, 0.18, 1.0)
        bg.inputs[1].default_value = 0.6

def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

# ---------------- 主流程 ----------------
def main():
    t0 = time.time()
    open(LOG, 'w').close()  # 清空日志

    log(f"=== 导入 {os.path.basename(GLB)} ===")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    log(f"导入耗时 {time.time()-t0:.1f}s")

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    terrain = None
    cliffs = []
    for o in meshes:
        n = o.name
        if n == "Terrain" or (terrain is None and "T_Grass" in [s.material.name for s in o.material_slots if s.material] and n.lower().startswith("terr")):
            terrain = o
        if n.startswith("Cliff"):
            cliffs.append(o)
    # 若没找到名为 Terrain，取 T_Grass 材质中面数最大的
    if terrain is None:
        best = None
        for o in meshes:
            if "T_Grass" in [s.material.name for s in o.material_slots if s.material]:
                if best is None or len(o.data.polygons) > len(best.data.polygons):
                    best = o
        terrain = best
    log(f"Terrain: {terrain.name if terrain else '未找到'} (面={len(terrain.data.polygons) if terrain else 0})")
    log(f"Cliff 数量: {len(cliffs)}")

    if terrain is not None:
        mw = terrain.matrix_world
        bb = terrain.bound_box
        xs=[mw@terrain.data.vertices[0].co if False else (mw@__import__('mathutils').Vector(c))[0] for c in bb]
        # 简单世界 bbox
        import mathutils
        pts = [mw @ mathutils.Vector(c) for c in bb]
        minx=min(p[0] for p in pts); maxx=max(p[0] for p in pts)
        miny=min(p[1] for p in pts); maxy=max(p[1] for p in pts)
        log(f"Terrain 世界范围 X[{minx:.1f},{maxx:.1f}] Y[{miny:.1f},{maxy:.1f}] 中心=({(minx+maxx)/2:.1f},{(miny+maxy)/2:.1f})")

    setup_scene()
    log("=== 渲染「精修前」 ===")
    render_to(BEFORE_PNG)
    log(f"before 渲染完成 ({time.time()-t0:.1f}s)")

    # ---- 精修 Cliff ----
    log("=== 精修 Cliff ===")
    for i, c in enumerate(cliffs):
        subdivide(c, 2, catmull=True)
        displace_verts(c, 1.2, 4, seed=10 + i*7)
        smooth_normals(c)
        if (i+1) % 10 == 0:
            log(f"  cliff {i+1}/{len(cliffs)}")
    log(f"cliff 精修完成")

    # ---- 精修 Terrain (中央广场保持平整) ----
    log("=== 精修 Terrain ===")
    if terrain is not None:
        subdivide(terrain, 1, catmull=False)
        plaza_r = 14.0
        def plaza_mask(wx, wy):
            r = math.hypot(wx, wy)
            if r < plaza_r:
                return 0.0
            return min(1.0, (r - plaza_r) / 3.0)
        n = displace_verts(terrain, 0.35, 3, seed=50, mask_fn=plaza_mask)
        smooth_normals(terrain)
        log(f"terrain 精修完成, 位移顶点 {n}")

    log("=== 渲染「精修后」 ===")
    render_to(AFTER_PNG)
    log(f"after 渲染完成 ({time.time()-t0:.1f}s)")

    # ---- 导出 ----
    log("=== 导出 ===")
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=False,
    )
    log(f"导出完成 → {OUT_GLB}")
    log(f"总耗时 {time.time()-t0:.1f}s")
    log("=== DONE ===")

main()
