// ============================================================
// SetupKanbanAnimations.cs — 看板娘动画自动配置
// 在 Unity: Tools → VeilLand → Setup Kanban Animations
// 配置 FBX (Generic rig) + 生成 Animator Controller (Idle/Walk/Run 混合树)
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.Animations;
using System.Collections.Generic;

public static class SetupKanbanAnimations
{
    public const string FbxPath = "Assets/Models/Characters/KanbanPlayer_Animated.fbx";
    public const string JumpFbxPath = "Assets/Models/Characters/KanbanPlayer_Jump.fbx";
    public const string ControllerPath = "Assets/Resources/Animations/Kanban.controller";

    [MenuItem("Tools/VeilLand/Setup Kanban Animations", false, 101)]
    public static void Setup()
    {
        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  看板娘动画自动配置");
        Debug.Log("═══════════════════════════════════════");

        // 1. FBX Rig → Generic
        var importer = AssetImporter.GetAtPath(FbxPath) as ModelImporter;
        if (importer == null)
        {
            Debug.LogError("❌ 未找到 FBX: " + FbxPath);
            return;
        }
        importer.animationType = ModelImporterAnimationType.Generic;
        importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
        importer.SaveAndReimport();

        // 2. 动画 clip 设定 (loop)
        var clips = new List<ModelImporterClipAnimation>
        {
            AddClip("Idle", 0, 120, true),
            AddClip("Walk", 0, 32,  true),
            AddClip("Run",  0, 24,  true),
        };
        importer.clipAnimations = clips.ToArray();
        importer.SaveAndReimport();
        // 强制同步重导入, 否则 LoadAllAssetsAtPath 可能读到旧 take 名
        AssetDatabase.ImportAsset(FbxPath, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
        Debug.Log("✅ 3 个动画 clip 已配置 (Generic rig)");

        // 3. Animator Controller
        var controller = AnimatorController.CreateAnimatorControllerAtPath(ControllerPath);
        controller.AddParameter("Speed", AnimatorControllerParameterType.Float);

        // 4. 收集 clip 引用
        var clipDict = new Dictionary<string, AnimationClip>();
        foreach (var asset in AssetDatabase.LoadAllAssetsAtPath(FbxPath))
        {
            if (asset is AnimationClip clip)
            {
                clipDict[clip.name] = clip;
                string n = clip.name;
                if (n.StartsWith("__preview__")) n = n.Substring("__preview__".Length);
                if (n.EndsWith("__preview__")) n = n.Substring(0, n.Length - "__preview__".Length);
                clipDict[n] = clip;
            }
        }
        Debug.Log($"   找到 {clipDict.Count} 个 clip: {string.Join(", ", clipDict.Keys)}");

        // 5. 状态机: Locomotion 混合树 (Speed: 0 Idle / 3 Walk / 6 Run)
        var sm = controller.layers[0].stateMachine;
        var loco = sm.AddState("Locomotion", new Vector2(300, 120));
        var bt = new BlendTree
        {
            name = "Locomotion",
            blendParameter = "Speed",
            blendType = BlendTreeType.Simple1D,
            useAutomaticThresholds = false,
        };
        AddMotion(bt, "Idle", clipDict, 0f);
        AddMotion(bt, "Walk", clipDict, 3f);
        AddMotion(bt, "Run",  clipDict, 6f);
        loco.motion = bt;
        // 关键: 把 BlendTree 挂为 controller 子资产, 否则保存后被丢弃
        AssetDatabase.AddObjectToAsset(bt, controller);
        sm.defaultState = loco;

        // 6. 跳跃动画 (独立 Jump FBX, 若存在则加 Jump 状态; 不存在则优雅跳过)
        TryAddJumpState(sm, loco, controller);

        EditorUtility.SetDirty(controller);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  🎉 看板娘动画配置完毕!");
        Debug.Log($"  Controller: {ControllerPath}");
        Debug.Log("  参数 Speed (Float): 0=Idle / 3=Walk / 6=Run");
        Debug.Log("═══════════════════════════════════════");
    }

    static ModelImporterClipAnimation AddClip(string name, int first, int last, bool loop)
    {
        return new ModelImporterClipAnimation
        {
            name = name,
            takeName = name,   // 显式映射到 FBX 同名 take
            firstFrame = first,
            lastFrame = last,
            loopTime = loop,
            loop = loop,
            wrapMode = loop ? WrapMode.Loop : WrapMode.Default,
        };
    }

    static void AddMotion(BlendTree tree, string clipName,
                          Dictionary<string, AnimationClip> dict, float threshold)
    {
        if (dict.TryGetValue(clipName, out var clip))
            tree.AddChild(clip, threshold);
    }

    // 跳跃: 从独立 Jump FBX 加载 clip, 加 Trigger 参数 + Jump 状态 (任意状态可跳 → 播放完回 Locomotion)
    static void TryAddJumpState(AnimatorStateMachine sm, AnimatorState loco, AnimatorController controller)
    {
        var jumpImporter = AssetImporter.GetAtPath(JumpFbxPath) as ModelImporter;
        if (jumpImporter != null)
        {
            jumpImporter.animationType = ModelImporterAnimationType.Generic;
            jumpImporter.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
            jumpImporter.clipAnimations = new[] { AddClip("Jump", 0, 30, false) };
            jumpImporter.SaveAndReimport();
            AssetDatabase.ImportAsset(JumpFbxPath, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
        }

        AnimationClip jumpClip = null;
        foreach (var asset in AssetDatabase.LoadAllAssetsAtPath(JumpFbxPath))
        {
            if (asset is AnimationClip c && c.name.Contains("Jump")) { jumpClip = c; break; }
        }

        if (jumpClip == null)
        {
            Debug.Log("   (无独立 Jump FBX, 跳过跳跃动画状态)");
            return;
        }

        controller.AddParameter("Jump", AnimatorControllerParameterType.Trigger);
        var jumpState = sm.AddState("Jump", new Vector2(600, 120));
        jumpState.motion = jumpClip;
        var anyToJump = sm.AddAnyStateTransition(jumpState);
        anyToJump.AddCondition(AnimatorConditionMode.If, 0, "Jump");
        anyToJump.hasExitTime = false;
        anyToJump.canTransitionToSelf = false;
        anyToJump.duration = 0.1f;
        var jumpToLoco = jumpState.AddTransition(loco);
        jumpToLoco.hasExitTime = true;
        jumpToLoco.exitTime = 0.9f;
        jumpToLoco.duration = 0.2f;
        Debug.Log("   ✅ Jump 状态已加入 (Trigger: Jump)");
    }
}
