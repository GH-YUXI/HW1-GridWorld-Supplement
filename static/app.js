const ACTIONS = {
  U: { dr: -1, dc: 0, arrow: '↑', label: '上' },
  D: { dr: 1, dc: 0, arrow: '↓', label: '下' },
  L: { dr: 0, dc: -1, arrow: '←', label: '左' },
  R: { dr: 0, dc: 1, arrow: '→', label: '右' },
};

const ACTION_KEYS = Object.keys(ACTIONS);

const MODE_LABELS = {
  start: '起點',
  end: '終點',
  obstacle: '障礙物',
  empty: '清除格子',
};

const POLICY_LABELS = {
  value: 'Value Iteration 最佳策略',
  random: '隨機策略',
};

let n = 5;
let currentMode = 'start';
let gridState = [];
let lastResults = null;
let animationTimer = null;
const RANDOM_STEP_INTERVAL_MS = 650;

const gridEl = document.getElementById('grid');
const messageEl = document.getElementById('message');
const gridSizeEl = document.getElementById('gridSize');
const rewardInputEl = document.getElementById('rewardInput');
const gammaInputEl = document.getElementById('gammaInput');
const infoNEl = document.getElementById('infoN');
const infoStartEl = document.getElementById('infoStart');
const infoEndEl = document.getElementById('infoEnd');
const infoObstacleEl = document.getElementById('infoObstacle');
const infoRewardEl = document.getElementById('infoReward');
const infoGammaEl = document.getElementById('infoGamma');
const infoModeEl = document.getElementById('infoMode');
const infoPolicyEl = document.getElementById('infoPolicy');
const randomStepBtnEl = document.getElementById('randomStepBtn');
const stopAnimationBtnEl = document.getElementById('stopAnimationBtn');
const tracePanelEl = document.getElementById('tracePanel');
const traceStatusEl = document.getElementById('traceStatus');
const traceListEl = document.getElementById('traceList');

function makeEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 'empty'));
}

