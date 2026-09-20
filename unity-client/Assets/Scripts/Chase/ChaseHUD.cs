// ============================================================
// ChaseHUD.cs — 「帷幕追猎」HUD (uGUI/Canvas + TMPro)
// 替换 ChaseGameManager 旧 OnGUI (阵营花名册/头顶名字/体力条/灵焰仪式进度/投票/结算/调试入口)。
// 由 ChaseGameManager.Start() 挂到自身 GameObject, 每帧读 gm 状态刷新。
// 中文: 依赖 ChineseFont SDF (已注册为默认 TMP 字体的 fallback)。
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Events;
using TMPro;
using System.Collections.Generic;
using System.Text;

public class ChaseHUD : MonoBehaviour
{
    ChaseGameManager gm;

    const float DESIGN_W = 1920f, DESIGN_H = 1080f;

    // 配色
    static readonly Color C_HUD_BG  = new Color(0.02f, 0.02f, 0.05f, 0.55f);
    static readonly Color C_PANEL   = new Color(0.05f, 0.045f, 0.085f, 0.94f);
    static readonly Color C_TEXT    = new Color(0.95f, 0.95f, 1f, 1f);
    static readonly Color C_CORRUPT = new Color(1f, 0.5f, 0.5f);
    static readonly Color C_KEEPER  = new Color(0.6f, 0.9f, 1f);
    static readonly Color C_DEAD    = new Color(0.55f, 0.55f, 0.58f);
    static readonly Color C_BANNER  = new Color(1f, 0.95f, 0.8f, 1f);
    static readonly Color C_BTN     = new Color(0.12f, 0.14f, 0.24f, 0.92f);
    static readonly Color C_BTN_HL  = new Color(0.30f, 0.45f, 0.70f, 1f);
    static readonly Color C_EMBER   = new Color(0.78f, 0.46f, 0.16f, 1f);
    static readonly Color C_EMBER_HL= new Color(0.92f, 0.58f, 0.22f, 1f);
    static readonly Color C_FIELD_BG= new Color(0.09f, 0.09f, 0.14f, 0.9f);
    static readonly Color C_FIELD_TX= new Color(0.92f, 0.92f, 0.98f, 1f);

    RectTransform canvasRt;
    TMP_FontAsset font;

    // 左上 HUD
    Image hudBg;
    TextMeshProUGUI hudText;
    // 右上存活列表
    TextMeshProUGUI rosterText;
    // 中央横幅
    TextMeshProUGUI bannerText;
    // 体力条
    GameObject staminaRoot;
    Image staminaFill;
    // 投票面板
    GameObject votePanel;
    TextMeshProUGUI voteTitle;
    // 结算面板
    GameObject overPanel;
    TextMeshProUGUI overText;
    // 入口面板 (调试)
    GameObject entryPanel;
    TMP_InputField entryServer, entryName, entryRoom;
    TextMeshProUGUI entryStatus;
    Button entryConnectBtn;
    GameObject entryLobbyGroup;   // create/join/start 区块
    Button entryStartBtn;
    // 名字标签池
    readonly Dictionary<string, TextMeshProUGUI> nameLabels = new Dictionary<string, TextMeshProUGUI>();
    readonly List<string> activeLabelIds = new List<string>();

    bool _wasVotePhase = false;

    // ============================================================
    // Lifecycle
    // ============================================================

    void Awake()
    {
        gm = ChaseGameManager.Instance;
        BuildUI();
    }

    void Update()
    {
        if (gm == null) { gm = ChaseGameManager.Instance; if (gm == null) return; }
        Refresh();
    }

    // ============================================================
    // 每帧刷新
    // ============================================================

    void Refresh()
    {
        bool inGame = gm.gameActive || gm.gameOver;

        hudBg.gameObject.SetActive(inGame);
        rosterText.gameObject.SetActive(inGame);
        staminaRoot.SetActive(inGame && gm.localPlayer != null);
        votePanel.SetActive(inGame && gm.currentPhase == "VOTE" && !gm.gameOver);
        overPanel.SetActive(inGame && gm.gameOver);
        entryPanel.SetActive(!inGame);

        if (!inGame) { RefreshEntryPanel(); return; }

        RefreshHUDText();
        RefreshRoster();
        RefreshStamina();
        RefreshBanner();
        RefreshVotePanel();
        RefreshGameOver();
        RefreshNameLabels();
    }

