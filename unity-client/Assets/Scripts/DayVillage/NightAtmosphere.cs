using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace VeilLand.DayVillage
{
    // 夜晚氛围深化: 星空粒子 + 萤火虫 + 额外灯笼 + Bloom 泛光
    // 全部由 DayNightCycle.Mix 平滑驱动, 入夜渐显/白天渐隐
    public class NightAtmosphere : MonoBehaviour
    {
        public DayNightCycle cycle;

        ParticleSystem stars, fireflies;
        Volume bloomVolume;
        Light[] extraLanterns;

        void Start()
        {
            if (cycle == null) cycle = FindFirstObjectByType<DayNightCycle>();
            BuildStars();
            BuildFireflies();
            BuildExtraLanterns();
            BuildBloom();
        }

        void Update()
        {
            float m = cycle != null ? cycle.Mix : 0f;
            if (bloomVolume != null) bloomVolume.weight = m;
            SetParticles(stars, m > 0.5f);
            SetParticles(fireflies, m > 0.5f);
            if (extraLanterns != null)
                foreach (var l in extraLanterns) l.enabled = m > 0.5f;
        }

        void SetParticles(ParticleSystem ps, bool on)
        {
            if (ps == null) return;
            if (on && !ps.isPlaying) ps.Play();
            else if (!on && ps.isPlaying) ps.Stop(true, ParticleSystemStopBehavior.StopEmitting);
        }

        // 星空: 高悬穹顶上的静止光点 (发射一次, 常驻)
        void BuildStars()
        {
            var go = new GameObject("NightStars");
            go.transform.position = new Vector3(0, 220, 0);
            stars = go.AddComponent<ParticleSystem>();
            var main = stars.main;
            main.loop = false;
            main.playOnAwake = false;
            main.startLifetime = 100000f;
            main.startSpeed = 0f;
            main.startSize = new ParticleSystem.MinMaxCurve(0.08f, 0.2f);
            main.startColor = new Color(0.9f, 0.95f, 1f, 0.9f);
            main.maxParticles = 400;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var shape = stars.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(900, 60, 900);
            var emission = stars.emission;
            emission.rateOverTime = 0f;
            stars.Emit(320);
        }

        // 萤火虫: 聚落上空漂浮的暖色小光点
        void BuildFireflies()
        {
            var go = new GameObject("NightFireflies");
            go.transform.position = new Vector3(0, 6, 0);
            fireflies = go.AddComponent<ParticleSystem>();
            var main = fireflies.main;
            main.loop = true;
            main.playOnAwake = false;
            main.startLifetime = 5f;
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.1f, 0.5f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.06f, 0.16f);
            main.startColor = new Color(1f, 0.85f, 0.4f, 0.95f);
            main.maxParticles = 120;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var shape = fireflies.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(120, 12, 120);
            var emission = fireflies.emission;
            emission.rateOverTime = 25f;
            var velocity = fireflies.velocityOverLifetime;
            velocity.enabled = true;
            velocity.space = ParticleSystemSimulationSpace.World;
            velocity.x = new ParticleSystem.MinMaxCurve(-0.4f, 0.4f);
            velocity.y = new ParticleSystem.MinMaxCurve(0f, 0.3f);
            velocity.z = new ParticleSystem.MinMaxCurve(-0.4f, 0.4f);
        }

        // 额外灯笼: 夜晚多几盏暖色点光源 (builder 里已有 6 盏)
        void BuildExtraLanterns()
        {
            var spots = new Vector3[]
            {
                new Vector3(28, 0, 18), new Vector3(-42, 0, 30), new Vector3(10, 0, -40),
            };
            extraLanterns = new Light[spots.Length];
            for (int i = 0; i < spots.Length; i++)
            {
                var pos = spots[i];
                if (Physics.Raycast(pos + Vector3.up * 80, Vector3.down, out var h, 150)) pos.y = h.point.y + 0.01f;
                var go = new GameObject("ExtraNightLantern_" + i);
                go.transform.position = pos + Vector3.up * 2.4f;
                var l = go.AddComponent<Light>();
                l.type = LightType.Point;
                l.range = 14;
                l.intensity = 1.3f;
                l.color = new Color(1f, 0.5f, 0.22f);
                l.enabled = false;
                extraLanterns[i] = l;
            }
        }

        // Bloom 泛光: URP Volume (夜间权重渐入, 柔化灯笼/灵焰/萤火虫)
        void BuildBloom()
        {
            var go = new GameObject("NightBloom");
            bloomVolume = go.AddComponent<Volume>();
            bloomVolume.isGlobal = true;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            var bloom = profile.Add<Bloom>();
            bloom.intensity.Override(1.1f);
            bloom.threshold.Override(0.85f);
            bloom.scatter.Override(0.6f);
            bloomVolume.profile = profile;
            bloomVolume.weight = 0f;
        }
    }
}
