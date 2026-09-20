// ============================================================
// ThirdPersonCamera.cs — 第三人称环绕/跟随相机
//
// 用途: 「帷幕追猎」本机角色视角。鼠标环绕(水平 yaw + 垂直 pitch)、
//       距离可调、平滑跟随、地形遮挡拉近(避免穿墙)。
//
// 由 PlayerController3D 在本地角色上创建并 SetTarget。
// 设计要点:
//   - 相机独立环绕, 角色只面向「移动方向」→ 追猎时可回头边跑边看
//   - 遮挡射线从角色胶囊外起步, 避免命中玩家自身碰撞体
// ============================================================

using UnityEngine;

public class ThirdPersonCamera : MonoBehaviour
{
    [Header("目标")]
    public Transform target;            // 跟随目标(本地玩家)
    public float lookHeight = 1.6f;     // 视线焦点高度(角色胸口)

    [Header("环绕")]
    public float distance = 4.5f;       // 相机距目标距离
    public float pitchMin = -35f;       // 低头下限
    public float pitchMax = 65f;        // 抬头上限
    public float mouseSensitivity = 3f; // 鼠标灵敏度

    [Header("平滑")]
    public float positionSmooth = 10f;  // 位置插值速度
    public float rotationSmooth = 14f;  // 朝向插值速度

    // 内部
    float yaw, pitch;
    Vector3 currentPos;

    public void SetTarget(Transform t)
    {
        target = t;
        if (t != null)
        {
            yaw = t.eulerAngles.y;
            pitch = 14f;
            // 立即定位到目标后方, 避免首帧闪到原点
            Quaternion rot = Quaternion.Euler(pitch, yaw, 0f);
            Vector3 focus = t.position + Vector3.up * lookHeight;
            transform.position = focus - rot * Vector3.forward * distance;
            currentPos = transform.position;
            transform.LookAt(focus);
        }
    }

    void LateUpdate()
    {
        if (target == null) return;

        // 鼠标环绕(仅光标锁定时)
        if (Cursor.lockState == CursorLockMode.Locked)
        {
            yaw += Input.GetAxis("Mouse X") * mouseSensitivity;
            pitch -= Input.GetAxis("Mouse Y") * mouseSensitivity;
            pitch = Mathf.Clamp(pitch, pitchMin, pitchMax);
        }

        Quaternion rot = Quaternion.Euler(pitch, yaw, 0f);
        Vector3 focus = target.position + Vector3.up * lookHeight;
        Vector3 desired = focus - rot * Vector3.forward * distance;

        // 遮挡检测: 焦点→相机射线被地形挡则拉近(从胶囊外起步, 不打到玩家自己)
        Vector3 dir = desired - focus;
        float maxDist = dir.magnitude;
        if (maxDist > 0.6f)
        {
            Vector3 origin = focus + dir.normalized * 0.5f;
            float castDist = maxDist - 0.5f + 0.1f;
            if (Physics.Raycast(origin, dir.normalized, out RaycastHit hit, castDist, ~0, QueryTriggerInteraction.Ignore))
            {
                desired = hit.point + hit.normal * 0.2f;
            }
        }

        // 平滑位置(帧率无关的指数平滑)
        currentPos = Vector3.Lerp(currentPos, desired, 1f - Mathf.Exp(-positionSmooth * Time.deltaTime));
        transform.position = currentPos;

        // 平滑朝向
        Quaternion lookRot = Quaternion.LookRotation(focus - transform.position);
        transform.rotation = Quaternion.Slerp(transform.rotation, lookRot, 1f - Mathf.Exp(-rotationSmooth * Time.deltaTime));
    }
}
