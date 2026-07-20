// ============================================================
// CharacterQAValidator.cs — 商业级角色质量检查
// Tools → Werewolf → QA Validate All Characters
// 检查: 面数/LOD/材质/骨骼/UV/命名规范
// ============================================================

using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.Linq;

public class CharacterQAValidator : EditorWindow
{
    private static readonly (string name, int maxTris, int maxBones)[] SPECS = {
        ("SIGURD", 25000, 65), ("FREYJA", 22000, 65), ("MORRIGAN", 23000, 65),
        ("ANUBIS_ACOLYTE", 24000, 65), ("HECTOR", 27000, 65), ("ROMULUS", 23000, 65),
        ("FENRIR_KIN", 28000, 65), ("SKADI", 23000, 65), ("HAIKU_MONK", 20000, 65),
        ("BRIGID", 21000, 65), ("YSERA", 21000, 65), ("GOREN", 26000, 65),
        ("AILIN", 22000, 65), ("ORIC", 22000, 65), ("NELIA", 21000, 65),
    };

    private Vector2 scrollPos;

    [MenuItem("Tools/Werewolf/QA Validate All Characters")]
    public static void ValidateAll()
    {
        var window = GetWindow<CharacterQAValidator>("Character QA");
        window.Show();
    }

    void OnGUI()
    {
        GUILayout.Label("商业级角色质量检查", EditorStyles.boldLabel);
        GUILayout.Space(10);

        if (GUILayout.Button("Run Full QA Check", GUILayout.Height(40)))
        {
            RunQACheck();
        }

        scrollPos = GUILayout.BeginScrollView(scrollPos);
        if (results != null)
        {
            foreach (var r in results)
            {
                DrawResult(r);
            }
        }
        GUILayout.EndScrollView();
    }

    private List<QAResult> results;

    void RunQACheck()
    {
        results = new List<QAResult>();
        string charDir = "Assets/Models/Characters";

        foreach (var spec in SPECS)
        {
            var result = new QAResult { characterName = spec.name };
            string prefabPath = $"Assets/Prefabs/Characters/{spec.name}.prefab";
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);

            if (prefab == null)
            {
                result.errors.Add("Missing prefab");
                result.failed = true;
                results.Add(result);
                continue;
            }

            // 1. 面数检查
            var renderers = prefab.GetComponentsInChildren<SkinnedMeshRenderer>();
            int totalTris = 0;
            foreach (var r in renderers)
            {
                if (r.sharedMesh != null)
                    totalTris += r.sharedMesh.triangles.Length / 3;
            }
            result.totalTriangles = totalTris;
            if (totalTris > spec.maxTris * 1.2f)
                result.warnings.Add($"Triangles ({totalTris}) > budget ({spec.maxTris})");
            if (totalTris < spec.maxTris * 0.3f)
                result.warnings.Add($"Triangles ({totalTris}) too low for commercial quality");

            // 2. LOD 检查
            var lodGroup = prefab.GetComponent<LODGroup>();
            if (lodGroup == null)
                result.errors.Add("Missing LODGroup component");
            else
            {
                var lods = lodGroup.GetLODs();
                result.lodCount = lods.Length;
                if (lods.Length < 3)
                    result.errors.Add($"Only {lods.Length} LODs (need 4: 100/50/25/10%)");
            }

            // 3. 骨骼检查
            var animator = prefab.GetComponent<Animator>();
            if (animator == null || animator.avatar == null)
                result.errors.Add("Missing Animator/Avatar (Humanoid Rig)");
            else if (!animator.avatar.isHuman)
                result.errors.Add("Avatar is not Humanoid");

            // 4. 材质检查
            var mats = new HashSet<Material>();
            foreach (var r in renderers)
                foreach (var m in r.sharedMaterials)
                    if (m != null) mats.Add(m);

            result.materialCount = mats.Count;
            foreach (var mat in mats)
            {
                if (!mat.HasProperty("_BaseColor") && !mat.HasProperty("_Color"))
                    result.warnings.Add($"Material '{mat.name}' missing BaseColor property");
            }

            // 5. UV 检查
            foreach (var r in renderers)
            {
                if (r.sharedMesh != null && r.sharedMesh.uv.Length == 0)
                    result.errors.Add($"Mesh '{r.sharedMesh.name}' missing UV0");
            }

            // 6. 命名规范
            foreach (var r in renderers)
            {
                string meshName = r.sharedMesh?.name ?? "";
                if (!meshName.Contains(spec.name))
                    result.warnings.Add($"Mesh '{meshName}' not following naming convention");
            }

            results.Add(result);
        }

