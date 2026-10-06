// ============================================================
// TruthData.cs — 真相盘静态数据表 (镜像服务端 truth-data.js)
// 神池(8)/契约池(6)/阵营与子角色标签 + emoji 剥离。
// 中文: 依赖 ChineseFont SDF fallback。
// ============================================================

using System.Collections.Generic;
using System.Text.RegularExpressions;

public static class TruthData
{
    public class God { public string id; public string name; public string icon; }

    public static readonly God[] GODS = new God[]
    {
        new God { id = "harvest",  name = "丰收之神", icon = "🌾" },
        new God { id = "war",      name = "战争之神", icon = "⚔️" },
        new God { id = "oblivion", name = "遗忘之神", icon = "🌫️" },
        new God { id = "weaver",   name = "纺织之神", icon = "🧵" },
        new God { id = "tide",     name = "潮汐之神", icon = "🌊" },
        new God { id = "liar",     name = "谎言之神", icon = "🎭" },
        new God { id = "silence",  name = "静默之神", icon = "🔇" },
        new God { id = "ash",      name = "灰烬之神", icon = "💀" },
    };

    static readonly Dictionary<string, string> CONTRACT_NAMES = new Dictionary<string, string>
    {
        ["survivor"] = "存活者", ["purifier"] = "净化者", ["oracle"] = "真知者",
        ["guardian"] = "守护者", ["sacrificer"] = "献祭者", ["fatebreaker"] = "逆命者",
    };

    public static God GodById(string id)
    {
        if (string.IsNullOrEmpty(id)) return null;
        for (int i = 0; i < GODS.Length; i++) if (GODS[i].id == id) return GODS[i];
        return null;
    }

    public static string GodName(string id) => GodById(id)?.name ?? (id ?? "?");

    public static string TeamLabel(string team)
        => team == "corrupted" ? "食神者方" : team == "spirit" ? "灵焰方" : (team ?? "?");

    // role 已是中文 (灵焰/生存/守幕者/食神者)
    public static string RoleLabel(string role) => string.IsNullOrEmpty(role) ? "灵焰方" : role;

    public static string ContractName(string id)
        => id != null && CONTRACT_NAMES.TryGetValue(id, out var n) ? n : (id ?? "?");

    public static string PhaseLabel(int phase)
    {
        switch (phase) { case 2: return "诸神残响"; case 3: return "屠宰场"; default: return "入幕"; }
    }

    // 剥离 emoji/变体选择符/零宽连接符 (TMP 中文字体缺这些字形会显示豆腐块)
    static readonly Regex EMOJI = new Regex(@"[\uD800-\uDBFF][\uDC00-\uDFFF]|[☀-➿]|[️]|[‍]", RegexOptions.Compiled);
    public static string StripEmoji(string s) => string.IsNullOrEmpty(s) ? s : EMOJI.Replace(s, "").Trim();
}
