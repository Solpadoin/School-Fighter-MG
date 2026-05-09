// Selection system - handles unit selection (click and drag box)

class SelectionSystem {
  constructor(game) {
    this.game = game;

    // Selection state
    this.selectedUnits = [];
    this.selectedFlag = null;
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;

    // Double-click tracking
    this.lastClickTime = 0;
    this.lastClickX = 0;
    this.lastClickY = 0;
    this.doubleClickThreshold = 300; // ms
  }

  startSelection(worldX, worldY) {
    this.isSelecting = true;
    this.startX = worldX;
    this.startY = worldY;
    this.endX = worldX;
    this.endY = worldY;

    // Check for double-click
    const now = Date.now();
    const timeDiff = now - this.lastClickTime;
    const distDiff = Math.hypot(worldX - this.lastClickX, worldY - this.lastClickY);

    if (timeDiff < this.doubleClickThreshold && distDiff < 20) {
      // Double-click - select all units of same type on screen
      this.handleDoubleClick(worldX, worldY);
      this.lastClickTime = 0;
      return;
    }

    this.lastClickTime = now;
    this.lastClickX = worldX;
    this.lastClickY = worldY;
  }

  updateSelection(worldX, worldY) {
    if (!this.isSelecting) return;

    this.endX = worldX;
    this.endY = worldY;
  }

  endSelection(worldX, worldY) {
    if (!this.isSelecting) return;

    this.endX = worldX;
    this.endY = worldY;

    const width = Math.abs(this.endX - this.startX);
    const height = Math.abs(this.endY - this.startY);

    if (width < 10 && height < 10) {
      // Small selection - single click
      this.handleClick(worldX, worldY);
    } else {
      // Drag selection
      this.handleDragSelect();
    }

    this.isSelecting = false;
  }

  handleClick(worldX, worldY) {
    const shiftKey = this.game.input.isKeyDown('shift');

    // First check if clicking on a unit
    const clickedUnit = this.findUnitAt(worldX, worldY);

    if (clickedUnit) {
      this.deselectFlag();
      if (shiftKey) {
        // Add/remove from selection
        this.toggleUnitSelection(clickedUnit);
      } else {
        // Replace selection
        this.clearSelection();
        this.selectUnit(clickedUnit);
      }
      this.showSchoolPanel(false);
      this.showFlagPanel(false);
    } else {
      // Check if clicking on own flag
      const clickedFlag = this.findFlagAt(worldX, worldY);
      if (clickedFlag && clickedFlag.ownerId === this.game.localPlayerId) {
        if (!shiftKey) {
          this.clearSelection();
        }
        this.selectFlag(clickedFlag);
        this.showSchoolPanel(false);
        this.showFlagPanel(true);
        this.updateUI();
        return;
      }

      // Check if clicking on own school to show panel
      const clickedSchool = this.findSchoolAt(worldX, worldY);
      if (clickedSchool && clickedSchool.playerId === this.game.localPlayerId) {
        this.deselectFlag();
        if (!shiftKey) {
          this.clearSelection();
        }
        this.showFlagPanel(false);
        this.showSchoolPanel(true);
        this.updateUI();
        return;
      }

      // Clicked on empty space
      if (!shiftKey) {
        this.clearSelection();
        this.deselectFlag();
        this.showSchoolPanel(false);
        this.showFlagPanel(false);
      }
    }

    this.updateUI();
  }

  handleDragSelect() {
    const shiftKey = this.game.input.isKeyDown('shift');

    if (!shiftKey) {
      this.clearSelection();
    }

    // Find all units in selection box
    const minX = Math.min(this.startX, this.endX);
    const maxX = Math.max(this.startX, this.endX);
    const minY = Math.min(this.startY, this.endY);
    const maxY = Math.max(this.startY, this.endY);

    for (const unit of this.game.units) {
      if (unit.health <= 0) continue;

      // Only select own units
      if (unit.playerId !== this.game.localPlayerId) continue;

      if (unit.x >= minX && unit.x <= maxX &&
          unit.y >= minY && unit.y <= maxY) {
        this.selectUnit(unit);
      }
    }

    this.updateUI();
  }

