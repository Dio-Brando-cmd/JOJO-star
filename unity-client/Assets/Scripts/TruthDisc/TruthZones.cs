// ============================================================
// TruthZones.cs — 真相盘 6 区几何 (AABB + 锚点 + 任务锚点)
// 地图建造与客户端区域判定共用这一张表。
// 服务端 ZONES = [北垣,南垣,东垣,西垣,中庭,深殿] (consumeOrder 随机)。
// ============================================================

using UnityEngine;

public static class TruthZones
{
    public class Region { public string name; public float minX, maxX, minZ, maxZ; public Vector3 anchor; }

    // 深殿嵌套于中庭内, 必须排在最前优先判定 (其余区 AABB 两两不相交)
    public static readonly Region[] REGIONS = new Region[]
    {
        new Region { name = "深殿", minX = -12, maxX = 12,   minZ = -12, maxZ = 12,   anchor = new Vector3(0, 0, 0) },
        new Region { name = "北垣", minX = -70, maxX = 70,   minZ = 30,  maxZ = 70,   anchor = new Vector3(0, 0, 50) },
        new Region { name = "南垣", minX = -70, maxX = 70,   minZ = -70, maxZ = -30,  anchor = new Vector3(0, 0, -50) },
        new Region { name = "东垣", minX = 30,  maxX = 70,   minZ = -30, maxZ = 30,   anchor = new Vector3(50, 0, 0) },
        new Region { name = "西垣", minX = -70, maxX = -30,  minZ = -30, maxZ = 30,   anchor = new Vector3(-50, 0, 0) },
        new Region { name = "中庭", minX = -30, maxX = 30,   minZ = -30, maxZ = 30,   anchor = new Vector3(0, 0, -20) },
    };

    public static string ZoneForPosition(Vector3 pos)
    {
        for (int i = 0; i < REGIONS.Length; i++)
        {
            var r = REGIONS[i];
            if (pos.x >= r.minX && pos.x <= r.maxX && pos.z >= r.minZ && pos.z <= r.maxZ)
                return r.name;
        }
        return null;
    }

    public static Region RegionOf(string zone)
    {
        if (string.IsNullOrEmpty(zone)) return null;
        for (int i = 0; i < REGIONS.Length; i++) if (REGIONS[i].name == zone) return REGIONS[i];
        return null;
    }

    public static Vector3 ZoneAnchor(string zone) => RegionOf(zone)?.anchor ?? Vector3.zero;

    public static int ZoneIndex(string zone)
    {
        for (int i = 0; i < REGIONS.Length; i++) if (REGIONS[i].name == zone) return i;
        return REGIONS.Length - 1; // 默认中庭
    }

    // ---- 任务锚点 (按 name 键定位; 服务端每局把 name 洗成 T1..T8, 动作带 id) ----
    public class TaskAnchor { public string name; public Vector3 pos; public string zone; }

    public static readonly TaskAnchor[] TASKS = new TaskAnchor[]
    {
        new TaskAnchor { name = "灵焰灯台", pos = new Vector3(0, 0, -20),   zone = "中庭" },
        new TaskAnchor { name = "帷幕碑文", pos = new Vector3(-50, 0, 0),   zone = "西垣" },
        new TaskAnchor { name = "记忆井",   pos = new Vector3(0, 0, 50),    zone = "北垣" },
        new TaskAnchor { name = "献祭灶台", pos = new Vector3(50, 0, 0),    zone = "东垣" },
        new TaskAnchor { name = "丝线纺车", pos = new Vector3(0, 0, -50),   zone = "南垣" },
        new TaskAnchor { name = "退潮闸门", pos = new Vector3(-40, 0, 50),  zone = "北垣" },
        new TaskAnchor { name = "灰烬火盆", pos = new Vector3(20, 0, 10),   zone = "中庭" },
        new TaskAnchor { name = "静默钟",   pos = new Vector3(50, 0, 40),   zone = "东垣" },
    };

    public static TaskAnchor TaskAnchorOf(string taskName)
    {
        if (string.IsNullOrEmpty(taskName)) return null;
        for (int i = 0; i < TASKS.Length; i++) if (TASKS[i].name == taskName) return TASKS[i];
        return null;
    }
}
