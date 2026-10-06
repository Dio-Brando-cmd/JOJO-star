using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace VeilLand.DayVillage
{
    [RequireComponent(typeof(CharacterController))]
    public class DayVillageWalkthrough : MonoBehaviour
    {
        public Camera viewCamera;
        public Transform visual;
        public Vector3 spawn;
        public Transform[] taskPoints;
        public string[] taskNames;
        public GameObject nightOverlay;
        public Animator animator;
        public Transform[] taskOrbs;                 // 各任务点物资球 (收集后隐藏)
        public Transform altar;                      // 交付祭坛 (集齐后激活)
        public System.Action onAllTasksDelivered;    // 全部交付回调 → 强制入夜
        CharacterController body;
        float yaw, pitch = 15, verticalSpeed, progress;
        bool overview = true, smoke, introDone;
        float introElapsed;
        const float IntroSeconds = 4.5f;
        bool[] completed;
        int collectedCount;
        bool delivered;
        Font font;
        GUIStyle text, title;
        void Start()
        {
            Application.targetFrameRate = 60;
            body = GetComponent<CharacterController>();
            completed = new bool[taskPoints.Length];
            font = Font.CreateDynamicFontFromOSFont(new[] { "Microsoft YaHei", "SimHei", "Arial" }, 18);
            smoke = Array.IndexOf(Environment.GetCommandLineArgs(), "--day-smoke") >= 0;
            if (smoke) StartCoroutine(SmokeTest());
        }
        void Update()
        {
            if (smoke) return;
            if (Input.GetKeyDown(KeyCode.Tab)) { overview = !overview; introDone = true; }
            if (overview && !introDone) { introElapsed += Time.deltaTime; if (introElapsed >= IntroSeconds) { overview = false; introDone = true; } }
            if (Input.GetKeyDown(KeyCode.R)) ResetPosition();
            if (Input.GetKeyDown(KeyCode.Escape)) Cursor.lockState = CursorLockMode.None;
            if (Input.GetMouseButtonDown(1)) Cursor.lockState = CursorLockMode.Locked;
            if (Input.GetMouseButtonUp(1)) Cursor.lockState = CursorLockMode.None;
            if (Input.GetMouseButton(1))
            { yaw += Input.GetAxis("Mouse X") * 2.2f; pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * 1.8f, -10, 65); }
            if (!overview)
            {
                var input = Vector3.ClampMagnitude(new Vector3(Input.GetAxisRaw("Horizontal"), 0, Input.GetAxisRaw("Vertical")), 1);
                var movement = Quaternion.Euler(0, yaw, 0) * input;
                float speed = Input.GetKey(KeyCode.LeftShift) ? 6 : 3;
                if (Input.GetKey(KeyCode.LeftControl)) speed = 1.5f;
                if (body.isGrounded && verticalSpeed < 0) verticalSpeed = -2;
                if (body.isGrounded && Input.GetKeyDown(KeyCode.Space)) { verticalSpeed = 4; TriggerJump(); }
                verticalSpeed -= 18 * Time.deltaTime;
                body.Move((movement * speed + Vector3.up * verticalSpeed) * Time.deltaTime);
                if (movement.sqrMagnitude > .01f) visual.rotation = Quaternion.Slerp(visual.rotation, Quaternion.LookRotation(movement), Time.deltaTime * 10);
                if (animator) animator.SetFloat("Speed", movement.sqrMagnitude > .01f ? speed : 0f, .12f, Time.deltaTime);
                if (transform.position.y < -30) ResetPosition();
            }
            else if (animator) animator.SetFloat("Speed", 0f, .12f, Time.deltaTime);
            UpdateTasks();
        }
        void LateUpdate()
        {
            if (smoke) return;
            if (overview)
            {
                // 白天开场: 从高空俯瞰缓缓下降, 展现整座聚落 (适配白昼暖阳/淡雾)
                var start = new Vector3(-60, 220, 160);
                var end = new Vector3(-60, 155, 130);
                float t = Mathf.Clamp01(introElapsed / IntroSeconds);
                viewCamera.transform.position = Vector3.Lerp(start, end, Mathf.SmoothStep(0f, 1f, t));
                viewCamera.transform.LookAt(new Vector3(0, 4, 0));
                return;
            }
            var focus = transform.position + Vector3.up * 1.4f;
            var desired = focus + Quaternion.Euler(pitch, yaw, 0) * new Vector3(0, 0, -4.2f);
            var delta = desired - focus;
            if (Physics.SphereCast(focus, .18f, delta.normalized, out var hit, delta.magnitude, 1 << 0, QueryTriggerInteraction.Ignore))
                desired = focus + delta.normalized * Mathf.Max(.35f, hit.distance - .1f);
            viewCamera.transform.position = Vector3.Lerp(viewCamera.transform.position, desired, Time.deltaTime * 8);
            viewCamera.transform.LookAt(focus);
        }
        int NearestTask()
        {
            for (int i = 0; i < taskPoints.Length; i++) if (Vector3.Distance(transform.position, taskPoints[i].position) < 3) return i;
            return -1;
        }
        public void ResetPosition()
        { body.enabled = false; transform.position = spawn; body.enabled = true; verticalSpeed = 0; }

        void TriggerJump()
        {
            if (animator != null && HasParam(animator, "Jump")) animator.SetTrigger("Jump");
        }

        static bool HasParam(Animator a, string n)
        { foreach (var p in a.parameters) if (p.name == n) return true; return false; }

        // 白天共同任务: 收集 4 处物资 → 回祭坛交付 (真实拾取/交付闭环, 替换原"按E占位")
        void UpdateTasks()
        {
            if (delivered) return;
            bool allCollected = collectedCount >= completed.Length;

            if (!allCollected)
            {
                int nearest = NearestTask();
                if (nearest >= 0 && !completed[nearest] && Input.GetKey(KeyCode.E))
                {
                    progress += Time.deltaTime;
                    if (progress >= 3)
                    {
                        completed[nearest] = true;
                        collectedCount++;
                        if (taskOrbs != null && nearest < taskOrbs.Length && taskOrbs[nearest] != null)
                            taskOrbs[nearest].gameObject.SetActive(false);
                        progress = 0;
                        if (collectedCount >= completed.Length && altar != null)
                            altar.gameObject.SetActive(true);
                    }
                }
                else progress = 0;
            }
            else
            {
                // 集齐 → 到祭坛交付
                bool nearAltar = altar != null && Vector3.Distance(transform.position, altar.position) < 3f;
                if (nearAltar && Input.GetKey(KeyCode.E))
                {
                    progress += Time.deltaTime;
                    if (progress >= 3)
                    {
                        delivered = true;
                        progress = 0;
                        if (altar != null) altar.gameObject.SetActive(false);
                        onAllTasksDelivered?.Invoke();
                    }
                }
                else progress = 0;
            }
        }
        void OnGUI()
        {
            if (text == null)
            { text = new GUIStyle(GUI.skin.label) { font = font, fontSize = 16, wordWrap = true }; title = new GUIStyle(text) { fontSize = 22, fontStyle = FontStyle.Bold }; }
            GUI.Box(new Rect(18, 18, 520, 112), "");
            GUI.Label(new Rect(34, 28, 490, 34), "暮色聚落 · 白天场地测试", title);
            GUI.Label(new Rect(34, 66, 490, 54), "WASD 行走 · Shift 奔跑 · 右键拖动视角\n空格跳跃 · Tab 鸟瞰/角色 · R 回到出生点", text);
            bool allCollected = collectedCount >= completed.Length;
            bool nearAltar = altar != null && Vector3.Distance(transform.position, altar.position) < 3f;
            string taskLine = delivered ? "✅ 白天共同任务已交付 · 夜幕降临" :
                allCollected ? "物资已集齐 · 回到出生点祭坛按住 E 交付" :
                "收集物资 " + collectedCount + "/" + completed.Length;
            GUI.Label(new Rect(25, Screen.height - 55, 700, 40), taskLine, text);
            if (!delivered)
            {
                int near = NearestTask();
                if (allCollected && nearAltar)
                    GUI.Label(new Rect(Screen.width / 2f - 170, Screen.height - 135, 400, 65), "祭坛交付 · 按住 E " + progress.ToString("0.0") + "/3 秒", text);
                else if (!allCollected && near >= 0)
                    GUI.Label(new Rect(Screen.width / 2f - 170, Screen.height - 135, 400, 65), taskNames[near] + (completed[near] ? "：已收集" : "\n按住 E 收集物资 " + progress.ToString("0.0") + "/3 秒"), text);
            }
        }
        [Serializable] class SmokeResult { public bool grounded; public bool moved; public bool wallBlocked; public bool floorHit; public float distance; public string note; }
        IEnumerator SmokeTest()
        {
            string output = Path.Combine(Application.dataPath, "..", "Verification"); Directory.CreateDirectory(output);
            yield return null;
            for (int i=0;i<80;i++) { body.Move(Vector3.down * .08f); yield return null; }
            bool grounded = body.isGrounded; var start = transform.position;
            for(int i=0;i<120;i++) { body.Move(new Vector3(0,-.03f,-.025f)); yield return null; }
            var distance = Vector3.Distance(start,transform.position);
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.transform.position=transform.position+new Vector3(0,1,-1.2f);wall.transform.localScale=new Vector3(3,3,.3f);Physics.SyncTransforms();
            var wallZ=wall.transform.position.z;
            for(int i=0;i<80;i++){body.Move(new Vector3(0,-.025f,-.04f));yield return null;}
            bool blocked=transform.position.z>wallZ; Destroy(wall);
            bool floor=Physics.Raycast(transform.position+Vector3.up,Vector3.down,5,1<<0);
            var result=new SmokeResult{grounded=grounded,moved=distance>.5f,wallBlocked=blocked,floorHit=floor,distance=distance,note="Real CharacterController and imported scene colliders. Offline geometry smoke test only."};
            File.WriteAllText(Path.Combine(output,"runtime-smoke.json"),JsonUtility.ToJson(result,true));
            viewCamera.transform.position=transform.position+new Vector3(-3,2.3f,4);viewCamera.transform.LookAt(transform.position+Vector3.up);
            yield return new WaitForEndOfFrame();CaptureView(Path.Combine(output,"Player_Day.png"));
            yield return new WaitForSeconds(2);
            viewCamera.transform.position=new Vector3(-76,64,119);viewCamera.transform.LookAt(new Vector3(0,3,0));
            yield return new WaitForEndOfFrame();CaptureView(Path.Combine(output,"Village_Day.png"));
            yield return new WaitForSeconds(2); Application.Quit(grounded && distance>.5f && blocked && floor ? 0 : 2);
        }
        void CaptureView(string path)
        {
            var target = new RenderTexture(1280, 800, 24, RenderTextureFormat.ARGB32);
            target.Create();
            var request = new UnityEngine.Rendering.Universal.UniversalRenderPipeline.SingleCameraRequest { destination = target };
            UnityEngine.Rendering.RenderPipeline.SubmitRenderRequest(viewCamera, request);
            var previous = RenderTexture.active;
            RenderTexture.active = target;
            var pixels = new Texture2D(1280, 800, TextureFormat.RGB24, false);
            pixels.ReadPixels(new Rect(0, 0, 1280, 800), 0, 0);
            pixels.Apply();
            File.WriteAllBytes(path, pixels.EncodeToPNG());
            RenderTexture.active = previous;
            target.Release(); Destroy(target); Destroy(pixels);
        }
    }
}
