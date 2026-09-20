// ============================================================
// LobbyImmersiveUI.cs — 沉浸式大厅 UI (无框)
// 登录进入大厅后显示: 大标题淡入淡出 + 底部提示。无面板框。
// 游戏模式进入由符文巨石承载 (LobbyStone, 走向按 E)。
// 中文: 依赖 ChineseFont SDF (默认 TMP 字体 fallback)。
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class LobbyImmersiveUI : MonoBehaviour
{
    const float DESIGN_W = 1920f, DESIGN_H = 1080f;

    static readonly Color C_TITLE = new Color(0.93f, 0.89f, 0.99f, 1f);
    static readonly Color C_SUB   = new Color(0.58f, 0.64f, 0.92f, 1f);
    static readonly Color C_HINT  = new Color(0.72f, 0.75f, 0.86f, 1f);

    GameObject _root;
    CanvasGroup _titleGroup;    // 标题+副标题 (淡入淡出后隐去)
    CanvasGroup _hintGroup;     // 底部提示 (淡入后常驻)
    float _t;
    bool _playing;

    void Awake()
    {
        BuildUI();
        _root.SetActive(false);
    }

    public void ShowImmersive()
    {
        if (_root == null) return;
        _root.SetActive(true);
        _playing = true;
        _t = 0f;
        _titleGroup.alpha = 0f;
        _hintGroup.alpha = 0f;
    }

    void Update()
    {
        if (!_playing) return;
        _t += Time.deltaTime;

        // 标题: 0→1.4s 淡入, 1.4→3.8s 保持, 3.8→5.2s 淡出
        float titleA;
        if (_t < 1.4f) titleA = _t / 1.4f;
        else if (_t < 3.8f) titleA = 1f;
        else if (_t < 5.2f) titleA = 1f - (_t - 3.8f) / 1.4f;
        else titleA = 0f;
        _titleGroup.alpha = titleA;

        // 提示: 1.2s 后淡入并常驻
        _hintGroup.alpha = Mathf.Clamp01((_t - 1.2f) / 1.4f);
    }

    // ============================================================
    // 构建 UI
    // ============================================================

    void BuildUI()
    {
        var canvasGo = new GameObject("ImmersiveCanvas", typeof(Canvas), typeof(CanvasScaler));
        canvasGo.transform.SetParent(transform, false);
        var canvas = canvasGo.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 60;   // 低于登录(200), 高于世界
        var scaler = canvasGo.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(DESIGN_W, DESIGN_H);
        scaler.matchWidthOrHeight = 0.5f;

        _root = new GameObject("Root", typeof(RectTransform));
        _root.transform.SetParent(canvasGo.transform, false);
        StretchFull(_root.GetComponent<RectTransform>());

        var font = TMP_Settings.defaultFontAsset;

        // ── 标题组 ──
        var titleGroup = new GameObject("TitleGroup", typeof(RectTransform), typeof(CanvasGroup));
        titleGroup.transform.SetParent(_root.transform, false);
        _titleGroup = titleGroup.GetComponent<CanvasGroup>();

        var title = AddText(titleGroup.transform, "Title", "帷幕之地", font, 64f, C_TITLE, TextAlignmentOptions.Center);
        var trt = title.rectTransform;
        trt.anchorMin = trt.anchorMax = new Vector2(0.5f, 0.5f);
        trt.anchoredPosition = new Vector2(0f, 260f);
        trt.sizeDelta = new Vector2(900f, 100f);
        title.fontStyle = FontStyles.Bold;
        title.characterSpacing = 8f;
        title.outlineWidth = 0.20f;
        title.outlineColor = new Color32(30, 22, 52, 255);

        var sub = AddText(titleGroup.transform, "Subtitle", "V E I L   L A N D", font, 20f, C_SUB, TextAlignmentOptions.Center);
        var srt = sub.rectTransform;
        srt.anchorMin = srt.anchorMax = new Vector2(0.5f, 0.5f);
        srt.anchoredPosition = new Vector2(0f, 204f);
        srt.sizeDelta = new Vector2(700f, 30f);
        sub.characterSpacing = 5f;
        sub.outlineWidth = 0.12f;
        sub.outlineColor = new Color32(30, 22, 52, 255);

        // ── 提示组 ──
        var hintGroup = new GameObject("HintGroup", typeof(RectTransform), typeof(CanvasGroup));
        hintGroup.transform.SetParent(_root.transform, false);
        _hintGroup = hintGroup.GetComponent<CanvasGroup>();

        var hint = AddText(hintGroup.transform, "Hint",
            "走向符文巨石 · 左：2D 桌游 · 右：3D 追猎 · 按 E 进入", font, 19f, C_HINT, TextAlignmentOptions.Center);
        var hrt = hint.rectTransform;
        hrt.anchorMin = hrt.anchorMax = new Vector2(0.5f, 0f);
        hrt.anchoredPosition = new Vector2(0f, 64f);
        hrt.sizeDelta = new Vector2(1200f, 32f);
        hint.outlineWidth = 0.12f;
        hint.outlineColor = new Color32(20, 16, 40, 255);
    }

    // ============================================================
    // 辅助
    // ============================================================

    static void StretchFull(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
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
}
