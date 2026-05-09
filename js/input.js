// Input handling - Mouse and keyboard

class Input {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;

    // Mouse state
    this.mouse = {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      leftDown: false,
      rightDown: false
    };

    // Keyboard state
    this.keys = {};

    // Camera pan speed
    this.panSpeed = 600;
    this.edgePanThreshold = 50; // Edge zone size for camera panning

    // Smooth camera movement
    this.cameraVelocity = { x: 0, y: 0 };
    this.cameraAcceleration = 2000;
    this.cameraDeceleration = 8;
    this.maxCameraSpeed = 800;

    // Bind event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard events
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Prevent right-click menu
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
  }

  onMouseDown(e) {
    this.updateMousePosition(e);

    // Handle airstrike mode
    if (this.game.airstrikeMode) {
      if (e.button === 0) {
        // Left click - execute airstrike
        this.game.executeAirstrike(this.mouse.worldX, this.mouse.worldY);
      } else if (e.button === 2) {
        // Right click - cancel airstrike
        this.game.cancelAirstrikeMode();
      }
      return;
    }

    if (e.button === 0) {
      // Left click - start selection
      this.mouse.leftDown = true;
      this.game.selection.startSelection(this.mouse.worldX, this.mouse.worldY);
    } else if (e.button === 2) {
      // Right click - issue command
      this.mouse.rightDown = true;
      this.handleRightClick();
    }
  }

  onMouseUp(e) {
    this.updateMousePosition(e);

    if (e.button === 0) {
      this.mouse.leftDown = false;
      this.game.selection.endSelection(this.mouse.worldX, this.mouse.worldY);
    } else if (e.button === 2) {
      this.mouse.rightDown = false;
    }
  }

  onMouseMove(e) {
    this.updateMousePosition(e);

    if (this.mouse.leftDown) {
      this.game.selection.updateSelection(this.mouse.worldX, this.mouse.worldY);
    }
  }

  onWheel(e) {
    e.preventDefault();

    const zoomSpeed = 0.1;
    const camera = this.game.camera;

    // Get world position before zoom
    const beforeZoom = this.game.screenToWorld(e.clientX, e.clientY);

    // Apply zoom
    if (e.deltaY < 0) {
      camera.zoom = Math.min(camera.zoom + zoomSpeed, camera.maxZoom);
    } else {
      camera.zoom = Math.max(camera.zoom - zoomSpeed, camera.minZoom);
    }

    // Get world position after zoom
    const afterZoom = this.game.screenToWorld(e.clientX, e.clientY);

    // Adjust camera to zoom toward mouse position
    camera.x += beforeZoom.x - afterZoom.x;
    camera.y += beforeZoom.y - afterZoom.y;
  }

  onKeyDown(e) {
    this.keys[e.key.toLowerCase()] = true;

    // Hotkeys
    switch (e.key.toLowerCase()) {
      case 'a':
        // Attack-move (A + click)
        if (this.game.selection.hasSelection()) {
          // Will be handled on next right-click
          this.attackMoveMode = true;
        }
        break;

      case 's':
        // Stop units
        this.game.selection.stopSelectedUnits();
        break;

      case '1':
        // Create Regular unit
        this.createUnitHotkey('REGULAR');
        break;

      case '2':
        // Create Senior unit
        this.createUnitHotkey('SENIOR');
        break;

      case '3':
        // Create Boxer unit
        this.createUnitHotkey('BOXER');
        break;

      case 'tab':
        // Cycle through unit groups
        e.preventDefault();
        this.game.selection.cycleSelection();
        break;

      case ' ':
        // Center on selected units or school
        e.preventDefault();
        this.centerCamera();
        break;

      case 'escape':
        // Cancel airstrike mode or pause game
        if (this.game.airstrikeMode) {
          this.game.cancelAirstrikeMode();
        } else {
          window.main.pauseGame();
        }
        break;

      case 'q':
        // Airstrike hotkey
        if (this.game.canUseAirstrike && this.game.canUseAirstrike(this.game.localPlayerId)) {
          this.game.startAirstrikeMode();
        }
        break;
    }
  }

  onKeyUp(e) {
    this.keys[e.key.toLowerCase()] = false;

    if (e.key.toLowerCase() === 'a') {
      this.attackMoveMode = false;
    }
  }

  updateMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;

    const world = this.game.screenToWorld(this.mouse.x, this.mouse.y);
    this.mouse.worldX = world.x;
    this.mouse.worldY = world.y;
  }

  handleRightClick() {
    const selectedUnits = this.game.selection.getSelectedUnits();

    if (selectedUnits.length === 0) return;

    // Only allow commanding own units
    const ownUnits = selectedUnits.filter(u => u.playerId === this.game.localPlayerId);
    if (ownUnits.length === 0) return;

    // Check if clicking on enemy
    const target = this.findTargetAtPosition(this.mouse.worldX, this.mouse.worldY);

    if (target) {
      // Attack target
      const unitIds = ownUnits.map(u => u.id);
      this.game.moveUnits(unitIds, target.x, target.y, true);

      // Set attack target for units
      ownUnits.forEach(unit => {
        unit.attackTarget = target;
      });
    } else {
      // Move to position
      const unitIds = ownUnits.map(u => u.id);
      this.game.moveUnits(unitIds, this.mouse.worldX, this.mouse.worldY, this.attackMoveMode);
    }

    // Show move indicator
    this.showMoveIndicator(this.mouse.worldX, this.mouse.worldY);
  }

  findTargetAtPosition(x, y) {
    // Check for enemy units
    for (const unit of this.game.units) {
      if (unit.playerId === this.game.localPlayerId) continue;
      if (!this.game.fogOfWar.isVisible(unit.x, unit.y, this.game.localPlayerId)) continue;

      const dist = Math.hypot(x - unit.x, y - unit.y);
      if (dist < 20) {
        return unit;
      }
    }

    // Check for enemy schools
    for (const school of this.game.schools) {
      if (school.playerId === this.game.localPlayerId) continue;
      if (school.health <= 0) continue;

      const dist = Math.hypot(x - school.x, y - school.y);
      if (dist < CONSTANTS.SCHOOL_SIZE) {
        return school;
      }
    }

    return null;
  }

  showMoveIndicator(x, y) {
    // Visual feedback for move command
    // This would be implemented as a temporary visual effect
    // For now, units just move to the target
  }

  update(dt) {
    if (this.game.paused) return;

    const camera = this.game.camera;

    // Calculate desired movement direction
    let moveX = 0;
    let moveY = 0;

    // WASD/Arrow keys
    if (this.keys['w'] || this.keys['arrowup']) {
      moveY -= 1;
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      moveY += 1;
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      moveX -= 1;
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      moveX += 1;
    }

    // Edge panning
    const threshold = this.edgePanThreshold;
    if (this.mouse.x < threshold && this.mouse.x >= 0) {
      moveX -= 1;
    } else if (this.mouse.x > this.canvas.width - threshold && this.mouse.x <= this.canvas.width) {
      moveX += 1;
    }
    if (this.mouse.y < threshold && this.mouse.y >= 0) {
      moveY -= 1;
    } else if (this.mouse.y > this.canvas.height - threshold && this.mouse.y <= this.canvas.height) {
      moveY += 1;
    }

    // Normalize diagonal movement
    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 0) {
      moveX /= moveLength;
      moveY /= moveLength;
    }

    // Apply acceleration or deceleration
    if (moveLength > 0) {
      // Accelerate towards target direction
      this.cameraVelocity.x += moveX * this.cameraAcceleration * dt;
      this.cameraVelocity.y += moveY * this.cameraAcceleration * dt;
    } else {
      // Decelerate (friction)
      this.cameraVelocity.x *= (1 - this.cameraDeceleration * dt);
      this.cameraVelocity.y *= (1 - this.cameraDeceleration * dt);

      // Stop completely if very slow
      if (Math.abs(this.cameraVelocity.x) < 1) this.cameraVelocity.x = 0;
      if (Math.abs(this.cameraVelocity.y) < 1) this.cameraVelocity.y = 0;
    }

    // Clamp speed
    const speed = Math.hypot(this.cameraVelocity.x, this.cameraVelocity.y);
    if (speed > this.maxCameraSpeed) {
      this.cameraVelocity.x = (this.cameraVelocity.x / speed) * this.maxCameraSpeed;
      this.cameraVelocity.y = (this.cameraVelocity.y / speed) * this.maxCameraSpeed;
    }

    // Apply velocity to camera
    camera.x += this.cameraVelocity.x * dt;
    camera.y += this.cameraVelocity.y * dt;
  }

  handleEdgePanContinuous(dt) {
    // This is now handled in update() method
  }

  createUnitHotkey(unitType) {
    const success = this.game.createUnit(this.game.localPlayerId, unitType);
    if (success) {
      // Update UI
      window.main.ui.updateUnitCounts();
    }
  }

  centerCamera() {
    const selected = this.game.selection.getSelectedUnits();

    if (selected.length > 0) {
      // Center on selected units
      let avgX = 0, avgY = 0;
      for (const unit of selected) {
        avgX += unit.x;
        avgY += unit.y;
      }
      avgX /= selected.length;
      avgY /= selected.length;

      this.game.camera.x = avgX - this.canvas.width / 2 / this.game.camera.zoom;
      this.game.camera.y = avgY - this.canvas.height / 2 / this.game.camera.zoom;
    } else {
      // Center on own school
      const school = this.game.schools[this.game.localPlayerId];
      this.game.camera.x = school.x - this.canvas.width / 2 / this.game.camera.zoom;
      this.game.camera.y = school.y - this.canvas.height / 2 / this.game.camera.zoom;
    }
  }

  isKeyDown(key) {
    return this.keys[key.toLowerCase()] || false;
  }
}
