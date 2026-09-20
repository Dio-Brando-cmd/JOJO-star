// FirstPersonController.cs — 自包含第一人称控制器 (WASD + 鼠标视角 + 跳跃)
// 依赖: CharacterController + 子物体 Camera
using UnityEngine;

public class FirstPersonController : MonoBehaviour
{
    public float walkSpeed = 4f;
    public float sprintSpeed = 8f;
    public float mouseSensitivity = 2.2f;
    public float jumpSpeed = 5f;
    public float gravity = 20f;

    private CharacterController cc;
    private Camera cam;
    private float pitch = 0f;
    private float verticalVelocity = 0f;

    void Start()
    {
        cc = GetComponent<CharacterController>();
        cam = GetComponentInChildren<Camera>();
        if (cc == null) cc = gameObject.AddComponent<CharacterController>();
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }
        if (Input.GetMouseButtonDown(0) && Cursor.lockState != CursorLockMode.Locked)
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }
        if (Cursor.lockState != CursorLockMode.Locked || cc == null) return;

        // 鼠标视角
        float mx = Input.GetAxis("Mouse X") * mouseSensitivity;
        float my = Input.GetAxis("Mouse Y") * mouseSensitivity;
        transform.Rotate(0f, mx, 0f);
        pitch -= my;
        pitch = Mathf.Clamp(pitch, -85f, 85f);
        if (cam != null) cam.transform.localRotation = Quaternion.Euler(pitch, 0f, 0f);

        // 移动
        float h = Input.GetAxisRaw("Horizontal");
        float v = Input.GetAxisRaw("Vertical");
        bool sprint = Input.GetKey(KeyCode.LeftShift);
        float speed = sprint ? sprintSpeed : walkSpeed;
        Vector3 move = (transform.right * h + transform.forward * v).normalized * speed;

        // 重力 + 跳跃
        if (cc.isGrounded)
        {
            verticalVelocity = -1f;
            if (Input.GetKeyDown(KeyCode.Space)) verticalVelocity = jumpSpeed;
        }
        else
        {
            verticalVelocity -= gravity * Time.deltaTime;
        }
        move.y = verticalVelocity;
        cc.Move(move * Time.deltaTime);
    }
}
