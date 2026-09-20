// ============================================================
// BuildWindows.cs — 一键构建 Windows 独立版 (3D 大厅 + 探索 + 追猎)
// 用法: Unity.exe -batchmode -quit -projectPath <proj> -executeMethod BuildWindows.Build -logFile -
// ============================================================

using UnityEngine;
using UnityEditor;
using System.Linq;
using UnityEditor.Build.Reporting;

public class BuildWindows
{
    const string OUTPUT_DIR = "E:/veiland/werewolf-online/unity-build/VeilLand3D";

    [MenuItem("Tools/Build Windows 3D")]
    public static void Build()
    {
        var scenes = EditorBuildSettings.scenes
            .Where(s => s.enabled)
            .Select(s => s.path)
            .ToArray();

        if (scenes.Length == 0)
        {
            scenes = new[]
            {
                "Assets/Scenes/ValleyScene.unity",
                "Assets/Scenes/ExplorationScene.unity",
                "Assets/Scenes/ChaseScene.unity",
            };
        }

        Debug.Log($"[Build] 🚀 构建 Windows 独立版 ({scenes.Length} 个场景) → {OUTPUT_DIR}");

        var options = new BuildPlayerOptions
        {
            scenes = scenes,
            locationPathName = OUTPUT_DIR + "/VeilLand3D.exe",
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None,
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);

        if (report.summary.result == BuildResult.Succeeded)
        {
            Debug.Log($"[Build] ✅ 构建成功 → {OUTPUT_DIR} (总大小 {report.summary.totalSize} bytes, 耗时 {report.summary.totalTime.TotalSeconds:F1}s)");
        }
        else
        {
            Debug.LogError($"[Build] ❌ 构建失败: {report.summary.result} — {report.summary.totalErrors} 个错误");
        }
    }
}
