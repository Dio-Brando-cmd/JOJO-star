// ============================================================
// ProjectSetup.cs — Unity 项目一键配置
// Tools → Corrupted → Setup Project
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.Rendering;
using System.IO;

public class ProjectSetup : EditorWindow
{
    [MenuItem("Tools/VeilLand/Setup Project (Full)")]
    public static void SetupFull()
    {
        CreateFolders();
        SetupRenderPipeline();
        SetupTagsAndLayers();
        SetupQualitySettings();
        SetupPhysics();
        SetupPlayerSettings();
        SetupScene();
        Debug.Log("✅ VeilLand project fully configured");
    }

    static void SetupRenderPipeline()
    {
        // Check if already configured
        if (GraphicsSettings.renderPipelineAsset != null)
        {
            Debug.Log("[Setup] Render Pipeline already configured, skipping");
            return;
        }

        // Create Settings folder
        string settingsDir = "Assets/Settings";
        if (!Directory.Exists(settingsDir))
            Directory.CreateDirectory(settingsDir);

        // Create Universal Renderer Data
        var rendererData = ScriptableObject.CreateInstance<UnityEngine.Rendering.Universal.UniversalRendererData>();
        rendererData.name = "URP-Renderer";
        AssetDatabase.CreateAsset(rendererData, $"{settingsDir}/URP-Renderer.asset");

        // Create URP Pipeline Asset
        var pipelineAsset = ScriptableObject.CreateInstance<UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset>();
        pipelineAsset.name = "URP-Pipeline";

        // Use SerializedObject to set the renderer
        var so = new SerializedObject(pipelineAsset);
        var rendererListProp = so.FindProperty("m_RendererDataList");
        if (rendererListProp != null)
        {
            rendererListProp.arraySize = 1;
            var elem = rendererListProp.GetArrayElementAtIndex(0);
            elem.objectReferenceValue = rendererData;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        AssetDatabase.CreateAsset(pipelineAsset, $"{settingsDir}/URP-Pipeline.asset");

        // Assign to project
        GraphicsSettings.renderPipelineAsset = pipelineAsset;
        AssetDatabase.SaveAssets();

        Debug.Log("[Setup] ✅ URP Pipeline created and assigned");
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
        AddTag("Corrupted");
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
        PlayerSettings.companyName = "VeilLand Studio";
        PlayerSettings.productName = "帷幕之地";
        PlayerSettings.SetApplicationIdentifier(
            BuildTargetGroup.Standalone, "com.veilland.online");
    }

    [MenuItem("Tools/VeilLand/Create Main Scene")]
    static void SetupScene()
    {
        var scene = UnityEngine.SceneManagement.SceneManager.GetActiveScene();

        // === Skybox & Ambient ===
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.25f, 0.25f, 0.3f);

        // === Camera ===
        var cam = Camera.main;
        if (cam == null)
        {
            var camGO = new GameObject("MainCamera");
            cam = camGO.AddComponent<Camera>();
            camGO.tag = "MainCamera";
        }
        cam.transform.position = new Vector3(0, 60, -60);
        cam.transform.LookAt(Vector3.zero);
        cam.backgroundColor = new Color(0.15f, 0.2f, 0.35f);
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.farClipPlane = 500f;

        // === Terrain (simple ground plane) ===
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Ground";
        ground.transform.localScale = new Vector3(10, 1, 10);
        ground.transform.position = Vector3.zero;
        var groundR = ground.GetComponent<MeshRenderer>();
        // Use URP-compatible material
        var urpLit = Shader.Find("Universal Render Pipeline/Lit");
        if (urpLit != null)
        {
            groundR.sharedMaterial = new Material(urpLit);
            groundR.sharedMaterial.color = new Color(0.2f, 0.3f, 0.12f);
        }

        // === Directional Light (Sun) ===
        var sunGO = new GameObject("Sun");
        var sun = sunGO.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.intensity = 1.2f;
        sun.color = new Color(1f, 0.95f, 0.85f);
        sunGO.transform.rotation = Quaternion.Euler(50, -30, 0);
        sun.shadows = LightShadows.Soft;

        // === Moon Light ===
        var moonGO = new GameObject("Moon");
        var moon = moonGO.AddComponent<Light>();
        moon.type = LightType.Directional;
        moon.intensity = 0f;
        moon.color = new Color(0.6f, 0.7f, 1f);
        moonGO.transform.rotation = Quaternion.Euler(30, 150, 0);

        // === Village (auto-generates 12 houses + 4 landmarks) ===
        var village = new GameObject("Village");
        var villageSetup = village.AddComponent<VillageSceneSetup>();
        villageSetup.generateOnStart = false; // We call it manually below

        // === Game Manager ===
        var gm = new GameObject("GameManager");
        gm.AddComponent<NetworkManager>();
        gm.AddComponent<GameManager3D>();
        var gm3d = gm.GetComponent<GameManager3D>();
        gm3d.sunLight = sun;
        gm3d.moonLight = moon;
        gm3d.villageCenter = village.transform;

        // === Event System (for UI) ===
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

        // === Main Canvas (Screen Space Overlay) ===
        var canvasGO = new GameObject("MainCanvas");
        var canvas = canvasGO.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = canvasGO.AddComponent<UnityEngine.UI.CanvasScaler>();
        scaler.uiScaleMode = UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);
        scaler.matchWidthOrHeight = 0.5f;
        canvasGO.AddComponent<UnityEngine.UI.GraphicRaycaster>();

