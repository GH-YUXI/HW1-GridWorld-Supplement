const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeElement(id = '') {
  return {
    id,
    value: '',
    textContent: '',
    className: '',
    innerHTML: '',
    type: '',
    title: '',
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    children: [],
    classList: {
      toggle() {},
      add() {},
      remove() {},
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    setAttribute() {},
  };
}

const elements = new Map();
[
  'grid',
  'message',
  'gridSize',
  'rewardInput',
  'gammaInput',
  'infoN',
  'infoStart',
  'infoEnd',
  'infoObstacle',
  'infoReward',
  'infoGamma',
  'infoMode',
  'infoPolicy',
  'buildGridBtn',
  'resetGridBtn',
  'runBtn',
  'randomPolicyBtn',
  'randomStepBtn',
  'stopAnimationBtn',
  'tracePanel',
  'traceStatus',
  'traceList',
  'demoBtn',
].forEach((id) => elements.set(id, makeElement(id)));

elements.get('gridSize').value = '5';
elements.get('rewardInput').value = '-1';
elements.get('gammaInput').value = '0.9';

const modeButtons = ['start', 'end', 'obstacle', 'empty'].map((mode) => {
  const el = makeElement(`mode-${mode}`);
  el.dataset.mode = mode;
  return el;
});

const timerQueue = [];

const context = {
  console,
  window: {},
  timerQueue,
  setTimeout(callback) {
    timerQueue.push(callback);
    return timerQueue.length;
  },
  clearTimeout() {},
  document: {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, makeElement(id));
      }
      return elements.get(id);
    },
    createElement(tagName) {
      const el = makeElement(tagName);
      el.tagName = tagName.toUpperCase();
      return el;
    },
    querySelectorAll(selector) {
      if (selector === '.mode-btn') {
        return modeButtons;
      }
      return [];
    },
  },
};

vm.createContext(context);
const appPath = path.join(__dirname, '..', 'static', 'app.js');
const appCode = fs.readFileSync(appPath, 'utf8');
vm.runInContext(appCode, context, { filename: appPath });

vm.runInContext(`
  loadDemoMap();

  const viResult = valueIteration(cloneGrid(gridState), Number(gammaInputEl.value), Number(rewardInputEl.value));
  if (!viResult.converged) {
    throw new Error('Value Iteration did not converge on demo map.');
  }
  if (!viResult.reachedGoal) {
    throw new Error('Value Iteration sampled path should reach the goal on demo map.');
  }
  if (!viResult.policyArrows['0,0']) {
    throw new Error('Value Iteration policy arrow missing for start state.');
  }
  if (viResult.values['3,4'] !== -1) {
    throw new Error('Step reward should apply when entering goal; expected V(3,4) = -1.');
  }
  renderGrid(viResult);

  const randomResult = randomPolicyEvaluation(cloneGrid(gridState), Number(gammaInputEl.value), Number(rewardInputEl.value));
  if (!randomResult.converged) {
    throw new Error('Random policy evaluation did not converge on demo map.');
  }
  if (randomResult.policyType !== 'random') {
    throw new Error('Random policy result has wrong policyType.');
  }
  if (randomResult.policyArrows['0,0'] !== '🎲') {
    throw new Error('Random policy marker missing for start state.');
  }
  renderGrid(randomResult);
  if (!Array.isArray(randomResult.trajectorySteps) || randomResult.trajectorySteps.length === 0) {
    throw new Error('Random policy trajectory should include step-by-step records.');
  }
  const trajectory = buildRandomPolicyTrajectory(cloneGrid(gridState), 10);
  if (!trajectory.steps[0] || trajectory.steps[0].key !== '0,0') {
    throw new Error('Random policy trajectory should start from the start state.');
  }
  updateTracePanel({ ...randomResult, stepIndex: 0, pathKeys: [randomResult.trajectorySteps[0].key], currentStep: randomResult.trajectorySteps[0] });
  if (tracePanelEl.hidden || traceListEl.children.length === 0) {
    throw new Error('Trace panel should render step-by-step records.');
  }
  runAnimatedRandomPolicy();
  let safety = 200;
  while (timerQueue.length && safety > 0) {
    const callback = timerQueue.shift();
    callback();
    safety -= 1;
  }
  if (safety <= 0) {
    throw new Error('Animated random policy playback did not finish.');
  }
  if (!stopAnimationBtnEl.disabled || randomStepBtnEl.disabled) {
    throw new Error('Playback controls should reset after animation.');
  }

  gammaInputEl.value = '1';
  let gammaRejected = false;
  try {
    validateInputs();
  } catch (error) {
    gammaRejected = /γ/.test(error.message);
  }
  if (!gammaRejected) {
    throw new Error('gamma = 1 should be rejected.');
  }

  gammaInputEl.value = '0.9';
  n = 5;
  gridSizeEl.value = '5';
  gridState = makeEmptyGrid(n);
  gridState[4][4] = 'start';
  gridState[0][0] = 'end';
  gridState[0][1] = 'obstacle';
  gridState[1][0] = 'obstacle';
  if (isGoalReachable(gridState)) {
    throw new Error('Unreachable goal should be detected.');
  }
`, context);

console.log('Smoke tests passed.');
