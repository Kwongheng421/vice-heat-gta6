[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kwongheng421/vice-heat-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kwongheng421/vice-heat-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Vice Heat — 开放世界罪恶都市

一款原创的俯视 2D 开放世界犯罪游戏。城市不是规整的网格：错落的路口、一条斜向大道和南岸的环形海岸路，把中央公园、夜市广场、港口、住宅区、玻璃高楼、海滩和木码头连在一起。城里有车流和行人，可以走路，也可以抢车开走；惹了事就会被通缉，从一星到五星，警车、路障、直升机轮番上阵。6 章主线剧情、枪店、医院、修车行、经济系统和 20 个隐藏包裹，全部离线可玩。

## 玩法

你在罪恶都市从跑腿小弟做起，去龙叔的酒吧接任务：先去东边的枪店取枪回来，再偷一辆粉色跑车，接着和鲨鱼帮打一场街头火拼；然后是 150 秒限时送货——开着黄色货车跑遍 4 个送货点；再劫一辆运钞车，拿着钱袋甩掉警察；最后守住银行金库 45 秒，撤到南码头。通关后进入自由漫游，继续收集隐藏包裹。

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

也可以直接用桌面 Chrome 打开 `game/index.html`。无需联网，无外部资源。音效和电台音乐均为 WebAudio 合成。

## 存档

主菜单支持 3 个存档位（当前页面会话内保存），另可导出 / 导入存档 JSON 文件。不使用 localStorage。
