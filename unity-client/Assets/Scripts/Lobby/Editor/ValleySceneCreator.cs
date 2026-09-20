// ============================================================
// ValleySceneCreator.cs — 一键创建桃花源山谷场景 (v3)
// 菜单: Tools → Create Valley Scene
// 生成 完整山谷 GLB + 符文巨石 + 镜头 intro + 打光/雾
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.Collections.Generic;

public class ValleySceneCreator
{
    const string VALLEY_GLB = "Assets/Models/Environment/Valley.glb";
    const string SCENE_PATH = "Assets/Scenes/ValleyScene.unity";

    [MenuItem("Tools/Create Valley Scene")]
    public static void Create()
    {
        // 1. 新场景
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // 2. LobbyRoot + ValleySceneSetup
        var root = new GameObject("LobbyRoot");
        var setup = root.AddComponent<ValleySceneSetup>();
        setup.buildOnStart = true;
        setup.remapMaterials = true;

        // 3. 加载山谷 GLB (glTFast 导入后可直接实例化)
        var valley = AssetDatabase.LoadAssetAtPath<GameObject>(VALLEY_GLB);
        if (valley != null)
        {
            setup.valleyPrefab = valley;
            Debug.Log($"[Valley] ✅ 使用 {VALLEY_GLB}");
        }
        else
        {
            Debug.LogError($"[Valley] ❌ 找不到 {VALLEY_GLB}\n" +
                           "请确认 Valley.glb 已由 glTFast 导入到 Assets/Models/Environment/");
        }

        // 4. 符文巨石 prefab (复用, 不烘焙进 GLB)
        var stone2D = AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/Models/RuneStones/Prefabs/Stone2D.prefab");
        var stone3D = AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/Models/RuneStones/Prefabs/Stone3D.prefab");
        if (stone2D != null) setup.stone2DPrefab = stone2D;
        else Debug.LogWarning("[Valley] ⚠️ Stone2D.prefab 未找到，用自动生成方块代替。请先运行 Tools → Setup Rune Stones");
        if (stone3D != null) setup.stone3DPrefab = stone3D;
        else Debug.LogWarning("[Valley] ⚠️ Stone3D.prefab 未找到，用自动生成方块代替。请先运行 Tools → Setup Rune Stones");

        // 5. LobbyManager
        var mgr = new GameObject("LobbyManager");
        var manager = mgr.AddComponent<LobbyManager>();
        manager.valleySetup = setup;

        // 6. MainCamera + CameraIntro
        var cam = new GameObject("MainCamera");
        cam.tag = "MainCamera";
        var cameraComp = cam.AddComponent<Camera>();
        cameraComp.clearFlags = CameraClearFlags.SolidColor;
        cameraComp.backgroundColor = new Color(0.02f, 0.01f, 0.06f); // 深蓝紫夜空
        cameraComp.fieldOfView = 40f;
        cameraComp.nearClipPlane = 0.1f;
        cameraComp.farClipPlane = 600f;
        cameraComp.allowHDR = true;
        cam.AddComponent<AudioListener>();

        var intro = cam.AddComponent<LobbyCameraIntro>();
        intro.playOnStart = true;
        intro.autoCreatePath = true;
        intro.totalDuration = 12f; // 山谷更大, 镜头稍缓
        manager.cameraIntro = intro;

        // 7. EventSystem (UI 交互必需)
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

        // 8. 立即构建场景
        setup.Build();

        // 9. 保存
        if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
            AssetDatabase.CreateFolder("Assets", "Scenes");
        EditorSceneManager.SaveScene(scene, SCENE_PATH);

        // 10. 加入 Build Settings
        AddToBuildSettings(SCENE_PATH);

        // 11. 选中 root
        Selection.activeGameObject = root;

        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  ✅ 桃花源山谷场景创建完成！");
        Debug.Log($"  📁 {SCENE_PATH}");
        Debug.Log("  🎬 按 Play 预览 暗穴 → 豁然开朗 镜头");
        Debug.Log("  ⌨️  空格跳过动画");
        Debug.Log("═══════════════════════════════════════");
    }

    static void AddToBuildSettings(string scenePath)
    {
        var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        for (int i = 0; i < scenes.Count; i++)
            if (scenes[i].path == scenePath) return;

        scenes.Add(new EditorBuildSettingsScene(scenePath, true));
        EditorBuildSettings.scenes = scenes.ToArray();
        Debug.Log($"[Valley] 场景已加入 Build Settings: {scenePath}");
    }
}
