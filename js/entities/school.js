// School entity class - the player's base

class School {
  constructor(options) {
    this.id = options.id;
    this.playerId = options.playerId;

    // Position
    this.x = options.x || 0;
    this.y = options.y || 0;

    // Health
    this.maxHealth = options.maxHealth || CONSTANTS.SCHOOL_MAX_HEALTH;
    this.health = options.health || this.maxHealth;

    // Upgrades
    this.damageReduction = options.damageReduction || 0;

    // Size for collision detection
    this.size = CONSTANTS.SCHOOL_SIZE;

    // Vision
    this.visionRadius = CONSTANTS.SCHOOL_VISION_RADIUS;

    // Destruction state
    this.destroyed = false;
    this.destructionTime = 0;
    this.destructionDuration = 3; // 3 seconds of destruction animation
    this.destructionNotified = false;

    // Debris particles for destruction animation
    this.debris = [];
    this.fires = [];
  }

  update(dt, game) {
    // Update destruction animation
    if (this.destroyed && this.destructionTime < this.destructionDuration) {
      this.destructionTime += dt;

      // Update debris particles
      for (const d of this.debris) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 300 * dt; // Gravity
        d.rotation += d.rotationSpeed * dt;
        d.opacity = Math.max(0, 1 - this.destructionTime / this.destructionDuration);
      }

      // Update fires
      for (const fire of this.fires) {
        fire.flickerTime += dt;
        fire.size = fire.baseSize * (1 + Math.sin(fire.flickerTime * 10) * 0.3);
        fire.opacity = Math.max(0.3, 1 - this.destructionTime / (this.destructionDuration * 1.5));
      }
    }
  }

  takeDamage(amount, game) {
    if (this.destroyed) return 0;

    // Apply damage reduction
    const actualDamage = amount * (1 - this.damageReduction);
    this.health -= actualDamage;

    if (this.health <= 0) {
      this.health = 0;
      this.destroy(game);
    }

    return actualDamage;
  }

  destroy(game) {
    if (this.destroyed) return;

    this.destroyed = true;
    this.destructionTime = 0;

    // Create debris particles
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 150;
      this.debris.push({
        x: this.x + (Math.random() - 0.5) * this.size,
        y: this.y + (Math.random() - 0.5) * this.size,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100, // Initial upward velocity
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        size: 5 + Math.random() * 15,
        color: Math.random() > 0.5 ? '#8B4513' : '#654321', // Brick colors
        opacity: 1
      });
    }

    // Create fire effects
    for (let i = 0; i < 5; i++) {
      this.fires.push({
        x: this.x + (Math.random() - 0.5) * this.size * 0.8,
        y: this.y + (Math.random() - 0.5) * this.size * 0.5,
        baseSize: 15 + Math.random() * 20,
        size: 15 + Math.random() * 20,
        flickerTime: Math.random() * 10,
        opacity: 1
      });
    }

    // Add explosion effect
    if (game && game.effects) {
      game.effects.push({
        type: 'explosion',
        x: this.x,
        y: this.y,
        radius: this.size,
        duration: 1,
        time: 0
      });
    }

    // Notify player destroyed
    if (game && !this.destructionNotified) {
      this.destructionNotified = true;
      game.onSchoolDestroyed(this);
    }
  }

  heal(amount) {
    this.health = Math.min(this.health + amount, this.maxHealth);
  }

  isAlive() {
    return this.health > 0;
  }

  containsPoint(x, y) {
    const halfSize = this.size / 2;
    return x >= this.x - halfSize &&
           x <= this.x + halfSize &&
           y >= this.y - halfSize &&
           y <= this.y + halfSize;
  }

  getDistanceTo(target) {
    return Math.hypot(target.x - this.x, target.y - this.y);
  }

  serialize() {
    return {
      id: this.id,
      playerId: this.playerId,
      x: this.x,
      y: this.y,
      health: this.health,
      maxHealth: this.maxHealth,
      damageReduction: this.damageReduction
    };
  }
}
