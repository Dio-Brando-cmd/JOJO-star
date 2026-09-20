// ============================================================
// SocketIOSmokeTest.cs — Socket.IO 客户端冒烟测试
//
// 运行:
//   编辑器: 菜单 Tools/Net/SocketIO Smoke Test
//   批处理: Unity -batchmode -nographics -quit \
//             -projectPath <proj> -executeMethod SocketIOSmokeTest.Run -logFile -
//
// 校验: 连服务器 → room:create{gameMode:'THIRD_PERSON'} → 断言 ack 有 roomCode
// ============================================================

using UnityEngine;
using UnityEditor;
using System.Diagnostics;
using System.Threading;
using Debug = UnityEngine.Debug;

public static class SocketIOSmokeTest
{
    const string SERVER = "http://210.16.170.144:4000";

    [MenuItem("Tools/Net/SocketIO Smoke Test")]
    public static void Run()
    {
        var go = new GameObject("__smoke__");
        var sio = go.AddComponent<SocketIO>();
        sio.serverUrl = SERVER;

        bool connected = false;
        bool gotAck = false;
        string roomCode = null;
        string err = null;

        sio.OnConnected += () => connected = true;

        Debug.Log("[Smoke] 连接 " + SERVER + " ...");
        sio.Connect();

        var sw = Stopwatch.StartNew();
        while (!connected && sw.ElapsedMilliseconds < 15000)
        {
            sio.Pump();
            Thread.Sleep(20);
        }
        sio.Pump();

        if (!connected)
        {
            Debug.LogError("[Smoke] ❌ 连接超时/失败 (请确认服务器在线, 或改 SERVER 常量)");
            sio.Disconnect();
            Object.DestroyImmediate(go);
            return;
        }
        Debug.Log("[Smoke] ✅ 已连接, sid=" + sio.Sid);

        sio.Emit("room:create", new { playerName = "SmokeTest", gameMode = "THIRD_PERSON", maxPlayers = 12 }, ack =>
        {
            gotAck = true;
            if (ack != null && (ack["success"]?.ToObject<bool>() ?? false))
                roomCode = ack["roomCode"]?.ToObject<string>();
            else
                err = ack?["error"]?.ToObject<string>() ?? "no ack";
        });

        sw.Restart();
        while (!gotAck && sw.ElapsedMilliseconds < 10000)
        {
            sio.Pump();
            Thread.Sleep(20);
        }
        sio.Pump();

        if (gotAck && !string.IsNullOrEmpty(roomCode))
            Debug.Log("[Smoke] ✅ room:create 成功, roomCode=" + roomCode);
        else
            Debug.LogError("[Smoke] ❌ room:create 失败: " + err);

        sio.Disconnect();
        Thread.Sleep(200);
        sio.Pump();
        Object.DestroyImmediate(go);
        Debug.Log("[Smoke] 结束");
    }
}
