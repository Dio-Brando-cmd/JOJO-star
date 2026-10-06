using UnityEngine;

namespace VeilLand.DayVillage
{
    // 昼夜循环: 同一张地图, 纯光照微调实现夜晚特征 (不换几何/材质)
    // 触发: N 键手动切换; autoSwitchSeconds 后自动入夜
    public class DayNightCycle : MonoBehaviour
    {
        public Light sun;
        public Light moon;
        public GameObject nightGroup;      // 灯笼暖色点光源组 (初始 inactive)
        public float autoSwitchSeconds = 150f;
        public float transitionSeconds = 3f;

        bool night;          // 目标状态
        bool autoSwitched;   // 自动入夜只触发一次, 之后 N 可自由切换
        bool taskForced;     // 白天任务完成后强制入夜(区别于手动 N 预览)
        float mix;           // 0=白天 1=夜晚 (平滑插值)
        float elapsed;

        public bool IsNight => night;                 // 当前是否夜晚
        public bool ShouldEnterChase => autoSwitched || taskForced; // 是否应转入追逃(自动/任务触发, 手动 N 不算)
        public float Mix => mix;                      // 供 NightAtmosphere 平滑驱动
        public System.Action onNightEntered;          // 夜晚降临回调(自动/任务, 手动 N 不触发)

        // 白天基准 (Start 时捕获)
        Color dAmbientSky, dAmbientEquator, dAmbientGround, dFog, dSkyTint;
        float dFogDensity, dSunIntensity;
        Material skybox;

        // 夜晚目标
        static readonly Color nAmbientSky     = new Color(0.07f, 0.09f, 0.16f);
        static readonly Color nAmbientEquator = new Color(0.05f, 0.06f, 0.10f);
        static readonly Color nAmbientGround  = new Color(0.03f, 0.03f, 0.05f);
        static readonly Color nFog            = new Color(0.04f, 0.05f, 0.10f);
        static readonly Color nSkyTint        = new Color(0.06f, 0.08f, 0.16f);
        const float nFogDensity   = 0.006f;
        const float nSunIntensity = 0.08f;
        const float nMoonIntensity = 0.55f;

        void Start()
        {
            dAmbientSky     = RenderSettings.ambientSkyColor;
            dAmbientEquator = RenderSettings.ambientEquatorColor;
            dAmbientGround  = RenderSettings.ambientGroundColor;
            dFog            = RenderSettings.fogColor;
            dFogDensity     = RenderSettings.fogDensity;
            skybox          = RenderSettings.skybox;
            if (skybox && skybox.HasProperty("_SkyTint")) dSkyTint = skybox.GetColor("_SkyTint");
            if (sun) { dSunIntensity = sun.intensity; }
            if (moon) moon.intensity = 0f;
            if (nightGroup) nightGroup.SetActive(false);
        }

        void Update()
        {
            elapsed += Time.deltaTime;
            bool wasNight = night;
            if (!autoSwitched && elapsed >= autoSwitchSeconds) { night = true; autoSwitched = true; }
            if (Input.GetKeyDown(KeyCode.N)) night = !night;

            if (!wasNight && night && (autoSwitched || taskForced))
                onNightEntered?.Invoke();

            float target = night ? 1f : 0f;
            mix = Mathf.MoveTowards(mix, target, Time.deltaTime / transitionSeconds);
            Apply(mix);
        }

        // 白天任务完成 → 提前入夜 (区别于手动 N 预览)
        public void ForceNight() { if (!night) night = true; taskForced = true; }

        void Apply(float m)
        {
            RenderSettings.ambientSkyColor     = Color.Lerp(dAmbientSky, nAmbientSky, m);
            RenderSettings.ambientEquatorColor = Color.Lerp(dAmbientEquator, nAmbientEquator, m);
            RenderSettings.ambientGroundColor  = Color.Lerp(dAmbientGround, nAmbientGround, m);
            RenderSettings.fogColor            = Color.Lerp(dFog, nFog, m);
            RenderSettings.fogDensity          = Mathf.Lerp(dFogDensity, nFogDensity, m);
            if (skybox && skybox.HasProperty("_SkyTint"))
                skybox.SetColor("_SkyTint", Color.Lerp(dSkyTint, nSkyTint, m));
            if (sun) sun.intensity = Mathf.Lerp(dSunIntensity, nSunIntensity, m);
            if (moon) moon.intensity = Mathf.Lerp(0f, nMoonIntensity, m);
            if (nightGroup) nightGroup.SetActive(m > 0.5f);
        }
    }
}
