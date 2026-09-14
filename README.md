# Sohoo Poker · 德州扑克小游戏

参考 sohoo poker 质感的浏览器德州扑克：深绿台面、金色 VIP 装饰、4 人桌（你 + 3 名 AI）。

**在线试玩**：https://heyuxuan-git.github.io/sohoo-poker/

## 玩法

- 无限注德州扑克（NLHE）
- 起始筹码 2000，盲注 10 / 20
- 三家 AI：阿凯（激进）、林姐（紧凶）、老周（均衡）
- 底栏操作：弃牌 / 过牌·跟注 / 加注 / 全下
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
| `css/style.css` | Sohoo 视觉 |

## 部署

仓库：https://github.com/heyuxuan-git/sohoo-poker  
Pages：https://heyuxuan-git.github.io/sohoo-poker/
