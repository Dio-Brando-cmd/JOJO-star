// ============================================================
// NetworkManager.cs — 网络门面 (对接现有 Node.js Socket.IO 服务端)
//
// 内部使用自写的零依赖 Socket.IO v4 客户端 (Net/SocketIO.cs)。
// 保留原桩的全部公开签名与事件, 新增 3D 追逃能力。
// 数据对象见 Net/SocketIODTO.cs。
// ============================================================

using UnityEngine;
using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }

    [Header("Server Settings")]
    public string serverUrl = "http://210.16.170.144:4000";
    public string playerName = "Player";
    public string playerId;

    SocketIO _socket;
    string _roomCode;
    bool _isHost;

    public bool IsConnected => _socket != null && _socket.Connected;
    public string RoomCode => _roomCode;
    public bool IsHost => _isHost;

    // ==================== 事件 (保留原签名) ====================
    public event Action<GameState> OnGameStateReceived;
    public event Action<PrivateState> OnPrivateStateReceived;
    public event Action<CharacterSelectData> OnCharacterSelect;
    public event Action<string> OnGameStarted;
    public event Action<string, string> OnGameOver;
    public event Action<string, string> OnPhaseChange;
    public event Action<string, string> OnChatReceived;
    public event Action<RoomInfo[]> OnRoomListReceived;

    // ==================== 事件 (3D 追逃新增) ====================
    public event Action OnConnected;
    public event Action OnDisconnected;
    public event Action<NightStartDTO> On3DNightStart;
    public event Action<Dictionary<string, PositionDTO>> OnPositionsReceived;
    public event Action<AttackResultDTO> OnAttackResult;
    public event Action<VoteResultsDTO> OnVoteResults;
    public event Action<GameOverDTO> OnGameOverFull;
    public event Action<PhaseChangeDTO> OnPhaseChangeFull;
    public event Action OnReturnToLobby;
    public event Action<FlameUpdateDTO> OnFlameUpdate;

    // ==================== Lifecycle ====================

    void Awake()
    {
        if (Instance == null) { Instance = this; DontDestroyOnLoad(gameObject); }
        else { Destroy(gameObject); return; }

        _socket = gameObject.AddComponent<SocketIO>();
        WireEvents();
    }

    void Start()
    {
        Debug.Log("[Network] NetworkManager 就绪 — 调用 Connect() 连接 " + serverUrl);
    }

    void WireEvents()
    {
        _socket.OnConnected += () =>
        {
            playerId = _socket.Sid;
            OnConnected?.Invoke();
        };
        _socket.OnDisconnected += () => OnDisconnected?.Invoke();

        _socket.On("game:state",        t => OnGameStateReceived?.Invoke(t?.ToObject<GameState>()));
        _socket.On("game:privateState", t => OnPrivateStateReceived?.Invoke(t?.ToObject<PrivateState>()));
        _socket.On("game:started",      t => OnGameStarted?.Invoke(t?["round"]?.ToString()));
        _socket.On("game:over",         t => { var o = t?.ToObject<GameOverDTO>(); OnGameOver?.Invoke(o?.winner, o?.reason); OnGameOverFull?.Invoke(o); });
        _socket.On("game:phaseChange",  t => { var o = t?.ToObject<PhaseChangeDTO>(); OnPhaseChange?.Invoke(o?.phase, o?.nightStep); OnPhaseChangeFull?.Invoke(o); });
        _socket.On("game:3dNightStart", t => On3DNightStart?.Invoke(t?.ToObject<NightStartDTO>()));
        _socket.On("players:positions", t => OnPositionsReceived?.Invoke(t?.ToObject<PositionBroadcastDTO>()?.positions));
        _socket.On("game:voteResults",  t => OnVoteResults?.Invoke(t?.ToObject<VoteResultsDTO>()));
        _socket.On("chat:message",      t => { var c = t?.ToObject<ChatMessageDTO>(); OnChatReceived?.Invoke(c?.playerName, c?.message); });
        _socket.On("game:returnToLobby", t => OnReturnToLobby?.Invoke());
        _socket.On("game:flameUpdate",  t => OnFlameUpdate?.Invoke(t?.ToObject<FlameUpdateDTO>()));
    }

    // ==================== 连接 ====================

    public void Connect()
    {
        if (_socket == null) return;
        if (!string.IsNullOrEmpty(serverUrl)) _socket.serverUrl = serverUrl;
        _socket.Connect();
    }

    public void Disconnect() => _socket?.Disconnect();

    public void QuickLogin(string name)
    {
        playerName = name;
        Connect();
    }

    // ==================== 房间 / 开始 ====================

    public void CreateRoom(int maxPlayers = 12, Action<string> callback = null)
        => CreateRoom("THIRD_PERSON", maxPlayers, callback);

    public void CreateRoom(string gameMode, int maxPlayers, Action<string> callback)
    {
        if (!IsConnected) { callback?.Invoke(null); return; }
        _socket.Emit("room:create", new { playerName, gameMode, maxPlayers }, ack =>
        {
            if (AckOk(ack))
            {
                _roomCode = ack["roomCode"]?.ToObject<string>();
                _isHost = true;
                callback?.Invoke(_roomCode);
            }
            else
            {
                Debug.LogWarning("[Network] CreateRoom 失败: " + AckStr(ack, "error"));
                callback?.Invoke(null);
            }
        });
    }

    public void JoinRoom(string roomCode, Action<bool> callback = null)
    {
        if (!IsConnected) { callback?.Invoke(false); return; }
        _socket.Emit("room:join", new { roomCode, playerName }, ack =>
        {
            bool ok = AckOk(ack);
            if (ok) { _roomCode = roomCode; _isHost = false; }
            else Debug.LogWarning("[Network] JoinRoom 失败: " + AckStr(ack, "error"));
            callback?.Invoke(ok);
        });
    }

    public void StartGame()
    {
        if (!IsConnected) return;
        _socket.Emit("game:start", new { }, ack =>
        {
            if (!AckOk(ack))
                Debug.LogWarning("[Network] StartGame 失败: " + AckStr(ack, "error"));
        });
    }

    public void LeaveRoom() => _socket?.Emit("room:leave");
    public void BackToLobby() => _socket?.Emit("room:backToLobby");
    public void ReturnToRoomLobby() => _socket?.Emit("room:returnToLobby");
    public void RequestState() => _socket?.Emit("game:requestState");

    // ==================== 3D 追逃 ====================

    public void SendPositionUpdate(float x, float y, float z, float rotY, bool isMoving, bool isSprinting)
    {
        if (!IsConnected) return;
        _socket.Emit("player:position", new { x, y, z, rotY, isMoving, isSprinting });
    }

    public void Send3DAttack(string targetId, Action<AttackResultDTO> callback = null)
    {
        if (!IsConnected) { callback?.Invoke(null); return; }
        _socket.Emit("3d:attack", new { targetId }, ack =>
        {
            AttackResultDTO r = ack?.ToObject<AttackResultDTO>();
            if (r != null) r.success = AckOk(ack);
            OnAttackResult?.Invoke(r);
            callback?.Invoke(r);
        });
    }

    public void Send3DHide(string hideSpotId, Action<bool> callback = null)
    {
        if (!IsConnected) { callback?.Invoke(false); return; }
        _socket.Emit("3d:hide", new { hideSpotId }, ack => callback?.Invoke(AckOk(ack)));
    }

    public void Send3DUnhide() => _socket?.Emit("3d:unhide");

    public void Send3DCollect(string flameId, Action<bool> callback = null)
    {
        if (!IsConnected) { callback?.Invoke(false); return; }
        _socket.Emit("3d:collect", new { flameId }, ack => callback?.Invoke(AckOk(ack)));
    }

    public void Send3DRitual(Action<bool> callback = null)
    {
        if (!IsConnected) { callback?.Invoke(false); return; }
        _socket.Emit("3d:ritual", new { }, ack => callback?.Invoke(AckOk(ack)));
    }

    // ==================== 桌游兼容 (保留原签名) ====================

    public void SelectCharacter(string characterId) => _socket?.Emit("character:select", new { characterId });
    public void SubmitNightAction(string action, string target, Dictionary<string, object> ability) => _socket?.Emit("night:action", new { action, target, ability });
    public void SubmitVote(string targetId) => _socket?.Emit("vote:submit", new { targetId });
    public void FlameTrackerDayShoot(string targetId) => _socket?.Emit("flameTracker:dayShoot", new { targetId });
    public void SkipDiscussion() => _socket?.Emit("discussion:skip");
    public void SkipNightStep() => _socket?.Emit("night:skip");
    public void SendChat(string message) => _socket?.Emit("chat:message", new { message });

    public void SetRoomPassword(string password) => _socket?.Emit("room:setPassword", new { password });
    public void ToggleBots(bool enabled) => _socket?.Emit("room:toggleBots", new { enabled });
    public void SetBotCount(int count) => _socket?.Emit("room:setBotCount", new { count });
    public void UpdateMaxPlayers(int maxPlayers) => _socket?.Emit("room:updateMaxPlayers", new { maxPlayers });

    public void GetHouseVisitors(string houseId, Action<int> callback = null)
    {
        if (!IsConnected) { callback?.Invoke(0); return; }
        _socket.Emit("room:houseVisitors", new { houseId }, ack =>
            callback?.Invoke(ack?["count"]?.ToObject<int>() ?? 0));
    }

    public void GetLobbyList(Action<RoomInfo[]> callback = null)
    {
        if (!IsConnected) { callback?.Invoke(new RoomInfo[0]); return; }
        _socket.Emit("lobby:list", null, ack =>
        {
            var list = new List<RoomInfo>();
            if (ack != null)
            {
                JToken arr = ack as JArray ?? ack["rooms"] ?? ack["list"];
                if (arr != null) list = arr.ToObject<List<RoomInfo>>();
            }
            OnRoomListReceived?.Invoke(list.ToArray());
            callback?.Invoke(list.ToArray());
        });
    }

    // ==================== 工具 ====================

    static bool AckOk(JToken a) => a?["success"]?.ToObject<bool>() ?? false;
    static string AckStr(JToken a, string key) => a?[key]?.ToObject<string>();

    void OnDestroy() { }
}
