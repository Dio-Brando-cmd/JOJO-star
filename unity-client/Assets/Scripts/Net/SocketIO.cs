// ============================================================
// SocketIO.cs — Socket.IO v4 客户端 (Engine.IO v4 over WebSocket)
//
// 自写零依赖实现，采用 websocket-only 传输：
//   1. 直接 ws://host/socket.io/?EIO=4&transport=websocket
//   2. 服务器首帧发 0{sid} (Engine.IO open) → 客户端发 "40" 连命名空间
//   3. 收 40{sid} 即命名空间连接成功
//   4. 包层: 42 事件 / 43 ack / 2↔3 心跳
//
// (不用 polling→websocket 升级，避免 EIO v4 的 2probe/3probe/5 探测序列)
//
// 线程模型：
//   - 连接/接收在后台线程；包解析与事件派发在调用方线程
//   - Play 模式由 Update 驱动 Pump()；编辑器冒烟测试手动 Pump()
// ============================================================

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

public class SocketIO : MonoBehaviour
{
    public string serverUrl = "http://210.16.170.144:4000";

    WebSocketRaw _ws;
    string _sid;
    int _ackCounter;
    float _lastReceiveTime;                 // 最近一次收到帧的时间 (读超时检测用)
    const float READ_TIMEOUT = 35f;         // 服务器 EIO ping 间隔 25s, 35s 内无任何帧 → 判静默断线
    readonly Dictionary<int, Action<JToken>> _pendingAcks = new Dictionary<int, Action<JToken>>();
    readonly Dictionary<string, List<Action<JToken>>> _handlers = new Dictionary<string, List<Action<JToken>>>();
    readonly ConcurrentQueue<Action> _mainThread = new ConcurrentQueue<Action>();

    public bool Connected { get; private set; }
    public string Sid { get; private set; }

    public event Action OnConnected;
    public event Action OnDisconnected;

    // ============================================================
    // 连接
    // ============================================================

    public void Connect()
    {
        var t = new Thread(ConnectThreaded) { IsBackground = true };
        t.Start();
    }

    void ConnectThreaded()
    {
        try
        {
            string url = serverUrl.TrimEnd('/');
            Uri uri = new Uri(url);
            string host = uri.Host;
            int port = uri.IsDefaultPort ? (uri.Scheme == "https" ? 443 : 80) : uri.Port;
            string basePath = uri.AbsolutePath.TrimEnd('/');

            string wsPath = basePath + "/socket.io/?EIO=4&transport=websocket";
            _ws = new WebSocketRaw();
            _ws.OnClose += () => _mainThread.Enqueue(() =>
            {
                if (Connected) { Connected = false; OnDisconnected?.Invoke(); }
            });
            _ws.OnError += err => _mainThread.Enqueue(() => Debug.LogWarning("[SocketIO] " + err));

            _ws.Connect(host, port, wsPath);
        }
        catch (Exception e)
        {
            RaiseError("连接失败: " + e.Message);
        }
    }

    void RaiseError(string msg)
    {
        _mainThread.Enqueue(() => Debug.LogError("[SocketIO] " + msg));
        _mainThread.Enqueue(() => OnDisconnected?.Invoke());
    }

    public void Disconnect()
    {
        try { _ws?.SendText("41"); } catch { }
        ForceDisconnect();
    }

    void ForceDisconnect()
    {
        try { _ws?.Close(); } catch { }
        Connected = false;
        _pendingAcks.Clear();
        OnDisconnected?.Invoke();
    }

    // ============================================================
    // 主线程泵
    // ============================================================

    void Update()
    {
        Pump();
        // 读超时检测: 静默断线 (无 close 帧) 时主动判定并断开
        if (Connected && Time.realtimeSinceStartup - _lastReceiveTime > READ_TIMEOUT)
        {
            Debug.LogWarning("[SocketIO] 读超时 (静默断线), 判定连接断开");
            ForceDisconnect();
        }
    }