    // ============================================================
    // 左上 HUD 信息
    // ============================================================

    void RefreshHUDText()
    {
        var sb = new StringBuilder();
        sb.Append("身份: ").Append(ChaseGameManager.RoleName(gm.myRole))
          .Append("  ·  ").Append(ChaseGameManager.TeamName(gm.myTeam)).Append('\n');
        if (!string.IsNullOrEmpty(gm.myCharacterId))
            sb.Append("表层身份: ").Append(gm.myCharacterId).Append('\n');
        sb.Append("阶段: ").Append(ChaseGameManager.PhaseText(gm.currentPhase)).Append('\n');

        if (gm.isNight)
            sb.Append("夜晚剩余: ").Append(Mathf.CeilToInt(gm.nightTimeLeft)).Append("s\n");
        else if (!gm.gameOver && (gm.currentPhase == "DAY" || gm.currentPhase == "VOTE" || gm.currentPhase == "DISCUSSION"))
            sb.Append("剩余: ").Append(Mathf.CeilToInt(gm.phaseTimeLeft)).Append("s\n");

        if (gm.isCorrupted && gm.isNight && !gm.localDead)
        {
            sb.Append(gm.cdRemaining > 0f
                ? "攻击冷却: " + gm.cdRemaining.ToString("0.0") + "s\n"
                : "攻击就绪 [F]\n");
        }
        if (!gm.isCorrupted && gm.localPlayer != null)
        {
            sb.Append(gm.localPlayer.isHidden ? "藏匿中 [Q 离开]\n" : "藏匿就绪 [Q]\n");
        }
        if (!gm.isCorrupted && gm.isNight && !gm.localDead)
        {
            sb.Append("灵焰: ").Append(gm.flamesCollected).Append('/').Append(gm.flamesTotal);
            sb.Append(gm.flamesTotal > 0 && gm.flamesCollected >= gm.flamesTotal
                ? " — 到广场 [R] 引导仪式\n" : " — [E] 采集\n");
            if (gm.ritualActive)
                sb.Append("仪式引导中: ").Append(Mathf.CeilToInt(gm.ritualTimeLeft)).Append("s\n");
        }
        if (gm.localDead) sb.Append("你已阵亡 — 旁观中\n");

        hudText.text = sb.ToString();
    }

    void RefreshRoster()
    {
        var sb = new StringBuilder();
        sb.Append("存活者\n");
        foreach (var kv in gm.roster)
        {
            var p = kv.Value;
            bool corrupt = (p.team == "CORRUPTED") || ChaseGameManager.IsCorruptedRole(p.role);
            // 夜晚只发阵营不发货职业: 自己显示真实职业, 他人只显示阵营(蚀者/守幕者)
            string roleLabel = (p.id == gm.myPlayerId)
                ? ChaseGameManager.RoleName(gm.myRole)
                : ChaseGameManager.TeamName(p.team);
            string line = (p.alive ? "" : "亡 ") + p.name
                        + (p.id == gm.myPlayerId ? " (你)" : "")
                        + " — " + roleLabel;
            string hex = Hex(!p.alive ? C_DEAD : (corrupt ? C_CORRUPT : C_KEEPER));
            sb.Append("<color=#").Append(hex).Append('>').Append(line).Append("</color>\n");
        }
        rosterText.text = sb.ToString();
    }

    void RefreshStamina()
    {
        var lp = gm.localPlayer;
        float ratio = (lp != null && lp.maxStamina > 0f)
            ? Mathf.Clamp01(lp.currentStamina / lp.maxStamina) : 1f;
        staminaFill.fillAmount = ratio;
        staminaFill.color = ratio > 0.4f
            ? new Color(0.4f, 0.85f, 0.5f, 1f)
            : new Color(1f, 0.5f, 0.4f, 1f);
    }

