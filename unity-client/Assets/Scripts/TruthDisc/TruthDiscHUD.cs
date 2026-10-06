// ============================================================
// TruthDiscHUD.cs — 「真相盘」3D HUD (uGUI/Canvas + TMPro)
// 镜像 ChaseHUD 纯代码 uGUI 范式。由 TruthDiscGameManager.Start() 挂载。
// 面板: 身份+三时钟 / 花名册 / 我的碎片·契约 / 任务+区域 / 日志 /
//       动作条 / 横幅 / 猜神弹窗 / 终局屏 / 调试入口。
// 中文: 依赖 ChineseFont SDF fallback。emoji 统一 StripEmoji。
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Events;
using TMPro;
using System.Text;
using System.Collections.Generic;

public class TruthDiscHUD : MonoBehaviour
{
    TruthDiscGameManager gm;

    const float DESIGN_W = 1920f, DESIGN_H = 1080f;

    static readonly Color C_PANEL    = new Color(0.05f, 0.045f, 0.085f, 0.94f);
    static readonly Color C_HUD_BG   = new Color(0.02f, 0.02f, 0.05f, 0.55f);
    static readonly Color C_TEXT     = new Color(0.95f, 0.95f, 1f, 1f);
    static readonly Color C_LABEL    = new Color(0.76f, 0.79f, 0.90f, 1f);
    static readonly Color C_SPIRIT   = new Color(0.35f, 0.9f, 1f);
    static readonly Color C_DESPAIR  = new Color(1f, 0.45f, 0.4f);
    static readonly Color C_VEIL     = new Color(0.7f, 0.5f, 1f);
    static readonly Color C_BANNER   = new Color(1f, 0.95f, 0.8f, 1f);
    static readonly Color C_BTN      = new Color(0.12f, 0.14f, 0.24f, 0.92f);
    static readonly Color C_BTN_HL   = new Color(0.30f, 0.45f, 0.70f, 1f);
    static readonly Color C_EMBER    = new Color(0.78f, 0.46f, 0.16f, 1f);
    static readonly Color C_EMBER_HL = new Color(0.92f, 0.58f, 0.22f, 1f);
    static readonly Color C_FIELD_BG = new Color(0.09f, 0.09f, 0.14f, 0.9f);
    static readonly Color C_FIELD_TX = new Color(0.92f, 0.92f, 0.98f, 1f);

    RectTransform canvasRt;
    TMP_FontAsset font;

    // 面板
    GameObject leftTop, rosterPanel, myInfoPanel, taskPanel, logPanel, actionBar;
    GameObject bannerGo, guessPanel, overPanel, entryPanel;

    // 左上
    TextMeshProUGUI identityText;
    Image spiritFill, despairFill, veilFill;
    TextMeshProUGUI spiritLabel, despairLabel, veilLabel;

    // 右侧 / 中部
    TextMeshProUGUI rosterText, myInfoText, taskText, logText, bannerText, overText;

    // 动作条按钮
    Button guessBtn, burnVeilBtn, burnFalseBtn, revealBtn, purifyBtn;
    TextMeshProUGUI contextLabel;

    // 猜神弹窗
    readonly List<Button> guessButtons = new List<Button>();
    bool guessOpen;

    // 调试入口
    TMP_InputField entryServer, entryName, entryRoom;
    TextMeshProUGUI entryStatus;
    Button entryConnectBtn;
    GameObject entryLobbyGroup;
    Button entryStartBtn;

    // 名字标签池 (头顶)
    readonly Dictionary<string, TextMeshProUGUI> nameLabels = new Dictionary<string, TextMeshProUGUI>();
    readonly List<string> activeLabelIds = new List<string>();

    // 帷幕倒计时 (本地近似)
    int _lastVeil = -1;
    float _veilTimer;

    // ==================== Lifecycle ====================

    void Awake()
    {
        gm = TruthDiscGameManager.Instance;
        BuildUI();
    }

    void Update()
    {
        if (gm == null) { gm = TruthDiscGameManager.Instance; if (gm == null) return; }
        if (_veilTimer > 0) _veilTimer -= Time.deltaTime;
        Refresh();
    }

    void Refresh()
    {
        bool inGame = gm.gameActive || gm.gameOver;
        leftTop.SetActive(inGame);
        rosterPanel.SetActive(inGame);
        myInfoPanel.SetActive(inGame);
        taskPanel.SetActive(inGame);
        logPanel.SetActive(inGame);
        actionBar.SetActive(inGame && !gm.gameOver);
        overPanel.SetActive(inGame && gm.gameOver);
        guessPanel.SetActive(inGame && !gm.gameOver && guessOpen);
        entryPanel.SetActive(!inGame);

        if (!inGame) { RefreshEntry(); return; }

        RefreshIdentity();
        RefreshClocks();
        RefreshRoster();
        RefreshMyInfo();
        RefreshTasks();
        RefreshLog();
        RefreshBanner();
        RefreshActions();
        RefreshGameOver();
        RefreshNameLabels();
    }

