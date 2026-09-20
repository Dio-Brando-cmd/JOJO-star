// ============================================================
// SetupFreyjaAnimations.cs — 自动配置芙蕾雅动画
// 在 Unity 中: Tools → Veilland → Setup Freyja Animations
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.Animations;
using System.IO;
using System.Collections.Generic;

public class SetupFreyjaAnimations : EditorWindow
{
    [MenuItem("Tools/Veilland/Setup Freyja Animations", false, 100)]
    public static void Setup()
    {
        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  🌿 芙蕾雅动画自动配置");
        Debug.Log("═══════════════════════════════════════");

        // 1. 找 FBX
        string fbxPath = "Assets/Resources/Characters/Freyja_Animated.fbx";
        var fbxImporter = AssetImporter.GetAtPath(fbxPath) as ModelImporter;
        if (fbxImporter == null)
        {
            Debug.LogError($"❌ 未找到 FBX: {fbxPath}");
            return;
        }

        // 2. 配置 Rig 为 Generic (UniRig 非 Humanoid)
        fbxImporter.animationType = ModelImporterAnimationType.Generic;
        fbxImporter.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
        fbxImporter.SaveAndReimport();
        Debug.Log($"✅ Rig → Generic");

        // 3. 配置动画 clip 设定
        var clipAnimations = new List<ModelImporterClipAnimation>();

        // 循环动画
        AddClip(clipAnimations, "Idle",        0, 120, true);
        AddClip(clipAnimations, "Walk",        0, 32,  true);
        AddClip(clipAnimations, "Run",         0, 24,  true);
        AddClip(clipAnimations, "Crouch",      0, 120, true);
        AddClip(clipAnimations, "CrouchWalk",  0, 40,  true);

        // 一次性动画
        AddClip(clipAnimations, "ThrowPotion", 0, 45,  false);
        AddClip(clipAnimations, "UseCharm",    0, 60,  false);
        AddClip(clipAnimations, "GatherPlant", 0, 50,  false);
        AddClip(clipAnimations, "HitReaction", 0, 30,  false);
        AddClip(clipAnimations, "Death",       0, 90,  false);

        fbxImporter.clipAnimations = clipAnimations.ToArray();
        fbxImporter.SaveAndReimport();
        // 强制同步重导入: 否则 LoadAllAssetsAtPath 可能读到旧的 take 名 (异步未完成)
        AssetDatabase.ImportAsset(fbxPath, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
        Debug.Log($"✅ 10 个动画 clip 已配置");

        // 4. 创建 Animator Controller
        string controllerPath = "Assets/Resources/Animations/Freyja.controller";
        var controller = AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
        Debug.Log($"✅ Animator Controller 已创建: {controllerPath}");

        // 5. 添加参数
        controller.AddParameter("Speed", AnimatorControllerParameterType.Float);
        controller.AddParameter("Grounded", AnimatorControllerParameterType.Bool);
        controller.AddParameter("Crouching", AnimatorControllerParameterType.Bool);
        controller.AddParameter("Throw", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("Charm", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("Gather", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("Hit", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("Dead", AnimatorControllerParameterType.Trigger);

        // 6. 获取动画 clip 引用
        var fbxAsset = AssetDatabase.LoadAssetAtPath<GameObject>(fbxPath);
        var allClips = AssetDatabase.LoadAllAssetsAtPath(fbxPath);
        var clipDict = new Dictionary<string, AnimationClip>();
        foreach (var asset in allClips)
        {
            if (asset is AnimationClip clip)
            {
                clipDict[clip.name] = clip;
                // 容错: Blender 导出可能给 take 名加 __preview__ 前缀/后缀
                string normalized = clip.name;
                if (normalized.StartsWith("__preview__")) normalized = normalized.Substring("__preview__".Length);
                if (normalized.EndsWith("__preview__")) normalized = normalized.Substring(0, normalized.Length - "__preview__".Length);
                clipDict[normalized] = clip;
            }
        }

        Debug.Log($"   找到 {clipDict.Count} 个 clip: {string.Join(", ", clipDict.Keys)}");

        // 7. 构建状态机
        var rootStateMachine = controller.layers[0].stateMachine;

        // —— Locomotion Blend Tree ——
        var locomotionState = rootStateMachine.AddState("Locomotion", new Vector2(300, 120));
        var locomotionBlend = new BlendTree();
        locomotionState.motion = locomotionBlend;
        locomotionBlend.name = "Locomotion";
        locomotionBlend.blendParameter = "Speed";
        locomotionBlend.blendType = BlendTreeType.Simple1D;
        locomotionBlend.useAutomaticThresholds = false;

        // Blend Tree 子状态
        AddBlendTreeMotion(locomotionBlend, "Idle",      clipDict, 0f);
        AddBlendTreeMotion(locomotionBlend, "Walk",      clipDict, 1.5f);
        AddBlendTreeMotion(locomotionBlend, "Run",       clipDict, 6f);

        // 关键: 把 BlendTree 挂为 controller 子资产, 否则保存后被丢弃 → Locomotion motion 为空
        AssetDatabase.AddObjectToAsset(locomotionBlend, controller);

        // —— 单独状态 ——
        var crouchState    = AddState(rootStateMachine, "Crouch",     clipDict, new Vector2(300, 300));
        var crouchWalkState= AddState(rootStateMachine, "CrouchWalk", clipDict, new Vector2(480, 300));
        var throwState     = AddState(rootStateMachine, "ThrowPotion",clipDict, new Vector2(600, 60));
        var charmState     = AddState(rootStateMachine, "UseCharm",   clipDict, new Vector2(600, 120));
        var gatherState    = AddState(rootStateMachine, "GatherPlant",clipDict, new Vector2(600, 180));
        var hitState       = AddState(rootStateMachine, "HitReaction",clipDict, new Vector2(180, 300));
        var deathState     = AddState(rootStateMachine, "Death",      clipDict, new Vector2(480, 60));

        // 设为默认状态
        rootStateMachine.defaultState = locomotionState;

        // —— 出口节点 ——
        rootStateMachine.AddState("Exit", new Vector2(720, 240));

        // 8. Crouch ↔ CrouchWalk
        var crouchToWalk = crouchState.AddTransition(crouchWalkState);
        crouchToWalk.AddCondition(AnimatorConditionMode.Greater, 0.1f, "Speed");
        crouchToWalk.hasExitTime = false;
        crouchToWalk.duration = 0.15f;

        var walkToCrouch = crouchWalkState.AddTransition(crouchState);
        walkToCrouch.AddCondition(AnimatorConditionMode.Less, 0.1f, "Speed");
        walkToCrouch.hasExitTime = false;
        walkToCrouch.duration = 0.15f;

        // Idle/Loco ↔ Crouch (via Crouching parameter)
        var toCrouch = locomotionState.AddTransition(crouchState);
        toCrouch.AddCondition(AnimatorConditionMode.If, 1f, "Crouching");
        toCrouch.hasExitTime = false;
        toCrouch.duration = 0.2f;

        // Crouch → Locomotion
        var fromCrouch = crouchState.AddTransition(locomotionState);
        fromCrouch.AddCondition(AnimatorConditionMode.IfNot, 1f, "Crouching");
        fromCrouch.hasExitTime = false;
        fromCrouch.duration = 0.2f;

        // CrouchWalk → Locomotion
        var fromCrouchWalk = crouchWalkState.AddTransition(locomotionState);
        fromCrouchWalk.AddCondition(AnimatorConditionMode.IfNot, 1f, "Crouching");
        fromCrouchWalk.hasExitTime = false;
        fromCrouchWalk.duration = 0.2f;

        // 9. Trigger 过渡 (Any State → 技能动画 → Exit/Locomotion)
        // ThrowPotion
        var throwTrigger = rootStateMachine.AddAnyStateTransition(throwState);
        throwTrigger.AddCondition(AnimatorConditionMode.If, 1f, "Throw");
        throwTrigger.hasExitTime = false;
        throwTrigger.duration = 0.1f;
        throwState.AddExitTransition().duration = 0f;

        // UseCharm
        var charmTrigger = rootStateMachine.AddAnyStateTransition(charmState);
        charmTrigger.AddCondition(AnimatorConditionMode.If, 1f, "Charm");
        charmTrigger.hasExitTime = false;
        charmTrigger.duration = 0.1f;
        charmState.AddExitTransition().duration = 0f;

        // GatherPlant
        var gatherTrigger = rootStateMachine.AddAnyStateTransition(gatherState);
        gatherTrigger.AddCondition(AnimatorConditionMode.If, 1f, "Gather");
        gatherTrigger.hasExitTime = false;
        gatherTrigger.duration = 0.1f;
        gatherState.AddExitTransition().duration = 0f;

        // HitReaction
        var hitTrigger = rootStateMachine.AddAnyStateTransition(hitState);
        hitTrigger.AddCondition(AnimatorConditionMode.If, 1f, "Hit");
        hitTrigger.hasExitTime = false;
        hitTrigger.duration = 0.05f;
        hitState.AddExitTransition().duration = 0f;

        // Death
        var deadTrigger = rootStateMachine.AddAnyStateTransition(deathState);
        deadTrigger.AddCondition(AnimatorConditionMode.If, 1f, "Dead");
        deadTrigger.hasExitTime = false;
        deadTrigger.duration = 0f;
        deathState.AddExitTransition().duration = 0f;

        EditorUtility.SetDirty(controller);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        Debug.Log("✅ 状态机已配置");
        Debug.Log("");
        Debug.Log("═══════════════════════════════════════");
        Debug.Log("  🎉 芙蕾雅动画配置完毕！");
        Debug.Log("═══════════════════════════════════════");
        Debug.Log("");
        Debug.Log("  Animator Parameters:");
        Debug.Log("    Speed      (Float)  — 移动速度");
        Debug.Log("    Grounded   (Bool)   — 是否着地");
        Debug.Log("    Crouching  (Bool)   — 蹲伏状态");
        Debug.Log("    Throw      (Trigger)— 投掷药剂");
        Debug.Log("    Charm      (Trigger)— 使用愈灵符");
        Debug.Log("    Gather     (Trigger)— 采集药草");
        Debug.Log("    Hit        (Trigger)— 受击");
        Debug.Log("    Dead       (Trigger)— 死亡");
        Debug.Log("");
        Debug.Log("  下一步: 把 FBX 拖入场景，添加 Animator 组件");
        Debug.Log("  将 Freyja.controller 拖到 Animator.Controller 栏位");
    }

    static void AddClip(List<ModelImporterClipAnimation> list, string name,
                         int first, int last, bool loop)
    {
        list.Add(new ModelImporterClipAnimation
        {
            name = name,
            takeName = name,   // 关键: 显式映射到 FBX 同名 take, 否则所有 clip 都指向首个 take
            firstFrame = first,
            lastFrame = last,
            loopTime = loop,
            loop = loop,
            wrapMode = loop ? WrapMode.Loop : WrapMode.Default,
        });
    }

    static BlendTree AddBlendTreeMotion(BlendTree tree, string clipName,
                                         Dictionary<string, AnimationClip> dict,
                                         float threshold)
    {
        var clip = dict.TryGetValue(clipName, out var c) ? c : null;
        if (clip != null)
            tree.AddChild(clip, threshold);
        return tree;
    }

    static AnimatorState AddState(AnimatorStateMachine sm, string clipName,
                                   Dictionary<string, AnimationClip> dict,
                                   Vector2 pos)
    {
        var state = sm.AddState(clipName, pos);
        if (dict.TryGetValue(clipName, out var clip))
            state.motion = clip;
        return state;
    }
}
