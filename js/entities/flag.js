// Flag entity class - capturable control points

class Flag {
  constructor(options) {
    this.id = options.id;

    // Position
    this.x = options.x || 0;
    this.y = options.y || 0;

    // Ownership
    this.ownerId = options.ownerId !== undefined ? options.ownerId : null;

    // Capture state
    this.captureProgress = 0;
    this.capturingPlayerId = null;

    // Visual
    this.showCaptureRadius = false;
    this.selected = false;

    // Size and range
    this.captureRadius = CONSTANTS.FLAG_CAPTURE_RADIUS;
    this.visionRadius = CONSTANTS.FLAG_VISION_RADIUS;

    // Tower system
    this.hasTower = false;
    this.towerHealth = 0;
    this.towerMaxHealth = 100;
    this.towerDamage = 8;
    this.towerRange = 150;
    this.towerAttackCooldown = 1000; // ms
    this.towerLastAttack = 0;
    this.towerTarget = null;
    this.towerBuildProgress = 0;
    this.towerBuilding = false;

    // Sandbags system
    this.hasSandbags = false;
    this.sandbagsBuilding = false;
    this.sandbagsBuildProgress = 0;
  }

  update(dt, game) {
    // Update tower building progress
    if (this.towerBuilding) {
      this.towerBuildProgress += dt * 1000;
      if (this.towerBuildProgress >= 2000) { // 2 seconds to build
        this.towerBuilding = false;
        this.hasTower = true;
        this.towerHealth = this.towerMaxHealth;
        this.towerBuildProgress = 0;
      }
    }

    // Update sandbags building progress
    if (this.sandbagsBuilding) {
      this.sandbagsBuildProgress += dt * 1000;
      if (this.sandbagsBuildProgress >= 3000) { // 3 seconds to build
        this.sandbagsBuilding = false;
        this.hasSandbags = true;
        this.sandbagsBuildProgress = 0;
      }
    }

    // Update tower combat
    if (this.hasTower && this.towerHealth > 0) {
      this.updateTower(dt, game);
    }

    // Find units in capture radius
    const unitsInRadius = this.getUnitsInRadius(game);

    // Group units by player
    const playerUnits = {};
    for (const unit of unitsInRadius) {
      if (!playerUnits[unit.playerId]) {
        playerUnits[unit.playerId] = [];
      }
      playerUnits[unit.playerId].push(unit);
    }

    const playerIds = Object.keys(playerUnits).map(id => parseInt(id));

    // Show capture radius if any units nearby
    this.showCaptureRadius = playerIds.length > 0;

    // Determine capture state
    if (playerIds.length === 0) {
      // No units nearby - decay capture progress
      if (this.captureProgress > 0) {
        this.captureProgress = Math.max(0, this.captureProgress - dt * 500);
        if (this.captureProgress === 0) {
          this.capturingPlayerId = null;
        }
      }
    } else if (playerIds.length === 1) {
      // Only one player's units nearby
      const capturingPlayer = playerIds[0];
      const unitCount = playerUnits[capturingPlayer].length;

      if (this.ownerId === capturingPlayer) {
        // Owner's units - reset capture progress
        this.captureProgress = 0;
        this.capturingPlayerId = null;
      } else {
        // Enemy units - capture
        if (this.capturingPlayerId !== capturingPlayer) {
          // Different player starting capture - reset progress
          this.captureProgress = 0;
          this.capturingPlayerId = capturingPlayer;
        }

        // Increase capture progress (faster with more units, capped at 3x)
        let captureSpeed = Math.min(unitCount, 3);

        // Sandbags slow down capture by 3x
        if (this.hasSandbags) {
          captureSpeed *= CONSTANTS.FLAG_SANDBAGS.captureSpeedMultiplier;
        }

        this.captureProgress += dt * 1000 * captureSpeed;

        // Check if capture complete
        if (this.captureProgress >= CONSTANTS.FLAG_CAPTURE_TIME) {
          const previousOwner = this.ownerId;
          this.ownerId = capturingPlayer;
          this.captureProgress = 0;
          this.capturingPlayerId = null;

          // Play capture sound
          if (game.sound) {
            if (capturingPlayer === game.localPlayerId) {
              // Player captured a flag
              game.sound.playFlagCapturePlayer();
            } else if (previousOwner === game.localPlayerId) {
              // Player lost a flag
              game.sound.playFlagLost();
            } else {
              // Enemy captured a flag (neutral or from another enemy)
              game.sound.playFlagCaptureEnemy();
            }
          }

          // Destroy tower and sandbags when flag is captured
          if (this.hasTower) {
            this.destroyTower(game);
          }
          if (this.hasSandbags) {
            this.destroySandbags(game);
          }

          // Update economy
          game.economy.updateFlagOwnership(this.id, capturingPlayer);
        }
      }
    } else {
      // Multiple players' units nearby - contested
      // Progress decays while contested
      this.captureProgress = Math.max(0, this.captureProgress - dt * 300);
      if (this.captureProgress === 0) {
        this.capturingPlayerId = null;
      }
    }
  }

