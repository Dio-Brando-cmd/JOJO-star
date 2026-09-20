// ============================================================
// ChaseGameManager.cs — 「帷幕追猎」联网 2v6 追逐玩法 (THIRD_PERSON)
//
// 职责:
//   - 接入现有 Socket.IO 服务端 THIRD_PERSON 模式 (不改服务端)
//   - 生成本地玩家(蚀者/守幕者) + 远程玩家
//   - 追逐核心: 蚀者 F 噬灵 / 守幕者 Q 藏匿 / 位置 10Hz 同步
//   - 阶段回路: 夜(120s) → 白天 → 讨论 → 投票 → 结算 → 回大厅
//   - OnGUI HUD + 临时调试入口 (大厅 UI 后续接入)
//
// 复用: PlayerController3D(移动/藏匿/位置同步) + ExplorationSceneSetup(地图)
// ============================================================

using UnityEngine;
using System.Collections.Generic;

// 藏匿点标记 (Q 藏匿检测用)
public class HidingSpot : MonoBehaviour { }

public class ChaseGameManager : MonoBehaviour
{
    public static ChaseGameManager Instance { get; private set; }

    [Header("══ 地图 ══")]
    public ExplorationSceneSetup mapSetup;

    [Header("══ 生成点 ══")]
    public Vector3 corruptedSpawn = new Vector3(0f, 4f, 42f);   // 蚀者: 墓地附近
    public Vector3 keeperSpawn   = new Vector3(0f, 4f, 0f);     // 守幕者: 中央广场

    [Header("══ 玩法 ══")]
    public float attackRange = 2f;      // 服务端不校验距离, 客户端补 2m
    public float attackCooldown = 8f;   // 与服务端一致

    // ==================== 角色/阵营中文 ====================
    static readonly Dictionary<string, string> ROLE_NAMES = new Dictionary<string, string>
    {
        ["CORRUPTED"] = "蚀者", ["NETHER_MONK"] = "冥僧人",
        ["VEIL_SCHOLAR"] = "帷幕学者", ["HERBAL_SAGE"] = "草药学者",
        ["SPIRIT_MENDER"] = "愈灵师", ["SPIRIT_WEAVER"] = "灵织者",
        ["VEIL_GUARDIAN"] = "帷幕守卫", ["FLAME_TRACKER"] = "灵痕追猎者"
    };
    static readonly Dictionary<string, string> TEAM_NAMES = new Dictionary<string, string>
    {
        ["CORRUPTED"] = "蚀者阵营", ["VEIL_KEEPERS"] = "守幕者阵营"
    };

    public static bool IsCorruptedRole(string role) => role == "CORRUPTED" || role == "NETHER_MONK";
    public static string RoleName(string role) => role != null && ROLE_NAMES.TryGetValue(role, out var n) ? n : (role ?? "?");
    public static string TeamName(string team) => team != null && TEAM_NAMES.TryGetValue(team, out var n) ? n : (team ?? "?");

    // ==================== 状态 (HUD 每帧读取) ====================
    public string myPlayerId;
    public string myRole, myTeam, myCharacterId;
    public bool isCorrupted;
    public bool isNight, gameActive, gameOver, localDead, voted;
    public float nightTimeLeft, phaseTimeLeft, cdRemaining, bannerTimer, stateSyncTimer;
    public string banner = "";
    public string currentPhase = "IDLE";
    public string overWinner, overReason;

    public PlayerController3D localPlayer;
    GameObject overviewCamera;
    public readonly Dictionary<string, PlayerController3D> remotePlayers = new Dictionary<string, PlayerController3D>();
    public readonly Dictionary<string, PlayerState> roster = new Dictionary<string, PlayerState>();

    // 调试入口 (HUD 读取/写回)
    public string uiServer = "http://210.16.170.144:4000";
    public string uiName = "玩家";
    public string uiRoom = "";
    public string uiStatus = "未连接";

