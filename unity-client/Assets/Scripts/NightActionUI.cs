// ============================================================
// NightActionUI.cs — 夜晚行动3D界面
// 在3D场景中显示当前步骤的行动选项按钮
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

public class NightActionUI : MonoBehaviour
{
    [Header("UI References")]
    public GameObject actionPanel;
    public Text stepTitleText;
    public Text timerText;
    public Button[] actionButtons;
    public Text[] actionButtonLabels;
    public GameObject targetSelectionPanel;
    public Button confirmButton;

    [Header("Action Config")]
    private string currentStep;
    private string selectedAction;
    private string selectedTarget;
    private float timeLeft;

    void Start()
    {
        NetworkManager.Instance.OnPhaseChange += HandlePhaseChange;
        NetworkManager.Instance.OnGameStateReceived += HandleGameState;
        actionPanel.SetActive(false);
    }

    void HandlePhaseChange(string phase, string nightStep)
    {
        if (phase == "NIGHT" && !string.IsNullOrEmpty(nightStep))
        {
            ShowNightActions(nightStep);
        }
        else
        {
            actionPanel.SetActive(false);
        }
    }

    void HandleGameState(GameState state)
    {
        if (state.phase == "NIGHT")
        {
            timeLeft = state.timeLeft;
            UpdateTimer();
        }
    }

    void ShowNightActions(string step)
    {
        currentStep = step;
        actionPanel.SetActive(true);

        // 根据步骤显示不同的行动选项
        string title = "";
        string[] actions = { "睡觉 SLEEP", "出门 GO_OUT" };

        switch (step)
        {
            case "HUNTER":
                title = "🔫 猎人行动";
                actions = new[] { "睡觉", "出门观察", "使用猎枪", "设陷阱" };
                break;
            case "ALPHA_WOLF":
                title = "👑 种狼行动";
                actions = new[] { "睡觉", "出门", "变狼+感染", "假身份编织" };
                break;
            case "GUARD":
                title = "🛡️ 守卫行动";
                actions = new[] { "睡觉", "出门", "守护", "筑垒", "巡逻", "舍身" };
                break;
            case "CORRUPTED":
                title = "🐺 狼人行动";
                actions = new[] { "睡觉", "出门", "刀人", "嚎叫召集", "伪装混入" };
                break;
            case "SEER":
                title = "🔮 预言家行动";
                actions = new[] { "睡觉", "出门", "查验", "梦境碎片", "灵视" };
                break;
            case "POISON_WITCH":
                title = "☠️ 毒巫行动";
                actions = new[] { "睡觉", "出门", "烈性毒药", "毒雾陷阱", "药水救人" };
                break;
            case "HEAL_WITCH":
                title = "💚 药巫行动";
                actions = new[] { "睡觉", "出门", "万能药", "单目标毒", "诊断", "药草园" };
                break;
            case "VILLAGER":
                title = "👨‍🌾 村民行动";
                actions = new[] { "睡觉", "出门", "偷听" };
                break;
        }

        stepTitleText.text = title;

        // 更新按钮
        for (int i = 0; i < actionButtons.Length; i++)
        {
            if (i < actions.Length)
            {
                actionButtons[i].gameObject.SetActive(true);
                actionButtonLabels[i].text = actions[i];
                int index = i;
                actionButtons[i].onClick.RemoveAllListeners();
                actionButtons[i].onClick.AddListener(() => OnActionSelected(actions[index]));
            }
            else
            {
                actionButtons[i].gameObject.SetActive(false);
            }
        }
    }

    void OnActionSelected(string action)
    {
        selectedAction = action;

        // 需要选择目标的行动
        if (action.Contains("出门") || action.Contains("刀人") || action.Contains("查验") ||
            action.Contains("守护") || action.Contains("筑垒") || action.Contains("毒") ||
            action.Contains("药") || action.Contains("诊断") || action.Contains("舍身"))
        {
            ShowTargetSelection();
        }
        else
        {
            // 不需要目标，直接提交
            SubmitAction(null);
        }
    }

    void ShowTargetSelection()
    {
        targetSelectionPanel.SetActive(true);
        // 在3D场景中高亮可选目标（其他玩家的屋子）
        // 这里由PlayerController中的射线检测处理
    }

    public void OnTargetSelected(string targetId)
    {
        selectedTarget = targetId;
        confirmButton.interactable = true;
    }

    public void OnConfirm()
    {
        SubmitAction(selectedTarget);
        targetSelectionPanel.SetActive(false);
    }

    void SubmitAction(string target)
    {
        // 将UI动作映射到服务端action
        string actionType = "SLEEP";
        string abilityType = null;
        Dictionary<string, object> ability = null;

        if (selectedAction.Contains("睡觉")) actionType = "SLEEP";
        else if (selectedAction.Contains("出门")) actionType = "GO_OUT";
        else if (selectedAction.Contains("嚎叫")) actionType = "HOWL";
        else if (selectedAction.Contains("伪装")) actionType = "DISGUISE";
        else if (selectedAction.Contains("巡逻")) actionType = "PATROL";
        else if (selectedAction.Contains("筑垒")) actionType = "FORTIFY";
        else if (selectedAction.Contains("舍身")) actionType = "SACRIFICE";
        else if (selectedAction.Contains("设陷阱")) actionType = "TRAP_SET";
        else if (selectedAction.Contains("毒雾")) actionType = "POISON_FOG";
        else if (selectedAction.Contains("诊断")) actionType = "DIAGNOSE";
        else if (selectedAction.Contains("药草园")) { actionType = "SLEEP"; ability = new Dictionary<string, object> { ["plantHerbGarden"] = true }; }
        else actionType = "USE_ABILITY";

        if (selectedAction.Contains("刀人")) ability = new Dictionary<string, object> { ["kill"] = true };
        if (selectedAction.Contains("查验")) ability = new Dictionary<string, object> { ["check"] = true };
        if (selectedAction.Contains("守护")) ability = new Dictionary<string, object> { ["guard"] = true };
        if (selectedAction.Contains("烈性毒药")) ability = new Dictionary<string, object> { ["lethalPoison"] = true, ["lethalPoisonTarget"] = target };
        if (selectedAction.Contains("万能药")) ability = new Dictionary<string, object> { ["heal"] = true, ["healTarget"] = target };
        if (selectedAction.Contains("单目标毒")) ability = new Dictionary<string, object> { ["poison"] = true, ["poisonTarget"] = target };
        if (selectedAction.Contains("药水救人")) ability = new Dictionary<string, object> { ["potion"] = true, ["potionTarget"] = target };

        NetworkManager.Instance.SubmitNightAction(actionType, target, ability);
        actionPanel.SetActive(false);
        Debug.Log($"[NightAction] Submitted: {actionType} → {target}");
    }

    void UpdateTimer()
    {
        if (timerText != null)
        {
            timerText.text = $"⏱️ {Mathf.CeilToInt(timeLeft)}s";
        }
    }

    void Update()
    {
        if (timeLeft > 0)
        {
            timeLeft -= Time.deltaTime;
            UpdateTimer();
        }
    }

    void OnDestroy()
    {
        if (NetworkManager.Instance != null)
        {
            NetworkManager.Instance.OnPhaseChange -= HandlePhaseChange;
            NetworkManager.Instance.OnGameStateReceived -= HandleGameState;
        }
    }
}