    // ==================== 左上: 身份 + 三时钟 ====================

    void RefreshIdentity()
    {
        var sb = new StringBuilder();
        sb.Append("座次 ").Append(gm.mySeat ?? "?").Append(" · ")
          .Append(TruthData.TeamLabel(gm.myTeam)).Append(" · ")
          .Append(TruthData.RoleLabel(gm.myRole)).Append('\n');
        int phase = gm.state != null ? gm.state.enginePhase : 1;
        sb.Append("阶段 ").Append(phase).Append(" · ").Append(TruthData.PhaseLabel(phase)).Append('\n');
        sb.Append("当前区域: ").Append(string.IsNullOrEmpty(gm.serverMyZone) ? "—" : gm.serverMyZone);
        identityText.text = sb.ToString();
    }

    void RefreshClocks()
    {
        var c = gm.state != null ? gm.state.clocks : null;
        if (c == null) return;

        float spiritMax = gm.state.rules != null ? Mathf.Max(1, gm.state.rules.spiritMax) : 100;
        int spiritGoal = (gm.state.rules != null ? gm.state.rules.spiritMax : 100);
        spiritFill.fillAmount = Mathf.Clamp01(c.spirit / 120f);
        spiritLabel.text = "灵焰 " + c.spirit + "/" + spiritGoal;

        despairFill.fillAmount = Mathf.Clamp01(c.despair / 100f);
        despairLabel.text = "绝望 " + c.despair + "/100";

        int veilMax = gm.state.rules != null ? Mathf.Max(1, gm.state.rules.veilConsumeMax) : 5;
        veilFill.fillAmount = Mathf.Clamp01(c.veil / (float)veilMax);

        // 帷幕倒计时近似
        int interval = gm.state.rules != null ? gm.state.rules.veilConsumeIntervalSec : 90;
        if (_lastVeil < 0) { _lastVeil = c.veil; _veilTimer = interval; }
        else if (c.veil != _lastVeil) { _lastVeil = c.veil; _veilTimer = interval; }

        var vlsb = new StringBuilder();
        vlsb.Append("帷幕 ").Append(c.veil).Append('/').Append(veilMax);
        if (c.veil < veilMax) vlsb.Append(" · 吞噬倒计时 ").Append(Mathf.CeilToInt(_veilTimer)).Append("s");
        if (gm.state.ebbWindow) vlsb.Append(" · 退潮窗口开启");
        veilLabel.text = vlsb.ToString();
    }

    // ==================== 花名册 (终局才显示身份) ====================

    void RefreshRoster()
    {
        bool reveal = gm.gameOver || (gm.state != null && !string.IsNullOrEmpty(gm.state.winner));
        var sb = new StringBuilder();
        sb.Append("花名册\n");
        foreach (var kv in gm.roster)
        {
            var p = kv.Value;
            string line = (p.alive ? "" : "亡 ") + p.name + (p.id == gm.mySeat ? " (你)" : "");
            if (reveal) line += " → " + TruthData.RoleLabel(p.role) + "(" + TruthData.TeamLabel(p.team) + ")";
            sb.Append(line).Append('\n');
        }
        rosterText.text = sb.ToString();
    }

    // ==================== 我的碎片 / 契约 / 队友 ====================

    void RefreshMyInfo()
    {
        var p = gm.priv;
        if (p == null) { myInfoText.text = "—"; return; }

        var sb = new StringBuilder();

        sb.Append("—— 我的碎片 (").Append(p.myShards != null ? p.myShards.Length : 0).Append(") ——\n");
        if (p.myShards != null)
            foreach (var s in p.myShards)
            {
                if (s == null) continue;
                string text = TruthData.StripEmoji(s.text);
                if (string.IsNullOrEmpty(text)) continue;
                if (text.Length > 18) text = text.Substring(0, 18) + "…";
                sb.Append("· ").Append(text);
                sb.Append(" (指向 ").Append(TruthData.GodName(s.hintGod?.id)).Append(")\n");
            }

        sb.Append("\n—— 我的契约 ——\n");
        if (p.myContract != null)
        {
            sb.Append(TruthData.ContractName(p.myContract.id)).Append(" (+").Append(p.myContract.points).Append(")\n");
            sb.Append(TruthData.StripEmoji(p.myContract.desc)).Append('\n');
            if (p.guardTarget != null) sb.Append("守护目标: ").Append(p.guardTarget.name).Append('\n');
            if (p.reincarnationOf != null) sb.Append("转世真名: ").Append(TruthData.GodName(p.reincarnationOf.id)).Append('\n');
        }

        if (gm.isCorrupted && p.fellowCorrupted != null && p.fellowCorrupted.Length > 0)
        {
            sb.Append("\n—— 食神者队友 ——\n");
            foreach (var f in p.fellowCorrupted) sb.Append(f.name).Append(' ');
            sb.Append('\n');
        }

        myInfoText.text = sb.ToString();
    }

