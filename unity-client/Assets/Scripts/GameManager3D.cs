// ============================================================
// GameManager3D.cs — 3D游戏主控制器 (v2 — 鲁棒测试模式)
// ============================================================

using UnityEngine;
using System.Collections.Generic;

public class GameManager3D : MonoBehaviour
{
    public static GameManager3D Instance { get; private set; }

    [Header("Prefabs")]
    public GameObject playerPrefab;
    public GameObject localPlayerPrefab;
    public GameObject housePrefab;

    [Header("Scene References")]
    public Transform villageCenter;
    public Transform[] housePositions;
    public Light moonLight;
    public Light sunLight;

    [Header("Game State")]
    public string currentPhase = "LOBBY";
    public string currentNightStep;
    public int currentRound;
    public float nightTimeLeft;

    [Header("Test Mode")]
    public bool testMode = true;
    public Transform testSpawnPoint;

    // ==================== 内部状态 ====================

    private Dictionary<string, PlayerController3D> remotePlayers = new();
    private PlayerController3D localPlayer;
    private string myPlayerId;
    private bool networkAvailable = false;

    // ==================== Awake / Start ====================

    void Awake()
    {
        if (Instance == null) Instance = this;
        else { Destroy(gameObject); return; }
    }

    void Start()
    {
        Debug.Log("══════════════════════════════════");
        Debug.Log("  🎮 GameManager3D Starting...");
        Debug.Log("══════════════════════════════════");

        // 安全订阅网络事件
        if (NetworkManager.Instance != null)
        {
            networkAvailable = true;
            NetworkManager.Instance.OnGameStateReceived += HandleGameState;
            NetworkManager.Instance.OnPrivateStateReceived += HandlePrivateState;
            NetworkManager.Instance.OnPhaseChange += HandlePhaseChange;
            NetworkManager.Instance.OnGameStarted += HandleGameStarted;
            Debug.Log("[Game3D] ✅ Network events subscribed");
        }
        else
        {
            Debug.LogWarning("[Game3D] ⚠️  NetworkManager not found — running in OFFLINE test mode");
        }

        // 光照（安全调用）
        SetLightingMode("LOBBY");

        // 测试模式
        if (testMode)
        {
            Debug.Log("[Game3D] 🧪 Test mode ON — spawning player in 0.5s...");
            Invoke(nameof(SpawnTestPlayer), 0.5f);
        }
        else
        {
            Debug.Log("[Game3D] Test mode OFF — waiting for network game start");
        }
    }

    // ==================== 测试玩家生成 ====================

