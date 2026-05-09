// AI system - handles computer opponent logic

class AISystem {
  constructor(game, difficulty = 'MID') {
    this.game = game;
    this.difficulty = difficulty;
    this.difficultySettings = CONSTANTS.AI_DIFFICULTY[difficulty] || CONSTANTS.AI_DIFFICULTY.MID;

    // AI controls all non-local players
    this.aiPlayers = [];
    for (let i = 0; i < game.playerCount; i++) {
      if (i !== game.localPlayerId) {
        this.aiPlayers.push(i);
      }
    }

    // Decision timers - based on difficulty
    this.decisionInterval = this.difficultySettings.decisionInterval;
    this.decisionTimers = {};

    for (const playerId of this.aiPlayers) {
      this.decisionTimers[playerId] = Math.random() * this.decisionInterval;
    }

    // Resource bonus timers (for harder difficulties)
    this.resourceBonusTimers = {};
    for (const playerId of this.aiPlayers) {
      this.resourceBonusTimers[playerId] = 0;
    }

    // AI personality/strategy weights - adjusted by difficulty
    const aggression = this.difficultySettings.aggression;
    this.strategies = {
      aggressive: {
        unitPriority: 0.5 + aggression * 0.2,
        flagPriority: 0.3 - aggression * 0.1,
        defensePriority: 0.2 - aggression * 0.1
      },
      balanced: {
        unitPriority: 0.4,
        flagPriority: 0.4,
        defensePriority: 0.2
      },
      defensive: {
        unitPriority: 0.3,
        flagPriority: 0.3,
        defensePriority: 0.4
      }
    };

    // Assign strategy to each AI - harder difficulties are more aggressive
    this.aiStrategies = {};
    for (const playerId of this.aiPlayers) {
      if (this.difficulty === 'INSANE') {
        this.aiStrategies[playerId] = 'aggressive';
      } else if (this.difficulty === 'HARD') {
        this.aiStrategies[playerId] = Math.random() > 0.3 ? 'aggressive' : 'balanced';
      } else if (this.difficulty === 'EASY') {
        this.aiStrategies[playerId] = Math.random() > 0.5 ? 'defensive' : 'balanced';
      } else {
        const strategyNames = Object.keys(this.strategies);
        this.aiStrategies[playerId] = strategyNames[Math.floor(Math.random() * strategyNames.length)];
      }
    }

    // Micro management timers for INSANE difficulty
    this.microTimers = {};
    for (const playerId of this.aiPlayers) {
      this.microTimers[playerId] = 0;
    }
  }

  update(dt) {
    for (const playerId of this.aiPlayers) {
      // Apply resource bonuses for harder difficulties
      this.resourceBonusTimers[playerId] += dt;
      if (this.resourceBonusTimers[playerId] >= 1) {
        this.resourceBonusTimers[playerId] = 0;
        const bonusMultiplier = this.difficultySettings.resourceMultiplier - 1;
        if (bonusMultiplier > 0) {
          const baseIncome = CONSTANTS.BASE_REPUTATION_INCOME;
          const bonusIncome = baseIncome * bonusMultiplier;
          this.game.economy.addReputation(playerId, bonusIncome);
        }
      }

      // Decision making
      this.decisionTimers[playerId] -= dt;
      if (this.decisionTimers[playerId] <= 0) {
        this.makeDecision(playerId);
        this.decisionTimers[playerId] = this.decisionInterval + Math.random() * 0.5;
      }

      // Perfect micro for INSANE difficulty
      if (this.difficultySettings.perfectMicro) {
        this.microTimers[playerId] += dt;
        if (this.microTimers[playerId] >= 0.1) { // Micro every 100ms
          this.microTimers[playerId] = 0;
          this.performMicroManagement(playerId);
        }
      }
    }
  }

