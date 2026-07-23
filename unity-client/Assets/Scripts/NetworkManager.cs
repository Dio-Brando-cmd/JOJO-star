// ============================================================
// NetworkManager.cs — 连接帷幕之地Node.js服务端
// 使用 SocketIOClient 包 (Unity Asset Store 免费)
// 安装: Window → Package Manager → Add from git URL:
//   https://github.com/itisnajim/SocketIOUnity.git
// ============================================================

using UnityEngine;
using SocketIOClient;
using SocketIOClient.Newtonsoft.Json;
using System;
using System.Collections.Generic;

[System.Serializable]
public class PlayerState
{
    public string id;
    public string name;
    public bool alive;
    public string characterId;
    public string role;
    public float posX, posY, posZ;
    public float rotY;
    public bool isMoving;
    public bool isSprinting;
}

[System.Serializable]
public class GameState
{
    public string id;
    public string hostId;
    public string phase;
    public int round;
    public string nightStep;
    public PlayerState[] players;
    public int timeLeft;
}

[System.Serializable]
public class PrivateState
{
    public string myRole;
    public string myTeam;
    public string characterId;
    // ... 更多字段
}

[System.Serializable]
public class CharacterSelectData
{
    public string[] availableCharacters;
    public Dictionary<string, string> selections;
    public int timeLeft;
}

