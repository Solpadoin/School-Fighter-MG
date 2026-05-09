// Main Game class - handles game loop and state

class Game {
  constructor(options) {
    this.mode = options.mode || 'singleplayer';
    this.playerCount = options.playerCount || 2;
    this.localPlayerId = options.localPlayerId || 0;
    this.settings = options.settings || {};
    this.networkClient = options.networkClient || null;
    this.aiDifficulty = options.aiDifficulty || 'MID';

    // Map dimensions (scaled based on player count)
    const mapScale = CONSTANTS.MAP_SCALES[this.playerCount] || CONSTANTS.MAP_SCALES[4];
    this.mapWidth = mapScale.width;
    this.mapHeight = mapScale.height;

    // Game state
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.gameOverTriggered = false;
    this.gameTime = 0;

    // Time tracking
    this.lastTime = 0;
    this.deltaTime = 0;
    this.tickAccumulator = 0;
    this.tickRate = 1000 / 60; // 60 updates per second

    // Canvas setup
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    // Camera/viewport
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: 0.5,
      maxZoom: 2
    };

    // Entities
    this.schools = [];
    this.units = [];
    this.flags = [];

    // Airstrike system
    this.airstrikes = [];
    this.airstrikeMode = false;
    this.airstrikeCooldowns = {};

    // Glory To Victory cooldowns
    this.gloryCooldowns = {};

    // Grenades (from Kid units)
    this.grenades = [];

    // Military airdrop
    this.lastAirdropTime = 0;
    this.militaryUnits = []; // Neutral military units

    // Animation/effects
    this.effects = [];
    this.dyingUnits = [];

    // Initialize systems
    this.renderer = new Renderer(this);
    this.input = new Input(this);
    this.selection = new SelectionSystem(this);
    this.combat = new CombatSystem(this);
    this.economy = new EconomySystem(this);
    this.fogOfWar = new FogOfWarSystem(this);
    this.sound = new SoundSystem(this);

    // AI for singleplayer
    if (this.mode === 'singleplayer') {
      this.ai = new AISystem(this, this.aiDifficulty);
    }

    // Set up initial game state
    if (options.initialState) {
      this.loadState(options.initialState);
    } else {
      this.initializeGame();
    }

    // Window resize handler
    window.addEventListener('resize', () => this.resizeCanvas());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initializeGame() {
    // Create schools for each player
    const schoolPositions = this.getSchoolPositions(this.playerCount);

    for (let i = 0; i < this.playerCount; i++) {
      const school = new School({
        id: i,
        playerId: i,
        x: schoolPositions[i].x,
        y: schoolPositions[i].y,
        health: CONSTANTS.SCHOOL_MAX_HEALTH,
        maxHealth: CONSTANTS.SCHOOL_MAX_HEALTH
      });
      this.schools.push(school);
    }

    // Calculate flag count based on player count
    const flagCount = Math.floor(CONSTANTS.FLAG_COUNT * (this.playerCount / 4) * 1.5);

    // Create flags at random positions
    const flagPositions = this.generateFlagPositions(Math.max(5, flagCount));
    flagPositions.forEach((pos, index) => {
      const flag = new Flag({
        id: index,
        x: pos.x,
        y: pos.y
      });
      this.flags.push(flag);
    });

    // Initialize economy for each player
    this.economy.initialize(this.playerCount);

    // Initialize cooldowns
    for (let i = 0; i < this.playerCount; i++) {
      this.airstrikeCooldowns[i] = 0;
      this.gloryCooldowns[i] = 0;
    }

    // Center camera on local player's school
    const localSchool = this.schools[this.localPlayerId];
    this.camera.x = localSchool.x - this.canvas.width / 2;
    this.camera.y = localSchool.y - this.canvas.height / 2;
  }

  getSchoolPositions(playerCount) {
    const margin = 150;
    const positions = [
      { x: margin, y: margin }, // Top-left (Player 1)
      { x: this.mapWidth - margin, y: this.mapHeight - margin }, // Bottom-right (Player 2)
      { x: this.mapWidth - margin, y: margin }, // Top-right (Player 3)
      { x: margin, y: this.mapHeight - margin } // Bottom-left (Player 4)
    ];
    return positions.slice(0, playerCount);
  }

  generateFlagPositions(count) {
    const positions = [];
    const margin = 200;
    const minDistance = 120;

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let pos;

      do {
        pos = {
          x: margin + Math.random() * (this.mapWidth - margin * 2),
          y: margin + Math.random() * (this.mapHeight - margin * 2)
        };
        attempts++;
      } while (this.isTooCloseToExisting(pos, positions, minDistance) && attempts < 100);

      positions.push(pos);
    }

