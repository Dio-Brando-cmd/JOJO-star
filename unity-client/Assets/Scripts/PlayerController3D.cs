// ============================================================
// PlayerController3D.cs — 3D角色控制器
// 处理: 移动(WASD)、冲刺(Shift)、蹲伏(Ctrl)、交互(E)、藏匿(Q)
// 动画: 通过 Animator 参数驱动 Freyja 动画
// ============================================================

using UnityEngine;

public class PlayerController3D : MonoBehaviour
{
    [Header("Identity")]
    public bool isLocal = false;
    public string playerId;
    public string characterId;

    [Header("Movement")]
    public float walkSpeed = 3f;
    public float sprintSpeed = 6f;
    public float crouchSpeed = 1.5f;
    public float turnSpeed = 12f;      // 移动时角色转向速度
    public float jumpForce = 5f;

    [Header("Stamina")]
    public float maxStamina = 100f;
    public float currentStamina = 100f;
    public float staminaDrain = 20f;     // 每秒消耗
    public float staminaRegen = 15f;     // 每秒恢复

    [Header("Stealth")]
    public float stealthLevel = 0f;       // 0-10，受特质影响
    public bool isHidden = false;         // 是否在藏匿点中
    public bool isInCombat = false;

    [Header("State")]
    public bool canMove = true;
    public bool movementRestricted = false;
    public string currentAction;

    [Header("Animation")]
    public Animator animator;
    public RuntimeAnimatorController animatorController; // Freyja.controller

    // 内部
    private CharacterController characterController;
    private Camera chaseCamera;          // 本机第三人称相机
    private Vector3 moveDirection;
    private float currentSpeed;
    private bool isSprinting;
    private bool isCrouching;
    private Vector3 targetPosition;       // 远程玩家同步用
    private float targetRotationY;
    private float lastPositionSendTime;

    [Header("Network Sync")]
    public float syncInterval = 0.1f;     // 10Hz位置同步

    // Animator 参数 hash (性能优化)
    private static readonly int PARAM_SPEED      = Animator.StringToHash("Speed");
    private static readonly int PARAM_GROUNDED   = Animator.StringToHash("Grounded");
    private static readonly int PARAM_CROUCHING  = Animator.StringToHash("Crouching");
    private static readonly int PARAM_THROW      = Animator.StringToHash("Throw");
    private static readonly int PARAM_CHARM      = Animator.StringToHash("Charm");
    private static readonly int PARAM_GATHER     = Animator.StringToHash("Gather");
    private static readonly int PARAM_HIT        = Animator.StringToHash("Hit");
    private static readonly int PARAM_DEAD       = Animator.StringToHash("Dead");

    // 动画状态追踪
    private bool isDead = false;

    void Start()
    {
        characterController = GetComponent<CharacterController>();
        if (characterController == null)
            characterController = gameObject.AddComponent<CharacterController>();

        // Animator
        if (animator == null)
            animator = GetComponent<Animator>();
        if (animator == null)
            animator = gameObject.AddComponent<Animator>();

        // 自动加载控制器
        if (animator.runtimeAnimatorController == null && animatorController != null)
            animator.runtimeAnimatorController = animatorController;

        if (isLocal)
        {
            // 创建第三人称环绕相机 (作为子物体, 随角色销毁自动清理)
            var camObj = new GameObject("ChaseCamera");
            camObj.transform.SetParent(transform, false);
            var tpc = camObj.AddComponent<ThirdPersonCamera>();
            chaseCamera = camObj.AddComponent<Camera>();
            camObj.AddComponent<AudioListener>();
            camObj.tag = "MainCamera";   // 供 Camera.main / 名字标签使用
            tpc.SetTarget(transform);
            Cursor.lockState = CursorLockMode.Locked;
        }

        currentStamina = maxStamina;
    }

    void Update()
    {
        if (isLocal)
        {
            HandleLocalInput();
            SendPositionUpdate();
        }
        else
        {
            // 远程玩家：平滑插值到目标位置
            SmoothToTarget();
        }

        // 体力恢复
        if (!isSprinting && currentStamina < maxStamina)
        {
            currentStamina += staminaRegen * Time.deltaTime;
            currentStamina = Mathf.Min(currentStamina, maxStamina);
        }

        // 更新动画参数
        UpdateAnimator();
    }