    void RefreshBanner()
    {
        bool show = gm.bannerTimer > 0f && !string.IsNullOrEmpty(gm.banner);
        bannerText.gameObject.SetActive(show);
        if (show) bannerText.text = gm.banner;
    }

    // ============================================================
    // 投票 / 结算
    // ============================================================

    void RefreshVotePanel()
    {
        bool showVote = gm.currentPhase == "VOTE" && !gm.gameOver;
        if (!showVote) { _wasVotePhase = false; return; }

        if (!_wasVotePhase)
        {
            _wasVotePhase = true;
            RebuildVoteButtons();
        }
        voteTitle.text = gm.voted ? "已投票，等待结果…" : "投票 — 选出要放逐的人";
        SetButtonsInteractable(votePanel.transform, !gm.voted);
    }

    void RebuildVoteButtons()
    {
        // 清空旧按钮 (保留标题)
        for (int i = votePanel.transform.childCount - 1; i >= 0; i--)
        {
            var child = votePanel.transform.GetChild(i);
            if (child == voteTitle.transform) continue;
            Destroy(child.gameObject);
        }

        foreach (var kv in gm.roster)
        {
            if (kv.Key == gm.myPlayerId || !kv.Value.alive) continue;
            var id = kv.Key;
            var label = kv.Value.name + " (" + ChaseGameManager.RoleName(kv.Value.role) + ")";
            AddVoteButton(label, () => gm.SubmitVote(id));
        }
        AddVoteButton("弃权/跳过", () => gm.SkipVote());
    }

    void AddVoteButton(string label, UnityAction onClick)
    {
        var img = AddImage(votePanel.transform, "VoteBtn", C_BTN);
        var btn = img.gameObject.AddComponent<Button>();
        btn.targetGraphic = img;
        var colors = btn.colors;
        colors.normalColor = C_BTN;
        colors.highlightedColor = C_BTN_HL;
        colors.pressedColor = Color.Lerp(C_BTN_HL, Color.black, 0.2f);
        colors.fadeDuration = 0.1f;
        btn.colors = colors;
        btn.onClick.AddListener(onClick);

        AddLayoutElement(img.gameObject, 42f);
        var t = AddText(img.transform, "Text", label, font, 18f, Color.white, TextAlignmentOptions.Center);
        t.fontStyle = FontStyles.Bold;
        StretchFull(t.rectTransform);
    }

    void SetButtonsInteractable(Transform root, bool interactable)
    {
        foreach (var btn in root.GetComponentsInChildren<Button>(true))
            btn.interactable = interactable;
    }

    void RefreshGameOver()
    {
        var sb = new StringBuilder();
        sb.Append("胜方: ").Append(gm.overWinner).Append('\n');
        if (!string.IsNullOrEmpty(gm.overReason))
            sb.Append("原因: ").Append(gm.overReason).Append('\n');
        sb.Append("\n—— 全员身份 ——\n");
        foreach (var kv in gm.roster)
        {
            sb.Append(kv.Value.name).Append(" → ").Append(ChaseGameManager.RoleName(kv.Value.role))
              .Append(" (").Append(ChaseGameManager.TeamName(kv.Value.team)).Append(")\n");
        }
        overText.text = sb.ToString();
    }

    // ============================================================
    // 头顶名字 (世界坐标 → 屏幕空间, 池化标签)
    // ============================================================

    void RefreshNameLabels()
    {
        if (Camera.main == null) { HideAllNameLabels(); return; }
        var cam = Camera.main;
        activeLabelIds.Clear();

        if (gm.localPlayer != null && !string.IsNullOrEmpty(gm.myPlayerId))
        {
            string myName = NetworkManager.Instance != null ? NetworkManager.Instance.playerName : "我";
            SetNameLabel(gm.myPlayerId, gm.localPlayer.transform.position + Vector3.up * 2.3f,
                         string.IsNullOrEmpty(myName) ? "我" : myName, Color.white);
        }

        foreach (var kv in gm.remotePlayers)
        {
            if (kv.Value == null) continue;
            var p = gm.roster.TryGetValue(kv.Key, out var ps) ? ps : null;
            bool corrupt = p != null && ((p.team == "CORRUPTED") || ChaseGameManager.IsCorruptedRole(p.role));
            Color c = p != null && !p.alive ? C_DEAD : (corrupt ? C_CORRUPT : C_KEEPER);
            SetNameLabel(kv.Key, kv.Value.transform.position + Vector3.up * 2.3f, (p != null ? p.name : kv.Key), c);
        }

        // 隐藏本帧未出现 (已离开) 的标签
        foreach (var kv in nameLabels)
            if (!activeLabelIds.Contains(kv.Key) && kv.Value != null)
                kv.Value.gameObject.SetActive(false);
    }