    // ==================== 任务 + 区域 ====================

    void RefreshTasks()
    {
        var sb = new StringBuilder();
        sb.Append("—— 任务 ——\n");
        if (gm.state != null && gm.state.tasks != null)
            foreach (var t in gm.state.tasks)
            {
                if (t == null) continue;
                var anchor = TruthZones.TaskAnchorOf(t.name);
                string zone = anchor != null ? anchor.zone : "?";
                string mark = t.sabotaged ? "✗破坏" : t.completed ? "✓完成" : "▸";
                sb.Append(mark).Append(' ').Append(t.name).Append(" — ").Append(zone).Append('\n');
            }

        sb.Append("\n—— 区域 ——\n");
        if (gm.state != null && gm.state.zones != null)
            foreach (var z in gm.state.zones)
            {
                if (z == null) continue;
                string mark = z.consumed ? "❌吞噬" : " ";
                string extra = (z.name == gm.serverMyZone ? "◈你" : "")
                             + (gm.state.purifyPoint != null && gm.state.purifyPoint.zone == z.name ? "·净化" : "");
                sb.Append(mark).Append(' ').Append(z.name).Append(' ').Append(extra).Append('\n');
            }

        taskText.text = sb.ToString();
    }

    void RefreshLog()
    {
        if (gm.state == null || gm.state.log == null) { logText.text = ""; return; }
        var sb = new StringBuilder();
        int start = Mathf.Max(0, gm.state.log.Length - 8);
        for (int i = start; i < gm.state.log.Length; i++)
            sb.Append(TruthData.StripEmoji(gm.state.log[i])).Append('\n');
        logText.text = sb.ToString();
    }

    void RefreshBanner()
    {
        bool show = gm.bannerTimer > 0f && !string.IsNullOrEmpty(gm.banner);
        bannerGo.SetActive(show);
        if (show) bannerText.text = gm.banner;
    }

    // ==================== 动作条 ====================

    void RefreshActions()
    {
        if (gm.state == null) return;
        bool isSpirit = gm.isSpirit;
        int phase = gm.state.enginePhase;
        int spirit = gm.state.clocks != null ? gm.state.clocks.spirit : 0;

        guessBtn.interactable = true;
        burnVeilBtn.interactable = isSpirit && phase >= 3;
        burnFalseBtn.interactable = true;
        revealBtn.interactable = gm.priv != null && gm.priv.reincarnationOf != null;
        purifyBtn.interactable = isSpirit && spirit >= 100;

        // 上下文提示
        var csb = new StringBuilder();
        csb.Append("E: ");
        if (gm.isCorrupted) csb.Append("破坏任务");
        else csb.Append("任务/净化");
        csb.Append("   F: ");
        if (gm.isVeilKeeper && phase >= 2 && !gm.blunderbussUsed) csb.Append("短铳");
        else csb.Append("献祭");
        contextLabel.text = csb.ToString();
    }

    // ==================== 终局屏 ====================

    void RefreshGameOver()
    {
        var sb = new StringBuilder();
        string winner = gm.overWinner ?? gm.state?.winner;
        sb.Append("胜方: ").Append(TruthData.TeamLabel(winner)).Append('\n');
        if (!string.IsNullOrEmpty(gm.overReason ?? gm.state?.reason))
            sb.Append("原因: ").Append(TruthData.StripEmoji(gm.overReason ?? gm.state.reason)).Append('\n');
        if (gm.state != null && gm.state.god != null)
            sb.Append("真神: ").Append(gm.state.god.name).Append('\n');

        sb.Append("\n—— 个人契约分 ——\n");
        if (gm.state != null && gm.state.scores != null)
            foreach (var s in gm.state.scores)
            {
                if (s == null) continue;
                sb.Append(s.name).Append(" · ").Append(TruthData.ContractName(s.contract))
                  .Append(" · ").Append(s.points).Append("分\n");
            }

        if (gm.state != null && !string.IsNullOrEmpty(gm.state.seed))
            sb.Append("\n种子: ").Append(gm.state.seed).Append('\n');

        overText.text = sb.ToString();
    }

