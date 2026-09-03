// ============================================================
// NetworkManager.cs — 桩代码 (临时)
// 正式版需要安装 SocketIO 包后替换回 NetworkManager.cs.bak
// ============================================================

using UnityEngine;
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
}

[System.Serializable]
public class CharacterSelectData
{
    public string[] availableCharacters;
    public int timeLeft;
}

public class NetworkManager : MonoBehaviour
{
    public static NetworkManager Instance { get; private set; }

    [Header("Server Settings")]
    public string serverUrl = "http://210.16.170.144:4000";
    public string playerName = "Player";
    public string playerId;

    public event Action<GameState> OnGameStateReceived;
    public event Action<PrivateState> OnPrivateStateReceived;
    public event Action<CharacterSelectData> OnCharacterSelect;
    public event Action<string> OnGameStarted;
    public event Action<string, string> OnGameOver;
    public event Action<string, string> OnPhaseChange;
    public event Action<string, string> OnChatReceived;
    public event Action<RoomInfo[]> OnRoomListReceived;

    void Awake()
    {
        if (Instance == null) { Instance = this; DontDestroyOnLoad(gameObject); }
        else { Destroy(gameObject); }
    }

    void Start()
    {
        Debug.Log("[Network] Stub mode — SocketIO not installed yet");
        OnGameOver += (winner, reason) => Debug.Log($"[Network] Game over: {winner} ({reason})");
    }

    public void QuickLogin(string name) { playerName = name; Debug.Log($"[Network] QuickLogin: {name}"); }
    public void CreateRoom(int maxPlayers = 12, Action<string> callback = null) { callback?.Invoke("TEST01"); }
    public void JoinRoom(string roomCode, Action<bool> callback = null) { callback?.Invoke(true); }
    public void StartGame() { Debug.Log("[Network] StartGame"); }
    public void SelectCharacter(string characterId) { Debug.Log($"[Network] SelectCharacter: {characterId}"); }
    public void SubmitNightAction(string action, string target, Dictionary<string, object> ability) { Debug.Log($"[Network] NightAction: {action}"); }
    public void SubmitVote(string targetId) { }
    public void FlameTrackerDayShoot(string targetId) { }
    public void SkipDiscussion() { }
    public void SendChat(string message) { }
    public void SendPositionUpdate(float x, float y, float z, float rotY, bool isMoving, bool isSprinting) { }
    public void LeaveRoom() { }
    public void BackToLobby() { }
    public void ReturnToRoomLobby() { }
    public void GetLobbyList(Action<RoomInfo[]> callback = null) { callback?.Invoke(new RoomInfo[0]); }
    public void SetRoomPassword(string password) { }
    public void ToggleBots(bool enabled) { }
    public void SetBotCount(int count) { }
    public void UpdateMaxPlayers(int maxPlayers) { }
    public void GetHouseVisitors(string houseId, Action<int> callback = null) { callback?.Invoke(0); }
    public void SkipNightStep() { }
    public void RequestState() { }

    void OnDestroy() { }
}
