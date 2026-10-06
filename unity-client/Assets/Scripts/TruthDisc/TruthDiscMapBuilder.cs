// ============================================================
// TruthDiscMapBuilder.cs — 程序化搭建「帷幕之域」地图 (140×140 平地)
// 地面 / 垣墙 / 深殿 + 6 区半透明着色 + 8 任务标记 + 净化点光柱。
// 由 TruthDiscGameManager 在 Start 时 Build(), 状态更新时 SetConsumedZones/SetPurifyZone。
// ============================================================

using UnityEngine;
using System.Collections.Generic;
using TMPro;

public class TruthDiscMapBuilder : MonoBehaviour
{
    Shader _shader;
    GameObject _purifyPillar;
    GameObject _purifyLabel;
    readonly Dictionary<string, GameObject> _zoneOverlayByName = new Dictionary<string, GameObject>();

    static readonly Color C_GROUND = new Color(0.10f, 0.09f, 0.14f);
    static readonly Color C_WALL   = new Color(0.16f, 0.15f, 0.22f);
    static readonly Color C_ROOF   = new Color(0.12f, 0.11f, 0.18f);
    static readonly Color C_PURIFY = new Color(1f, 0.85f, 0.3f);
    static readonly Color C_TASK   = new Color(0.4f, 0.85f, 0.9f);

    void EnsureShader()
    {
        if (_shader == null) _shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
    }

    public void Build()
    {
        EnsureShader();
        Cleanup();

        // 地面 140×140
        Box("Ground", new Vector3(0, -0.1f, 0), new Vector3(140f, 0.2f, 140f), C_GROUND, true);

        // 外垣墙 (x=±70, z=±70, 高 4)
        Box("Wall_N", new Vector3(0, 2f, 70f), new Vector3(140f, 4f, 0.4f), C_WALL, true);
        Box("Wall_S", new Vector3(0, 2f, -70f), new Vector3(140f, 4f, 0.4f), C_WALL, true);
        Box("Wall_E", new Vector3(70f, 2f, 0), new Vector3(0.4f, 4f, 140f), C_WALL, true);
        Box("Wall_W", new Vector3(-70f, 2f, 0), new Vector3(0.4f, 4f, 140f), C_WALL, true);

        // 内院墙 (x=±30, z=±30, 高 3, 各分两段留 6m 门洞)
        Box("Courtyard_N_L", new Vector3(-18f, 1.5f, 30f), new Vector3(24f, 3f, 0.4f), C_WALL, true);
        Box("Courtyard_N_R", new Vector3(18f, 1.5f, 30f), new Vector3(24f, 3f, 0.4f), C_WALL, true);
        Box("Courtyard_S_L", new Vector3(-18f, 1.5f, -30f), new Vector3(24f, 3f, 0.4f), C_WALL, true);
        Box("Courtyard_S_R", new Vector3(18f, 1.5f, -30f), new Vector3(24f, 3f, 0.4f), C_WALL, true);
        Box("Courtyard_E_L", new Vector3(30f, 1.5f, -18f), new Vector3(0.4f, 3f, 24f), C_WALL, true);
        Box("Courtyard_E_R", new Vector3(30f, 1.5f, 18f), new Vector3(0.4f, 3f, 24f), C_WALL, true);
        Box("Courtyard_W_L", new Vector3(-30f, 1.5f, -18f), new Vector3(0.4f, 3f, 24f), C_WALL, true);
        Box("Courtyard_W_R", new Vector3(-30f, 1.5f, 18f), new Vector3(0.4f, 3f, 24f), C_WALL, true);

        // 深殿 (x=±12, z=12 北实墙, z=-12 南 4m 门, 高 5 + 屋顶)
        Box("Deep_W", new Vector3(-12f, 2.5f, 0), new Vector3(0.4f, 5f, 24f), C_WALL, true);
        Box("Deep_E", new Vector3(12f, 2.5f, 0), new Vector3(0.4f, 5f, 24f), C_WALL, true);
        Box("Deep_N", new Vector3(0, 2.5f, 12f), new Vector3(24f, 5f, 0.4f), C_WALL, true);
        Box("Deep_S_L", new Vector3(-8f, 2.5f, -12f), new Vector3(8f, 5f, 0.4f), C_WALL, true);
        Box("Deep_S_R", new Vector3(8f, 2.5f, -12f), new Vector3(8f, 5f, 0.4f), C_WALL, true);
        Box("Deep_Roof", new Vector3(0, 5.2f, 0), new Vector3(24.4f, 0.4f, 24.4f), C_ROOF, true);

        // 6 区半透明着色叠加 (地面 +0.02 轻微抬高避免 z-fight)
        for (int i = 0; i < TruthZones.REGIONS.Length; i++)
        {
            var region = TruthZones.REGIONS[i];
            Color c = ZoneColor(i);
            Vector3 center = new Vector3((region.minX + region.maxX) / 2f, 0.02f, (region.minZ + region.maxZ) / 2f);
            Vector3 size = new Vector3(region.maxX - region.minX, 0.04f, region.maxZ - region.minZ);
            var overlay = Box("Zone_" + region.name, center, size, c, false);
            _zoneOverlayByName[region.name] = overlay;
        }

        // 8 任务标记 (emissive 柱 + 世界空间名牌)
        foreach (var t in TruthZones.TASKS)
        {
            Pillar("Task_" + t.name, new Vector3(t.pos.x, 1.2f, t.pos.z), C_TASK);
            WorldLabel("TaskLabel_" + t.name, t.name, new Vector3(t.pos.x, 2.8f, t.pos.z), new Color(0.7f, 0.95f, 1f));
        }

        // 净化点光柱 (初始隐藏, 随 purifyPoint.zone 移动; null 时隐藏)
        _purifyPillar = Pillar("PurifyPillar", new Vector3(0, 2.5f, 0), C_PURIFY);
        _purifyPillar.SetActive(false);
        _purifyLabel = WorldLabel("PurifyLabel", "净化点", new Vector3(0, 5.2f, 0), C_PURIFY);
        _purifyLabel.SetActive(false);
    }

