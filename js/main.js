// Main entry point for School Fighter

class Main {
  constructor() {
    this.game = null;
    this.ui = null;
    this.networkClient = null;
    this.settings = {
      musicVolume: 50,
      sfxVolume: 50,
      showGrid: false
    };

    // Singleplayer options
    this.spOptions = {
      botCount: 1,
      difficulty: 'MID'
    };

    this.difficultyDescriptions = {
      EASY: 'Relaxed gameplay. Bots are slow, passive, and have reduced income.',
      MID: 'Balanced AI with standard resource income.',
      HARD: 'Challenging AI with faster decisions, bonus income, and aggressive tactics.',
      INSANE: 'EXTREME difficulty! Bots have perfect micro, massive income bonuses, ignore fog of war, and attack relentlessly. Good luck!'
    };

    this.init();
  }

  init() {
    // Initialize UI first
    this.ui = new UI(this);

    // Load settings from localStorage
    this.loadSettings();

    // Set up menu event listeners
    this.setupMenuListeners();

    console.log('School Fighter initialized');
  }

  loadSettings() {
    const saved = localStorage.getItem('schoolFighterSettings');
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
        this.ui.applySettings(this.settings);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }

  saveSettings() {
    localStorage.setItem('schoolFighterSettings', JSON.stringify(this.settings));
  }

