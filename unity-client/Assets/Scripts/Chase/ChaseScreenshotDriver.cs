// ============================================================
// ChaseScreenshotDriver.cs — 追猎 HUD 播放态截图驱动器 (runtime, 仅编辑器用)
// 截取: 调试入口 / 夜间 HUD(花名册+体力条+头顶名字+横幅) / 投票面板 / 结算面板 各一张 PNG。
// 注入假状态以覆盖 ChaseHUD 全部元素 (无需真实联网对局)。
// 由环境变量 VEILLAND_CHASE_SHOT=1 控制。
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using System.IO;
#if UNITY_EDITOR
using UnityEditor;
#endif

public class ChaseScreenshotDriver : MonoBehaviour
{
    ChaseGameManager _gm;
    ChaseHUD _hud;
    Camera _cam;
    float _t0;
    bool _entryShot, _hudShot, _voteShot, _overShot;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void AutoStart()
    {
        if (System.Environment.GetEnvironmentVariable("VEILLAND_CHASE_SHOT") != "1") return;
        var go = new GameObject("__ChaseScreenshotDriver");
        go.AddComponent<ChaseScreenshotDriver>();
        Debug.Log("[ChaseShot] 🚀 auto driver attached");
    }

    void Update()
    {
        // 等 ChaseGameManager.Start 完成 (建图 + AddComponent<ChaseHUD>)
        if (_hud == null)
        {
            _gm = ChaseGameManager.Instance;
            _hud = _gm != null ? _gm.GetComponent<ChaseHUD>() : null;
            if (_hud == null) return;
            _t0 = Time.realtimeSinceStartup;
            _cam = Camera.main;
            Debug.Log("[ChaseShot] ✅ HUD 就绪, 开始截图序列");
        }

        float t = Time.realtimeSinceStartup - _t0;
        if (t > 40f) { Debug.LogError("[ChaseShot] ⏰ 超时退出"); Exit(1); return; }

        if (!_entryShot && t >= 1.0f) { _entryShot = true; Capture("chase_entry_preview.png"); SetNightState(); }
        if (!_hudShot  && t >= 3.0f) { _hudShot  = true; Capture("chase_hud_night_preview.png"); SetVoteState(); }
        if (!_voteShot && t >= 5.0f) { _voteShot = true; Capture("chase_hud_vote_preview.png"); SetGameOverState(); }
        if (!_overShot && t >= 7.0f) { _overShot = true; Capture("chase_gameover_preview.png"); }
        if (t >= 8.0f) { Debug.Log("[ChaseShot] ✅ 完成, 退出"); Exit(0); }
    }

    // ============================================================
    // 注入假状态
    // ============================================================

    void SetNightState()
    {
        _gm.gameActive = true; _gm.gameOver = false; _gm.localDead = false;
        _gm.isNight = true; _gm.currentPhase = "NIGHT";
        _gm.myPlayerId = "me";
        _gm.myRole = "SPIRIT_MENDER"; _gm.myTeam = "VEIL_KEEPERS"; _gm.myCharacterId = "村民甲";
        _gm.isCorrupted = false;
        _gm.nightTimeLeft = 88f;
        _gm.flamesCollected = 2; _gm.flamesTotal = 5;
        _gm.ritualActive = true; _gm.ritualTimeLeft = 8f;
        _gm.banner = "已采集灵焰 2/5"; _gm.bannerTimer = 5f;

        _gm.roster.Clear();
        _gm.roster["me"] = new PlayerState { id = "me", name = "我(愈灵师)", alive = true, role = "SPIRIT_MENDER", team = "VEIL_KEEPERS" };
        _gm.roster["p1"] = new PlayerState { id = "p1", name = "冥僧人", alive = true, role = "NETHER_MONK", team = "CORRUPTED" };
        _gm.roster["p2"] = new PlayerState { id = "p2", name = "阿绫", alive = true, role = "SPIRIT_WEAVER", team = "VEIL_KEEPERS" };
        _gm.roster["p3"] = new PlayerState { id = "p3", name = "小满", alive = false, role = "VEIL_GUARDIAN", team = "VEIL_KEEPERS" };

        // 假玩家 (isLocal=false 不建相机): 覆盖体力条 + 头顶名字
        _gm.localPlayer = MakeFakePlayer("FakeLocal", new Vector3(0f, 0f, 0f));
        _gm.remotePlayers.Clear();
        _gm.remotePlayers["p1"] = MakeFakePlayer("FakeP1", new Vector3(6f, 0f, 4f));
        _gm.remotePlayers["p2"] = MakeFakePlayer("FakeP2", new Vector3(-6f, 0f, 3f));
    }

    void SetVoteState()
    {
        _gm.currentPhase = "VOTE"; _gm.isNight = false; _gm.voted = false;
        _gm.banner = ""; _gm.bannerTimer = 0f;
        _gm.ritualActive = false;
    }

    void SetGameOverState()
    {
        _gm.gameOver = true;
        _gm.overWinner = "守幕者阵营";
        _gm.overReason = "蚀者被全部放逐";
    }

    PlayerController3D MakeFakePlayer(string name, Vector3 pos)
    {
        var go = new GameObject(name);
        go.transform.position = pos;
        var pc = go.AddComponent<PlayerController3D>();
        pc.isLocal = false;
        pc.maxStamina = 100f;
        pc.currentStamina = 55f;   // Start() 会重置为 maxStamina, 之后每帧由体力恢复; 无妨
        return pc;
    }

    // ============================================================
    // 截图
    // ============================================================

    void Capture(string file)
    {
        var cam = _cam != null ? _cam : Camera.main;
        if (cam == null) { Debug.LogError("[ChaseShot] ❌ 无相机"); return; }

        // 把 Overlay Canvas 切到 ScreenSpaceCamera, 让 cam.Render 把 UI 画进 RT
        foreach (var canvas in FindObjectsByType<Canvas>(FindObjectsSortMode.None))
        {
            if (canvas.renderMode == RenderMode.ScreenSpaceOverlay)
            {
                canvas.renderMode = RenderMode.ScreenSpaceCamera;
                canvas.worldCamera = cam;
                canvas.planeDistance = 10f;
            }
        }

        int w = 1600, h = 900;
        var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32);
        rt.Create();
        var old = cam.targetTexture; cam.targetTexture = rt; cam.Render(); cam.targetTexture = old;
        var prev = RenderTexture.active; RenderTexture.active = rt;
        var tex = new Texture2D(w, h, TextureFormat.RGB24, false);
        tex.ReadPixels(new Rect(0, 0, w, h), 0, 0); tex.Apply();
        RenderTexture.active = prev;

        var bytes = tex.EncodeToPNG();
        File.WriteAllBytes("E:/veiland/" + file, bytes);
        Debug.Log($"[ChaseShot] 📸 {file} ({bytes.Length} bytes)");

        Destroy(tex);
        rt.Release();
    }

    void Exit(int code)
    {
#if UNITY_EDITOR
        EditorApplication.Exit(code);
#else
        Application.Quit();
#endif
    }
}