    // ==================== 头顶名字 ====================

    void RefreshNameLabels()
    {
        if (Camera.main == null) { HideAllNameLabels(); return; }
        var cam = Camera.main;
        activeLabelIds.Clear();

        if (gm.localPlayer != null && !string.IsNullOrEmpty(gm.myPlayerId))
        {
            string myName = NetworkManager.Instance != null ? NetworkManager.Instance.playerName : "我";
            SetNameLabel(gm.myPlayerId, gm.localPlayer.transform.position + Vector3.up * 2.3f,
                         string.IsNullOrEmpty(myName) ? "我" : myName, new Color(0.6f, 0.8f, 1f));
        }

        foreach (var kv in gm.remotePlayers)
        {
            if (kv.Value == null) continue;
            string nm = gm.socketSeatName(kv.Key);
            bool alive = gm.socketSeatAlive(kv.Key);
            Color c = alive ? new Color(0.9f, 0.9f, 0.95f) : new Color(0.5f, 0.5f, 0.55f);
            SetNameLabel(kv.Key, kv.Value.transform.position + Vector3.up * 2.3f, nm, c);
        }

        foreach (var kv in nameLabels)
            if (!activeLabelIds.Contains(kv.Key) && kv.Value != null)
                kv.Value.gameObject.SetActive(false);
    }

    void SetNameLabel(string id, Vector3 worldPos, string text, Color color)
    {
        Vector3 sp = Camera.main.WorldToScreenPoint(worldPos);
        if (sp.z < 0f) return;
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
        tmp.font = font; tmp.fontSize = 20f; tmp.alignment = TextAlignmentOptions.Center;
        tmp.fontStyle = FontStyles.Bold; tmp.raycastTarget = false;
        tmp.outlineWidth = 0.16f; tmp.outlineColor = new Color32(0, 0, 0, 200);
        nameLabels[id] = tmp;
        return tmp;
    }

    void HideAllNameLabels()
    {
        foreach (var kv in nameLabels) if (kv.Value != null) kv.Value.gameObject.SetActive(false);
    }

    // ==================== 猜神弹窗 ====================

    void ToggleGuess() { guessOpen = !guessOpen; }

    void ChooseGod(string godId)
    {
        guessOpen = false;
        gm.ActionGuess(godId);
    }

    // ==================== 调试入口 ====================

    void RefreshEntry()
    {
        var net = NetworkManager.Instance;
        bool connected = net != null && net.IsConnected;
        entryConnectBtn.gameObject.SetActive(!connected);
        entryLobbyGroup.SetActive(connected);
        entryStartBtn.gameObject.SetActive(connected && net != null && net.IsHost);
        entryStatus.text = "状态: " + gm.uiStatus;
    }

    void EntryConnect() { gm.uiServer = entryServer.text.Trim(); gm.uiName = entryName.text.Trim(); gm.EntryConnect(); }
    void EntryCreateRoom() { gm.uiName = entryName.text.Trim(); gm.EntryCreateRoom(); }
    void EntryJoinRoom() { gm.uiName = entryName.text.Trim(); gm.uiRoom = entryRoom.text.Trim(); gm.EntryJoinRoom(); }
    void EntryStartGame() { gm.EntryStartGame(); }
    void EntryLeave() { gm.EntryLeave(); }

    // ============================================================
    // 构建 UI
    // ============================================================

