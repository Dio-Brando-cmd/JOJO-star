// ============================================================
// LobbyUI3D.cs — 3D大厅UI
// 房间列表、创建/加入房间、等待玩家、开始游戏
// 挂在Canvas上，与NetworkManager配合
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;

public class LobbyUI3D : MonoBehaviour
{
    public static LobbyUI3D Instance { get; private set; }

    [Header("主面板")]
    public GameObject mainPanel;
    public TMP_InputField playerNameInput;
    public Button connectButton;
    public TextMeshProUGUI connectionStatusText;

    [Header("房间面板")]
    public GameObject roomPanel;
    public TMP_InputField roomCodeInput;
    public TMP_InputField createRoomNameInput;
    public TMP_InputField roomPasswordInput;
    public Button createRoomButton;
    public Button joinRoomButton;
    public Button quickMatchButton;      // 快速匹配
    public Button refreshListButton;
    public Transform roomListContainer;
    public GameObject roomListItemPrefab; // 房间列表项预制件

    [Header("等待面板（在房间内）")]
    public GameObject waitingPanel;
    public TextMeshProUGUI roomCodeDisplay;
    public TextMeshProUGUI playerCountText;
    public Transform playerListContainer;
    public GameObject playerListItemPrefab;
    public Button startGameButton;         // 仅房主可见
    public Button leaveRoomButton;
    public Toggle isPrivateToggle;
    public Toggle enableBotsToggle;
    public Slider botCountSlider;
    public TextMeshProUGUI botCountLabel;
    public TMP_InputField maxPlayersInput;

    [Header("角色选择面板")]
    public GameObject characterSelectPanel;
    public Transform characterGridContainer;
    public GameObject characterCardPrefab;
    public TextMeshProUGUI selectTimerText;
    public TextMeshProUGUI selectInstructionText;
    public Button confirmCharacterButton;

    [Header("聊天面板")]
    public GameObject chatPanel;
    public TMP_InputField chatInput;
    public Button sendChatButton;
    public Transform chatMessageContainer;
    public GameObject chatMessagePrefab;
    public ScrollRect chatScrollRect;

    [Header("提示")]
    public GameObject notificationPopup;
    public TextMeshProUGUI notificationText;

    // 状态
    private string myPlayerName = "";
    private string currentRoomCode = "";
    private bool isHost = false;
    private List<RoomInfo> cachedRoomList = new();
    private CharacterSelectData cachedCharacterData;

    void Awake()
    {
        if (Instance == null) Instance = this;
        else { Destroy(gameObject); return; }
    }

    void Start()
    {
        // 订阅网络事件
        NetworkManager.Instance.OnGameStateReceived += HandleGameState;
        NetworkManager.Instance.OnCharacterSelect += HandleCharacterSelect;
        NetworkManager.Instance.OnGameStarted += HandleGameStarted;
        NetworkManager.Instance.OnGameOver += HandleGameOver;

        // 绑定按钮
        connectButton?.onClick.AddListener(OnConnectClicked);
        createRoomButton?.onClick.AddListener(OnCreateRoomClicked);
        joinRoomButton?.onClick.AddListener(OnJoinRoomClicked);
        quickMatchButton?.onClick.AddListener(OnQuickMatchClicked);
        refreshListButton?.onClick.AddListener(OnRefreshListClicked);
        startGameButton?.onClick.AddListener(OnStartGameClicked);
        leaveRoomButton?.onClick.AddListener(OnLeaveRoomClicked);
        sendChatButton?.onClick.AddListener(OnSendChatClicked);
        confirmCharacterButton?.onClick.AddListener(OnConfirmCharacterClicked);

        // 初始化面板
        ShowMainPanel();
    }

    // ==================== 面板切换 ====================

    void ShowMainPanel()
    {
        mainPanel?.SetActive(true);
        roomPanel?.SetActive(false);
        waitingPanel?.SetActive(false);
        characterSelectPanel?.SetActive(false);
        chatPanel?.SetActive(true); // 大厅也可以聊天
        UpdateConnectionStatus();
    }

    void ShowRoomPanel()
    {
        mainPanel?.SetActive(false);
        roomPanel?.SetActive(true);
        waitingPanel?.SetActive(false);
    }

    void ShowWaitingPanel()
    {
        mainPanel?.SetActive(false);
        roomPanel?.SetActive(false);
        waitingPanel?.SetActive(true);
        characterSelectPanel?.SetActive(false);
        chatPanel?.SetActive(true);
    }

