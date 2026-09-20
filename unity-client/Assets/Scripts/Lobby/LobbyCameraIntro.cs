// ============================================================
// LobbyCameraIntro.cs — 桃花源式电影镜头
// 暗穴前行 → 穿雾 → 秘境豁然开朗 → 镜头升起俯瞰
// ============================================================

using UnityEngine;
using System.Collections;

public class LobbyCameraIntro : MonoBehaviour
{
    [Header("══ 路径点 ══")]
    public Transform pathStart;   // 暗穴起点
    public Transform pathMid;     // 薄雾中段
    public Transform pathEnd;     // 俯瞰终点
    public bool autoCreatePath = true;

    [Header("══ 时间 ══")]
    public float totalDuration = 10f;
    [Range(0.2f, 0.9f)]
    public float midPointRatio = 0.55f; // 中段耗时占比

    [Header("══ 视觉效果 ══")]
    public float startFOV = 40f;
    public float midFOV = 55f;
    public float endFOV = 75f;
    public float startFog = 0.025f;   // 够朦胧但不全黑
    public float midFog = 0.015f;
    public float endFog = 0.008f;
    public float startAmbient = 0.3f;  // 能看到轮廓
    public float endAmbient = 0.6f;

    [Header("══ 状态 ══")]
    public bool playOnStart = true;
    public bool introComplete { get; private set; }

    // Private
    private Camera cam;
    private LobbyManager lobbyManager;

    void Start()
    {
        cam = GetComponent<Camera>();
        if (cam == null) cam = Camera.main;
        if (cam == null)
        {
            Debug.LogError("[LobbyCam] 没有 Camera！");
            return;
        }

        lobbyManager = FindFirstObjectByType<LobbyManager>();

        if (autoCreatePath)
            CreateDefaultPath();

        // 开场改由 LobbyManager 在登录后调用 PlayIntro() 控制 (不再自动播放)
    }

    void CreateDefaultPath()
    {
        if (pathStart == null)
        {
            var go = new GameObject("PathStart");
            go.transform.SetParent(transform.parent);
            go.transform.position = new Vector3(0, 1f, -28f);
            go.transform.rotation = Quaternion.Euler(8f, 0f, 0f);
            pathStart = go.transform;
        }
        if (pathMid == null)
        {
            var go = new GameObject("PathMid");
            go.transform.SetParent(transform.parent);
            go.transform.position = new Vector3(0, 3f, -8f);
            go.transform.rotation = Quaternion.Euler(18f, 0f, 0f);
            pathMid = go.transform;
        }
        if (pathEnd == null)
        {
            var go = new GameObject("PathEnd");
            go.transform.SetParent(transform.parent);
            go.transform.position = new Vector3(0, 7f, 4f);
            go.transform.rotation = Quaternion.Euler(28f, 0f, 0f);
            pathEnd = go.transform;
        }
    }

    public IEnumerator PlayIntro()
    {
        Debug.Log("[LobbyCam] 🎬 桃花源开场...");
        introComplete = false;

        // 初始状态
        cam.transform.position = pathStart.position;
        cam.transform.rotation = pathStart.rotation;
        cam.fieldOfView = startFOV;
        RenderSettings.fogDensity = startFog;
        RenderSettings.ambientIntensity = startAmbient;

        yield return new WaitForSeconds(0.5f); // 短暂黑屏后开始

        float elapsed = 0f;
        float midTime = totalDuration * midPointRatio;

        while (elapsed < totalDuration)
        {
            elapsed += Time.deltaTime;

            if (elapsed <= midTime)
            {
                // 阶段1: 暗穴 → 中段（加速穿越）
                float t = elapsed / midTime;
                t = EaseInQuad(t);

                cam.transform.position = Vector3.Lerp(pathStart.position, pathMid.position, t);
                cam.transform.rotation = Quaternion.Slerp(pathStart.rotation, pathMid.rotation, t);
                cam.fieldOfView = Mathf.Lerp(startFOV, midFOV, t);
                RenderSettings.fogDensity = Mathf.Lerp(startFog, midFog, t);
                RenderSettings.ambientIntensity = Mathf.Lerp(startAmbient, endAmbient * 0.5f, t);
            }
            else
            {
                // 阶段2: 中段 → 豁然开朗（缓慢舒展）
                float t = (elapsed - midTime) / (totalDuration - midTime);
                t = EaseOutCubic(t);

                cam.transform.position = Vector3.Lerp(pathMid.position, pathEnd.position, t);
                cam.transform.rotation = Quaternion.Slerp(pathMid.rotation, pathEnd.rotation, t);
                cam.fieldOfView = Mathf.Lerp(midFOV, endFOV, t);
                RenderSettings.fogDensity = Mathf.Lerp(midFog, endFog, t);
                RenderSettings.ambientIntensity = Mathf.Lerp(endAmbient * 0.5f, endAmbient, t);
            }

            yield return null;
        }

        // 最终
        cam.transform.position = pathEnd.position;
        cam.transform.rotation = pathEnd.rotation;
        cam.fieldOfView = endFOV;
        RenderSettings.fogDensity = endFog;
        RenderSettings.ambientIntensity = endAmbient;

        introComplete = true;
        Debug.Log("[LobbyCam] ✅ 秘境展现！");

        lobbyManager?.OnIntroComplete();
    }

    // ============================================================
    // Easing
    // ============================================================

    float EaseInQuad(float t)  => t * t;
    float EaseOutCubic(float t) => 1f - Mathf.Pow(1f - t, 3f);

    // ============================================================
    // Public API
    // ============================================================

    [ContextMenu("Replay")]
    public void Replay()
    {
        StopAllCoroutines();
        introComplete = false;
        if (autoCreatePath && pathStart == null)
            CreateDefaultPath();
        StartCoroutine(PlayIntro());
    }

    public void Skip()
    {
        StopAllCoroutines();
        if (pathEnd != null)
        {
            cam.transform.position = pathEnd.position;
            cam.transform.rotation = pathEnd.rotation;
        }
        cam.fieldOfView = endFOV;
        RenderSettings.fogDensity = endFog;
        RenderSettings.ambientIntensity = endAmbient;
        introComplete = true;
        lobbyManager?.OnIntroComplete();
    }
}
