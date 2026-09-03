// ============================================================
// LobbySceneSetup.cs — 大厅场景构建器 v2
// Unity 2022.3 URP | 运行时即时生成 | 零预制体依赖
// ============================================================

using UnityEngine;
using System.Collections.Generic;

[ExecuteAlways]
public class LobbySceneSetup : MonoBehaviour
{
    [Header("══ 配置 ══")]
    [Tooltip("在 Start 时自动生成场景")]
    public bool buildOnStart = true;

    [Header("光照")]
    public Color fogColor = new Color(0.04f, 0.02f, 0.1f);
    public float fogStartDensity = 0.025f;  // 降低初始雾浓度
    public float fogEndDensity = 0.008f;
    public Color ambientColor = new Color(0.15f, 0.1f, 0.25f);  // 提高环境光

    [Header("巨石 — 优先用Prefab，为空则自动生成")]
    public GameObject stone2DPrefab;   // 拖入 Stone2D.prefab
    public GameObject stone3DPrefab;   // 拖入 Stone3D.prefab
    public Vector3 stone2DPos = new Vector3(-9f, 0f, 6f);
    public Vector3 stone3DPos = new Vector3(9f, 0f, 6f);
    public float stoneHeight = 5.5f;
    public float stoneWidth = 2.8f;

    [Header("山壁")]
    public float cliffRadius = 38f;
    public float cliffHeight = 14f;

    // Internal
    private GameObject _stoneLeft;
    private GameObject _stoneRight;
    private LobbyStone _stoneLeftScript;
    private LobbyStone _stoneRightScript;

    public GameObject StoneLeft  => _stoneLeft;
    public GameObject StoneRight => _stoneRight;
    public LobbyStone StoneLeftScript  => _stoneLeftScript;
    public LobbyStone StoneRightScript => _stoneRightScript;

    // ============================================================
    // Lifecycle
    // ============================================================

    void Start()
    {
        if (buildOnStart && Application.isPlaying)
            Build();
    }

    // ============================================================
    // Public Build API
    // ============================================================

    [ContextMenu("Build Lobby")]
    public void Build()
    {
        ClearChildren();
        ApplyEnvironment();
        BuildGround();
        BuildCliffs();
        BuildStones();
        BuildParticles();
        BuildLighting();
        Debug.Log("[Lobby] ✅ 场景构建完成");
    }

    void ClearChildren()
    {
        var list = new List<GameObject>();
        foreach (Transform t in transform)
            list.Add(t.gameObject);
        foreach (var go in list)
        {
            if (go != null)
            {
                if (Application.isPlaying) Destroy(go);
                else DestroyImmediate(go);
            }
        }
    }

    // ============================================================
    // Environment
    // ============================================================

    void ApplyEnvironment()
    {
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.ExponentialSquared;
        RenderSettings.fogDensity = fogStartDensity;
        RenderSettings.fogColor = fogColor;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = ambientColor;
        RenderSettings.ambientIntensity = 0.6f;  // 提高基础亮度
    }

    // ============================================================
    // Ground
    // ============================================================

    void BuildGround()
    {
        var go = NewChild("Ground");
        var mf = go.AddComponent<MeshFilter>();
        var mr = go.AddComponent<MeshRenderer>();

        // 手动构建一个大平面网格
        var mesh = new Mesh();
        float s = 50f;
        mesh.vertices = new[] {
            new Vector3(-s, 0, -s), new Vector3( s, 0, -s),
            new Vector3(-s, 0,  s), new Vector3( s, 0,  s)
        };
        mesh.triangles = new[] { 0, 2, 1, 2, 3, 1 };
        mesh.RecalculateNormals();
        mf.sharedMesh = mesh;

        mr.sharedMaterial = MakeMat("Ground", new Color(0.06f, 0.05f, 0.04f), 0.95f, 0f);

        var mc = go.AddComponent<MeshCollider>();
        mc.sharedMesh = mesh;
    }

    // ============================================================
    // Cliffs — 环形石壁
    // ============================================================