  performMicroManagement(playerId) {
    const ownUnits = this.game.units.filter(u => u.playerId === playerId && u.health > 0);

    for (const unit of ownUnits) {
      // Retreat low health units
      if (unit.health < unit.maxHealth * 0.3 && unit.state === 'attacking') {
        const school = this.game.schools[playerId];
        if (school && school.health > 0) {
          unit.setTarget(school.x, school.y, false);
        }
      }

      // Focus fire on weakest enemy
      if (unit.state === 'attacking' && unit.attackTarget) {
        const nearbyEnemies = this.game.combat.getEnemyUnitsInRadius(
          unit.x, unit.y, CONSTANTS.UNIT_TYPES[unit.type].attackRange + 50, playerId
        );

        if (nearbyEnemies.length > 1) {
          let weakestEnemy = null;
          let lowestHealth = Infinity;

          for (const enemy of nearbyEnemies) {
            if (enemy.health < lowestHealth) {
              lowestHealth = enemy.health;
              weakestEnemy = enemy;
            }
          }

          if (weakestEnemy && weakestEnemy !== unit.attackTarget) {
            unit.attackTarget = weakestEnemy;
          }
        }
      }
    }
  }

  makeDecision(playerId) {
    const school = this.game.schools[playerId];
    if (!school || school.health <= 0) return;

    const strategy = this.strategies[this.aiStrategies[playerId]];
    const reputation = this.game.economy.getReputation(playerId);

    // Decide what to do based on strategy weights and game state
    const random = Math.random();

    // Randomly decide to attack enemy school (based on difficulty)
    const attackSchoolChance = this.difficulty === 'INSANE' ? 0.4 :
                               this.difficulty === 'HARD' ? 0.25 :
                               this.difficulty === 'MID' ? 0.15 : 0.05;

    if (random < attackSchoolChance) {
      this.decideSchoolAttack(playerId);
    } else if (random < attackSchoolChance + strategy.unitPriority) {
      this.decideUnitProduction(playerId, reputation);
    } else if (random < attackSchoolChance + strategy.unitPriority + strategy.flagPriority) {
      this.decideFlagCapture(playerId);
    } else {
      this.decideDefense(playerId);
    }

    // Also consider upgrades
    this.decideUpgrades(playerId, reputation);

    // Always assign idle units to tasks
    this.assignIdleUnits(playerId);
  }

  decideSchoolAttack(playerId) {
    const ownUnits = this.game.units.filter(u => u.playerId === playerId && u.health > 0);

    // Need enough units to attack
    const minUnitsForAttack = this.difficulty === 'INSANE' ? 3 :
                              this.difficulty === 'HARD' ? 4 :
                              this.difficulty === 'MID' ? 5 : 6;

    if (ownUnits.length < minUnitsForAttack) return;

    // Find the weakest enemy school
    const enemySchool = this.findWeakestEnemySchool(playerId);
    if (!enemySchool) return;

    // Get idle and non-defending units
    const availableUnits = ownUnits.filter(u =>
      u.state === 'idle' || (u.state === 'moving' && !this.isDefending(u, playerId))
    );

    if (availableUnits.length < Math.floor(minUnitsForAttack * 0.6)) return;

    // Send units to attack the school
    const attackRatio = this.difficulty === 'INSANE' ? 0.85 :
                       this.difficulty === 'HARD' ? 0.7 :
                       this.difficulty === 'MID' ? 0.6 : 0.5;

    const attackForce = availableUnits.slice(0, Math.ceil(availableUnits.length * attackRatio));

    for (const unit of attackForce) {
      // Set the school as the attack target
      unit.attackTarget = enemySchool;
      unit.setTarget(enemySchool.x, enemySchool.y, true);
    }
  }

  isDefending(unit, playerId) {
    const school = this.game.schools[playerId];
    if (!school) return false;
    return Math.hypot(unit.x - school.x, unit.y - school.y) < 200;
  }