    // 缓存资产 (Freyja prefab/controller/URP shader, 避免每次 spawn 重复 Resources.Load/Shader.Find)
    GameObject _freyjaPrefab;
    RuntimeAnimatorController _freyjaController;
    Shader _urpLitShader;
    // 缓存事件委托 (OnDestroy 退订, 防场景重载泄漏)
    System.Action _hConnected, _hDisconnected, _hReturnToLobby;
    System.Action<PrivateState> _hPrivateState;
    System.Action<NightStartDTO> _hNightStart;
    System.Action<Dictionary<string, PositionDTO>> _hPositions;
    System.Action<PhaseChangeDTO> _hPhaseChange;
    System.Action<string, string> _hGameOver;
    System.Action<GameOverDTO> _hGameOverFull;
    System.Action<GameState> _hGameState;
    System.Action<VoteResultsDTO> _hVoteResults;
    System.Action<FlameUpdateDTO> _hFlameUpdate;

    // 灵焰仪式状态
    const float FLAME_COLLECT_RADIUS = 3f;
    const float RITUAL_RADIUS = 5f;
    readonly Dictionary<string, FlameDTO> flames = new Dictionary<string, FlameDTO>();
    readonly Dictionary<string, GameObject> flameObjects = new Dictionary<string, GameObject>();
    GameObject ritualCircle;
    public int flamesCollected, flamesTotal;
    public bool ritualActive;
    string ritualPlayerId;
    public float ritualTimeLeft, ritualStartLocal, ritualDuration = 12f;

    // ==================== Lifecycle ====================

    void Awake() { Instance = this; }

    void Start()
    {
        if (mapSetup != null)
        {
            mapSetup.buildOnStart = false;
            mapSetup.Build();               // 运行时确定性重建 (编辑器烘焙仅用于预览)
            SetupTerrainCollider();
            SetupHidingSpots();
        }
        overviewCamera = GameObject.Find("MainCamera");
        uiServer = PlayerPrefs.GetString("serverUrl", uiServer);
        uiName = PlayerPrefs.GetString("playerName", uiName);
        Subscribe();

        // uGUI HUD (替换旧 OnGUI)
        if (GetComponent<ChaseHUD>() == null)
            gameObject.AddComponent<ChaseHUD>();
    }

    void Subscribe()
    {
        var net = NetworkManager.Instance;
        if (net == null) return;

        _hConnected = () => { myPlayerId = net.playerId; uiStatus = "已连接 sid=" + net.playerId; };
        _hDisconnected = () => uiStatus = "连接断开";
        _hPrivateState = OnPrivateState;
        _hNightStart = OnNightStart;
        _hPositions = OnPositions;
        _hPhaseChange = OnPhaseChange;
        _hGameOver = OnGameOver;
        _hGameOverFull = OnGameOverFull;
        _hGameState = OnGameState;
        _hVoteResults = OnVoteResults;
        _hReturnToLobby = ResetToLobby;
        _hFlameUpdate = OnFlameUpdate;

        net.OnConnected += _hConnected;
        net.OnDisconnected += _hDisconnected;
        net.OnPrivateStateReceived += _hPrivateState;
        net.On3DNightStart += _hNightStart;
        net.OnPositionsReceived += _hPositions;
        net.OnPhaseChangeFull += _hPhaseChange;
        net.OnGameOver += _hGameOver;
        net.OnGameOverFull += _hGameOverFull;
        net.OnGameStateReceived += _hGameState;
        net.OnVoteResults += _hVoteResults;
        net.OnReturnToLobby += _hReturnToLobby;
        net.OnFlameUpdate += _hFlameUpdate;
    }

    void OnDestroy()
    {
        var net = NetworkManager.Instance;
        if (net == null) return;
        net.OnConnected -= _hConnected;
        net.OnDisconnected -= _hDisconnected;
        net.OnPrivateStateReceived -= _hPrivateState;
        net.On3DNightStart -= _hNightStart;
        net.OnPositionsReceived -= _hPositions;
        net.OnPhaseChangeFull -= _hPhaseChange;
        net.OnGameOver -= _hGameOver;
        net.OnGameOverFull -= _hGameOverFull;
        net.OnGameStateReceived -= _hGameState;
        net.OnVoteResults -= _hVoteResults;
        net.OnReturnToLobby -= _hReturnToLobby;
        net.OnFlameUpdate -= _hFlameUpdate;
    }

