// GoldClicker V0 core logic
// Architecture intentionally separated for future iOS port (logic vs UI).

// -----------------------
// CONFIGURATION
// -----------------------
const CONFIG = {
  baseGoldPerClick: 1,
  localStorageKey: 'goldclicker_save_v0',
  autoSaveIntervalMs: 10_000,
  maxOfflineSeconds: 4 * 60 * 60, // cap offline gains to 4 hours
  milestones: [100, 1_000, 10_000, 100_000],
  upgrades: {
    pickaxe: {
      baseCost: 15,
      costMultiplier: 1.15,
      clickIncrement: 1,
    },
    miner: {
      baseCost: 100,
      costMultiplier: 1.17,
      gpsIncrement: 1,
    },
    drill: {
      baseCost: 1200,
      costMultiplier: 1.22,
      gpsIncrement: 10,
    },
  },
};

// -----------------------
// PURE GAME LOGIC
// -----------------------
/**
 * Compute gold per click/second and next costs from state.
 * @param {{pickaxeLevel:number, minerCount:number, drillCount:number}} state
 * @returns {{goldPerClick:number, goldPerSecond:number, nextCosts: Record<string, number>}}
 */
function computeDerived(state) {
  const goldPerClick = CONFIG.baseGoldPerClick + state.pickaxeLevel * CONFIG.upgrades.pickaxe.clickIncrement;
  const goldPerSecond =
    state.minerCount * CONFIG.upgrades.miner.gpsIncrement +
    state.drillCount * CONFIG.upgrades.drill.gpsIncrement;

  const nextCosts = {
    pickaxe: Math.round(CONFIG.upgrades.pickaxe.baseCost * Math.pow(CONFIG.upgrades.pickaxe.costMultiplier, state.pickaxeLevel)),
    miner: Math.round(CONFIG.upgrades.miner.baseCost * Math.pow(CONFIG.upgrades.miner.costMultiplier, state.minerCount)),
    drill: Math.round(CONFIG.upgrades.drill.baseCost * Math.pow(CONFIG.upgrades.drill.costMultiplier, state.drillCount)),
  };

  return { goldPerClick, goldPerSecond, nextCosts };
}

/**
 * Apply an upgrade purchase if the player can afford it.
 * Pure function on the provided state object (mutates state but not the DOM).
 * @param {object} state
 * @param {'pickaxe' | 'miner' | 'drill'} type
 * @returns {{ success: boolean, cost: number, reason?: string }}
 */
function buyUpgrade(state, type) {
  const { nextCosts } = computeDerived(state);
  const cost = nextCosts[type];

  if (state.gold < cost) {
    return { success: false, cost, reason: 'insufficient' };
  }

  state.gold -= cost;

  if (type === 'pickaxe') {
    state.pickaxeLevel += 1;
  } else if (type === 'miner') {
    state.minerCount += 1;
  } else if (type === 'drill') {
    state.drillCount += 1;
  }

  return { success: true, cost };
}

/**
 * Advance the game state by delta time in seconds.
 * @param {object} state
 * @param {number} dtSeconds
 */
function tick(state, dtSeconds) {
  const { goldPerSecond } = computeDerived(state);
  state.gold += goldPerSecond * dtSeconds;
}

// -----------------------
// STATE + STORAGE
// -----------------------
const defaultState = () => ({
  gold: 0,
  pickaxeLevel: 0,
  minerCount: 0,
  drillCount: 0,
  lastSavedAt: Date.now(),
});

/**
 * Load saved state from storage.
 * @returns {ReturnType<typeof defaultState>}
 */
function loadState() {
  const fallback = defaultState();
  const raw = localStorage.getItem(CONFIG.localStorageKey);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return {
      gold: Number(parsed.gold) || 0,
      pickaxeLevel: Number(parsed.pickaxeLevel) || 0,
      minerCount: Number(parsed.minerCount) || 0,
      drillCount: Number(parsed.drillCount) || 0,
      lastSavedAt: Number(parsed.lastSavedAt) || Date.now(),
    };
  } catch (e) {
    console.warn('Save corrompu, nouvelle partie.', e);
    return fallback;
  }
}

/**
 * Persist state in localStorage.
 * @param {object} state
 */
function saveState(state) {
  const payload = {
    gold: state.gold,
    pickaxeLevel: state.pickaxeLevel,
    minerCount: state.minerCount,
    drillCount: state.drillCount,
    lastSavedAt: Date.now(),
  };
  state.lastSavedAt = payload.lastSavedAt;
  localStorage.setItem(CONFIG.localStorageKey, JSON.stringify(payload));
}

/**
 * Grant offline progress capped by CONFIG.maxOfflineSeconds.
 * @param {object} state
 * @returns {number} gained gold
 */
function applyOfflineProgress(state) {
  const now = Date.now();
  const elapsedSeconds = Math.min((now - state.lastSavedAt) / 1000, CONFIG.maxOfflineSeconds);
  const { goldPerSecond } = computeDerived(state);
  const gained = goldPerSecond * elapsedSeconds;
  state.gold += gained;
  state.lastSavedAt = now;
  return gained;
}

