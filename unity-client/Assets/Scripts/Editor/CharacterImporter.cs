// ============================================================
// CharacterImporter.cs — Unity Editor 一键导入所有角色模型
// 放在 Assets/Scripts/Editor/ 目录下
// 使用: Tools → Werewolf → Import All Characters
// ============================================================

using UnityEngine;
using UnityEditor;
using System.IO;
using System.Collections.Generic;

public class CharacterImporter : EditorWindow
{
    private static readonly string[] CHARACTERS = {
        "SIGURD", "FREYJA", "MORRIGAN", "ANUBIS_ACOLYTE", "HECTOR",
        "ROMULUS", "FENRIR_KIN", "SKADI", "HAIKU_MONK", "BRIGID",
        "YSERA", "GOREN", "AILIN", "ORIC", "NELIA"
    };

    private static readonly Dictionary<string, CharacterSetup> SETUPS = new()
    {
        ["SIGURD"]          = new() { height=1.88f, build="muscular",   weapon="Rifle",     armor="LeatherArmor" },
        ["FREYJA"]          = new() { height=1.65f, build="slim",       weapon="Potions",    armor="ClothRobe" },
        ["MORRIGAN"]        = new() { height=1.72f, build="athletic",   weapon="Staff",      armor="HoodedCloak" },
        ["ANUBIS_ACOLYTE"]  = new() { height=1.82f, build="thin",       weapon="Scepter",    armor="PriestRobe" },
        ["HECTOR"]          = new() { height=1.95f, build="burly",      weapon="Shield",     armor="BronzeArmor" },
        ["ROMULUS"]         = new() { height=1.78f, build="lean",       weapon="Claws",      armor="LeatherVest" },
        ["FENRIR_KIN"]      = new() { height=1.92f, build="hulking",    weapon="Claws",      armor="TornLeather" },
        ["SKADI"]           = new() { height=1.75f, build="athletic",   weapon="Bow",        armor="FurMantle" },
        ["HAIKU_MONK"]      = new() { height=1.70f, build="thin",       weapon="Brush",      armor="MonkRobe" },
        ["BRIGID"]          = new() { height=1.63f, build="slim",       weapon="Torch",      armor="FireCloth" },
        ["YSERA"]           = new() { height=1.68f, build="slim",       weapon="Dagger",     armor="DarkCloak" },
        ["GOREN"]           = new() { height=1.85f, build="burly",      weapon="Hammer",     armor="LeatherApron" },
        ["AILIN"]           = new() { height=1.70f, build="thin",       weapon="Shovel",     armor="GraveCloak" },
        ["ORIC"]            = new() { height=1.73f, build="lean",       weapon="None",       armor="LightTunic" },
        ["NELIA"]           = new() { height=1.67f, build="slim",       weapon="Tome",       armor="ScholarRobe" },
    };

    [MenuItem("Tools/Werewolf/Import All Characters")]
    public static void ImportAll()
    {
        string fbxPath = EditorUtility.OpenFolderPanel("Select FBX Export Folder", "Assets/Models/Characters", "");
        if (string.IsNullOrEmpty(fbxPath)) return;

        foreach (var charId in CHARACTERS)
        {
            string fbxFile = Path.Combine(fbxPath, $"{charId}.fbx");
            if (!File.Exists(fbxFile))
            {
                Debug.LogWarning($"Missing FBX: {fbxFile}");
                continue;
            }
            ImportCharacter(charId, fbxFile);
        }

        AssetDatabase.Refresh();
        SetupAllPrefabs();
        Debug.Log($"Imported {CHARACTERS.Length} characters");
    }

    static void ImportCharacter(string charId, string fbxPath)
    {
        string destDir = $"Assets/Models/Characters/{charId}";
        if (!Directory.Exists(destDir)) Directory.CreateDirectory(destDir);

        string destFile = Path.Combine(destDir, $"{charId}.fbx");
        File.Copy(fbxPath, destFile, true);

        AssetDatabase.ImportAsset(destFile, ImportAssetOptions.ForceUpdate);
        var importer = AssetImporter.GetAtPath(destFile) as ModelImporter;
        if (importer != null)
        {
            importer.animationType = ModelImporterAnimationType.Humanoid;
            importer.materialImportMode = ModelImporterMaterialImportMode.ImportStandard;
            importer.SaveAndReimport();
        }
    }

    static void SetupAllPrefabs()
    {
        string prefabDir = "Assets/Prefabs/Characters";
        if (!Directory.Exists(prefabDir)) Directory.CreateDirectory(prefabDir);

        foreach (var charId in CHARACTERS)
        {
            string fbxPath = $"Assets/Models/Characters/{charId}/{charId}.fbx";
            var fbx = AssetDatabase.LoadAssetAtPath<GameObject>(fbxPath);
            if (fbx == null) continue;

            // Create prefab
            GameObject instance = PrefabUtility.InstantiatePrefab(fbx) as GameObject;
            instance.name = charId;

            // Add components
            var controller = instance.AddComponent<PlayerController3D>();
            controller.characterId = charId;
            controller.ApplyTraitModifiers();

            var collider = instance.AddComponent<CapsuleCollider>();
            var setup = SETUPS.GetValueOrDefault(charId);
            if (setup != null)
            {
                collider.height = setup.height;
                collider.radius = 0.3f;
                collider.center = new Vector3(0, setup.height / 2f, 0);
            }

            string prefabPath = $"{prefabDir}/{charId}.prefab";
            PrefabUtility.SaveAsPrefabAsset(instance, prefabPath);
            DestroyImmediate(instance);
        }
    }

    [MenuItem("Tools/Werewolf/Setup Village Scene")]
    public static void SetupVillageScene()
    {
        var villageGO = GameObject.Find("Village") ?? new GameObject("Village");
        var setup = villageGO.GetComponent<VillageSceneSetup>();
        if (setup == null) setup = villageGO.AddComponent<VillageSceneSetup>();
        setup.GenerateDefaultLayout();
        Debug.Log("Village scene generated");
    }
}

public struct CharacterSetup
{
    public float height;
    public string build;
    public string weapon;
    public string armor;
}
