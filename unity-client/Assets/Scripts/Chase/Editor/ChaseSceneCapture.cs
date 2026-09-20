// ============================================================
// ChaseSceneCapture.cs — 「帷幕追猎」HUD 截图预览入口 (editor)
// 载入 ChaseScene → 进 Play (ChaseScreenshotDriver 通过 RuntimeInitialize 自动挂载)
// 命令行: VEILLAND_CHASE_SHOT=1 + -batchmode -executeMethod ChaseSceneCapture.Capture
// ============================================================

using UnityEditor;
using UnityEditor.SceneManagement;

public class ChaseSceneCapture
{
    [MenuItem("Tools/Capture Chase HUD")]
    public static void Capture()
    {
        EditorSceneManager.OpenScene("Assets/Scenes/ChaseScene.unity");
        EditorApplication.isPlaying = true;
    }
}
