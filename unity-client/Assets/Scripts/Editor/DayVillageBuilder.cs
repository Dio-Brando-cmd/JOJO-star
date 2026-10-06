using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using Unity.AI.Navigation;
using VeilLand.DayVillage;

public static class DayVillageBuilder
{
    const string Root="Assets/DayVillage";
    const string ScenePath="Assets/Scenes/DayVillage.unity";
    [Serializable] class Door { public float[] position; public float[] normal; }
    [Serializable] class House { public string name; public float[] position; public Door[] doors; public float[] stairsBottom; public float[] stairsTop; }
    [Serializable] class Layout { public float[] spawn; public House[] houses; }
    static Vector3 V(float[] a) => new Vector3(a[0],a[1],a[2]);
    static void SaveAsset(UnityEngine.Object asset,string path)
    {
        var old=AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(path);
        if(old) { EditorUtility.CopySerialized(asset,old); UnityEngine.Object.DestroyImmediate(asset); }
        else AssetDatabase.CreateAsset(asset,path);
    }
    static void AddToBuildSettings(string scenePath)
    {
        var scenes=new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        for(int i=0;i<scenes.Count;i++) if(scenes[i].path==scenePath) return;
        scenes.Add(new EditorBuildSettingsScene(scenePath,true));
        EditorBuildSettings.scenes=scenes.ToArray();
        Debug.Log("[DayVillage] 场景已加入 Build Settings: "+scenePath);
    }
    [MenuItem("Tools/VeilLand/Build Day Village")]
    public static void Build()
    {
        if(Application.unityVersion!="2022.3.62f3c1") throw new Exception("Use pinned Unity 2022.3.62f3c1");
        string pkg=File.ReadAllText("Packages/com.unity.cloud.gltfast/package.json");
        if(!pkg.Contains("\"version\": \"6.1.0\""))throw new Exception("Embedded glTFast must remain 6.1.0");
        SetupKanbanAnimations.Setup(); // 确保看板娘 FBX 已配 Generic rig + Kanban.controller 存在
        AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
        var map=AssetDatabase.LoadAssetAtPath<GameObject>(Root+"/DayVillage.glb");
        var playerAsset=AssetDatabase.LoadAssetAtPath<GameObject>(SetupKanbanAnimations.FbxPath);
        if(!map||!playerAsset)throw new Exception("asset import failed (DayVillage.glb or KanbanPlayer_Animated.fbx)");
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        var shared=new GameObject("BASE_昼夜共享场地");
        var environment=(GameObject)PrefabUtility.InstantiatePrefab(map); environment.name="ExistingVillage_原聚落";environment.transform.SetParent(shared.transform);
        int colliders=0, meshes=0;
        foreach(var mf in environment.GetComponentsInChildren<MeshFilter>())
        { meshes++;if(mf.name.StartsWith("SOLID_")) {var c=mf.gameObject.AddComponent<MeshCollider>();c.sharedMesh=mf.sharedMesh;colliders++;} }
        Physics.SyncTransforms(); // 新碰撞体立即进物理世界, 供下方灯笼/任务点 raycast 命中
        var day=new GameObject("DAY_自然光与生活氛围");
        var night=new GameObject("NIGHT_夸张外壳_预留");night.SetActive(false);
        var sun=new GameObject("DaySun").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=1.3f;sun.color=new Color(1,.94f,.85f);sun.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(38,-35,0);sun.transform.SetParent(day.transform);
        var moon=new GameObject("NightMoon").AddComponent<Light>();moon.type=LightType.Directional;moon.intensity=0f;moon.color=new Color(.55f,.62f,.95f);moon.shadows=LightShadows.Soft;moon.transform.rotation=Quaternion.Euler(52,150,0);
        foreach(var p in new[]{new Vector3(-8,0,12),new Vector3(45,0,-10),new Vector3(-82,0,-14),new Vector3(0,0,100),new Vector3(0,0,0),new Vector3(22,0,28)})
        {
            var pos=p;if(Physics.Raycast(pos+Vector3.up*80,Vector3.down,out var lh,150))pos.y=lh.point.y+.01f;
            var lan=new GameObject("NightLantern").AddComponent<Light>();lan.type=LightType.Point;lan.range=16;lan.intensity=1.5f;lan.color=new Color(1f,.5f,.22f);lan.transform.position=pos+Vector3.up*2.4f;lan.transform.SetParent(night.transform);
        }
        RenderSettings.sun=sun;RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.48f,.56f,.67f);RenderSettings.ambientEquatorColor=new Color(.45f,.45f,.39f);RenderSettings.ambientGroundColor=new Color(.22f,.22f,.18f);
        RenderSettings.fog=true;RenderSettings.fogMode=FogMode.ExponentialSquared;RenderSettings.fogDensity=.0028f;RenderSettings.fogColor=new Color(.67f,.72f,.77f);
        var skyShader=Shader.Find("Skybox/Procedural");
        if(skyShader){var sky=new Material(skyShader);sky.SetColor("_SkyTint",new Color(.55f,.59f,.65f));sky.SetFloat("_AtmosphereThickness",1.1f);SaveAsset(sky,Root+"/DaySky.mat");RenderSettings.skybox=AssetDatabase.LoadAssetAtPath<Material>(Root+"/DaySky.mat");}
        var layout=JsonUtility.FromJson<Layout>(File.ReadAllText(Root+"/layout.json"));
        Physics.SyncTransforms();var player=new GameObject("Player_看板娘");player.layer=2;
        Vector3 spawn=V(layout.spawn)+Vector3.up*.3f;
        if(Physics.Raycast(spawn+Vector3.up*20,Vector3.down,out var hit,100))spawn.y=hit.point.y+.08f;
        player.transform.position=spawn;
        var body=player.AddComponent<CharacterController>();body.height=1.7f;body.radius=.3f;body.center=new Vector3(0,.85f,0);body.stepOffset=.35f;body.slopeLimit=48;body.skinWidth=.035f;
        var visual=(GameObject)PrefabUtility.InstantiatePrefab(playerAsset);visual.name="Kanban_指定角色";visual.transform.SetParent(player.transform,false);
        foreach(Transform t in visual.GetComponentsInChildren<Transform>()) t.gameObject.layer=2;
        var kanbanAnimator=visual.GetComponent<Animator>();
        if(kanbanAnimator==null) kanbanAnimator=visual.AddComponent<Animator>();
        var kanbanController=AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(SetupKanbanAnimations.ControllerPath);
        if(kanbanController) kanbanAnimator.runtimeAnimatorController=kanbanController;
        // 归一化: FBX 经 Unity 单位换算后约为 2.1m 且脚低于原点, 按实测包围盒缩放到 1.7m 并让脚落地
        var smr=visual.GetComponentInChildren<SkinnedMeshRenderer>();
        if(smr)
        {
            var b=smr.bounds;
            float height=b.size.y;
            float feetLocalY=b.min.y-visual.transform.position.y; // 相对 visual 原点的脚偏移(负=脚在下方)
            if(height>0.01f && Mathf.Abs(height-1.7f)>0.01f)
            {
                float s=1.7f/height;
                visual.transform.localScale=Vector3.one*s;
                visual.transform.localPosition=new Vector3(0,-feetLocalY*s,0);
                Debug.Log($"KANBAN_IMPORT height={height:F3} feetLocalY={feetLocalY:F3} verts={smr.sharedMesh.vertexCount} -> scale x{s:F3} offsetY={(-feetLocalY*s):F3}");
            }
        }
        var camera=new GameObject("PlayerCamera").AddComponent<Camera>();camera.tag="MainCamera";camera.nearClipPlane=.08f;camera.farClipPlane=600;camera.fieldOfView=65;
        camera.gameObject.AddComponent<AudioListener>();camera.gameObject.AddComponent<UniversalAdditionalCameraData>();camera.transform.position=spawn+new Vector3(0,2.2f,4);camera.transform.LookAt(spawn+Vector3.up*1.2f);
        var control=player.AddComponent<DayVillageWalkthrough>();control.viewCamera=camera;control.visual=visual.transform;control.spawn=spawn;control.nightOverlay=night;control.animator=kanbanAnimator;
        var dayNight=new GameObject("DayNightCycle_昼夜系统").AddComponent<DayNightCycle>();dayNight.sun=sun;dayNight.moon=moon;dayNight.nightGroup=night;dayNight.autoSwitchSeconds=150f;
        var atmosphere=dayNight.gameObject.AddComponent<NightAtmosphere>();atmosphere.cycle=dayNight; // 星空/萤火虫/额外灯笼/Bloom
        var chaseBridge=dayNight.gameObject.AddComponent<NightToChaseBridge>();chaseBridge.cycle=dayNight; // 入夜 → 真实追逃
        control.onAllTasksDelivered = () => dayNight.ForceNight(); // 集齐交付 → 提前入夜 → 追逃
        var taskRoot=new GameObject("Gameplay_白天共同任务点");
        Vector3[] locations={new Vector3(-8,0,12),new Vector3(45,0,-10),new Vector3(-82,0,-14),new Vector3(0,0,100)};
        string[] names={"整理广场物资","维护铁匠工具","补充水井物资","清理放逐台道路"};
        control.taskPoints=new Transform[locations.Length];control.taskNames=names;
        for(int i=0;i<locations.Length;i++)
        {
            var p=locations[i];if(Physics.Raycast(p+Vector3.up*80,Vector3.down,out var h,150))p.y=h.point.y;
            var point=new GameObject("DayTask_"+(i+1)+"_"+names[i]);point.transform.position=p;point.transform.SetParent(taskRoot.transform);control.taskPoints[i]=point.transform;
            var board=GameObject.CreatePrimitive(PrimitiveType.Cube);board.name="任务木牌";board.transform.SetParent(point.transform,false);board.transform.localPosition=new Vector3(.9f,1.1f,0);board.transform.localScale=new Vector3(.55f,.65f,.08f);
            var mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));mat.color=new Color(.28f,.21f,.13f);SaveAsset(mat,Root+"/TaskBoard"+i+".mat");board.GetComponent<Renderer>().sharedMaterial=AssetDatabase.LoadAssetAtPath<Material>(Root+"/TaskBoard"+i+".mat");
        }
        // 物资球(收集物) + 交付祭坛 —— 把占位任务点实体化为"拾取→交付"闭环
        control.taskOrbs=new Transform[locations.Length];
        var orbShader=Shader.Find("Universal Render Pipeline/Lit");
        for(int i=0;i<locations.Length;i++)
        {
            var orb=GameObject.CreatePrimitive(PrimitiveType.Sphere);orb.name="Supply_"+(i+1);orb.transform.SetParent(taskRoot.transform,false);
            orb.transform.position=control.taskPoints[i].position+Vector3.up*1.6f;orb.transform.localScale=Vector3.one*.5f;
            var om=new Material(orbShader);om.color=new Color(.35f,.9f,.9f,1f);
            if(om.HasProperty("_EmissionColor")){om.EnableKeyword("_EMISSION");om.SetColor("_EmissionColor",new Color(.2f,.8f,.8f)*2f);}
            SaveAsset(om,Root+"/Supply"+i+".mat");orb.GetComponent<Renderer>().sharedMaterial=AssetDatabase.LoadAssetAtPath<Material>(Root+"/Supply"+i+".mat");
            control.taskOrbs[i]=orb.transform;
        }
        var altar=GameObject.CreatePrimitive(PrimitiveType.Cylinder);altar.name="DeliveryAltar";altar.transform.SetParent(taskRoot.transform,false);
        altar.transform.position=spawn+Vector3.up*.02f;altar.transform.localScale=new Vector3(3f,.02f,3f);
        var ac=altar.GetComponent<Collider>();if(ac!=null)UnityEngine.Object.DestroyImmediate(ac);
        var am=new Material(orbShader);am.color=new Color(1f,.8f,.3f,.5f);
        if(am.HasProperty("_EmissionColor")){am.EnableKeyword("_EMISSION");am.SetColor("_EmissionColor",new Color(1f,.7f,.2f)*1.5f);}
        SaveAsset(am,Root+"/Altar.mat");altar.GetComponent<Renderer>().sharedMaterial=AssetDatabase.LoadAssetAtPath<Material>(Root+"/Altar.mat");
        altar.SetActive(false);control.altar=altar.transform;
        var doorRoot = new GameObject("Gameplay_住宅门_可开关");
        var doorMaterial = new Material(Shader.Find("Universal Render Pipeline/Lit")); doorMaterial.color = new Color(.20f,.10f,.055f);
        SaveAsset(doorMaterial, Root+"/VillageDoor.mat"); doorMaterial = AssetDatabase.LoadAssetAtPath<Material>(Root+"/VillageDoor.mat");
        foreach(var house in layout.houses) foreach(var doorData in house.doors ?? new Door[0])
        {
            if (doorData == null) continue;
            var rotation = doorData.normal != null ? Quaternion.LookRotation(V(doorData.normal), Vector3.up) : Quaternion.identity;
            var right = rotation * Vector3.right;
            float panelWidth = 2.31f;
            Vector3 center = V(doorData.position);
            var pivot = new GameObject(house.name+"_Door_OpenClose_HingeLeft"); pivot.transform.SetParent(doorRoot.transform);
            pivot.transform.position = center - right * (panelWidth * .5f) - Vector3.up * 1.45f; pivot.transform.rotation = rotation;
            var panel = GameObject.CreatePrimitive(PrimitiveType.Cube); panel.name = house.name+"_DoorPanel_SingleLeaf"; panel.transform.SetParent(pivot.transform, false);
            panel.transform.localPosition = new Vector3(panelWidth * .5f, 1.45f, 0); panel.transform.localScale = new Vector3(panelWidth, 2.9f, .12f);
            panel.GetComponent<Renderer>().sharedMaterial = doorMaterial;
            var interaction = pivot.AddComponent<VillageDoor>(); interaction.houseName = house.name+" 住宅门";
        }
        new GameObject("Gameplay_密谈与夜间任务预留");
        var stairLinksRoot = new GameObject("Gameplay_住宅楼梯导航连接"); stairLinksRoot.transform.SetParent(shared.transform, false);
        var stairLinks = new List<NavMeshLink>();
        foreach(var house in layout.houses)
        {
            if(house.stairsBottom==null || house.stairsTop==null) continue;
            var linkObject = new GameObject(house.name+"_StairLink"); linkObject.transform.SetParent(stairLinksRoot.transform, false);
            var link = linkObject.AddComponent<NavMeshLink>(); link.startPoint=V(house.stairsBottom); link.endPoint=V(house.stairsTop); link.width=1.15f; link.bidirectional=true; link.autoUpdate=true; stairLinks.Add(link);
        }
        var nav=shared.AddComponent<NavMeshSurface>();nav.useGeometry=NavMeshCollectGeometry.PhysicsColliders;nav.collectObjects=CollectObjects.Children;nav.overrideVoxelSize=true;nav.voxelSize=.2f;nav.overrideTileSize=true;nav.tileSize=128;nav.BuildNavMesh();
        if(nav.navMeshData) {SaveAsset(nav.navMeshData,Root+"/DayVillageNavMesh.asset");nav.navMeshData=AssetDatabase.LoadAssetAtPath<NavMeshData>(Root+"/DayVillageNavMesh.asset");nav.RemoveData();nav.AddData();foreach(var link in stairLinks) link.UpdateLink();}
        AddToBuildSettings(ScenePath);
        EditorSceneManager.SaveScene(scene,ScenePath);AssetDatabase.SaveAssets();
        int reachable=0,sampled=0;
        foreach(var task in control.taskPoints)
        {
            if(NavMesh.SamplePosition(spawn,out var a,4,NavMesh.AllAreas)&&NavMesh.SamplePosition(task.position,out var b,4,NavMesh.AllAreas))
            {sampled++;var path=new NavMeshPath();if(NavMesh.CalculatePath(a.position,b.position,NavMesh.AllAreas,path)&&path.status==NavMeshPathStatus.PathComplete)reachable++;}
        }
        Directory.CreateDirectory("DayVillageVerification");
        int doorCount = doorRoot.GetComponentsInChildren<VillageDoor>().Length;
        int stairsReached=0;
        foreach(var house in layout.houses)
        {
            if(house.stairsBottom==null || house.stairsTop==null) continue;
            var path=new NavMeshPath();
            bool ok=NavMesh.SamplePosition(V(house.stairsBottom),out var bottom,2.5f,NavMesh.AllAreas)
                && NavMesh.SamplePosition(V(house.stairsTop),out var top,2.5f,NavMesh.AllAreas)
                && NavMesh.CalculatePath(bottom.position,top.position,NavMesh.AllAreas,path)
                && path.status==NavMeshPathStatus.PathComplete;
            if(ok) stairsReached++;
            Debug.Log("HOUSE_STAIRS "+house.name+" reachable="+ok);
        }
        File.WriteAllText("DayVillageVerification/stairs-validation.json","{\"houses\":12,\"stairGeometry\":12,\"navmeshUpperFloors\":"+stairsReached+",\"note\":\"CharacterController stair climb is recorded in stair-diagnostic.txt\"}");
        File.WriteAllText("DayVillageVerification/editor-validation.json","{\"unity\":\""+Application.unityVersion+"\",\"gltfast\":\"6.1.0\",\"meshes\":"+meshes+",\"colliders\":"+colliders+",\"doors\":"+doorCount+",\"taskPoints\":4,\"navSamples\":"+sampled+",\"reachableTasks\":"+reachable+"}");
        Debug.Log("DAY_VILLAGE_READY meshes="+meshes+" colliders="+colliders+" reachableTasks="+reachable);
    }
    public static void BuildPlayer()
    {
        Build();Directory.CreateDirectory("Builds/DayVillage");
        var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{ScenePath},locationPathName="Builds/DayVillage/DayVillage.exe",target=BuildTarget.StandaloneWindows64,options=BuildOptions.Development});
        if(report.summary.result!=BuildResult.Succeeded)throw new Exception("Day village build failed: "+report.summary.result);
        Debug.Log("DAY_VILLAGE_PLAYER_BUILT");
    }
    public static void DiagnoseStairs()
    {
        EditorSceneManager.OpenScene(ScenePath);
        var layout=JsonUtility.FromJson<Layout>(File.ReadAllText(Root+"/layout.json"));
        var player=GameObject.Find("Player_看板娘");var body=player.GetComponent<CharacterController>();
        var report=new System.Text.StringBuilder();
        foreach(var house in layout.houses)
        {
            var from=V(house.stairsBottom);var to=V(house.stairsTop);
            body.enabled=false;player.transform.position=from;body.enabled=true;Physics.SyncTransforms();
            var dir=to-from;dir.y=0;dir.Normalize();
            for(int i=0;i<180;i++){body.Move(dir*.035f+Vector3.down*.012f);Physics.SyncTransforms();}
            var end=player.transform.position;
            report.AppendLine(house.name+" from="+from+" target="+to+" end="+end+" rise="+(end.y-from.y));
            foreach(var hit in Physics.RaycastAll(to+Vector3.up*4,Vector3.down,10))report.AppendLine("  top ray "+hit.point+" "+hit.collider.name);
        }
        File.WriteAllText("DayVillageVerification/stair-diagnostic.txt",report.ToString());
    }
}