    void BuildCliffs()
    {
        var parent = NewChild("Cliffs");
        var mat = MakeMat("CliffRock", new Color(0.13f, 0.11f, 0.09f), 0.9f, 0f);

        int count = 20;
        for (int i = 0; i < count; i++)
        {
            float angle = (i / (float)count) * Mathf.PI * 2f;
            float gap = 0.7f + (i % 3) * 0.5f;
            float r = cliffRadius + Random.Range(-2f, 2f);
            float h = cliffHeight + Random.Range(-3f, 3f);

            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = $"Wall_{i}";
            wall.transform.SetParent(parent.transform);
            wall.transform.position = new Vector3(
                Mathf.Cos(angle) * r, h * 0.5f, Mathf.Sin(angle) * r
            );
            wall.transform.localScale = new Vector3(gap * 5f, h, 2.5f);
            wall.transform.LookAt(new Vector3(0, h * 0.5f, 0));
            wall.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }
    }

    // ============================================================
    // Stones — 符文巨石
    // ============================================================

    void BuildStones()
    {
        var stoneMat  = MakeMat("StoneBody",  new Color(0.22f, 0.19f, 0.15f), 0.75f, 0f);

        var rune2DMat = MakeMat("Rune2D", Color.white, 0.2f, 0f);
        rune2DMat.EnableKeyword("_EMISSION");
        rune2DMat.SetColor("_EmissionColor", new Color(0.15f, 0.7f, 1.0f) * 3f);
        rune2DMat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;

        var rune3DMat = MakeMat("Rune3D", new Color(0.25f, 0.22f, 0.2f), 0.6f, 0f);
        rune3DMat.EnableKeyword("_EMISSION");
        rune3DMat.SetColor("_EmissionColor", new Color(0.4f, 0.2f, 0.05f) * 0.6f);
        rune3DMat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;

        // 左侧 — 2D桌游入口（优先用 Prefab）
        if (stone2DPrefab != null)
        {
            _stoneLeft = Instantiate(stone2DPrefab, stone2DPos, Quaternion.identity, transform);
            _stoneLeft.name = "Stone_2D";
            SetupStoneComponent(_stoneLeft, LobbyStone.StoneType.TwoDGame, "MainScene",
                                "古老桌游\n<size=50%>触碰进入</size>");
        }
        else
        {
            _stoneLeft = BuildSingleStone("Stone_2D", stone2DPos, stoneHeight, stoneWidth,
                                           stoneMat, rune2DMat,
                                           "古老桌游\n<size=50%>触碰进入</size>",
                                           LobbyStone.StoneType.TwoDGame, "MainScene",
                                           new Color(0.15f, 0.7f, 1.0f), 4f);
        }

        // 右侧 — 3D玩法入口(未开启)（优先用 Prefab）
        if (stone3DPrefab != null)
        {
            _stoneRight = Instantiate(stone3DPrefab, stone3DPos, Quaternion.identity, transform);
            _stoneRight.name = "Stone_3D";
            SetupStoneComponent(_stoneRight, LobbyStone.StoneType.ThreeDGame, "",
                                "帷幕之地\n<size=45%><color=#999>—— 尚未开启 ——</color></size>");
        }
        else
        {
            _stoneRight = BuildSingleStone("Stone_3D", stone3DPos, stoneHeight * 0.85f, stoneWidth * 0.85f,
                                            stoneMat, rune3DMat,
                                            "帷幕之地\n<size=45%><color=#999>—— 尚未开启 ——</color></size>",
                                            LobbyStone.StoneType.ThreeDGame, "",
                                            new Color(0.4f, 0.2f, 0.05f), 0.8f);
        }

        _stoneLeftScript  = _stoneLeft.GetComponent<LobbyStone>();
        _stoneRightScript = _stoneRight.GetComponent<LobbyStone>();
    }

