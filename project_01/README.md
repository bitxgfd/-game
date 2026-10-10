# Paper Safari

Paper Safari 是一个支持 2-4 人联机的网页卡牌游戏。服务器负责房间、牌堆、回合、特殊牌和硬币结果，浏览器通过同源 WebSocket 实时同步牌局。

## 本地运行

```powershell
npm install
npm start
```

打开 `http://127.0.0.1:4174/`，点击右上角的联机按钮即可创建房间。

服务器默认监听 `0.0.0.0`，端口使用 `PORT` 环境变量；本地也可以这样启动：

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "4174"
npm start
```

健康检查地址是 `GET /health`。

## 发布成朋友可访问的网址

项目已经包含 `render.yaml`，可以直接作为 Render Web Service 的部署配置：

1. 将整个项目放到一个 GitHub 仓库。
2. 在 Render 中选择 **New → Blueprint**，连接这个仓库。
3. Render 会读取 `render.yaml`，执行 `npm ci` 和 `npm start`。
4. 部署完成后，用 Render 提供的 `onrender.com` 地址分享给朋友。

网页和 WebSocket 使用同一个网址：打开 HTTPS 页面时，浏览器会自动连接对应的 `wss://` 地址，因此不需要再填写服务器地址。

房主创建房间后，联机大厅会提供“复制链接”按钮。复制出的链接已经包含房间码，朋友打开后会自动填好房间号。

当前房间状态保存在服务器内存中；服务器重启后，正在进行的房间会消失，适合临时和朋友开房游玩。
