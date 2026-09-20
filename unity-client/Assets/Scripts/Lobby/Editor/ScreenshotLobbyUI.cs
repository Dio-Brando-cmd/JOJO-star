// ============================================================
// ScreenshotLobbyUI.cs — 大厅主菜单截图预览入口 (editor)
// 载入 ValleyScene → 进 Play (ScreenshotDriver 通过 RuntimeInitialize 自动挂载)
// 命令行: VEILLAND_SHOT=1 + -batchmode -executeMethod ScreenshotLobbyUI.Capture
// ============================================================

using UnityEditor;
using UnityEditor.SceneManagement;

public class ScreenshotLobbyUI
{
    [MenuItem("Tools/Capture Lobby UI")]
    public static void Capture()
    {
        EditorSceneManager.OpenScene("Assets/Scenes/ValleyScene.unity");
        EditorApplication.isPlaying = true;
    }
}
