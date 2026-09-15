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

### 免费公网部署（推荐 Render / Railway 免费层）

1. 把本仓库推到 GitHub
2. 在 [Render](https://render.com) 新建 **Web Service**
   - Build：`npm install`
   - Start：`npm run server`
   - 环境变量 `PORT` 会自动注入（代码已读 `process.env.PORT`）
3. 得到 `https://xxx.onrender.com` 后，前端访问：

```
https://heyuxuan-git.github.io/hins-poker/?ws=wss://xxx.onrender.com
```

（`?ws=` 会覆盖默认 WebSocket 地址。）

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