  handleDoubleClick(worldX, worldY) {
    const clickedUnit = this.findUnitAt(worldX, worldY);

    if (clickedUnit && clickedUnit.playerId === this.game.localPlayerId) {
      // Select all units of the same type visible on screen
      const camera = this.game.camera;
      const canvas = this.game.canvas;

      const screenLeft = camera.x;
      const screenRight = camera.x + canvas.width / camera.zoom;
      const screenTop = camera.y;
      const screenBottom = camera.y + canvas.height / camera.zoom;

      this.clearSelection();

      for (const unit of this.game.units) {
        if (unit.health <= 0) continue;
        if (unit.playerId !== this.game.localPlayerId) continue;
        if (unit.type !== clickedUnit.type) continue;

        // Check if on screen
        if (unit.x >= screenLeft && unit.x <= screenRight &&
            unit.y >= screenTop && unit.y <= screenBottom) {
          this.selectUnit(unit);
        }
      }

      this.updateUI();
    }
  }

  findUnitAt(worldX, worldY) {
    const clickRadius = 20;

    for (const unit of this.game.units) {
      if (unit.health <= 0) continue;

      const dist = Math.hypot(worldX - unit.x, worldY - unit.y);
      if (dist < clickRadius) {
        return unit;
      }
    }

    return null;
  }

  findSchoolAt(worldX, worldY) {
    for (const school of this.game.schools) {
      if (school.containsPoint(worldX, worldY)) {
        return school;
      }
    }

    return null;
  }

  findFlagAt(worldX, worldY) {
    const clickRadius = 35;

    for (const flag of this.game.flags) {
      const dist = Math.hypot(worldX - flag.x, worldY - flag.y);
      if (dist < clickRadius) {
        return flag;
      }
    }

    return null;
  }

  selectFlag(flag) {
    this.deselectFlag();
    flag.selected = true;
    this.selectedFlag = flag;
  }

  deselectFlag() {
    if (this.selectedFlag) {
      this.selectedFlag.selected = false;
      this.selectedFlag = null;
    }
  }

  showFlagPanel(show) {
    const panel = document.getElementById('flag-panel');
    if (!panel) return;

    if (show && this.selectedFlag) {
      panel.classList.remove('hidden');
      this.updateFlagPanel();
    } else {
      panel.classList.add('hidden');
    }
  }

  updateFlagPanel() {
    if (!this.selectedFlag) return;

    const flag = this.selectedFlag;

    // Update tower button state
    const buildTowerBtn = document.getElementById('btn-build-tower');
    if (buildTowerBtn) {
      if (flag.hasTower) {
        buildTowerBtn.innerHTML = '<span class="upgrade-name">Tower Built</span><span class="upgrade-cost">-</span>';
        buildTowerBtn.disabled = true;
        buildTowerBtn.classList.add('purchased');
      } else if (flag.towerBuilding) {
        const progress = Math.floor((flag.towerBuildProgress / 2000) * 100);
        buildTowerBtn.innerHTML = `<span class="upgrade-name">Building... ${progress}%</span><span class="upgrade-cost">-</span>`;
        buildTowerBtn.disabled = true;
        buildTowerBtn.classList.remove('purchased');
      } else {
        const canAfford = this.game.economy.canAfford(this.game.localPlayerId, 20);
        buildTowerBtn.innerHTML = '<span class="upgrade-name">Build Tower</span><span class="upgrade-cost">20</span>';
        buildTowerBtn.disabled = !canAfford;
        buildTowerBtn.classList.remove('purchased');
      }
    }

    // Update sandbags button state
    const buildSandbagsBtn = document.getElementById('btn-build-sandbags');
    if (buildSandbagsBtn) {
      const sandbagCost = CONSTANTS.FLAG_SANDBAGS.cost;
      if (flag.hasSandbags) {
        buildSandbagsBtn.innerHTML = '<span class="upgrade-name">Sandbags Built</span><span class="upgrade-cost">-</span>';
        buildSandbagsBtn.disabled = true;
        buildSandbagsBtn.classList.add('purchased');
      } else if (flag.sandbagsBuilding) {
        const progress = Math.floor((flag.sandbagsBuildProgress / 3000) * 100);
        buildSandbagsBtn.innerHTML = `<span class="upgrade-name">Building... ${progress}%</span><span class="upgrade-cost">-</span>`;
        buildSandbagsBtn.disabled = true;
        buildSandbagsBtn.classList.remove('purchased');
      } else {
        const canAfford = this.game.economy.canAfford(this.game.localPlayerId, sandbagCost);
        buildSandbagsBtn.innerHTML = `<span class="upgrade-name">Sandbags (3x slower)</span><span class="upgrade-cost">${sandbagCost}</span>`;
        buildSandbagsBtn.disabled = !canAfford;
        buildSandbagsBtn.classList.remove('purchased');
      }
    }
  }

