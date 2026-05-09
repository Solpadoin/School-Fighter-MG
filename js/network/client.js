// Network client - WebSocket communication

class NetworkClient {
  constructor(main) {
    this.main = main;
    this.ws = null;
    this.playerId = null;
    this.lobbyCode = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    // Server URL (configurable)
    this.serverUrl = this.getServerUrl();
  }

  getServerUrl() {
    // Check for custom server in localStorage
    const customServer = localStorage.getItem('schoolFighterServer');
    if (customServer) {
      return customServer;
    }

    // Default to localhost for development
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//localhost:${CONSTANTS.DEFAULT_PORT}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to server');
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        this.ws.onclose = () => {
          console.log('Disconnected from server');
          this.connected = false;
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('Failed to connect to server'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.playerId = null;
    this.lobbyCode = null;
  }

  handleDisconnect() {
    if (this.main.game && this.main.game.mode === 'multiplayer') {
      // Try to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(() => {
          this.connect().then(() => {
            // Rejoin lobby
            if (this.lobbyCode) {
              this.send({
                type: CONSTANTS.MSG.JOIN_LOBBY,
                code: this.lobbyCode,
                playerId: this.playerId
              });
            }
          }).catch(() => {
            this.handleDisconnect();
          });
        }, 1000 * this.reconnectAttempts);
      } else {
        this.main.onNetworkError(new Error('Lost connection to server'));
      }
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message - not connected');
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case CONSTANTS.MSG.LOBBY_CREATED:
        this.playerId = message.playerId;
        this.lobbyCode = message.lobby.code;
        this.main.onLobbyCreated(message.lobby);
        break;

      case CONSTANTS.MSG.LOBBY_JOINED:
        this.playerId = message.playerId;
        this.lobbyCode = message.lobby.code;
        this.main.onLobbyJoined(message.lobby);
        break;

      case CONSTANTS.MSG.LOBBY_UPDATE:
        this.main.onLobbyUpdate(message.lobby);
        break;

      case CONSTANTS.MSG.GAME_START:
        this.main.onGameStart({
          playerCount: message.playerCount,
          localPlayerId: this.playerId,
          initialState: message.initialState
        });
        break;

      case CONSTANTS.MSG.GAME_STATE:
        if (this.main.game) {
          this.main.game.receiveGameState(message.state);
        }
        break;

      case CONSTANTS.MSG.GAME_OVER:
        if (this.main.game) {
          this.main.game.gameOver = true;
          this.main.showGameOver(
            message.winnerId === this.playerId,
            message.message
          );
        }
        break;

      case CONSTANTS.MSG.ERROR:
        console.error('Server error:', message.error);
        this.main.onNetworkError(new Error(message.error));
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  async createLobby() {
    if (!this.connected) {
      try {
        await this.connect();
      } catch (error) {
        this.main.onNetworkError(error);
        return;
      }
    }

    this.send({
      type: CONSTANTS.MSG.CREATE_LOBBY
    });
  }

  async joinLobby(code) {
    if (!this.connected) {
      try {
        await this.connect();
      } catch (error) {
        this.main.onNetworkError(error);
        return;
      }
    }

    this.send({
      type: CONSTANTS.MSG.JOIN_LOBBY,
      code: code.toUpperCase()
    });
  }

  leaveLobby() {
    this.send({
      type: CONSTANTS.MSG.LEAVE_LOBBY
    });
    this.lobbyCode = null;
  }

  startGame() {
    this.send({
      type: CONSTANTS.MSG.START_GAME
    });
  }

  sendAction(action) {
    this.send({
      type: CONSTANTS.MSG.PLAYER_INPUT,
      action: action
    });
  }
}
