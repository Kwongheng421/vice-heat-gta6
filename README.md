[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kwongheng421/vice-heat-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kwongheng421/vice-heat-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Heat — 开放世界罪恶都市

原创 top-down 2D 开放世界犯罪游戏：非网格城市、开车抢车、1–5 星通缉、6 章主线剧情、商店经济、20 个隐藏包裹，全部离线可玩。

## 玩法

你在罪恶都市从跑腿小弟做起，帮龙叔完成 6 章任务：取枪、偷粉色跑车、街头火拼、150 秒限时送货、运钞车劫案、银行金库坚守 45 秒，最后撤到南码头。通关后自由漫游，收集隐藏包裹。

## 操作

- WASD / 方向键：走路 / 开车
- 鼠标瞄准，左键开火
- E：上车 / 下车 / 抢车 / 对话 / 买东西 / 接任务
- Shift：疾跑 · 空格：手刹 · 1/2/3/4：切换武器（拳头 / 手枪 / 冲锋枪 / 霰弹枪）
- Esc / P：暂停 · H：喇叭 · M：电台（合成音乐）

## 离线游玩

```sh
node serve.ts
# 打开 http://localhost:8080
```

或直接用桌面 Chrome 打开 `game/index.html`。无需联网，无外部资源。

## 存档

主菜单支持 3 个存档位（当前页面会话内保存），另可导出 / 导入存档 JSON 文件。不使用 localStorage。