    void UpdateAnimator()
    {
        if (animator == null || !animator.isActiveAndEnabled) return;

        float horizontalSpeed = new Vector3(moveDirection.x, 0, moveDirection.z).magnitude;

        animator.SetFloat(PARAM_SPEED, isSprinting ? sprintSpeed : horizontalSpeed);
        animator.SetBool(PARAM_GROUNDED, characterController != null && characterController.isGrounded);
        animator.SetBool(PARAM_CROUCHING, isCrouching);
    }

    void HandleLocalInput()
    {
        if (!canMove || Cursor.lockState != CursorLockMode.Locked) return;
        if (characterController == null || chaseCamera == null) return;

        // === 藏匿 (Q 切换, 隐藏时禁止移动/交互) ===
        if (Input.GetKeyDown(KeyCode.Q))
        {
            TryToggleHide();
        }
        if (isHidden) return;

        // === 移动输入 (相机相对: W = 背离相机前进) ===
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector3 camForward = Vector3.ProjectOnPlane(chaseCamera.transform.forward, Vector3.up).normalized;
        Vector3 camRight   = Vector3.ProjectOnPlane(chaseCamera.transform.right,   Vector3.up).normalized;
        Vector3 inputDirection = camRight * horizontal + camForward * vertical;
        inputDirection = Vector3.ClampMagnitude(inputDirection, 1f);

        // === 冲刺 ===
        isSprinting = Input.GetKey(KeyCode.LeftShift) && currentStamina > 0 && !isCrouching;
        if (isSprinting)
        {
            currentSpeed = sprintSpeed;
            currentStamina -= staminaDrain * Time.deltaTime;
        }
        else if (isCrouching)
        {
            currentSpeed = crouchSpeed;
        }
        else
        {
            currentSpeed = walkSpeed;
        }

        // === 蹲伏 ===
        if (Input.GetKeyDown(KeyCode.LeftControl))
        {
            isCrouching = !isCrouching;
            characterController.height = isCrouching ? 1f : 2f;
        }

        // === 移动 + 转向 ===
        float vVel = moveDirection.y;   // 垂直速度单独保留(重力)
        if (inputDirection.magnitude > 0.1f)
        {
            moveDirection = inputDirection * currentSpeed;
            moveDirection.y = vVel;
            // 角色只面向移动方向 (相机已独立环绕, 可边跑边回头)
            Quaternion targetRot = Quaternion.LookRotation(inputDirection);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, 1f - Mathf.Exp(-turnSpeed * Time.deltaTime));
        }
        else
        {
            Vector3 planar = new Vector3(moveDirection.x, 0f, moveDirection.z);
            planar = Vector3.Lerp(planar, Vector3.zero, Time.deltaTime * 5f);
            moveDirection = planar;
            moveDirection.y = vVel;
        }

        // 重力 (贴地时轻微下压, 防悬浮/斜坡滑动)
        if (characterController.isGrounded && moveDirection.y < 0f)
            moveDirection.y = -2f;
        moveDirection.y -= 9.81f * Time.deltaTime;

        characterController.Move(moveDirection * Time.deltaTime);

