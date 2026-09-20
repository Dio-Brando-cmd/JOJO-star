// ============================================================
// ExplorationSceneCreator.cs — 一键创建探索图·暮色聚落场景
// 菜单: Tools → Create Exploration Scene
// 生成 Exploration.glb + 暮色打光/雾 (无巨石, 无大厅 UI)
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.Collections.Generic;

public class ExplorationSceneCreator
{
    const string EXPLORATION_GLB = "Assets/Models/Environment/Exploration.glb";
    const string SCENE_PATH = "Assets/Scenes/ExplorationScene.unity";

    [MenuItem("Tools/Create Exploration Scene")]
    public static void Create()
    {
        // 1. 新场景
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // 2. ExplorationRoot + ExplorationSceneSetup
        var root = new GameObject("ExplorationRoot");
        var setup = root.AddComponent<ExplorationSceneSetup>();
        setup.buildOnStart = true;
        setup.remapMaterials = true;

        // 3. 加载探索图 GLB
        var exploration = AssetDatabase.LoadAssetAtPath<GameObject>(EXPLORATION_GLB);
        if (exploration != null)
        {
            setup.explorationPrefab = exploration;
            Debug.Log($"[Exploration] ✅ 使用 {EXPLORATION_GLB}");
        }
        else
        {
            Debug.LogError($"[Exploration] ❌ 找不到 {EXPLORATION_GLB}\n" +
                           "请确认 Exploration.glb 已由 glTFast 导入到 Assets/Models/Environment/");
        }

        // 4. MainCamera (俯瞰探索图全貌)
        var cam = new GameObject("MainCamera");
        cam.tag = "MainCamera";
        var cameraComp = cam.AddComponent<Camera>();
        cameraComp.clearFlags = CameraClearFlags.SolidColor;
        cameraComp.backgroundColor = new Color(0.02f, 0.01f, 0.06f); // 深蓝紫夜空
        cameraComp.fieldOfView = 45f;
        cameraComp.nearClipPlane = 0.1f;
        cameraComp.farClipPlane = 800f;
        cameraComp.allowHDR = true;
        cam.AddComponent<AudioListener>();
        cam.transform.position = new Vector3(0f, 55f, -45f);
        cam.transform.rotation = Quaternion.Euler(48f, 0f, 0f);

        // 5. EventSystem (备用)
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

        // 6. 立即构建场景
        setup.Build();

        // 7. 保存
        if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
            AssetDatabase.CreateFolder("Assets", "Scenes");
        EditorSceneManager.SaveScene(scene, SCENE_PATH);

        // 8. 加入 Build Settings
        AddToBuildSettings(SCENE_PATH);

        // 9. 选中 root
        Selection.activeGameObject = root;

        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  ✅ 探索图·暮色聚落场景创建完成！");
        Debug.Log($"  📁 {SCENE_PATH}");
        Debug.Log("  🎬 按 Play 俯瞰 150×150 暮色聚落");
        Debug.Log("  🗺️  地标: 枯树广场(0,0) 水井(-5,-8) 铁匠铺(10,5) 观测塔(36,-30) 墓地(0,48)");
        Debug.Log("═══════════════════════════════════════");
    }

    static void AddToBuildSettings(string scenePath)
    {
        var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        for (int i = 0; i < scenes.Count; i++)
            if (scenes[i].path == scenePath) return;

        scenes.Add(new EditorBuildSettingsScene(scenePath, true));
        EditorBuildSettings.scenes = scenes.ToArray();
        Debug.Log($"[Exploration] 场景已加入 Build Settings: {scenePath}");
    }
}
