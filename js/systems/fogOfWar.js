// Fog of War system - handles visibility

class FogOfWarSystem {
  constructor(game) {
    this.game = game;

    // Grid-based visibility for performance
    this.gridSize = 50;
    // Use dynamic map size from game
    this.cols = Math.ceil(game.mapWidth / this.gridSize);
    this.rows = Math.ceil(game.mapHeight / this.gridSize);

    // Per-player visibility data
    // 0 = unexplored, 0.5 = explored but not visible, 1 = visible
    this.visibility = {};
  }

  // Update grid dimensions when map size changes
  updateGridSize() {
    this.cols = Math.ceil(this.game.mapWidth / this.gridSize);
    this.rows = Math.ceil(this.game.mapHeight / this.gridSize);
  }

  initialize(playerCount) {
    // Update grid dimensions based on current map size
    this.updateGridSize();

    this.visibility = {};

    for (let i = 0; i < playerCount; i++) {
      // Create visibility array for each player
      this.visibility[i] = new Float32Array(this.cols * this.rows);
    }
  }

  update() {
    // Make sure we have visibility data for all players
    for (let i = 0; i < this.game.playerCount; i++) {
      if (!this.visibility[i]) {
        this.visibility[i] = new Float32Array(this.cols * this.rows);
      }
    }

    // Fade current visibility (visible -> explored)
    for (let playerId = 0; playerId < this.game.playerCount; playerId++) {
      const vis = this.visibility[playerId];

      for (let i = 0; i < vis.length; i++) {
        if (vis[i] === 1) {
          vis[i] = 0.5; // Was visible, now just explored
        }
      }

      // Reveal areas around player's units and buildings
      this.revealForPlayer(playerId);
    }
  }

  revealForPlayer(playerId) {
    const vis = this.visibility[playerId];
    if (!vis) return;

    // Reveal around school
    const school = this.game.schools[playerId];
    if (school && school.health > 0) {
      this.revealRadius(vis, school.x, school.y, school.visionRadius);
    }

    // Reveal around units
    for (const unit of this.game.units) {
      if (unit.playerId !== playerId) continue;
      if (unit.health <= 0) continue;

      this.revealRadius(vis, unit.x, unit.y, unit.visionRadius);
    }

    // Reveal around owned flags
    for (const flag of this.game.flags) {
      if (flag.ownerId !== playerId) continue;

      this.revealRadius(vis, flag.x, flag.y, flag.visionRadius);
    }
  }

  revealRadius(vis, centerX, centerY, radius) {
    const startCol = Math.max(0, Math.floor((centerX - radius) / this.gridSize));
    const endCol = Math.min(this.cols - 1, Math.floor((centerX + radius) / this.gridSize));
    const startRow = Math.max(0, Math.floor((centerY - radius) / this.gridSize));
    const endRow = Math.min(this.rows - 1, Math.floor((centerY + radius) / this.gridSize));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellCenterX = col * this.gridSize + this.gridSize / 2;
        const cellCenterY = row * this.gridSize + this.gridSize / 2;

        const dist = Math.hypot(cellCenterX - centerX, cellCenterY - centerY);

        if (dist <= radius) {
          const index = row * this.cols + col;
          vis[index] = 1; // Fully visible
        }
      }
    }
  }

  isVisible(x, y, playerId) {
    const vis = this.visibility[playerId];
    if (!vis) return true; // No fog data, everything visible

    const col = Math.floor(x / this.gridSize);
    const row = Math.floor(y / this.gridSize);

    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return false;
    }

    const index = row * this.cols + col;
    return vis[index] === 1;
  }

  wasExplored(x, y, playerId) {
    const vis = this.visibility[playerId];
    if (!vis) return true;

    const col = Math.floor(x / this.gridSize);
    const row = Math.floor(y / this.gridSize);

    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return false;
    }

    const index = row * this.cols + col;
    return vis[index] > 0;
  }

  getVisibilityAt(x, y, playerId) {
    const vis = this.visibility[playerId];
    if (!vis) return 1;

    const col = Math.floor(x / this.gridSize);
    const row = Math.floor(y / this.gridSize);

    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return 0;
    }

    const index = row * this.cols + col;
    return vis[index];
  }

  getVisibilityData(playerId) {
    return this.visibility[playerId];
  }

  // Check if any unit of a player can see a position
  canPlayerSee(playerId, x, y) {
    // Check school
    const school = this.game.schools[playerId];
    if (school && school.health > 0) {
      const dist = Math.hypot(x - school.x, y - school.y);
      if (dist <= school.visionRadius) return true;
    }

    // Check units
    for (const unit of this.game.units) {
      if (unit.playerId !== playerId) continue;
      if (unit.health <= 0) continue;

      const dist = Math.hypot(x - unit.x, y - unit.y);
      if (dist <= unit.visionRadius) return true;
    }

    // Check owned flags
    for (const flag of this.game.flags) {
      if (flag.ownerId !== playerId) continue;

      const dist = Math.hypot(x - flag.x, y - flag.y);
      if (dist <= flag.visionRadius) return true;
    }

    return false;
  }

  // Get all enemy units visible to a player
  getVisibleEnemyUnits(playerId) {
    const visibleUnits = [];

    for (const unit of this.game.units) {
      if (unit.playerId === playerId) continue;
      if (unit.health <= 0) continue;

      if (this.isVisible(unit.x, unit.y, playerId)) {
        visibleUnits.push(unit);
      }
    }

    return visibleUnits;
  }

  serialize() {
    const data = {};
    for (const [playerId, vis] of Object.entries(this.visibility)) {
      data[playerId] = Array.from(vis);
    }
    return data;
  }

  loadState(state) {
    this.visibility = {};
    for (const [playerId, visArray] of Object.entries(state)) {
      this.visibility[playerId] = new Float32Array(visArray);
    }
  }
}
