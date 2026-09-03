// ============================================================
// LobbyStone.cs — 符文传送石碑
// 脉冲光效 / 悬浮标签 / 玩家接近检测 / 场景传送
// ============================================================

using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;

public class LobbyStone : MonoBehaviour
{
    public enum StoneType { TwoDGame, ThreeDGame }

    [Header("══ 配置 ══")]
    public StoneType stoneType = StoneType.TwoDGame;
    public string targetSceneName = "MainScene";
    public string labelText = "进入";
    public LineRenderer runeLines;

    [Header("交互")]
    public float interactRange = 3.5f;
    public KeyCode interactKey = KeyCode.E;

    [Header("动画")]
    public float pulseSpeed = 2f;
    public float pulseAmount = 0.3f;
    public float bobSpeed = 0.6f;
    public float bobHeight = 0.12f;

    // Private
    private Material runeMat;
    private Color runeBaseEmission;
    private TextMesh labelMesh;
    private Vector3 labelBasePos;
    private bool playerNear;
    private bool canInteract;
    private float timeOffset;

    void Start()
    {
        canInteract = (stoneType == StoneType.TwoDGame);

        if (runeLines != null && runeLines.sharedMaterial != null)
        {
            runeMat = new Material(runeLines.sharedMaterial); // 实例化避免共享
            runeLines.sharedMaterial = runeMat;
            runeBaseEmission = runeMat.GetColor("_EmissionColor");
        }

        labelMesh = GetComponentInChildren<TextMesh>();
        if (labelMesh != null)
            labelBasePos = labelMesh.transform.localPosition;

        timeOffset = Random.Range(0f, 10f);
    }

    void Update()
    {
        float t = Time.time + timeOffset;

        // 符文脉冲
        if (runeMat != null)
        {
            float pulse = 1f + Mathf.Sin(t * pulseSpeed) * pulseAmount;
            if (canInteract)
                runeMat.SetColor("_EmissionColor", runeBaseEmission * pulse);
            else
                runeMat.SetColor("_EmissionColor", runeBaseEmission * (0.5f + Mathf.Sin(t * 0.4f) * 0.1f));
        }

        // 标签浮动
        if (labelMesh != null && labelBasePos != null)
        {
            labelMesh.transform.localPosition = labelBasePos + Vector3.up * Mathf.Sin(t * bobSpeed) * bobHeight;
        }

        // 玩家交互
        if (playerNear && canInteract && Input.GetKeyDown(interactKey))
        {
            EnterPortal();
        }
    }

    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player"))
        {
            playerNear = true;
            if (canInteract)
                Debug.Log($"[Lobby] 靠近 {gameObject.name} — 按 E 进入");
        }
    }

    void OnTriggerExit(Collider other)
    {
        if (other.CompareTag("Player"))
            playerNear = false;
    }

    /// <summary>从代码触发进入</summary>
    public void EnterPortal()
    {
        if (!canInteract) return;
        if (string.IsNullOrEmpty(targetSceneName)) return;

        Debug.Log($"[Lobby] 🌀 激活传送门 → {targetSceneName}");
        StartCoroutine(TransitionRoutine());
    }

    IEnumerator TransitionRoutine()
    {
        float duration = 1.5f;
        float elapsed = 0f;

        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;

            // 环境变亮
            RenderSettings.ambientIntensity = Mathf.Lerp(0.2f, 2.5f, t);

            // 符文高频闪烁
            if (runeMat != null)
            {
                float flash = 1f + Mathf.Sin(elapsed * 30f) * (1f + t * 4f);
                runeMat.SetColor("_EmissionColor", runeBaseEmission * flash);
            }

            yield return null;
        }

        SceneManager.LoadScene(targetSceneName);
    }
}
