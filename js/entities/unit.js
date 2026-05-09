// Unit entity class

class Unit {
  constructor(options) {
    this.id = options.id;
    this.playerId = options.playerId;
    this.type = options.type || 'REGULAR';

    // Position
    this.x = options.x || 0;
    this.y = options.y || 0;

    // Get stats from config
    const config = CONSTANTS.UNIT_TYPES[this.type];

    // Health
    this.maxHealth = options.maxHealth || config.health;
    this.health = options.health || this.maxHealth;

    // Combat stats
    this.damage = config.damage;
    this.attackRange = config.attackRange;
    this.attackCooldown = config.attackCooldown;
    this.lastAttackTime = 0;

    // Movement
    this.speed = config.speed;
    this.visionRadius = config.visionRadius;

    // Upgrade bonuses
    this.damageBonus = options.damageBonus || 0;
    this.healthBonus = options.healthBonus || 0;

    // State
    this.selected = false;
    this.targetX = null;
    this.targetY = null;
    this.attackMove = false;
    this.attackTarget = null;
    this.state = 'idle'; // idle, moving, attacking, dead

    // Pathfinding
    this.path = [];
    this.pathIndex = 0;
  }

  update(dt, game) {
    if (this.health <= 0) {
      this.state = 'dead';
      return;
    }

    // Update attack cooldown
    this.lastAttackTime = Math.max(0, this.lastAttackTime - dt * 1000);

    // State machine
    switch (this.state) {
      case 'idle':
        this.updateIdle(dt, game);
        break;
      case 'moving':
        this.updateMoving(dt, game);
        break;
      case 'attacking':
        this.updateAttacking(dt, game);
        break;
    }
  }

  updateIdle(dt, game) {
    // Look for enemies in aggro range
    const enemy = this.findNearestEnemy(game);

    if (enemy && this.getDistanceTo(enemy) <= CONSTANTS.AGGRO_RANGE) {
      this.attackTarget = enemy;
      this.state = 'attacking';
    }
  }

  updateMoving(dt, game) {
    if (this.targetX === null || this.targetY === null) {
      this.state = 'idle';
      return;
    }

    // Move toward target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 5) {
      // Reached target
      this.targetX = null;
      this.targetY = null;
      this.state = 'idle';
      return;
    }

    // Check for enemies while moving (attack-move)
    if (this.attackMove) {
      const enemy = this.findNearestEnemy(game);
      if (enemy && this.getDistanceTo(enemy) <= CONSTANTS.AGGRO_RANGE) {
        this.attackTarget = enemy;
        this.state = 'attacking';
        return;
      }
    }

    // Move
    const moveX = (dx / dist) * this.speed * dt;
    const moveY = (dy / dist) * this.speed * dt;

    // Collision avoidance with other units
    const avoidance = this.calculateAvoidance(game);

    this.x += moveX + avoidance.x;
    this.y += moveY + avoidance.y;