function stateKey(r, c) {
  return `${r},${c}`;
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function countCells(type) {
  return gridState.flat().filter((cell) => cell === type).length;
}

function obstacleLimit() {
  return n - 2;
}

function updatePlaybackControls(isPlaying) {
  if (randomStepBtnEl) {
    randomStepBtnEl.disabled = isPlaying;
  }
  if (stopAnimationBtnEl) {
    stopAnimationBtnEl.disabled = !isPlaying;
  }
}

function stopRandomPlayback(showMessage = false) {
  const wasPlaying = Boolean(animationTimer);
  if (animationTimer) {
    clearTimeout(animationTimer);
    animationTimer = null;
  }
  updatePlaybackControls(false);
  if (showMessage && wasPlaying) {
    setMessage('\u5df2\u505c\u6b62\u96a8\u6a5f\u7b56\u7565\u9010\u6b65\u64ad\u653e\u3002', 'warning');
  }
}

function clearTracePanel() {
  if (tracePanelEl) {
    tracePanelEl.hidden = true;
  }
  if (traceStatusEl) {
    traceStatusEl.textContent = '';
  }
  if (traceListEl) {
    traceListEl.innerHTML = '';
  }
}

function clearResults() {
  stopRandomPlayback(false);
  lastResults = null;
  clearTracePanel();
}

function setMessage(text, kind = '') {
  messageEl.textContent = text;
  messageEl.className = `message${kind ? ` ${kind}` : ''}`;
}

function updateInfo() {
  infoNEl.textContent = String(n);
  infoStartEl.textContent = `${countCells('start')}/1`;
  infoEndEl.textContent = `${countCells('end')}/1`;
  infoObstacleEl.textContent = `${countCells('obstacle')}/${obstacleLimit()}`;
  infoRewardEl.textContent = rewardInputEl.value;
  infoGammaEl.textContent = gammaInputEl.value;
  infoModeEl.textContent = MODE_LABELS[currentMode];
  infoPolicyEl.textContent = lastResults ? POLICY_LABELS[lastResults.policyType] : '尚未執行';
}

function renderGrid(results = lastResults) {
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
  const pathKeys = new Set(results && Array.isArray(results.pathKeys) ? results.pathKeys : []);
  const currentKey = results && results.currentStep ? results.currentStep.key : null;

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const cellType = gridState[r][c];
      const key = stateKey(r, c);
      const cell = document.createElement('button');
      cell.type = 'button';

      const isPathCell = pathKeys.has(key);
      const isCurrentCell = currentKey === key;
      const policyPathClass = results && results.policyType === 'random' ? ' random-policy-path' : ' optimal-policy-path';
      cell.className = `cell ${cellType}${isPathCell ? ` path-highlight${policyPathClass}` : ''}${isCurrentCell ? ' current-step' : ''}`;
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      const label = document.createElement('div');
      label.className = 'cell-label';
      label.textContent = {
        start: 'S',
        end: 'G',
        obstacle: 'X',
        empty: '',
      }[cellType];
      cell.appendChild(label);

      if (results && cellType !== 'obstacle') {
        const policyArrow = results.policyArrows && results.policyArrows[key];
        if (policyArrow && cellType !== 'end') {
          const arrow = document.createElement('div');
          arrow.className = `cell-policy-arrow ${results.policyType === 'random' ? 'random-policy' : ''}`;
          arrow.title = results.policyActionNames ? results.policyActionNames[key] : '';
          arrow.textContent = policyArrow;
          cell.appendChild(arrow);
        }

        if (isPathCell) {
          const pathBadge = document.createElement('div');
          pathBadge.className = 'cell-path-badge';
          pathBadge.textContent = isCurrentCell && results.currentStep
            ? `\u7b2c ${results.currentStep.step} \u6b65`
            : results.pathLabel || '\u62bd\u6a23\u8def\u5f91';
          cell.appendChild(pathBadge);
        }

        if (isCurrentCell && results.currentStep) {
          const currentBadge = document.createElement('div');
          currentBadge.className = 'cell-current-badge';
          currentBadge.textContent = '\u76ee\u524d\u4f4d\u7f6e';
          cell.appendChild(currentBadge);

          if (results.currentStep.actionArrow) {
            const actionBadge = document.createElement('div');
            actionBadge.className = 'cell-current-action';
            actionBadge.textContent = `\u4e0b\u4e00\u6b65 ${results.currentStep.actionArrow}`;
            cell.appendChild(actionBadge);
          }
        }

        if (Object.prototype.hasOwnProperty.call(results.values, key)) {
          const value = document.createElement('div');
          value.className = 'cell-value';
          value.textContent = `V(s)=${results.values[key].toFixed(2)}`;
          cell.appendChild(value);
        }
      }

      cell.addEventListener('click', onCellClick);
      gridEl.appendChild(cell);
    }
  }

  updateInfo();
}

function clearSingle(type) {
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (gridState[r][c] === type) {
        gridState[r][c] = 'empty';
      }
    }
  }
}

function onCellClick(event) {
  const r = Number(event.currentTarget.dataset.row);
  const c = Number(event.currentTarget.dataset.col);
  clearResults();

  if (currentMode === 'start') {
    clearSingle('start');
    gridState[r][c] = 'start';
  } else if (currentMode === 'end') {
    clearSingle('end');
    gridState[r][c] = 'end';
  } else if (currentMode === 'obstacle') {
    if (gridState[r][c] !== 'obstacle' && countCells('obstacle') >= obstacleLimit()) {
      setMessage(`障礙物最多只能設定 ${obstacleLimit()} 個。`, 'error');
      return;
    }
    gridState[r][c] = gridState[r][c] === 'obstacle' ? 'empty' : 'obstacle';
  } else {
    gridState[r][c] = 'empty';
  }

  setMessage('地圖已更新。');
  renderGrid();
}

function nextState(grid, r, c, action) {
  const { dr, dc } = ACTIONS[action];
  const nr = r + dr;
  const nc = c + dc;

  if (nr < 0 || nr >= n || nc < 0 || nc >= n) {
    return [r, c];
  }
  if (grid[nr][nc] === 'obstacle') {
    return [r, c];
  }
  return [nr, nc];
}