        int passed = results.Count(r => !r.failed);
        int warned = results.Count(r => r.warnings.Count > 0 && !r.failed);
        int failed = results.Count(r => r.failed);

        Debug.Log($"QA Complete: {passed} pass, {warned} warnings, {failed} fail");
    }

    void DrawResult(QAResult r)
    {
        Color bg = r.failed ? new Color(0.3f, 0.1f, 0.1f) :
                   r.warnings.Count > 0 ? new Color(0.3f, 0.3f, 0.1f) :
                   new Color(0.1f, 0.3f, 0.1f);

        var rect = EditorGUILayout.BeginVertical();
        EditorGUI.DrawRect(rect, bg);
        EditorGUILayout.Space(3);

        string icon = r.failed ? "❌" : r.warnings.Count > 0 ? "⚠️" : "✅";
        EditorGUILayout.LabelField($"{icon} {r.characterName}  |  {r.totalTriangles:N0} tris  |  {r.lodCount} LODs  |  {r.materialCount} mats",
            EditorStyles.boldLabel);

        foreach (var e in r.errors)
            EditorGUILayout.LabelField($"  ❌ {e}", EditorStyles.miniLabel);
        foreach (var w in r.warnings)
            EditorGUILayout.LabelField($"  ⚠️ {w}", EditorStyles.miniLabel);

        EditorGUILayout.Space(3);
        EditorGUILayout.EndVertical();
    }
}

public class QAResult
{
    public string characterName;
    public int totalTriangles;
    public int lodCount;
    public int materialCount;
    public bool failed;
    public List<string> errors = new();
    public List<string> warnings = new();
}

// ============================================================
// LODSetupTool.cs — 自动设置 LOD Group
// ============================================================
public class LODSetupTool : EditorWindow
{
    [MenuItem("Tools/Werewolf/Setup LOD Groups")]
    public static void SetupAllLODs()
    {
        string prefabDir = "Assets/Prefabs/Characters";
        var guids = AssetDatabase.FindAssets("t:Prefab", new[] { prefabDir });

        foreach (var guid in guids)
        {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null) continue;

            var instance = PrefabUtility.InstantiatePrefab(prefab) as GameObject;
            var renderers = instance.GetComponentsInChildren<SkinnedMeshRenderer>();

            var lodGroup = instance.GetComponent<LODGroup>();
            if (lodGroup == null) lodGroup = instance.AddComponent<LODGroup>();

            var lods = new LOD[4];
            // LOD0: 100% (all renderers)
            lods[0] = new LOD(0.5f, renderers);

            // LOD1: 50% (skip detailed accessories)
            lods[1] = new LOD(0.25f, renderers.Take(Mathf.Max(1, renderers.Length / 2)).ToArray());

            // LOD2: 25% (body only)
            var bodyR = renderers.Where(r => r.name.Contains("Body") || r.name.Contains("Mesh")).ToArray();
            lods[2] = new LOD(0.10f, bodyR.Length > 0 ? bodyR : renderers.Take(1).ToArray());

            // LOD3: 10% (simplest)
            lods[3] = new LOD(0.02f, renderers.Take(1).ToArray());

            lodGroup.SetLODs(lods);
            lodGroup.fadeMode = LODFadeMode.CrossFade;

            PrefabUtility.SaveAsPrefabAsset(instance, path);
            DestroyImmediate(instance);
        }
        Debug.Log("LOD Groups configured for all character prefabs");
    }
}