public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }

    [Header("Server Settings")]
    public string serverUrl = "http://210.16.170.144:4000";
    public bool autoConnect = true;

    [Header("Player Info")]
    public string playerName = "Player";
    public string playerId;

    private SocketIOUnity socket;

    // Events
    public event Action<GameState> OnGameStateReceived;
    public event Action<PrivateState> OnPrivateStateReceived;
    public event Action<CharacterSelectData> OnCharacterSelect;
    public event Action<string> OnGameStarted;
    public event Action<string, string> OnGameOver;
    public event Action<string, string> OnPhaseChange;
    public event Action<string, string> OnChatReceived;     // sender, message
    public event Action<RoomInfo[]> OnRoomListReceived;      // 大厅房间列表

    void Awake()
    {
        if (Instance == null) Instance = this;
        else { Destroy(gameObject); return; }
        DontDestroyOnLoad(gameObject);
    }

    void Start()
    {
        if (autoConnect) StartCoroutine(ConnectToServer());
    }

    System.Collections.IEnumerator ConnectToServer()
    {
        var uri = new Uri(serverUrl);
        socket = new SocketIOUnity(uri, new SocketIOOptions
        {
            Transport = SocketIOClient.Transport.TransportProtocol.WebSocket,
            Reconnection = true,
            ReconnectionAttempts = 5,
            ReconnectionDelay = 2000
        });
        socket.JsonSerializer = new NewtonsoftJsonSerializer();

        // === 注册服务端事件 ===
        socket.OnConnected += (sender, e) =>
        {
            Debug.Log($"[Network] Connected to {serverUrl}");
            // 快速游戏登录
            socket.EmitAsync("auth:quickLogin", new { playerName });
        };

        socket.OnDisconnected += (sender, e) =>
        {
            Debug.LogWarning($"[Network] Disconnected: {e}");
        };

        socket.OnError += (sender, e) =>
        {
            Debug.LogError($"[Network] Error: {e}");
        };

        // game:state — 游戏公开状态
        socket.On("game:state", response =>
        {
            var state = response.GetValue<GameState>();
            Debug.Log($"[Network] Game State: phase={state.phase}, round={state.round}");
            UnityMainThreadDispatcher.Enqueue(() => OnGameStateReceived?.Invoke(state));
        });

        // game:privateState — 玩家私密状态（角色/阵营/能力）
        socket.On("game:privateState", response =>
        {
            var pvt = response.GetValue<PrivateState>();
            Debug.Log($"[Network] Private State: role={pvt.myRole}");
            UnityMainThreadDispatcher.Enqueue(() => OnPrivateStateReceived?.Invoke(pvt));
        });

        // game:characterSelect — 选人阶段（独立事件）
        socket.On("game:characterSelect", response =>
        {
            var data = response.GetValue<CharacterSelectData>();
            UnityMainThreadDispatcher.Enqueue(() => OnCharacterSelect?.Invoke(data));
        });

        // 在 game:state 中也检测 CHARACTER_SELECT phase
        // This is handled in the main game:state handler above

        // game:started — 游戏正式开始
        socket.On("game:started", response =>
        {
            UnityMainThreadDispatcher.Enqueue(() => OnGameStarted?.Invoke(""));
        });

        // game:prologue — 序幕
        socket.On("game:prologue", response =>
        {
            Debug.Log("[Network] Prologue received");
        });

        // game:over — 游戏结束
        socket.On("game:over", response =>
        {
            var winner = response.GetValue<Newtonsoft.Json.Linq.JObject>()?["winner"]?.ToString();
            UnityMainThreadDispatcher.Enqueue(() => OnGameOver?.Invoke(winner, ""));
        });

        // game:phaseChange — 阶段变化
        socket.On("game:phaseChange", response =>
        {
            var phase = response.GetValue<Newtonsoft.Json.Linq.JObject>()?["phase"]?.ToString();
            var nightStep = response.GetValue<Newtonsoft.Json.Linq.JObject>()?["nightStep"]?.ToString();
            UnityMainThreadDispatcher.Enqueue(() => OnPhaseChange?.Invoke(phase, nightStep));
        });

        // game:nightStep — 夜晚步骤变化
        socket.On("game:nightStep", response =>
        {
            Debug.Log("[Network] Night step changed");
        });

        // chat:message — 接收聊天消息
        socket.On("chat:message", response =>
        {
            var obj = response.GetValue<Newtonsoft.Json.Linq.JObject>();
            var sender = obj?["sender"]?.ToString() ?? "";
            var message = obj?["message"]?.ToString() ?? "";
            UnityMainThreadDispatcher.Enqueue(() => OnChatReceived?.Invoke(sender, message));
        });

        // game:returnToLobby — 游戏结束后返回房间大厅
        socket.On("game:returnToLobby", response =>
        {
            Debug.Log("[Network] Return to lobby");
        });

        socket.ConnectAsync();
        yield return null;
    }

    // === 发送事件 ===

    /// <summary>快速登录（无需注册账号）</summary>
    public void QuickLogin(string name)
    {
        playerName = name;
        socket.EmitAsync("auth:quickLogin", new { playerName = name });
    }

    /// <summary>创建房间</summary>
    public void CreateRoom(int maxPlayers = 12, System.Action<string> callback = null)
    {
        socket.EmitAsync("room:create", new { maxPlayers }, response =>
        {
            var result = response.GetValue<Newtonsoft.Json.Linq.JObject>();
            var roomCode = result?["roomCode"]?.ToString();
            Debug.Log($"[Network] Room created: {roomCode}");
            UnityMainThreadDispatcher.Enqueue(() => callback?.Invoke(roomCode));
        });
    }

    /// <summary>加入房间</summary>
    public void JoinRoom(string roomCode, System.Action<bool> callback = null)
    {
        socket.EmitAsync("room:join", new { roomCode }, response =>
        {
            var result = response.GetValue<Newtonsoft.Json.Linq.JObject>();
            var success = result?["success"]?.ToObject<bool>() ?? false;
            Debug.Log($"[Network] Join room: {success}");
            UnityMainThreadDispatcher.Enqueue(() => callback?.Invoke(success));
        });
    }

    /// <summary>开始游戏（房主）</summary>
    public void StartGame()
    {
        socket.EmitAsync("game:start");
    }

    /// <summary>选择表层身份</summary>
    public void SelectCharacter(string characterId)
    {
        socket.EmitAsync("character:select", new { characterId });
    }

    /// <summary>提交夜晚行动</summary>
    public void SubmitNightAction(string action, string target, Dictionary<string, object> ability)
    {
        socket.EmitAsync("night:action", new {
            action,
            target,
            ability
        });
    }

    /// <summary>提交投票</summary>
    public void SubmitVote(string targetId)
    {
        socket.EmitAsync("vote:submit", new { targetId });
    }

    /// <summary>猎人白天开枪</summary>
    public void HunterDayShoot(string targetId)
    {
        socket.EmitAsync("hunter:dayShoot", new { targetId });
    }

    /// <summary>跳过讨论发言</summary>
    public void SkipDiscussion()
    {
        socket.EmitAsync("discussion:skip");
    }

    /// <summary>发送聊天消息</summary>
    public void SendChat(string message)
    {
        socket.EmitAsync("chat:message", new { message });
    }

    /// <summary>发送3D位置更新</summary>
    public void SendPositionUpdate(float x, float y, float z, float rotY, bool isMoving, bool isSprinting)
    {
        socket.EmitAsync("player:position", new {
            x, y, z, rotY, isMoving, isSprinting
        });
    }

    /// <summary>离开房间</summary>
    public void LeaveRoom()
    {
        socket.EmitAsync("room:leave");
    }

    /// <summary>返回大厅（断开房间连接）</summary>
    public void BackToLobby()
    {
        socket.EmitAsync("room:backToLobby");
    }

    /// <summary>游戏结束后返回房间大厅</summary>
    public void ReturnToRoomLobby()
    {
        socket.EmitAsync("room:returnToLobby");
    }

    /// <summary>获取大厅房间列表</summary>
    public void GetLobbyList(System.Action<RoomInfo[]> callback = null)
    {
        socket.EmitAsync("lobby:list", response =>
        {
            var arr = response.GetValue<Newtonsoft.Json.Linq.JArray>();
            var rooms = arr?.ToObject<RoomInfo[]>();
            UnityMainThreadDispatcher.Enqueue(() => callback?.Invoke(rooms));
        });
    }

    /// <summary>设置房间密码</summary>
    public void SetRoomPassword(string password)
    {
        socket.EmitAsync("room:setPassword", new { password });
    }

    /// <summary>切换人机模式</summary>
    public void ToggleBots(bool enabled)
    {
        socket.EmitAsync("room:toggleBots", new { enabled });
    }

    /// <summary>设置人机数量</summary>
    public void SetBotCount(int count)
    {
        socket.EmitAsync("room:setBotCount", new { count });
    }

    /// <summary>修改最大人数</summary>
    public void UpdateMaxPlayers(int maxPlayers)
    {
        socket.EmitAsync("room:updateMaxPlayers", new { maxPlayers });
    }

    /// <summary>获取屋子访客数量</summary>
    public void GetHouseVisitors(string houseId, System.Action<int> callback = null)
    {
        socket.EmitAsync("room:houseVisitors", new { houseId }, response =>
        {
            var obj = response.GetValue<Newtonsoft.Json.Linq.JObject>();
            var count = obj?["count"]?.ToObject<int>() ?? 0;
            UnityMainThreadDispatcher.Enqueue(() => callback?.Invoke(count));
        });
    }

    /// <summary>跳过夜晚步骤</summary>
    public void SkipNightStep()
    {
        socket.EmitAsync("night:skip");
    }

    /// <summary>请求全量游戏状态（断线重连）</summary>
    public void RequestState()
    {
        socket.EmitAsync("game:requestState");
    }

    void OnDestroy()
    {
        if (socket != null)
        {
            socket.DisconnectAsync();
        }
    }
}

