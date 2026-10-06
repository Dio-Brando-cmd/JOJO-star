// ============================================================
// TruthDiscGameManager.cs — 「真相盘」3D 开放世界 (TRUTH_DISC)
//
// 职责:
//   - 接入现有 Socket.IO 服务端 TRUTH_DISC 模式 (不改服务端逻辑)
//   - 生成本地玩家 + 远程玩家 (中立着色, 不泄露食神者身份)
//   - 客户端区域判定 → 跨区自动 move; E 任务/净化; F 献祭/短铳
//   - 菜单动作 (guess/burnVeil/burnFalse/reveal/purify) 由 HUD 按钮触发
//   - 重连: 依赖 NetworkManager 的 PlayerPrefs 重连 (td_*)
//
// 复用: PlayerController3D(移动/相机/位置同步) + TruthDiscMapBuilder(地图)
// 安全: 阵营/角色/碎片内容仅在私密状态; 客户端不做身份泄露。
// ============================================================

using UnityEngine;
using System.Collections.Generic;

public class TruthDiscGameManager : MonoBehaviour
{
    public static TruthDiscGameManager Instance { get; private set; }

    [Header("══ 地图 ══")]
    public TruthDiscMapBuilder mapBuilder;

    [Header("══ 生成点 ══")]
    public Vector3 localSpawn = new Vector3(0f, 1.5f, -20f); // 中庭南锚点

    [Header("══ 交互距离 ══")]
    public float taskRange = 3f;      // 任务/净化点
    public float sacrificeRange = 2.5f; // 献祭/短铳

    // ==================== 身份状态 (HUD 每帧读取) ====================
    public string myPlayerId;        // socketId
    public string mySeat, myRole, myTeam;
    public bool isSpirit, isCorrupted, isVeilKeeper;
    public bool blunderbussUsed;
    public bool gameActive, gameOver, localDead;
    public float bannerTimer, moveThrottle;
    public string banner = "";
    public string serverMyZone = "";
    public string overWinner, overReason;
    public TruthStateDTO state;
    public TruthPrivateDTO priv;

    public PlayerController3D localPlayer;
    GameObject overviewCamera;
    public readonly Dictionary<string, PlayerController3D> remotePlayers = new Dictionary<string, PlayerController3D>();
    public readonly Dictionary<string, TruthPlayerDTO> roster = new Dictionary<string, TruthPlayerDTO>(); // seat -> player
    readonly Dictionary<string, string> socketToSeat = new Dictionary<string, string>();                  // socketId -> seat
    readonly Dictionary<string, bool> prevAlive = new Dictionary<string, bool>();                        // seat -> alive

    // 调试入口 (HUD 读取/写回)
    public string uiServer = "http://210.16.170.144:4000";
    public string uiName = "玩家";
    public string uiRoom = "";
    public string uiStatus = "未连接";

    // 缓存资产
    GameObject _freyjaPrefab;
    RuntimeAnimatorController _freyjaController;
    Shader _urpLitShader;
    System.Action _hConnected, _hDisconnected, _hStarted;
    System.Action<TruthStateDTO> _hState;
    System.Action<TruthPrivateDTO> _hPrivate;
    System.Action<TruthEndedDTO> _hEnded;
    System.Action<Dictionary<string, PositionDTO>> _hPositions;

    // ==================== Lifecycle ====================

    void Awake() { Instance = this; }

    void Start()
    {
        if (mapBuilder != null) mapBuilder.Build();   // 运行时确定性重建 (编辑器预览另存)
        overviewCamera = GameObject.Find("MainCamera");
        uiServer = PlayerPrefs.GetString("serverUrl", uiServer);
        uiName = PlayerPrefs.GetString("playerName", uiName);
        Subscribe();

        if (GetComponent<TruthDiscHUD>() == null)
            gameObject.AddComponent<TruthDiscHUD>();
    }

    void Subscribe()
    {
        var net = NetworkManager.Instance;
        if (net == null) return;

        _hConnected = () => { myPlayerId = net.playerId; uiStatus = "已连接 sid=" + net.playerId; };
        _hDisconnected = () => uiStatus = "连接断开";
        _hState = OnTruthState;
        _hPrivate = OnTruthPrivateState;
        _hStarted = OnTruthStarted;
        _hEnded = OnTruthEnded;
        _hPositions = OnPositions;

        net.OnConnected += _hConnected;
        net.OnDisconnected += _hDisconnected;
        net.OnTruthState += _hState;
        net.OnTruthPrivateState += _hPrivate;
        net.OnTruthStarted += _hStarted;
        net.OnTruthEnded += _hEnded;
        net.OnPositionsReceived += _hPositions;
    }

