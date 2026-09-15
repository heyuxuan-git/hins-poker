# hin's poker · 德州扑克

**v3.0** — 单机练习 + 和朋友远程联机（房间码），空位自动补齐 AI，最多 6 人一桌。

**静态页**：https://heyuxuan-git.github.io/hins-poker/

## 玩法

### 单机
打开页面 →「开始练习」→ 和 5 名 AI 对战。

### 和朋友远程玩（5–6 人）
1. 部署/启动联机服务（见下）后，打开页面
2. 填昵称 → **创建房间**，把 6 位房间码发给朋友
3. 朋友选「加入房间」输入房间码即可
4. **空位会自动补齐 AI**，人齐不齐都能开
5. 房主点「发牌」开始；大家轮流行动

## 联机服务（免绑卡方案）

静态页要连一个 WebSocket 房间服务。**下面两条都不用绑信用卡。**

### 方案 A：本机 + Cloudflare 隧道（最快，约 1 分钟）

1. 本机启动房间服务：

```bash
npm install
npm run server          # 监听 :8787
```

2. 另开终端，用 Cloudflare 免费隧道把端口暴露到公网（**不用注册、不用绑卡**）：

```bash
# macOS
brew install cloudflared
# Windows：去 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ 下载

cloudflared tunnel --url http://127.0.0.1:8787
```

3. 终端会打印类似：

```
https://xxxx-xxxx.trycloudflare.com
```

4. 把这个 **wss** 地址拼进页面，发给朋友：

```
https://heyuxuan-git.github.io/hins-poker/?ws=wss://xxxx-xxxx.trycloudflare.com
```

5. 你自己用同一链接即可。**电脑别休眠、别关掉 `npm run server` 和 cloudflared。**

### 方案 B：Deno Deploy 常驻（不用绑卡、可长期挂着）

1. 打开 https://dash.deno.com → 用 GitHub 登录 → **New Project**
2. 选仓库 `heyuxuan-git/hins-poker`，入口文件填：

```
server/deno.ts
```

3. 部署完成后得到 `https://你的项目.deno.dev`
4. 开黑链接：

```
https://heyuxuan-git.github.io/hins-poker/?ws=wss://你的项目.deno.dev/ws
```

（注意结尾 `/ws`，Deno 版路由在 `/ws`。）

本地也可试 Deno 版：

```bash
deno run --allow-net server/deno.ts
```

### 方案 C：Render（需要绑卡）

若你愿意绑卡，仓库仍带 `render.yaml`，可走 Blueprint。免费层闲置会休眠。

## 本地跑前端

```bash
npm start
# http://localhost:5173
```

## 技术

| 路径 | 职责 |
|------|------|
| `js/game.js` | 牌局状态机（房主权威） |
| `js/ai.js` | AI 策略 |
| `js/net.js` | 房间客户端 + 空位补 AI |
| `js/main.js` | 大厅 / 牌桌渲染 |
| `server/index.js` | WebSocket 房间转发（Node） |
| `server/deno.ts` | 同上（Deno Deploy 免绑卡） |

## 版本

见 [CHANGELOG.md](./CHANGELOG.md) 与 [Releases](https://github.com/heyuxuan-git/hins-poker/releases)。
