// ============================================================
// SetupChineseFont.cs — 创建中文 TMP 字体 (SimHei 黑体, 动态图集 + 编辑器预烘焙)
// 扫描 Assets/Scripts 下所有 .cs, 收集全部非 ASCII 字符 + ASCII,
// 生成 ChineseFont SDF (SDFAA, 2048 atlas), 并在编辑器阶段一次性预烘焙全部字形,
// 注册为默认字体的 fallback, 使所有 TMPro 文本直接支持中文。
//
// 为什么预烘焙而非运行时动态填充: 动态 CJK 字体若在 batchmode/reload 后
// m_AtlasTexture 字段为 null, 运行时图集填满触发多图集时 SetupNewAtlasTexture
// 报 NullReferenceException。在编辑器阶段把全部字形一次烘焙进 2048 atlas,
// 运行时不再触发动态填充, 彻底规避。TryAddCharacters 只对 Dynamic 模式生效,
// 故本字体保持 Dynamic 模式 + 编辑期预烘焙 (Static 模式会被 TryAddCharacters 拒绝)。
//
// 用法: Tools → VeilLand → Setup Chinese Font
// 命令行: -executeMethod SetupChineseFont.Setup
// ============================================================

using UnityEngine;
using UnityEngine.TextCore.LowLevel;
using UnityEditor;
using System.IO;
using System.Text;
using System.Collections.Generic;
using TMPro;

public class SetupChineseFont
{
    const string SOURCE_FONT = "Assets/Fonts/simhei.ttf";
    const string OUTPUT_ASSET = "Assets/Fonts/ChineseFont SDF.asset";

    [MenuItem("Tools/VeilLand/Setup Chinese Font")]
    public static void Setup()
    {
        // 1. 确保源字体存在
        string sourceFontAbs = Path.Combine(Application.dataPath, "Fonts/simhei.ttf");
        if (!File.Exists(sourceFontAbs))
        {
            Debug.LogError($"[Font] ❌ 找不到 {SOURCE_FONT}，请先把黑体 simhei.ttf 复制进 Assets/Fonts/");
            return;
        }

        // 2. 导入并加载为 Unity Font (含字体数据)
        AssetDatabase.ImportAsset(SOURCE_FONT);
        var importer = AssetImporter.GetAtPath(SOURCE_FONT) as TrueTypeFontImporter;
        if (importer != null)
        {
            importer.includeFontData = true;   // 关键: 打包时携带字形数据
            importer.SaveAndReimport();
        }

        var sourceFont = AssetDatabase.LoadAssetAtPath<Font>(SOURCE_FONT);
        if (sourceFont == null)
        {
            Debug.LogError("[Font] ❌ 加载 simhei.ttf 失败");
            return;
        }

        // 3. 生成**动态** TMP 字体 (SDFAA, 2048 atlas) —— TryAddCharacters 只对动态模式生效
        //    关键: 在编辑器阶段一次性预烘焙全部字形, 运行时无需动态填充 → 规避 SetupNewAtlasTexture NRE
        var fontAsset = TMP_FontAsset.CreateFontAsset(
            sourceFont, 40, 9, GlyphRenderMode.SDFAA, 2048, 2048,
            AtlasPopulationMode.Dynamic, true);
        if (fontAsset == null)
        {
            Debug.LogError("[Font] ❌ 创建 TMP 字体资产失败 (FontEngine 加载字形失败)");
            return;
        }
        fontAsset.name = "ChineseFont SDF";

        // 触发 atlasTexture getter, 初始化 m_AtlasTexture 字段 (多图集命名安全网, 规避 NRE)
        _ = fontAsset.atlasTexture;

        // 4. 收集字符集并预烘焙 (动态模式, 缺字会被跳过, 不报错)
        string chars = CollectCharacters();
        string missing;
        bool all = fontAsset.TryAddCharacters(chars, out missing);
        Debug.Log($"[Font] 烘焙 {chars.Length} 字符 " + (all ? "全部成功" : $"缺失 {missing.Length}: {missing}"));

        // 5. 保存: 主资产 + 图集贴图 + 材质 作为子资产
        AssetDatabase.DeleteAsset(OUTPUT_ASSET);
        AssetDatabase.CreateAsset(fontAsset, OUTPUT_ASSET);
        for (int i = 0; i < fontAsset.atlasTextures.Length; i++)
        {
            var tex = fontAsset.atlasTextures[i];
            if (tex == null) continue;
            tex.name = "ChineseFont Atlas " + i;
            if (!AssetDatabase.IsSubAsset(tex))
                AssetDatabase.AddObjectToAsset(tex, fontAsset);
        }
        if (fontAsset.material != null)
        {
            fontAsset.material.name = "ChineseFont Atlas Material";
            if (!AssetDatabase.IsSubAsset(fontAsset.material))
                AssetDatabase.AddObjectToAsset(fontAsset.material, fontAsset);
        }
        EditorUtility.SetDirty(fontAsset);

        // 6. 注册为默认 TMP 字体的 fallback (全局中文支持)
        RegisterFallback(fontAsset);

        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        Debug.Log("═══════════════════════════════════════");
        Debug.Log($"  ✅ 中文字体已就绪: {OUTPUT_ASSET}");
        Debug.Log($"  📝 图集 {fontAsset.atlasWidth}×{fontAsset.atlasHeight} × {fontAsset.atlasTextures.Length}, 字形 {fontAsset.characterTable.Count}");
        Debug.Log("═══════════════════════════════════════");
    }

