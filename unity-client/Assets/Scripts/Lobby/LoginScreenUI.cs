// ============================================================
// LoginScreenUI.cs — 登录界面 (uGUI/Canvas, 全屏, 先于大厅)
// 启动即显示: 输入昵称 + 服务器 → 连接 → 登录后进入大厅。
// 大厅本身是沉浸式(无框), 由 LobbyManager 在 OnLoggedIn 后进入。
// 中文: 依赖 ChineseFont SDF (已注册为默认 TMP 字体 fallback)。
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using TMPro;
using System.Collections;

public class LoginScreenUI : MonoBehaviour
{
    const float DESIGN_W = 1920f, DESIGN_H = 1080f;

    // 暗色大气配色 (幕色)
    static readonly Color C_BG       = new Color(0.016f, 0.013f, 0.040f, 1f);
    static readonly Color C_PANEL    = new Color(0.055f, 0.048f, 0.095f, 0.86f);
    static readonly Color C_HAIRLINE = new Color(0.42f, 0.48f, 0.72f, 0.30f);
    static readonly Color C_TITLE    = new Color(0.93f, 0.89f, 0.99f, 1f);
    static readonly Color C_SUB      = new Color(0.58f, 0.64f, 0.92f, 1f);
    static readonly Color C_LABEL    = new Color(0.76f, 0.79f, 0.90f, 1f);
    static readonly Color C_TAG      = new Color(0.60f, 0.63f, 0.73f, 1f);
    static readonly Color C_FIELD_BG = new Color(0.09f, 0.09f, 0.15f, 0.92f);
    static readonly Color C_FIELD_TX = new Color(0.92f, 0.92f, 0.98f, 1f);
    static readonly Color C_STATUS   = new Color(0.66f, 0.70f, 0.82f, 1f);
    static readonly Color C_EMBER    = new Color(0.78f, 0.46f, 0.16f, 1f);
    static readonly Color C_EMBER_HL = new Color(0.92f, 0.58f, 0.22f, 1f);

    GameObject _root;
    CanvasGroup _group;
    TMP_InputField _nameInput, _serverInput;
    TextMeshProUGUI _status;
    bool _loggedIn;

    void Awake()
    {
        EnsureEventSystem();
        BuildUI();
        Show();
    }

    void Start()
    {
        // Start 在所有 Awake 之后, 此时 NetworkManager.Instance 已就绪
        var net = NetworkManager.Instance;
        if (net != null)
        {
            net.OnConnected += OnConnected;
            net.OnDisconnected += OnDisconnected;
        }
    }

    void OnDestroy()
    {
        var net = NetworkManager.Instance;
        if (net != null)
        {
            net.OnConnected -= OnConnected;
            net.OnDisconnected -= OnDisconnected;
        }
    }

