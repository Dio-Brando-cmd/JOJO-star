// ============================================================
// TruthDiscNetSmokeTest.cs — 真相盘 3D 客户端联网冒烟 (生产服务器)
//
// 运行:
//   编辑器: 菜单 Tools/Truth Disc/Network Smoke Test
//   批处理: Unity -batchmode -nographics -quit \
//             -projectPath <proj> -executeMethod TruthDiscNetSmokeTest.Run -logFile -
//
// 校验 (与 NetworkManager 完全相同的 DTO 反序列化代码路径):
//   4 个 SocketIO 连接 → room:create{gameMode:'TRUTH_DISC'} + 3×join
//   → game:start → 断言 truth:started / truth:state / truth:privateState
//   全部成功反序列化进 TruthStateDTO / TruthPrivateDTO,
//   且 players[].socketId 非空 (M1 关键), 位置同步 + move 动作端到端。
// 失败时 batchmode 退出码非 0。
// ============================================================

using UnityEngine;
using UnityEditor;
using Newtonsoft.Json.Linq;
using System;
using System.Diagnostics;
using System.Threading;
using Debug = UnityEngine.Debug;

public static class TruthDiscNetSmokeTest
{
    const string SERVER = "http://210.16.170.144:4000";
    const int N = 4;

    static bool _failed;
    static void Check(string name, bool cond, string extra = "")
    {
        Debug.Log((cond ? "✅ " : "❌ ") + name + (string.IsNullOrEmpty(extra) ? "" : " — " + extra));
        if (!cond) _failed = true;
    }

    [MenuItem("Tools/Truth Disc/Network Smoke Test")]
    public static void Run()
    {
        _failed = false;

        var socks = new SocketIO[N];
        var gos = new GameObject[N];
        var states = new TruthStateDTO[N];
        var privs = new TruthPrivateDTO[N];
        var started = new bool[N];
        var connected = new bool[N];
        JToken posOn1 = null;

        for (int i = 0; i < N; i++)
        {
            int idx = i;
            var go = new GameObject("__td_smoke_" + i);
            var sio = go.AddComponent<SocketIO>();
            sio.serverUrl = SERVER;
            sio.OnConnected += () => connected[idx] = true;
            sio.On("truth:state",       t => states[idx] = t?.ToObject<TruthStateDTO>());
            sio.On("truth:privateState", t => privs[idx]  = t?.ToObject<TruthPrivateDTO>());
            sio.On("truth:started",      t => started[idx] = true);
            if (i == 1) sio.On("players:positions", t => posOn1 = t);
            socks[i] = sio;
            gos[i] = go;
        }

        Debug.Log("[TD-Smoke] 连接 " + SERVER + " (×" + N + ") ...");
        foreach (var s in socks) s.Connect();
        WaitFor(() => AllTrue(connected), socks, 15000);
        PumpAll(socks);
        Check("Socket.IO 全部连接", AllTrue(connected),
            "connected=" + string.Join(",", Array.ConvertAll(connected, c => c ? "1" : "0")));
        if (!AllTrue(connected)) { Cleanup(socks, gos); Finish(); return; }

        // room:create (玩家0) + 3×join
        JToken ack;
        EmitAck(socks, socks[0], "room:create", new { playerName = "TD烟0", gameMode = "TRUTH_DISC" }, out ack, 10000);
        bool created = ack?["success"]?.ToObject<bool>() ?? false;
        string roomCode = created ? ack["roomCode"]?.ToObject<string>() : null;
        Check("room:create (TRUTH_DISC)", created && !string.IsNullOrEmpty(roomCode), "roomCode=" + roomCode);
        if (string.IsNullOrEmpty(roomCode)) { Cleanup(socks, gos); Finish(); return; }

        for (int i = 1; i < N; i++)
        {
            EmitAck(socks, socks[i], "room:join", new { roomCode, playerName = "TD烟" + i }, out ack, 10000);
            Check("room:join 玩家" + i, ack?["success"]?.ToObject<bool>() ?? false);
        }
        WaitFor(() => true, socks, 500);

        // 开局
        EmitAck(socks, socks[0], "game:start", new { }, out ack, 10000);
        Check("game:start ack", ack?["success"]?.ToObject<bool>() ?? false);
        WaitFor(() => AllTrue(started), socks, 6000);
        PumpAll(socks);

        Check("truth:started 全员触发", AllTrue(started),
            string.Join(",", Array.ConvertAll(started, b => b ? "1" : "0")));

        // truth:state 反序列化 + M1 socketId 映射
        var s0 = states[0];
        Check("truth:state 反序列化成功", s0 != null);
        Check("phase=PLAYING", s0?.phase == "PLAYING", "phase=" + s0?.phase);
        Check("players 全员反序列化", s0?.players != null && s0.players.Length == N, "players=" + (s0?.players?.Length ?? 0));
        Check("players[].socketId 非空 (M1 关键)",
            s0?.players != null && s0.players.Length == N && Array.TrueForAll(s0.players, p => !string.IsNullOrEmpty(p?.socketId)),
            s0?.players != null ? string.Join(" ", Array.ConvertAll(s0.players, p => p.id + ":" + (string.IsNullOrEmpty(p.socketId) ? "NULL" : "ok"))) : "none");

        // truth:privateState 反序列化 + 身份
        bool allPriv = true;
        for (int i = 0; i < N; i++)
            if (privs[i] == null || string.IsNullOrEmpty(privs[i].mySeat)) allPriv = false;
        Check("truth:privateState 全员反序列化 (mySeat 非空)", allPriv,
            string.Join(" ", Array.ConvertAll(privs, p => p?.mySeat ?? "NULL")));

        int corrupted = 0; bool teamsLegal = true;
        foreach (var p in privs)
        {
            if (p?.myTeam != "spirit" && p?.myTeam != "corrupted") teamsLegal = false;
            if (p?.myTeam == "corrupted") corrupted++;
        }
        Check("阵营合法 (spirit/corrupted)", teamsLegal,
            string.Join(" ", Array.ConvertAll(privs, p => p?.myTeam ?? "NULL")));
        Check("食神者 1 人 (4人局 n>=7?2:1)", corrupted == 1, "corrupted=" + corrupted);

        // 位置同步: 玩家0 发位置, 玩家1 应收到 players:positions
        posOn1 = null;
        socks[0].Emit("player:position", new { x = 10, y = 1.5, z = -20, rotY = 0, isMoving = true, isSprinting = false });
        WaitFor(() => posOn1 != null, socks, 3000);
        bool got0 = posOn1?["positions"]?[socks[0].Sid] != null;
        Check("位置同步 (player:position→players:positions)", got0,
            posOn1?["positions"] != null ? "keys=" + (posOn1["positions"] as JObject)?.Count : "none");

        // move 动作
        EmitAck(socks, socks[0], "truth:action", new { action = new { type = "move", zone = "北垣" } }, out ack, 10000);
        Check("move 动作 ack.ok", ack?["ok"]?.ToObject<bool>() ?? false, (ack?.ToString() ?? "null").Substring(0, Math.Min(90, (ack?.ToString() ?? "null").Length)));

        Cleanup(socks, gos);
        Finish();
    }

