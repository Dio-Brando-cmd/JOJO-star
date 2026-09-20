// ============================================================
// LobbyMainMenu.cs — 大厅标题 + 主菜单 (OnGUI, 自包含)
// 标题「帷幕之地」+ 昵称/服务器 + 3D 追猎 + 退出
// 由 LobbyManager 在开场动画后调用 Show() 显示
// ============================================================

using UnityEngine;
using UnityEngine.SceneManagement;

public class LobbyMainMenu : MonoBehaviour
{
    public static LobbyMainMenu Instance { get; private set; }

    public string title = "帷 幕 之 地";
    public string subtitle = "VEIL LAND";
    public bool visible = false;

    string playerName = "";
    string serverUrl = "http://210.16.170.144:4000";

    GUIStyle titleStyle, subStyle, labelStyle, fieldStyle, btnStyle, hintStyle;

    void Awake()
    {
        Instance = this;
        playerName = PlayerPrefs.GetString("playerName", "玩家");
        serverUrl = PlayerPrefs.GetString("serverUrl", "http://210.16.170.144:4000");
    }

    public void Show()
    {
        visible = true;
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    public void Hide() { visible = false; }

    void EnsureStyles()
    {
        if (titleStyle == null)
        {
            titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 56, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
            titleStyle.normal.textColor = new Color(0.92f, 0.88f, 0.98f);
        }
        if (subStyle == null)
        {
            subStyle = new GUIStyle(GUI.skin.label) { fontSize = 18, alignment = TextAnchor.MiddleCenter };
            subStyle.normal.textColor = new Color(0.55f, 0.62f, 0.92f);
        }
        if (labelStyle == null)
        {
            labelStyle = new GUIStyle(GUI.skin.label) { fontSize = 15 };
            labelStyle.normal.textColor = Color.white;
        }
        if (fieldStyle == null)
            fieldStyle = new GUIStyle(GUI.skin.textField) { fontSize = 16 };
        if (btnStyle == null)
            btnStyle = new GUIStyle(GUI.skin.button) { fontSize = 20, fontStyle = FontStyle.Bold };
        if (hintStyle == null)
        {
            hintStyle = new GUIStyle(GUI.skin.label) { fontSize = 13, alignment = TextAnchor.MiddleCenter };
            hintStyle.normal.textColor = new Color(0.72f, 0.74f, 0.8f);
        }
    }

    void OnGUI()
    {
        if (!visible) return;
        EnsureStyles();

        float w = 440f, h = 430f;
        var area = new Rect((Screen.width - w) * 0.5f, (Screen.height - h) * 0.5f, w, h);
        GUILayout.BeginArea(area);

        GUILayout.Label(title, titleStyle);
        GUILayout.Label(subtitle, subStyle);
        GUILayout.Space(26);

        GUILayout.Label("昵称", labelStyle);
        playerName = GUILayout.TextField(playerName, fieldStyle, GUILayout.Height(34));

        GUILayout.Label("服务器", labelStyle);
        serverUrl = GUILayout.TextField(serverUrl, fieldStyle, GUILayout.Height(34));

        GUILayout.Space(22);

        if (GUILayout.Button("进入 3D 追猎", btnStyle, GUILayout.Height(48)))
            Enter3D();

        GUILayout.Space(14);
        if (GUILayout.Button("退出游戏", GUILayout.Height(30)))
            Quit();

        GUILayout.Space(16);
        GUILayout.Label("或走向符文巨石按 E 进入", hintStyle);

        GUILayout.EndArea();
    }

    void SaveSettings()
    {
        PlayerPrefs.SetString("playerName", playerName.Trim());
        PlayerPrefs.SetString("serverUrl", serverUrl.Trim());
        PlayerPrefs.Save();
    }

    void Enter3D()
    {
        SaveSettings();
        if (LobbyManager.Instance != null) LobbyManager.Instance.Load3DGame();
        else SceneManager.LoadScene("ChaseScene");
    }

    void Quit()
    {
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        Application.Quit();
#endif
    }
}