  setupMenuListeners() {
    // Main menu buttons
    document.getElementById('btn-singleplayer').addEventListener('click', () => {
      this.showScreen('singleplayer-menu');
    });

    document.getElementById('btn-multiplayer').addEventListener('click', () => {
      this.showScreen('multiplayer-menu');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      this.showScreen('settings-screen');
    });

    // Singleplayer options
    document.querySelectorAll('[data-bots]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-bots]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.spOptions.botCount = parseInt(btn.dataset.bots);
      });
    });

    document.querySelectorAll('[data-difficulty]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-difficulty]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.spOptions.difficulty = btn.dataset.difficulty;
        document.getElementById('difficulty-desc').textContent =
          this.difficultyDescriptions[this.spOptions.difficulty];
      });
    });

    document.getElementById('btn-start-sp').addEventListener('click', () => {
      this.startSingleplayer();
    });

    document.getElementById('btn-sp-back').addEventListener('click', () => {
      this.showScreen('main-menu');
    });

    // Multiplayer menu
    document.getElementById('btn-create-lobby').addEventListener('click', () => {
      this.createLobby();
    });

    document.getElementById('btn-join-lobby').addEventListener('click', () => {
      const code = document.getElementById('lobby-code-input').value.toUpperCase();
      if (code.length >= 4) {
        this.joinLobby(code);
      }
    });

    document.getElementById('btn-mp-back').addEventListener('click', () => {
      this.showScreen('main-menu');
    });

    // Lobby screen
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.startMultiplayerGame();
    });

    document.getElementById('btn-leave-lobby').addEventListener('click', () => {
      this.leaveLobby();
    });

    // Settings
    document.getElementById('music-volume').addEventListener('input', (e) => {
      this.settings.musicVolume = parseInt(e.target.value);
      this.saveSettings();
      // Update sound system
      if (this.game && this.game.sound) {
        this.game.sound.setVolume('music', this.settings.musicVolume / 100);
      }
    });

    document.getElementById('sfx-volume').addEventListener('input', (e) => {
      this.settings.sfxVolume = parseInt(e.target.value);
      this.saveSettings();
      // Update sound system
      if (this.game && this.game.sound) {
        this.game.sound.setVolume('sfx', this.settings.sfxVolume / 100);
      }
    });

    document.getElementById('show-grid').addEventListener('change', (e) => {
      this.settings.showGrid = e.target.checked;
      this.saveSettings();
      if (this.game) {
        this.game.renderer.showGrid = this.settings.showGrid;
      }
    });

    document.getElementById('btn-settings-back').addEventListener('click', () => {
      this.showScreen('main-menu');
    });

    // Pause menu
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.resumeGame();
    });

    document.getElementById('btn-quit').addEventListener('click', () => {
      this.quitToMenu();
    });

    // Game over
    document.getElementById('btn-to-menu').addEventListener('click', () => {
      this.quitToMenu();
    });
  }

  showScreen(screenId) {
    // Hide all menu screens
    document.querySelectorAll('.menu-screen').forEach(screen => {
      screen.classList.add('hidden');
    });

    // Show the requested screen
    document.getElementById(screenId).classList.remove('hidden');
  }

  startSingleplayer() {
    console.log('Starting singleplayer game...', this.spOptions);

    // Hide menus, show game screen
    document.querySelectorAll('.menu-screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('game-screen').classList.remove('hidden');

    // Calculate player count (1 human + bots)
    const playerCount = 1 + this.spOptions.botCount;

    // Create game instance
    this.game = new Game({
      mode: 'singleplayer',
      playerCount: playerCount,
      localPlayerId: 0,
      settings: this.settings,
      aiDifficulty: this.spOptions.difficulty
    });

    this.game.start();
  }

  createLobby() {
    console.log('Creating multiplayer lobby...');

    // Initialize network client if not exists
    if (!this.networkClient) {
      this.networkClient = new NetworkClient(this);
    }

    this.networkClient.createLobby();
  }

  joinLobby(code) {
    console.log('Joining lobby:', code);

    // Initialize network client if not exists
    if (!this.networkClient) {
      this.networkClient = new NetworkClient(this);
    }

    this.networkClient.joinLobby(code);
  }

  onLobbyCreated(lobbyData) {
    this.showScreen('lobby-screen');
    document.getElementById('lobby-code-display').textContent = lobbyData.code;
    this.updatePlayerList(lobbyData.players, lobbyData.hostId);
    this.updateStartButton(lobbyData);
  }

  onLobbyJoined(lobbyData) {
    this.showScreen('lobby-screen');
    document.getElementById('lobby-code-display').textContent = lobbyData.code;
    this.updatePlayerList(lobbyData.players, lobbyData.hostId);
    this.updateStartButton(lobbyData);
  }

  onLobbyUpdate(lobbyData) {
    this.updatePlayerList(lobbyData.players, lobbyData.hostId);
    this.updateStartButton(lobbyData);
  }

  updatePlayerList(players, hostId) {
    const listEl = document.getElementById('player-list');
    listEl.innerHTML = '';

    players.forEach((player, index) => {
      const playerEl = document.createElement('div');
      playerEl.className = 'player-item';
      playerEl.innerHTML = `
        <div class="player-color" style="background: ${CONSTANTS.PLAYER_COLORS[index]}"></div>
        <span class="player-name">${player.name || 'Player ' + (index + 1)}</span>
        ${player.id === hostId ? '<span class="player-host">HOST</span>' : ''}
      `;
      listEl.appendChild(playerEl);
    });
  }

  updateStartButton(lobbyData) {
    const btn = document.getElementById('btn-start-game');
    const isHost = this.networkClient && this.networkClient.playerId === lobbyData.hostId;
    const enoughPlayers = lobbyData.players.length >= CONSTANTS.MIN_PLAYERS;

    btn.disabled = !isHost || !enoughPlayers;
    btn.textContent = isHost ? 'Start Game' : 'Waiting for host...';
  }

  startMultiplayerGame() {
    if (this.networkClient) {
      this.networkClient.startGame();
    }
  }

  onGameStart(gameData) {
    console.log('Multiplayer game starting...', gameData);

    // Hide lobby, show game screen
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    // Create game instance with network
    this.game = new Game({
      mode: 'multiplayer',
      playerCount: gameData.playerCount,
      localPlayerId: gameData.localPlayerId,
      settings: this.settings,
      networkClient: this.networkClient,
      initialState: gameData.initialState
    });

    this.game.start();
  }

  leaveLobby() {
    if (this.networkClient) {
      this.networkClient.leaveLobby();
    }
    this.showScreen('multiplayer-menu');
  }

  resumeGame() {
    if (this.game) {
      this.game.resume();
      document.getElementById('pause-menu').classList.add('hidden');
    }
  }

  pauseGame() {
    if (this.game) {
      this.game.pause();
      document.getElementById('pause-menu').classList.remove('hidden');
    }
  }

  quitToMenu() {
    if (this.game) {
      this.game.stop();
      this.game = null;
    }

    if (this.networkClient) {
      this.networkClient.disconnect();
      this.networkClient = null;
    }

    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    this.showScreen('main-menu');
  }

  showGameOver(victory, message) {
    const titleEl = document.getElementById('game-over-title');
    const messageEl = document.getElementById('game-over-message');

    titleEl.textContent = victory ? 'Victory!' : 'Defeat';
    titleEl.className = victory ? 'victory' : 'defeat';
    messageEl.textContent = message;

    document.getElementById('game-over').classList.remove('hidden');
  }

  onNetworkError(error) {
    console.error('Network error:', error);
    alert('Network error: ' + error.message);
    this.showScreen('multiplayer-menu');
  }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.main = new Main();
});