    // ==================== 辅助 ====================

    static void PumpAll(SocketIO[] socks) { foreach (var s in socks) if (s != null) s.Pump(); }

    static bool AllTrue(bool[] a) { foreach (var b in a) if (!b) return false; return true; }

    static void WaitFor(Func<bool> cond, SocketIO[] socks, int ms)
    {
        var sw = Stopwatch.StartNew();
        while (!cond() && sw.ElapsedMilliseconds < ms) { PumpAll(socks); Thread.Sleep(20); }
        PumpAll(socks);
    }

    static void EmitAck(SocketIO[] socks, SocketIO sock, string ev, object payload, out JToken ack, int ms)
    {
        JToken result = null; bool done = false;
        sock.Emit(ev, payload, a => { result = a; done = true; });
        var sw = Stopwatch.StartNew();
        while (!done && sw.ElapsedMilliseconds < ms) { PumpAll(socks); Thread.Sleep(20); }
        PumpAll(socks);
        ack = result;
    }

    static void Cleanup(SocketIO[] socks, GameObject[] gos)
    {
        foreach (var s in socks) { try { s?.Disconnect(); } catch { } }
        Thread.Sleep(200);
        PumpAll(socks);
        foreach (var g in gos) if (g != null) UnityEngine.Object.DestroyImmediate(g);
    }

    static void Finish()
    {
        Debug.Log(_failed ? "[TD-Smoke] ❌ 失败" : "[TD-Smoke] ✅ 全部通过 — Unity 客户端联网链路就绪");
        if (Application.isBatchMode) EditorApplication.Exit(_failed ? 1 : 0);
    }
}
