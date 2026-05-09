// Shared game constants for School Fighter
// Used by both client and server

const CONSTANTS = {
  // Economy
  BASE_REPUTATION_INCOME: 3,    // per second
  FLAG_REPUTATION_INCOME: 1,    // per second per flag
  STARTING_REPUTATION: 50,

  // Unit Types
  UNIT_TYPES: {
    REGULAR: {
      id: 'REGULAR',
      name: 'Regular Student',
      limit: 10,
      cost: 10,
      health: 50,
      damage: 5,
      speed: 80,
      attackRange: 30,
      attackCooldown: 1000, // ms
      visionRadius: 100
    },
    SENIOR: {
      id: 'SENIOR',
      name: 'Senior Student',
      limit: 5,
      cost: 20,
      health: 150,  // Much tankier than regular
      damage: 8,
      speed: 65,
      attackRange: 35,
      attackCooldown: 1100,
      visionRadius: 120
    },
    BOXER: {
      id: 'BOXER',
      name: 'Boxer',
      limit: 2,
      cost: 35,
      health: 100,  // Less tanky
      damage: 9999, // Insta-kill any unit
      buildingDamage: 15, // Normal damage vs buildings
      speed: 55,
      attackRange: 40,
      attackCooldown: 1000, // Attack once per second
      visionRadius: 80,
      instaKillUnits: true  // Special flag for one-shot kills
    },
    KID: {
      id: 'KID',
      name: 'Kid with Petard',
      limit: 4,
      cost: 18,
      health: 35,  // Fragile
      damage: 25,  // Grenade damage
      splashRadius: 60, // Explosion radius
      speed: 90,   // Fast
      attackRange: 120, // Ranged
      attackCooldown: 1000, // 1 grenade per second
      visionRadius: 100,
      isRanged: true,
      requiresUpgrade: 'FENCE' // Requires fence upgrade
    },
    MILITARY: {
      id: 'MILITARY',
      name: 'Military',
      limit: 99,
      cost: 0,
      health: 25,  // Very low HP
      damage: 12,  // Gun damage
      speed: 50,   // Slow
      attackRange: 150, // Long range
      attackCooldown: 800,
      visionRadius: 120,
      isRanged: true,
      isNeutral: true // Attacks everyone
    }
  },

  // School Upgrades
  SCHOOL_UPGRADES: {
    FENCE: {
      id: 'FENCE',
      name: 'Fence',
      cost: 20,
      description: 'Reduces damage taken by school by 20%',
      effect: { type: 'damage_reduction', value: 0.2 }
    },
    GUARD: {
      id: 'GUARD',
      name: 'Guard Post',
      cost: 40,
      description: 'Increases school HP by 30%',
      effect: { type: 'hp_bonus', value: 0.3 }
    },
    PRESTIGE: {
      id: 'PRESTIGE',
      name: 'Prestige',
      cost: 50,
      description: 'Doubles reputation income',
      effect: { type: 'double_income', value: 2 }
    }
  },

  // Unit Upgrades (Global)
  UNIT_UPGRADES: {
    COMBAT_TRAINING: {
      id: 'COMBAT_TRAINING',
      name: 'Combat Training',
      cost: 5,
      description: 'All units deal 20% more damage',
      effect: { type: 'damage_bonus', value: 0.2 },
      requires: null
    },
    REFLEX: {
      id: 'REFLEX',
      name: 'Reflex Training',
      cost: 50,
      description: 'All units have 40% more health',
      effect: { type: 'health_bonus', value: 0.4 },
      requires: 'COMBAT_TRAINING'
    }
  },

  // Vision
  SCHOOL_VISION_RADIUS: 200,
  UNIT_VISION_RADIUS: 100,
  FLAG_VISION_RADIUS: 50,

  // Map
  MAP_WIDTH: 1600,
  MAP_HEIGHT: 1200,
  FLAG_COUNT: 10,

  // School
  SCHOOL_MAX_HEALTH: 500,
  SCHOOL_SIZE: 80,

  // Flag
  FLAG_SIZE: 30,
  FLAG_CAPTURE_RADIUS: 50,
  FLAG_CAPTURE_TIME: 3000, // ms to capture

  // Combat
  AGGRO_RANGE: 150,
  DISENGAGE_RANGE: 200,

  // Network
  TICK_RATE: 20, // Server updates per second
  DEFAULT_PORT: 3000,

  // Game
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,

  // Map scaling based on player count
  MAP_SCALES: {
    2: { width: 1200, height: 900 },
    3: { width: 1400, height: 1050 },
    4: { width: 1600, height: 1200 }
  },

  // Airstrike
  AIRSTRIKE: {
    cost: 100,
    radius: 120,
    damage: 1000, // Instant kill
    planeSpeed: 400,
    bookCount: 8,
    cooldown: 30000 // 30 seconds
  },

  // Glory To Victory skill
  GLORY_TO_VICTORY: {
    cost: 150,
    unitHealPercent: 1.0, // Fully heal all units
    schoolHeal: 100,      // +100 HP to school
    cooldown: 45000       // 45 seconds
  },

  // Flag Sandbags upgrade
  FLAG_SANDBAGS: {
    cost: 30,
    captureSpeedMultiplier: 0.3 // 3x slower to capture
  },

  // Military Airdrop event
  MILITARY_AIRDROP: {
    interval: 60000, // Every 60 seconds
    minUnits: 2,
    maxUnits: 5,
    spawnRadius: 150 // Around map center
  },

  // AI Difficulty
  AI_DIFFICULTY: {
    EASY: {
      decisionInterval: 4,      // Slow decisions
      resourceMultiplier: 0.7,  // Less income
      unitProductionDelay: 2,   // Slow unit production
      upgradeChance: 0.3,       // Rarely upgrades
      aggression: 0.3,          // Passive (used for strategy weights)
      aggressionLevel: 0.3,     // Passive
      reactionTime: 2000,       // Slow to react
      maxUnitsMultiplier: 0.5   // Uses fewer units
    },
    MID: {
      decisionInterval: 2,
      resourceMultiplier: 1.0,
      unitProductionDelay: 1,
      upgradeChance: 0.5,
      aggression: 0.5,
      aggressionLevel: 0.5,
      reactionTime: 1000,
      maxUnitsMultiplier: 0.8
    },
    HARD: {
      decisionInterval: 1,
      resourceMultiplier: 1.3,
      unitProductionDelay: 0.5,
      upgradeChance: 0.8,
      aggression: 0.7,
      aggressionLevel: 0.7,
      reactionTime: 500,
      maxUnitsMultiplier: 1.0
    },
    INSANE: {
      decisionInterval: 0.5,    // Very fast decisions
      resourceMultiplier: 1.8,  // Bonus income
      unitProductionDelay: 0.2, // Rapid production
      upgradeChance: 1.0,       // Always upgrades when possible
      aggression: 0.9,          // Very aggressive (used for strategy weights)
      aggressionLevel: 0.9,     // Very aggressive
      reactionTime: 100,        // Near instant reactions
      maxUnitsMultiplier: 1.5,  // Can exceed normal limits
      perfectMicro: true,       // Perfect unit control
      mapAwareness: true        // Ignores fog of war for decisions
    }
  },

  // Colors (player colors)
  PLAYER_COLORS: [
    '#4a90d9', // Blue
    '#d94a4a', // Red
    '#4ad94a', // Green
    '#d9d94a'  // Yellow
  ],

  // Message Types
  MSG: {
    // Client -> Server
    JOIN_LOBBY: 'join_lobby',
    CREATE_LOBBY: 'create_lobby',
    START_GAME: 'start_game',
    PLAYER_INPUT: 'player_input',
    LEAVE_LOBBY: 'leave_lobby',

    // Server -> Client
    LOBBY_JOINED: 'lobby_joined',
    LOBBY_CREATED: 'lobby_created',
    LOBBY_UPDATE: 'lobby_update',
    GAME_START: 'game_start',
    GAME_STATE: 'game_state',
    GAME_OVER: 'game_over',
    ERROR: 'error'
  },

  // Input Actions
  ACTION: {
    MOVE_UNITS: 'move_units',
    ATTACK_MOVE: 'attack_move',
    CREATE_UNIT: 'create_unit',
    PURCHASE_UPGRADE: 'purchase_upgrade'
  }
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}
