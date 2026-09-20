// ============================================================
// ExplorationSceneSetup.cs — 探索图·暮色聚落场景构建器
// 实例化 Blender 导出的 Exploration.glb + 材质重映射 + 暮色打光/雾
//
// 坐标对齐 (Blender Z-up → Unity Y-up): (x,y,z) → (x, z, -y)
//   - 探索图原点(中央枯树广场) = Unity (0,0,0)，无需偏移
//   - 地标: 水井(-5,-8) / 铁匠铺(10,5) / 观测塔(36,-30) / 墓地(0,48)
//
// 对应「帷幕追猎」P0 玩法地图 (150×150 暮色聚落)
// ============================================================

using UnityEngine;
using System.Collections.Generic;

[ExecuteAlways]
public class ExplorationSceneSetup : MonoBehaviour
{
    [Header("══ 探索图模型 ══")]
    public GameObject explorationPrefab;                     // Exploration.glb
    public Vector3 explorationPosition = Vector3.zero;       // 原点=中央广场
    public bool remapMaterials = true;                       // GLB 材质 → URP Lit

    [Header("══ 暮色光照 ══")]
    public Color fogColor = new Color(0.02f, 0.03f, 0.08f);
    public float fogDensity = 0.008f;                        // 150×150 较大, 雾稍淡
    public Color ambientColor = new Color(0.06f, 0.07f, 0.12f);
    public float ambientIntensity = 1.0f;
    public Color moonColor = new Color(0.38f, 0.42f, 0.66f);
    public float moonIntensity = 0.9f;                       // 更暗, 压抑

    [Header("══ 构建 ══")]
    public bool buildOnStart = true;

    private GameObject _exploration;
    private static Dictionary<string, Material> _matCache;

    public GameObject Exploration => _exploration;

    // ============================================================
    // Lifecycle
    // ============================================================

    void Start()
    {
        if (buildOnStart && Application.isPlaying)
            Build();
    }

    [ContextMenu("Build Exploration Scene")]
    public void Build()
    {
        ClearChildren();
        ApplyEnvironment();
        BuildExploration();
        BuildLighting();
        Debug.Log("[Exploration] ✅ 暮色聚落构建完成");
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
    // Exploration
    // ============================================================

    void BuildExploration()
    {
        if (explorationPrefab == null)
        {
            Debug.LogWarning("[Exploration] ⚠️ explorationPrefab 未设置！请拖入 Exploration.glb，或运行 Tools → Create Exploration Scene");
            return;
        }

        _exploration = Instantiate(explorationPrefab, explorationPosition, Quaternion.identity, transform);
        _exploration.name = "Exploration";

        if (remapMaterials)
            RemapMaterials(_exploration);
    }

    // ============================================================
    // Materials — GLB 材质名 → URP Lit 重建 (与 make_palette 一一对应)
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
        // 暖光 (自发光) — 铁匠铺炉膛/灯笼/符文石板
        ["WindowGlow"]  = new MatDef(new Color(0.95f, 0.62f, 0.28f), 0.3f, 0f,
                                      new Color(5.0f, 2.75f, 0.9f)),
        ["LanternPaper"]= new MatDef(new Color(0.95f, 0.52f, 0.16f), 0.3f, 0f,
                                      new Color(6.0f, 3.0f, 0.84f)),
        ["LanternFrame"]= new MatDef(new Color(0.16f, 0.11f, 0.06f), 0.7f),
        ["LanternMetal"]= new MatDef(new Color(0.20f, 0.19f, 0.18f), 0.5f, 0.6f),
        // 桃花 (探索图不用, 保留兼容)
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
        // 经幡 / 祠堂石
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
            Debug.LogWarning("[Exploration] URP Lit Shader 未找到，保留 glTFast 默认材质");
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
        Debug.Log($"[Exploration] 🎨 材质重映射 {remapped} 个纯色, 保留 {baked} 个烘焙贴图材质 (共 {renderers.Length} 个 MeshRenderer)");
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
    // Lighting — 冷月方向光 (暮色/压抑)
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
        dl.shadowStrength = 0.35f;
        dl.shadowResolution = UnityEngine.Rendering.LightShadowResolution.FromQualitySettings;
        moon.transform.rotation = Quaternion.Euler(58f, -32f, 0f);

        // 广场/铁匠铺暖光点光源 (自发光表面不照亮周围, 补局部暖光)
        AddPointLight("PlazaLantern", new Vector3(0f, 3f, 0f), new Color(1f, 0.62f, 0.32f), 2.5f, 18f);
        AddPointLight("ForgeGlow", new Vector3(10f, 1.5f, -5f), new Color(1f, 0.5f, 0.2f), 3.5f, 16f);
        AddPointLight("TowerGlow", new Vector3(36f, 12f, 30f), new Color(1f, 0.6f, 0.3f), 2.5f, 16f);
    }

    void AddPointLight(string name, Vector3 pos, Color color, float intensity, float range)
    {
        var go = new GameObject(name);
        go.transform.SetParent(transform);
        go.transform.position = pos;
        var pt = go.AddComponent<Light>();
        pt.type = LightType.Point;
        pt.color = color;
        pt.intensity = intensity;
        pt.range = range;
        pt.shadows = LightShadows.None;
        pt.renderMode = LightRenderMode.ForcePixel;
    }
}
