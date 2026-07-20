[开发环境搭建指南.md](https://github.com/user-attachments/files/30181899/default.md)
# 🐺 狼人杀在线联机版 — 开发环境搭建指南

> 给一起开发的小伙伴：clone 仓库后用 IDE 打开会报错是正常的，按下面步骤来就行。

---

## 第一步：克隆仓库

```bash
git clone https://github.com/Dio-Brando-cmd/JOJO-star.git
cd JOJO-star
```

---

## 第二步：安装所有依赖

```bash
npm run install:all
```

这会自动安装以下三个位置的依赖：
- 根目录（Electron 打包相关）
- `server/`（游戏服务端）
- `client/`（React 前端 + Capacitor）

---

## 第三步：生成 Android 原生文件（⭐ 重要！）

如果你要开发 Android 端，这一步必须做：

```bash
cd client
npx cap sync
```

这会自动生成以下被 `.gitignore` 忽略的目录/文件：
- `capacitor-cordova-android-plugins/` — Cordova 插件原生代码
- `app/src/main/assets/public/` — 前端资源
- `app/src/main/assets/capacitor.config.json`
- `app/src/main/assets/capacitor.plugins.json`

> ⚠️ 这些文件没有提交到 Git，clone 后必须手动生成，否则 Android Studio / IDEA 会报 Gradle 错误。

---

## 第四步：用 IDE 打开

生成完上面的文件后，用 Android Studio 或 IntelliJ IDEA 打开 `client/android/` 目录。

---

## 日常开发流程

### 前端开发（网页版）
```bash
npm run dev:client
# 浏览器访问 http://localhost:5173
```

### 服务端开发
```bash
npm run dev:server
# 服务端运行在 http://localhost:4000
```

### 同时启动前后端
```bash
npm run dev
```

### 同步前端代码到 Android
前端改完后，运行以下命令把最新页面同步到 Android 项目：
```bash
cd client
npm run build
npx cap sync
```

---

## 常见问题

### Q: IDEA 报错 `capacitor-cordova-android-plugins` 找不到？
**A:** 你没有执行第三步 `npx cap sync`。

### Q: `npm run install:all` 报错？
**A:** 确保 Node.js 版本 ≥ 18，然后分别进入三个目录手动执行 `npm install`。

### Q: GitHub Pages 打不开？
**A:** 这个项目是**全栈应用**（有服务端），GitHub Pages 只能托管静态文件，不支持这个项目。请直接访问 GitHub 仓库页面或本地运行。

---

## 项目结构

```
JOJO-star/
├── client/                  # React 前端 + Capacitor（Android）
│   ├── android/             # Android 原生项目（用 IDEA 打开这里）
│   ├── src/                 # React 源码
│   └── dist/                # 构建产物
├── server/                  # Node.js 游戏服务端
├── electron/                # Electron 桌面端入口
└── deploy/                  # Docker / 服务器部署脚本
```