    // ==================== 网络事件 ====================

    void OnPrivateState(PrivateState ps)
    {
        if (ps == null) return;
        myRole = ps.myRole;
        myTeam = ps.myTeam;
        myCharacterId = ps.characterId ?? ps.myPrivateState?.characterId;
        isCorrupted = (myTeam == "CORRUPTED") || IsCorruptedRole(myRole);
        if (myPlayerId == null) myPlayerId = NetworkManager.Instance?.playerId;
    }

    void OnNightStart(NightStartDTO dto)
    {
        if (dto == null) return;

        // 多回合追逃: 先清掉上一轮的玩家/灵焰对象, 避免重复生成
        if (localPlayer != null) { Destroy(localPlayer.gameObject); localPlayer = null; }
        foreach (var kv in remotePlayers) if (kv.Value != null) Destroy(kv.Value.gameObject);
        remotePlayers.Clear();

        isNight = true;
        gameActive = true;
        gameOver = false;
        localDead = false;
        voted = false;
        nightTimeLeft = dto.timeLeft;
        currentPhase = "NIGHT";

        roster.Clear();
        if (dto.players != null)
            foreach (var p in dto.players) roster[p.id] = p;

        // 若 privateState 还没到 (异常时序), 从 roster 里兜底我的角色
        if (myRole == null && myPlayerId != null && roster.TryGetValue(myPlayerId, out var me))
        {
            myRole = me.role;
            myTeam = me.team;
            isCorrupted = (myTeam == "CORRUPTED") || IsCorruptedRole(myRole);
        }

        SpawnLocalPlayer();
        SpawnRemotePlayers();
        ResetFlames();

        LockCursor();
        banner = "第" + dto.round + "夜 — " + (isCorrupted ? "去吞噬守幕者 (F)" : "逃命或藏匿 (Q)");
        bannerTimer = 4f;
    }

    void OnPhaseChange(PhaseChangeDTO dto)
    {
        if (dto == null) return;
        currentPhase = dto.phase ?? currentPhase;
        phaseTimeLeft = dto.timeLeft;

        if (dto.phase == "DAY")
        {
            isNight = false;
            UnlockCursor();
            banner = "天亮了 — 白天阶段";
            bannerTimer = 3f;
        }
        else if (dto.phase == "DISCUSSION")
        {
            banner = "讨论阶段 — 交流你的发现";
            bannerTimer = 2f;
        }
        else if (dto.phase == "VOTE")
        {
            voted = false;
            banner = "投票阶段 — 选出你怀疑的人";
            bannerTimer = 3f;
        }
    }

    void OnGameOver(string winner, string reason)
    {
        gameOver = true;
        isNight = false;
        gameActive = true; // 仍显示结算 UI
        overWinner = TeamName(winner);
        overReason = reason ?? "";
        UnlockCursor();
        banner = "游戏结束";
        bannerTimer = 4f;
    }

    // game:over 附带全员真实职业 (夜晚开始只发阵营不发货职业) → 回填 roster 供结算展示
    void OnGameOverFull(GameOverDTO dto)
    {
        if (dto == null || dto.players == null) return;
        foreach (var p in dto.players)
        {
            if (roster.TryGetValue(p.id, out var ps))
            {
                ps.role = p.role;
                ps.team = p.team;
            }
        }
    }

    void OnVoteResults(VoteResultsDTO dto)
    {
        if (dto == null) return;
        string who = dto.eliminated;
        if (!string.IsNullOrEmpty(who) && roster.TryGetValue(who, out var p))
            who = p.name;
        banner = (dto.tie ? "平票! " : "投票结果: ") + (string.IsNullOrEmpty(who) ? "无人被放逐" : who + " 被放逐");
        bannerTimer = 3f;
    }