    void OnDestroy()
    {
        var net = NetworkManager.Instance;
        if (net == null) return;
        net.OnConnected -= _hConnected;
        net.OnDisconnected -= _hDisconnected;
        net.OnTruthState -= _hState;
        net.OnTruthPrivateState -= _hPrivate;
        net.OnTruthStarted -= _hStarted;
        net.OnTruthEnded -= _hEnded;
        net.OnPositionsReceived -= _hPositions;
    }

    // ==================== 网络事件 ====================

    void OnTruthState(TruthStateDTO s)
    {
        if (s == null) return;
        state = s;

        // 重建 roster (座次 key) + socketToSeat
        roster.Clear();
        socketToSeat.Clear();
        if (s.players != null)
            foreach (var p in s.players)
            {
                if (p == null) continue;
                roster[p.id] = p;
                if (!string.IsNullOrEmpty(p.socketId)) socketToSeat[p.socketId] = p.id;
            }

        if (mySeat != null && roster.TryGetValue(mySeat, out var me)) serverMyZone = me.zone ?? "";

        // 死亡检测 (alive 翻转)
        if (s.players != null)
            foreach (var p in s.players)
            {
                if (p == null) continue;
                bool prev;
                if (prevAlive.TryGetValue(p.id, out prev) && prev && !p.alive) OnPlayerDied(p);
                prevAlive[p.id] = p.alive;
            }

        // 地图状态
        if (mapBuilder != null)
        {
            mapBuilder.SetConsumedZones(s.zones);
            mapBuilder.SetPurifyZone(s.purifyPoint?.zone);
        }

        // 终局
        if (!string.IsNullOrEmpty(s.winner)) HandleGameOver(s.winner, s.reason);

        // 进入游戏 (start / rejoin)
        if (s.phase == "PLAYING")
        {
            TryEnterGame();
            EnsureAllRemotePlayers();
        }
    }

    void OnTruthPrivateState(TruthPrivateDTO p)
    {
        if (p == null) return;
        priv = p;
        mySeat = p.mySeat;
        myRole = p.myRole;
        myTeam = p.myTeam;
        isCorrupted = p.myTeam == "corrupted";
        isSpirit = p.myTeam == "spirit";
        isVeilKeeper = p.myRole == "守幕者";
        blunderbussUsed = p.blunderbussUsed;
        if (string.IsNullOrEmpty(myPlayerId)) myPlayerId = NetworkManager.Instance?.playerId;
        if (state != null && state.phase == "PLAYING") TryEnterGame();
    }

    void OnTruthStarted()
    {
        gameActive = true;
        gameOver = false;
        localDead = false;
        banner = "真相盘开始 — 完成仪式，净化帷幕";
        bannerTimer = 4f;
        TryEnterGame();
    }

    void OnTruthEnded(TruthEndedDTO e)
    {
        if (e == null) return;
        HandleGameOver(e.winner, e.reason);
    }

    void OnPositions(Dictionary<string, PositionDTO> positions)
    {
        if (positions == null) return;
        foreach (var kv in positions)
        {
            if (kv.Key == myPlayerId) continue;
            if (remotePlayers.TryGetValue(kv.Key, out var rp) && rp != null)
                rp.SetTargetPosition(new Vector3(kv.Value.x, kv.Value.y, kv.Value.z), kv.Value.rotY);
        }
    }

    void OnPlayerDied(TruthPlayerDTO p)
    {
        if (p.id == mySeat)
        {
            localDead = true;
            if (localPlayer != null) localPlayer.canMove = false;
            UnlockCursor();
            banner = "你被献祭了 — 旁观中";
            bannerTimer = 3f;
        }
        else if (!string.IsNullOrEmpty(p.socketId) && remotePlayers.TryGetValue(p.socketId, out var rp) && rp != null)
        {
            rp.TriggerDeath();
        }
    }

    void HandleGameOver(string winner, string reason)
    {
        if (gameOver) return;
        gameOver = true;
        gameActive = true;
        overWinner = winner;
        overReason = reason;
        if (localPlayer != null) localPlayer.canMove = false;
        UnlockCursor();
        banner = "游戏结束";
        bannerTimer = 4f;
    }

    // ==================== 进入游戏 / 生成 ====================

    void TryEnterGame()
    {
        if (localPlayer != null) return;
        if (string.IsNullOrEmpty(mySeat)) return;
        gameActive = true;
        gameOver = false;
        localDead = false;
        SpawnLocalPlayer();
        EnsureAllRemotePlayers();
        LockCursor();
    }

    void SpawnLocalPlayer()
    {
        localPlayer = CreatePlayer(myPlayerId, NetworkManager.Instance?.playerName ?? "我", true);
        localPlayer.transform.position = localSpawn;
        if (overviewCamera != null) overviewCamera.SetActive(false);
    }

    void EnsureAllRemotePlayers()
    {
        foreach (var kv in socketToSeat) EnsureRemotePlayer(kv.Key);
    }