    GameObject BuildSingleStone(string name, Vector3 pos, float height, float width,
                                 Material bodyMat, Material runeMat,
                                 string label, LobbyStone.StoneType type, string targetScene,
                                 Color pillarColor, float pillarIntensity)
    {
        var root = NewChild(name);
        root.transform.position = pos;

        // 主体
        var body = GameObject.CreatePrimitive(PrimitiveType.Cube);
        body.name = "Body";
        body.transform.SetParent(root.transform);
        body.transform.localPosition = new Vector3(0, height * 0.5f, 0);
        body.transform.localScale = new Vector3(width, height, 0.7f);
        body.GetComponent<MeshRenderer>().sharedMaterial = bodyMat;
        DestroySafe(body.GetComponent<Collider>());

        // 符文面板 (Quad 贴在正面)
        var face = GameObject.CreatePrimitive(PrimitiveType.Quad);
        face.name = "RuneFace";
        face.transform.SetParent(root.transform);
        face.transform.localPosition = new Vector3(0, height * 0.55f, -0.36f);
        face.transform.localScale = new Vector3(width * 0.65f, height * 0.55f, 1f);
        face.GetComponent<MeshRenderer>().sharedMaterial = runeMat;
        face.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        DestroySafe(face.GetComponent<Collider>());

        // 符文光线
        var lines = new GameObject("RuneLines");
        lines.transform.SetParent(root.transform);
        var lr = lines.AddComponent<LineRenderer>();
        lr.material = runeMat;
        lr.startWidth = 0.04f;
        lr.endWidth = 0.04f;
        lr.useWorldSpace = false;
        lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        lr.receiveShadows = false;

        float hw = width * 0.28f;
        float hh = height * 0.43f;
        lr.positionCount = 8;
        lr.SetPosition(0, new Vector3(-hw, -hh, -0.37f));
        lr.SetPosition(1, new Vector3(  0,  hh, -0.37f));
        lr.SetPosition(2, new Vector3( hw, -hh, -0.37f));
        lr.SetPosition(3, new Vector3(  0,   0, -0.37f));
        lr.SetPosition(4, new Vector3(-hw, -hh, -0.37f));
        lr.SetPosition(5, new Vector3(  0, -hh * 1.4f, -0.37f));
        lr.SetPosition(6, new Vector3( hw, -hh, -0.37f));
        lr.SetPosition(7, new Vector3(  0,   0, -0.37f));

        // 触发器碰撞体
        var col = root.AddComponent<BoxCollider>();
        col.center = new Vector3(0, height * 0.5f, 0);
        col.size = new Vector3(width * 1.5f, height * 1.2f, 1.5f);
        col.isTrigger = true;

        // 标签 (使用 TextMesh 避免 TMP 依赖)
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

        // LobbyStone 脚本
        var stone = root.AddComponent<LobbyStone>();
        stone.stoneType = type;
        stone.targetSceneName = targetScene;
        stone.labelText = label;
        stone.runeLines = lr;

        // 光柱
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
        var mat = MakeMat("PillarGlow", color, 0.1f, 0f);
        mat.EnableKeyword("_EMISSION");
        mat.SetColor("_EmissionColor", color * intensity);
        mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
        go.GetComponent<MeshRenderer>().sharedMaterial = mat;
        DestroySafe(go.GetComponent<Collider>());

        // 点光源
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
    // Particles — 萤火虫粒子
    // ============================================================

    void BuildParticles()
    {
        var go = NewChild("Fireflies");
        go.transform.position = new Vector3(0, 3, 0);

        var ps = go.AddComponent<ParticleSystem>();
        // 先停止系统再配置，避免运行时警告
        ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);

        var main = ps.main;
        main.duration = 10f;
        main.loop = true;
        main.startLifetime = new ParticleSystem.MinMaxCurve(3f, 9f);
        main.startSpeed = new ParticleSystem.MinMaxCurve(0.1f, 0.6f);
        main.startSize = new ParticleSystem.MinMaxCurve(0.02f, 0.08f);
        main.startColor = new ParticleSystem.MinMaxGradient(
            new Color(0.2f, 0.6f, 1f, 0.7f),
            new Color(0.05f, 0.2f, 0.5f, 0.1f)
        );
        main.maxParticles = 150;

        var emission = ps.emission;
        emission.rateOverTime = 12;

        var shape = ps.shape;
        shape.shapeType = ParticleSystemShapeType.Box;
        shape.scale = new Vector3(45, 12, 45);

        var sizeOverLifetime = ps.sizeOverLifetime;
        sizeOverLifetime.enabled = true;
        var curve = new AnimationCurve(
            new Keyframe(0, 0.05f), new Keyframe(0.5f, 1f), new Keyframe(1, 0f)
        );
        sizeOverLifetime.size = new ParticleSystem.MinMaxCurve(1f, curve);

        // 粒子材质
        var pm = new Material(Shader.Find("Universal Render Pipeline/Particles/Unlit"));
        if (pm == null) pm = new Material(Shader.Find("Particles/Standard Unlit"));
        if (pm == null) pm = new Material(Shader.Find("Standard"));
        if (pm != null)
        {
            pm.SetColor("_BaseColor", new Color(0.3f, 0.7f, 1f, 1f));
            pm.SetColor("_Color", new Color(0.3f, 0.7f, 1f, 1f));
        }
        ps.GetComponent<ParticleSystemRenderer>().sharedMaterial = pm;
    }

