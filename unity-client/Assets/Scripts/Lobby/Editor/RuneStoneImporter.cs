// ============================================================
// RuneStoneImporter.cs — 一键导入符文巨石
// 菜单: Tools → Setup Rune Stones
// 自动: 创建URP材质 → 分配给FBX → 生成Prefab
// ============================================================

using UnityEngine;
using UnityEditor;
using System.IO;

public class RuneStoneImporter
{
    const string FBX_PATH = "Assets/Models/RuneStones";
    const string MAT_PATH = "Assets/Models/RuneStones/Materials";
    const string PREFAB_PATH = "Assets/Models/RuneStones/Prefabs";

    [MenuItem("Tools/Setup Rune Stones")]
    public static void Setup()
    {
        // 确保目录存在
        EnsureDir(MAT_PATH);
        EnsureDir(PREFAB_PATH);

        // 找到 URP Lit Shader
        var shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null)
        {
            Debug.LogError("[RuneStone] URP Lit Shader 未找到！请确认 URP 已正确配置。");
            return;
        }

        // 配置两个石头
        SetupStone("Stone2D",
            stoneColor: new Color(0.22f, 0.19f, 0.15f),
            stoneRoughness: 0.75f,
            runeEmissionColor: new Color(0.15f, 0.7f, 1.0f),
            runeEmissionStrength: 3.0f);

        SetupStone("Stone3D",
            stoneColor: new Color(0.18f, 0.16f, 0.12f),
            stoneRoughness: 0.85f,
            runeEmissionColor: new Color(0.4f, 0.2f, 0.05f),
            runeEmissionStrength: 0.6f);

        AssetDatabase.Refresh();

        Debug.Log("═══════════════════════════════");
        Debug.Log("  ✅ 符文巨石导入完成！");
        Debug.Log($"  📁 {PREFAB_PATH}/");
        Debug.Log("  ⚡ Body=岩石材质 | Rune=发光符文");
        Debug.Log("═══════════════════════════════");
    }

    static void SetupStone(string name, Color stoneColor, float stoneRoughness,
                           Color runeEmissionColor, float runeEmissionStrength)
    {
        var shader = Shader.Find("Universal Render Pipeline/Lit");

        // --- FBX 导入设置 ---
        string fbxPath = $"{FBX_PATH}/{name}.fbx";
        var importer = AssetImporter.GetAtPath(fbxPath) as ModelImporter;
        if (importer == null)
        {
            Debug.LogWarning($"[RuneStone] 未找到 {fbxPath}，跳过。");
            return;
        }

        // 不要让 Unity 自动创建材质，我们手动创建
        importer.materialImportMode = ModelImporterMaterialImportMode.None;
        importer.SaveAndReimport();

        // --- 创建材质 ---
        // Body 材质
        var bodyMat = CreateMaterial($"{name}_Body", shader, stoneColor,
                                      stoneRoughness, 0f, Color.black, 0f);
        // Rune 材质（发光!）
        var runeMat = CreateMaterial($"{name}_Rune", shader, Color.white,
                                      0.3f, 0f, runeEmissionColor, runeEmissionStrength);

        // --- 配置 FBX 的材质引用 ---
        // FBX 包含两个子网格: Body + Rune
        // 它们的材质槽顺序和 Blender 导出顺序一致
        string assetPath = fbxPath;
        var meshAsset = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
        if (meshAsset == null)
        {
            Debug.LogWarning($"[RuneStone] 无法加载 {assetPath}");
            return;
        }

        // 实例化以便编辑
        var instance = (GameObject)PrefabUtility.InstantiatePrefab(meshAsset);
        if (instance == null)
        {
            // 如果不是prefab，直接copy
            instance = Object.Instantiate(meshAsset);
        }

        var renderers = instance.GetComponentsInChildren<MeshRenderer>();
        Debug.Log($"[RuneStone] {name}: 找到 {renderers.Length} 个 MeshRenderer");

        foreach (var mr in renderers)
        {
            string childName = mr.gameObject.name.ToLower();
            if (childName.Contains("rune"))
            {
                mr.sharedMaterial = runeMat;
                Debug.Log($"  {mr.gameObject.name} → Rune (发光)");
            }
            else
            {
                mr.sharedMaterial = bodyMat;
                Debug.Log($"  {mr.gameObject.name} → Body (岩石)");
            }
        }

        // --- 保存为 Prefab ---
        string prefabPath = $"{PREFAB_PATH}/{name}.prefab";
        // 直接覆盖
        PrefabUtility.SaveAsPrefabAsset(instance, prefabPath);
        Object.DestroyImmediate(instance);

        Debug.Log($"  ✅ Prefab: {prefabPath}");
    }

    static Material CreateMaterial(string name, Shader shader,
                                    Color baseColor, float roughness, float metallic,
                                    Color emissionColor, float emissionStrength)
    {
        string matPath = $"{MAT_PATH}/{name}.mat";

        // 删除旧材质（如果存在）
        if (File.Exists(matPath))
            AssetDatabase.DeleteAsset(matPath);

        var mat = new Material(shader);
        mat.name = name;

        // URP Lit 属性
        mat.SetColor("_BaseColor", baseColor);
        mat.SetFloat("_Smoothness", 1f - roughness);
        mat.SetFloat("_Metallic", metallic);
        mat.SetFloat("_Surface", 0); // Opaque

        // 发光
        if (emissionStrength > 0)
        {
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", emissionColor * emissionStrength);
            mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
        }

        AssetDatabase.CreateAsset(mat, matPath);
        return mat;
    }

    static void EnsureDir(string path)
    {
        string fullPath = Path.Combine(Application.dataPath, path.Substring("Assets/".Length));
        if (!Directory.Exists(fullPath))
            Directory.CreateDirectory(fullPath);
    }
}
