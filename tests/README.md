# 狼人杀性能测试套件

20 个自动化性能测试脚本，用于测试狼人杀服务器的性能、稳定性和正确性。

## 前置条件

```bash
# 在项目根目录安装 socket.io-client
npm install socket.io-client
```

## 启动测试服务器

```bash
# 在项目根目录
npm run dev:server
# 或者
npm start
```

服务器默认运行在 `http://localhost:4000`。

## 运行测试

### 全部测试（20个）
```bash
node tests/run-all.js --all
```

### 快速测试（基础功能）
```bash
node tests/run-all.js --quick
```
包含: 连接、注册、房间创建、密码房间、角色配置

### 游戏流程测试
```bash
node tests/run-all.js --game
```
包含: 完整游戏、双房间、断线重连、投票、夜晚行动、中途退出、阶段转换

### 压力测试
```bash
node tests/run-all.js --stress
```
包含: 并发连接、快速创建销毁、最大容量、耐久性

### 双房间专项测试
```bash
node tests/run-all.js --two-rooms
```
包含: 双房间并行、自动游戏、聊天延迟、大厅更新、语音信令、18人最大容量

### 单个测试
```bash
node tests/01-connection-test.js
```

### 指定服务器
```bash
SERVER_URL=http://your-server:4000 node tests/01-connection-test.js
```

## 测试列表

| # | 测试 | 类别 | 说明 |
|---|------|------|------|
| 01 | 基础连接 | quick | 测试单玩家和多玩家连接性能 |
| 02 | 注册登录 | quick | 测试注册/登录正确性和速率 |
| 03 | 房间创建加入 | quick | 测试房间 CRUD 操作 |
| 04 | 单房间完整游戏 | game | 12人完整游戏流程 |
| 05 | 双房间并行 | two-rooms | 两个12人房间同时游戏 |
| 06 | 双房间自动游戏 | two-rooms | 自动操作推进两个房间 |
| 07 | 并发连接压力 | stress | 50人同时连接 |
| 08 | 快速房间创建 | stress | 30次创建/销毁循环 |
| 09 | 聊天延迟 | two-rooms | 双房间下的消息延迟 |
| 10 | 断线重连 | game | 游戏中断线重连完整流程 |
| 11 | 密码房间 | quick | 密码保护和隐私切换 |
| 12 | 投票性能 | game | 18人同时投票 |
| 13 | 夜晚行动 | game | 夜晚行动并发提交 |
| 14 | 角色配置 | quick | 合法/非法配置验证 |
| 15 | 中途退出 | game | 玩家退出/房主转移 |
| 16 | 大厅列表更新 | two-rooms | 双房间负载下大厅更新 |
| 17 | 语音信令 | two-rooms | WebRTC信令中继延迟 |
| 18 | 最大容量 | stress | 两个18人房间极限测试 |
| 19 | 阶段转换速度 | game | 精确测量阶段转换延迟 |
| 20 | 耐久性 | stress | 连续5局稳定性测试 |

## 关键性能指标

- **连接延迟**: 应 < 500ms/玩家
- **房间操作延迟**: 应 < 100ms
- **聊天延迟**: P50 < 200ms, P95 < 1000ms
- **投票延迟**: < 1000ms (18人同时)
- **阶段转换**: < 3000ms
- **双房间并行**: 完成时间差异 < 60s