  selectUnit(unit) {
    if (!this.selectedUnits.includes(unit)) {
      unit.selected = true;
      this.selectedUnits.push(unit);
    }
  }

  deselectUnit(unit) {
    unit.selected = false;
    const index = this.selectedUnits.indexOf(unit);
    if (index > -1) {
      this.selectedUnits.splice(index, 1);
    }
  }

  toggleUnitSelection(unit) {
    if (unit.selected) {
      this.deselectUnit(unit);
    } else {
      this.selectUnit(unit);
    }
  }

  clearSelection() {
    for (const unit of this.selectedUnits) {
      unit.selected = false;
    }
    this.selectedUnits = [];
    this.deselectFlag();
  }

  getSelectedUnits() {
    // Filter out dead units
    this.selectedUnits = this.selectedUnits.filter(u => u.health > 0);
    return this.selectedUnits;
  }

  hasSelection() {
    return this.getSelectedUnits().length > 0;
  }

  stopSelectedUnits() {
    for (const unit of this.selectedUnits) {
      if (unit.playerId === this.game.localPlayerId) {
        unit.stop();
      }
    }
  }

  cycleSelection() {
    // Cycle through control groups or unit types
    const ownUnits = this.game.units.filter(u =>
      u.playerId === this.game.localPlayerId && u.health > 0
    );

    if (ownUnits.length === 0) return;

    // Find the next unit type not currently selected
    const selectedTypes = new Set(this.selectedUnits.map(u => u.type));
    const allTypes = ['REGULAR', 'SENIOR', 'BOXER', 'KID'];

    let targetType = null;
    for (const type of allTypes) {
      if (!selectedTypes.has(type)) {
        const unitsOfType = ownUnits.filter(u => u.type === type);
        if (unitsOfType.length > 0) {
          targetType = type;
          break;
        }
      }
    }

    if (!targetType) {
      // All types already selected or cycle back to first
      targetType = allTypes[0];
    }

    // Select all units of target type
    this.clearSelection();
    for (const unit of ownUnits) {
      if (unit.type === targetType) {
        this.selectUnit(unit);
      }
    }

    this.updateUI();
  }

  showSchoolPanel(show) {
    const panel = document.getElementById('school-panel');
    if (show) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  }

  updateUI() {
    const selected = this.getSelectedUnits();
    const countEl = document.getElementById('selection-count');

    if (selected.length === 0) {
      countEl.textContent = 'No selection';
    } else if (selected.length === 1) {
      const unit = selected[0];
      const config = CONSTANTS.UNIT_TYPES[unit.type];
      countEl.textContent = `${config.name} (${Math.ceil(unit.health)}/${unit.maxHealth})`;
    } else {
      // Group by type
      const counts = {};
      for (const unit of selected) {
        counts[unit.type] = (counts[unit.type] || 0) + 1;
      }

      const parts = [];
      for (const [type, count] of Object.entries(counts)) {
        parts.push(`${count} ${type.toLowerCase()}${count > 1 ? 's' : ''}`);
      }

      countEl.textContent = parts.join(', ');
    }
  }
}