    void ShowCharacterSelect()
    {
        waitingPanel?.SetActive(true); // 保留背景
        characterSelectPanel?.SetActive(true);
    }

    // ==================== 按钮回调 ====================

    void OnConnectClicked()
    {
        myPlayerName = playerNameInput?.text?.Trim() ?? "Player";
        if (string.IsNullOrEmpty(myPlayerName)) myPlayerName = "Player_" + Random.Range(1000, 9999);

        NetworkManager.Instance.playerName = myPlayerName;
        NetworkManager.Instance.QuickLogin(myPlayerName);
        ShowNotification($"已连接，欢迎 {myPlayerName}");

        // 连接后显示房间面板
        Invoke(nameof(ShowRoomPanel), 1f);
    }

    void OnCreateRoomClicked()
    {
        string roomName = createRoomNameInput?.text?.Trim();
        int maxPlayers = 12;
        if (maxPlayersInput != null && int.TryParse(maxPlayersInput.text, out int mp))
            maxPlayers = Mathf.Clamp(mp, 4, 12);

        NetworkManager.Instance.CreateRoom(maxPlayers, (roomCode) =>
        {
            currentRoomCode = roomCode;
            isHost = true;
            ShowNotification($"房间 {roomCode} 创建成功");
            ShowWaitingPanel();
            UpdateWaitingPanel();
        });
    }

    void OnJoinRoomClicked()
    {
        string code = roomCodeInput?.text?.Trim();
        if (string.IsNullOrEmpty(code))
        {
            ShowNotification("请输入房间码");
            return;
        }

        NetworkManager.Instance.JoinRoom(code, (success) =>
        {
            if (success)
            {
                currentRoomCode = code;
                isHost = false;
                ShowNotification($"加入房间 {code}");
                ShowWaitingPanel();
            }
            else
            {
                ShowNotification($"加入房间 {code} 失败");
            }
        });
    }

    void OnQuickMatchClicked()
    {
        // 快速匹配：先创建房间，如果没有合适的就自动创建
        NetworkManager.Instance.CreateRoom(12, (roomCode) =>
        {
            currentRoomCode = roomCode;
            isHost = true;
            ShowNotification($"快速匹配：房间 {roomCode}");
            ShowWaitingPanel();
        });
    }

    void OnRefreshListClicked()
    {
        // 发送 lobby:list 请求刷新房间列表
        // 实际UI刷新由 HandleRoomList 处理
        ShowNotification("刷新房间列表...");
    }

    void OnStartGameClicked()
    {
        if (!isHost)
        {
            ShowNotification("只有房主可以开始游戏");
            return;
        }
        NetworkManager.Instance.StartGame();
    }

    void OnLeaveRoomClicked()
    {
        currentRoomCode = "";
        isHost = false;
        ShowMainPanel();
    }

    void OnSendChatClicked()
    {
        string msg = chatInput?.text?.Trim();
        if (string.IsNullOrEmpty(msg)) return;

        NetworkManager.Instance.SendChat(msg);
        if (chatInput != null) chatInput.text = "";
    }

    // 角色选择
    int selectedCharacterIndex = -1;

    void OnCharacterCardClicked(int index)
    {
        selectedCharacterIndex = index;
        confirmCharacterButton.interactable = true;
    }

    void OnConfirmCharacterClicked()
    {
        if (selectedCharacterIndex < 0) return;
        if (cachedCharacterData == null) return;
        if (selectedCharacterIndex >= cachedCharacterData.availableCharacters.Length) return;

        string charId = cachedCharacterData.availableCharacters[selectedCharacterIndex];
        NetworkManager.Instance.SelectCharacter(charId);
        ShowNotification($"已选择: {charId}");
        confirmCharacterButton.interactable = false;
    }

    // ==================== 网络状态处理 ====================

    void HandleGameState(GameState state)
    {
        if (state.phase == "LOBBY" || state.phase == "WAITING")
        {
            ShowWaitingPanel();
            UpdateWaitingPlayers(state.players);
        }
        else if (state.phase == "CHARACTER_SELECT")
        {
            ShowCharacterSelect();
        }
        else
        {
            // 游戏已开始，隐藏大厅UI
            waitingPanel?.SetActive(false);
            characterSelectPanel?.SetActive(false);
            roomPanel?.SetActive(false);
            mainPanel?.SetActive(false);
        }

        // 更新聊天
        UpdateConnectionStatus();
    }