function validateInputs() {
  const startCount = countCells('start');
  const endCount = countCells('end');
  const obstacles = countCells('obstacle');
  const gamma = Number(gammaInputEl.value);
  const reward = Number(rewardInputEl.value);

  if (startCount !== 1 || endCount !== 1) {
    throw new Error('請先設定 1 個起點與 1 個終點。');
  }
  if (obstacles > obstacleLimit()) {
    throw new Error(`障礙物最多只能設定 ${obstacleLimit()} 個。`);
  }
  if (Number.isNaN(gamma) || gamma < 0 || gamma >= 1) {
    throw new Error('折扣因子 γ 必須滿足 0 ≤ γ < 1，不能等於或大於 1。');
  }
  if (Number.isNaN(reward)) {
    throw new Error('步驟獎勵 Reward 必須是數字。');
  }

  return { gamma, reward };
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function findCell(grid, type) {
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (grid[r][c] === type) {
        return [r, c];
      }
    }
  }
  return null;
}

function isGoalReachable(grid) {
  const start = findCell(grid, 'start');
  const end = findCell(grid, 'end');
  if (!start || !end) {
    return false;
  }

  const queue = [start];
  const visited = new Set([stateKey(start[0], start[1])]);

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    if (r === end[0] && c === end[1]) {
      return true;
    }

    ACTION_KEYS.forEach((action) => {
      const [nr, nc] = nextState(grid, r, c, action);
      const key = stateKey(nr, nc);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    });
  }

  return false;
}

function assertGoalReachable(grid) {
  if (!isGoalReachable(grid)) {
    throw new Error('目前起點無法到達終點，請調整障礙物位置後再執行策略計算。');
  }
}

function transitionReward(stepReward) {
  // 每執行一次動作都得到 stepReward，包含進入終點的那一步。
  return stepReward;
}

function getOptimalActions(grid, values, r, c, gamma, stepReward) {
  let bestValue = Number.NEGATIVE_INFINITY;
  let bestActions = [];

  ACTION_KEYS.forEach((action) => {
    const [nr, nc] = nextState(grid, r, c, action);
    const nextKey = stateKey(nr, nc);
    const candidate = transitionReward(stepReward) + gamma * values[nextKey];

    if (candidate > bestValue + 1e-10) {
      bestValue = candidate;
      bestActions = [action];
    } else if (Math.abs(candidate - bestValue) < 1e-10) {
      bestActions.push(action);
    }
  });

  return bestActions;
}

function buildRandomOptimalPath(grid, values, gamma, stepReward) {
  const start = findCell(grid, 'start');
  if (!start) {
    return { pathKeys: [], pathActions: {}, reachedGoal: false };
  }

  const pathKeys = [];
  const pathActions = {};
  const visited = new Set();
  let [r, c] = start;
  const maxSteps = n * n * 4;
  let reachedGoal = false;

  for (let step = 0; step < maxSteps; step += 1) {
    const key = stateKey(r, c);
    pathKeys.push(key);

    if (grid[r][c] === 'end') {
      reachedGoal = true;
      break;
    }

    visited.add(key);
    const optimalActions = getOptimalActions(grid, values, r, c, gamma, stepReward);
    if (!optimalActions.length) {
      break;
    }

    const unvisitedActions = optimalActions.filter((action) => {
      const [nr, nc] = nextState(grid, r, c, action);
      return !visited.has(stateKey(nr, nc));
    });
    const candidateActions = unvisitedActions.length ? unvisitedActions : optimalActions;
    const chosenAction = pickRandom(candidateActions);
    pathActions[key] = chosenAction;

    const [nr, nc] = nextState(grid, r, c, chosenAction);
    if (nr === r && nc === c && visited.has(key)) {
      break;
    }

    r = nr;
    c = nc;
  }

  return { pathKeys, pathActions, reachedGoal };
}