  updateTower(dt, game) {
    // Update attack cooldown
    this.towerLastAttack = Math.max(0, this.towerLastAttack - dt * 1000);

    // Find enemy target (player units)
    const enemies = game.units.filter(u =>
      u.playerId !== this.ownerId && u.health > 0
    );

    // Also include military units (neutral enemies to everyone)
    if (game.militaryUnits) {
      for (const military of game.militaryUnits) {
        if (military.health > 0) {
          enemies.push(military);
        }
      }
    }

    // Find closest enemy in range
    let closestEnemy = null;
    let closestDist = this.towerRange;

    for (const enemy of enemies) {
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }

    this.towerTarget = closestEnemy;

    // Attack if ready
    if (this.towerTarget && this.towerLastAttack <= 0) {
      // Handle both Unit instances and plain objects (military)
      if (this.towerTarget.takeDamage) {
        this.towerTarget.takeDamage(this.towerDamage, game);
      } else {
        this.towerTarget.health -= this.towerDamage;
        if (this.towerTarget.health <= 0) {
          this.towerTarget.health = 0;
        }
      }
      this.towerLastAttack = this.towerAttackCooldown;

      // Play tower shot sound
      if (game.sound) {
        game.sound.playTowerShot();
      }

      // Add projectile effect
      if (game.effects) {
        game.effects.push({
          type: 'tower_shot',
          startX: this.x,
          startY: this.y - 30,
          endX: this.towerTarget.x,
          endY: this.towerTarget.y,
          duration: 0.15,
          time: 0
        });
      }
    }
  }

  buildTower(game) {
    if (this.hasTower || this.towerBuilding) return false;
    if (this.ownerId === null) return false;

    this.towerBuilding = true;
    this.towerBuildProgress = 0;
    return true;
  }

  buildSandbags(game) {
    if (this.hasSandbags || this.sandbagsBuilding) return false;
    if (this.ownerId === null) return false;

    this.sandbagsBuilding = true;
    this.sandbagsBuildProgress = 0;
    return true;
  }

  destroyTower(game) {
    this.hasTower = false;
    this.towerHealth = 0;
    this.towerTarget = null;
    this.towerBuilding = false;
    this.towerBuildProgress = 0;

    // Add destruction effect
    if (game.effects) {
      game.effects.push({
        type: 'explosion',
        x: this.x,
        y: this.y - 20,
        radius: 30,
        duration: 0.5,
        time: 0
      });
    }
  }

  destroySandbags(game) {
    this.hasSandbags = false;
    this.sandbagsBuilding = false;
    this.sandbagsBuildProgress = 0;
  }

  getUnitsInRadius(game) {
    const units = [];

    for (const unit of game.units) {
      if (unit.health <= 0) continue;

      const dist = Math.hypot(unit.x - this.x, unit.y - this.y);
      if (dist <= this.captureRadius) {
        units.push(unit);
      }
    }

    return units;
  }

  isOwnedBy(playerId) {
    return this.ownerId === playerId;
  }

  isNeutral() {
    return this.ownerId === null;
  }

  getDistanceTo(target) {
    return Math.hypot(target.x - this.x, target.y - this.y);
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      ownerId: this.ownerId,
      captureProgress: this.captureProgress,
      capturingPlayerId: this.capturingPlayerId
    };
  }
}
