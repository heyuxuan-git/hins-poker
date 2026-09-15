# hin's poker · 德州扑克小游戏

**v2.0** — 跑道形深绿台面、宽软包边、角色头像座位、筹码堆下注展示，6 人桌（你 + 5 名 AI）。

**在线试玩**：https://heyuxuan-git.github.io/hins-poker/

## 玩法

- 无限注德州扑克（NLHE）
- 起始筹码 2000，盲注 10 / 20
- 五名 AI：陈哥 / 小美 / 老周 / 林姐 / 阿凯（不同风格）
- 底栏操作：弃牌 / 过牌·跟注 / 加注 / 全下
- 加注可用滑条拖动，也可在右侧数字框手动输入
- 键盘：`F` 弃牌 · `C` 过牌或跟注 · `R` 加注

## 本地运行

任意静态服务器即可（ES Module）：

```bash
cd sohoo-poker
python3 -m http.server 5173
```

打开 <http://localhost:5173>。

## 技术

纯静态前端，无构建步骤：

| 文件 | 职责 |
|------|------|
| `js/deck.js` | 牌组与洗牌 |
| `js/evaluator.js` | 七选五牌力评估 |
| `js/ai.js` | AI 行动决策 |
| `js/game.js` | 牌局状态机 |
| `js/main.js` | 界面渲染与交互 |
| `css/style.css` | 视觉样式 |

## 部署

仓库：https://github.com/heyuxuan-git/hins-poker  
Pages：https://heyuxuan-git.github.io/hins-poker/
