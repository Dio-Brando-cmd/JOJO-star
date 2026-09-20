// ============================================================
// WebSocketRaw.cs — 极简 RFC6455 WebSocket 客户端 (非 TLS)
//
// 自写零依赖实现，供 SocketIO 使用。
//   - TcpClient 直连 (服务端为 ws:// 明文, 无需 SSL)
//   - 客户端帧必须 mask (发送时), 服务端帧通常不 mask (接收时兼容两种)
//   - 只处理文本帧 + ping/pong/close
// 接收在后台线程, 文本帧灌入线程安全队列, 由上层在主线程 Pump。
// ============================================================

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Text;
using System.Threading;

public class WebSocketRaw
{
    TcpClient _tcp;
    NetworkStream _stream;
    Thread _recvThread;
    volatile bool _running;
    readonly object _sendLock = new object();

    public readonly ConcurrentQueue<string> Incoming = new ConcurrentQueue<string>();

    public event Action OnOpen;
    public event Action OnClose;
    public event Action<string> OnError;

    public bool IsConnected => _running && _tcp != null && _tcp.Connected;

    public void Connect(string host, int port, string path)
    {
        try
        {
            _tcp = new TcpClient();
            _tcp.Connect(host, port);
            _stream = _tcp.GetStream();

            string key = Convert.ToBase64String(Guid.NewGuid().ToByteArray());
            string req =
                "GET " + path + " HTTP/1.1\r\n" +
                "Host: " + host + ":" + port + "\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                "Sec-WebSocket-Key: " + key + "\r\n" +
                "Sec-WebSocket-Version: 13\r\n\r\n";

            byte[] reqBytes = Encoding.ASCII.GetBytes(req);
            _stream.Write(reqBytes, 0, reqBytes.Length);
            _stream.Flush();

            string response = ReadHttpHeader();
            if (string.IsNullOrEmpty(response) || !response.Contains("101"))
            {
                OnError?.Invoke("WebSocket 握手失败: " + response);
                CloseSocket();
                return;
            }

            _running = true;
            OnOpen?.Invoke();

            _recvThread = new Thread(ReceiveLoop) { IsBackground = true };
            _recvThread.Start();
        }
        catch (Exception e)
        {
            OnError?.Invoke("WebSocket 连接失败: " + e.Message);
            CloseSocket();
        }
    }

    // ---- 握手响应头读取 ----
    string ReadHttpHeader()
    {
        var sb = new StringBuilder();
        var buf = new byte[1];
        try
        {
            while (true)
            {
                int read = _stream.Read(buf, 0, 1);
                if (read <= 0) break;
                sb.Append((char)buf[0]);
                if (sb.Length >= 4 && sb.ToString(sb.Length - 4, 4) == "\r\n\r\n")
                    break;
            }
        }
        catch { }
        return sb.ToString();
    }

    // ---- 接收循环 (后台线程) ----
    void ReceiveLoop()
    {
        try
        {
            while (_running)
            {
                WSFrame frame = ReadFrame();
                if (frame == null) break;

                switch (frame.Opcode)
                {
                    case 0x1: // text
                        Incoming.Enqueue(frame.Text);
                        break;
                    case 0x9: // ping → pong
                        SendFrame(0xA, frame.Payload);
                        break;
                    case 0xA: // pong (忽略)
                        break;
                    case 0x8: // close
                        _running = false;
                        break;
                }
            }
        }
        catch { /* 连接中断 */ }
        finally
        {
            _running = false;
            OnClose?.Invoke();
        }
    }

    class WSFrame
    {
        public int Opcode;
        public byte[] Payload;
        public string Text => Payload != null ? Encoding.UTF8.GetString(Payload) : null;
    }

    WSFrame ReadFrame()
    {
        int b0 = _stream.ReadByte();
        if (b0 < 0) return null;
        int b1 = _stream.ReadByte();
        if (b1 < 0) return null;

        int opcode = b0 & 0x0F;
        bool masked = (b1 & 0x80) != 0;
        int len = b1 & 0x7F;

        if (len == 126) len = ReadUInt16BE();
        else if (len == 127) len = (int)ReadUInt64BE();

        byte[] mask = null;
        if (masked)
        {
            mask = new byte[4];
            ReadExact(mask, 0, 4);
        }

        byte[] payload = new byte[len];
        ReadExact(payload, 0, len);

        if (masked)
            for (int i = 0; i < len; i++)
                payload[i] = (byte)(payload[i] ^ mask[i % 4]);

        return new WSFrame { Opcode = opcode, Payload = payload };
    }

    void ReadExact(byte[] buf, int offset, int count)
    {
        int read = 0;
        while (read < count)
        {
            int n = _stream.Read(buf, offset + read, count - read);
            if (n <= 0) throw new Exception("socket closed");
            read += n;
        }
    }

    int ReadUInt16BE()
    {
        byte[] b = new byte[2];
        ReadExact(b, 0, 2);
        return (b[0] << 8) | b[1];
    }

    long ReadUInt64BE()
    {
        byte[] b = new byte[8];
        ReadExact(b, 0, 8);
        long v = 0;
        for (int i = 0; i < 8; i++) v = (v << 8) | b[i];
        return v;
    }

    // ---- 发送 ----
    public void SendText(string text)
    {
        SendFrame(0x1, Encoding.UTF8.GetBytes(text ?? ""));
    }

    void SendFrame(int opcode, byte[] payload)
    {
        if (_stream == null || !_running) return;
        lock (_sendLock)
        {
            try
            {
                byte[] mask = new byte[4];
                byte[] rnd = Guid.NewGuid().ToByteArray();
                Array.Copy(rnd, mask, 4);

                int len = payload.Length;
                var header = new List<byte> { (byte)(0x80 | opcode) }; // FIN + opcode
                if (len < 126)
                {
                    header.Add((byte)(0x80 | len)); // MASK + len
                }
                else if (len <= 0xFFFF)
                {
                    header.Add((byte)(0x80 | 126));
                    header.Add((byte)((len >> 8) & 0xFF));
                    header.Add((byte)(len & 0xFF));
                }
                else
                {
                    header.Add((byte)(0x80 | 127));
                    for (int i = 7; i >= 0; i--)
                        header.Add((byte)((len >> (8 * i)) & 0xFF));
                }
                header.AddRange(mask);

                byte[] masked = new byte[len];
                for (int i = 0; i < len; i++)
                    masked[i] = (byte)(payload[i] ^ mask[i % 4]);

                _stream.Write(header.ToArray(), 0, header.Count);
                _stream.Write(masked, 0, masked.Length);
                _stream.Flush();
            }
            catch { }
        }
    }

    public void Close()
    {
        try { if (_stream != null && _running) SendFrame(0x8, new byte[0]); } catch { }
        CloseSocket();
    }

    void CloseSocket()
    {
        _running = false;
        try { _stream?.Close(); } catch { }
        try { _tcp?.Close(); } catch { }
    }
}
