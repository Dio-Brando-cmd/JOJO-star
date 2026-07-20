// ============================================================
// GameManager3D.cs — 3D游戏主控制器
// 挂在Unity场景的GameManager GameObject上
// 管理: 场景切换、角色生成、阶段逻辑、摄像机
// ============================================================

using UnityEngine;
using System.Collections.Generic;
using System.Collections;

public class GameManager3D : MonoBehaviour
{
    public static GameManager3D Instance { get; private set; }

    [Header("Prefabs")]
    public GameObject playerPrefab;          // 玩家占位模型
    public GameObject localPlayerPrefab;      // 本地玩家模型（带摄像机）
    public GameObject housePrefab;            // 房屋预制件

    [Header("Scene References")]
    public Transform villageCenter;           // 村庄中心点
    public Transform[] housePositions;        // 12个房屋位置
    public Light moonLight;                   // 月光
    public Light sunLight;                    // 日光

    [Header("Game State")]
    public string currentPhase = "LOBBY";
    public string currentNightStep;
    public int currentRound;
    public float nightTimeLeft;

    private GameState lastGameState;
    private Dictionary<string, PlayerController3D> remotePlayers = new();
    private PlayerController3D localPlayer;
    private string myPlayerId;

    void Awake()
    {
        if (Instance == null) Instance = this;
        else { Destroy(gameObject); return; }
    }

    void Start()
    {
        // 订阅网络事件
        NetworkManager.Instance.OnGameStateReceived += HandleGameState;
        NetworkManager.Instance.OnPrivateStateReceived += HandlePrivateState;
        NetworkManager.Instance.OnPhaseChange += HandlePhaseChange;
        NetworkManager.Instance.OnGameStarted += HandleGameStarted;

        // 默认：大厅光照
        SetLightingMode("LOBBY");
    }

    // ==================== 状态处理 ====================

    void HandleGameState(GameState state)
    {
        lastGameState = state;
        currentPhase = state.phase;
        currentNightStep = state.nightStep;
        currentRound = state.round;

        switch (state.phase)
        {
            case "LOBBY":
                SetLightingMode("LOBBY");
                break;
            case "CHARACTER_SELECT":
                // 选人界面由UI层处理
                break;
            case "NIGHT":
                SetLightingMode("NIGHT");
                HandleNightPhase(state);
                break;
            case "DAY":
            case "DISCUSSION":
            case "VOTE":
                SetLightingMode("DAY");
                HandleDayPhase(state);
                break;
            case "GAME_OVER":
                SetLightingMode("DAY");
                break;
        }

        // 同步远程玩家
        SyncPlayers(state.players);
    }

    void HandlePrivateState(PrivateState pvt)
    {
        Debug.Log($"[Game3D] My role: {pvt.myRole}, team: {pvt.myTeam}");
    }

    void HandlePhaseChange(string phase, string nightStep)
    {
        Debug.Log($"[Game3D] Phase: {phase}, Step: {nightStep}");
        currentPhase = phase;
        currentNightStep = nightStep;

        if (phase == "NIGHT" && localPlayer != null)
        {
            // 进入夜晚——显示当前步骤的UI提示
            ShowNightStepUI(nightStep);
        }
    }

    void HandleGameStarted(string _)
    {
        Debug.Log("[Game3D] Game started!");
        // 生成所有玩家模型
        SpawnAllPlayers();
    }

    // ==================== 玩家管理 ====================

    void SpawnAllPlayers()
    {
        if (lastGameState == null) return;

        for (int i = 0; i < lastGameState.players.Length; i++)
        {
            var p = lastGameState.players[i];
            if (!p.alive) continue;

            Vector3 spawnPos = GetHousePosition(i);
            GameObject playerObj;

            if (p.id == myPlayerId)
            {
                // 本地玩家 — 完整控制
                playerObj = Instantiate(localPlayerPrefab, spawnPos, Quaternion.identity);
                localPlayer = playerObj.GetComponent<PlayerController3D>();
                localPlayer.isLocal = true;
            }
            else
            {
                // 远程玩家 — 网络同步
                playerObj = Instantiate(playerPrefab, spawnPos, Quaternion.identity);
                var remoteCtrl = playerObj.GetComponent<PlayerController3D>();
                remoteCtrl.isLocal = false;
                remoteCtrl.playerId = p.id;
                remotePlayers[p.id] = remoteCtrl;
            }

            // 设置玩家名字标签
            var nameTag = playerObj.GetComponentInChildren<PlayerNameTag>();
            if (nameTag != null) nameTag.SetName(p.name);
        }
    }