    public void Pump()
    {
        if (_ws != null)
        {
            while (_ws.Incoming.TryDequeue(out string frame))
            {
                _lastReceiveTime = Time.realtimeSinceStartup;
                HandlePacket(frame);
            }
        }
        while (_mainThread.TryDequeue(out Action a)) a?.Invoke();
    }

    // ============================================================
    // 包解析
    // ============================================================

    void HandlePacket(string frame)
    {
        if (string.IsNullOrEmpty(frame)) return;
        char t = frame[0];
        string body = frame.Length > 1 ? frame.Substring(1) : "";

        switch (t)
        {
            case '0': // Engine.IO open → 连接命名空间
                try { _sid = (string)JObject.Parse(body)["sid"]; } catch { }
                _ws?.SendText("40");
                break;
            case '1': // Engine.IO close
                break;
            case '2': // Engine.IO ping → pong
                _ws?.SendText("3");
                break;
            case '3': // Engine.IO pong (忽略)
                break;
            case '4': // Engine.IO message → Socket.IO 包
                HandleSocketPacket(body);
                break;
        }
    }

    void HandleSocketPacket(string body)
    {
        if (string.IsNullOrEmpty(body)) return;
        char t = body[0];
        string rest = body.Length > 1 ? body.Substring(1) : "";

        switch (t)
        {
            case '0': // CONNECT (命名空间会话)
                try { Sid = (string)JObject.Parse(rest)["sid"]; } catch { Sid = _sid; }
                Connected = true;
                _lastReceiveTime = Time.realtimeSinceStartup;
                OnConnected?.Invoke();
                break;
            case '1': // DISCONNECT
                Connected = false;
                OnDisconnected?.Invoke();
                break;
            case '2': // EVENT: ["name", payload...]
                HandleEvent(rest);
                break;
            case '3': // ACK: <id>[...]
                HandleAck(rest);
                break;
            case '4': // CONNECT_ERROR
                Debug.LogError("[SocketIO] 命名空间连接错误: " + rest);
                break;
        }
    }

    void HandleEvent(string rest)
    {
        try
        {
            JArray arr = JArray.Parse(rest);
            if (arr.Count < 1) return;
            string ev = (string)arr[0];
            JToken payload = arr.Count > 1 ? arr[1] : null;

            if (_handlers.TryGetValue(ev, out var list))
            {
                foreach (var h in list) h?.Invoke(payload);
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning("[SocketIO] 事件解析失败: " + rest + " | " + e.Message);
        }
    }

    void HandleAck(string rest)
    {
        try
        {
            int idx = rest.IndexOf('[');
            if (idx < 0) return;
            if (!int.TryParse(rest.Substring(0, idx), out int id)) return;

            JToken arg = null;
            JArray arr = JArray.Parse(rest.Substring(idx));
            if (arr.Count > 0) arg = arr[0];

            if (_pendingAcks.TryGetValue(id, out var cb))
            {
                _pendingAcks.Remove(id);
                cb?.Invoke(arg);
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning("[SocketIO] ack 解析失败: " + rest + " | " + e.Message);
        }
    }

    // ============================================================
    // API
    // ============================================================

    public void On(string ev, Action<JToken> handler)
    {
        if (!_handlers.TryGetValue(ev, out var list))
        {
            list = new List<Action<JToken>>();
            _handlers[ev] = list;
        }
        list.Add(handler);
    }

    public void Emit(string ev, object data = null, Action<JToken> ack = null)
    {
        if (_ws == null || !Connected)
        {
            ack?.Invoke(null);
            return;
        }

        if (ack != null)
        {
            int id = ++_ackCounter;
            _pendingAcks[id] = ack;
            string json = data == null ? "{}" : JsonConvert.SerializeObject(data);
            _ws.SendText("42" + id + "[\"" + ev + "\"," + json + "]");
        }
        else
        {
            if (data == null)
                _ws.SendText("42[\"" + ev + "\"]");
            else
                _ws.SendText("42[\"" + ev + "\"," + JsonConvert.SerializeObject(data) + "]");
        }
    }
}