    void OnGameState(GameState gs)
    {
        if (gs == null) return;
        if (!string.IsNullOrEmpty(gs.phase)) currentPhase = gs.phase;

        if (gs.players == null) return;
        foreach (var p in gs.players)
        {
            if (!roster.TryGetValue(p.id, out var existing)) continue;
            bool wasAlive = existing.alive;
            existing.alive = p.alive;

            if (wasAlive && !p.alive)
            {
                if (p.id == myPlayerId)
                {
                    localDead = true;
                    if (localPlayer != null) localPlayer.canMove = false;
                    UnlockCursor();
                    banner = "你被击倒了";
                    bannerTimer = 3f;
                }
                else if (remotePlayers.TryGetValue(p.id, out var rp))
                {
                    rp.TriggerDeath();
                }
            }
        }
    }

    void OnPositions(Dictionary<string, PositionDTO> positions)
    {
        if (positions == null) return;
        foreach (var kv in positions)
        {
            if (kv.Key == myPlayerId) continue;
            if (remotePlayers.TryGetValue(kv.Key, out var rp))
            {
                rp.SetTargetPosition(new Vector3(kv.Value.x, kv.Value.y, kv.Value.z), kv.Value.rotY);
            }
        }
    }

    void ResetToLobby()
    {
        isNight = false;
        gameActive = false;
        gameOver = false;
        localDead = false;
        currentPhase = "IDLE";
        uiStatus = "已返回大厅" + (string.IsNullOrEmpty(NetworkManager.Instance?.RoomCode) ? "" : " (房码 " + NetworkManager.Instance.RoomCode + ")");

        if (localPlayer != null) Destroy(localPlayer.gameObject);
        localPlayer = null;
        foreach (var kv in remotePlayers) if (kv.Value != null) Destroy(kv.Value.gameObject);
        remotePlayers.Clear();
        roster.Clear();

        foreach (var kv in flameObjects) if (kv.Value != null) Destroy(kv.Value);
        flameObjects.Clear();
        flames.Clear();
        if (ritualCircle != null) ritualCircle.SetActive(false);
        ritualActive = false;

        if (overviewCamera != null) overviewCamera.SetActive(true);
        UnlockCursor();
    }

    // ==================== 玩家生成 ====================

    void SpawnLocalPlayer()
    {
        Vector3 spawn = isCorrupted ? corruptedSpawn : keeperSpawn;
        localPlayer = CreatePlayer(myPlayerId, NetworkManager.Instance?.playerName ?? "我", myCharacterId, true);
        localPlayer.transform.position = spawn;
        localPlayer.ApplyTraitModifiers();

        if (overviewCamera != null) overviewCamera.SetActive(false);
    }

    void SpawnRemotePlayers()
    {
        int i = 0;
        int total = Mathf.Max(1, roster.Count - 1);
        foreach (var kv in roster)
        {
            if (kv.Key == myPlayerId) continue;
            var p = CreatePlayer(kv.Key, kv.Value.name, kv.Value.characterId, false);
            float angle = i * Mathf.PI * 2f / total;
            p.transform.position = new Vector3(Mathf.Cos(angle) * 12f, 2f, Mathf.Sin(angle) * 12f);
            remotePlayers[kv.Key] = p;
            i++;
        }
    }

    // 缓存 Freyja prefab/controller/URP shader (避免每次 spawn 重复 Resources.Load/Shader.Find)
    void EnsureCachedAssets()
    {
        if (_freyjaPrefab == null) _freyjaPrefab = Resources.Load<GameObject>("Characters/Freyja_Animated");
        if (_freyjaController == null) _freyjaController = Resources.Load<RuntimeAnimatorController>("Animations/Freyja");
        if (_urpLitShader == null) _urpLitShader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
    }

