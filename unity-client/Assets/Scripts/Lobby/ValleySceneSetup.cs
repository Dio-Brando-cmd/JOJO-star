// ============================================================
// ValleySceneSetup.cs — 桃花源山谷场景构建器 v3
// 实例化 Blender 导出的 Valley.glb(glTFast 导入) + 符文巨石 + 打光/雾
// 复用 LobbyCameraIntro / LobbyManager / LobbyStone
//
// 坐标对齐 (Blender Z-up → Unity Y-up): (x,y,z) → (x, z, -y)
//   - 山谷原点(中央广场) = Unity (0, 0, 6)
//   - 洞口 Blender +Y = Unity -Z (镜头起点方向, z≈-30)
//   - 巨石 Blender (±9,0,0) = Unity (±9, 0, 6)
// ============================================================

using UnityEngine;
using System.Collections.Generic;

[ExecuteAlways]
public class ValleySceneSetup : MonoBehaviour
{
    [Header("══ 山谷模型 ══")]
    public GameObject valleyPrefab;                              // Valley.glb
    public Vector3 valleyPosition = new Vector3(0f, 0f, 6f);     // 谷底中央广场对齐巨石
    public bool remapMaterials = true;                           // GLB 材质 → URP Lit

    [Header("══ 巨石 — 优先用 Prefab，为空则自动生成 ══")]
    public GameObject stone2DPrefab;
    public GameObject stone3DPrefab;
    public Vector3 stone2DPos = new Vector3(-9f, 0f, 6f);
    public Vector3 stone3DPos = new Vector3(9f, 0f, 6f);
    public float stoneHeight = 5.5f;
    public float stoneWidth = 2.8f;

    [Header("══ 光照 ══")]
    public Color fogColor = new Color(0.03f, 0.05f, 0.11f);
    public float fogDensity = 0.012f;
    public Color ambientColor = new Color(0.10f, 0.12f, 0.22f);
    public float ambientIntensity = 1.0f;
    public Color moonColor = new Color(0.42f, 0.48f, 0.75f);
    public float moonIntensity = 1.4f;

    [Header("══ 构建 ══")]
    public bool buildOnStart = true;

    private GameObject _valley;
    private GameObject _stoneLeft;
    private GameObject _stoneRight;
    private LobbyStone _stoneLeftScript;
    private LobbyStone _stoneRightScript;
    private static Dictionary<string, Material> _matCache;

    public GameObject Valley => _valley;
    public GameObject StoneLeft => _stoneLeft;
    public GameObject StoneRight => _stoneRight;
    public LobbyStone StoneLeftScript => _stoneLeftScript;
    public LobbyStone StoneRightScript => _stoneRightScript;

    // ============================================================
    // Lifecycle
    // ============================================================

    void Start()
    {
        if (buildOnStart && Application.isPlaying)
            Build();
    }

    [ContextMenu("Build Valley Scene")]
    public void Build()
    {
        ClearChildren();
        ApplyEnvironment();
        BuildValley();
        BuildStones();
        BuildLighting();
        Debug.Log("[Valley] ✅ 桃花源山谷构建完成");
    }

    void ClearChildren()
    {
        var list = new List<GameObject>();
        foreach (Transform t in transform)
            list.Add(t.gameObject);
        foreach (var go in list)
        {
            if (go == null) continue;
            if (Application.isPlaying) Destroy(go);
            else DestroyImmediate(go);
        }
    }

    // ============================================================
    // Environment
    // ============================================================

    void ApplyEnvironment()
    {
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.ExponentialSquared;
        RenderSettings.fogDensity = fogDensity;
        RenderSettings.fogColor = fogColor;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = ambientColor;
        RenderSettings.ambientIntensity = ambientIntensity;
    }

    // ============================================================
    // Valley
    // ============================================================

    void BuildValley()
    {
        if (valleyPrefab == null)
        {
            Debug.LogWarning("[Valley] ⚠️ valleyPrefab 未设置！请拖入 Valley.glb，或运行 Tools → Create Valley Scene");
            return;
        }

        _valley = Instantiate(valleyPrefab, valleyPosition, Quaternion.identity, transform);
        _valley.name = "Valley";

        if (remapMaterials)
            RemapMaterials(_valley);
    }

    // ============================================================
    // Materials — GLB 材质名 → URP Lit 重建
    // ============================================================

    struct MatDef
    {
        public Color color;
        public float rough;
        public float metallic;
        public Color emission;   // HDR (已乘强度)
        public bool emissive;

