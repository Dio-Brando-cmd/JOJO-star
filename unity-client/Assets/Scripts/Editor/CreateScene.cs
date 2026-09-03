using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public class CreateScene
{
    [MenuItem("Tools/创建新场景")]
    static void CreateNewScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
        EditorSceneManager.SaveScene(scene, "Assets/Scenes/TestScene.unity");
        Debug.Log("场景已创建: Assets/Scenes/TestScene.unity");
    }
}
