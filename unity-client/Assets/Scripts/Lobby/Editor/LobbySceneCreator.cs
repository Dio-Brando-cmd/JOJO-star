// ============================================================
// LobbySceneCreator.cs — 一键创建大厅场景
// 菜单: Tools → Create Lobby Scene
// 生成完整的 桃花源大厅，包括场景、摄像机和所有脚本
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.Collections.Generic;

public class LobbySceneCreator
{
    [MenuItem("Tools/Create Lobby Scene")]
    public static void Create()
    {
        // 1. 新场景
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // 2. LobbyRoot + SceneSetup
        var root = new GameObject("LobbyRoot");
        var setup = root.AddComponent<LobbySceneSetup>();
        setup.buildOnStart = true;

        // 3. LobbyManager
        var mgr = new GameObject("LobbyManager");
        var manager = mgr.AddComponent<LobbyManager>();
        manager.sceneSetup = setup;

        // 4. MainCamera + CameraIntro
        var cam = new GameObject("MainCamera");
        cam.tag = "MainCamera";
        var cameraComp = cam.AddComponent<Camera>();
        // 用纯色背景，避免黑色天空盒
        cameraComp.clearFlags = CameraClearFlags.SolidColor;
        cameraComp.backgroundColor = new Color(0.02f, 0.01f, 0.06f); // 深蓝紫色
        cameraComp.fieldOfView = 40f;
        cameraComp.nearClipPlane = 0.1f;
        cameraComp.farClipPlane = 600f;
        cameraComp.allowHDR = true;
        cam.AddComponent<AudioListener>();

        var intro = cam.AddComponent<LobbyCameraIntro>();
        intro.playOnStart = true;
        intro.autoCreatePath = true;
        intro.totalDuration = 10f;

        manager.cameraIntro = intro;

        // 5. EventSystem (UI 交互必需)
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

        // 6. 尝试加载 Stone Prefabs
        AssetDatabase.Refresh();
        var stone2D = AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/Models/RuneStones/Prefabs/Stone2D.prefab");
        var stone3D = AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/Models/RuneStones/Prefabs/Stone3D.prefab");

        if (stone2D != null)
        {
            setup.stone2DPrefab = stone2D;
            Debug.Log("[Lobby] ✅ 使用 Stone2D Prefab");
        }
        else
            Debug.LogWarning("[Lobby] ⚠️ Stone2D.prefab 未找到，先用方块代替。请先运行 Tools → Setup Rune Stones");

        if (stone3D != null)
        {
            setup.stone3DPrefab = stone3D;
            Debug.Log("[Lobby] ✅ 使用 Stone3D Prefab");
        }
        else
            Debug.LogWarning("[Lobby] ⚠️ Stone3D.prefab 未找到，先用方块代替。请先运行 Tools → Setup Rune Stones");

        // 7. 立即构建场景
        setup.Build();

        // 7. 保存
        string path = "Assets/Scenes/LobbyScene.unity";
        // 确保目录存在
        if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
            AssetDatabase.CreateFolder("Assets", "Scenes");

        EditorSceneManager.SaveScene(scene, path);

        // 8. 加入 Build Settings
        AddToBuildSettings(path);

        // 9. 选中 root 方便查看
        Selection.activeGameObject = root;

        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  ✅ 大厅场景创建完成！");
        Debug.Log($"  📁 {path}");
        Debug.Log("  🎬 按 Play 预览桃花源镜头");
        Debug.Log("  ⌨️  空格跳过动画");
        Debug.Log("═══════════════════════════════════════");
    }

    static void AddToBuildSettings(string scenePath)
    {
        var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);

        bool found = false;
        for (int i = 0; i < scenes.Count; i++)
        {
            if (scenes[i].path == scenePath)
            {
                found = true;
                break;
            }
        }

        if (!found)
        {
            scenes.Add(new EditorBuildSettingsScene(scenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            Debug.Log($"[Lobby] 场景已加入 Build Settings: {scenePath}");
        }
    }
}
