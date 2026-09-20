// ============================================================
// ScreenshotDriver.cs — 播放态截图驱动器 (runtime, 仅编辑器用)
// 截取: 登录界面 + 沉浸式大厅 各一张 PNG。
// 由环境变量 VEILLAND_SHOT=1 控制; 用真实时间(非帧)驱动, 兼容批处理高帧率。
// ============================================================

using UnityEngine;
using UnityEngine.UI;
using System.IO;
#if UNITY_EDITOR
using UnityEditor;
#endif

public class ScreenshotDriver : MonoBehaviour
{
    float _t0;
    Camera _cam;
    bool _loginShot, _enter, _immersiveShot;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void AutoStart()
    {
        if (System.Environment.GetEnvironmentVariable("VEILLAND_SHOT") != "1") return;
        var go = new GameObject("__ScreenshotDriver");
        go.AddComponent<ScreenshotDriver>();
        Debug.Log("[Shot] 🚀 auto driver attached");
    }

    void Awake()
    {
        _t0 = Time.realtimeSinceStartup;

        // 停掉开场镜头, 固定一个广角机位
        var intro = FindFirstObjectByType<LobbyCameraIntro>();
        if (intro != null) intro.enabled = false;
        _cam = Camera.main;
        if (_cam != null)
        {
            _cam.transform.position = new Vector3(0f, 6.5f, -16f);
            _cam.transform.LookAt(new Vector3(0f, 1f, 4f));
        }

        var lm = LobbyManager.Instance;
        if (lm != null)
        {
            lm.uiDelay = 0f;   // 立即显示沉浸式 UI, 便于截图
            lm.ShowLoginNow();
        }
    }

    void Update()
    {
        float t = Time.realtimeSinceStartup - _t0;
        if (t > 90f) { Debug.LogError("[Shot] ⏰ 超时退出"); Exit(1); return; }

        if (!_loginShot && t >= 0.4f) { _loginShot = true; SetValleyVisible(false); Capture("login_ui_preview.png"); }
        if (!_enter && t >= 1.2f)     { _enter = true; SetValleyVisible(true); LobbyManager.Instance?.OnLoggedIn(); }
        if (!_immersiveShot && t >= 3.8f) { _immersiveShot = true; SetValleyVisible(true); Capture("lobby_immersive_preview.png"); }
        if (t >= 5.2f) { Debug.Log("[Shot] ✅ 完成, 退出"); Exit(0); }
    }

    void SetValleyVisible(bool visible)
    {
        var vs = LobbyManager.Instance?.valleySetup;
        if (vs != null) vs.gameObject.SetActive(visible);
    }

    void Capture(string file)
    {
        var cam = _cam != null ? _cam : Camera.main;
        if (cam == null) { Debug.LogError("[Shot] ❌ 无相机"); return; }

        // 把大厅的所有 Canvas 切到 ScreenSpaceCamera, 让相机渲染时把 UI 画进 RT
        var lm = LobbyManager.Instance;
        if (lm != null)
        {
            foreach (var canvas in lm.GetComponentsInChildren<Canvas>(true))
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
        Debug.Log($"[Shot] 📸 {file} ({bytes.Length} bytes)");

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
