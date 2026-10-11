# Paper Safari

Paper Safari 是一个支持 2-4 人联机的网页卡牌游戏。服务器负责房间、牌堆、回合、特殊牌和硬币结果，浏览器通过同源 WebSocket 实时同步牌局。

下面的部署教程按照“GitHub 保存代码 + Render 运行服务器”的方式编写，**不需要使用 Blueprint**，适合第一次部署。

## 一、先在本地确认项目可以运行

需要准备：

- 一个 GitHub 账号
- 一个 Render 账号
- 电脑上安装 Node.js 20 或更高版本

在项目目录打开终端，执行：

```powershell
npm install
npm start
```

看到服务器启动后，打开 <http://127.0.0.1:4174/>。点击右上角的联机按钮，可以创建本地房间。

停止服务器可以在终端按 `Ctrl + C`。

健康检查地址是：

```text
http://127.0.0.1:4174/health
```

## 二、把项目上传到 GitHub

如果还没有仓库，可以按下面的顺序操作：

1. 登录 GitHub，点击 **New repository**。
2. 仓库名称可以填写 `paper-safari-online`。
3. 选择 Public 或 Private 都可以。
4. 创建仓库时不要勾选自动生成 README、`.gitignore` 或 License，避免覆盖项目文件。
5. 进入新仓库，点击 **Add file → Upload files**。
6. 把项目文件上传进去，然后点击 **Commit changes**。

需要上传的主要文件包括：

```text
app.js
index.html
online.js
package.json
package-lock.json
server-game.js
server.js
styles.css
```

以下内容不需要上传：

```text
node_modules/
.git/
```

`render.yaml` 可以保留在仓库中，但本教程使用手动创建 Web Service，不会依赖它。

## 三、在 Render 创建网站服务

1. 登录 Render，选择 **New → Web Service**。
2. 连接 GitHub，并选择刚才的 `paper-safari-online` 仓库。
3. 按下面填写配置：

   ```text
   Name: paper-safari-online
   Branch: main
   Runtime: Node
   Build Command: npm ci
   Start Command: npm start
   Instance Type: Free
   Health Check Path: /health
   ```

   `Root Directory` 要根据 GitHub 仓库里的文件位置填写：

   - 如果 `package.json`、`package-lock.json`、`server.js` 直接位于仓库最外层，`Root Directory` 留空。
   - 如果这些文件位于 `project_01` 文件夹内，填写 `project_01`。

   你的仓库如果是通过上传整个项目文件夹建立的，通常属于第二种情况。此时 Render 的配置应为：

   ```text
   Root Directory: project_01
   ```

4. 点击 **Create Web Service**。
5. 等待部署状态变成 `Live`。
6. 打开 Render 页面顶部显示的地址，格式类似：

   ```text
   https://paper-safari-online.onrender.com
   ```

项目已经默认监听 `0.0.0.0`，并且会自动使用 Render 提供的 `PORT` 端口，因此不需要手动填写端口，也不需要修改代码。

## 四、测试联机

1. 用 Render 提供的 HTTPS 地址打开游戏。
2. 点击右上角的联机按钮。
3. 创建房间并复制邀请链接。
4. 把邀请链接发给朋友。
5. 朋友打开链接后，会自动填好房间号。

网页和 WebSocket 使用同一个网址。打开 HTTPS 页面时，浏览器会自动使用对应的 `wss://` 安全连接，不需要另外填写服务器地址。

请不要使用本地的 `file:///.../index.html` 地址测试公网联机；公网测试必须打开 Render 的 `https://...onrender.com` 地址。

## 五、以后如何更新游戏

修改代码后：

1. 在 GitHub 仓库中上传修改后的文件并提交。
2. Render 会检测到新的提交并自动重新部署。
3. 等待状态再次变成 `Live`，刷新游戏页面即可。

如果 Render 没有自动部署，可以在服务页面点击 **Manual Deploy → Deploy latest commit**。

## 常见问题

### 部署失败

先检查以下内容：

- `package.json` 和 `package-lock.json` 已上传。
- Build Command 是 `npm ci`。
- Start Command 是 `npm start`。
- 没有上传 `node_modules`，也没有把项目套在多余的子文件夹里。

### 页面能打开，但朋友无法加入

- 确认你和朋友打开的是 Render 的 `https://` 地址。
- 不要使用 `localhost`、`127.0.0.1` 或本地 `file:///` 地址。
- 确认 Render 服务状态是 `Live`。
- 如果服务刚刚休眠，第一次打开可能需要等待一会儿。

### 房间突然消失

当前房间状态保存在服务器内存中。服务重启、重新部署或实例休眠后，正在进行的房间可能会消失。这一版本适合临时和朋友开房游玩，暂时没有保存长期房间数据。

## 项目结构

```text
server.js       HTTP 静态文件服务和 WebSocket 房间
server-game.js  服务端权威牌局逻辑
app.js          单机逻辑和页面渲染
online.js       联机大厅和 WebSocket 客户端
index.html      页面结构
styles.css      页面样式
```