    void SetNameLabel(string id, Vector3 worldPos, string text, Color color)
    {
        Vector3 sp = Camera.main.WorldToScreenPoint(worldPos);
        if (sp.z < 0f) return;   // 在镜头后方

        var label = GetNameLabel(id);
        Vector2 local;
        if (RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRt, sp, null, out local))
        {
            label.rectTransform.anchoredPosition = local;
            label.text = text;
            label.color = color;
            label.gameObject.SetActive(true);
            activeLabelIds.Add(id);
        }
    }

    TextMeshProUGUI GetNameLabel(string id)
    {
        if (nameLabels.TryGetValue(id, out var l) && l != null) return l;

        var go = new GameObject("Name_" + id, typeof(RectTransform));
        go.transform.SetParent(canvasRt, false);
        var rt = (RectTransform)go.transform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(320f, 30f);

        var tmp = go.AddComponent<TextMeshProUGUI>();
        tmp.font = font;
        tmp.fontSize = 20f;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.fontStyle = FontStyles.Bold;
        tmp.raycastTarget = false;
        tmp.outlineWidth = 0.16f;
        tmp.outlineColor = new Color32(0, 0, 0, 200);

        nameLabels[id] = tmp;
        return tmp;
    }

    void HideAllNameLabels()
    {
        foreach (var kv in nameLabels)
            if (kv.Value != null) kv.Value.gameObject.SetActive(false);
    }

    // ============================================================
    // 调试入口 (ChaseScene 直启时用, 大厅流程已替换)
    // ============================================================

    void RefreshEntryPanel()
    {
        var net = NetworkManager.Instance;
        bool connected = net != null && net.IsConnected;

        entryConnectBtn.gameObject.SetActive(!connected);
        entryLobbyGroup.SetActive(connected);
        entryStartBtn.gameObject.SetActive(connected && net != null && net.IsHost);
        entryStatus.text = "状态: " + gm.uiStatus;
    }

    void EntryConnect()
    {
        var net = NetworkManager.Instance;
        if (net == null) return;
        net.serverUrl = entryServer.text.Trim();
        net.playerName = entryName.text.Trim();
        gm.uiServer = net.serverUrl;
        gm.uiName = net.playerName;
        gm.uiStatus = "连接中...";
        net.Connect();
    }

    void EntryCreateRoom()
    {
        var net = NetworkManager.Instance;
        if (net == null) return;
        net.playerName = entryName.text.Trim();
        gm.uiName = net.playerName;
        net.CreateRoom("THIRD_PERSON", 12, code =>
        {
            if (!string.IsNullOrEmpty(code)) { gm.uiRoom = code; gm.uiStatus = "已创建房码: " + code; }
            else gm.uiStatus = "创建失败 (见 Console)";
        });
    }

    void EntryJoinRoom()
    {
        var net = NetworkManager.Instance;
        if (net == null) return;
        net.playerName = entryName.text.Trim();
        gm.uiName = net.playerName;
        string room = entryRoom.text.Trim();
        gm.uiRoom = room;
        net.JoinRoom(room, ok => gm.uiStatus = ok ? "已加入: " + room : "加入失败 (见 Console)");
    }

    void EntryStartGame()
    {
        var net = NetworkManager.Instance;
        if (net == null) return;
        net.StartGame();
        gm.uiStatus = "已请求开始...";
    }

    // ============================================================
    // 构建 UI
    // ============================================================

    void BuildUI()
    {
        var canvasGo = new GameObject("ChaseHUDCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        canvasGo.transform.SetParent(transform, false);
        var canvas = canvasGo.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 100;
        var scaler = canvasGo.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(DESIGN_W, DESIGN_H);
        scaler.matchWidthOrHeight = 0.5f;
        canvasRt = canvasGo.GetComponent<RectTransform>();

        font = TMP_Settings.defaultFontAsset;

        BuildHUD(canvasRt);
        BuildRoster(canvasRt);
        BuildBanner(canvasRt);
        BuildStamina(canvasRt);
        BuildVotePanel(canvasRt);
        BuildOverPanel(canvasRt);
        BuildEntryPanel(canvasRt);
    }

    void BuildHUD(RectTransform parent)
    {
        hudBg = AddImage(parent, "HUD", C_HUD_BG);
        var rt = hudBg.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
        rt.pivot = new Vector2(0f, 1f);
        rt.anchoredPosition = new Vector2(12f, -12f);
        rt.sizeDelta = new Vector2(360f, 240f);

        hudText = AddText(hudBg.transform, "Text", "", font, 18f, C_TEXT, TextAlignmentOptions.TopLeft);
        var trt = hudText.rectTransform;
        trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
        trt.offsetMin = new Vector2(14f, 10f); trt.offsetMax = new Vector2(-10f, -10f);
        hudText.lineSpacing = 2f;
    }

    void BuildRoster(RectTransform parent)
    {
        var bg = AddImage(parent, "Roster", C_HUD_BG);
        var rt = bg.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(1f, 1f);
        rt.anchoredPosition = new Vector2(-12f, -12f);
        rt.sizeDelta = new Vector2(300f, 420f);

        rosterText = AddText(bg.transform, "Text", "", font, 17f, C_TEXT, TextAlignmentOptions.TopLeft);
        var trt = rosterText.rectTransform;
        trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
        trt.offsetMin = new Vector2(14f, 10f); trt.offsetMax = new Vector2(-10f, -10f);
        rosterText.lineSpacing = 2f;
    }

    void BuildBanner(RectTransform parent)
    {
        bannerText = AddText(parent, "Banner", "", font, 34f, C_BANNER, TextAlignmentOptions.Center);
        var rt = bannerText.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 1f);
        rt.pivot = new Vector2(0.5f, 1f);
        rt.anchoredPosition = new Vector2(0f, -324f);   // 约 30% 屏高
        rt.sizeDelta = new Vector2(1200f, 70f);
        bannerText.fontStyle = FontStyles.Bold;
        bannerText.outlineWidth = 0.18f;
        bannerText.outlineColor = new Color32(0, 0, 0, 200);
        bannerText.gameObject.SetActive(false);
    }

    void BuildStamina(RectTransform parent)
    {
        staminaRoot = new GameObject("Stamina", typeof(RectTransform));
        staminaRoot.transform.SetParent(parent, false);
        var rt = (RectTransform)staminaRoot.transform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = new Vector2(0f, 40f);
        rt.sizeDelta = new Vector2(320f, 14f);

        var bg = staminaRoot.AddComponent<Image>();
        bg.color = new Color(0f, 0f, 0f, 0.5f);

        var fillGo = new GameObject("Fill", typeof(RectTransform));
        fillGo.transform.SetParent(staminaRoot.transform, false);
        var frt = (RectTransform)fillGo.transform;
        frt.anchorMin = Vector2.zero; frt.anchorMax = Vector2.one;
        frt.offsetMin = Vector2.zero; frt.offsetMax = Vector2.zero;
        staminaFill = fillGo.AddComponent<Image>();
        staminaFill.type = Image.Type.Filled;
        staminaFill.fillMethod = Image.FillMethod.Horizontal;
        staminaFill.fillAmount = 1f;
    }

    void BuildVotePanel(RectTransform parent)
    {
        var img = AddImage(parent, "VotePanel", C_PANEL);
        votePanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = new Vector2(0f, 40f);
        rt.sizeDelta = new Vector2(420f, 500f);

        var vlg = votePanel.AddComponent<VerticalLayoutGroup>();
        vlg.spacing = 8f;
        vlg.padding = new RectOffset(16, 16, 16, 16);
        vlg.childForceExpandWidth = true;
        vlg.childControlWidth = true;
        vlg.childControlHeight = true;
        vlg.childForceExpandHeight = false;

        voteTitle = AddText(rt, "Title", "投票 — 选出要放逐的人", font, 26f, C_TEXT, TextAlignmentOptions.Center);
        voteTitle.fontStyle = FontStyles.Bold;
        AddLayoutElement(voteTitle.gameObject, 46f);

        votePanel.SetActive(false);
    }

    void BuildOverPanel(RectTransform parent)
    {
        var img = AddImage(parent, "OverPanel", C_PANEL);
        overPanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = Vector2.zero;
        rt.sizeDelta = new Vector2(520f, 460f);

        var title = AddText(rt, "Title", "游戏结束", font, 40f, C_TEXT, TextAlignmentOptions.Center);
        title.fontStyle = FontStyles.Bold;
        var trt = title.rectTransform;
        trt.anchorMin = trt.anchorMax = new Vector2(0.5f, 1f);
        trt.pivot = new Vector2(0.5f, 1f);
        trt.anchoredPosition = new Vector2(0f, -16f);
        trt.sizeDelta = new Vector2(480f, 60f);

        overText = AddText(rt, "Body", "", font, 20f, C_TEXT, TextAlignmentOptions.TopLeft);
        var brt = overText.rectTransform;
        brt.anchorMin = Vector2.zero; brt.anchorMax = Vector2.one;
        brt.offsetMin = new Vector2(20f, 16f);
        brt.offsetMax = new Vector2(-20f, -86f);
        overText.lineSpacing = 2f;

        overPanel.SetActive(false);
    }

    void BuildEntryPanel(RectTransform parent)
    {
        var img = AddImage(parent, "EntryPanel", C_PANEL);
        entryPanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
        rt.pivot = new Vector2(0f, 1f);
        rt.anchoredPosition = new Vector2(24f, -24f);
        rt.sizeDelta = new Vector2(440f, 620f);

        var vlg = entryPanel.AddComponent<VerticalLayoutGroup>();
        vlg.spacing = 8f;
        vlg.padding = new RectOffset(18, 18, 18, 18);
        vlg.childForceExpandWidth = true;
        vlg.childControlWidth = true;
        vlg.childControlHeight = true;
        vlg.childForceExpandHeight = false;

        var title = AddText(rt, "Title", "== 帷幕追猎 · 调试入口 ==", font, 22f, C_TEXT, TextAlignmentOptions.Center);
        title.fontStyle = FontStyles.Bold;
        AddLayoutElement(title.gameObject, 34f);

        AddLayoutElement(AddText(rt, "L_Server", "服务器", font, 16f, new Color(0.76f, 0.79f, 0.90f), TextAlignmentOptions.Left).gameObject, 24f);
        entryServer = AddInputField(rt, "ServerInput", font, PlayerPrefs.GetString("serverUrl", "http://210.16.170.144:4000"));

        AddLayoutElement(AddText(rt, "L_Name", "昵称", font, 16f, new Color(0.76f, 0.79f, 0.90f), TextAlignmentOptions.Left).gameObject, 24f);
        entryName = AddInputField(rt, "NameInput", font, PlayerPrefs.GetString("playerName", "玩家"));

        entryConnectBtn = AddButton(rt, "连接", font, C_EMBER, C_EMBER_HL, () => EntryConnect(), 20f, 44f);

        entryLobbyGroup = new GameObject("LobbyGroup", typeof(RectTransform), typeof(VerticalLayoutGroup));
        entryLobbyGroup.transform.SetParent(rt, false);
        var gvlg = entryLobbyGroup.GetComponent<VerticalLayoutGroup>();
        gvlg.spacing = 8f;
        gvlg.childForceExpandWidth = true;
        gvlg.childControlWidth = true;
        gvlg.childControlHeight = true;
        gvlg.childForceExpandHeight = false;

        AddButton(entryLobbyGroup.transform, "创建 3D 房 (THIRD_PERSON)", font, C_EMBER, C_EMBER_HL, () => EntryCreateRoom(), 18f, 44f);

        AddLayoutElement(AddText(entryLobbyGroup.transform, "L_Room", "房间码", font, 16f, new Color(0.76f, 0.79f, 0.90f), TextAlignmentOptions.Left).gameObject, 24f);
        entryRoom = AddInputField(entryLobbyGroup.transform, "RoomInput", font, "");

        AddButton(entryLobbyGroup.transform, "加入房间", font, C_BTN, C_BTN_HL, () => EntryJoinRoom(), 18f, 44f);
        entryStartBtn = AddButton(entryLobbyGroup.transform, "开始游戏 (房主)", font, C_EMBER, C_EMBER_HL, () => EntryStartGame(), 18f, 44f);

        entryStatus = AddText(rt, "Status", "状态: 未连接", font, 15f, new Color(0.60f, 0.63f, 0.73f), TextAlignmentOptions.Left);
        AddLayoutElement(entryStatus.gameObject, 24f);

        entryPanel.SetActive(false);
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

    static void AddLayoutElement(GameObject go, float preferredHeight)
    {
        var le = go.GetComponent<LayoutElement>();
        if (le == null) le = go.AddComponent<LayoutElement>();
        le.preferredHeight = preferredHeight;
    }

    static string Hex(Color c) => ColorUtility.ToHtmlStringRGB(c);

    Image AddImage(Transform parent, string name, Color color)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        var img = go.AddComponent<Image>();
        img.color = color;
        return img;
    }

    TextMeshProUGUI AddText(Transform parent, string name, string text, TMP_FontAsset f,
                            float size, Color color, TextAlignmentOptions align)
    {
        var go = new GameObject(name, typeof(RectTransform));
        go.transform.SetParent(parent, false);
        var tmp = go.AddComponent<TextMeshProUGUI>();
        tmp.text = text;
        tmp.font = f;
        tmp.fontSize = size;
        tmp.color = color;
        tmp.alignment = align;
        tmp.raycastTarget = false;
        return tmp;
    }

    Button AddButton(Transform parent, string label, TMP_FontAsset f,
                     Color bgColor, Color hlColor, UnityAction onClick, float fontSize, float height)
    {
        var img = AddImage(parent, "Btn_" + label, bgColor);
        var btn = img.gameObject.AddComponent<Button>();
        btn.targetGraphic = img;
        var colors = btn.colors;
        colors.normalColor = bgColor;
        colors.highlightedColor = hlColor;
        colors.pressedColor = Color.Lerp(hlColor, Color.black, 0.2f);
        colors.fadeDuration = 0.12f;
        btn.colors = colors;
        btn.onClick.AddListener(onClick);

        AddLayoutElement(img.gameObject, height);
        var t = AddText(img.transform, "Text", label, f, fontSize, Color.white, TextAlignmentOptions.Center);
        t.fontStyle = FontStyles.Bold;
        StretchFull(t.rectTransform);
        return btn;
    }

    TMP_InputField AddInputField(Transform parent, string name, TMP_FontAsset f, string value)
    {
        var bg = AddImage(parent, name, C_FIELD_BG);
        AddLayoutElement(bg.gameObject, 46f);

        var textGo = new GameObject("Text", typeof(RectTransform));
        textGo.transform.SetParent(bg.transform, false);
        var trt = (RectTransform)textGo.transform;
        StretchFull(trt);
        trt.offsetMin = new Vector2(14f, 4f); trt.offsetMax = new Vector2(-14f, -4f);
        var text = textGo.AddComponent<TextMeshProUGUI>();
        text.font = f; text.fontSize = 19f; text.color = C_FIELD_TX;
        text.alignment = TextAlignmentOptions.Left;

        var phGo = new GameObject("Placeholder", typeof(RectTransform));
        phGo.transform.SetParent(bg.transform, false);
        var phRt = (RectTransform)phGo.transform;
        StretchFull(phRt);
        phRt.offsetMin = new Vector2(14f, 4f); phRt.offsetMax = new Vector2(-14f, -4f);
        var ph = phGo.AddComponent<TextMeshProUGUI>();
        ph.font = f; ph.fontSize = 19f; ph.color = new Color(0.5f, 0.52f, 0.62f, 1f);
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
}
