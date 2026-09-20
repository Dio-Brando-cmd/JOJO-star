// ============================================================
// LobbyMainMenuUI.cs — 大厅主菜单 (uGUI/Canvas, 程序化构建)
// 替换旧 OnGUI 版 LobbyMainMenu, 提供真正的自适应排版:
//   标题「帷幕之地」+ 副标题 + 昵称/服务器输入 + 3D 追猎入口 + 退出
// 由 LobbyManager 在开场动画后调用 Show() 显示。
// 中文: 依赖 ChineseFont SDF (已注册为默认 TMP 字体的 fallback)。
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Events;
using TMPro;

public class LobbyMainMenuUI : MonoBehaviour
{
    public static LobbyMainMenuUI Instance { get; private set; }

    const float DESIGN_W = 1920f, DESIGN_H = 1080f;

    // 暮色·桃花源 配色
    static readonly Color C_BACKDROP = new Color(0.015f, 0.012f, 0.045f, 0.55f);
    static readonly Color C_PANEL    = new Color(0.05f, 0.045f, 0.085f, 0.94f);
    static readonly Color C_HAIRLINE = new Color(0.42f, 0.48f, 0.72f, 0.35f);
    static readonly Color C_TITLE    = new Color(0.93f, 0.89f, 0.99f, 1f);
    static readonly Color C_SUB      = new Color(0.58f, 0.64f, 0.92f, 1f);
    static readonly Color C_LABEL    = new Color(0.76f, 0.79f, 0.90f, 1f);
    static readonly Color C_HINT     = new Color(0.60f, 0.63f, 0.73f, 1f);
    static readonly Color C_FIELD_BG = new Color(0.09f, 0.09f, 0.14f, 0.9f);
    static readonly Color C_FIELD_TX = new Color(0.92f, 0.92f, 0.98f, 1f);

    // 按钮: 3D 追猎(暖橙/主), 退出(暗灰)
    static readonly Color C_EMBER    = new Color(0.78f, 0.46f, 0.16f, 1f);
    static readonly Color C_EMBER_HL = new Color(0.92f, 0.58f, 0.22f, 1f);
    static readonly Color C_DIM      = new Color(0.20f, 0.20f, 0.26f, 1f);
    static readonly Color C_DIM_HL   = new Color(0.28f, 0.28f, 0.36f, 1f);

    GameObject _root;
    TMP_InputField _nameInput;
    TMP_InputField _serverInput;

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;

