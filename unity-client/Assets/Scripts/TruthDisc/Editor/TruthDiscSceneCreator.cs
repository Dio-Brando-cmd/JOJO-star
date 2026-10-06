// ============================================================
// TruthDiscSceneCreator.cs — 一键创建「真相盘 3D」场景
// 菜单: Tools → Create Truth Disc Scene
// 生成: TruthMap(+TruthDiscMapBuilder) + TruthDiscManager(+TruthDiscGameManager)
//      + NetworkManager + 俯瞰相机 + EventSystem
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using System.Collections.Generic;

public class TruthDiscSceneCreator
{
    const string SCENE_PATH = "Assets/Scenes/TruthDiscScene.unity";

    [MenuItem("Tools/Create Truth Disc Scene")]
    public static void Create()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // 1. TruthMap + TruthDiscMapBuilder
        var mapGo = new GameObject("TruthMap");
        var map = mapGo.AddComponent<TruthDiscMapBuilder>();

        // 2. TruthDiscManager + TruthDiscGameManager
        var mgrGo = new GameObject("TruthDiscManager");
        var mgr = mgrGo.AddComponent<TruthDiscGameManager>();
        mgr.mapBuilder = map;

        // 3. NetworkManager
        var netGo = new GameObject("NetworkManager");
        netGo.AddComponent<NetworkManager>();

        // 4. MainCamera (鸟瞰地图, 进入游戏后切换为本地玩家相机)
        var cam = new GameObject("MainCamera");
        cam.tag = "MainCamera";
        var camComp = cam.AddComponent<Camera>();
        camComp.clearFlags = CameraClearFlags.SolidColor;
        camComp.backgroundColor = new Color(0.02f, 0.01f, 0.06f);
        camComp.fieldOfView = 45f;
        camComp.nearClipPlane = 0.1f;
        camComp.farClipPlane = 800f;
        camComp.allowHDR = true;
        cam.AddComponent<AudioListener>();
        cam.transform.position = new Vector3(0f, 60f, -55f);
        cam.transform.rotation = Quaternion.Euler(48f, 0f, 0f);

        // 5. EventSystem
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

        // 6. 立即构建地图 (编辑器预览)
        map.Build();

        // 7. 保存
        if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
            AssetDatabase.CreateFolder("Assets", "Scenes");
        EditorSceneManager.SaveScene(scene, SCENE_PATH);

        // 8. 加入 Build Settings
        AddToBuildSettings(SCENE_PATH);

        Selection.activeGameObject = mgrGo;

        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  ✅ 真相盘(3D)场景创建完成！");
        Debug.Log($"  📁 {SCENE_PATH}");
        Debug.Log("  🎮 按 Play → 连接服务器 → 创建/加入真相盘房 → 开始");
        Debug.Log("  ⌨️  WASD 移动 / E 任务·净化 / F 献祭·短铳 / 动作见 HUD");
        Debug.Log("═══════════════════════════════════════");
    }

    static void AddToBuildSettings(string scenePath)
    {
        var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        for (int i = 0; i < scenes.Count; i++)
            if (scenes[i].path == scenePath) return;

        scenes.Add(new EditorBuildSettingsScene(scenePath, true));
        EditorBuildSettings.scenes = scenes.ToArray();
        Debug.Log($"[TruthDisc] 场景已加入 Build Settings: {scenePath}");
    }
}