    void BuildUI()
    {
        var canvasGo = new GameObject("TruthDiscHUDCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
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

        BuildLeftTop(canvasRt);
        BuildRoster(canvasRt);
        BuildMyInfo(canvasRt);
        BuildTasks(canvasRt);
        BuildLog(canvasRt);
        BuildBanner(canvasRt);
        BuildActionBar(canvasRt);
        BuildGuessPanel(canvasRt);
        BuildOverPanel(canvasRt);
        BuildEntryPanel(canvasRt);
    }

    void BuildLeftTop(RectTransform parent)
    {
        leftTop = AddImage(parent, "LeftTop", C_HUD_BG).gameObject;
        var rt = (RectTransform)leftTop.transform;
        rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
        rt.pivot = new Vector2(0f, 1f);
        rt.anchoredPosition = new Vector2(12f, -12f);
        rt.sizeDelta = new Vector2(440f, 250f);

        identityText = AddText(leftTop.transform, "Identity", "", font, 17f, C_TEXT, TextAlignmentOptions.TopLeft);
        var itrt = identityText.rectTransform;
        itrt.anchorMin = itrt.anchorMax = new Vector2(0f, 1f);
        itrt.pivot = new Vector2(0f, 1f);
        itrt.anchoredPosition = new Vector2(14f, -10f);
        itrt.sizeDelta = new Vector2(410f, 66f);
        identityText.richText = false;

        spiritFill = BuildBar(leftTop.transform, "SpiritBar", new Vector2(14f, -86f), new Vector2(410f, 13f), C_SPIRIT);
        spiritLabel = AddText(leftTop.transform, "SpiritLabel", "灵焰", font, 15f, C_SPIRIT, TextAlignmentOptions.Left);
        SetTopAnchor(spiritLabel.rectTransform, new Vector2(14f, -66f), new Vector2(300f, 20f));

        despairFill = BuildBar(leftTop.transform, "DespairBar", new Vector2(14f, -128f), new Vector2(410f, 13f), C_DESPAIR);
        despairLabel = AddText(leftTop.transform, "DespairLabel", "绝望", font, 15f, C_DESPAIR, TextAlignmentOptions.Left);
        SetTopAnchor(despairLabel.rectTransform, new Vector2(14f, -108f), new Vector2(300f, 20f));

        veilFill = BuildBar(leftTop.transform, "VeilBar", new Vector2(14f, -170f), new Vector2(410f, 13f), C_VEIL);
        veilLabel = AddText(leftTop.transform, "VeilLabel", "帷幕", font, 15f, C_VEIL, TextAlignmentOptions.Left);
        SetTopAnchor(veilLabel.rectTransform, new Vector2(14f, -150f), new Vector2(410f, 20f));
    }

    Image BuildBar(Transform parent, string name, Vector2 pos, Vector2 size, Color color)
    {
        var bg = AddImage(parent, name, new Color(0f, 0f, 0f, 0.5f));
        var rt = bg.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
        rt.pivot = new Vector2(0f, 1f);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;

        var fillGo = new GameObject("Fill", typeof(RectTransform));
        fillGo.transform.SetParent(bg.transform, false);
        var frt = (RectTransform)fillGo.transform;
        frt.anchorMin = Vector2.zero; frt.anchorMax = Vector2.one;
        frt.offsetMin = Vector2.zero; frt.offsetMax = Vector2.zero;
        var fill = fillGo.AddComponent<Image>();
        fill.type = Image.Type.Filled;
        fill.fillMethod = Image.FillMethod.Horizontal;
        fill.color = color;
        fill.fillAmount = 0f;
        return fill;
    }

    void SetTopAnchor(RectTransform rt, Vector2 pos, Vector2 size)
    {
        rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
        rt.pivot = new Vector2(0f, 1f);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;
    }

    void BuildRoster(RectTransform parent)
    {
        var img = AddImage(parent, "Roster", C_HUD_BG);
        rosterPanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(1f, 1f);
        rt.anchoredPosition = new Vector2(-12f, -12f);
        rt.sizeDelta = new Vector2(300f, 300f);

        rosterText = AddText(rosterPanel.transform, "Text", "", font, 16f, C_TEXT, TextAlignmentOptions.TopLeft);
        Stretch(rosterText.rectTransform, 12f, 8f);
    }

    void BuildMyInfo(RectTransform parent)
    {
        var img = AddImage(parent, "MyInfo", C_HUD_BG);
        myInfoPanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot = new Vector2(1f, 1f);
        rt.anchoredPosition = new Vector2(-12f, -322f);
        rt.sizeDelta = new Vector2(300f, 420f);

        myInfoText = AddText(myInfoPanel.transform, "Text", "", font, 15f, C_TEXT, TextAlignmentOptions.TopLeft);
        Stretch(myInfoText.rectTransform, 12f, 8f);
        myInfoText.lineSpacing = 2f;
    }

    void BuildTasks(RectTransform parent)
    {
        var img = AddImage(parent, "Tasks", C_HUD_BG);
        taskPanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
        rt.pivot = new Vector2(0f, 1f);
        rt.anchoredPosition = new Vector2(12f, -272f);
        rt.sizeDelta = new Vector2(440f, 520f);

        taskText = AddText(taskPanel.transform, "Text", "", font, 15f, C_TEXT, TextAlignmentOptions.TopLeft);
        Stretch(taskText.rectTransform, 12f, 8f);
        taskText.lineSpacing = 2f;
    }

    void BuildLog(RectTransform parent)
    {
        var img = AddImage(parent, "Log", C_HUD_BG);
        logPanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = new Vector2(0f, 0f); rt.anchorMax = new Vector2(0f, 0f);
        rt.pivot = new Vector2(0f, 0f);
        rt.anchoredPosition = new Vector2(12f, 12f);
        rt.sizeDelta = new Vector2(640f, 150f);

        logText = AddText(logPanel.transform, "Text", "", font, 14f, C_LABEL, TextAlignmentOptions.BottomLeft);
        Stretch(logText.rectTransform, 12f, 8f);
        logText.lineSpacing = 1f;
    }

    void BuildBanner(RectTransform parent)
    {
        bannerGo = new GameObject("Banner", typeof(RectTransform));
        bannerGo.transform.SetParent(parent, false);
        var rt = (RectTransform)bannerGo.transform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 1f);
        rt.pivot = new Vector2(0.5f, 1f);
        rt.anchoredPosition = new Vector2(0f, -150f);
        rt.sizeDelta = new Vector2(1200f, 70f);
        bannerText = bannerGo.AddComponent<TextMeshProUGUI>();
        bannerText.font = font; bannerText.fontSize = 34f; bannerText.color = C_BANNER;
        bannerText.alignment = TextAlignmentOptions.Center; bannerText.fontStyle = FontStyles.Bold;
        bannerText.outlineWidth = 0.18f; bannerText.outlineColor = new Color32(0, 0, 0, 200);
        bannerGo.SetActive(false);
    }