        // -- LobbyUI3D (manages all lobby/room/character-select/chat) --
        var lobbyUI = canvasGO.AddComponent<LobbyUI3D>();

        // Create main panel
        var mainPanel = CreateUIPanel("MainPanel", canvasGO.transform);
        lobbyUI.mainPanel = mainPanel;

        var playerNameInput = CreateTMPInput("PlayerNameInput", mainPanel.transform, "输入玩家名");
        lobbyUI.playerNameInput = playerNameInput;
        playerNameInput.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 200);

        var connectBtn = CreateUIButton("ConnectButton", mainPanel.transform, "连接服务器");
        connectBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 100);
        lobbyUI.connectButton = connectBtn;

        var connStatus = CreateTMPText("ConnectionStatus", mainPanel.transform, "服务器: 210.16.170.144:4000");
        connStatus.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 50);
        connStatus.fontSize = 14;
        lobbyUI.connectionStatusText = connStatus;

        // Create room panel
        var roomPanel = CreateUIPanel("RoomPanel", canvasGO.transform);
        roomPanel.SetActive(false);
        lobbyUI.roomPanel = roomPanel;

        var roomCodeInput = CreateTMPInput("RoomCodeInput", roomPanel.transform, "输入房间码");
        roomCodeInput.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 150);
        lobbyUI.roomCodeInput = roomCodeInput;

        var createNameInput = CreateTMPInput("CreateRoomNameInput", roomPanel.transform, "房间名称");
        createNameInput.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 80);
        lobbyUI.createRoomNameInput = createNameInput;

        var createRoomBtn = CreateUIButton("CreateRoomButton", roomPanel.transform, "创建房间");
        createRoomBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(-100, 0);
        lobbyUI.createRoomButton = createRoomBtn;

        var joinRoomBtn = CreateUIButton("JoinRoomButton", roomPanel.transform, "加入房间");
        joinRoomBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(100, 0);
        lobbyUI.joinRoomButton = joinRoomBtn;

        var quickMatchBtn = CreateUIButton("QuickMatchButton", roomPanel.transform, "快速匹配");
        quickMatchBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -80);
        lobbyUI.quickMatchButton = quickMatchBtn;

        // Create waiting panel
        var waitingPanel = CreateUIPanel("WaitingPanel", canvasGO.transform);
        waitingPanel.SetActive(false);
        lobbyUI.waitingPanel = waitingPanel;

        var roomCodeDisplay = CreateTMPText("RoomCodeDisplay", waitingPanel.transform, "房间码: ----");
        roomCodeDisplay.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 380);
        roomCodeDisplay.fontSize = 28;
        lobbyUI.roomCodeDisplay = roomCodeDisplay;

        var playerCountText = CreateTMPText("PlayerCountText", waitingPanel.transform, "玩家: 0/12");
        playerCountText.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 340);
        playerCountText.fontSize = 20;
        lobbyUI.playerCountText = playerCountText;

        var playerList = CreateUIPanel("PlayerList", waitingPanel.transform);
        playerList.GetComponent<RectTransform>().anchoredPosition = new Vector2(-400, 200);
        playerList.GetComponent<RectTransform>().sizeDelta = new Vector2(300, 400);
        lobbyUI.playerListContainer = playerList.transform;

        var startBtn = CreateUIButton("StartGameButton", waitingPanel.transform, "开始游戏");
        startBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -350);
        lobbyUI.startGameButton = startBtn;

        var leaveBtn = CreateUIButton("LeaveRoomButton", waitingPanel.transform, "离开房间");
        leaveBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(200, -350);
        lobbyUI.leaveRoomButton = leaveBtn;

        // Create chat panel (always visible)
        var chatPanel = CreateUIPanel("ChatPanel", canvasGO.transform);
        chatPanel.GetComponent<RectTransform>().anchoredPosition = new Vector2(650, -200);
        chatPanel.GetComponent<RectTransform>().sizeDelta = new Vector2(350, 500);
        lobbyUI.chatPanel = chatPanel;

        var chatInput = CreateTMPInput("ChatInput", chatPanel.transform, "输入聊天消息...");
        chatInput.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -220);
        lobbyUI.chatInput = chatInput;

        var sendBtn = CreateUIButton("SendChatButton", chatPanel.transform, "发送");
        sendBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(120, -220);
        lobbyUI.sendChatButton = sendBtn;

        var chatContainer = CreateUIPanel("ChatMessageContainer", chatPanel.transform);
        chatContainer.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, 0);
        chatContainer.GetComponent<RectTransform>().sizeDelta = new Vector2(330, 430);
        lobbyUI.chatMessageContainer = chatContainer.transform;

        // Create notification popup
        var notifPopup = CreateUIPanel("NotificationPopup", canvasGO.transform);
        notifPopup.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -380);
        notifPopup.SetActive(false);
        lobbyUI.notificationPopup = notifPopup;

        var notifText = CreateTMPText("NotificationText", notifPopup.transform, "");
        notifText.fontSize = 18;
        lobbyUI.notificationText = notifText;

        // Wire up references
        var panelGO = new GameObject("NightActionPanel");
        panelGO.transform.SetParent(canvasGO.transform);
        var nightActionUI = canvasGO.AddComponent<NightActionUI>();
        nightActionUI.actionPanel = panelGO;

        // Link GameManager3D to village positions
        gm3d.housePositions = new Transform[12];
        // These will be populated by VillageSceneSetup at runtime

        // Trigger village generation (won't auto-run in Editor mode)
        villageSetup.GenerateDefaultLayout();

        Debug.Log("✅ Main scene created with full lobby UI + village");

        // Save the scene
        if (string.IsNullOrEmpty(scene.path))
        {
            EditorSceneManager.SaveScene(scene, "Assets/Scenes/MainScene.unity");
        }
        else
        {
            EditorSceneManager.SaveScene(scene);
        }
        Debug.Log("💾 Scene saved to Assets/Scenes/MainScene.unity");
    }

    // ==================== UI Helper Methods ====================

    static GameObject CreateUIPanel(string name, Transform parent)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent);
        var rect = go.AddComponent<RectTransform>();
        rect.anchoredPosition = Vector2.zero;
        rect.sizeDelta = new Vector2(800, 600);
        // Add Image for background
        var img = go.AddComponent<UnityEngine.UI.Image>();
        img.color = new Color(0, 0, 0, 0.5f);
        return go;
    }

    static UnityEngine.UI.Button CreateUIButton(string name, Transform parent, string label)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent);
        var rect = go.AddComponent<RectTransform>();
        rect.anchoredPosition = Vector2.zero;
        rect.sizeDelta = new Vector2(200, 50);

        var img = go.AddComponent<UnityEngine.UI.Image>();
        img.color = new Color(0.2f, 0.3f, 0.6f, 0.9f);

        var btn = go.AddComponent<UnityEngine.UI.Button>();

        // Label
        var labelGO = new GameObject("Label");
        labelGO.transform.SetParent(go.transform);
        var labelRect = labelGO.AddComponent<RectTransform>();
        labelRect.anchoredPosition = Vector2.zero;
        labelRect.sizeDelta = new Vector2(200, 50);
        var tmp = labelGO.AddComponent<TMPro.TextMeshProUGUI>();
        tmp.text = label;
        tmp.fontSize = 16;
        tmp.alignment = TMPro.TextAlignmentOptions.Center;
        tmp.color = Color.white;

        return btn;
    }

    static TMPro.TMP_InputField CreateTMPInput(string name, Transform parent, string placeholder)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent);
        var rect = go.AddComponent<RectTransform>();
        rect.anchoredPosition = Vector2.zero;
        rect.sizeDelta = new Vector2(300, 40);

        var img = go.AddComponent<UnityEngine.UI.Image>();
        img.color = new Color(0.1f, 0.1f, 0.15f, 0.9f);

        var input = go.AddComponent<TMPro.TMP_InputField>();

        // Placeholder
        var phGO = new GameObject("Placeholder");
        phGO.transform.SetParent(go.transform);
        var phRect = phGO.AddComponent<RectTransform>();
        phRect.anchoredPosition = Vector2.zero;
        phRect.sizeDelta = new Vector2(300, 40);
        var phTMP = phGO.AddComponent<TMPro.TextMeshProUGUI>();
        phTMP.text = placeholder;
        phTMP.fontSize = 14;
        phTMP.color = new Color(0.6f, 0.6f, 0.6f, 0.8f);
        input.placeholder = phTMP;

        // Text area
        var taGO = new GameObject("Text");
        taGO.transform.SetParent(go.transform);
        var taRect = taGO.AddComponent<RectTransform>();
        taRect.anchoredPosition = Vector2.zero;
        taRect.sizeDelta = new Vector2(280, 30);
        var taTMP = taGO.AddComponent<TMPro.TextMeshProUGUI>();
        taTMP.fontSize = 14;
        taTMP.color = Color.white;
        input.textComponent = taTMP;

        return input;
    }

    static TMPro.TextMeshProUGUI CreateTMPText(string name, Transform parent, string text)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent);
        var rect = go.AddComponent<RectTransform>();
        rect.anchoredPosition = Vector2.zero;
        rect.sizeDelta = new Vector2(400, 30);
        var tmp = go.AddComponent<TMPro.TextMeshProUGUI>();
        tmp.text = text;
        tmp.fontSize = 16;
        tmp.color = Color.white;
        tmp.alignment = TMPro.TextAlignmentOptions.Center;
        return tmp;
    }
}