// -----------------------
// UI & RENDERING
// -----------------------
const elements = {
  goldDisplay: document.getElementById('goldDisplay'),
  gpcDisplay: document.getElementById('gpcDisplay'),
  gpsDisplay: document.getElementById('gpsDisplay'),
  mineButton: document.getElementById('mineButton'),
  mineArea: document.getElementById('mineArea'),
  saveButton: document.getElementById('saveButton'),
  resetButton: document.getElementById('resetButton'),
  pickaxeCost: document.getElementById('pickaxeCost'),
  pickaxeLevel: document.getElementById('pickaxeLevel'),
  minerCost: document.getElementById('minerCost'),
  minerCount: document.getElementById('minerCount'),
  drillCost: document.getElementById('drillCost'),
  drillCount: document.getElementById('drillCount'),
  achievementList: document.getElementById('achievementList'),
  toastContainer: document.getElementById('toastContainer'),
  shopItems: document.querySelectorAll('.shop-item'),
  buyButtons: document.querySelectorAll('.buy-btn'),
};

const unlockedMilestones = new Set();
let state = loadState();

const numberFormatter = new Intl.NumberFormat('fr-FR');

function formatValue(value) {
  return numberFormatter.format(Math.floor(value));
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function showClickPop(amount) {
  const span = document.createElement('span');
  span.className = 'pop';
  span.textContent = `+${formatValue(amount)}`;
  const randomX = (Math.random() - 0.5) * 60;
  const randomY = (Math.random() - 0.5) * 20;
  span.style.left = `calc(50% + ${randomX}px)`;
  span.style.top = `calc(50% + ${randomY}px)`;
  elements.mineArea.appendChild(span);
  setTimeout(() => span.remove(), 800);
}

function renderAchievements(currentGold) {
  const fragment = document.createDocumentFragment();
  CONFIG.milestones.forEach((milestone) => {
    if (currentGold >= milestone) {
      unlockedMilestones.add(milestone);
    }
  });

  unlockedMilestones.forEach((milestone) => {
    const li = document.createElement('li');
    li.className = 'badge';
    li.textContent = `${formatValue(milestone)} or`;
    fragment.appendChild(li);
  });

  elements.achievementList.innerHTML = '';
  elements.achievementList.appendChild(fragment);
}

function maybeTriggerMilestones(currentGold) {
  CONFIG.milestones.forEach((milestone) => {
    if (currentGold >= milestone && !unlockedMilestones.has(milestone)) {
      unlockedMilestones.add(milestone);
      renderAchievements(currentGold);
      showToast(`Palier atteint : ${formatValue(milestone)} or !`, 'success');
    }
  });
}

function render() {
  const { goldPerClick, goldPerSecond, nextCosts } = computeDerived(state);
  elements.goldDisplay.textContent = formatValue(state.gold);
  elements.gpcDisplay.textContent = formatValue(goldPerClick);
  elements.gpsDisplay.textContent = formatValue(goldPerSecond);

  elements.pickaxeCost.textContent = formatValue(nextCosts.pickaxe);
  elements.pickaxeLevel.textContent = state.pickaxeLevel;
  elements.minerCost.textContent = formatValue(nextCosts.miner);
  elements.minerCount.textContent = state.minerCount;
  elements.drillCost.textContent = formatValue(nextCosts.drill);
  elements.drillCount.textContent = state.drillCount;

  elements.buyButtons.forEach((btn) => {
    const type = btn.dataset.upgrade;
    const cost = nextCosts[type];
    if (state.gold < cost) {
      btn.classList.add('ghost');
    } else {
      btn.classList.remove('ghost');
    }
  });

  renderAchievements(state.gold);
}

function bindEvents() {
  const { mineButton, buyButtons, saveButton, resetButton } = elements;
  mineButton.addEventListener('click', () => {
    const { goldPerClick } = computeDerived(state);
    state.gold += goldPerClick;
    showClickPop(goldPerClick);
    maybeTriggerMilestones(state.gold);
    render();
  });

  buyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.upgrade;
      const result = buyUpgrade(state, type);
      if (result.success) {
        btn.classList.add('purchased');
        setTimeout(() => btn.classList.remove('purchased'), 400);
        maybeTriggerMilestones(state.gold);
        render();
      } else {
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 260);
        showToast("Pas assez d'or.", 'warn');
      }
    });
  });

  saveButton.addEventListener('click', () => {
    saveState(state);
    showToast('Sauvegarde effectuée.', 'success');
  });

  resetButton.addEventListener('click', () => {
    const confirmed = confirm('Réinitialiser la partie ? Les données seront perdues.');
    if (confirmed) {
      state = defaultState();
      unlockedMilestones.clear();
      saveState(state);
      render();
      showToast('Progression réinitialisée.', 'warn');
    }
  });
}

// -----------------------
// LOOP
// -----------------------
function startGame() {
  // Restore and apply offline gains.
  const gained = applyOfflineProgress(state);
  if (gained > 0) {
    showToast(`+${formatValue(gained)} or récupéré hors ligne.`, 'success');
  }

  bindEvents();
  render();

  let last = performance.now();
  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;
    tick(state, dt);
    maybeTriggerMilestones(state.gold);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  setInterval(() => {
    saveState(state);
  }, CONFIG.autoSaveIntervalMs);
}

startGame();
