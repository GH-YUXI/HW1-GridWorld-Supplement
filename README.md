# GridWorld Value Iteration + Random Policy（GitHub Pages 版）

這是一個靜態版 GridWorld 專案，可直接部署到 GitHub Pages。

![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![License](https://img.shields.io/badge/Usage-Educational-green)

## Live Demo

原始專案 GitHub Pages: https://GH-YUXI.github.io/HW1-GridWorld/

![Homepage Screenshot](homepage.png)

## 特色

- 使用 Value Iteration 計算最佳狀態價值 `V(s)`。
- 根據收斂後的 `V(s)` 萃取最佳策略箭頭，並抽樣一條最佳策略路徑。
- 新增隨機策略功能：以「上、下、左、右各 25%」進行 Policy Evaluation，計算隨機策略下的 `V(s)`。
- 新增「逐步播放隨機策略」：逐格顯示目前位置、本步隨機選到的方向與近期移動紀錄。
- 若起點無法到達終點，會先提示錯誤，不會執行策略計算。
- 為確保折扣型 MDP 的收斂性，折扣因子 `γ` 必須滿足 `0 ≤ γ < 1`。
- 步驟獎勵 `Reward` 會套用在每一次動作，包含進入終點的那一步；終點本身固定為 `V(goal)=0`。
- 可設定：
  - `n x n` Grid（5 到 9）
  - 起點 / 終點 / 障礙物
  - 步驟獎勵 `Reward`
  - 折扣因子 `γ`

## 檔案結構

```text
.
├── index.html
├── README.md
├── homepage.png
├── docs
│   └── VALUE_ITERATION_EXPLAINED.md
├── static
│   ├── app.js
│   └── style.css
└── tests
    └── smoke-test.js
```

## 本機測試

直接用瀏覽器開 `index.html` 即可，或用任何靜態伺服器開啟：

```bash
python3 -m http.server 8000
```

再開啟：

```text
http://localhost:8000
```

也可執行基本 smoke test：

```bash
node --check static/app.js
node tests/smoke-test.js
```

## 核心公式

### Value Iteration

```text
V(s) = max_a [ R(s,a,s') + γV(s') ]
```

### 隨機策略 Policy Evaluation

```text
Vπ(s) = Σ_a π(a|s)[ R(s,a,s') + γVπ(s') ]
```

在本專案中，隨機策略為四個方向等機率：

```text
π(a|s) = 0.25, a ∈ {上, 下, 左, 右}
```