function buildRandomPolicyTrajectory(grid, maxSteps = n * n * 4) {
  const start = findCell(grid, 'start');
  if (!start) {
    return { steps: [], pathKeys: [], pathActions: {}, reachedGoal: false };
  }

  const steps = [];
  const pathActions = {};
  let [r, c] = start;
  let reachedGoal = false;

  for (let step = 0; step <= maxSteps; step += 1) {
    const key = stateKey(r, c);

    if (grid[r][c] === 'end') {
      reachedGoal = true;
      steps.push({
        step,
        key,
        r,
        c,
        status: 'goal',
        message: '\u62b5\u9054\u7d42\u9ede',
      });
      break;
    }

    if (step === maxSteps) {
      steps.push({
        step,
        key,
        r,
        c,
        status: 'limit',
        message: '\u9054\u5230\u6b65\u6578\u4e0a\u9650',
      });
      break;
    }

    const chosenAction = pickRandom(ACTION_KEYS);
    const [nr, nc] = nextState(grid, r, c, chosenAction);
    const nextKey = stateKey(nr, nc);
    const blocked = nr === r && nc === c;
    pathActions[key] = chosenAction;

    steps.push({
      step,
      key,
      r,
      c,
      action: chosenAction,
      actionLabel: ACTIONS[chosenAction].label,
      actionArrow: ACTIONS[chosenAction].arrow,
      nextKey,
      nextR: nr,
      nextC: nc,
      blocked,
      status: blocked ? 'stay' : 'move',
      message: blocked ? '\u649e\u5230\u908a\u754c\u6216\u969c\u7919\u7269\uff0c\u7559\u5728\u539f\u5730' : '\u79fb\u52d5\u5230\u4e0b\u4e00\u683c',
    });

    r = nr;
    c = nc;
  }

  return {
    steps,
    pathKeys: steps.map((step) => step.key),
    pathActions,
    reachedGoal,
  };
}

function buildRandomPolicyPath(grid) {
  const trajectory = buildRandomPolicyTrajectory(grid);
  return {
    pathKeys: trajectory.pathKeys,
    pathActions: trajectory.pathActions,
    reachedGoal: trajectory.reachedGoal,
    trajectorySteps: trajectory.steps,
  };
}

function deriveBestPolicy(grid, values, gamma, stepReward) {
  const policy = {};
  const policyArrows = {};
  const policyActionNames = {};

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const cellType = grid[r][c];
      const key = stateKey(r, c);
      if (cellType === 'obstacle' || cellType === 'end') {
        continue;
      }

      const bestActions = getOptimalActions(grid, values, r, c, gamma, stepReward);
      const chosenAction = pickRandom(bestActions);
      policy[key] = chosenAction;
      policyArrows[key] = ACTIONS[chosenAction].arrow;
      policyActionNames[key] = ACTIONS[chosenAction].label;
    }
  }

  return { policy, policyArrows, policyActionNames };
}

function deriveRandomPolicy(grid) {
  const policy = {};
  const policyArrows = {};
  const policyActionNames = {};

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const cellType = grid[r][c];
      const key = stateKey(r, c);
      if (cellType === 'obstacle' || cellType === 'end') {
        continue;
      }

      policy[key] = [...ACTION_KEYS];
      policyArrows[key] = '🎲';
      policyActionNames[key] = '隨機策略：上、下、左、右各 25%';
    }
  }

  return { policy, policyArrows, policyActionNames };
}

function roundValues(values) {
  const roundedValues = {};
  Object.entries(values).forEach(([key, value]) => {
    roundedValues[key] = Math.round(value * 100) / 100;
  });
  return roundedValues;
}

function initializeValues(grid) {
  const values = {};
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (grid[r][c] !== 'obstacle') {
        values[stateKey(r, c)] = 0;
      }
    }
  }
  return values;
}

