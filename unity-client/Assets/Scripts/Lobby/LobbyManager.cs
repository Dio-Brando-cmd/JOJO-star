// ============================================================
// LobbyManager.cs — 大厅主控
// 流程: 登录(LoginScreenUI) → 桃花源开场 → 沉浸式大厅(无框)
// 管理登录门控、镜头开场、场景切换。
// ============================================================

using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;

public class LobbyManager : MonoBehaviour
{
    public static LobbyManager Instance { get; private set; }

    [Header("══ 引用(自动查找) ══")]
    public LobbyCameraIntro cameraIntro;
    public LobbySceneSetup sceneSetup;      // 旧程序化大厅(回退)
    public ValleySceneSetup valleySetup;    // 桃花源山谷 v3(优先)

    [Header("══ UI ══")]
    public GameObject titleUI;      // 标题 Canvas（可选）
    public GameObject interactHint;  // 交互提示（可选）
    public LoginScreenUI loginScreen;    // 登录界面 (先于大厅)
    public LobbyImmersiveUI immersiveUI; // 沉浸式大厅 UI (无框, 仅标题/提示, 不可交互)
    public LobbyMainMenuUI mainMenu;     // 大厅主菜单 (可交互按钮: 进入3D/2D/退出)
    public LobbyAvatar avatar;           // 大厅角色展示(芙蕾雅 + 镜头指示)
    public float uiDelay = 1.5f;     // 开场完成后多久显示 UI

    [Header("══ 状态 ══")]
    [SerializeField] private bool _introDone;
    [SerializeField] private bool _uiShown;

    public bool IntroDone => _introDone;
    public static bool SessionLoggedIn { get; private set; }

    void Awake()
    {
        if (Instance == null) Instance = this;
        else { Destroy(gameObject); return; }

        // 登录界面 + 沉浸式大厅 UI — 若无则自动挂载
        loginScreen = GetComponent<LoginScreenUI>();
        if (loginScreen == null) loginScreen = gameObject.AddComponent<LoginScreenUI>();
        immersiveUI = GetComponent<LobbyImmersiveUI>();
        if (immersiveUI == null) immersiveUI = gameObject.AddComponent<LobbyImmersiveUI>();
        avatar = GetComponent<LobbyAvatar>();
        if (avatar == null) avatar = gameObject.AddComponent<LobbyAvatar>();
        mainMenu = GetComponent<LobbyMainMenuUI>();
        if (mainMenu == null) mainMenu = gameObject.AddComponent<LobbyMainMenuUI>();
    }

    void Start()
    {
        // 自动查找
        if (cameraIntro == null)
            cameraIntro = FindFirstObjectByType<LobbyCameraIntro>();
        if (sceneSetup == null)
            sceneSetup = FindFirstObjectByType<LobbySceneSetup>();
        if (valleySetup == null)
            valleySetup = FindFirstObjectByType<ValleySceneSetup>();

        // 初始隐藏 UI
        if (titleUI != null) titleUI.SetActive(false);
        if (interactHint != null) interactHint.SetActive(false);

        // 登录 → 大厅 门控
        if (SessionLoggedIn)
        {
            // 已登录(返回大厅): 跳过登录, 直接进入沉浸式大厅
            StartCoroutine(EnterImmersiveAfterFrame());
        }
        else
        {
            loginScreen?.Show();
        }

        Debug.Log("[Lobby] 帷幕之地 大厅已就绪");
        Debug.Log(SessionLoggedIn ? "[Lobby] 🔁 已登录, 直接进入大厅" : "[Lobby] 🔑 等待登录...");
    }

    IEnumerator EnterImmersiveAfterFrame()
    {
        yield return null; // 等 cameraIntro.Start() 生成路径
        if (cameraIntro != null) cameraIntro.Skip();
        else OnIntroComplete();
    }

    void Update()
    {
        // 空格跳过开场
        if (!_introDone && Input.GetKeyDown(KeyCode.Space))
        {
            cameraIntro?.Skip();
        }
    }

    /// <summary>登录成功回调 (LoginScreenUI 调用)</summary>
    public void OnLoggedIn()
    {
        SessionLoggedIn = true;
        loginScreen?.Hide();

        if (cameraIntro != null && cameraIntro.enabled)
            StartCoroutine(cameraIntro.PlayIntro());
        else
            OnIntroComplete();
    }

    /// <summary>强制显示登录 (截图/调试用)</summary>
    public void ShowLoginNow() => loginScreen?.Show();

    /// <summary>开场动画完成回调</summary>
    public void OnIntroComplete()
    {
        _introDone = true;
        Debug.Log("[Lobby] 🌅 秘境展现！");

        Invoke(nameof(ShowUI), uiDelay);
    }

    void ShowUI()
    {
        if (_uiShown) return;
        _uiShown = true;

        if (titleUI != null)
            titleUI.SetActive(true);

        if (interactHint != null)
            interactHint.SetActive(true);

        // 可交互主菜单(进入3D追猎/2D桌游/退出) — 大厅唯一的启动入口
        mainMenu?.Show();

        Debug.Log("[Lobby] 📜 大厅主菜单已显示 (可交互按钮)");
    }

    // ============================================================
    // 场景切换
    // ============================================================

    public void Load3DGame()
    {
        // 进入游戏 → 白天场地(暮色聚落), 之后自动转入夜晚
        SceneManager.LoadScene("DayVillage");
    }

    public void LoadTruthDisc()
    {
        // 进入真相盘 3D 开放世界 (帷幕之域)
        SceneManager.LoadScene("TruthDiscScene");
    }

    // ============================================================
    // 退出
    // ============================================================

    public void QuitGame()
    {
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        Application.Quit();
#endif
    }
}
