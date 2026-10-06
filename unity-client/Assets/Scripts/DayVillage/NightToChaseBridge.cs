using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;

namespace VeilLand.DayVillage
{
    // 夜晚接入真实追逃: 白天场地入夜(自动/任务)后 → 建 THIRD_PERSON 房 + 补人机 + 开局 → 切 ChaseScene
    // 依赖: 登录时 NetworkManager 已 Connect (LoginScreenUI 调 Connect)
    // 服务端 game:start 后有 8s 序幕延迟才发 game:3dNightStart, 足够 ChaseScene 加载并订阅
    public class NightToChaseBridge : MonoBehaviour
    {
        public DayNightCycle cycle;
        public float delayAfterNight = 5f;   // 入夜后停留几秒再转场
        public string chaseScene = "ChaseScene";
        public int botCount = 7;             // 1 真人 + 7 人机 = 8 人 (2v6)

        bool fired;

        void Start()
        {
            if (cycle == null) cycle = FindFirstObjectByType<DayNightCycle>();
            if (cycle != null) cycle.onNightEntered += OnNightEntered;
        }

        void OnDestroy()
        {
            if (cycle != null) cycle.onNightEntered -= OnNightEntered;
        }

        void OnNightEntered()
        {
            if (fired) return;
            fired = true;
            StartCoroutine(EnterChase(delayAfterNight));
        }

        IEnumerator EnterChase(float delay)
        {
            yield return new WaitForSeconds(delay);

            var net = NetworkManager.Instance;
            if (net == null) { SceneManager.LoadScene(chaseScene); yield break; }

            if (!net.IsConnected)
            {
                net.Connect();
                float t = 0;
                while (!net.IsConnected && t < 8f) { t += Time.deltaTime; yield return null; }
            }

            if (net.IsConnected && string.IsNullOrEmpty(net.RoomCode))
            {
                net.CreateRoom("THIRD_PERSON", 12, code =>
                {
                    if (string.IsNullOrEmpty(code)) { SceneManager.LoadScene(chaseScene); return; }
                    net.SetBotCount(botCount);   // 建房后 LOBBY 阶段生效
                    net.StartGame();             // → 服务端 8s 后发 game:3dNightStart
                });
                yield return new WaitForSeconds(2f); // 等 ack 返回 + 服务端进入序幕
            }

            SceneManager.LoadScene(chaseScene);
        }
    }
}
