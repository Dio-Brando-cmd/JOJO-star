// ============================================================
// RebakeScenes.cs — GLB 更新后一键重烘焙全部场景 (batch 用)
// 依次: ExplorationScene → ValleyScene → ChaseScene
// 命令行: -executeMethod RebakeScenes.Create
// ============================================================

using UnityEngine;
using UnityEditor;

public class RebakeScenes
{
    [MenuItem("Tools/Rebake All Scenes")]
    public static void Create()
    {
        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  开始重烘焙三个场景 (GLB 已更新)...");
        Debug.Log("═══════════════════════════════════════");

        ExplorationSceneCreator.Create();
        ValleySceneCreator.Create();
        ChaseSceneCreator.Create();

        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  ✅ 全部场景重烘焙完成");
        Debug.Log("═══════════════════════════════════════");
    }
}
