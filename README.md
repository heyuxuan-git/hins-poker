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

## 联机服务

静态站需要连一个 WebSocket 房间服务。本地开发：

```bash
npm install
npm run server          # 默认 :8787
npm start               # 另开终端，静态页 :5173
```

浏览器打开 `http://127.0.0.1:5173` 即可连本机 `:8787`。

### 免费公网部署（Render）

仓库已带 `render.yaml`，可一键建站：

1. 打开 [Render Blueprint](https://dashboard.render.com/blueprints)  
   或直接用按钮（登录 GitHub 后）：

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/heyuxuan-git/hins-poker)

2. 确认服务名（例如 `hins-poker-ws`），等 Build 完成  
3. 得到地址，例如 `https://hins-poker-ws.onrender.com`  
4. 用下面链接开黑（把域名换成你的）：

```
https://heyuxuan-git.github.io/hins-poker/?ws=wss://hins-poker-ws.onrender.com
```

说明：
- `?ws=` 会覆盖默认 WebSocket 地址
- Render **免费层**闲置会休眠，第一次打开可能要等 30 秒左右；和朋友约好前可先自己访问一次 `/health` 唤醒
- 健康检查：`https://你的服务/health` 应返回 `{"ok":true,...}`

手动建 Web Service 也可以：
- Root：仓库根目录
- Build：`npm ci`
- Start：`node server/index.js`
- Health Check Path：`/health`

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
| `server/index.js` | WebSocket 房间转发 |

## 版本

见 [CHANGELOG.md](./CHANGELOG.md) 与 [Releases](https://github.com/heyuxuan-git/hins-poker/releases)。