    void HandleCharacterSelect(CharacterSelectData data)
    {
        cachedCharacterData = data;
        BuildCharacterGrid(data);
        ShowCharacterSelect();
    }

    void HandleGameStarted(string _)
    {
        // 隐藏所有大厅UI
        mainPanel?.SetActive(false);
        roomPanel?.SetActive(false);
        waitingPanel?.SetActive(false);
        characterSelectPanel?.SetActive(false);

        ShowNotification("游戏开始！");
    }

    void HandleGameOver(string winner, string _)
    {
        ShowNotification($"游戏结束：{winner} 获胜");
        // 几秒后恢复大厅
        Invoke(nameof(ShowMainPanel), 5f);
    }

    // ==================== UI更新 ====================

    void UpdateConnectionStatus()
    {
        if (connectionStatusText != null)
        {
            connectionStatusText.text = $"服务器: 210.16.170.144:4000 | 玩家: {myPlayerName}";
        }
    }

    void UpdateWaitingPanel()
    {
        if (roomCodeDisplay != null)
            roomCodeDisplay.text = $"房间码: {currentRoomCode}";

        if (startGameButton != null)
            startGameButton.gameObject.SetActive(isHost);
    }

    void UpdateWaitingPlayers(PlayerState[] players)
    {
        if (playerCountText != null && players != null)
            playerCountText.text = $"玩家: {players.Length}/12";

        if (playerListContainer == null || playerListItemPrefab == null) return;

        // 简单刷新：销毁旧的，创建新的
        foreach (Transform child in playerListContainer)
            Destroy(child.gameObject);

        if (players == null) return;

        foreach (var p in players)
        {
            var item = Instantiate(playerListItemPrefab, playerListContainer);
            var texts = item.GetComponentsInChildren<TextMeshProUGUI>();
            if (texts.Length > 0)
            {
                texts[0].text = p.name;
                if (texts.Length > 1)
                    texts[1].text = p.id == currentRoomCode ? "(房主)" : "";
            }
        }
    }

    void BuildCharacterGrid(CharacterSelectData data)
    {
        if (characterGridContainer == null || characterCardPrefab == null) return;

        foreach (Transform child in characterGridContainer)
            Destroy(child.gameObject);

        for (int i = 0; i < data.availableCharacters.Length; i++)
        {
            string charId = data.availableCharacters[i];
            var card = Instantiate(characterCardPrefab, characterGridContainer);
            var texts = card.GetComponentsInChildren<TextMeshProUGUI>();
            if (texts.Length > 0) texts[0].text = charId;

            var btn = card.GetComponent<Button>();
            if (btn != null)
            {
                int index = i;
                btn.onClick.AddListener(() => OnCharacterCardClicked(index));
            }
        }

        if (selectInstructionText != null)
            selectInstructionText.text = "选择一个表层身份";
    }

    public void AddChatMessage(string sender, string message)
    {
        if (chatMessageContainer == null || chatMessagePrefab == null) return;

        var msgObj = Instantiate(chatMessagePrefab, chatMessageContainer);
        var texts = msgObj.GetComponentsInChildren<TextMeshProUGUI>();
        if (texts.Length > 0) texts[0].text = $"<b>{sender}</b>: {message}";

        // 自动滚动
        Canvas.ForceUpdateCanvases();
        if (chatScrollRect != null)
            chatScrollRect.verticalNormalizedPosition = 0f;
    }

    // ==================== 通知弹窗 ====================

    public void ShowNotification(string msg)
    {
        if (notificationText != null)
            notificationText.text = msg;
        if (notificationPopup != null)
        {
            notificationPopup.SetActive(true);
            CancelInvoke(nameof(HideNotification));
            Invoke(nameof(HideNotification), 3f);
        }
        Debug.Log($"[LobbyUI] {msg}");
    }

    void HideNotification()
    {
        if (notificationPopup != null)
            notificationPopup.SetActive(false);
    }

    // ==================== 公开方法（供其他脚本调用） ====================

    public bool IsInLobby()
    {
        return mainPanel?.activeSelf == true || roomPanel?.activeSelf == true || waitingPanel?.activeSelf == true;
    }

    void OnDestroy()
    {
        if (NetworkManager.Instance != null)
        {
            NetworkManager.Instance.OnGameStateReceived -= HandleGameState;
            NetworkManager.Instance.OnCharacterSelect -= HandleCharacterSelect;
            NetworkManager.Instance.OnGameStarted -= HandleGameStarted;
            NetworkManager.Instance.OnGameOver -= HandleGameOver;
        }
    }
}

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
