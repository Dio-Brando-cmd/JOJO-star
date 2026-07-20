// ============================================================
// ProjectSetup.cs — Unity 项目一键配置
// Tools → Werewolf → Setup Project
// ============================================================

using UnityEngine;
using UnityEditor;
using System.IO;

public class ProjectSetup : EditorWindow
{
    [MenuItem("Tools/Werewolf/Setup Project (Full)")]
    public static void SetupFull()
    {
        CreateFolders();
        SetupTagsAndLayers();
        SetupQualitySettings();
        SetupPhysics();
        SetupPlayerSettings();
        SetupScene();
        Debug.Log("✅ Werewolf project fully configured");
    }

    static void CreateFolders()
    {
        string[] dirs = {
            "Assets/Models/Characters",
            "Assets/Models/Environment",
            "Assets/Models/Props",
            "Assets/Prefabs/Characters",
            "Assets/Prefabs/Environment",
            "Assets/Prefabs/UI",
            "Assets/Scenes",
            "Assets/Scripts/Core",
            "Assets/Scripts/Gameplay",
            "Assets/Scripts/UI",
            "Assets/Scripts/Editor",
            "Assets/Materials/Characters",
            "Assets/Materials/Environment",
            "Assets/Textures",
            "Assets/Audio/Music",
            "Assets/Audio/SFX",
            "Assets/Animations",
            "Assets/Resources",
        };
        foreach (var d in dirs)
            if (!Directory.Exists(d)) Directory.CreateDirectory(d);
    }

    static void SetupTagsAndLayers()
    {
        AddTag("Player");
        AddTag("Wolf");
        AddTag("HidingSpot");
        AddTag("House");
        AddTag("Interactable");
        AddTag("Landmark");
    }

    static void AddTag(string tag)
    {
        SerializedObject tagManager = new SerializedObject(
            AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset")[0]);
        SerializedProperty tags = tagManager.FindProperty("tags");
        for (int i = 0; i < tags.arraySize; i++)
        {
            if (tags.GetArrayElementAtIndex(i).stringValue == tag) return;
        }
        tags.InsertArrayElementAtIndex(tags.arraySize);
        tags.GetArrayElementAtIndex(tags.arraySize - 1).stringValue = tag;
        tagManager.ApplyModifiedProperties();
    }

    static void SetupQualitySettings()
    {
        QualitySettings.SetQualityLevel(2); // High
        QualitySettings.vSyncCount = 0;
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowResolution = ShadowResolution.Medium;
        QualitySettings.shadowDistance = 80f;
        QualitySettings.anisotropicFiltering = AnisotropicFiltering.ForceEnable;
    }

    static void SetupPhysics()
    {
        Physics.defaultSolverIterations = 8;
        Physics.defaultSolverVelocityIterations = 2;
        Physics.gravity = new Vector3(0, -9.81f, 0);
        Physics.bounceThreshold = 0.2f;
    }

    static void SetupPlayerSettings()
    {
        PlayerSettings.companyName = "Werewolf Studio";
        PlayerSettings.productName = "帷幕之地";
        PlayerSettings.SetApplicationIdentifier(
            NamedBuildTarget.Standalone, "com.werewolf.veilland");
    }

    [MenuItem("Tools/Werewolf/Create Main Scene")]
    static void SetupScene()
    {
        var scene = UnityEngine.SceneManagement.SceneManager.GetActiveScene();

        // Directional Light (Sun)
        var sunGO = new GameObject("Sun");
        var sun = sunGO.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.intensity = 1.2f;
        sun.color = new Color(1f, 0.95f, 0.85f);
        sunGO.transform.rotation = Quaternion.Euler(50, -30, 0);

        // Moon Light
        var moonGO = new GameObject("Moon");
        var moon = moonGO.AddComponent<Light>();
        moon.type = LightType.Directional;
        moon.intensity = 0f;
        moon.color = new Color(0.6f, 0.7f, 1f);
        moonGO.transform.rotation = Quaternion.Euler(30, 150, 0);

        // Village
        var village = new GameObject("Village");
        village.AddComponent<VillageSceneSetup>();

        // Game Manager
        var gm = new GameObject("GameManager");
        gm.AddComponent<NetworkManager>();
        gm.AddComponent<GameManager3D>();
        var gm3d = gm.GetComponent<GameManager3D>();
        gm3d.sunLight = sun;
        gm3d.moonLight = moon;
        gm3d.villageCenter = village.transform;

        // Event System (for UI)
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

        // Canvas
        var canvasGO = new GameObject("Canvas");
        var canvas = canvasGO.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvasGO.AddComponent<UnityEngine.UI.CanvasScaler>();
        canvasGO.AddComponent<UnityEngine.UI.GraphicRaycaster>();

        var nightActionUI = canvasGO.AddComponent<NightActionUI>();
        // Link action panel
        var panelGO = new GameObject("ActionPanel");
        panelGO.transform.SetParent(canvasGO.transform);
        nightActionUI.actionPanel = panelGO;

        Debug.Log("✅ Main scene created");
    }
}