    return positions;
  }

  isTooCloseToExisting(pos, existingPositions, minDistance) {
    // Check against schools
    for (const school of this.schools) {
      const dist = Math.hypot(pos.x - school.x, pos.y - school.y);
      if (dist < minDistance + 100) return true;
    }

    // Check against other flags
    for (const existing of existingPositions) {
      const dist = Math.hypot(pos.x - existing.x, pos.y - existing.y);
      if (dist < minDistance) return true;
    }

    return false;
  }

  loadState(state) {
    // Load game state from server (multiplayer)
    this.schools = state.schools.map(s => new School(s));
    this.units = state.units.map(u => new Unit(u));
    this.flags = state.flags.map(f => new Flag(f));
    this.economy.loadState(state.economy);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();

    // Initialize sound system
    this.sound.init();

    // Apply volume settings
    if (this.settings) {
      this.sound.setVolume('sfx', (this.settings.sfxVolume || 50) / 100);
      this.sound.setVolume('music', (this.settings.musicVolume || 50) / 100);
    }

    // Show school panel
    document.getElementById('school-panel').classList.remove('hidden');

    console.log('Game started');
  }

  stop() {
    this.running = false;
    document.getElementById('school-panel').classList.add('hidden');
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
  }

  gameLoop(currentTime = performance.now()) {
    if (!this.running) return;

    requestAnimationFrame((t) => this.gameLoop(t));

    if (this.paused) return;

    // Calculate delta time
    this.deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Cap delta time to prevent spiral of death
    this.deltaTime = Math.min(this.deltaTime, 0.1);

    // Fixed timestep for game logic
    this.tickAccumulator += this.deltaTime * 1000;

    while (this.tickAccumulator >= this.tickRate) {
      this.update(this.tickRate / 1000);
      this.tickAccumulator -= this.tickRate;
    }

    // Render at display rate
    this.render();
  }

  update(dt) {
    if (this.gameOver) return;

    this.gameTime += dt;

    // Update input (for edge panning)
    this.input.update(dt);

    // Update camera
    this.updateCamera(dt);

    // Update all systems
    this.economy.update(dt);
    this.combat.update(dt);
    this.fogOfWar.update();

    // Update entities
    for (const unit of this.units) {
      unit.update(dt, this);
    }

    for (const school of this.schools) {
      school.update(dt, this);
    }

    for (const flag of this.flags) {
      flag.update(dt, this);
    }

    // Update dying units (death animation)
    this.updateDyingUnits(dt);

    // Update airstrikes
    this.updateAirstrikes(dt);

    // Update grenades
    this.updateGrenades(dt);

    // Update military airdrop
    this.updateMilitaryAirdrop(dt);

    // Update military units (neutral faction)
    this.updateMilitaryUnits(dt);

    // Update effects
    this.updateEffects(dt);

    // Update cooldowns
    this.updateCooldowns(dt);

    // Update flag panel if a flag is selected AND building is in progress
    // Only update during build progress to avoid interfering with button clicks
    if (this.selection.selectedFlag) {
      const flag = this.selection.selectedFlag;
      if (flag.towerBuilding || flag.sandbagsBuilding) {
        this.selection.updateFlagPanel();
      }
    }

    // Update AI in singleplayer
    if (this.mode === 'singleplayer' && this.ai) {
      this.ai.update(dt);
    }

    // Update footstep sounds for moving selected units
    this.sound.updateFootsteps(this.units, this.localPlayerId);

    // Check win/lose conditions
    this.checkGameOver();

    // Send state update in multiplayer
    if (this.mode === 'multiplayer' && this.networkClient) {
      // Input is sent via actions, state received from server
    }
  }

  updateCamera(dt) {
    // Camera panning via edge scrolling or WASD is handled by Input class
    // Clamp camera to map bounds
    const maxX = this.mapWidth - this.canvas.width / this.camera.zoom;
    const maxY = this.mapHeight - this.canvas.height / this.camera.zoom;

    this.camera.x = Math.max(0, Math.min(this.camera.x, maxX));
    this.camera.y = Math.max(0, Math.min(this.camera.y, maxY));
  }

  updateDyingUnits(dt) {
    for (let i = this.dyingUnits.length - 1; i >= 0; i--) {
      const dying = this.dyingUnits[i];
      dying.deathTimer -= dt;
      dying.opacity = Math.max(0, dying.deathTimer / dying.deathDuration);

      if (dying.deathTimer <= 0) {
        this.dyingUnits.splice(i, 1);
      }
    }
  }

  updateAirstrikes(dt) {
    for (let i = this.airstrikes.length - 1; i >= 0; i--) {
      const strike = this.airstrikes[i];

      // Update plane position
      strike.planeX += strike.planeVelX * dt;
      strike.planeY += strike.planeVelY * dt;
      strike.time += dt;

      // Check if plane reached drop point
      const distToDrop = Math.hypot(strike.planeX - strike.targetX, strike.planeY - strike.targetY);

      if (!strike.dropped && distToDrop < 50) {
        strike.dropped = true;
        this.dropBooks(strike);
      }

      // Update falling books
      for (const book of strike.books) {
        if (!book.landed) {
          book.y += book.fallSpeed * dt;
          book.rotation += book.rotationSpeed * dt;
          book.fallSpeed += 500 * dt; // Gravity

          // Check if book landed
          if (book.y >= book.targetY) {
            book.landed = true;
            book.landTime = 0;

            // Create impact effect
            this.effects.push({
              type: 'book_impact',
              x: book.x,
              y: book.targetY,
              duration: 0.5,
              time: 0
            });
          }
        } else {
          book.landTime += dt;
        }
      }

      // Check if all books landed and apply damage
      if (strike.dropped && strike.books.every(b => b.landed)) {
        if (!strike.damageApplied) {
          this.applyAirstrikeDamage(strike);
          strike.damageApplied = true;
        }

        // Remove strike after animation
        if (strike.books.every(b => b.landTime > 0.5)) {
          this.airstrikes.splice(i, 1);
        }
      }

      // Remove if plane left map
      if (strike.planeX < -200 || strike.planeX > this.mapWidth + 200 ||
          strike.planeY < -200 || strike.planeY > this.mapHeight + 200) {
        if (strike.damageApplied || !strike.dropped) {
          this.airstrikes.splice(i, 1);
        }
      }
    }
  }

  dropBooks(strike) {
    const bookCount = CONSTANTS.AIRSTRIKE.bookCount;

    for (let i = 0; i < bookCount; i++) {
      const angle = (i / bookCount) * Math.PI * 2;
      const dist = Math.random() * CONSTANTS.AIRSTRIKE.radius * 0.8;

      strike.books.push({
        x: strike.targetX + Math.cos(angle) * dist,
        y: strike.planeY - 50,
        targetY: strike.targetY + Math.sin(angle) * dist * 0.3,
        fallSpeed: 100 + Math.random() * 50,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        landed: false,
        landTime: 0
      });
    }
  }

  applyAirstrikeDamage(strike) {
    const radius = CONSTANTS.AIRSTRIKE.radius;
    const damage = CONSTANTS.AIRSTRIKE.damage;

    // Damage all enemy units in radius
    for (const unit of this.units) {
      if (unit.playerId === strike.playerId) continue;

      const dist = Math.hypot(unit.x - strike.targetX, unit.y - strike.targetY);
      if (dist <= radius) {
        // Add to dying units for animation
        this.dyingUnits.push({
          ...unit,
          deathTimer: 0.8,
          deathDuration: 0.8,
          opacity: 1,
          deathType: 'airstrike'
        });

        unit.health = 0;
      }
    }

    // Clean up dead units
    this.units = this.units.filter(u => u.health > 0);

    // Play explosion sound
    this.sound.playExplosion();

    // Big explosion effect
    this.effects.push({
      type: 'explosion',
      x: strike.targetX,
      y: strike.targetY,
      radius: radius,
      duration: 1,
      time: 0
    });
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.time += dt;

      if (effect.time >= effect.duration) {
        this.effects.splice(i, 1);
      }
    }
  }

  updateCooldowns(dt) {
    for (const playerId in this.airstrikeCooldowns) {
      if (this.airstrikeCooldowns[playerId] > 0) {
        this.airstrikeCooldowns[playerId] -= dt * 1000;
      }
    }

    for (const playerId in this.gloryCooldowns) {
      if (this.gloryCooldowns[playerId] > 0) {
        this.gloryCooldowns[playerId] -= dt * 1000;
      }
    }

    // Update Glory cooldown UI
    if (this.localPlayerId !== undefined) {
      const gloryCooldown = this.gloryCooldowns[this.localPlayerId] || 0;
      const maxGloryCooldown = CONSTANTS.GLORY_TO_VICTORY.cooldown;
      const gloryProgress = Math.max(0, 1 - gloryCooldown / maxGloryCooldown);

      const gloryCooldownFill = document.getElementById('glory-cooldown');
      if (gloryCooldownFill) {
        gloryCooldownFill.style.width = (gloryProgress * 100) + '%';
      }

      const gloryBtn = document.getElementById('btn-glory');
      if (gloryBtn) {
        gloryBtn.classList.toggle('on-cooldown', gloryCooldown > 0);
      }
    }

    // Update UI cooldown bar
    if (this.localPlayerId !== undefined) {
      const cooldown = this.airstrikeCooldowns[this.localPlayerId] || 0;
      const maxCooldown = CONSTANTS.AIRSTRIKE.cooldown;
      const progress = Math.max(0, 1 - cooldown / maxCooldown);

      const cooldownFill = document.getElementById('airstrike-cooldown');
      if (cooldownFill) {
        cooldownFill.style.width = (progress * 100) + '%';
      }

      const btn = document.getElementById('btn-airstrike');
      if (btn) {
        btn.classList.toggle('on-cooldown', cooldown > 0);
      }
    }
  }

  // Airstrike methods
  canUseAirstrike(playerId) {
    const cooldown = this.airstrikeCooldowns[playerId] || 0;
    if (cooldown > 0) return false;
    if (!this.economy.canAfford(playerId, CONSTANTS.AIRSTRIKE.cost)) return false;
    return true;
  }

  startAirstrikeMode() {
    if (this.airstrikeCooldowns[this.localPlayerId] > 0) {
      return false;
    }

    if (!this.economy.canAfford(this.localPlayerId, CONSTANTS.AIRSTRIKE.cost)) {
      return false;
    }

    this.airstrikeMode = true;
    document.body.classList.add('airstrike-mode');
    document.getElementById('airstrike-indicator').classList.remove('hidden');

    return true;
  }

  cancelAirstrikeMode() {
    this.airstrikeMode = false;
    document.body.classList.remove('airstrike-mode');
    document.getElementById('airstrike-indicator').classList.add('hidden');
  }

  executeAirstrike(targetX, targetY) {
    if (!this.airstrikeMode) return;

    // Deduct cost
    this.economy.spend(this.localPlayerId, CONSTANTS.AIRSTRIKE.cost);

    // Set cooldown
    this.airstrikeCooldowns[this.localPlayerId] = CONSTANTS.AIRSTRIKE.cooldown;

    // Calculate plane entry point (from edge of screen, not whole map)
    const angle = Math.random() * Math.PI * 2;
    const startDist = 400; // Start closer so plane is visible
    const startX = targetX - Math.cos(angle) * startDist;
    const startY = targetY - Math.sin(angle) * startDist;

    console.log('Airstrike launched at', targetX, targetY, 'plane starts at', startX, startY);

    // Play airstrike sound
    this.sound.playAirstrikeIncoming();

    // Create airstrike
    this.airstrikes.push({
      playerId: this.localPlayerId,
      targetX: targetX,
      targetY: targetY,
      planeX: startX,
      planeY: startY,
      planeVelX: Math.cos(angle) * CONSTANTS.AIRSTRIKE.planeSpeed,
      planeVelY: Math.sin(angle) * CONSTANTS.AIRSTRIKE.planeSpeed,
      planeAngle: angle,
      time: 0,
      dropped: false,
      damageApplied: false,
      books: []
    });

    this.cancelAirstrikeMode();
  }

  // Glory To Victory skill
  canUseGlory(playerId) {
    const cooldown = this.gloryCooldowns[playerId] || 0;
    if (cooldown > 0) return false;
    if (!this.economy.canAfford(playerId, CONSTANTS.GLORY_TO_VICTORY.cost)) return false;
    return true;
  }

  executeGlory(playerId) {
    if (!this.canUseGlory(playerId)) return false;

    // Deduct cost
    this.economy.spend(playerId, CONSTANTS.GLORY_TO_VICTORY.cost);

    // Set cooldown
    this.gloryCooldowns[playerId] = CONSTANTS.GLORY_TO_VICTORY.cooldown;

    // Heal all owned units
    for (const unit of this.units) {
      if (unit.playerId === playerId && unit.health > 0) {
        unit.health = unit.maxHealth;
      }
    }

    // Heal school
    const school = this.schools[playerId];
    if (school && school.health > 0 && !school.destroyed) {
      school.health = Math.min(school.health + CONSTANTS.GLORY_TO_VICTORY.schoolHeal, school.maxHealth);
    }

    // Play sound
    if (this.sound) {
      this.sound.playGlory();
    }

    // Show effect on all units and school
    if (playerId === this.localPlayerId) {
      this.showNotification('Glory To Victory! All units healed!', 'info');
    }

    // Add heal effects
    for (const unit of this.units) {
      if (unit.playerId === playerId && unit.health > 0) {
        this.effects.push({
          type: 'heal',
          x: unit.x,
          y: unit.y,
          duration: 1,
          time: 0
        });
      }
    }

    if (school && school.health > 0) {
      this.effects.push({
        type: 'heal',
        x: school.x,
        y: school.y,
        duration: 1,
        time: 0
      });
    }

    return true;
  }

  // Grenade system (for Kid units)
  updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const grenade = this.grenades[i];

      // Move grenade
      const dx = grenade.targetX - grenade.x;
      const dy = grenade.targetY - grenade.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 10) {
        // Grenade landed - explode
        this.explodeGrenade(grenade);
        this.grenades.splice(i, 1);
      } else {
        // Move towards target
        const speed = 300 * dt;
        grenade.x += (dx / dist) * speed;
        grenade.y += (dy / dist) * speed;
        grenade.rotation += dt * 10;

        // Arc trajectory
        grenade.height = Math.sin(grenade.progress * Math.PI) * 50;
        grenade.progress += dt * 2;
      }
    }
  }

  explodeGrenade(grenade) {
    const config = CONSTANTS.UNIT_TYPES.KID;
    const radius = config.splashRadius;
    const damage = config.damage;

    // Damage all units in radius (except own units)
    for (const unit of this.units) {
      if (unit.playerId === grenade.playerId) continue;
      if (unit.health <= 0) continue;

      const dist = Math.hypot(unit.x - grenade.targetX, unit.y - grenade.targetY);
      if (dist <= radius) {
        // Damage falls off with distance
        const damageMultiplier = 1 - (dist / radius) * 0.5;
        unit.takeDamage(damage * damageMultiplier, this);
      }
    }

    // Also damage military units
    for (const unit of this.militaryUnits) {
      if (unit.health <= 0) continue;

      const dist = Math.hypot(unit.x - grenade.targetX, unit.y - grenade.targetY);
      if (dist <= radius) {
        const damageMultiplier = 1 - (dist / radius) * 0.5;
        unit.health -= damage * damageMultiplier;
        if (unit.health <= 0) {
          unit.health = 0;
        }
      }
    }

    // Play explosion sound
    if (this.sound) {
      this.sound.playGrenadeExplosion();
    }

    // Add explosion effect
    this.effects.push({
      type: 'grenade_explosion',
      x: grenade.targetX,
      y: grenade.targetY,
      radius: radius,
      duration: 0.5,
      time: 0
    });
  }

  throwGrenade(unit, target) {
    this.grenades.push({
      playerId: unit.playerId,
      x: unit.x,
      y: unit.y,
      targetX: target.x,
      targetY: target.y,
      rotation: 0,
      height: 0,
      progress: 0
    });
  }

  // Military Airdrop system
  updateMilitaryAirdrop(dt) {
    this.lastAirdropTime += dt * 1000;

    if (this.lastAirdropTime >= CONSTANTS.MILITARY_AIRDROP.interval) {
      this.lastAirdropTime = 0;
      this.spawnMilitaryAirdrop();
    }
  }

  spawnMilitaryAirdrop() {
    const config = CONSTANTS.MILITARY_AIRDROP;
    const unitCount = config.minUnits + Math.floor(Math.random() * (config.maxUnits - config.minUnits + 1));

    // Center of map with some randomness
    const centerX = this.mapWidth / 2;
    const centerY = this.mapHeight / 2;

    // Play airdrop sound
    if (this.sound) {
      this.sound.playAirstrikeIncoming();
    }

    // Show notification
    this.showNotification('Military Airdrop incoming!', 'info');

    // Spawn military units after a delay (simulating the drop)
    setTimeout(() => {
      for (let i = 0; i < unitCount; i++) {
        const angle = (i / unitCount) * Math.PI * 2;
        const dist = Math.random() * config.spawnRadius;
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;

        const militaryConfig = CONSTANTS.UNIT_TYPES.MILITARY;
        const military = {
          id: 'military_' + Date.now() + '_' + i,
          x: x,
          y: y,
          health: militaryConfig.health,
          maxHealth: militaryConfig.health,
          damage: militaryConfig.damage,
          speed: militaryConfig.speed,
          attackRange: militaryConfig.attackRange,
          attackCooldown: militaryConfig.attackCooldown,
          lastAttackTime: 0,
          visionRadius: militaryConfig.visionRadius,
          target: null,
          state: 'idle',
          animTime: 0,
          muzzleFlash: 0,
          lastFootstep: 0
        };

        this.militaryUnits.push(military);
      }

      // Add drop effect
      this.effects.push({
        type: 'airdrop',
        x: centerX,
        y: centerY,
        duration: 1,
        time: 0
      });
    }, 1500);
  }

  updateMilitaryUnits(dt) {
    for (let i = this.militaryUnits.length - 1; i >= 0; i--) {
      const military = this.militaryUnits[i];

      if (military.health <= 0) {
        // Add death effect
        this.dyingUnits.push({
          x: military.x,
          y: military.y,
          type: 'MILITARY',
          playerId: -1,
          deathTimer: 0.8,
          deathDuration: 0.8,
          opacity: 1
        });

        // Play death sound
        if (this.sound) {
          this.sound.playDeath();
        }

        this.militaryUnits.splice(i, 1);
        continue;
      }

      // Update attack cooldown
      military.lastAttackTime = Math.max(0, military.lastAttackTime - dt * 1000);

      // Update muzzle flash timer
      if (military.muzzleFlash > 0) {
        military.muzzleFlash -= dt;
      }

      // Update animation time
      military.animTime = (military.animTime || 0) + dt;

      // Find nearest target (any player's units or schools)
      let nearestTarget = null;
      let nearestDist = Infinity;

      // Check all player units
      for (const unit of this.units) {
        if (unit.health <= 0) continue;
        const dist = Math.hypot(unit.x - military.x, unit.y - military.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestTarget = unit;
        }
      }

      // Check schools
      for (const school of this.schools) {
        if (school.health <= 0 || school.destroyed) continue;
        const dist = Math.hypot(school.x - military.x, school.y - military.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestTarget = school;
        }
      }

      military.target = nearestTarget;
      military.state = 'idle';

      if (nearestTarget) {
        if (nearestDist <= military.attackRange) {
          // Attack
          military.state = 'attacking';
          if (military.lastAttackTime <= 0) {
            // Shoot
            if (nearestTarget.takeDamage) {
              nearestTarget.takeDamage(military.damage, this);
            } else {
              nearestTarget.health -= military.damage;
            }
            military.lastAttackTime = military.attackCooldown;
            military.muzzleFlash = 0.1; // Show muzzle flash for 100ms

            // Add bullet effect
            this.effects.push({
              type: 'bullet',
              startX: military.x,
              startY: military.y,
              endX: nearestTarget.x,
              endY: nearestTarget.y,
              duration: 0.1,
              time: 0
            });

            // Play shot sound
            if (this.sound) {
              this.sound.playGunshot();
            }
          }
        } else if (nearestDist <= 300) {
          // Move towards target
          military.state = 'moving';
          const dx = nearestTarget.x - military.x;
          const dy = nearestTarget.y - military.y;
          military.x += (dx / nearestDist) * military.speed * dt;
          military.y += (dy / nearestDist) * military.speed * dt;

          // Play footstep sounds occasionally
          if (!military.lastFootstep) military.lastFootstep = 0;
          military.lastFootstep += dt;
          if (military.lastFootstep > 0.4 && this.sound) {
            this.sound.playFootstep();
            military.lastFootstep = 0;
          }
        }
      }
    }
  }

  render() {
    this.renderer.render();
  }

  // Game actions

  createUnit(playerId, unitType) {
    const school = this.schools[playerId];
    const unitConfig = CONSTANTS.UNIT_TYPES[unitType];

    if (!school || !unitConfig) return false;

    // Check if player can afford
    const cost = unitConfig.cost;
    if (!this.economy.canAfford(playerId, cost)) {
      return false;
    }

    // Check unit limit
    const currentCount = this.getUnitCount(playerId, unitType);
    if (currentCount >= unitConfig.limit) {
      return false;
    }

    // Deduct cost
    this.economy.spend(playerId, cost);

    // Create unit near school
    const angle = Math.random() * Math.PI * 2;
    const distance = CONSTANTS.SCHOOL_SIZE + 20;
    const spawnX = school.x + Math.cos(angle) * distance;
    const spawnY = school.y + Math.sin(angle) * distance;

    const unit = new Unit({
      id: this.generateUnitId(),
      playerId: playerId,
      type: unitType,
      x: spawnX,
      y: spawnY,
      health: this.getUnitMaxHealth(playerId, unitType),
      maxHealth: this.getUnitMaxHealth(playerId, unitType)
    });

    // Apply upgrades
    if (this.economy.hasUpgrade(playerId, 'COMBAT_TRAINING')) {
      unit.damageBonus = 0.2;
    }
    if (this.economy.hasUpgrade(playerId, 'REFLEX')) {
      unit.healthBonus = 0.4;
      unit.health = unit.maxHealth * (1 + unit.healthBonus);
      unit.maxHealth = unit.health;
    }

    this.units.push(unit);

    // Play spawn sound for local player units
    if (playerId === this.localPlayerId) {
      this.sound.playSpawn();
    }

    return true;
  }

  getUnitMaxHealth(playerId, unitType) {
    let health = CONSTANTS.UNIT_TYPES[unitType].health;

    if (this.economy.hasUpgrade(playerId, 'REFLEX')) {
      health *= (1 + CONSTANTS.UNIT_UPGRADES.REFLEX.effect.value);
    }

    return health;
  }

  generateUnitId() {
    return 'unit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getUnitCount(playerId, unitType) {
    return this.units.filter(u => u.playerId === playerId && u.type === unitType && u.health > 0).length;
  }

  getTotalUnitCount(playerId) {
    return this.units.filter(u => u.playerId === playerId && u.health > 0).length;
  }

  moveUnits(unitIds, targetX, targetY, attackMove = false) {
    const unitsToMove = this.units.filter(u => unitIds.includes(u.id));

    if (unitsToMove.length === 0) return;

    // Calculate formation positions
    const positions = this.calculateFormation(unitsToMove.length, targetX, targetY);

    unitsToMove.forEach((unit, index) => {
      unit.setTarget(positions[index].x, positions[index].y, attackMove);
    });
  }

  calculateFormation(unitCount, centerX, centerY) {
    const positions = [];
    const spacing = 40;

    if (unitCount === 1) {
      positions.push({ x: centerX, y: centerY });
    } else {
      // Arrange in a grid formation
      const cols = Math.ceil(Math.sqrt(unitCount));
      const rows = Math.ceil(unitCount / cols);
      const startX = centerX - (cols - 1) * spacing / 2;
      const startY = centerY - (rows - 1) * spacing / 2;

      for (let i = 0; i < unitCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({
          x: startX + col * spacing,
          y: startY + row * spacing
        });
      }
    }

    return positions;
  }

  removeUnit(unit) {
    const index = this.units.indexOf(unit);
    if (index > -1) {
      this.units.splice(index, 1);
    }
  }

  purchaseUpgrade(playerId, upgradeType, isSchoolUpgrade) {
    const upgrades = isSchoolUpgrade ? CONSTANTS.SCHOOL_UPGRADES : CONSTANTS.UNIT_UPGRADES;
    const upgrade = upgrades[upgradeType];

    if (!upgrade) return false;

    // Check requirements
    if (upgrade.requires && !this.economy.hasUpgrade(playerId, upgrade.requires)) {
      return false;
    }

    // Check if already purchased
    if (this.economy.hasUpgrade(playerId, upgradeType)) {
      return false;
    }

    // Check cost
    if (!this.economy.canAfford(playerId, upgrade.cost)) {
      return false;
    }

    // Purchase
    this.economy.spend(playerId, upgrade.cost);
    this.economy.addUpgrade(playerId, upgradeType);

    // Apply effects
    this.applyUpgrade(playerId, upgradeType, upgrade);

    return true;
  }

  applyUpgrade(playerId, upgradeType, upgrade) {
    const school = this.schools[playerId];

    switch (upgrade.effect.type) {
      case 'damage_reduction':
        school.damageReduction = upgrade.effect.value;
        break;
      case 'hp_bonus':
        const bonus = school.maxHealth * upgrade.effect.value;
        school.maxHealth += bonus;
        school.health += bonus;
        break;
      case 'double_income':
        this.economy.setIncomeMultiplier(playerId, upgrade.effect.value);
        break;
      case 'damage_bonus':
        // Apply to all existing units
        this.units.filter(u => u.playerId === playerId).forEach(unit => {
          unit.damageBonus = upgrade.effect.value;
        });
        break;
      case 'health_bonus':
        // Apply to all existing units
        this.units.filter(u => u.playerId === playerId).forEach(unit => {
          const healthIncrease = unit.maxHealth * upgrade.effect.value;
          unit.maxHealth += healthIncrease;
          unit.health += healthIncrease;
        });
        break;
    }
  }

  onSchoolDestroyed(school) {
    // Get player name/color
    const playerColors = ['Blue', 'Red', 'Green', 'Yellow'];
    const playerName = school.playerId === this.localPlayerId ? 'Your school' : `${playerColors[school.playerId]} Player`;

    // Show notification to all players
    this.showNotification(`${playerName} has been destroyed!`, school.playerId === this.localPlayerId ? 'defeat' : 'info');

    // Kill all units belonging to destroyed player
    for (const unit of this.units) {
      if (unit.playerId === school.playerId && unit.health > 0) {
        // Add to dying units for death animation
        this.dyingUnits.push({
          x: unit.x,
          y: unit.y,
          type: unit.type,
          playerId: unit.playerId,
          deathTimer: 1,
          deathDuration: 1,
          opacity: 1
        });
        unit.health = 0;
      }
    }

    // If local player's school was destroyed, show defeat menu after animation
    if (school.playerId === this.localPlayerId) {
      setTimeout(() => {
        this.showDefeatedMenu();
      }, 2000);
    }
  }

  showDefeatedMenu() {
    // Show special defeated menu for eliminated player
    const defeatedMenu = document.getElementById('defeated-menu');
    if (defeatedMenu) {
      defeatedMenu.classList.remove('hidden');
    } else {
      // Create the menu if it doesn't exist
      const gameScreen = document.getElementById('game-screen');
      const menu = document.createElement('div');
      menu.id = 'defeated-menu';
      menu.className = 'menu-overlay';
      menu.innerHTML = `
        <div class="menu-container defeated-container">
          <div class="defeated-icon">💀</div>
          <h2 class="defeated-title">You Have Been Eliminated!</h2>
          <p class="defeated-message">Your school has been destroyed. Better luck next time!</p>
          <div class="menu-buttons">
            <button id="btn-spectate" class="menu-btn">Spectate Game</button>
            <button id="btn-exit-defeated" class="menu-btn secondary">Exit to Menu</button>
          </div>
        </div>
      `;
      gameScreen.appendChild(menu);

      // Add event listeners
      document.getElementById('btn-spectate').addEventListener('click', () => {
        menu.classList.add('hidden');
        this.showNotification('Spectating...', 'info');
      });

      document.getElementById('btn-exit-defeated').addEventListener('click', () => {
        menu.classList.add('hidden');
        window.main.quitToMenu();
      });
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `game-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-icon">${type === 'defeat' ? '💀' : '⚔️'}</div>
      <div class="notification-text">${message}</div>
    `;

    // Add to game screen
    const gameScreen = document.getElementById('game-screen');
    gameScreen.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  }

  checkGameOver() {
    if (this.gameOverTriggered) return; // Prevent multiple triggers

    const aliveSchools = this.schools.filter(s => !s.destroyed && s.health > 0);

    if (aliveSchools.length <= 1) {
      this.gameOver = true;
      this.gameOverTriggered = true;

      const winner = aliveSchools[0];
      const isLocalWinner = winner && winner.playerId === this.localPlayerId;

      let message;
      if (!winner) {
        message = 'All schools have been destroyed!';
      } else if (isLocalWinner) {
        message = 'You have conquered all enemy schools!';
      } else {
        message = 'Your school has been destroyed!';
      }

      // Delay game over screen to let destruction animation play
      setTimeout(() => {
        window.main.showGameOver(isLocalWinner, message);
      }, 2000);
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (this.gameOver) return;

      if (this.paused) {
        this.resume();
        document.getElementById('pause-menu').classList.add('hidden');
      } else {
        this.pause();
        document.getElementById('pause-menu').classList.remove('hidden');
      }
    }
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX, screenY) {
    return {
      x: screenX / this.camera.zoom + this.camera.x,
      y: screenY / this.camera.zoom + this.camera.y
    };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.camera.x) * this.camera.zoom,
      y: (worldY - this.camera.y) * this.camera.zoom
    };
  }

  // Network action handlers
  sendAction(action) {
    if (this.mode === 'multiplayer' && this.networkClient) {
      this.networkClient.sendAction(action);
    }
  }

  receiveGameState(state) {
    // Update game state from server
    this.loadState(state);
  }
}
