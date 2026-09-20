// DungeonSceneBuilder.cs — 编辑器脚本: 一键搭建可玩的暗黑地牢场景
// 用法: Unity 菜单 Tools > Build Dungeon Scene, 或 batchmode -executeMethod DungeonSceneBuilder.Build
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.Collections.Generic;
using System.Linq;

public static class DungeonSceneBuilder
{
    const string FBX_PATH = "Assets/Models/Environment/DungeonMap.fbx";
    const string SCENE_PATH = "Assets/Scenes/DungeonScene.unity";
    const string TEX_DIR = "Assets/Textures/Dungeon/";

    [MenuItem("Tools/Build Dungeon Scene")]
    public static void Build()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // ===== 大气 / 光照 =====
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.12f, 0.13f, 0.18f);
        RenderSettings.fog = true;
        RenderSettings.fogColor = new Color(0.02f, 0.025f, 0.05f);
        RenderSettings.fogMode = FogMode.Exponential;
        RenderSettings.fogDensity = 0.012f;

        // ===== 地图 =====
        AssetDatabase.ImportAsset(FBX_PATH, ImportAssetOptions.ForceUpdate);
        var mapPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(FBX_PATH);
        if (mapPrefab == null)
        {
            Debug.LogError("[Dungeon] FBX not found: " + FBX_PATH);
            EditorSceneManager.SaveScene(scene, SCENE_PATH);
            return;
        }
        var map = (GameObject)PrefabUtility.InstantiatePrefab(mapPrefab);
        map.name = "DungeonMap";
        map.transform.position = Vector3.zero;
        map.transform.rotation = Quaternion.identity;
        map.transform.localScale = Vector3.one;

        // 碰撞体
        int colliderCount = 0;
        foreach (var mf in map.GetComponentsInChildren<MeshFilter>())
        {
            if (mf.sharedMesh == null) continue;
            if (mf.gameObject.GetComponent<MeshCollider>() == null)
            {
                var mc = mf.gameObject.AddComponent<MeshCollider>();
                mc.sharedMesh = mf.sharedMesh;
                colliderCount++;
            }
        }

        // 边界 (验证缩放用)
        var bounds = new Bounds();
        bool hasBounds = false;
        foreach (var r in map.GetComponentsInChildren<Renderer>())
        {
            if (!hasBounds) { bounds = r.bounds; hasBounds = true; }
            else bounds.Encapsulate(r.bounds);
        }
        if (hasBounds)
            Debug.Log($"[Dungeon] map bounds center={bounds.center} size={bounds.size}");
        Debug.Log("[Dungeon] colliders=" + colliderCount);

        ApplyMaterials(map);
        CreateLights();
        CreatePlayer();
        CreateProps();

        EditorSceneManager.SaveScene(scene, SCENE_PATH);
        Debug.Log("[Dungeon] scene saved: " + SCENE_PATH);
    }

    // ===== 材质 (按 Blender 材质名重映射) =====
    static Material GetMat(Dictionary<string, Material> cache, string rawName,
        Texture2D texGold, Texture2D texBanC, Texture2D texBanG)
    {
        string name = (rawName ?? "").Replace(" (Instance)", "").Trim();
        if (cache.TryGetValue(name, out var m)) return m;

        Color baseC = new Color(0.4f, 0.4f, 0.4f);
        Color? emis = null;
        Texture2D emisMap = null;
        float metallic = 0f;
        float smoothness = 0.45f;

        if (name.Contains("tap_crimson")) { baseC = new Color(0.18f, 0.05f, 0.06f); emisMap = texBanC; emis = new Color(1.3f, 1.3f, 1.3f); }
        else if (name.Contains("tap_gold")) { baseC = new Color(0.05f, 0.07f, 0.12f); emisMap = texBanG; emis = new Color(1.3f, 1.3f, 1.3f); }
        else if (name.Contains("rune")) { baseC = new Color(0.02f, 0.02f, 0.02f); emisMap = texGold; emis = new Color(1.5f, 1.5f, 1.5f); }
        else if (name.Contains("glow")) { baseC = new Color(0.02f, 0.02f, 0.02f); emis = new Color(1.0f, 0.5f, 0.15f) * 2.5f; }
        else if (name.Contains("flame")) { baseC = new Color(1.0f, 0.5f, 0.1f); emis = new Color(1.0f, 0.45f, 0.08f) * 3.0f; }
        else if (name.Contains("metal")) { baseC = new Color(0.16f, 0.16f, 0.18f); metallic = 0.85f; smoothness = 0.6f; }
        else if (name.Contains("wood")) { baseC = new Color(0.35f, 0.25f, 0.14f); smoothness = 0.35f; }
        else if (name.Contains("bone")) { baseC = new Color(0.62f, 0.58f, 0.50f); smoothness = 0.3f; }
        else if (name.Contains("floor")) { baseC = new Color(0.24f, 0.22f, 0.20f); }
        else if (name.Contains("wall")) { baseC = new Color(0.22f, 0.19f, 0.16f); }
        else if (name.Contains("pillar")) { baseC = new Color(0.24f, 0.21f, 0.18f); }
        else if (name.Contains("arch")) { baseC = new Color(0.28f, 0.24f, 0.20f); }
        else if (name.Contains("darkstone")) { baseC = new Color(0.16f, 0.14f, 0.12f); }
        else if (name.Contains("sarc") || name.Contains("altar") || name.Contains("throne")) { baseC = new Color(0.18f, 0.16f, 0.14f); }

        var shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null) shader = Shader.Find("Standard");
        var mat = new Material(shader);
        mat.name = name;

        if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", baseC);
        if (mat.HasProperty("_Color")) mat.SetColor("_Color", baseC);
        if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", metallic);
        if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);
        if (mat.HasProperty("_Glossiness")) mat.SetFloat("_Glossiness", smoothness);

        if (emis.HasValue)
        {
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", emis.Value);
            if (emisMap != null && mat.HasProperty("_EmissionMap")) mat.SetTexture("_EmissionMap", emisMap);
            mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
        }

        cache[name] = mat;
        return mat;
    }

    static void ApplyMaterials(GameObject map)
    {
        var texGold = AssetDatabase.LoadAssetAtPath<Texture2D>(TEX_DIR + "mandala_gold.png");
        var texBanC = AssetDatabase.LoadAssetAtPath<Texture2D>(TEX_DIR + "banner_crimson.png");
        var texBanG = AssetDatabase.LoadAssetAtPath<Texture2D>(TEX_DIR + "banner_gold.png");

        var cache = new Dictionary<string, Material>();
        int matCount = 0;
        foreach (var r in map.GetComponentsInChildren<Renderer>())
        {
            var mats = new Material[r.sharedMaterials.Length];
            for (int i = 0; i < r.sharedMaterials.Length; i++)
            {
                string n = r.sharedMaterials[i] != null ? r.sharedMaterials[i].name : "";
                mats[i] = GetMat(cache, n, texGold, texBanC, texBanG);
            }
            r.sharedMaterials = mats;
            matCount++;
        }
        Debug.Log("[Dungeon] materials applied to " + matCount + " renderers, " + cache.Count + " unique");
    }

    // ===== 灯光 =====
    static Vector3 B2U(float bx, float by, float bz) => new Vector3(bx, bz, -by);

    static void AddLight(GameObject root, Vector3 pos, float intensity, float range, Color color, bool shadows)
    {
        var go = new GameObject("TorchLight");
        go.transform.SetParent(root.transform);
        go.transform.position = pos;
        var l = go.AddComponent<Light>();
        l.type = LightType.Point;
        l.color = color;
        l.intensity = intensity;
        l.range = range;
        l.shadows = shadows ? LightShadows.Soft : LightShadows.None;
    }

    static void CreateLights()
    {
        var root = new GameObject("Lights");
        var warm = new Color(1.0f, 0.55f, 0.22f);
        var dim = new Color(0.75f, 0.55f, 0.4f);

        // 火盆 (大厅/王座厅, 带阴影)
        foreach (var cx in new float[] { 37.5f, 62.5f })
        {
            float cy = cx;
            AddLight(root, B2U(cx - 4, cy, 2.4f), 5f, 20f, warm, true);
            AddLight(root, B2U(cx + 4, cy, 2.4f), 5f, 20f, warm, true);
            AddLight(root, B2U(cx, cy - 4, 2.4f), 5f, 20f, warm, true);
            AddLight(root, B2U(cx, cy + 4, 2.4f), 5f, 20f, warm, true);
        }
        AddLight(root, B2U(82.5f, 82.5f, 2.4f), 5f, 20f, warm, true);
        AddLight(root, B2U(92.5f, 82.5f, 2.4f), 5f, 20f, warm, true);
        AddLight(root, B2U(82.5f, 92.5f, 2.4f), 5f, 20f, warm, true);
        AddLight(root, B2U(92.5f, 92.5f, 2.4f), 5f, 20f, warm, true);

        // 礼拜堂 (祭坛蜡烛 + 壁挂火炬)
        foreach (var (cx, cy) in new (float, float)[] { (62.5f, 37.5f), (37.5f, 62.5f) })
        {
            AddLight(root, B2U(cx, cy, 1.6f), 4f, 16f, warm, false);
            AddLight(root, B2U(cx - 6, cy, 2.2f), 3.5f, 14f, dim, false);
            AddLight(root, B2U(cx + 6, cy, 2.2f), 3.5f, 14f, dim, false);
        }

        // 墓室 (冷光)
        foreach (var (cx, cy) in new (float, float)[] { (87.5f, 12.5f), (87.5f, 37.5f), (12.5f, 62.5f) })
        {
            AddLight(root, B2U(cx, cy - 6, 2.2f), 3f, 14f, dim, false);
            AddLight(root, B2U(cx, cy + 6, 2.2f), 3f, 14f, dim, false);
        }

        // 储藏室
        foreach (var (cx, cy) in new (float, float)[] { (37.5f, 12.5f), (12.5f, 87.5f), (62.5f, 87.5f) })
        {
            AddLight(root, B2U(cx - 5, cy, 2.2f), 3f, 13f, dim, false);
            AddLight(root, B2U(cx + 5, cy, 2.2f), 3f, 13f, dim, false);
        }

        // 空房间 (微弱一盏, 避免全黑)
        foreach (var (cx, cy) in new (float, float)[] { (12.5f, 12.5f), (62.5f, 12.5f), (12.5f, 37.5f), (87.5f, 62.5f), (37.5f, 87.5f) })
        {
            AddLight(root, B2U(cx, cy, 2.2f), 1.8f, 11f, dim, false);
        }

        Debug.Log("[Dungeon] lights created: " + root.transform.childCount);
    }

    // ===== 玩家 =====
    static void CreatePlayer()
    {
        var player = new GameObject("Player");
        var cc = player.AddComponent<CharacterController>();
        cc.height = 1.8f;
        cc.radius = 0.4f;
        cc.center = new Vector3(0f, 0.9f, 0f);
        cc.stepOffset = 0.3f;

        var camGo = new GameObject("MainCamera");
        camGo.transform.SetParent(player.transform);
        camGo.transform.localPosition = new Vector3(0f, 1.6f, 0f);
        camGo.transform.localRotation = Quaternion.identity;

        var cam = camGo.AddComponent<Camera>();
        cam.tag = "MainCamera";
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.01f, 0.015f, 0.03f);
        cam.nearClipPlane = 0.05f;
        cam.farClipPlane = 200f;

        // URP 附加相机数据
        var urpType = System.Type.GetType("UnityEngine.Rendering.Universal.UniversalAdditionalCameraData, Unity.RenderPipelines.Universal.Runtime");
        if (urpType != null && camGo.GetComponent(urpType) == null)
            camGo.AddComponent(urpType);

        player.AddComponent<FirstPersonController>();
        player.transform.position = new Vector3(37.5f, 0.2f, -37.5f); // 大厅A中心
        Debug.Log("[Dungeon] player created at " + player.transform.position);
    }

    // ===== 道具 (芙蕾雅 + 符文石) =====
    static void CreateProps()
    {
        var root = new GameObject("Props");

        var freya = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Resources/Characters/Freyja_Animated.fbx");
        if (freya != null)
        {
            var f = (GameObject)PrefabUtility.InstantiatePrefab(freya);
            f.transform.SetParent(root.transform);
            f.transform.position = new Vector3(62.5f, 0f, -62.5f); // 大厅B
            Debug.Log("[Dungeon] freya placed");
        }
        else Debug.LogWarning("[Dungeon] freya model not found");

        var stone = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Models/RuneStones/Stone3D.fbx");
        if (stone != null)
        {
            var spots = new Vector3[] {
                new Vector3(83f, 0f, -83f),
                new Vector3(92f, 0f, -92f),
                new Vector3(83f, 0f, -92f),
                new Vector3(37.5f, 0f, -31f),
            };
            foreach (var s in spots)
            {
                var st = (GameObject)PrefabUtility.InstantiatePrefab(stone);
                st.transform.SetParent(root.transform);
                st.transform.position = s;
            }
            Debug.Log("[Dungeon] rune stones placed: " + spots.Length);
        }
        else Debug.LogWarning("[Dungeon] rune stone model not found");
    }
}