function valueIteration(grid, gamma = 0.9, stepReward = -1, theta = 1e-4, maxIterations = 1000) {
  const values = initializeValues(grid);
  let iterations = 0;
  let converged = false;

  for (; iterations < maxIterations; iterations += 1) {
    let delta = 0;
    const updated = { ...values };

    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const cellType = grid[r][c];
        const key = stateKey(r, c);

        if (cellType === 'obstacle') {
          continue;
        }
        if (cellType === 'end') {
          updated[key] = 0;
          continue;
        }

        let bestValue = Number.NEGATIVE_INFINITY;
        ACTION_KEYS.forEach((action) => {
          const [nr, nc] = nextState(grid, r, c, action);
          const nextKey = stateKey(nr, nc);
          const candidate = transitionReward(stepReward) + gamma * values[nextKey];
          if (candidate > bestValue) {
            bestValue = candidate;
          }
        });

        updated[key] = bestValue;
        delta = Math.max(delta, Math.abs(bestValue - values[key]));
      }
    }

    Object.assign(values, updated);
    if (delta < theta) {
      iterations += 1;
      converged = true;
      break;
    }
  }

  const { policy, policyArrows, policyActionNames } = deriveBestPolicy(grid, values, gamma, stepReward);
  const { pathKeys, pathActions, reachedGoal } = buildRandomOptimalPath(grid, values, gamma, stepReward);

  return {
    policyType: 'value',
    values: roundValues(values),
    policy,
    policyArrows,
    policyActionNames,
    bestPolicy: policy,
    bestArrows: policyArrows,
    bestActionNames: policyActionNames,
    pathKeys,
    pathActions,
    pathLabel: '抽樣最佳路徑',
    reachedGoal,
    iterations,
    converged,
  };
}

function randomPolicyEvaluation(grid, gamma = 0.9, stepReward = -1, theta = 1e-4, maxIterations = 1000) {
  const values = initializeValues(grid);
  let iterations = 0;
  let converged = false;

  for (; iterations < maxIterations; iterations += 1) {
    let delta = 0;
    const updated = { ...values };

    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const cellType = grid[r][c];
        const key = stateKey(r, c);

        if (cellType === 'obstacle') {
          continue;
        }
        if (cellType === 'end') {
          updated[key] = 0;
          continue;
        }

        const expectedValue = ACTION_KEYS.reduce((sum, action) => {
          const [nr, nc] = nextState(grid, r, c, action);
          const nextKey = stateKey(nr, nc);
          return sum + transitionReward(stepReward) + gamma * values[nextKey];
        }, 0) / ACTION_KEYS.length;

        updated[key] = expectedValue;
        delta = Math.max(delta, Math.abs(expectedValue - values[key]));
      }
    }

    Object.assign(values, updated);
    if (delta < theta) {
      iterations += 1;
      converged = true;
      break;
    }
  }

  const { policy, policyArrows, policyActionNames } = deriveRandomPolicy(grid);
  const { pathKeys, pathActions, reachedGoal, trajectorySteps } = buildRandomPolicyPath(grid);

  return {
    policyType: 'random',
    values: roundValues(values),
    policy,
    policyArrows,
    policyActionNames,
    pathKeys,
    pathActions,
    pathLabel: '\u96a8\u6a5f\u62bd\u6a23\u8ecc\u8de1',
    trajectorySteps,
    reachedGoal,
    iterations,
    converged,
  };
}


function formatCoord(r, c) {
  return `(${r + 1}, ${c + 1})`;
}

function describeTrajectoryStep(step) {
  if (!step) {
    return '';
  }
  if (step.status === 'goal') {
    return `\u7b2c ${step.step} \u6b65\uff1a\u5230\u9054\u7d42\u9ede ${formatCoord(step.r, step.c)}\u3002`;
  }
  if (step.status === 'limit') {
    return `\u7b2c ${step.step} \u6b65\uff1a\u5728 ${formatCoord(step.r, step.c)} \u9054\u5230\u6b65\u6578\u4e0a\u9650\uff0c\u672c\u6b21\u62bd\u6a23\u672a\u62b5\u9054\u7d42\u9ede\u3002`;
  }
  const next = formatCoord(step.nextR, step.nextC);
  const current = formatCoord(step.r, step.c);
  const blockedText = step.blocked ? '\uff08\u649e\u5230\u908a\u754c\u6216\u969c\u7919\u7269\uff0c\u7559\u5728\u539f\u5730\uff09' : '';
  return `\u7b2c ${step.step} \u6b65\uff1a\u5728 ${current} \u96a8\u6a5f\u9078\u64c7「${step.actionLabel} ${step.actionArrow}」\uff0c\u524d\u5f80 ${next}${blockedText}\u3002`;
}