    void BuildActionBar(RectTransform parent)
    {
        var img = AddImage(parent, "ActionBar", C_HUD_BG);
        actionBar = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0f);
        rt.pivot = new Vector2(0.5f, 0f);
        rt.anchoredPosition = new Vector2(0f, 12f);
        rt.sizeDelta = new Vector2(760f, 84f);

        var hlg = actionBar.AddComponent<HorizontalLayoutGroup>();
        hlg.spacing = 8f; hlg.padding = new RectOffset(12, 12, 12, 12);
        hlg.childForceExpandWidth = true; hlg.childControlWidth = true;
        hlg.childControlHeight = true; hlg.childForceExpandHeight = false;

        guessBtn = AddActionButton("猜神", () => ToggleGuess());
        burnVeilBtn = AddActionButton("烧帷幕", () => gm.ActionBurnVeil());
        burnFalseBtn = AddActionButton("焚伪碎片", () => gm.ActionBurnFalse());
        revealBtn = AddActionButton("揭露真名", () => gm.ActionReveal());
        purifyBtn = AddActionButton("净化", () => gm.TryPurify());
    }

    Button AddActionButton(string label, UnityAction onClick)
    {
        var img = AddImage(actionBar.transform, "ABtn_" + label, C_BTN);
        var btn = img.gameObject.AddComponent<Button>();
        btn.targetGraphic = img;
        var colors = btn.colors;
        colors.normalColor = C_BTN; colors.highlightedColor = C_BTN_HL;
        colors.pressedColor = Color.Lerp(C_BTN_HL, Color.black, 0.2f);
        colors.fadeDuration = 0.1f;
        btn.colors = colors;
        btn.onClick.AddListener(onClick);
        var le = img.gameObject.AddComponent<LayoutElement>();
        le.preferredHeight = 54f;
        var t = AddText(img.transform, "Text", label, font, 18f, Color.white, TextAlignmentOptions.Center);
        t.fontStyle = FontStyles.Bold;
        Stretch(t.rectTransform);
        return btn;
    }

    void BuildGuessPanel(RectTransform parent)
    {
        var img = AddImage(parent, "GuessPanel", C_PANEL);
        guessPanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = Vector2.zero;
        rt.sizeDelta = new Vector2(560f, 360f);

        var title = AddText(rt, "Title", "猜测真神（猜测结果不公开）", font, 24f, C_TEXT, TextAlignmentOptions.Center);
        title.fontStyle = FontStyles.Bold;
        var trt = title.rectTransform;
        trt.anchorMin = trt.anchorMax = new Vector2(0.5f, 1f);
        trt.pivot = new Vector2(0.5f, 1f);
        trt.anchoredPosition = new Vector2(0f, -16f);
        trt.sizeDelta = new Vector2(520f, 40f);

        var grid = new GameObject("Grid", typeof(RectTransform), typeof(GridLayoutGroup));
        grid.transform.SetParent(rt, false);
        var grt = (RectTransform)grid.transform;
        grt.anchorMin = Vector2.zero; grt.anchorMax = Vector2.one;
        grt.offsetMin = new Vector2(20f, 20f); grt.offsetMax = new Vector2(-20f, -70f);
        var glg = grid.GetComponent<GridLayoutGroup>();
        glg.cellSize = new Vector2(245f, 46f);
        glg.spacing = new Vector2(12f, 12f);
        glg.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
        glg.constraintCount = 2;

        for (int i = 0; i < TruthData.GODS.Length; i++)
        {
            var g = TruthData.GODS[i];
            var id = g.id;
            var bimg = AddImage(grid.transform, "God_" + id, C_BTN);
            var btn = bimg.gameObject.AddComponent<Button>();
            btn.targetGraphic = bimg;
            var colors = btn.colors;
            colors.normalColor = C_BTN; colors.highlightedColor = C_BTN_HL;
            colors.fadeDuration = 0.1f;
            btn.colors = colors;
            btn.onClick.AddListener(() => ChooseGod(id));
            guessButtons.Add(btn);
            var t = AddText(bimg.transform, "Text", g.name, font, 18f, Color.white, TextAlignmentOptions.Center);
            Stretch(t.rectTransform);
        }

        guessPanel.SetActive(false);
    }

    void BuildOverPanel(RectTransform parent)
    {
        var img = AddImage(parent, "OverPanel", C_PANEL);
        overPanel = img.gameObject;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = Vector2.zero;
        rt.sizeDelta = new Vector2(620f, 560f);

        var title = AddText(rt, "Title", "真相揭晓", font, 40f, C_TEXT, TextAlignmentOptions.Center);
        title.fontStyle = FontStyles.Bold;
        var trt = title.rectTransform;
        trt.anchorMin = trt.anchorMax = new Vector2(0.5f, 1f);
        trt.pivot = new Vector2(0.5f, 1f);
        trt.anchoredPosition = new Vector2(0f, -16f);
        trt.sizeDelta = new Vector2(580f, 60f);

        overText = AddText(rt, "Body", "", font, 19f, C_TEXT, TextAlignmentOptions.TopLeft);
        Stretch(overText.rectTransform, 20f, 70f);
        overText.lineSpacing = 2f;

        var leaveBtn = AddImage(rt, "LeaveBtn", C_EMBER);
        var lrt = leaveBtn.rectTransform;
        lrt.anchorMin = lrt.anchorMax = new Vector2(0.5f, 0f);
        lrt.pivot = new Vector2(0.5f, 0f);
        lrt.anchoredPosition = new Vector2(0f, 20f);
        lrt.sizeDelta = new Vector2(300f, 48f);
        var lb = leaveBtn.gameObject.AddComponent<Button>();
        lb.targetGraphic = leaveBtn;
        lb.onClick.AddListener(() => gm.EntryLeave());
        var lt = AddText(leaveBtn.transform, "Text", "返回大厅", font, 20f, Color.white, TextAlignmentOptions.Center);
        lt.fontStyle = FontStyles.Bold;
        Stretch(lt.rectTransform);

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
        rt.sizeDelta = new Vector2(460f, 560f);

        var vlg = entryPanel.AddComponent<VerticalLayoutGroup>();
        vlg.spacing = 8f; vlg.padding = new RectOffset(18, 18, 18, 18);
        vlg.childForceExpandWidth = true; vlg.childControlWidth = true;
        vlg.childControlHeight = true; vlg.childForceExpandHeight = false;

        var title = AddText(rt, "Title", "== 真相盘 3D · 调试入口 ==", font, 22f, C_TEXT, TextAlignmentOptions.Center);
        title.fontStyle = FontStyles.Bold;
        AddLayoutElement(title.gameObject, 34f);

        AddLayoutElement(AddText(rt, "L_Server", "服务器", font, 16f, C_LABEL, TextAlignmentOptions.Left).gameObject, 24f);
        entryServer = AddInputField(rt, "ServerInput", font, PlayerPrefs.GetString("serverUrl", "http://210.16.170.144:4000"));

        AddLayoutElement(AddText(rt, "L_Name", "昵称", font, 16f, C_LABEL, TextAlignmentOptions.Left).gameObject, 24f);
        entryName = AddInputField(rt, "NameInput", font, PlayerPrefs.GetString("playerName", "玩家"));

        entryConnectBtn = AddEntryButton(rt, "连接", C_EMBER, C_EMBER_HL, () => EntryConnect(), 20f, 44f);

        entryLobbyGroup = new GameObject("LobbyGroup", typeof(RectTransform), typeof(VerticalLayoutGroup));
        entryLobbyGroup.transform.SetParent(rt, false);
        var gvlg = entryLobbyGroup.GetComponent<VerticalLayoutGroup>();
        gvlg.spacing = 8f; gvlg.childForceExpandWidth = true; gvlg.childControlWidth = true;
        gvlg.childControlHeight = true; gvlg.childForceExpandHeight = false;

        AddEntryButton(entryLobbyGroup.transform, "创建真相盘房", C_EMBER, C_EMBER_HL, () => EntryCreateRoom(), 18f, 44f);

        AddLayoutElement(AddText(entryLobbyGroup.transform, "L_Room", "房间码", font, 16f, C_LABEL, TextAlignmentOptions.Left).gameObject, 24f);
        entryRoom = AddInputField(entryLobbyGroup.transform, "RoomInput", font, "");

        AddEntryButton(entryLobbyGroup.transform, "加入房间", C_BTN, C_BTN_HL, () => EntryJoinRoom(), 18f, 44f);
        entryStartBtn = AddEntryButton(entryLobbyGroup.transform, "开始游戏 (房主)", C_EMBER, C_EMBER_HL, () => EntryStartGame(), 18f, 44f);
        AddEntryButton(entryLobbyGroup.transform, "离开房间", C_BTN, C_BTN_HL, () => EntryLeave(), 16f, 38f);

        entryStatus = AddText(rt, "Status", "状态: 未连接", font, 15f, new Color(0.60f, 0.63f, 0.73f), TextAlignmentOptions.Left);
        AddLayoutElement(entryStatus.gameObject, 24f);

        entryPanel.SetActive(false);
    }

    Button AddEntryButton(Transform parent, string label, Color bg, Color hl, UnityAction onClick, float fontSize, float height)
    {
        var img = AddImage(parent, "Btn_" + label, bg);
        var btn = img.gameObject.AddComponent<Button>();
        btn.targetGraphic = img;
        var colors = btn.colors;
        colors.normalColor = bg; colors.highlightedColor = hl;
        colors.pressedColor = Color.Lerp(hl, Color.black, 0.2f);
        colors.fadeDuration = 0.12f;
        btn.colors = colors;
        btn.onClick.AddListener(onClick);
        AddLayoutElement(img.gameObject, height);
        var t = AddText(img.transform, "Text", label, font, fontSize, Color.white, TextAlignmentOptions.Center);
        t.fontStyle = FontStyles.Bold;
        Stretch(t.rectTransform);
        return btn;
    }

    // ============================================================
    // 构建辅助
    // ============================================================

    static void Stretch(RectTransform rt, float insetX = 0f, float insetY = 0f)
    {
        rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
        rt.offsetMin = new Vector2(insetX, insetY);
        rt.offsetMax = new Vector2(-insetX, -insetY);
    }

    static void AddLayoutElement(GameObject go, float preferredHeight)
    {
        var le = go.GetComponent<LayoutElement>();
        if (le == null) le = go.AddComponent<LayoutElement>();
        le.preferredHeight = preferredHeight;
    }

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
        tmp.text = text; tmp.font = f; tmp.fontSize = size; tmp.color = color;
        tmp.alignment = align; tmp.raycastTarget = false;
        return tmp;
    }

    TMP_InputField AddInputField(Transform parent, string name, TMP_FontAsset f, string value)
    {
        var bg = AddImage(parent, name, C_FIELD_BG);
        AddLayoutElement(bg.gameObject, 46f);
        var textGo = new GameObject("Text", typeof(RectTransform));
        textGo.transform.SetParent(bg.transform, false);
        var trt = (RectTransform)textGo.transform;
        Stretch(trt); trt.offsetMin = new Vector2(14f, 4f); trt.offsetMax = new Vector2(-14f, -4f);
        var text = textGo.AddComponent<TextMeshProUGUI>();
        text.font = f; text.fontSize = 19f; text.color = C_FIELD_TX; text.alignment = TextAlignmentOptions.Left;
        var phGo = new GameObject("Placeholder", typeof(RectTransform));
        phGo.transform.SetParent(bg.transform, false);
        var phRt = (RectTransform)phGo.transform;
        Stretch(phRt); phRt.offsetMin = new Vector2(14f, 4f); phRt.offsetMax = new Vector2(-14f, -4f);
        var ph = phGo.AddComponent<TextMeshProUGUI>();
        ph.font = f; ph.fontSize = 19f; ph.color = new Color(0.5f, 0.52f, 0.62f, 1f);
        ph.alignment = TextAlignmentOptions.Left; ph.fontStyle = FontStyles.Italic; ph.enableWordWrapping = false;
        var input = bg.gameObject.AddComponent<TMP_InputField>();
        input.textComponent = text; input.placeholder = ph; input.textViewport = trt; input.text = value;
        input.caretColor = C_EMBER; input.selectionColor = new Color(0.95f, 0.62f, 0.28f, 0.35f);
        return input;
    }
}