    // Clamp to map bounds (use game's dynamic map size)
    this.x = Math.max(10, Math.min(this.x, game.mapWidth - 10));
    this.y = Math.max(10, Math.min(this.y, game.mapHeight - 10));
  }

  updateAttacking(dt, game) {
    // Check if target is still valid
    if (!this.attackTarget || this.attackTarget.health <= 0) {
      this.attackTarget = null;
      this.state = this.targetX !== null ? 'moving' : 'idle';
      return;
    }

    const dist = this.getDistanceTo(this.attackTarget);

    // Check if target moved out of range
    if (dist > CONSTANTS.DISENGAGE_RANGE) {
      this.attackTarget = null;
      this.state = this.targetX !== null ? 'moving' : 'idle';
      return;
    }

    // Move into attack range
    if (dist > this.attackRange) {
      const dx = this.attackTarget.x - this.x;
      const dy = this.attackTarget.y - this.y;
      const moveX = (dx / dist) * this.speed * dt;
      const moveY = (dy / dist) * this.speed * dt;

      this.x += moveX;
      this.y += moveY;
    } else {
      // In range - attack!
      if (this.lastAttackTime <= 0) {
        this.performAttack(this.attackTarget, game);
        this.lastAttackTime = this.attackCooldown;
      }
    }
  }

  performAttack(target, game) {
    const config = CONSTANTS.UNIT_TYPES[this.type];
    const isBoxer = this.type === 'BOXER';
    const isKid = this.type === 'KID';
    const isSenior = this.type === 'SENIOR';

    // Kid throws grenades (ranged splash damage)
    if (isKid && config.isRanged) {
      // Play throw sound
      if (game.sound) {
        game.sound.playGrenadeThrow();
      }

      // Throw grenade at target
      game.throwGrenade(this, target);
      return;
    }

    // Play attack sound
    if (game.sound) {
      game.sound.playPunch(isBoxer);
    }

    // Determine attack type for effect
    let effectType = 'punch_impact';
    if (isSenior && Math.random() > 0.6) {
      effectType = Math.random() > 0.5 ? 'kick_impact' : 'uppercut_impact';
    }

    // Add impact effect at target position
    if (game.effects) {
      game.effects.push({
        type: effectType,
        x: target.x,
        y: target.y - 10,
        time: 0,
        duration: 0.4,
        size: isBoxer ? 1.3 : 1,
        isBoxer: isBoxer
      });
    }

    // Apply damage to target
    if (target instanceof Unit) {
      // Boxer insta-kills units only
      let actualDamage;
      if (isBoxer && config.instaKillUnits) {
        actualDamage = target.health + 100; // Guaranteed kill
      } else {
        actualDamage = this.damage * (1 + this.damageBonus);
      }
      target.takeDamage(actualDamage, game);
    } else if (target instanceof School) {
      // Normal damage against schools (no insta-kill)
      // Boxer uses buildingDamage since his unit damage is meant for insta-kills
      const baseDamage = config.buildingDamage || config.damage;
      const actualDamage = baseDamage * (1 + this.damageBonus);
      target.takeDamage(actualDamage, game);
    } else if (target && typeof target.health === 'number') {
      // Handle military units and other objects with health (plain objects)
      let actualDamage;
      if (isBoxer && config.instaKillUnits) {
        actualDamage = target.health + 100; // Guaranteed kill
      } else {
        actualDamage = this.damage * (1 + this.damageBonus);
      }
      target.health -= actualDamage;
      if (target.health <= 0) {
        target.health = 0;
      }
      // Play hit sound
      if (game.sound) {
        game.sound.playHit();
      }
    }
  }

  takeDamage(amount, game) {
    this.health -= amount;

    if (this.health <= 0) {
      this.health = 0;
      this.state = 'dead';
      this.selected = false;

      // Play death sound
      if (game.sound) {
        game.sound.playDeath();
      }

      // Remove from game
      game.removeUnit(this);
    } else {
      // Play hit sound
      if (game.sound) {
        game.sound.playHit();
      }

      // If idle and taking damage, look for attacker
      if (this.state === 'idle') {
        const attacker = this.findNearestEnemy(game);
        if (attacker) {
          this.attackTarget = attacker;
          this.state = 'attacking';
        }
      }
    }
  }

  setTarget(x, y, attackMove = false) {
    this.targetX = x;
    this.targetY = y;
    this.attackMove = attackMove;
    this.attackTarget = null;
    this.state = 'moving';
  }

  stop() {
    this.targetX = null;
    this.targetY = null;
    this.attackMove = false;
    this.attackTarget = null;
    this.state = 'idle';
  }

  findNearestEnemy(game) {
    let nearest = null;
    let nearestDist = Infinity;

    // Check enemy units
    for (const unit of game.units) {
      if (unit.playerId === this.playerId) continue;
      if (unit.health <= 0) continue;

      const dist = this.getDistanceTo(unit);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = unit;
      }
    }

    // Check military units (neutral enemies to everyone)
    if (game.militaryUnits) {
      for (const military of game.militaryUnits) {
        if (military.health <= 0) continue;

        const dist = this.getDistanceTo(military);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = military;
        }
      }
    }

    // Check enemy schools
    for (const school of game.schools) {
      if (school.playerId === this.playerId) continue;
      if (school.health <= 0 || school.destroyed) continue;

      const dist = this.getDistanceTo(school);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = school;
      }
    }

    return nearest;
  }

  getDistanceTo(target) {
    return Math.hypot(target.x - this.x, target.y - this.y);
  }

  calculateAvoidance(game) {
    const avoidance = { x: 0, y: 0 };
    const avoidRadius = 25;

    for (const unit of game.units) {
      if (unit === this) continue;

      const dx = this.x - unit.x;
      const dy = this.y - unit.y;
      const dist = Math.hypot(dx, dy);

      if (dist < avoidRadius && dist > 0) {
        const force = (avoidRadius - dist) / avoidRadius;
        avoidance.x += (dx / dist) * force * 2;
        avoidance.y += (dy / dist) * force * 2;
      }
    }

    return avoidance;
  }

  serialize() {
    return {
      id: this.id,
      playerId: this.playerId,
      type: this.type,
      x: this.x,
      y: this.y,
      health: this.health,
      maxHealth: this.maxHealth,
      state: this.state,
      targetX: this.targetX,
      targetY: this.targetY,
      attackMove: this.attackMove
    };
  }
}