        public MatDef(Color c, float r, float m = 0f)
        { color = c; rough = r; metallic = m; emission = Color.black; emissive = false; }
        public MatDef(Color c, float r, float m, Color e)
        { color = c; rough = r; metallic = m; emission = e; emissive = true; }
    }

    static readonly Dictionary<string, MatDef> MAT_DEFS = new Dictionary<string, MatDef>
    {
        // 地形
        ["T_Grass"]     = new MatDef(new Color(0.14f, 0.19f, 0.11f), 0.95f),
        ["GrassBlade"]  = new MatDef(new Color(0.16f, 0.24f, 0.11f), 0.92f),
        ["T_Dirt"]      = new MatDef(new Color(0.16f, 0.13f, 0.09f), 0.95f),
        ["T_Path"]      = new MatDef(new Color(0.20f, 0.19f, 0.17f), 0.93f),
        ["T_Plaza"]     = new MatDef(new Color(0.18f, 0.17f, 0.16f), 0.90f),
        ["T_Moss"]      = new MatDef(new Color(0.07f, 0.11f, 0.06f), 0.96f),
        ["CliffRock"]   = new MatDef(new Color(0.15f, 0.14f, 0.13f), 0.92f),
        ["RockGray"]    = new MatDef(new Color(0.20f, 0.19f, 0.17f), 0.90f),
        // 水体 (微自发光)
        ["Water"]       = new MatDef(new Color(0.05f, 0.11f, 0.17f), 0.08f, 0f,
                                      new Color(0.012f, 0.048f, 0.084f)),
        // 木构
        ["WoodDark"]    = new MatDef(new Color(0.20f, 0.13f, 0.07f), 0.70f),
        ["WoodLight"]   = new MatDef(new Color(0.44f, 0.39f, 0.32f), 0.88f),
        ["WoodFloor"]   = new MatDef(new Color(0.30f, 0.22f, 0.13f), 0.75f),
        ["StoneFound"]  = new MatDef(new Color(0.28f, 0.26f, 0.24f), 0.88f),
        ["RoofTile"]    = new MatDef(new Color(0.11f, 0.07f, 0.06f), 0.85f),
        ["RoofDark"]    = new MatDef(new Color(0.07f, 0.05f, 0.04f), 0.85f),
        ["DoorWood"]    = new MatDef(new Color(0.26f, 0.16f, 0.08f), 0.72f),
        // 暖光 (自发光)
        ["WindowGlow"]  = new MatDef(new Color(0.95f, 0.62f, 0.28f), 0.3f, 0f,
                                      new Color(5.0f, 2.75f, 0.9f)),
        ["LanternPaper"]= new MatDef(new Color(0.95f, 0.52f, 0.16f), 0.3f, 0f,
                                      new Color(6.0f, 3.0f, 0.84f)),
        ["LanternFrame"]= new MatDef(new Color(0.16f, 0.11f, 0.06f), 0.7f),
        ["LanternMetal"]= new MatDef(new Color(0.20f, 0.19f, 0.18f), 0.5f, 0.6f),
        // 桃花
        ["PeachBlossom"]= new MatDef(new Color(0.94f, 0.55f, 0.62f), 0.5f, 0f,
                                      new Color(0.77f, 0.31f, 0.39f)),
        ["PeachDark"]   = new MatDef(new Color(0.72f, 0.36f, 0.44f), 0.6f),
        ["Petal"]       = new MatDef(new Color(0.95f, 0.60f, 0.68f), 0.55f, 0f,
                                      new Color(0.35f, 0.16f, 0.20f)),
        // 树木
        ["TrunkDark"]   = new MatDef(new Color(0.13f, 0.09f, 0.06f), 0.92f),
        ["DeadBranch"]  = new MatDef(new Color(0.09f, 0.07f, 0.05f), 0.94f),
        ["PineNeedle"]  = new MatDef(new Color(0.05f, 0.12f, 0.06f), 0.85f),
        ["Bamboo"]      = new MatDef(new Color(0.22f, 0.34f, 0.16f), 0.78f),
        ["Reed"]        = new MatDef(new Color(0.52f, 0.44f, 0.21f), 0.92f),
        // 经幡 / 祠堂
        ["BannerRed"]   = new MatDef(new Color(0.55f, 0.12f, 0.10f), 0.7f, 0f,
                                      new Color(0.125f, 0.02f, 0.015f)),
        ["ShrineStone"] = new MatDef(new Color(0.24f, 0.22f, 0.20f), 0.85f),
        ["ShrineWood"]  = new MatDef(new Color(0.16f, 0.10f, 0.05f), 0.7f),
    };