  decideUnitProduction(playerId, reputation) {
    // Prioritize unit types based on current composition and resources
    const unitCounts = {};
    for (const type of Object.keys(CONSTANTS.UNIT_TYPES)) {
      unitCounts[type] = this.game.getUnitCount(playerId, type);
    }

    // Try to build units in order of priority
    const priorities = this.getUnitPriorities(playerId, unitCounts);

    // Harder difficulties create units more aggressively
    const unitsToCreate = this.difficulty === 'INSANE' ? 3 :
                          this.difficulty === 'HARD' ? 2 : 1;

    let created = 0;
    for (const type of priorities) {
      if (created >= unitsToCreate) break;

      const config = CONSTANTS.UNIT_TYPES[type];
      while (reputation >= config.cost && unitCounts[type] < config.limit && created < unitsToCreate) {
        if (this.game.createUnit(playerId, type)) {
          reputation -= config.cost;
          unitCounts[type]++;
          created++;
        } else {
          break;
        }
      }
    }
  }

  getUnitPriorities(playerId, currentCounts) {
    // Determine which units to prioritize based on game state
    const totalUnits = Object.values(currentCounts).reduce((a, b) => a + b, 0);
    const hasFence = this.game.economy.hasUpgrade(playerId, 'FENCE');

    if (totalUnits < 5) {
      // Early game - build regulars first
      return ['REGULAR', 'SENIOR', 'BOXER'];
    }

    // Check enemy strength
    const enemyStrength = this.getEnemyStrength(playerId);
    const ownStrength = this.game.combat.getArmyStrength(playerId);

    if (ownStrength < enemyStrength * 0.7) {
      // We're weaker - prioritize strong units
      const priorities = ['BOXER', 'SENIOR', 'REGULAR'];
      if (hasFence) priorities.splice(2, 0, 'KID'); // Kids are good ranged support
      return priorities;
    }

    // Balanced composition
    if (currentCounts.BOXER < 1) {
      const priorities = ['BOXER', 'SENIOR', 'REGULAR'];
      if (hasFence) priorities.push('KID');
      return priorities;
    }
    if (currentCounts.SENIOR < 2) {
      const priorities = ['SENIOR', 'REGULAR', 'BOXER'];
      if (hasFence) priorities.splice(2, 0, 'KID');
      return priorities;
    }

    // Include Kids if we have Fence and don't have many
    if (hasFence && (currentCounts.KID || 0) < 2) {
      return ['KID', 'REGULAR', 'SENIOR', 'BOXER'];
    }

    return ['REGULAR', 'SENIOR', 'BOXER'];
  }

  getEnemyStrength(playerId) {
    let totalStrength = 0;

    for (let i = 0; i < this.game.playerCount; i++) {
      if (i === playerId) continue;

      totalStrength += this.game.combat.getArmyStrength(i);
    }

    return totalStrength;
  }

  decideFlagCapture(playerId) {
    const school = this.game.schools[playerId];
    const ownUnits = this.game.units.filter(u => u.playerId === playerId && u.health > 0);

    if (ownUnits.length === 0) return;

    // Find uncaptured or enemy flags
    const targetFlags = this.game.flags.filter(f =>
      f.ownerId !== playerId
    );

    if (targetFlags.length === 0) return;

    // For INSANE difficulty with map awareness, prioritize weakly defended flags
    if (this.difficultySettings.mapAwareness) {
      targetFlags.sort((a, b) => {
        const aDefenders = this.game.units.filter(u =>
          u.playerId !== playerId && u.health > 0 &&
          Math.hypot(u.x - a.x, u.y - a.y) < 150
        ).length;
        const bDefenders = this.game.units.filter(u =>
          u.playerId !== playerId && u.health > 0 &&
          Math.hypot(u.x - b.x, u.y - b.y) < 150
        ).length;

        // Prefer less defended flags
        if (aDefenders !== bDefenders) {
          return aDefenders - bDefenders;
        }

        // Then by distance
        return school.getDistanceTo(a) - school.getDistanceTo(b);
      });
    } else {
      // Sort flags by distance from school
      targetFlags.sort((a, b) =>
        school.getDistanceTo(a) - school.getDistanceTo(b)
      );
    }

    // Get idle units for flag capture
    const idleUnits = ownUnits.filter(u => u.state === 'idle');

    // Send more units for harder difficulties
    const unitsToSendCount = this.difficulty === 'INSANE' ? 5 :
                             this.difficulty === 'HARD' ? 4 : 3;

    if (idleUnits.length > 0) {
      const targetFlag = targetFlags[0];
      const unitsToSend = idleUnits.slice(0, Math.min(unitsToSendCount, idleUnits.length));

      for (const unit of unitsToSend) {
        unit.setTarget(targetFlag.x, targetFlag.y, true); // Attack-move for harder AI
      }
    }
  }

