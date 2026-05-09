// Combat system - handles combat resolution

class CombatSystem {
  constructor(game) {
    this.game = game;
  }

  update(dt) {
    // Combat is handled by individual units in their update methods
    // This system handles global combat events and cleanup

    // Remove dead units
    this.cleanupDeadUnits();
  }

  cleanupDeadUnits() {
    // Filter out dead units
    for (let i = this.game.units.length - 1; i >= 0; i--) {
      const unit = this.game.units[i];
      if (unit.health <= 0) {
        // Clear any references to this unit
        for (const otherUnit of this.game.units) {
          if (otherUnit.attackTarget === unit) {
            otherUnit.attackTarget = null;
          }
        }

        this.game.units.splice(i, 1);
      }
    }
  }

  // Calculate damage with all modifiers
  calculateDamage(attacker, target) {
    const baseConfig = CONSTANTS.UNIT_TYPES[attacker.type];
    let damage = baseConfig.damage;

    // Apply damage bonus from upgrades
    damage *= (1 + attacker.damageBonus);

    // Apply target damage reduction (for schools)
    if (target instanceof School) {
      damage *= (1 - target.damageReduction);
    }

    return damage;
  }

  // Check if attacker can attack target
  canAttack(attacker, target) {
    if (!target || target.health <= 0) return false;
    if (attacker.playerId === target.playerId) return false;

    const dist = attacker.getDistanceTo(target);
    return dist <= attacker.attackRange;
  }

  // Get all valid targets for a unit
  getValidTargets(unit) {
    const targets = [];

    // Enemy units
    for (const other of this.game.units) {
      if (other.playerId !== unit.playerId && other.health > 0) {
        targets.push(other);
      }
    }

    // Military units (neutral enemies to everyone)
    if (this.game.militaryUnits) {
      for (const military of this.game.militaryUnits) {
        if (military.health > 0) {
          targets.push(military);
        }
      }
    }

    // Enemy schools
    for (const school of this.game.schools) {
      if (school.playerId !== unit.playerId && school.health > 0) {
        targets.push(school);
      }
    }

    return targets;
  }

  // Find the best target for a unit (nearest enemy)
  findBestTarget(unit, maxRange = CONSTANTS.AGGRO_RANGE) {
    let bestTarget = null;
    let bestDist = maxRange;

    const targets = this.getValidTargets(unit);

    for (const target of targets) {
      const dist = unit.getDistanceTo(target);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = target;
      }
    }

    return bestTarget;
  }

  // Check if two entities are enemies
  areEnemies(entity1, entity2) {
    return entity1.playerId !== entity2.playerId;
  }

  // Get all units in a radius
  getUnitsInRadius(x, y, radius, playerId = null) {
    const units = [];

    for (const unit of this.game.units) {
      if (unit.health <= 0) continue;
      if (playerId !== null && unit.playerId !== playerId) continue;

      const dist = Math.hypot(unit.x - x, unit.y - y);
      if (dist <= radius) {
        units.push(unit);
      }
    }

    return units;
  }

  // Get enemy units in a radius
  getEnemyUnitsInRadius(x, y, radius, playerId) {
    const units = [];

    for (const unit of this.game.units) {
      if (unit.health <= 0) continue;
      if (unit.playerId === playerId) continue;

      const dist = Math.hypot(unit.x - x, unit.y - y);
      if (dist <= radius) {
        units.push(unit);
      }
    }

    // Military units (neutral enemies to everyone)
    if (this.game.militaryUnits) {
      for (const military of this.game.militaryUnits) {
        if (military.health <= 0) continue;

        const dist = Math.hypot(military.x - x, military.y - y);
        if (dist <= radius) {
          units.push(military);
        }
      }
    }

    return units;
  }

  // Get total army strength for a player
  getArmyStrength(playerId) {
    let strength = 0;

    for (const unit of this.game.units) {
      if (unit.playerId !== playerId) continue;
      if (unit.health <= 0) continue;

      const config = CONSTANTS.UNIT_TYPES[unit.type];
      // Strength = health * damage potential
      strength += unit.health * (config.damage * (1 + unit.damageBonus));
    }

    return strength;
  }

  // Check if a player has any combat units
  hasUnits(playerId) {
    return this.game.units.some(u => u.playerId === playerId && u.health > 0);
  }
}