    PlayerController3D CreatePlayer(string id, string name, string characterId, bool local)
    {
        EnsureCachedAssets();

        // 优先用芙蕾雅动画模型 (缓存 prefab), 缺失则回退胶囊
        GameObject go;
        if (_freyjaPrefab != null)
        {
            go = Instantiate(_freyjaPrefab);
            go.name = local ? "LocalPlayer" : "Remote_" + (name ?? id);
        }
        else
        {
            go = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            go.name = local ? "LocalPlayer" : "Remote_" + (name ?? id);
        }

        var rootCol = go.GetComponent<Collider>();
        if (rootCol != null) DestroyImmediate(rootCol);   // 用 CharacterController 代替

        var cc = go.GetComponent<CharacterController>();
        if (cc == null) cc = go.AddComponent<CharacterController>();
        cc.height = 2f;
        cc.radius = 0.4f;
        cc.center = new Vector3(0f, 1f, 0f);

        var pc = go.AddComponent<PlayerController3D>();
        pc.isLocal = local;
        pc.playerId = id;
        pc.characterId = characterId ?? "";

        // 动画: 缓存 Freyja Animator Controller (Tools→Veilland→Setup Freyja Animations 生成)
        if (_freyjaController != null) pc.animatorController = _freyjaController;

        // 阵营着色 (蚀者红 / 守幕者蓝), 未定则白 (胶囊回退才染色, Freyja 保留原材质)
        var r = go.GetComponent<Renderer>();
        if (r != null)
        {
            bool corrupt = false;
            if (roster.TryGetValue(id, out var ps))
                corrupt = (ps.team == "CORRUPTED") || IsCorruptedRole(ps.role);
            var mat = new Material(_urpLitShader);
            Color c = corrupt ? new Color(0.75f, 0.2f, 0.2f) : new Color(0.25f, 0.5f, 0.9f);
            mat.color = c;                                   // Built-in Standard
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c);  // URP Lit
            r.sharedMaterial = mat;
        }

