// ============================================================
// ChaseSceneCreator.cs — 一键创建「帷幕追猎」场景
// 菜单: Tools → Create Chase Scene
// 生成: 追猎地图 + ChaseGameManager + NetworkManager + 相机 + EventSystem
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.Collections.Generic;

public class ChaseSceneCreator
{
    const string EXPLORATION_GLB = "Assets/Models/Environment/Exploration.glb";
    const string SCENE_PATH = "Assets/Scenes/ChaseScene.unity";

    [MenuItem("Tools/Create Chase Scene")]
    public static void Create()
    {
        // 1. 新场景
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // 2. ExplorationRoot + ExplorationSceneSetup (运行时由 ChaseGameManager 重建)
        var root = new GameObject("ExplorationRoot");
        var setup = root.AddComponent<ExplorationSceneSetup>();
        setup.buildOnStart = false;
        setup.remapMaterials = true;

        var exploration = AssetDatabase.LoadAssetAtPath<GameObject>(EXPLORATION_GLB);
        if (exploration != null)
            setup.explorationPrefab = exploration;
        else
            Debug.LogError($"[Chase] ❌ 找不到 {EXPLORATION_GLB}\n请确认 Exploration.glb 已由 glTFast 导入");

        // 3. ChaseManager + ChaseGameManager
        var chaseGo = new GameObject("ChaseManager");
        var chase = chaseGo.AddComponent<ChaseGameManager>();
        chase.mapSetup = setup;

        // 4. NetworkManager
        var netGo = new GameObject("NetworkManager");
        netGo.AddComponent<NetworkManager>();

        // 5. MainCamera (俯瞰地图, 进入游戏后切换为本地玩家相机)
        var cam = new GameObject("MainCamera");
        cam.tag = "MainCamera";
        var cameraComp = cam.AddComponent<Camera>();
        cameraComp.clearFlags = CameraClearFlags.SolidColor;
        cameraComp.backgroundColor = new Color(0.02f, 0.01f, 0.06f);
        cameraComp.fieldOfView = 45f;
        cameraComp.nearClipPlane = 0.1f;
        cameraComp.farClipPlane = 800f;
        cameraComp.allowHDR = true;
        cam.AddComponent<AudioListener>();
        cam.transform.position = new Vector3(0f, 55f, -45f);
        cam.transform.rotation = Quaternion.Euler(48f, 0f, 0f);

        // 6. EventSystem
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

        // 7. 立即构建地图 (编辑器预览)
        setup.Build();

        // 8. 保存
        if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
            AssetDatabase.CreateFolder("Assets", "Scenes");
        EditorSceneManager.SaveScene(scene, SCENE_PATH);

        // 9. 加入 Build Settings
        AddToBuildSettings(SCENE_PATH);

        Selection.activeGameObject = chaseGo;

        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  ✅ 帷幕追猎场景创建完成！");
        Debug.Log($"  📁 {SCENE_PATH}");
        Debug.Log("  🎮 按 Play → 连接服务器 → 创建/加入 3D 房 → 开始");
        Debug.Log("  ⌨️  蚀者 F 噬灵 / 守幕者 Q 藏匿 / WASD 移动");
        Debug.Log("═══════════════════════════════════════");
    }

    static void AddToBuildSettings(string scenePath)
    {
        var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        for (int i = 0; i < scenes.Count; i++)
            if (scenes[i].path == scenePath) return;

        scenes.Add(new EditorBuildSettingsScene(scenePath, true));
        EditorBuildSettings.scenes = scenes.ToArray();
        Debug.Log($"[Chase] 场景已加入 Build Settings: {scenePath}");
    }
}
