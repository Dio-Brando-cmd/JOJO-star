// ============================================================
// LobbyManager.cs — 大厅主控
// 管理开场 → 巨石交互 → 场景切换 → UI 显示
// ============================================================

using UnityEngine;
using UnityEngine.SceneManagement;

public class LobbyManager : MonoBehaviour
{
    public static LobbyManager Instance { get; private set; }

    [Header("══ 引用(自动查找) ══")]
    public LobbyCameraIntro cameraIntro;
    public LobbySceneSetup sceneSetup;

    [Header("══ UI ══")]
    public GameObject titleUI;      // 标题 Canvas（可选）
    public GameObject interactHint;  // 交互提示（可选）
    public float uiDelay = 1.5f;     // 开场完成后多久显示 UI

    [Header("══ 状态 ══")]
    [SerializeField] private bool _introDone;
    [SerializeField] private bool _uiShown;

    public bool IntroDone => _introDone;

    void Awake()
    {
        if (Instance == null) Instance = this;
        else { Destroy(gameObject); return; }
    }

    void Start()
    {
        // 自动查找
        if (cameraIntro == null)
            cameraIntro = FindFirstObjectByType<LobbyCameraIntro>();
        if (sceneSetup == null)
            sceneSetup = FindFirstObjectByType<LobbySceneSetup>();

        // 初始隐藏 UI
        if (titleUI != null) titleUI.SetActive(false);
        if (interactHint != null) interactHint.SetActive(false);

        // 构建场景（如果尚未构建）
        if (sceneSetup != null && sceneSetup.buildOnStart)
        {
            // LobbySceneSetup 会在自己的 Start 里构建
        }

        Debug.Log("[Lobby] 帷幕之地 大厅已就绪");
        Debug.Log("[Lobby] 🎬 等待桃花源镜头...");
        Debug.Log("[Lobby] ⌨️  按空格可跳过动画");
    }

    void Update()
    {
        // 空格跳过
        if (!_introDone && Input.GetKeyDown(KeyCode.Space))
        {
            cameraIntro?.Skip();
        }

        // 任意键显示 UI
        if (_introDone && !_uiShown && Input.anyKeyDown)
        {
            ShowUI();
        }
    }

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

        Debug.Log("[Lobby] 📜 UI 已显示");
    }

    // ============================================================
    // 场景切换
    // ============================================================

    public void Load2DGame()
    {
        var stone = sceneSetup?.StoneLeftScript;
        if (stone != null) stone.EnterPortal();
        else SceneManager.LoadScene("MainScene");
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