        BuildUI();
        _root.SetActive(false);
    }

    void OnDestroy()
    {
        if (Instance == this) Instance = null;
    }

    public void Show()
    {
        // 登录界面刚写入的最新昵称/服务器 → 同步进输入框, 避免用 Awake 时的旧值覆盖
        if (_nameInput != null) _nameInput.text = PlayerPrefs.GetString("playerName", "玩家");
        if (_serverInput != null) _serverInput.text = PlayerPrefs.GetString("serverUrl", "http://210.16.170.144:4000");

        if (_root != null) _root.SetActive(true);
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    public void Hide()
    {
        if (_root != null) _root.SetActive(false);
    }

    // ============================================================
    // 构建 UI
    // ============================================================

    void BuildUI()
    {
        var canvasGo = new GameObject("LobbyMainMenuCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        canvasGo.transform.SetParent(transform, false);
        var canvas = canvasGo.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 100;
        var scaler = canvasGo.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(DESIGN_W, DESIGN_H);
        scaler.matchWidthOrHeight = 0.5f;

        _root = new GameObject("Root", typeof(RectTransform));
        _root.transform.SetParent(canvasGo.transform, false);
        var rootRt = _root.GetComponent<RectTransform>();
        StretchFull(rootRt);

        // 全屏暗色遮罩 (透出 3D 山谷)
        var backdrop = AddImage(_root.transform, "Backdrop", C_BACKDROP);
        StretchFull(backdrop.rectTransform);

        // 中央菜单面板
        var panel = AddImage(_root.transform, "Panel", C_PANEL);
        var prt = panel.rectTransform;
        prt.anchorMin = prt.anchorMax = new Vector2(0.5f, 0.5f);
        prt.sizeDelta = new Vector2(560f, 560f);
        prt.anchoredPosition = Vector2.zero;

        var font = TMP_Settings.defaultFontAsset;

        // 标题
        var title = AddText(panel.transform, "Title", "帷幕之地", font, 62f, C_TITLE, TextAlignmentOptions.Center);
        title.rectTransform.anchorMin = title.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        title.rectTransform.anchoredPosition = new Vector2(0f, 245f);
        title.rectTransform.sizeDelta = new Vector2(520f, 90f);
        title.fontStyle = FontStyles.Bold;
        title.characterSpacing = 6f;
        title.outlineWidth = 0.18f;
        title.outlineColor = new Color32(30, 22, 52, 255);

        // 副标题
        var sub = AddText(panel.transform, "Subtitle", "V E I L   L A N D", font, 19f, C_SUB, TextAlignmentOptions.Center);
        sub.rectTransform.anchorMin = sub.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        sub.rectTransform.anchoredPosition = new Vector2(0f, 190f);
        sub.rectTransform.sizeDelta = new Vector2(520f, 30f);
        sub.characterSpacing = 4f;

        // 分隔线
        var line = AddImage(panel.transform, "Divider", C_HAIRLINE);
        line.rectTransform.anchorMin = line.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        line.rectTransform.anchoredPosition = new Vector2(0f, 152f);
        line.rectTransform.sizeDelta = new Vector2(460f, 2f);

        // 昵称
        AddFieldLabel(panel.transform, "昵称", font, new Vector2(0f, 104f));
        _nameInput = AddInputField(panel.transform, "NameInput", font,
            PlayerPrefs.GetString("playerName", "玩家"), new Vector2(0f, 60f));

        // 服务器
        AddFieldLabel(panel.transform, "服务器", font, new Vector2(0f, 12f));
        _serverInput = AddInputField(panel.transform, "ServerInput", font,
            PlayerPrefs.GetString("serverUrl", "http://210.16.170.144:4000"), new Vector2(0f, -32f));

        // 主按钮: 进入 3D 追猎
        AddButton(panel.transform, "进入 3D 追猎", font, C_EMBER, C_EMBER_HL, new Vector2(0f, -108f), new Vector2(440f, 58f),
            Enter3D);

        // 退出游戏 (次级, 无填充)
        AddButton(panel.transform, "退出游戏", font, C_DIM, C_DIM_HL, new Vector2(0f, -180f), new Vector2(440f, 40f),
            QuitGame, 16f);

        // 底部提示
        var hint = AddText(panel.transform, "Hint", "或走向符文巨石按 E 进入", font, 15f, C_HINT, TextAlignmentOptions.Center);
        hint.rectTransform.anchorMin = hint.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        hint.rectTransform.anchoredPosition = new Vector2(0f, -226f);
        hint.rectTransform.sizeDelta = new Vector2(440f, 26f);
    }

    // ============================================================
    // 构建辅助
    // ============================================================

    static void StretchFull(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    Image AddImage(Transform parent, string name, Color color)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        var img = go.AddComponent<Image>();
        img.color = color;
        return img;
    }

    TextMeshProUGUI AddText(Transform parent, string name, string text, TMP_FontAsset font,
                            float size, Color color, TextAlignmentOptions align)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        var tmp = go.AddComponent<TextMeshProUGUI>();
        tmp.text = text;
        tmp.font = font;
        tmp.fontSize = size;
        tmp.color = color;
        tmp.alignment = align;
        tmp.raycastTarget = false;
        return tmp;
    }

    void AddFieldLabel(Transform parent, string text, TMP_FontAsset font, Vector2 pos)
    {
        var lbl = AddText(parent, "Label_" + text, text, font, 17f, C_LABEL, TextAlignmentOptions.Left);
        lbl.rectTransform.anchorMin = lbl.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        lbl.rectTransform.anchoredPosition = pos + new Vector2(-205f, 0f);
        lbl.rectTransform.sizeDelta = new Vector2(120f, 28f);
    }

    TMP_InputField AddInputField(Transform parent, string name, TMP_FontAsset font, string value, Vector2 pos)
    {
        // 背景
        var bg = AddImage(parent, name, C_FIELD_BG);
        var brt = bg.rectTransform;
        brt.anchorMin = brt.anchorMax = new Vector2(0.5f, 0.5f);
        brt.anchoredPosition = pos;
        brt.sizeDelta = new Vector2(440f, 46f);

        // 文本区
        var textGo = new GameObject("Text", typeof(RectTransform));
        textGo.transform.SetParent(bg.transform, false);
        var trt = (RectTransform)textGo.transform;
        trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
        trt.offsetMin = new Vector2(14f, 4f); trt.offsetMax = new Vector2(-14f, -4f);
        var text = textGo.AddComponent<TextMeshProUGUI>();
        text.font = font; text.fontSize = 20f; text.color = C_FIELD_TX;
        text.alignment = TextAlignmentOptions.Left;

        // 占位符
        var phGo = new GameObject("Placeholder", typeof(RectTransform));
        phGo.transform.SetParent(bg.transform, false);
        var phRt = (RectTransform)phGo.transform;
        phRt.anchorMin = Vector2.zero; phRt.anchorMax = Vector2.one;
        phRt.offsetMin = new Vector2(14f, 4f); phRt.offsetMax = new Vector2(-14f, -4f);
        var ph = phGo.AddComponent<TextMeshProUGUI>();
        ph.font = font; ph.fontSize = 20f; ph.color = new Color(0.5f, 0.52f, 0.62f, 1f);
        ph.alignment = TextAlignmentOptions.Left;
        ph.fontStyle = FontStyles.Italic;
        ph.enableWordWrapping = false;

        var input = bg.gameObject.AddComponent<TMP_InputField>();
        input.textComponent = text;
        input.placeholder = ph;
        input.textViewport = trt;
        input.text = value;
        input.caretColor = C_EMBER;
        input.selectionColor = new Color(0.95f, 0.62f, 0.28f, 0.35f);
        return input;
    }

    void AddButton(Transform parent, string label, TMP_FontAsset font,
                   Color bgColor, Color hlColor, Vector2 pos, Vector2 size,
                   UnityAction onClick, float fontSize = 22f)
    {
        var img = AddImage(parent, "Btn_" + label, bgColor);
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;

        var btn = img.gameObject.AddComponent<Button>();
        btn.targetGraphic = img;
        var colors = btn.colors;
        colors.normalColor = bgColor;
        colors.highlightedColor = hlColor;
        colors.pressedColor = Color.Lerp(hlColor, Color.black, 0.15f);
        colors.selectedColor = hlColor;
        colors.fadeDuration = 0.12f;
        btn.colors = colors;
        btn.onClick.AddListener(onClick);

        var txt = AddText(img.transform, "Text", label, font, fontSize, Color.white, TextAlignmentOptions.Center);
        txt.fontStyle = FontStyles.Bold;
        var trt = txt.rectTransform;
        trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
        trt.offsetMin = Vector2.zero; trt.offsetMax = Vector2.zero;
    }

    // ============================================================
    // 回调
    // ============================================================

    void SaveSettings()
    {
        if (_nameInput != null) PlayerPrefs.SetString("playerName", _nameInput.text.Trim());
        if (_serverInput != null) PlayerPrefs.SetString("serverUrl", _serverInput.text.Trim());
        PlayerPrefs.Save();
    }

    void Enter3D()
    {
        SaveSettings();
        if (LobbyManager.Instance != null) LobbyManager.Instance.Load3DGame();
        else UnityEngine.SceneManagement.SceneManager.LoadScene("ChaseScene");
    }

    void QuitGame()
    {
        SaveSettings();
        if (LobbyManager.Instance != null) LobbyManager.Instance.QuitGame();
        else
        {
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }
    }
}