    static string MatKey(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        int cut = name.IndexOf(" (Instance)");
        if (cut > 0) name = name.Substring(0, cut);
        return name;
    }

    void RemapMaterials(GameObject root)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null) shader = Shader.Find("Standard");
        if (shader == null)
        {
            Debug.LogWarning("[Valley] URP Lit Shader 未找到，保留 glTFast 默认材质");
            return;
        }

        if (_matCache == null) _matCache = new Dictionary<string, Material>();

        var renderers = root.GetComponentsInChildren<MeshRenderer>(true);
        int remapped = 0, baked = 0;
        foreach (var mr in renderers)
        {
            if (mr.sharedMaterial == null) continue;
            string key = MatKey(mr.sharedMaterial.name);
            if (!MAT_DEFS.TryGetValue(key, out var def)) continue;

            // PBR 烘焙材质已内嵌 albedo/normal/roughness 贴图 → 保留 glTFast 导入材质, 不覆盖成纯色
            if (mr.sharedMaterial.HasProperty("baseColorTexture") && mr.sharedMaterial.GetTexture("baseColorTexture") != null)
            { baked++; continue; }

            if (!_matCache.TryGetValue(key, out var mat))
            {
                mat = MakeMat(key, def, shader);
                _matCache[key] = mat;
            }
            mr.sharedMaterial = mat;
            remapped++;
        }
        Debug.Log($"[Valley] 🎨 材质重映射 {remapped} 个纯色, 保留 {baked} 个烘焙贴图材质 (共 {renderers.Length} 个 MeshRenderer)");
    }

    Material MakeMat(string name, MatDef def, Shader shader)
    {
        var mat = new Material(shader);
        mat.name = name;
        mat.SetColor("_BaseColor", def.color);
        if (mat.HasProperty("_Smoothness"))
            mat.SetFloat("_Smoothness", Mathf.Clamp01(1f - def.rough));
        if (mat.HasProperty("_Metallic"))
            mat.SetFloat("_Metallic", def.metallic);
        if (mat.HasProperty("_Surface"))
            mat.SetFloat("_Surface", 0); // Opaque

        if (def.emissive)
        {
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", def.emission);
            mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
        }
        return mat;
    }

    // ============================================================
    // Stones — 符文巨石 (复用 LobbyStone)
    // ============================================================

    void BuildStones()
    {
        var stoneMat = MakeMat("StoneBody", new MatDef(new Color(0.22f, 0.19f, 0.15f), 0.75f),
                               Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));

        var rune3DMat = MakeMat("Rune3D", new MatDef(new Color(0.25f, 0.22f, 0.2f), 0.6f, 0f,
                                                     new Color(0.4f, 0.2f, 0.05f) * 0.6f),
                                Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));

        // 3D 客户端只做追猎：仅保留「帷幕追猎」石头，2D 桌游入口已移除
        if (stone3DPrefab != null)
        {
            _stoneRight = Instantiate(stone3DPrefab, stone3DPos, Quaternion.identity, transform);
            _stoneRight.name = "Stone_3D";
            SetupStone(_stoneRight, LobbyStone.StoneType.ThreeDGame, "ChaseScene",
                       "帷幕追猎\n<size=50%>触碰进入</size>");
        }
        else
        {
            _stoneRight = BuildSingleStone("Stone_3D", stone3DPos, stoneHeight * 0.85f, stoneWidth * 0.85f,
                                           stoneMat, rune3DMat,
                                           "帷幕追猎\n<size=50%>触碰进入</size>",
                                           LobbyStone.StoneType.ThreeDGame, "ChaseScene",
                                           new Color(0.4f, 0.2f, 0.05f), 0.8f);
        }

        _stoneLeftScript = _stoneLeft != null ? _stoneLeft.GetComponent<LobbyStone>() : null;
        _stoneRightScript = _stoneRight != null ? _stoneRight.GetComponent<LobbyStone>() : null;
    }

    void SetupStone(GameObject stoneObj, LobbyStone.StoneType type, string targetScene, string label)
    {
        var col = stoneObj.GetComponent<Collider>();
        if (col == null)
        {
            var bc = stoneObj.AddComponent<BoxCollider>();
            bc.center = new Vector3(0, stoneHeight * 0.5f, 0);
            bc.size = new Vector3(stoneWidth * 1.5f, stoneHeight * 1.2f, 1.5f);
            bc.isTrigger = true;
        }
        else col.isTrigger = true;

        var stone = stoneObj.GetComponent<LobbyStone>();
        if (stone == null) stone = stoneObj.AddComponent<LobbyStone>();
        stone.stoneType = type;
        stone.targetSceneName = targetScene;
        stone.labelText = label;

        var lr = stoneObj.GetComponentInChildren<LineRenderer>();
        if (lr != null) stone.runeLines = lr;
    }

    GameObject BuildSingleStone(string name, Vector3 pos, float height, float width,
                                Material bodyMat, Material runeMat,
                                string label, LobbyStone.StoneType type, string targetScene,
                                Color pillarColor, float pillarIntensity)
    {
        var root = new GameObject(name);
        root.transform.SetParent(transform);
        root.transform.position = pos;

        var body = GameObject.CreatePrimitive(PrimitiveType.Cube);
        body.name = "Body";
        body.transform.SetParent(root.transform);
        body.transform.localPosition = new Vector3(0, height * 0.5f, 0);
        body.transform.localScale = new Vector3(width, height, 0.7f);
        body.GetComponent<MeshRenderer>().sharedMaterial = bodyMat;
        DestroySafe(body.GetComponent<Collider>());

        var face = GameObject.CreatePrimitive(PrimitiveType.Quad);
        face.name = "RuneFace";
        face.transform.SetParent(root.transform);
        face.transform.localPosition = new Vector3(0, height * 0.55f, -0.36f);
        face.transform.localScale = new Vector3(width * 0.65f, height * 0.55f, 1f);
        face.GetComponent<MeshRenderer>().sharedMaterial = runeMat;
        face.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        DestroySafe(face.GetComponent<Collider>());

        var col = root.AddComponent<BoxCollider>();
        col.center = new Vector3(0, height * 0.5f, 0);
        col.size = new Vector3(width * 1.5f, height * 1.2f, 1.5f);
        col.isTrigger = true;

        var labelObj = new GameObject("Label");
        labelObj.transform.SetParent(root.transform);
        labelObj.transform.localPosition = new Vector3(0, height + 0.4f, 0);
        var tm = labelObj.AddComponent<TextMesh>();
        tm.text = label;
        tm.fontSize = 48;
        tm.characterSize = 0.06f;
        tm.anchor = TextAnchor.MiddleCenter;
        tm.alignment = TextAlignment.Center;
        tm.color = Color.white;
        tm.richText = true;
        tm.fontStyle = FontStyle.Bold;

        var stone = root.AddComponent<LobbyStone>();
        stone.stoneType = type;
        stone.targetSceneName = targetScene;
        stone.labelText = label;

        BuildLightPillar(root, height + 2.5f, pillarColor, pillarIntensity);

        return root;
    }

    void BuildLightPillar(GameObject parent, float height, Color color, float intensity)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        go.name = "LightPillar";
        go.transform.SetParent(parent.transform);
        go.transform.localPosition = new Vector3(0, height, 0);
        go.transform.localScale = new Vector3(0.12f, 2.5f, 0.12f);
        var mat = MakeMat("PillarGlow", new MatDef(color, 0.1f, 0f, color * intensity),
                          Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
        go.GetComponent<MeshRenderer>().sharedMaterial = mat;
        DestroySafe(go.GetComponent<Collider>());

        var lightObj = new GameObject("PointLight");
        lightObj.transform.SetParent(go.transform);
        lightObj.transform.localPosition = Vector3.zero;
        var pt = lightObj.AddComponent<Light>();
        pt.type = LightType.Point;
        pt.color = color;
        pt.intensity = intensity;
        pt.range = 18f;
        pt.shadows = LightShadows.None;
        pt.renderMode = LightRenderMode.ForcePixel;
    }

    // ============================================================
    // Lighting — 月光方向光
    // ============================================================

    void BuildLighting()
    {
        var moon = new GameObject("MoonLight");
        moon.transform.SetParent(transform);
        var dl = moon.AddComponent<Light>();
        dl.type = LightType.Directional;
        dl.color = moonColor;
        dl.intensity = moonIntensity;
        dl.shadows = LightShadows.Soft;
        dl.shadowStrength = 0.3f;
        dl.shadowResolution = UnityEngine.Rendering.LightShadowResolution.FromQualitySettings;
        moon.transform.rotation = Quaternion.Euler(55f, -35f, 0f);
    }

    void DestroySafe(Object obj)
    {
        if (obj == null) return;
        if (Application.isPlaying) Destroy(obj);
        else DestroyImmediate(obj);
    }
}
