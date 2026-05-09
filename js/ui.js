// UI system - handles all user interface elements

class UI {
  constructor(main) {
    this.main = main;

    // Set up UI event listeners
    this.setupUI();
  }

  setupUI() {
    // Unit creation buttons
    document.querySelectorAll('.unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const unitType = btn.dataset.unit;
        if (this.main.game) {
          this.playClickSound();
          const success = this.main.game.createUnit(
            this.main.game.localPlayerId,
            unitType
          );
          if (success) {
            this.updateUnitCounts();
          }
        }
      });
    });

    // Airstrike button
    const airstrikeBtn = document.getElementById('btn-airstrike');
    if (airstrikeBtn) {
      airstrikeBtn.addEventListener('click', () => {
        if (this.main.game && this.main.game.canUseAirstrike) {
          this.playClickSound();
          if (this.main.game.canUseAirstrike(this.main.game.localPlayerId)) {
            this.main.game.startAirstrikeMode();
          }
        }
      });
    }

    // Prevent clicks on panels from affecting the game canvas
    const flagPanel = document.getElementById('flag-panel');
    if (flagPanel) {
      flagPanel.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      flagPanel.addEventListener('mouseup', (e) => {
        e.stopPropagation();
      });
      flagPanel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    const schoolPanel = document.getElementById('school-panel');
    if (schoolPanel) {
      schoolPanel.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      schoolPanel.addEventListener('mouseup', (e) => {
        e.stopPropagation();
      });
      schoolPanel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Build tower button
    const buildTowerBtn = document.getElementById('btn-build-tower');
    if (buildTowerBtn) {
      buildTowerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.main.game) {
          this.playClickSound();
          const selection = this.main.game.selection;
          if (selection.selectedFlag && selection.selectedFlag.ownerId === this.main.game.localPlayerId) {
            const flag = selection.selectedFlag;
            const cost = 20;

            if (!flag.hasTower && !flag.towerBuilding &&
                this.main.game.economy.canAfford(this.main.game.localPlayerId, cost)) {
              this.main.game.economy.spend(this.main.game.localPlayerId, cost);
              flag.buildTower(this.main.game);
              selection.updateFlagPanel();
            }
          }
        }
      });
    }

    // Build sandbags button
    const buildSandbagsBtn = document.getElementById('btn-build-sandbags');
    if (buildSandbagsBtn) {
      buildSandbagsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.main.game) {
          this.playClickSound();
          const selection = this.main.game.selection;
          if (selection.selectedFlag && selection.selectedFlag.ownerId === this.main.game.localPlayerId) {
            const flag = selection.selectedFlag;
            const cost = CONSTANTS.FLAG_SANDBAGS.cost;

            if (!flag.hasSandbags && !flag.sandbagsBuilding &&
                this.main.game.economy.canAfford(this.main.game.localPlayerId, cost)) {
              this.main.game.economy.spend(this.main.game.localPlayerId, cost);
              flag.buildSandbags(this.main.game);
              selection.updateFlagPanel();
            }
          }
        }
      });
    }

    // Glory To Victory button
    const gloryBtn = document.getElementById('btn-glory');
    if (gloryBtn) {
      gloryBtn.addEventListener('click', () => {
        if (this.main.game && this.main.game.canUseGlory) {
          this.playClickSound();
          if (this.main.game.canUseGlory(this.main.game.localPlayerId)) {
            this.main.game.executeGlory(this.main.game.localPlayerId);
          }
        }
      });
    }

    // School upgrade buttons
    document.querySelectorAll('#school-upgrades .upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const upgradeType = btn.dataset.upgrade;
        if (this.main.game) {
          const success = this.main.game.purchaseUpgrade(
            this.main.game.localPlayerId,
            upgradeType,
            true // isSchoolUpgrade
          );
          if (success) {
            this.updateUpgradeButtons();
          }
        }
      });

      // Tooltip
      this.addTooltip(btn, this.getUpgradeTooltip(btn.dataset.upgrade, true));
    });

    // Unit upgrade buttons
    document.querySelectorAll('#unit-upgrades .upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const upgradeType = btn.dataset.upgrade;
        if (this.main.game) {
          const success = this.main.game.purchaseUpgrade(
            this.main.game.localPlayerId,
            upgradeType,
            false // isSchoolUpgrade
          );
          if (success) {
            this.updateUpgradeButtons();
          }
        }
      });

      // Tooltip
      this.addTooltip(btn, this.getUpgradeTooltip(btn.dataset.upgrade, false));
    });

    // Minimap click to move camera
    const minimap = document.getElementById('minimap');
    minimap.addEventListener('click', (e) => {
      if (!this.main.game) return;

      const rect = minimap.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const game = this.main.game;
      const scale = minimap.width / game.mapWidth;
      const worldX = clickX / scale;
      const worldY = clickY / scale;

      game.camera.x = worldX - game.canvas.width / 2 / game.camera.zoom;
      game.camera.y = worldY - game.canvas.height / 2 / game.camera.zoom;
    });
  }

  updateAirstrikeButton() {
    if (!this.main.game) return;

    const btn = document.getElementById('btn-airstrike');
    if (!btn) return;

    const game = this.main.game;
    const playerId = game.localPlayerId;
    const cooldown = game.airstrikeCooldowns[playerId] || 0;
    const cooldownFill = document.getElementById('airstrike-cooldown');

    // Update cooldown bar
    if (cooldownFill) {
      const maxCooldown = CONSTANTS.AIRSTRIKE.cooldown / 1000;
      const percentage = Math.max(0, cooldown / maxCooldown) * 100;
      cooldownFill.style.width = percentage + '%';
    }

    // Update button state
    const canAfford = game.economy.canAfford(playerId, CONSTANTS.AIRSTRIKE.cost);
    const offCooldown = cooldown <= 0;
    btn.disabled = !canAfford || !offCooldown;

    // Visual feedback
    if (!canAfford) {
      btn.classList.add('cant-afford');
    } else {
      btn.classList.remove('cant-afford');
    }
  }

  applySettings(settings) {
    document.getElementById('music-volume').value = settings.musicVolume;
    document.getElementById('sfx-volume').value = settings.sfxVolume;
    document.getElementById('show-grid').checked = settings.showGrid;

    // Apply volume settings to sound system if game exists
    if (this.main.game && this.main.game.sound) {
      this.main.game.sound.setVolume('sfx', settings.sfxVolume / 100);
      this.main.game.sound.setVolume('music', settings.musicVolume / 100);
    }
  }

  playClickSound() {
    if (this.main.game && this.main.game.sound) {
      this.main.game.sound.playClick();
    }
  }

  updateUnitCounts() {
    if (!this.main.game) return;

    const game = this.main.game;
    const playerId = game.localPlayerId;

    document.querySelectorAll('.unit-btn').forEach(btn => {
      const unitType = btn.dataset.unit;
      const config = CONSTANTS.UNIT_TYPES[unitType];

      if (!config) return;

      const currentCount = game.getUnitCount(playerId, unitType);
      const maxCount = config.limit;

      const countEl = btn.querySelector('.unit-count');
      if (countEl) {
        countEl.textContent = `${currentCount}/${maxCount}`;
      }

      // Update button state
      const canAfford = game.economy.canAfford(playerId, config.cost);
      const hasRoom = currentCount < maxCount;
      btn.disabled = !canAfford || !hasRoom;
    });
  }

  updateUpgradeButtons() {
    if (!this.main.game) return;

    const game = this.main.game;
    game.economy.updateUpgradeUI();
  }

  getUpgradeTooltip(upgradeId, isSchoolUpgrade) {
    const upgrades = isSchoolUpgrade ?
      CONSTANTS.SCHOOL_UPGRADES :
      CONSTANTS.UNIT_UPGRADES;

    const upgrade = upgrades[upgradeId];
    if (!upgrade) return null;

    return {
      title: upgrade.name,
      description: upgrade.description,
      cost: upgrade.cost,
      requires: upgrade.requires ?
        CONSTANTS.UNIT_UPGRADES[upgrade.requires]?.name :
        null
    };
  }

  addTooltip(element, tooltipData) {
    if (!tooltipData) return;

    let tooltipEl = null;

    element.addEventListener('mouseenter', (e) => {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'tooltip';

      let html = `<div class="tooltip-title">${tooltipData.title}</div>`;
      html += `<div class="tooltip-desc">${tooltipData.description}</div>`;

      if (tooltipData.requires) {
        html += `<div class="tooltip-desc" style="color: #f88;">Requires: ${tooltipData.requires}</div>`;
      }

      html += `<div class="tooltip-cost">Cost: ${tooltipData.cost} ★</div>`;

      tooltipEl.innerHTML = html;
      document.body.appendChild(tooltipEl);

      this.positionTooltip(tooltipEl, e);
    });

    element.addEventListener('mousemove', (e) => {
      if (tooltipEl) {
        this.positionTooltip(tooltipEl, e);
      }
    });

    element.addEventListener('mouseleave', () => {
      if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
      }
    });
  }

  positionTooltip(tooltipEl, e) {
    const padding = 10;
    let x = e.clientX + padding;
    let y = e.clientY + padding;

    // Keep tooltip on screen
    const rect = tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      x = e.clientX - rect.width - padding;
    }
    if (y + rect.height > window.innerHeight) {
      y = e.clientY - rect.height - padding;
    }

    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
  }

  showMessage(message, duration = 3000) {
    // Create floating message
    const msgEl = document.createElement('div');
    msgEl.className = 'game-message';
    msgEl.textContent = message;
    msgEl.style.cssText = `
      position: fixed;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px 30px;
      border-radius: 8px;
      border: 1px solid #4a90d9;
      font-size: 1.2em;
      z-index: 150;
      animation: fadeInOut ${duration}ms ease;
    `;

    document.body.appendChild(msgEl);

    setTimeout(() => {
      msgEl.remove();
    }, duration);
  }
}

// Add CSS animation for messages
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  }
`;
document.head.appendChild(style);