        return pc;
    }

    // ==================== 地图物理/藏匿点 ====================

    void SetupTerrainCollider()
    {
        if (mapSetup == null || mapSetup.Exploration == null) return;
        int count = 0;
        foreach (var mf in mapSetup.Exploration.GetComponentsInChildren<MeshFilter>(true))
        {
            if (mf.sharedMesh == null) continue;
            float horiz = Mathf.Max(mf.sharedMesh.bounds.size.x, mf.sharedMesh.bounds.size.z);
            if (horiz < 20f) continue;   // 只给地形大块加碰撞 (房屋/树不加)
            var mc = mf.GetComponent<MeshCollider>();
            if (mc == null) mc = mf.gameObject.AddComponent<MeshCollider>();
            mc.sharedMesh = mf.sharedMesh;
            mc.convex = false;
            count++;
        }
        Debug.Log($"[Chase] 🌍 地形碰撞体: {count} 块");
    }

    void SetupHidingSpots()
    {
        if (mapSetup == null || mapSetup.Exploration == null) return;
        int count = 0;
        foreach (var r in mapSetup.Exploration.GetComponentsInChildren<MeshRenderer>(true))
        {
            float maxDim = Mathf.Max(r.bounds.size.x, r.bounds.size.y, r.bounds.size.z);
            if (maxDim < 1.5f || maxDim > 20f) continue;   // 跳过碎石/地形
            if (r.GetComponent<HidingSpot>() != null) continue;
            r.gameObject.AddComponent<HidingSpot>();
            var sc = r.gameObject.AddComponent<SphereCollider>();
            sc.isTrigger = true;
            sc.radius = 2.5f;
            sc.center = Vector3.zero;
            count++;
        }
        Debug.Log($"[Chase] 🫥 藏匿点: {count}");
    }

    // ==================== 灵焰仪式 ====================

    void ResetFlames()
    {
        EnsureCachedAssets();
        foreach (var kv in flameObjects) if (kv.Value != null) Destroy(kv.Value);
        flameObjects.Clear();
        flames.Clear();
        flamesCollected = 0; flamesTotal = 0;
        ritualActive = false; ritualPlayerId = null;

        // 广场仪式圈标记 (半径 5m, 圆心 = 中央广场 0,0)
        if (ritualCircle == null)
        {
            ritualCircle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ritualCircle.name = "RitualCircle";
            var c = ritualCircle.GetComponent<Collider>();
            if (c != null) Destroy(c);
            ritualCircle.transform.position = new Vector3(0f, 0.05f, 0f);
            ritualCircle.transform.localScale = new Vector3(10f, 0.02f, 10f);
            var mat = new Material(_urpLitShader);
            mat.color = new Color(0.9f, 0.7f, 0.2f, 0.4f);
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", new Color(0.9f, 0.7f, 0.2f, 0.4f));
            ritualCircle.GetComponent<Renderer>().sharedMaterial = mat;
        }
        ritualCircle.SetActive(true);
    }

    void OnFlameUpdate(FlameUpdateDTO dto)
    {
        if (dto == null) return;

        flames.Clear();
        if (dto.flames != null)
            foreach (var f in dto.flames) if (f != null) flames[f.id] = f;
        flamesCollected = dto.collected;
        flamesTotal = dto.total;

        bool wasActive = ritualActive;
        ritualPlayerId = dto.ritual?.playerId;
        ritualActive = dto.ritual != null;
        if (ritualActive && !wasActive)
        {
            ritualStartLocal = Time.time;
            ritualDuration = dto.ritual.duration > 0 ? dto.ritual.duration : 12f;
        }

        RenderFlames();
    }

    void RenderFlames()
    {
        EnsureCachedAssets();
        foreach (var kv in flames)
        {
            var f = kv.Value;
            if (!flameObjects.TryGetValue(kv.Key, out var obj) || obj == null)
            {
                obj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                obj.name = "SpiritFlame_" + f.name;
                var c = obj.GetComponent<Collider>();
                if (c != null) Destroy(c);
                obj.transform.localScale = Vector3.one * 1.2f;
                obj.transform.position = new Vector3(f.x, 1.6f, f.z);
                var mat = new Material(_urpLitShader);
                mat.color = new Color(0.3f, 0.9f, 1f);
                if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", new Color(0.3f, 0.9f, 1f));
                if (mat.HasProperty("_EmissionColor")) { mat.EnableKeyword("_EMISSION"); mat.SetColor("_EmissionColor", new Color(0.3f, 0.9f, 1f) * 2f); }
                obj.GetComponent<Renderer>().sharedMaterial = mat;
                flameObjects[kv.Key] = obj;
            }
            obj.SetActive(!f.collected);   // 已采集则熄灭
        }
    }

    void TryCollectFlame()
    {
        if (localPlayer == null) return;
        string nearestId = null; float best = FLAME_COLLECT_RADIUS * FLAME_COLLECT_RADIUS;
        var lp = localPlayer.transform.position;
        foreach (var kv in flames)
        {
            if (kv.Value.collected) continue;
            float d = new Vector3(kv.Value.x - lp.x, 0f, kv.Value.z - lp.z).sqrMagnitude;
            if (d <= best) { best = d; nearestId = kv.Key; }
        }
        if (nearestId == null) { banner = "附近没有未采集的灵焰"; bannerTimer = 1f; return; }
        NetworkManager.Instance?.Send3DCollect(nearestId, ok =>
        {
            if (!ok) { banner = "采集失败 (距离过远?)"; bannerTimer = 1f; }
        });
    }

    void TryStartRitual()
    {
        if (flamesTotal == 0 || flamesCollected < flamesTotal)
        {
            banner = "需先集齐 " + flamesTotal + " 处灵焰";
            bannerTimer = 1.5f;
            return;
        }
        NetworkManager.Instance?.Send3DRitual(ok =>
        {
            if (!ok) { banner = "需站在广场中央引导仪式"; bannerTimer = 1.5f; }
        });
    }

    // ==================== Update ====================

    void Update()
    {
        if (bannerTimer > 0) bannerTimer -= Time.deltaTime;
        if (cdRemaining > 0) cdRemaining -= Time.deltaTime;

        // 夜晚倒计时
        if (isNight && nightTimeLeft > 0) nightTimeLeft -= Time.deltaTime;

        // 白天/投票倒计时
        if (!isNight && !gameOver && phaseTimeLeft > 0) phaseTimeLeft -= Time.deltaTime;

        // 夜间存活轮询 (服务端 3d 击杀不广播, 用 requestState 同步)
        if (isNight && !localDead && NetworkManager.Instance != null && NetworkManager.Instance.IsConnected)
        {
            stateSyncTimer -= Time.deltaTime;
            if (stateSyncTimer <= 0f)
            {
                stateSyncTimer = 2f;
                NetworkManager.Instance.RequestState();
            }
        }

        // 蚀者攻击 (F)
        if (isNight && !localDead && isCorrupted && Input.GetKeyDown(KeyCode.F))
            TryAttack();

        // 仪式倒计时
        if (ritualActive) ritualTimeLeft = Mathf.Max(0f, ritualDuration - (Time.time - ritualStartLocal));

        // 守幕者: 采集灵焰 (E) / 引导仪式 (R)
        if (isNight && !localDead && !isCorrupted && localPlayer != null)
        {
            if (Input.GetKeyDown(KeyCode.E)) TryCollectFlame();
            if (Input.GetKeyDown(KeyCode.R)) TryStartRitual();
        }
    }

    void TryAttack()
    {
        if (localPlayer == null) return;
        if (cdRemaining > 0f) { banner = "攻击冷却中"; bannerTimer = 1f; return; }

        string target = null;
        float best = attackRange * attackRange;
        foreach (var kv in remotePlayers)
        {
            if (!roster.TryGetValue(kv.Key, out var ps) || !ps.alive) continue;
            if (ps.team == "CORRUPTED" || IsCorruptedRole(ps.role)) continue; // 只打守幕者
            float d = (kv.Value.transform.position - localPlayer.transform.position).sqrMagnitude;
            if (d <= best) { best = d; target = kv.Key; }
        }

        if (target == null) { banner = "2m 内无可攻击的守幕者"; bannerTimer = 1f; return; }

        cdRemaining = attackCooldown;   // 乐观锁定 (服务端也会判冷却)
        NetworkManager.Instance?.Send3DAttack(target, OnAttackResult);
    }

    void OnAttackResult(AttackResultDTO r)
    {
        if (r == null) return;
        if (!r.success)
        {
            banner = r.reason == "COOLDOWN" ? "攻击冷却中" : ("攻击失败: " + (r.error ?? r.reason ?? "未知"));
            bannerTimer = 1.5f;
            return;
        }

        switch (r.result)
        {
            case "KILLED":    banner = "噬灵成功! " + NameOf(r.victim) + " 被吞噬"; break;
            case "ESCAPED":   banner = "目标逃脱了!"; break;
            case "COUNTERED": banner = "被反杀! 灵痕追猎者击毙了你"; break;
            default:          banner = "攻击结果: " + r.result; break;
        }
        bannerTimer = 3f;
    }

    string NameOf(string id)
        => id != null && roster.TryGetValue(id, out var p) ? p.name : (id ?? "?");

    // ==================== 投票 (HUD 回调) ====================

    public void SubmitVote(string targetId)
    {
        if (voted) return;
        voted = true;
        NetworkManager.Instance?.SubmitVote(targetId);
        if (roster.TryGetValue(targetId, out var p))
        {
            banner = "已投票: " + p.name;
            bannerTimer = 2f;
        }
    }

    public void SkipVote()
    {
        voted = true;
    }

    // ==================== 光标 ====================

    void LockCursor()
    {
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void UnlockCursor()
    {
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    public static string PhaseText(string phase)
    {
        switch (phase)
        {
            case "NIGHT":      return "夜晚";
            case "DAY":        return "白天";
            case "DISCUSSION": return "讨论";
            case "VOTE":       return "投票";
            case "GAME_OVER":  return "结算";
            case "PROLOGUE":   return "序幕";
            default:           return phase ?? "等待";
        }
    }
}