    void SpawnTestPlayer()
    {
        Debug.Log("[Game3D] 🏗️  SpawnTestPlayer...");

        Vector3 spawnPos = Vector3.zero;
        if (testSpawnPoint != null)
            spawnPos = testSpawnPoint.position;
        else if (villageCenter != null)
            spawnPos = villageCenter.position;
        else
            Debug.LogWarning("[Game3D] No spawn point set — spawning at origin");

        GameObject playerObj = null;
        bool usingFreyjaModel = false;

        // —— 尝试加载芙蕾雅动画模型 ——
        var freyjaPrefab = Resources.Load<GameObject>("Characters/Freyja_Animated");
        if (freyjaPrefab != null)
        {
            playerObj = Instantiate(freyjaPrefab, spawnPos, Quaternion.identity);
            playerObj.name = "Freyja_Player";
            usingFreyjaModel = true;
            Debug.Log("[Game3D] 🌿 Loaded Freyja animated model!");
        }
        else
        {
            Debug.LogWarning("[Game3D] ⚠️  Freyja model not found in Resources — using capsule fallback");
            // —— 回退：胶囊体 ——
            playerObj = new GameObject("TestPlayer_Freyja");
            playerObj.transform.position = spawnPos;

            var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            body.transform.SetParent(playerObj.transform);
            body.transform.localPosition = new Vector3(0, 1, 0);
            body.transform.localScale = new Vector3(0.5f, 1, 0.5f);
            body.name = "Body";

            var urpLit = Shader.Find("Universal Render Pipeline/Lit");
            if (urpLit == null) urpLit = Shader.Find("Standard");
            var bodyRenderer = body.GetComponent<MeshRenderer>();
            bodyRenderer.sharedMaterial = new Material(urpLit != null ? urpLit : Shader.Find("Standard"));
            bodyRenderer.sharedMaterial.color = new Color(0.2f, 0.6f, 0.3f);

            var head = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            head.transform.SetParent(playerObj.transform);
            head.transform.localPosition = new Vector3(0, 2.2f, 0);
            head.transform.localScale = new Vector3(0.35f, 0.35f, 0.35f);
            head.name = "Head";
            var headRenderer = head.GetComponent<MeshRenderer>();
            headRenderer.sharedMaterial = new Material(urpLit != null ? urpLit : Shader.Find("Standard"));
            headRenderer.sharedMaterial.color = new Color(0.95f, 0.85f, 0.75f);
        }

        // —— CharacterController ——
        var existingCC = playerObj.GetComponent<CharacterController>();
        if (existingCC == null)
        {
            var cc = playerObj.AddComponent<CharacterController>();
            cc.height = 2f;
            cc.radius = 0.4f;
            cc.center = new Vector3(0, 1, 0);
            cc.slopeLimit = 45f;
            cc.stepOffset = 0.3f;
        }

        // —— PlayerController3D ——
        var existingCtrl = playerObj.GetComponent<PlayerController3D>();
        var controller = existingCtrl != null ? existingCtrl : playerObj.AddComponent<PlayerController3D>();
        controller.isLocal = true;
        controller.canMove = true;
        controller.characterId = "FREYJA";

        // —— Animator ——
        var animator = playerObj.GetComponent<Animator>();
        if (animator == null)
            animator = playerObj.AddComponent<Animator>();
        controller.animator = animator;

        // 加载 Animator Controller（如果有）
        var freyjaController = Resources.Load<RuntimeAnimatorController>("Animations/Freyja");
        if (freyjaController != null)
        {
            animator.runtimeAnimatorController = freyjaController;
            Debug.Log("[Game3D] 🎬 Freyja Animator Controller loaded!");
        }

        // —— 摄像机 ——
        var camInModel = playerObj.GetComponentInChildren<Camera>();
        if (camInModel != null)
        {
            // 模型自带摄像机，用它
            camInModel.tag = "MainCamera";
        }
        else
        {
            var camObj = new GameObject("PlayerCamera");
            camObj.transform.SetParent(playerObj.transform);
            camObj.transform.localPosition = new Vector3(0, 1.7f, 0);
            var cam = camObj.AddComponent<Camera>();
            cam.fieldOfView = 70f;
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 500f;
        }

        localPlayer = controller;
        myPlayerId = "test_player_freyja";

        // 禁用场景主摄像机
        var mainCam = Camera.main;
        if (mainCam != null && mainCam.gameObject != playerObj)
        {
            mainCam.gameObject.SetActive(false);
            Debug.Log("[Game3D] Scene Main Camera disabled");
        }

        Debug.Log("══════════════════════════════════");
        if (usingFreyjaModel)
        {
            Debug.Log("  🌿 Freyja 动画模型已生成！");
            Debug.Log("  🎮 WASD=Move  🖱️ Mouse=Look");
            Debug.Log("  🏃 Shift=Sprint  🥷 Ctrl=Crouch");
            Debug.Log("  🎬 Animator 已连接（需运行 Setup Freyja Animations）");
        }
        else
        {
            Debug.Log("  ⚠️ 胶囊体回退模式");
            Debug.Log("  🎮 WASD=Move  🖱️ Mouse=Look");
            Debug.Log("  💡 首次导入需等 Unity 完成 FBX 导入");
        }
        Debug.Log("══════════════════════════════════");
    }

    // ==================== 光照 ====================

    public void SetLightingMode(string phase)
    {
        switch (phase)
        {
            case "LOBBY":
                if (sunLight != null) sunLight.intensity = 1.5f;
                if (moonLight != null) moonLight.intensity = 0f;
                RenderSettings.ambientIntensity = 1.2f;
                break;
            case "NIGHT":
                if (sunLight != null) sunLight.intensity = 0f;
                if (moonLight != null) moonLight.intensity = 0.8f;
                RenderSettings.ambientIntensity = 0.3f;
                break;
            case "DAY":
                if (sunLight != null) sunLight.intensity = 1.2f;
                if (moonLight != null) moonLight.intensity = 0f;
                RenderSettings.ambientIntensity = 1.0f;
                break;
        }
    }

    // ==================== 网络事件处理 ====================

    void HandleGameState(GameState state)
    {
        if (state == null) return;
        currentPhase = state.phase;
        currentNightStep = state.nightStep;
        currentRound = state.round;

        switch (state.phase)
        {
            case "LOBBY":    SetLightingMode("LOBBY"); break;
            case "NIGHT":    SetLightingMode("NIGHT"); break;
            case "DAY":
            case "DISCUSSION":
            case "VOTE":     SetLightingMode("DAY"); break;
            case "GAME_OVER": SetLightingMode("DAY"); break;
        }
    }

    void HandlePrivateState(PrivateState pvt) { }

    void HandlePhaseChange(string phase, string nightStep) { }

    void HandleGameStarted(string _)
    {
        Debug.Log("[Game3D] Network game started!");
    }

    // ==================== 清理 ====================

    void OnDestroy()
    {
        if (networkAvailable && NetworkManager.Instance != null)
        {
            NetworkManager.Instance.OnGameStateReceived -= HandleGameState;
            NetworkManager.Instance.OnPrivateStateReceived -= HandlePrivateState;
            NetworkManager.Instance.OnPhaseChange -= HandlePhaseChange;
            NetworkManager.Instance.OnGameStarted -= HandleGameStarted;
        }
    }
}
