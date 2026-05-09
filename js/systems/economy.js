// Economy system - handles reputation (resource) and upgrades

class EconomySystem {
  constructor(game) {
    this.game = game;

    // Per-player economy state
    this.players = [];
  }

  initialize(playerCount) {
    this.players = [];

    for (let i = 0; i < playerCount; i++) {
      this.players.push({
        reputation: CONSTANTS.STARTING_REPUTATION,
        incomeMultiplier: 1,
        upgrades: new Set(),
        flagsOwned: 0
      });
    }
  }

  loadState(state) {
    this.players = state.players.map(p => ({
      ...p,
      upgrades: new Set(p.upgrades)
    }));
  }

  update(dt) {
    // Generate income for each player
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      const school = this.game.schools[i];

      // Only generate income if school is alive
      if (school && school.health > 0) {
        const income = this.calculateIncome(i);
        player.reputation += income * dt;
      }
    }

    // Throttle UI updates to avoid interfering with button clicks
    // Update UI only when reputation changes by at least 1 or every 500ms
    if (!this.lastUIUpdate) this.lastUIUpdate = 0;
    if (!this.lastReputation) this.lastReputation = 0;

    this.lastUIUpdate += dt * 1000;
    const currentRep = Math.floor(this.players[this.game.localPlayerId]?.reputation || 0);

    if (this.lastUIUpdate >= 500 || currentRep !== this.lastReputation) {
      this.updateUI();
      this.lastUIUpdate = 0;
      this.lastReputation = currentRep;
    }
  }

  calculateIncome(playerId) {
    const player = this.players[playerId];
    if (!player) return 0;

    // Base income
    let income = CONSTANTS.BASE_REPUTATION_INCOME;

    // Flag income
    const ownedFlags = this.game.flags.filter(f => f.ownerId === playerId).length;
    income += ownedFlags * CONSTANTS.FLAG_REPUTATION_INCOME;

    // Apply multiplier (from Prestige upgrade)
    income *= player.incomeMultiplier;

    return income;
  }

  getReputation(playerId) {
    const player = this.players[playerId];
    return player ? Math.floor(player.reputation) : 0;
  }

  canAfford(playerId, cost) {
    const player = this.players[playerId];
    return player && player.reputation >= cost;
  }

  spend(playerId, amount) {
    const player = this.players[playerId];
    if (player) {
      player.reputation -= amount;
      this.updateUI();
    }
  }

  addReputation(playerId, amount) {
    const player = this.players[playerId];
    if (player) {
      player.reputation += amount;
      this.updateUI();
    }
  }

  hasUpgrade(playerId, upgradeId) {
    const player = this.players[playerId];
    return player && player.upgrades.has(upgradeId);
  }

  addUpgrade(playerId, upgradeId) {
    const player = this.players[playerId];
    if (player) {
      player.upgrades.add(upgradeId);
      this.updateUpgradeUI();
    }
  }

  setIncomeMultiplier(playerId, multiplier) {
    const player = this.players[playerId];
    if (player) {
      player.incomeMultiplier = multiplier;
    }
  }

  updateFlagOwnership(flagId, newOwnerId) {
    // This is called when a flag is captured
    // Income recalculation happens automatically in update()
  }

  updateUI() {
    if (this.game.localPlayerId === undefined) return;

    const player = this.players[this.game.localPlayerId];
    if (!player) return;

    // Update reputation display
    const repEl = document.getElementById('reputation-count');
    if (repEl) {
      repEl.textContent = Math.floor(player.reputation);
    }

    // Update income rate
    const income = this.calculateIncome(this.game.localPlayerId);
    const incomeEl = document.getElementById('income-rate');
    if (incomeEl) {
      incomeEl.textContent = income.toFixed(1);
    }

    // Update school health
    const school = this.game.schools[this.game.localPlayerId];
    if (school) {
      const healthFill = document.getElementById('school-health-fill');
      const healthText = document.getElementById('school-health-text');

      if (healthFill) {
        const percent = (school.health / school.maxHealth) * 100;
        healthFill.style.width = percent + '%';
      }

      if (healthText) {
        healthText.textContent = `${Math.ceil(school.health)}/${school.maxHealth}`;
      }
    }

    // Update unit buttons (cost affordability)
    this.updateUnitButtons();

    // Update upgrade buttons
    this.updateUpgradeUI();
  }

  updateUnitButtons() {
    const player = this.players[this.game.localPlayerId];
    if (!player) return;

    const unitButtons = document.querySelectorAll('.unit-btn');

    unitButtons.forEach(btn => {
      const unitType = btn.dataset.unit;
      const config = CONSTANTS.UNIT_TYPES[unitType];

      if (!config) return;

      const cost = config.cost;
      const currentCount = this.game.getUnitCount(this.game.localPlayerId, unitType);
      const maxCount = config.limit;

      // Update count display
      const countEl = btn.querySelector('.unit-count');
      if (countEl) {
        countEl.textContent = `${currentCount}/${maxCount}`;
      }

      // Check if unit requires upgrade
      const requiresUpgrade = config.requiresUpgrade;
      const hasRequiredUpgrade = !requiresUpgrade || player.upgrades.has(requiresUpgrade);

      // Update enabled state
      const canAfford = player.reputation >= cost;
      const hasRoom = currentCount < maxCount;

      if (!hasRequiredUpgrade) {
        btn.classList.add('locked');
        btn.disabled = true;
      } else {
        btn.classList.remove('locked');
        btn.disabled = !canAfford || !hasRoom;
      }
    });
  }

  updateUpgradeUI() {
    const player = this.players[this.game.localPlayerId];
    if (!player) return;

    // School upgrades
    document.querySelectorAll('#school-upgrades .upgrade-btn').forEach(btn => {
      const upgradeId = btn.dataset.upgrade;
      const upgrade = CONSTANTS.SCHOOL_UPGRADES[upgradeId];

      if (!upgrade) return;

      if (player.upgrades.has(upgradeId)) {
        btn.classList.add('purchased');
        btn.disabled = true;
      } else {
        btn.classList.remove('purchased');
        btn.disabled = !this.canAfford(this.game.localPlayerId, upgrade.cost);
      }
    });

    // Unit upgrades
    document.querySelectorAll('#unit-upgrades .upgrade-btn').forEach(btn => {
      const upgradeId = btn.dataset.upgrade;
      const upgrade = CONSTANTS.UNIT_UPGRADES[upgradeId];

      if (!upgrade) return;

      const hasPurchased = player.upgrades.has(upgradeId);
      const hasRequirement = !upgrade.requires || player.upgrades.has(upgrade.requires);

      if (hasPurchased) {
        btn.classList.add('purchased');
        btn.classList.remove('locked');
        btn.disabled = true;
      } else if (!hasRequirement) {
        btn.classList.add('locked');
        btn.classList.remove('purchased');
        btn.disabled = true;
      } else {
        btn.classList.remove('locked', 'purchased');
        btn.disabled = !this.canAfford(this.game.localPlayerId, upgrade.cost);
      }
    });
  }

  serialize() {
    return {
      players: this.players.map(p => ({
        reputation: p.reputation,
        incomeMultiplier: p.incomeMultiplier,
        upgrades: Array.from(p.upgrades),
        flagsOwned: p.flagsOwned
      }))
    };
  }
}