    void SyncPlayers(PlayerState[] players)
    {
        foreach (var p in players)
        {
            if (p.id == myPlayerId) continue;
            if (remotePlayers.TryGetValue(p.id, out var ctrl))
            {
                // 平滑插值到目标位置
                Vector3 targetPos = new Vector3(p.posX, p.posY, p.posZ);
                ctrl.SetTargetPosition(targetPos, p.rotY);
                ctrl.gameObject.SetActive(p.alive);
            }
        }
    }

    // ==================== 夜晚/白天逻辑 ====================

    void HandleNightPhase(GameState state)
    {
        nightTimeLeft = state.timeLeft;

        // 如果是我该行动的步骤
        if (CanIActNow(state))
        {
            // 允许本地玩家出门移动
            if (localPlayer != null)
            {
                localPlayer.canMove = true;
                localPlayer.currentAction = state.nightStep;
            }
        }
        else
        {
            // 不是我的步骤——锁定在家
            if (localPlayer != null)
            {
                localPlayer.canMove = false;
            }
        }

        // 更新月光强度（随夜晚时间变化）
        if (moonLight != null)
        {
            moonLight.intensity = 0.5f + 0.3f * Mathf.Sin(state.round * 0.5f);
        }
    }

    void HandleDayPhase(GameState state)
    {
        // 白天所有人可以在村庄中自由走动（但不能进入别人家）
        if (localPlayer != null)
        {
            localPlayer.canMove = true;
            localPlayer.movementRestricted = true; // 有限制区域
        }
    }

    bool CanIActNow(GameState state)
    {
        // 检查当前夜晚步骤是否包含我的角色
        var myPlayer = System.Array.Find(state.players, p => p.id == myPlayerId);
        if (myPlayer == null || !myPlayer.alive) return false;

        // 简化判断：通过nightStep确定
        // 实际应该由服务端_validateNightAction来最终决定
        return true; // 客户端先允许发送，服务端校验
    }

    // ==================== 光照 ====================

    public void SetLightingMode(string phase)
    {
        switch (phase)
        {
            case "LOBBY":
                sunLight.intensity = 1.5f;
                moonLight.intensity = 0f;
                RenderSettings.ambientIntensity = 1.2f;
                break;
            case "NIGHT":
                sunLight.intensity = 0f;
                moonLight.intensity = 0.8f;
                RenderSettings.ambientIntensity = 0.3f;
                RenderSettings.fog = true;
                RenderSettings.fogDensity = 0.02f;
                break;
            case "DAY":
                sunLight.intensity = 1.2f;
                moonLight.intensity = 0f;
                RenderSettings.ambientIntensity = 1.0f;
                RenderSettings.fog = false;
                break;
        }
    }

    // ==================== UI Hooks ====================

    void ShowNightStepUI(string step)
    {
        // 由UI层显示当前步骤的行动选项
        // 例如：狼人步骤显示"刀人/嚎叫/伪装/出门"按钮
    }

    // ==================== 辅助 ====================

    Vector3 GetHousePosition(int index)
    {
        if (housePositions != null && index < housePositions.Length)
            return housePositions[index].position;
        // 默认环形分布
        float angle = index * (360f / 12f) * Mathf.Deg2Rad;
        float radius = 30f;
        return villageCenter.position + new Vector3(
            Mathf.Cos(angle) * radius, 0, Mathf.Sin(angle) * radius);
    }

    void OnDestroy()
    {
        if (NetworkManager.Instance != null)
        {
            NetworkManager.Instance.OnGameStateReceived -= HandleGameState;
            NetworkManager.Instance.OnPrivateStateReceived -= HandlePrivateState;
        }
    }
}