    // 状态更新: 吞掉区染红
    public void SetConsumedZones(TruthZoneDTO[] zones)
    {
        if (zones == null) return;
        foreach (var z in zones)
        {
            if (z == null || !_zoneOverlayByName.TryGetValue(z.name, out var overlay) || overlay == null) continue;
            var r = overlay.GetComponent<Renderer>();
            if (r == null) continue;
            Color c = z.consumed ? new Color(0.55f, 0.05f, 0.05f, 0.45f) : ZoneColor(TruthZones.ZoneIndex(z.name));
            var mat = r.sharedMaterial;
            mat.color = c;
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c);
        }
    }

    // 净化点移动/隐藏
    public void SetPurifyZone(string zone)
    {
        if (_purifyPillar == null || _purifyLabel == null) return;
        if (string.IsNullOrEmpty(zone))
        {
            _purifyPillar.SetActive(false);
            _purifyLabel.SetActive(false);
            return;
        }
        var anchor = TruthZones.ZoneAnchor(zone);
        _purifyPillar.SetActive(true);
        _purifyPillar.transform.localPosition = new Vector3(anchor.x, 2.5f, anchor.z);
        _purifyLabel.SetActive(true);
        _purifyLabel.transform.localPosition = new Vector3(anchor.x, 5.2f, anchor.z);
    }

    Color ZoneColor(int idx)
    {
        Color[] palette =
        {
            new Color(0.30f, 0.22f, 0.10f, 0.35f), // 深殿 暗金
            new Color(0.10f, 0.20f, 0.34f, 0.28f), // 北垣 冷蓝
            new Color(0.12f, 0.28f, 0.20f, 0.28f), // 南垣 暗绿
            new Color(0.30f, 0.16f, 0.12f, 0.28f), // 东垣 暗红
            new Color(0.22f, 0.16f, 0.30f, 0.28f), // 西垣 暗紫
            new Color(0.20f, 0.20f, 0.26f, 0.30f), // 中庭 中性
        };
        return palette[idx % palette.Length];
    }

    // ==================== 构建辅助 ====================

    GameObject Box(string name, Vector3 center, Vector3 size, Color color, bool collider)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = name;
        go.transform.SetParent(transform, false);
        go.transform.localPosition = center;
        go.transform.localScale = size;
        if (!collider) RemoveCollider(go);
        ApplyMaterial(go.GetComponent<Renderer>(), color, false);
        return go;
    }

    GameObject Pillar(string name, Vector3 pos, Color color)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        go.name = name;
        go.transform.SetParent(transform, false);
        go.transform.localPosition = pos;
        go.transform.localScale = new Vector3(0.8f, 2f, 0.8f);
        RemoveCollider(go);
        ApplyMaterial(go.GetComponent<Renderer>(), color, true);
        return go;
    }

    // 编辑模式(场景预览)用 DestroyImmediate, 运行时用 Destroy
    void RemoveCollider(GameObject go)
    {
        var c = go.GetComponent<Collider>();
        if (c == null) return;
        if (Application.isPlaying) Destroy(c);
        else DestroyImmediate(c);
    }

    void ApplyMaterial(Renderer r, Color color, bool emissive)
    {
        if (r == null) return;
        var mat = new Material(_shader);
        mat.color = color;
        if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
        if (emissive && mat.HasProperty("_EmissionColor"))
        {
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", color * 2.5f);
        }
        r.sharedMaterial = mat;
    }

    GameObject WorldLabel(string name, string text, Vector3 pos, Color color)
    {
        var go = new GameObject(name);
        go.transform.SetParent(transform, false);
        go.transform.localPosition = pos;
        var tmp = go.AddComponent<TextMeshPro>();
        tmp.text = text;
        tmp.fontSize = 4f;
        tmp.color = color;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.font = TMP_Settings.defaultFontAsset;
        return go;
    }

    void Cleanup()
    {
        for (int i = transform.childCount - 1; i >= 0; i--)
            DestroyImmediate(transform.GetChild(i).gameObject);
        _zoneOverlayByName.Clear();
        _purifyPillar = null;
        _purifyLabel = null;
    }
}