    // 扫描 Assets/Scripts 全部 .cs, 收集 ASCII + 非 ASCII 字符 (剔除控制符/emoji 代理对/变体选择符/ZWJ)
    static string CollectCharacters()
    {
        var set = new HashSet<char>();
        for (char c = ' '; c <= '~'; c++) set.Add(c);   // 基础 ASCII 可打印

        string scriptDir = Path.Combine(Application.dataPath, "Scripts");
        if (Directory.Exists(scriptDir))
        {
            foreach (var path in Directory.GetFiles(scriptDir, "*.cs", SearchOption.AllDirectories))
            {
                string text = File.ReadAllText(path, Encoding.UTF8);
                foreach (char c in text)
                {
                    if (c < 0x20) continue;                       // 控制符
                    if (c >= 0xD800 && c <= 0xDFFF) continue;     // 代理对(emoji)
                    if (c == 0xFE0F || c == 0x200D) continue;     // 变体选择符 / ZWJ
                    set.Add(c);
                }
            }
        }

        var sb = new StringBuilder(set.Count);
        foreach (char c in set) sb.Append(c);
        return sb.ToString();
    }

    static void RegisterFallback(TMP_FontAsset fontAsset)
    {
        var defaultAsset = TMP_Settings.defaultFontAsset;
        if (defaultAsset == null)
        {
            Debug.LogWarning("[Font] ⚠️ 未找到 TMP 默认字体，仅生成 ChineseFont SDF，请手动引用");
            return;
        }

        var so = new SerializedObject(defaultAsset);
        var fallbacks = so.FindProperty("m_FallbackFontAssetTable");
        if (fallbacks == null) return;

        // 清理悬挂/空引用 (旧字体被删后残留), 并去重
        for (int i = fallbacks.arraySize - 1; i >= 0; i--)
        {
            var el = fallbacks.GetArrayElementAtIndex(i);
            if (el.objectReferenceValue == null || el.objectReferenceValue == fontAsset)
                fallbacks.DeleteArrayElementAtIndex(i);
        }
        fallbacks.arraySize++;
        fallbacks.GetArrayElementAtIndex(fallbacks.arraySize - 1).objectReferenceValue = fontAsset;
        so.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(defaultAsset);
        Debug.Log($"[Font] ✅ 已将 ChineseFont SDF 设为 {defaultAsset.name} 的 fallback");
    }
}