function updateTracePanel(result) {
  if (!tracePanelEl || !traceStatusEl || !traceListEl) {
    return;
  }
  if (!result || result.policyType !== 'random' || !Array.isArray(result.trajectorySteps)) {
    clearTracePanel();
    return;
  }

  tracePanelEl.hidden = false;
  const finalIndex = result.trajectorySteps.length - 1;
  const stepIndex = typeof result.stepIndex === 'number' ? result.stepIndex : finalIndex;
  const boundedIndex = Math.max(0, Math.min(stepIndex, finalIndex));
  const currentStep = result.trajectorySteps[boundedIndex];
  const totalSteps = Math.max(0, result.trajectorySteps.length - 1);

  traceStatusEl.textContent = result.reachedGoal
    ? `\u9019\u6b21\u62bd\u6a23\u6703\u62b5\u9054\u7d42\u9ede\uff0c\u76ee\u524d\u64ad\u653e\u5230\u7b2c ${currentStep.step} \u6b65\uff0c\u5171 ${totalSteps} \u6b65\u3002`
    : `\u9019\u6b21\u62bd\u6a23\u5728\u6b65\u6578\u4e0a\u9650\u5167\u672a\u62b5\u9054\u7d42\u9ede\uff0c\u76ee\u524d\u64ad\u653e\u5230\u7b2c ${currentStep.step} \u6b65\uff0c\u5171 ${totalSteps} \u6b65\u3002`;

  traceListEl.innerHTML = '';
  const visibleSteps = result.trajectorySteps.slice(0, boundedIndex + 1);
  const recentSteps = visibleSteps.slice(-12);
  recentSteps.forEach((step) => {
    const item = document.createElement('li');
    item.textContent = describeTrajectoryStep(step);
    if (step === currentStep) {
      item.className = 'active-trace-step';
    }
    traceListEl.appendChild(item);
  });
}

function runAnimatedRandomPolicy() {
  try {
    stopRandomPlayback(false);
    const { gamma, reward } = validateInputs();
    const workingGrid = cloneGrid(gridState);
    assertGoalReachable(workingGrid);

    const result = randomPolicyEvaluation(workingGrid, gamma, reward);
    result.isPlayback = true;
    result.stepIndex = -1;
    result.pathKeys = [];
    result.currentStep = null;
    result.pathLabel = '\u5df2\u8d70\u904e';

    lastResults = result;
    renderGrid(result);
    clearTracePanel();
    updatePlaybackControls(true);
    setMessage(`\u5df2\u5b8c\u6210\u96a8\u6a5f\u7b56\u7565\u50f9\u503c\u8a55\u4f30\uff0c\u958b\u59cb\u9010\u6b65\u64ad\u653e\u4e00\u6b21\u96a8\u6a5f\u62bd\u6a23\u8ecc\u8de1\u3002\u672c\u6b21\u6700\u591a\u6a21\u64ec ${n * n * 4} \u6b65\u3002`, 'success');

    const advance = () => {
      result.stepIndex += 1;
      const step = result.trajectorySteps[result.stepIndex];
      if (!step) {
        stopRandomPlayback(false);
        return;
      }

      result.currentStep = step;
      result.pathKeys = result.trajectorySteps.slice(0, result.stepIndex + 1).map((item) => item.key);
      renderGrid(result);
      updateTracePanel(result);

      if (result.stepIndex >= result.trajectorySteps.length - 1) {
        animationTimer = null;
        updatePlaybackControls(false);
        const finalMessage = result.reachedGoal
          ? `\u96a8\u6a5f\u7b56\u7565\u9010\u6b65\u64ad\u653e\u5b8c\u6210\uff1a\u5df2\u65bc\u7b2c ${step.step} \u6b65\u62b5\u9054\u7d42\u9ede\u3002`
          : `\u96a8\u6a5f\u7b56\u7565\u9010\u6b65\u64ad\u653e\u5b8c\u6210\uff1a\u5230\u7b2c ${step.step} \u6b65\u4ecd\u672a\u62b5\u9054\u7d42\u9ede\uff0c\u9019\u53ea\u4ee3\u8868\u672c\u6b21\u96a8\u6a5f\u62bd\u6a23\u6c92\u6709\u6210\u529f\u3002`;
        setMessage(finalMessage, result.reachedGoal ? 'success' : 'warning');
        return;
      }

      animationTimer = setTimeout(advance, RANDOM_STEP_INTERVAL_MS);
    };

    animationTimer = setTimeout(advance, 250);
  } catch (error) {
    stopRandomPlayback(false);
    setMessage(error.message || '\u57f7\u884c\u5931\u6557\u3002', 'error');
  }
}