    public void Show()
    {
        if (_root != null) _root.SetActive(true);
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    public void Hide()
    {
        if (_group != null) StartCoroutine(FadeOut());
        else if (_root != null) _root.SetActive(false);
    }

    IEnumerator FadeOut()
    {
        float t = 0f;
        while (t < 0.6f)
        {
            t += Time.deltaTime;
            _group.alpha = Mathf.Lerp(1f, 0f, t / 0.6f);
            yield return null;
        }
        _group.alpha = 1f; // 复位, 便于下次登录
        _root.SetActive(false);
    }

    // ============================================================
    // 登录动作
    // ============================================================

    void Enter()
    {
        string name = _nameInput != null ? _nameInput.text.Trim() : "玩家";
        if (name.Length == 0) name = "玩家";
        string server = _serverInput != null ? _serverInput.text.Trim() : "";
        if (server.Length == 0) server = "http://210.16.170.144:4000";

        PlayerPrefs.SetString("playerName", name);
        PlayerPrefs.SetString("serverUrl", server);
        PlayerPrefs.Save();

        var net = NetworkManager.Instance;
        if (net == null)
        {
            // 无网络管理器(编辑场景) → 直接进入大厅
            LobbyManager.Instance?.OnLoggedIn();
            return;
        }

        net.playerName = name;
        net.serverUrl = server;

        if (net.IsConnected)
        {
            _loggedIn = true;
            _status.text = "已连接，进入大厅...";
            StartCoroutine(EnterDelayed());
            return;
        }

        _status.text = "正在连接服务器...";
        net.Connect();
    }

    void OnConnected()
    {
        if (_loggedIn) return;
        _loggedIn = true;
        _status.text = "已连接，进入大厅...";
        StartCoroutine(EnterDelayed());
    }

    void OnDisconnected()
    {
        if (_loggedIn) return;
        _status.text = "连接失败，请检查服务器地址后重试";
    }

    IEnumerator EnterDelayed()
    {
        yield return new WaitForSeconds(0.7f);
        LobbyManager.Instance?.OnLoggedIn();
    }

    // ============================================================
    // 构建 UI
    // ============================================================

    void BuildUI()
    {
        var canvasGo = new GameObject("LoginCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        canvasGo.transform.SetParent(transform, false);
        var canvas = canvasGo.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 200;   // 盖住大厅, 先于一切
        var scaler = canvasGo.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(DESIGN_W, DESIGN_H);
        scaler.matchWidthOrHeight = 0.5f;

        _root = new GameObject("Root", typeof(RectTransform));
        _root.transform.SetParent(canvasGo.transform, false);
        StretchFull(_root.GetComponent<RectTransform>());
        _group = _root.AddComponent<CanvasGroup>();

        // 全屏不透明幕色 (登录先于大厅, 遮住山谷)
        var bg = AddImage(_root.transform, "Backdrop", C_BG);
        StretchFull(bg.rectTransform);

        var font = TMP_Settings.defaultFontAsset;

        // 中央登录卡片 (登录是表单, 允许有卡片)
        var panel = AddImage(_root.transform, "Panel", C_PANEL);
        var prt = panel.rectTransform;
        prt.anchorMin = prt.anchorMax = new Vector2(0.5f, 0.5f);
        prt.sizeDelta = new Vector2(500f, 620f);
        prt.anchoredPosition = Vector2.zero;

        // 标题
        var title = AddText(panel.transform, "Title", "帷幕之地", font, 60f, C_TITLE, TextAlignmentOptions.Center);
        title.rectTransform.anchorMin = title.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        title.rectTransform.anchoredPosition = new Vector2(0f, 235f);
        title.rectTransform.sizeDelta = new Vector2(460f, 88f);
        title.fontStyle = FontStyles.Bold;
        title.characterSpacing = 6f;
        title.outlineWidth = 0.18f;
        title.outlineColor = new Color32(30, 22, 52, 255);

        // 副标题
        var sub = AddText(panel.transform, "Subtitle", "V E I L   L A N D", font, 19f, C_SUB, TextAlignmentOptions.Center);
        sub.rectTransform.anchorMin = sub.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        sub.rectTransform.anchoredPosition = new Vector2(0f, 178f);
        sub.rectTransform.sizeDelta = new Vector2(460f, 30f);
        sub.characterSpacing = 4f;

        // 标语
        var tag = AddText(panel.transform, "Tagline", "登记你的名字，踏入帷幕之后", font, 15f, C_TAG, TextAlignmentOptions.Center);
        tag.rectTransform.anchorMin = tag.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        tag.rectTransform.anchoredPosition = new Vector2(0f, 138f);
        tag.rectTransform.sizeDelta = new Vector2(460f, 26f);

        // 分隔线
        var line = AddImage(panel.transform, "Divider", C_HAIRLINE);
        line.rectTransform.anchorMin = line.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        line.rectTransform.anchoredPosition = new Vector2(0f, 104f);
        line.rectTransform.sizeDelta = new Vector2(420f, 2f);

        // 昵称
        AddFieldLabel(panel.transform, "昵称", font, new Vector2(0f, 58f));
        _nameInput = AddInputField(panel.transform, "NameInput", font,
            PlayerPrefs.GetString("playerName", "玩家"), new Vector2(0f, 14f));

        // 服务器
        AddFieldLabel(panel.transform, "服务器", font, new Vector2(0f, -34f));
        _serverInput = AddInputField(panel.transform, "ServerInput", font,
            PlayerPrefs.GetString("serverUrl", "http://210.16.170.144:4000"), new Vector2(0f, -78f));

        // 进入按钮
        AddButton(panel.transform, "进入帷幕", font, C_EMBER, C_EMBER_HL,
            new Vector2(0f, -148f), new Vector2(420f, 60f), Enter);

        // 状态行
        _status = AddText(panel.transform, "Status", "等待登录...", font, 15f, C_STATUS, TextAlignmentOptions.Center);
        _status.rectTransform.anchorMin = _status.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
        _status.rectTransform.anchoredPosition = new Vector2(0f, -196f);
        _status.rectTransform.sizeDelta = new Vector2(420f, 28f);
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
        lbl.rectTransform.anchoredPosition = pos + new Vector2(-190f, 0f);
        lbl.rectTransform.sizeDelta = new Vector2(120f, 28f);
    }

    TMP_InputField AddInputField(Transform parent, string name, TMP_FontAsset font, string value, Vector2 pos)
    {
        var bg = AddImage(parent, name, C_FIELD_BG);
        var brt = bg.rectTransform;
        brt.anchorMin = brt.anchorMax = new Vector2(0.5f, 0.5f);
        brt.anchoredPosition = pos;
        brt.sizeDelta = new Vector2(420f, 46f);

        var textGo = new GameObject("Text", typeof(RectTransform));
        textGo.transform.SetParent(bg.transform, false);
        var trt = (RectTransform)textGo.transform;
        trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
        trt.offsetMin = new Vector2(14f, 4f); trt.offsetMax = new Vector2(-14f, -4f);
        var text = textGo.AddComponent<TextMeshProUGUI>();
        text.font = font; text.fontSize = 20f; text.color = C_FIELD_TX;
        text.alignment = TextAlignmentOptions.Left;

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

    static void EnsureEventSystem()
    {
        if (FindFirstObjectByType<EventSystem>() == null)
        {
            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
        }
    }
}