    void EnsureRemotePlayer(string socketId)
    {
        if (string.IsNullOrEmpty(socketId) || socketId == myPlayerId) return;
        if (remotePlayers.ContainsKey(socketId) && remotePlayers[socketId] != null) return;
        if (!socketToSeat.TryGetValue(socketId, out var seat)) return;
        if (!roster.TryGetValue(seat, out var p)) return;
        var pc = CreatePlayer(socketId, p.name, false);
        pc.transform.position = TruthZones.ZoneAnchor(p.zone ?? "中庭") + Vector3.up * 1.5f;
        remotePlayers[socketId] = pc;
    }

    // ==================== 花名册查询 (HUD 用) ====================

    public string socketSeatName(string socketId)
    {
        if (socketToSeat.TryGetValue(socketId, out var seat) && roster.TryGetValue(seat, out var p))
            return p.name;
        return socketId;
    }

    public bool socketSeatAlive(string socketId)
    {
        if (socketToSeat.TryGetValue(socketId, out var seat) && roster.TryGetValue(seat, out var p))
            return p.alive;
        return true;
    }

    void EnsureCachedAssets()
    {
        if (_freyjaPrefab == null) _freyjaPrefab = Resources.Load<GameObject>("Characters/Freyja_Animated");
        if (_freyjaController == null) _freyjaController = Resources.Load<RuntimeAnimatorController>("Animations/Freyja");
        if (_urpLitShader == null) _urpLitShader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
    }