function loadDemoMap() {
  n = 5;
  gridSizeEl.value = '5';
  gridState = makeEmptyGrid(n);
  gridState[0][0] = 'start';
  gridState[4][4] = 'end';
  gridState[1][1] = 'obstacle';
  gridState[1][3] = 'obstacle';
  gridState[3][1] = 'obstacle';
  rewardInputEl.value = '-1';
  gammaInputEl.value = '0.9';
  clearResults();
  renderGrid();
  setMessage('已載入示範地圖，可以執行 Value Iteration 或隨機策略。');
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  updateInfo();
}

function runStrategy(strategyName) {
  stopRandomPlayback(false);
  clearTracePanel();
  try {
    const { gamma, reward } = validateInputs();
    const workingGrid = cloneGrid(gridState);
    assertGoalReachable(workingGrid);

    const result = strategyName === 'random'
      ? randomPolicyEvaluation(workingGrid, gamma, reward)
      : valueIteration(workingGrid, gamma, reward);

    lastResults = result;
    renderGrid(result);
    updateTracePanel(result);

    const convergenceMessage = result.converged
      ? `共迭代 ${result.iterations} 次並達到收斂門檻`
      : `已達最大迭代次數 ${result.iterations} 次，尚未達到收斂門檻`;
    const reachMessage = result.reachedGoal
      ? '\u62bd\u6a23\u8ecc\u8de1\u53ef\u5230\u9054\u7d42\u9ede'
      : '\u62bd\u6a23\u8ecc\u8de1\u672c\u6b21\u672a\u5230\u9054\u7d42\u9ede';

    setMessage(
      `已完成 ${POLICY_LABELS[result.policyType]}，${convergenceMessage}，${reachMessage}。Reward=${reward}，γ=${gamma}。`,
      result.converged ? 'success' : 'warning',
    );
  } catch (error) {
    setMessage(error.message || '執行失敗。', 'error');
  }
}

document.getElementById('buildGridBtn').addEventListener('click', () => {
  n = Number(gridSizeEl.value);
  gridState = makeEmptyGrid(n);
  clearResults();
  renderGrid();
  setMessage('新網格已建立。');
});

document.getElementById('resetGridBtn').addEventListener('click', () => {
  gridState = makeEmptyGrid(n);
  clearResults();
  renderGrid();
  setMessage('地圖設定已清空。');
});

document.getElementById('runBtn').addEventListener('click', () => runStrategy('value'));
document.getElementById('randomPolicyBtn').addEventListener('click', () => runStrategy('random'));
if (randomStepBtnEl) {
  randomStepBtnEl.addEventListener('click', runAnimatedRandomPolicy);
}
if (stopAnimationBtnEl) {
  stopAnimationBtnEl.addEventListener('click', () => stopRandomPlayback(true));
}
document.getElementById('demoBtn').addEventListener('click', loadDemoMap);

rewardInputEl.addEventListener('input', updateInfo);
gammaInputEl.addEventListener('input', updateInfo);

document.querySelectorAll('.mode-btn').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

gridState = makeEmptyGrid(n);
renderGrid();
setMode('start');
updatePlaybackControls(false);

if (typeof window !== 'undefined') {
  window.GridWorldTestHooks = {
    makeEmptyGrid,
    cloneGrid,
    stateKey,
    nextState,
    validateInputs,
    isGoalReachable,
    valueIteration,
    randomPolicyEvaluation,
    buildRandomPolicyTrajectory,
    runAnimatedRandomPolicy,
    stopRandomPlayback,
    loadDemoMap,
    runStrategy,
  };
}