// ============================================================
// RoomInfo.cs — 房间列表项
// ============================================================
[System.Serializable]
public class RoomInfo
{
    public string roomCode;
    public string hostName;
    public int playerCount;
    public int maxPlayers;
    public bool isPrivate;
    public bool hasPassword;
}

// ============================================================
// UnityMainThreadDispatcher.cs
// 将Socket回调调度到Unity主线程（Unity API只能在主线程调用）
// ============================================================
using UnityEngine;
using System;
using System.Collections.Generic;

public class UnityMainThreadDispatcher : MonoBehaviour
{
    private static readonly Queue<Action> _executionQueue = new Queue<Action>();
    private static UnityMainThreadDispatcher _instance;

    public static UnityMainThreadDispatcher Instance
    {
        get
        {
            if (_instance == null)
            {
                var obj = new GameObject("MainThreadDispatcher");
                _instance = obj.AddComponent<UnityMainThreadDispatcher>();
                DontDestroyOnLoad(obj);
            }
            return _instance;
        }
    }

    public static void Enqueue(Action action)
    {
        lock (_executionQueue)
        {
            _executionQueue.Enqueue(action);
        }
    }

    void Update()
    {
        lock (_executionQueue)
        {
            while (_executionQueue.Count > 0)
            {
                _executionQueue.Dequeue()?.Invoke();
            }
        }
    }
}