        // === 交互 ===
        if (Input.GetKeyDown(KeyCode.E))
        {
            TryInteract();
        }
    }

    void TryInteract()
    {
        // 射线检测前方3米内可交互物体
        RaycastHit hit;
        if (Physics.Raycast(transform.position + Vector3.up, transform.forward, out hit, 3f))
        {
            var interactable = hit.collider.GetComponent<IInteractable>();
            if (interactable != null)
            {
                interactable.OnInteract(gameObject);
            }
        }
    }

    void TryToggleHide()
    {
        if (isHidden)
        {
            // 离开藏匿点
            isHidden = false;
            SetPlayerCollision(true);
            NetworkManager.Instance?.Send3DUnhide();
        }
        else
        {
            // 检测附近是否有藏匿点 (带 HidingSpot 组件)
            Collider[] nearby = Physics.OverlapSphere(transform.position, 2f);
            foreach (var col in nearby)
            {
                if (col.GetComponent<HidingSpot>() != null)
                {
                    isHidden = true;
                    SetPlayerCollision(false);
                    NetworkManager.Instance?.Send3DHide(col.gameObject.name);
                    break;
                }
            }
        }
    }

    void SetPlayerCollision(bool enabled)
    {
        var cc = GetComponent<CharacterController>();
        if (cc != null) cc.enabled = enabled;
        var col = GetComponent<Collider>();
        if (col != null) col.enabled = enabled;
    }

    void SendPositionUpdate()
    {
        if (Time.time - lastPositionSendTime < syncInterval) return;
        lastPositionSendTime = Time.time;

        NetworkManager.Instance?.SendPositionUpdate(
            transform.position.x,
            transform.position.y,
            transform.position.z,
            transform.eulerAngles.y,
            moveDirection.magnitude > 0.1f,
            isSprinting
        );
    }

    // ==================== 远程玩家同步 ====================

    public void SetTargetPosition(Vector3 pos, float rotY)
    {
        targetPosition = pos;
        targetRotationY = rotY;
    }

    void SmoothToTarget()
    {
        // 帧率无关的指数平滑 (Lerp 因子用 1-exp(-k·dt), 消除高/低帧率下的手感差异)
        float pt = 1f - Mathf.Exp(-15f * Time.deltaTime);
        transform.position = Vector3.Lerp(transform.position, targetPosition, pt);
        Quaternion targetRot = Quaternion.Euler(0, targetRotationY, 0);
        float rt = 1f - Mathf.Exp(-10f * Time.deltaTime);
        transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, rt);
    }

    // ==================== 特质影响 ====================

    /// <summary>应用表层身份特质对移动的影响</summary>
    public void ApplyTraitModifiers()
    {
        switch (characterId)
        {
            case "SKADI":    // 猎手步伐：移动脚步声减半 → stealthLevel +3
                stealthLevel += 3;
                break;
            case "MORRIGAN": // 自然亲和：室外+10%
                currentSpeed *= 1.1f;
                break;
            case "VORACIOUS_KIN": // 噬星之血：击杀后恢复体力
                break;
            case "FREYJA":   // 纤弱：被蚀者噬灵时无法逃脱（QTE难度提高）
                break;
        }
    }

    // ==================== 动画触发 ====================

    /// <summary>投掷蚀灭药剂</summary>
    public void TriggerThrowPotion()
    {
        if (animator != null && !isDead)
        {
            animator.SetTrigger(PARAM_THROW);
            currentAction = "ThrowPotion";
        }
    }

    /// <summary>使用愈灵符</summary>
    public void TriggerUseCharm()
    {
        if (animator != null && !isDead)
        {
            animator.SetTrigger(PARAM_CHARM);
            currentAction = "UseCharm";
        }
    }

    /// <summary>采集灵植</summary>
    public void TriggerGatherPlant()
    {
        if (animator != null && !isDead)
        {
            animator.SetTrigger(PARAM_GATHER);
            currentAction = "GatherPlant";
        }
    }

    /// <summary>受击反应</summary>
    public void TriggerHitReaction()
    {
        if (animator != null && !isDead)
        {
            animator.SetTrigger(PARAM_HIT);
            currentAction = "HitReaction";
        }
    }

    /// <summary>死亡</summary>
    public void TriggerDeath()
    {
        if (animator != null && !isDead)
        {
            isDead = true;
            canMove = false;
            animator.SetTrigger(PARAM_DEAD);
            currentAction = "Death";
        }
    }

    /// <summary>复活（用于愈灵符救起）</summary>
    public void Revive()
    {
        isDead = false;
        canMove = true;
        currentAction = "Idle";
        if (animator != null)
            animator.Play("Idle");
    }
}

// ============================================================
// 可交互物体接口
// ============================================================
public interface IInteractable
{
    void OnInteract(GameObject interactor);
}

// ============================================================
// 玩家名字标签
// ============================================================
public class PlayerNameTag : MonoBehaviour
{
    public TextMesh nameText;

    void Start()
    {
        if (nameText == null)
            nameText = GetComponent<TextMesh>();
    }

    public void SetName(string name)
    {
        if (nameText != null) nameText.text = name;
    }

    void LateUpdate()
    {
        // 始终面向摄像机
        if (Camera.main != null)
        {
            transform.LookAt(transform.position + Camera.main.transform.forward);
        }
    }
}
