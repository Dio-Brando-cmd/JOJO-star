// ============================================================
// LobbyAvatar.cs — 大厅角色展示 (芙蕾雅 + 镜头共同指示操作位置)
//
// 登录进入大厅后, 在中央广场生成玩家角色(芙蕾雅, Idle 动画),
// 并在开场镜头结束后把镜头平滑推到能同时看到「角色 + 左右符文巨石」
// 的机位 —— 直观指示玩家当前所处位置与可选操作(左 2D / 右 3D)。
//
// 由 LobbyManager 自动挂载。
// ============================================================

using UnityEngine;

public class LobbyAvatar : MonoBehaviour
{
    [Header("══ 角色 ══")]
    public Vector3 spawnPosition = new Vector3(0f, 0f, 6f);   // 中央广场(两巨石之间)
    public float facingYaw = 180f;                            // 面向镜头(洞口 -Z 方向)

    [Header("══ 镜头(指示操作位置) ══")]
    public bool driveCamera = true;
    public Vector3 cameraOffset = new Vector3(0f, 5.4f, -11f);   // 相对角色(后上方, 拉开看清左右巨石)
    public Vector3 cameraLookOffset = new Vector3(0f, 1.4f, 0f); // 视线焦点(胸口)
    public float cameraFOV = 62f;                                // 广角, 同时纳入角色 + 两块符文巨石
    public float cameraLerpSpeed = 2.5f;

    GameObject _avatar;
    Transform _cam;
    Camera _camComp;

    void Start()
    {
        if (Application.isPlaying)
            Spawn();
    }

    public void Spawn()
    {
        var prefab = Resources.Load<GameObject>("Characters/Freyja_Animated");
        if (prefab == null)
        {
            Debug.LogWarning("[LobbyAvatar] ⚠️ 未找到 Characters/Freyja_Animated, 跳过角色展示");
            return;
        }

        _avatar = Instantiate(prefab, spawnPosition, Quaternion.Euler(0f, facingYaw, 0f), transform);
        _avatar.name = "LobbyAvatar";

        // 大厅展示不需要碰撞体
        foreach (var col in _avatar.GetComponentsInChildren<Collider>(true))
            if (col != null) Destroy(col);

        // 动画控制器 (有 Idle 状态则播放)
        var controller = Resources.Load<RuntimeAnimatorController>("Animations/Freyja");
        var anim = _avatar.GetComponentInChildren<Animator>();
        if (anim == null) anim = _avatar.AddComponent<Animator>();
        if (controller != null)
        {
            anim.runtimeAnimatorController = controller;
            if (anim.HasState(0, Animator.StringToHash("Idle")))
                anim.Play("Idle");
        }

        _cam = Camera.main != null ? Camera.main.transform : null;
        if (_cam != null) _camComp = _cam.GetComponent<Camera>();
        Debug.Log("[LobbyAvatar] 🧍 大厅角色已生成: " + _avatar.name);
    }

    void LateUpdate()
    {
        if (!driveCamera || _cam == null || _avatar == null) return;

        // 等开场镜头结束再切入展示 (IntroDone 由 LobbyManager 置位)
        var lm = LobbyManager.Instance;
        if (lm == null || !lm.IntroDone) return;

        Vector3 desired = _avatar.transform.position + cameraOffset;
        Vector3 lookAt  = _avatar.transform.position + cameraLookOffset;

        float t = 1f - Mathf.Exp(-cameraLerpSpeed * Time.deltaTime);
        _cam.position = Vector3.Lerp(_cam.position, desired, t);
        _cam.rotation = Quaternion.Slerp(_cam.rotation, Quaternion.LookRotation(lookAt - _cam.position), t);

        // 广角: 同时框住角色与左右巨石(指示操作位置)
        if (_camComp != null)
            _camComp.fieldOfView = Mathf.Lerp(_camComp.fieldOfView, cameraFOV, t);
    }
}
