// ============================================================
// PlayerController3D.cs — 3D角色控制器
// 处理: 移动(WASD)、冲刺(Shift)、蹲伏(Ctrl)、交互(E)、藏匿(Q)
// 第一人称/第三人称切换
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
    public float rotationSpeed = 10f;
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

    // 内部
    private CharacterController characterController;
    private Camera playerCamera;
    private Vector3 moveDirection;
    private float currentSpeed;
    private bool isSprinting;
    private bool isCrouching;
    private Vector3 targetPosition;       // 远程玩家同步用
    private float targetRotationY;
    private float lastPositionSendTime;

    [Header("Network Sync")]
    public float syncInterval = 0.1f;     // 10Hz位置同步

    void Start()
    {
        characterController = GetComponent<CharacterController>();
        if (characterController == null)
            characterController = gameObject.AddComponent<CharacterController>();

        if (isLocal)
        {
            playerCamera = GetComponentInChildren<Camera>();
            if (playerCamera == null)
            {
                // 创建默认摄像机
                var camObj = new GameObject("PlayerCamera");
                camObj.transform.SetParent(transform);
                camObj.transform.localPosition = new Vector3(0, 1.7f, 0);
                playerCamera = camObj.AddComponent<Camera>();
            }
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
    }

    void HandleLocalInput()
    {
        if (!canMove || Cursor.lockState != CursorLockMode.Locked) return;

        // === 移动输入 ===
        float horizontal = Input.GetAxis("Horizontal");
        float vertical = Input.GetAxis("Vertical");

        Vector3 inputDirection = transform.right * horizontal + transform.forward * vertical;
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

        // === 移动 ===
        if (inputDirection.magnitude > 0.1f)
        {
            moveDirection = inputDirection * currentSpeed;
        }
        else
        {
            moveDirection = Vector3.Lerp(moveDirection, Vector3.zero, Time.deltaTime * 5f);
        }

        // 重力
        if (!characterController.isGrounded)
        {
            moveDirection.y -= 9.81f * Time.deltaTime;
        }

        characterController.Move(moveDirection * Time.deltaTime);

        // === 鼠标视角 ===
        float mouseX = Input.GetAxis("Mouse X") * rotationSpeed;
        transform.Rotate(Vector3.up, mouseX);

        // === 交互 ===
        if (Input.GetKeyDown(KeyCode.E))
        {
            TryInteract();
        }

        // === 藏匿 ===
        if (Input.GetKeyDown(KeyCode.Q))
        {
            TryToggleHide();
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
            GetComponent<Collider>().enabled = true;
            // 通知服务端
        }
        else
        {
            // 检测附近是否有藏匿点（柜子、床底、树丛等）
            Collider[] nearby = Physics.OverlapSphere(transform.position, 2f);
            foreach (var col in nearby)
            {
                if (col.CompareTag("HidingSpot"))
                {
                    isHidden = true;
                    GetComponent<Collider>().enabled = false;
                    // 通知服务端
                    break;
                }
            }
        }
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
        transform.position = Vector3.Lerp(transform.position, targetPosition, Time.deltaTime * 15f);
        Quaternion targetRot = Quaternion.Euler(0, targetRotationY, 0);
        transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, Time.deltaTime * 10f);
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
            case "FENRIR_KIN": // 魔狼之血：击杀后恢复体力
                break;
            case "FREYJA":   // 纤弱：被狼攻击时无法逃脱（QTE难度提高）
                break;
        }
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