    // ============================================================
    // Lighting
    // ============================================================

    void BuildLighting()
    {
        // 方向光 — 月光模拟
        var moon = NewChild("MoonLight");
        var dl = moon.AddComponent<Light>();
        dl.type = LightType.Directional;
        dl.color = new Color(0.5f, 0.55f, 0.9f);
        dl.intensity = 1.2f;  // 提高亮度
        dl.shadows = LightShadows.Soft;
        dl.shadowStrength = 0.3f;
        dl.shadowResolution = UnityEngine.Rendering.LightShadowResolution.FromQualitySettings;
        moon.transform.rotation = Quaternion.Euler(55f, -35f, 0f);
    }

    void SetupStoneComponent(GameObject stoneObj, LobbyStone.StoneType type,
                              string targetScene, string label)
    {
        // 确保有碰撞体
        var col = stoneObj.GetComponent<Collider>();
        if (col == null)
        {
            var bc = stoneObj.AddComponent<BoxCollider>();
            bc.center = new Vector3(0, stoneHeight * 0.5f, 0);
            bc.size = new Vector3(stoneWidth * 1.5f, stoneHeight * 1.2f, 1.5f);
            bc.isTrigger = true;
        }
        else
            col.isTrigger = true;

        // 添加或获取 LobbyStone
        var stone = stoneObj.GetComponent<LobbyStone>();
        if (stone == null)
            stone = stoneObj.AddComponent<LobbyStone>();

        stone.stoneType = type;
        stone.targetSceneName = targetScene;
        stone.labelText = label;

        // 查找子节点的 LineRenderer（RuneLines）
        var lr = stoneObj.GetComponentInChildren<LineRenderer>();
        if (lr != null)
            stone.runeLines = lr;

        // 给 Body 子节点添加碰撞（用于射线检测选中）
        foreach (Transform child in stoneObj.transform)
        {
            if (child.name.ToLower().Contains("body"))
            {
                var bodyCol = child.gameObject.GetComponent<MeshCollider>();
                if (bodyCol == null)
                {
                    bodyCol = child.gameObject.AddComponent<MeshCollider>();
                }
            }
        }
    }

    // ============================================================
    // Helpers
    // ============================================================

    GameObject NewChild(string name)
    {
        var go = new GameObject(name);
        go.transform.SetParent(transform);
        return go;
    }

    void DestroySafe(Object obj)
    {
        if (obj == null) return;
        if (Application.isPlaying) Destroy(obj);
        else DestroyImmediate(obj);
    }

    Material MakeMat(string name, Color color, float roughness, float metallic)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null) shader = Shader.Find("Standard");
        var mat = new Material(shader);
        mat.name = name;
        mat.color = color;
        if (mat.HasProperty("_Smoothness"))
            mat.SetFloat("_Smoothness", Mathf.Clamp01(1f - roughness));
        if (mat.HasProperty("_Metallic"))
            mat.SetFloat("_Metallic", metallic);
        if (mat.HasProperty("_Surface"))
            mat.SetFloat("_Surface", 0); // Opaque
        return mat;
    }
}
