// ============================================================
// VerifyFreyjaController.cs — 校验 Freyja.controller 每个状态的 motion 是否为空
// 用法: -executeMethod VerifyFreyjaController.Verify
// ============================================================

using UnityEngine;
using UnityEditor;
using UnityEditor.Animations;

public class VerifyFreyjaController : EditorWindow
{
    [MenuItem("Tools/Veilland/Verify Freyja Controller", false, 101)]
    public static void Verify()
    {
        var controller = AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(
            "Assets/Resources/Animations/Freyja.controller") as AnimatorController;
        if (controller == null)
        {
            Debug.LogError("❌ 未找到 Freyja.controller");
            return;
        }

        int nullCount = 0;
        var sm = controller.layers[0].stateMachine;
        foreach (var state in sm.states)
        {
            var motion = state.state.motion;
            string desc = motion != null ? motion.name : "(空)";
            if (motion == null) nullCount++;
            Debug.Log($"   状态 [{state.state.name}] motion = {desc}");
        }

        // Blend Tree 子 motion
        var loco = sm.states[0].state.motion;
        if (loco is BlendTree bt)
        {
            foreach (var child in bt.children)
            {
                string desc = child.motion != null ? child.motion.name : "(空)";
                if (child.motion == null) nullCount++;
                Debug.Log($"   BlendTree [{child.threshold}] motion = {desc}");
            }
        }

        Debug.Log(nullCount == 0
            ? "✅ 所有状态 motion 均已正确绑定"
            : $"❌ 有 {nullCount} 个状态 motion 为空");
    }
}