    PlayerController3D CreatePlayer(string id, string name, bool local)
    {
        EnsureCachedAssets();

        GameObject go;
        if (_freyjaPrefab != null) { go = Instantiate(_freyjaPrefab); go.name = local ? "LocalPlayer" : "Remote_" + (name ?? id); }
        else { go = GameObject.CreatePrimitive(PrimitiveType.Capsule); go.name = local ? "LocalPlayer" : "Remote_" + (name ?? id); }

        var rootCol = go.GetComponent<Collider>();
        if (rootCol != null) Destroy(rootCol);

        var cc = go.GetComponent<CharacterController>();
        if (cc == null) cc = go.AddComponent<CharacterController>();
        cc.height = 2f; cc.radius = 0.4f; cc.center = new Vector3(0f, 1f, 0f);

        var pc = go.AddComponent<PlayerController3D>();
        pc.isLocal = local;
        pc.playerId = id;
        if (_freyjaController != null) pc.animatorController = _freyjaController;

        // 中立着色: 本地玩家微蓝区分「你」, 远端统一中性灰 (不泄露食神者身份)
        var r = go.GetComponent<Renderer>();
        if (r != null)
        {
            var mat = new Material(_urpLitShader);
            Color c = local ? new Color(0.55f, 0.70f, 1f) : new Color(0.82f, 0.82f, 0.88f);
            mat.color = c;
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c);
            r.sharedMaterial = mat;
        }
        return pc;
    }

    // ==================== 更新 / 交互 ====================

    void Update()
    {
        if (bannerTimer > 0) bannerTimer -= Time.deltaTime;
        if (moveThrottle > 0) moveThrottle -= Time.deltaTime;

        if (!gameActive || gameOver || localDead || localPlayer == null) return;

        DetectZoneMove();

        if (Input.GetKeyDown(KeyCode.E)) TryInteractE();
        if (Input.GetKeyDown(KeyCode.F)) TryInteractF();
    }

    void DetectZoneMove()
    {
        var zone = TruthZones.ZoneForPosition(localPlayer.transform.position);
        if (string.IsNullOrEmpty(zone)) return;
        if (zone == serverMyZone) return;
        if (moveThrottle > 0) return;
        moveThrottle = 1.6f;   // 服务端动作冷却 1.5s, 自动 move 节流 1.6s
        SendAction(new Dictionary<string, object> { ["type"] = "move", ["zone"] = zone });
    }

    void TryInteractE()
    {
        var lp = localPlayer.transform.position;

        // 1. 最近未完成任务 (灵焰方做任务 / 食神者破坏)
        string nearestTaskId = null; float best = taskRange * taskRange;
        if (state?.tasks != null)
            foreach (var t in state.tasks)
            {
                if (t == null || t.completed || t.sabotaged) continue;
                var anchor = TruthZones.TaskAnchorOf(t.name);
                if (anchor == null) continue;
                float d = new Vector3(anchor.pos.x - lp.x, 0, anchor.pos.z - lp.z).sqrMagnitude;
                if (d <= best) { best = d; nearestTaskId = t.id; }
            }

        if (nearestTaskId != null)
        {
            if (isCorrupted)
                SendAction(new Dictionary<string, object> { ["type"] = "taskFail", ["taskId"] = nearestTaskId });
            else
                SendAction(new Dictionary<string, object> { ["type"] = "task", ["taskId"] = nearestTaskId });
            return;
        }

        // 2. 净化点 (灵焰方, 站在净化点区域)
        if (isSpirit && state?.purifyPoint != null && !string.IsNullOrEmpty(state.purifyPoint.zone))
        {
            var anchor = TruthZones.ZoneAnchor(state.purifyPoint.zone);
            float d = new Vector3(anchor.x - lp.x, 0, anchor.z - lp.z).sqrMagnitude;
            if (d <= taskRange * taskRange) { TryPurify(); return; }
        }

        banner = "附近没有可交互的物体";
        bannerTimer = 1f;
    }

    void TryInteractF()
    {
        var lp = localPlayer.transform.position;
        string targetSeat = null; float best = sacrificeRange * sacrificeRange;
        foreach (var kv in remotePlayers)
        {
            if (kv.Value == null) continue;
            if (!socketToSeat.TryGetValue(kv.Key, out var seat)) continue;
            if (!roster.TryGetValue(seat, out var p) || !p.alive) continue;
            float d = (kv.Value.transform.position - lp).sqrMagnitude;
            if (d <= best) { best = d; targetSeat = seat; }
        }
        if (targetSeat == null) { banner = "附近没有可献祭的玩家"; bannerTimer = 1f; return; }

        if (isVeilKeeper && state != null && state.enginePhase >= 2 && !blunderbussUsed)
            SendAction(new Dictionary<string, object> { ["type"] = "blunderbuss", ["targetId"] = targetSeat });
        else
            SendAction(new Dictionary<string, object> { ["type"] = "sacrifice", ["victimId"] = targetSeat });
    }

    // ==================== 菜单动作 (HUD 按钮调用) ====================

    public void ActionGuess(string godId) => SendAction(new Dictionary<string, object> { ["type"] = "guess", ["godId"] = godId });
    public void ActionBurnVeil() => SendAction(new Dictionary<string, object> { ["type"] = "burnVeil" });
    public void ActionBurnFalse() => SendAction(new Dictionary<string, object> { ["type"] = "burnFalse" });
    public void ActionReveal() => SendAction(new Dictionary<string, object> { ["type"] = "reveal" });
    public void TryPurify() => SendAction(new Dictionary<string, object> { ["type"] = "purify" });

    void SendAction(Dictionary<string, object> action, string successBanner = null)
    {
        var net = NetworkManager.Instance;
        if (net == null) return;
        net.SendTruthAction(action, r =>
        {
            if (r == null) return;
            if (!r.ok)
            {
                banner = r.events != null && r.events.Length > 0 ? TruthData.StripEmoji(r.events[0]) : "操作失败";
                bannerTimer = 1.5f;
            }
            else if (!string.IsNullOrEmpty(successBanner))
            {
                banner = successBanner;
                bannerTimer = 1.5f;
            }
        });
    }

    // ==================== 调试入口 (HUD 调用) ====================

    public void EntryConnect()
    {
        var net = NetworkManager.Instance; if (net == null) return;
        net.serverUrl = uiServer; net.playerName = uiName; uiStatus = "连接中..."; net.Connect();
    }
    public void EntryCreateRoom()
    {
        var net = NetworkManager.Instance; if (net == null) return;
        net.playerName = uiName;
        net.CreateTruthRoom(code => uiStatus = !string.IsNullOrEmpty(code) ? "已创建房码: " + code : "创建失败 (见 Console)");
    }
    public void EntryJoinRoom()
    {
        var net = NetworkManager.Instance; if (net == null) return;
        net.playerName = uiName;
        net.JoinTruthRoom(uiRoom, ok => uiStatus = ok ? "已加入: " + uiRoom : "加入失败 (见 Console)");
    }
    public void EntryStartGame()
    {
        var net = NetworkManager.Instance; if (net == null) return;
        net.StartTruthGame(); uiStatus = "已请求开始...";
    }
    public void EntryLeave()
    {
        NetworkManager.Instance?.LeaveRoom();
        ResetToIdle();
    }

    void ResetToIdle()
    {
        gameActive = false; gameOver = false; localDead = false;
        mySeat = null; myRole = null; myTeam = null;
        state = null; priv = null;
        serverMyZone = "";
        if (localPlayer != null) { Destroy(localPlayer.gameObject); localPlayer = null; }
        foreach (var kv in remotePlayers) if (kv.Value != null) Destroy(kv.Value.gameObject);
        remotePlayers.Clear();
        roster.Clear(); socketToSeat.Clear(); prevAlive.Clear();
        if (overviewCamera != null) overviewCamera.SetActive(true);
        UnlockCursor();
        uiStatus = "已返回大厅";
    }

    // ==================== 光标 ====================

    void LockCursor() { Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false; }
    void UnlockCursor() { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; }
}