  decideDefense(playerId) {
    const school = this.game.schools[playerId];
    const ownUnits = this.game.units.filter(u => u.playerId === playerId && u.health > 0);

    // Check for enemies near our school
    const nearbyEnemies = this.game.combat.getEnemyUnitsInRadius(
      school.x, school.y, 300, playerId
    );

    if (nearbyEnemies.length > 0) {
      // Rally units to defend school
      const idleUnits = ownUnits.filter(u =>
        u.state === 'idle' || (u.state === 'moving' && !u.attackMove)
      );

      for (const unit of idleUnits) {
        // Find nearest enemy
        let nearestEnemy = null;
        let nearestDist = Infinity;

        for (const enemy of nearbyEnemies) {
          const dist = unit.getDistanceTo(enemy);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestEnemy = enemy;
          }
        }

        if (nearestEnemy) {
          unit.attackTarget = nearestEnemy;
          unit.setTarget(nearestEnemy.x, nearestEnemy.y, true);
        }
      }
    }
  }

  decideUpgrades(playerId, reputation) {
    // Prioritize upgrades based on game state
    const economy = this.game.economy;

    // Combat Training is always good early
    if (!economy.hasUpgrade(playerId, 'COMBAT_TRAINING') &&
        reputation >= CONSTANTS.UNIT_UPGRADES.COMBAT_TRAINING.cost) {
      this.game.purchaseUpgrade(playerId, 'COMBAT_TRAINING', false);
      return;
    }

    // Fence for defense
    if (!economy.hasUpgrade(playerId, 'FENCE') &&
        reputation >= CONSTANTS.SCHOOL_UPGRADES.FENCE.cost + 20) {
      this.game.purchaseUpgrade(playerId, 'FENCE', true);
      return;
    }

    // Prestige for economy (if we own flags)
    const ownedFlags = this.game.flags.filter(f => f.ownerId === playerId).length;
    if (ownedFlags >= 2 &&
        !economy.hasUpgrade(playerId, 'PRESTIGE') &&
        reputation >= CONSTANTS.SCHOOL_UPGRADES.PRESTIGE.cost) {
      this.game.purchaseUpgrade(playerId, 'PRESTIGE', true);
      return;
    }

    // Guard for HP
    if (!economy.hasUpgrade(playerId, 'GUARD') &&
        reputation >= CONSTANTS.SCHOOL_UPGRADES.GUARD.cost + 30) {
      this.game.purchaseUpgrade(playerId, 'GUARD', true);
      return;
    }

    // Reflex if we have Combat Training
    if (economy.hasUpgrade(playerId, 'COMBAT_TRAINING') &&
        !economy.hasUpgrade(playerId, 'REFLEX') &&
        reputation >= CONSTANTS.UNIT_UPGRADES.REFLEX.cost) {
      this.game.purchaseUpgrade(playerId, 'REFLEX', false);
    }
  }

  assignIdleUnits(playerId) {
    const ownUnits = this.game.units.filter(u =>
      u.playerId === playerId && u.health > 0 && u.state === 'idle'
    );

    // Harder difficulties don't wait as long
    const minUnitsToAct = this.difficulty === 'INSANE' ? 1 :
                          this.difficulty === 'HARD' ? 2 : 3;

    if (ownUnits.length < minUnitsToAct) return;

    const school = this.game.schools[playerId];

    // Determine target based on strategy
    const strategy = this.aiStrategies[playerId];

    // For INSANE difficulty with map awareness, find and attack enemy clusters
    if (this.difficultySettings.mapAwareness) {
      const weakestEnemy = this.findWeakestEnemyCluster(playerId);
      if (weakestEnemy) {
        for (const unit of ownUnits) {
          unit.setTarget(weakestEnemy.x, weakestEnemy.y, true);
        }
        return;
      }
    }

    // Attack threshold varies by difficulty
    const attackThreshold = this.difficulty === 'INSANE' ? 2 :
                           this.difficulty === 'HARD' ? 3 :
                           this.difficulty === 'EASY' ? 7 : 5;

    if (strategy === 'aggressive' && ownUnits.length >= attackThreshold) {
      // Attack enemy school
      const enemySchool = this.findWeakestEnemySchool(playerId);
      if (enemySchool) {
        const attackRatio = this.difficulty === 'INSANE' ? 0.9 :
                           this.difficulty === 'HARD' ? 0.8 : 0.7;
        const attackForce = ownUnits.slice(0, Math.ceil(ownUnits.length * attackRatio));
        for (const unit of attackForce) {
          unit.setTarget(enemySchool.x, enemySchool.y, true);
        }
      }
    } else {
      // Capture nearest unclaimed flag
      const targetFlag = this.findBestFlagTarget(playerId);
      if (targetFlag) {
        const captureSize = this.difficulty === 'INSANE' ? ownUnits.length :
                          this.difficulty === 'HARD' ? Math.min(5, ownUnits.length) : 3;
        const captureForce = ownUnits.slice(0, captureSize);
        for (const unit of captureForce) {
          unit.setTarget(targetFlag.x, targetFlag.y, true);
        }
      }
    }
  }

  findWeakestEnemyCluster(playerId) {
    // Find clusters of enemy units and target the weakest
    const enemyUnits = this.game.units.filter(u =>
      u.playerId !== playerId && u.health > 0
    );

    // Include military units as enemies
    if (this.game.militaryUnits) {
      for (const military of this.game.militaryUnits) {
        if (military.health > 0) {
          enemyUnits.push(military);
        }
      }
    }

    if (enemyUnits.length === 0) return null;

    // Find the weakest enemy unit cluster
    let weakestPos = null;
    let lowestStrength = Infinity;

    for (const enemy of enemyUnits) {
      const nearbyStrength = enemyUnits
        .filter(u => Math.hypot(u.x - enemy.x, u.y - enemy.y) < 100)
        .reduce((sum, u) => sum + u.health, 0);

      if (nearbyStrength < lowestStrength) {
        lowestStrength = nearbyStrength;
        weakestPos = { x: enemy.x, y: enemy.y };
      }
    }

    return weakestPos;
  }

  findWeakestEnemySchool(playerId) {
    let weakestSchool = null;
    let lowestHealth = Infinity;

    for (const school of this.game.schools) {
      if (school.playerId === playerId) continue;
      if (school.health <= 0 || school.destroyed) continue;

      if (school.health < lowestHealth) {
        lowestHealth = school.health;
        weakestSchool = school;
      }
    }

    return weakestSchool;
  }

  findBestFlagTarget(playerId) {
    const school = this.game.schools[playerId];

    // Get unowned or enemy flags
    const targetFlags = this.game.flags.filter(f => f.ownerId !== playerId);

    if (targetFlags.length === 0) return null;

    // Score flags based on distance and current owner
    let bestFlag = null;
    let bestScore = -Infinity;

    for (const flag of targetFlags) {
      const distance = school.getDistanceTo(flag);
      let score = 1000 - distance; // Prefer closer flags

      // Bonus for neutral flags
      if (flag.ownerId === null) {
        score += 200;
      }

      // Penalty for contested flags
      if (flag.captureProgress > 0 && flag.capturingPlayerId !== playerId) {
        score -= 100;
      }

      if (score > bestScore) {
        bestScore = score;
        bestFlag = flag;
      }
    }

    return bestFlag;
  }
}
