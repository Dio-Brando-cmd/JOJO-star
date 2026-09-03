// ============================================================
// VillageSceneSetup.cs — 暮色村场景初始化
// 根据服务端布局数据生成村庄场景
// 在Unity编辑器中运行以自动摆放房屋
// ============================================================

using UnityEngine;
using System.Collections.Generic;

[System.Serializable]
public class HouseData
{
    public string id;
    public string name;
    public Vector3 position;
    public float rotation;
}

[System.Serializable]
public class VillageLayout
{
    public HouseData[] houses;
    public LandmarkData[] landmarks;
}

[System.Serializable]
public class LandmarkData
{
    public string id;
    public string name;
    public float x, y, z;
}

public class VillageSceneSetup : MonoBehaviour
{
    [Header("Prefabs")]
    public GameObject defaultHousePrefab;     // 默认房屋
    public GameObject treePrefab;              // 古树
    public GameObject wellPrefab;              // 水井
    public GameObject[] houseStylePrefabs;     // 不同风格的房屋

    [Header("Generated")]
    public List<GameObject> spawnedHouses = new();
    public List<GameObject> spawnedLandmarks = new();

    [Header("Debug")]
    public bool generateOnStart = true;
    public string layoutJson; // 从服务端/PositionSync获取的JSON

    void Start()
    {
        if (generateOnStart)
        {
            GenerateDefaultLayout();
        }
    }

    /// <summary>生成默认环形布局（12栋屋子+4个地标）</summary>
    [ContextMenu("Generate Default Layout")]
    public void GenerateDefaultLayout()
    {
        ClearAll();

        string[] houseNames = {
            "追猎者庇护所", "帷幕守卫庇护所", "冥僧人屋", "蚀者屋",
            "帷幕学者屋", "草药学者屋", "愈灵师屋", "灵织者1屋",
            "灵织者2屋", "灵织者3屋", "灵织者4屋", "灵织者5屋",
        };

        for (int i = 0; i < 12; i++)
        {
            float angle = (i / 12f) * Mathf.PI * 2f - Mathf.PI / 2f;
            float radius = 30f;
            Vector3 pos = new Vector3(
                Mathf.Cos(angle) * radius,
                0,
                Mathf.Sin(angle) * radius
            );

            GameObject prefab = (houseStylePrefabs != null && houseStylePrefabs.Length > 0)
                ? houseStylePrefabs[i % houseStylePrefabs.Length]
                : defaultHousePrefab;

            if (prefab == null)
            {
                // 无prefab时创建基础Cube占位
                prefab = GameObject.CreatePrimitive(PrimitiveType.Cube);
                prefab.transform.localScale = new Vector3(5, 3, 4);
                // Fix material for URP
                var urpLit = Shader.Find("Universal Render Pipeline/Lit");
                if (urpLit != null)
                    prefab.GetComponent<MeshRenderer>().sharedMaterial = new Material(urpLit);
            }

            GameObject house = Instantiate(prefab, pos, Quaternion.Euler(0, angle * Mathf.Rad2Deg, 0), transform);
            house.name = houseNames[i];

            // Fix all child renderer materials for URP
            foreach (var mr in house.GetComponentsInChildren<MeshRenderer>())
            {
                if (mr.sharedMaterial == null || mr.sharedMaterial.shader.name == "Standard")
                {
                    var urpLit = Shader.Find("Universal Render Pipeline/Lit");
                    if (urpLit != null)
                        mr.sharedMaterial = new Material(urpLit);
                }
            }

            // 添加房屋组件
            var houseComp = house.AddComponent<VillageHouse>();
            houseComp.houseId = $"house_{i}";
            houseComp.houseName = houseNames[i];
            houseComp.ownerIndex = i;

            spawnedHouses.Add(house);
        }

        // 地标
        SpawnLandmark(treePrefab, "广场古树", Vector3.zero);
        SpawnLandmark(wellPrefab, "水井", new Vector3(-5, 0, 8));
        SpawnLandmark(null, "铁匠铺", new Vector3(8, 0, -5)); // 用默认Cube
        SpawnLandmark(null, "南山墓地", new Vector3(0, 0, -50));

        Debug.Log($"[Village] Generated {spawnedHouses.Count} houses + {spawnedLandmarks.Count} landmarks");
    }

    void SpawnLandmark(GameObject prefab, string name, Vector3 pos)
    {
        if (prefab == null)
        {
            prefab = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            prefab.transform.localScale = new Vector3(1, 2, 1);
        }
        // Fix material for URP
        foreach (var mr in prefab.GetComponentsInChildren<MeshRenderer>())
        {
            if (mr.sharedMaterial == null || mr.sharedMaterial.shader.name == "Standard")
            {
                var urpLit = Shader.Find("Universal Render Pipeline/Lit");
                if (urpLit != null)
                    mr.sharedMaterial = new Material(urpLit);
            }
        }
        GameObject obj = Instantiate(prefab, pos, Quaternion.identity, transform);
        obj.name = name;
        spawnedLandmarks.Add(obj);
    }

    [ContextMenu("Clear All")]
    public void ClearAll()
    {
        foreach (var h in spawnedHouses)
            if (h != null) DestroyImmediate(h);
        foreach (var l in spawnedLandmarks)
            if (l != null) DestroyImmediate(l);
        spawnedHouses.Clear();
        spawnedLandmarks.Clear();
    }
}

// ============================================================
// VillageHouse.cs — 单个房屋组件
// ============================================================
public class VillageHouse : MonoBehaviour, IInteractable
{
    public string houseId;
    public string houseName;
    public int ownerIndex;
    public bool isLocked = false;
    public bool isFortified = false;    // 守卫筑垒
    public bool hasTrap = false;        // 灵痕追猎者/老兵陷阱
    public bool hasPoisonFog = false;   // 毒雾陷阱

    void Start()
    {
        // 添加碰撞检测
        var collider = GetComponent<Collider>();
        if (collider == null)
        {
            var bc = gameObject.AddComponent<BoxCollider>();
            bc.isTrigger = true;
        }
    }

    public void OnInteract(GameObject interactor)
    {
        // 开门/进入屋子
        if (isLocked)
        {
            Debug.Log($"[House] {houseName} 门锁住了");
            return;
        }

        // 触发进入屋子逻辑
        var playerCtrl = interactor.GetComponent<PlayerController3D>();
        if (playerCtrl != null && playerCtrl.isLocal)
        {
            // 发送"出门"或"进入屋子"的网络事件
            Debug.Log($"[House] Player entering {houseName}");
        }
    }

    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player"))
        {
            Debug.Log($"[House] Player entered {houseName}");
        }
    }

    void OnTriggerExit(Collider other)
    {
        if (other.CompareTag("Player"))
        {
            Debug.Log($"[House] Player left {houseName}");
        }
    }

    public int GetVisitorCount()
    {
        // 由服务端维护，客户端仅显示
        return 0;
    }
}
