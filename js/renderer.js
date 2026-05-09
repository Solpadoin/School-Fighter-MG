// Renderer - Handles all canvas drawing

class Renderer {
  constructor(game) {
    this.game = game;
    this.ctx = game.ctx;
    this.canvas = game.canvas;
    this.showGrid = game.settings.showGrid || false;

    // Animation time
    this.animTime = 0;

    // Minimap
    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.minimapScale = this.minimapCanvas.width / this.game.mapWidth;
  }

  render() {
    const ctx = this.ctx;
    const camera = this.game.camera;

    // Update animation time
    this.animTime = this.game.gameTime || 0;

    // Clear canvas
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Save context for camera transform
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Draw map background and elements
    this.drawMap();

    // Draw grid if enabled
    if (this.showGrid) {
      this.drawGrid();
    }

    // Draw fog of war base layer (unexplored areas)
    this.drawFogBase();

    // Draw flags
    for (const flag of this.game.flags) {
      if (this.game.fogOfWar.isVisible(flag.x, flag.y, this.game.localPlayerId)) {
        this.drawFlag(flag);
      } else if (this.game.fogOfWar.wasExplored(flag.x, flag.y, this.game.localPlayerId)) {
        this.drawFlag(flag, true); // Draw grayed out
      }
    }

    // Draw schools
    for (const school of this.game.schools) {
      if (this.game.fogOfWar.isVisible(school.x, school.y, this.game.localPlayerId) ||
          school.playerId === this.game.localPlayerId) {
        this.drawSchool(school);
      } else if (this.game.fogOfWar.wasExplored(school.x, school.y, this.game.localPlayerId)) {
        this.drawSchool(school, true); // Draw grayed out
      }
    }

    // Draw dying units (death animation)
    for (const dying of this.game.dyingUnits) {
      this.drawDyingUnit(dying);
    }

    // Draw units
    for (const unit of this.game.units) {
      if (unit.playerId === this.game.localPlayerId ||
          this.game.fogOfWar.isVisible(unit.x, unit.y, this.game.localPlayerId)) {
        this.drawUnit(unit);
      }
    }

    // Draw airstrikes
    for (const strike of this.game.airstrikes) {
      this.drawAirstrike(strike);
    }

    // Draw grenades
    for (const grenade of this.game.grenades) {
      this.drawGrenade(grenade);
    }

    // Draw military units
    for (const military of this.game.militaryUnits) {
      if (military.health > 0) {
        this.drawMilitary(military);
      }
    }

    // Draw effects
    for (const effect of this.game.effects) {
      this.drawEffect(effect);
    }

    // Draw airstrike target indicator
    if (this.game.airstrikeMode) {
      this.drawAirstrikeTarget();
    }

    // Draw selection box if selecting
    if (this.game.selection.isSelecting) {
      this.drawSelectionBox();
    }

    // Draw fog of war overlay
    this.drawFogOverlay();

    ctx.restore();

    // Draw UI elements (not affected by camera)
    this.drawMinimap();
  }

  drawMap() {
    const ctx = this.ctx;
    const mapW = this.game.mapWidth;
    const mapH = this.game.mapHeight;

    // Draw map background (grass base)
    ctx.fillStyle = '#3a5a3a';
    ctx.fillRect(0, 0, mapW, mapH);

    // Draw subtle grass texture
    ctx.fillStyle = '#4a6a4a';
    for (let x = 50; x < mapW; x += 120) {
      for (let y = 50; y < mapH; y += 120) {
        const size = 20 + (Math.sin(x * 0.05) + Math.cos(y * 0.05)) * 10;
        ctx.beginPath();
        ctx.arc(x + Math.sin(y) * 20, y + Math.cos(x) * 20, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw main roads
    this.drawRoads(mapW, mapH);

    // Draw a few houses around the map (reduced)
    this.drawMapBuildings(mapW, mapH);

    // Draw trees (reduced)
    this.drawTrees(mapW, mapH);

    // Draw street lamps along roads
    this.drawStreetLamps(mapW, mapH);

    // Map border
    ctx.strokeStyle = '#1a2a1a';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, mapW, mapH);
  }

  drawRoads(mapW, mapH) {
    const ctx = this.ctx;

    // Road base color
    const roadColor = '#4a4a3a';
    const roadLineColor = '#6a6a5a';
    const roadWidth = 40;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Main horizontal road
    ctx.strokeStyle = roadColor;
    ctx.lineWidth = roadWidth;
    ctx.beginPath();
    ctx.moveTo(0, mapH / 2);
    ctx.lineTo(mapW, mapH / 2);
    ctx.stroke();

    // Main vertical road
    ctx.beginPath();
    ctx.moveTo(mapW / 2, 0);
    ctx.lineTo(mapW / 2, mapH);
    ctx.stroke();

    // Diagonal roads
    ctx.lineWidth = roadWidth - 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(mapW, mapH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mapW, 0);
    ctx.lineTo(0, mapH);
    ctx.stroke();

    // Road markings - dashed center lines
    ctx.strokeStyle = roadLineColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);

    // Horizontal road markings
    ctx.beginPath();
    ctx.moveTo(0, mapH / 2);
    ctx.lineTo(mapW, mapH / 2);
    ctx.stroke();

    // Vertical road markings
    ctx.beginPath();
    ctx.moveTo(mapW / 2, 0);
    ctx.lineTo(mapW / 2, mapH);
    ctx.stroke();

    ctx.setLineDash([]);

    // Crosswalk at intersection
    ctx.fillStyle = '#ddd';
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      // Horizontal crosswalk
      ctx.fillRect(mapW / 2 - 25, mapH / 2 + i * 8 - 2, 50, 4);
      // Vertical crosswalk
      ctx.fillRect(mapW / 2 + i * 8 - 2, mapH / 2 - 25, 4, 50);
    }

    // Sidewalks along main roads
    ctx.fillStyle = '#6a6a5a';
    // Horizontal sidewalks
    ctx.fillRect(0, mapH / 2 - roadWidth / 2 - 12, mapW, 8);
    ctx.fillRect(0, mapH / 2 + roadWidth / 2 + 4, mapW, 8);
    // Vertical sidewalks
    ctx.fillRect(mapW / 2 - roadWidth / 2 - 12, 0, 8, mapH);
    ctx.fillRect(mapW / 2 + roadWidth / 2 + 4, 0, 8, mapH);
  }

  drawMapBuildings(mapW, mapH) {
    const ctx = this.ctx;

    // Place a few buildings at fixed positions (avoiding schools and roads)
    const buildings = [
      // Top edge
      { x: mapW * 0.3, y: 120, type: 'house' },
      { x: mapW * 0.7, y: 120, type: 'shop' },
      // Bottom edge
      { x: mapW * 0.3, y: mapH - 120, type: 'shop' },
      { x: mapW * 0.7, y: mapH - 120, type: 'house' },
      // Left edge
      { x: 120, y: mapH * 0.3, type: 'house' },
      { x: 120, y: mapH * 0.7, type: 'house' },
      // Right edge
      { x: mapW - 120, y: mapH * 0.3, type: 'shop' },
      { x: mapW - 120, y: mapH * 0.7, type: 'shop' }
    ];

    // Draw buildings
    for (const building of buildings) {
      if (building.type === 'house') {
        this.drawHouse(building.x, building.y, 0);
      } else {
        this.drawShop(building.x, building.y, 0);
      }
    }
  }

  drawHouse(x, y, rotation = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // House shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(-22, 8, 44, 10);

    // House body
    ctx.fillStyle = '#D2B48C'; // Tan/beige
    ctx.fillRect(-20, -15, 40, 30);

    // Brick pattern
    ctx.strokeStyle = '#C4A574';
    ctx.lineWidth = 1;
    for (let row = 0; row < 4; row++) {
      ctx.beginPath();
      ctx.moveTo(-20, -15 + row * 8);
      ctx.lineTo(20, -15 + row * 8);
      ctx.stroke();
    }

    // Roof
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(-25, -15);
    ctx.lineTo(0, -35);
    ctx.lineTo(25, -15);
    ctx.closePath();
    ctx.fill();

    // Roof outline
    ctx.strokeStyle = '#5D3A1A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Door
    ctx.fillStyle = '#654321';
    ctx.fillRect(-5, 0, 10, 15);

    // Door frame
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 1;
    ctx.strokeRect(-5, 0, 10, 15);

    // Door handle
    ctx.fillStyle = '#DAA520';
    ctx.beginPath();
    ctx.arc(3, 8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Windows
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(-16, -8, 8, 8);
    ctx.fillRect(8, -8, 8, 8);

    // Window frames
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-16, -8, 8, 8);
    ctx.strokeRect(8, -8, 8, 8);

    // Window dividers
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(-12, 0);
    ctx.moveTo(12, -8);
    ctx.lineTo(12, 0);
    ctx.stroke();

    // Chimney
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(10, -32, 8, 12);

    ctx.restore();
  }

  drawShop(x, y, rotation = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(-27, 8, 54, 10);

    // Building body
    ctx.fillStyle = '#C9B896';
    ctx.fillRect(-25, -20, 50, 35);

    // Storefront
    ctx.fillStyle = '#8B0000'; // Dark red awning color
    ctx.fillRect(-25, -22, 50, 8);

    // Awning stripes
    ctx.fillStyle = '#fff';
    for (let i = -22; i < 25; i += 8) {
      ctx.fillRect(i, -22, 4, 8);
    }

    // Large window/display
    ctx.fillStyle = '#B0E0E6';
    ctx.fillRect(-20, -12, 40, 18);

    // Window frame
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(-20, -12, 40, 18);

    // Door (side)
    ctx.fillStyle = '#333';
    ctx.fillRect(-22, -5, 6, 20);

    // Flat roof detail
    ctx.fillStyle = '#8a8a7a';
    ctx.fillRect(-25, -25, 50, 5);

    ctx.restore();
  }

  drawTrees(mapW, mapH) {
    const ctx = this.ctx;

    // Generate deterministic tree positions (reduced count)
    const seededRandom = (x, y, offset = 0) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + offset) * 43758.5453;
      return n - Math.floor(n);
    };

    // Trees around map edges (fewer trees)
    for (let i = 0; i < 20; i++) {
      const rand1 = seededRandom(i, 0, 100);
      const rand2 = seededRandom(0, i, 200);
      let tx = rand1 * mapW;
      let ty = rand2 * mapH;

      // Avoid roads
      const distToHRoad = Math.abs(ty - mapH / 2);
      const distToVRoad = Math.abs(tx - mapW / 2);
      if (distToHRoad < 80 || distToVRoad < 80) continue;

      // Avoid corners (schools)
      const margin = 200;
      if ((tx < margin && ty < margin) || (tx > mapW - margin && ty > mapH - margin) ||
          (tx > mapW - margin && ty < margin) || (tx < margin && ty > mapH - margin)) continue;

      const treeType = seededRandom(i, i, 300) > 0.5 ? 'pine' : 'oak';
      const scale = 0.7 + seededRandom(i, i, 400) * 0.3;

      if (treeType === 'pine') {
        this.drawPineTree(tx, ty, scale);
      } else {
        this.drawOakTree(tx, ty, scale);
      }
    }

    // A few bushes near edges
    for (let i = 0; i < 10; i++) {
      const rand1 = seededRandom(i, 0, 500);
      const rand2 = seededRandom(0, i, 600);
      const bx = rand1 * mapW;
      const by = rand2 * mapH;

      // Only place near edges
      const margin = 150;
      const nearEdge = bx < margin || bx > mapW - margin || by < margin || by > mapH - margin;
      if (!nearEdge) continue;

      // Avoid corners (schools)
      if ((bx < 200 && by < 200) || (bx > mapW - 200 && by > mapH - 200) ||
          (bx > mapW - 200 && by < 200) || (bx < 200 && by > mapH - 200)) continue;

      this.drawBush(bx, by, 0.6 + seededRandom(i, i, 700) * 0.4);
    }
  }

  drawPineTree(x, y, scale = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(5, 12, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(-4, -5, 8, 20);

    // Tree layers (triangles)
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.moveTo(0, -45);
    ctx.lineTo(-18, -15);
    ctx.lineTo(18, -15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(-22, 0);
    ctx.lineTo(22, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(-25, 10);
    ctx.lineTo(25, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawOakTree(x, y, scale = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(5, 12, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(-5, -10, 10, 25);

    // Foliage (overlapping circles)
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.arc(-12, -20, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.arc(12, -20, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.arc(0, -30, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.arc(0, -22, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawBush(x, y, scale = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(2, 5, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bush body
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.arc(-5, -2, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.arc(5, -2, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.arc(0, -5, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawStreetLamps(mapW, mapH) {
    const ctx = this.ctx;

    // Lamps along horizontal road (fewer)
    for (let x = 200; x < mapW; x += 300) {
      if (Math.abs(x - mapW / 2) < 80) continue; // Skip intersection
      this.drawStreetLamp(x, mapH / 2 - 40);
    }

    // Lamps along vertical road (fewer)
    for (let y = 200; y < mapH; y += 300) {
      if (Math.abs(y - mapH / 2) < 80) continue; // Skip intersection
      this.drawStreetLamp(mapW / 2 + 40, y);
    }
  }

  drawStreetLamp(x, y) {
    const ctx = this.ctx;

    // Pole shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x + 2, y, 8, 4);

    // Pole
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 2, y - 35, 4, 40);

    // Lamp arm
    ctx.fillRect(x - 2, y - 35, 12, 3);

    // Lamp housing
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 6, y - 38, 10, 6);

    // Light glow (subtle)
    const gradient = ctx.createRadialGradient(x + 11, y - 30, 0, x + 11, y - 30, 25);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x + 11, y - 30, 25, 0, Math.PI * 2);
    ctx.fill();

    // Light bulb
    ctx.fillStyle = '#FFFACD';
    ctx.beginPath();
    ctx.arc(x + 11, y - 33, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawParkBenches(mapW, mapH) {
    const ctx = this.ctx;

    // Benches near intersections but not blocking paths
    const benchPositions = [
      { x: mapW / 2 + 80, y: mapH / 2 + 80, rotation: 0 },
      { x: mapW / 2 - 80, y: mapH / 2 - 80, rotation: Math.PI },
      { x: mapW / 2 + 80, y: mapH / 2 - 80, rotation: -Math.PI / 2 },
      { x: mapW / 2 - 80, y: mapH / 2 + 80, rotation: Math.PI / 2 }
    ];

    for (const bench of benchPositions) {
      this.drawBench(bench.x, bench.y, bench.rotation);
    }
  }

  drawBench(x, y, rotation = 0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(-12, 5, 24, 4);

    // Legs
    ctx.fillStyle = '#333';
    ctx.fillRect(-10, -2, 3, 8);
    ctx.fillRect(7, -2, 3, 8);

    // Seat
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-12, -5, 24, 4);

    // Back
    ctx.fillRect(-12, -12, 24, 3);

    // Armrests
    ctx.fillRect(-12, -10, 3, 6);
    ctx.fillRect(9, -10, 3, 6);

    ctx.restore();
  }

  drawGrid() {
    const ctx = this.ctx;
    const gridSize = 50;
    const mapW = this.game.mapWidth;
    const mapH = this.game.mapHeight;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= mapW; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mapH);
      ctx.stroke();
    }

    for (let y = 0; y <= mapH; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mapW, y);
      ctx.stroke();
    }
  }

  drawSchool(school, grayed = false) {
    const ctx = this.ctx;
    const size = CONSTANTS.SCHOOL_SIZE;
    const color = grayed ? '#555' : CONSTANTS.PLAYER_COLORS[school.playerId];

    // Draw destroyed school
    if (school.destroyed) {
      this.drawDestroyedSchool(school);
      return;
    }

    // Check for upgrades
    const hasUpgrades = school.playerId === this.game.localPlayerId ||
                        this.game.fogOfWar.isVisible(school.x, school.y, this.game.localPlayerId);
    const hasFence = hasUpgrades && this.game.economy.hasUpgrade(school.playerId, 'FENCE');
    const hasGuard = hasUpgrades && this.game.economy.hasUpgrade(school.playerId, 'GUARD');
    const hasPrestige = hasUpgrades && this.game.economy.hasUpgrade(school.playerId, 'PRESTIGE');

    // Draw fence if upgraded (behind school)
    if (hasFence && !grayed) {
      this.drawFence(school.x, school.y, size, color);
    }

    // American-style school building (red brick with white trim)
    const brickColor = grayed ? '#553333' : '#8B4513';
    const trimColor = grayed ? '#888' : '#F5F5DC';
    const roofColor = grayed ? '#333' : '#2F4F4F';

    // Main building base
    ctx.fillStyle = brickColor;
    ctx.fillRect(school.x - size / 2, school.y - size / 2 + 10, size, size - 10);

    // Brick pattern
    if (!grayed) {
      ctx.strokeStyle = '#6B3310';
      ctx.lineWidth = 1;
      for (let row = 0; row < 6; row++) {
        const y = school.y - size / 2 + 15 + row * 12;
        ctx.beginPath();
        ctx.moveTo(school.x - size / 2, y);
        ctx.lineTo(school.x + size / 2, y);
        ctx.stroke();

        // Vertical brick lines (offset every other row)
        const offset = row % 2 === 0 ? 0 : 10;
        for (let bx = school.x - size / 2 + offset; bx < school.x + size / 2; bx += 20) {
          ctx.beginPath();
          ctx.moveTo(bx, y);
          ctx.lineTo(bx, y + 12);
          ctx.stroke();
        }
      }
    }

    // White columns on front
    ctx.fillStyle = trimColor;
    const columnWidth = 8;
    ctx.fillRect(school.x - size / 2 + 10, school.y - size / 2 + 20, columnWidth, size - 35);
    ctx.fillRect(school.x + size / 2 - 18, school.y - size / 2 + 20, columnWidth, size - 35);

    // Central entrance with pediment
    ctx.fillStyle = trimColor;
    ctx.fillRect(school.x - 20, school.y - size / 2 + 5, 40, 15);

    // Triangular pediment above entrance
    ctx.beginPath();
    ctx.moveTo(school.x - 25, school.y - size / 2 + 5);
    ctx.lineTo(school.x, school.y - size / 2 - 15);
    ctx.lineTo(school.x + 25, school.y - size / 2 + 5);
    ctx.closePath();
    ctx.fill();

    // Main roof
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(school.x - size / 2 - 5, school.y - size / 2 + 10);
    ctx.lineTo(school.x, school.y - size / 2 - 25);
    ctx.lineTo(school.x + size / 2 + 5, school.y - size / 2 + 10);
    ctx.closePath();
    ctx.fill();

    // Bell tower/cupola
    ctx.fillStyle = trimColor;
    ctx.fillRect(school.x - 8, school.y - size / 2 - 35, 16, 15);

    // Bell tower roof
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(school.x - 12, school.y - size / 2 - 35);
    ctx.lineTo(school.x, school.y - size / 2 - 50);
    ctx.lineTo(school.x + 12, school.y - size / 2 - 35);
    ctx.closePath();
    ctx.fill();

    // Bell
    if (!grayed) {
      ctx.fillStyle = '#DAA520';
      ctx.beginPath();
      ctx.arc(school.x, school.y - size / 2 - 28, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Door
    ctx.fillStyle = grayed ? '#333' : '#4a3a2a';
    ctx.fillRect(school.x - 10, school.y + size / 2 - 30, 20, 30);

    // Door frame
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(school.x - 10, school.y + size / 2 - 30, 20, 30);

    // Windows (3 on each floor)
    ctx.fillStyle = grayed ? '#666' : '#87ceeb';
    const windowWidth = 14;
    const windowHeight = 18;

    // Second floor windows
    for (let i = -1; i <= 1; i++) {
      const wx = school.x + i * 22;
      ctx.fillRect(wx - windowWidth / 2, school.y - size / 4 - windowHeight / 2, windowWidth, windowHeight);
      // Window frame
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(wx - windowWidth / 2, school.y - size / 4 - windowHeight / 2, windowWidth, windowHeight);
      // Window divider
      ctx.beginPath();
      ctx.moveTo(wx, school.y - size / 4 - windowHeight / 2);
      ctx.lineTo(wx, school.y - size / 4 + windowHeight / 2);
      ctx.stroke();
    }

    // First floor windows (left and right of door)
    ctx.fillStyle = grayed ? '#666' : '#87ceeb';
    ctx.fillRect(school.x - 35, school.y + 5, windowWidth, windowHeight);
    ctx.fillRect(school.x + 21, school.y + 5, windowWidth, windowHeight);
    ctx.strokeRect(school.x - 35, school.y + 5, windowWidth, windowHeight);
    ctx.strokeRect(school.x + 21, school.y + 5, windowWidth, windowHeight);

    // School name plate
    ctx.fillStyle = color;
    ctx.fillRect(school.x - 25, school.y + size / 2 - 5, 50, 8);
    ctx.strokeStyle = grayed ? '#333' : '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(school.x - 25, school.y + size / 2 - 5, 50, 8);

    // Draw guard tower if upgraded (animated)
    if (hasGuard && !grayed) {
      this.drawGuardTower(school.x + size / 2 + 25, school.y - 10, color);
    }

    // Draw prestige banner/flag if upgraded (animated waving)
    if (hasPrestige && !grayed) {
      this.drawPrestigeBanner(school.x, school.y - size / 2 - 50, color);
    }

    // Health bar
    if (!grayed && school.health < school.maxHealth) {
      this.drawHealthBar(school.x, school.y - size / 2 - (hasPrestige ? 80 : 55), size, school.health, school.maxHealth);
    }

    // Show if this is the local player's school
    if (school.playerId === this.game.localPlayerId && !grayed) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      const fenceOffset = hasFence ? 20 : 5;
      ctx.strokeRect(school.x - size / 2 - fenceOffset, school.y - size / 2 - fenceOffset,
                     size + fenceOffset * 2, size + fenceOffset * 2);
      ctx.setLineDash([]);
    }
  }

  drawDestroyedSchool(school) {
    const ctx = this.ctx;
    const size = CONSTANTS.SCHOOL_SIZE;
    const color = CONSTANTS.PLAYER_COLORS[school.playerId];
    const progress = Math.min(1, school.destructionTime / school.destructionDuration);

    // Draw debris particles (flying bricks)
    for (const debris of school.debris) {
      if (debris.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = debris.opacity;
      ctx.translate(debris.x, debris.y);
      ctx.rotate(debris.rotation);

      ctx.fillStyle = debris.color;
      ctx.fillRect(-debris.size / 2, -debris.size / 2, debris.size, debris.size);

      ctx.restore();
    }

    // Draw ruined building base
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(school.x - size / 2, school.y - size / 2 + 30, size, size - 30);

    // Rubble pile
    ctx.fillStyle = '#555';
    for (let i = 0; i < 8; i++) {
      const rx = school.x - size / 2 + Math.random() * size;
      const ry = school.y + size / 2 - 10 - Math.random() * 20;
      const rs = 10 + Math.random() * 20;
      ctx.beginPath();
      ctx.arc(rx, ry, rs, 0, Math.PI * 2);
      ctx.fill();
    }

    // Broken walls
    ctx.fillStyle = '#654321';
    // Left wall fragment
    ctx.beginPath();
    ctx.moveTo(school.x - size / 2, school.y + size / 2);
    ctx.lineTo(school.x - size / 2, school.y - size / 4);
    ctx.lineTo(school.x - size / 2 + 15, school.y);
    ctx.lineTo(school.x - size / 2 + 10, school.y + size / 2);
    ctx.closePath();
    ctx.fill();

    // Right wall fragment
    ctx.beginPath();
    ctx.moveTo(school.x + size / 2, school.y + size / 2);
    ctx.lineTo(school.x + size / 2, school.y - size / 3);
    ctx.lineTo(school.x + size / 2 - 20, school.y - size / 6);
    ctx.lineTo(school.x + size / 2 - 15, school.y + size / 2);
    ctx.closePath();
    ctx.fill();

    // Broken brick details
    ctx.fillStyle = '#8B4513';
    for (let i = 0; i < 5; i++) {
      const bx = school.x - size / 3 + i * 15;
      const by = school.y + size / 4;
      ctx.fillRect(bx, by, 10, 8);
    }

    // Smoke/dust
    ctx.fillStyle = `rgba(100, 100, 100, ${0.3 * (1 - progress)})`;
    for (let i = 0; i < 3; i++) {
      const smokeY = school.y - 20 - progress * 50 - i * 30;
      const smokeSize = 30 + progress * 40 + i * 20;
      ctx.beginPath();
      ctx.arc(school.x + (i - 1) * 20, smokeY, smokeSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw fires
    for (const fire of school.fires) {
      if (fire.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = fire.opacity;

      // Fire glow
      const gradient = ctx.createRadialGradient(fire.x, fire.y, 0, fire.x, fire.y, fire.size * 2);
      gradient.addColorStop(0, 'rgba(255, 200, 50, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(fire.x, fire.y, fire.size * 2, 0, Math.PI * 2);
      ctx.fill();

      // Fire core
      ctx.fillStyle = '#FF6600';
      ctx.beginPath();
      ctx.moveTo(fire.x, fire.y - fire.size);
      ctx.quadraticCurveTo(fire.x + fire.size * 0.5, fire.y - fire.size * 0.5, fire.x + fire.size * 0.3, fire.y);
      ctx.quadraticCurveTo(fire.x + fire.size * 0.2, fire.y + fire.size * 0.3, fire.x, fire.y + fire.size * 0.2);
      ctx.quadraticCurveTo(fire.x - fire.size * 0.2, fire.y + fire.size * 0.3, fire.x - fire.size * 0.3, fire.y);
      ctx.quadraticCurveTo(fire.x - fire.size * 0.5, fire.y - fire.size * 0.5, fire.x, fire.y - fire.size);
      ctx.fill();

      // Yellow inner flame
      ctx.fillStyle = '#FFCC00';
      ctx.beginPath();
      ctx.moveTo(fire.x, fire.y - fire.size * 0.6);
      ctx.quadraticCurveTo(fire.x + fire.size * 0.25, fire.y - fire.size * 0.2, fire.x + fire.size * 0.15, fire.y);
      ctx.quadraticCurveTo(fire.x, fire.y + fire.size * 0.1, fire.x - fire.size * 0.15, fire.y);
      ctx.quadraticCurveTo(fire.x - fire.size * 0.25, fire.y - fire.size * 0.2, fire.x, fire.y - fire.size * 0.6);
      ctx.fill();

      ctx.restore();
    }

    // "DESTROYED" text
    if (progress > 0.5) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (progress - 0.5) * 2);
      ctx.fillStyle = '#FF0000';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText('DESTROYED', school.x, school.y - size / 2 - 20);
      ctx.fillText('DESTROYED', school.x, school.y - size / 2 - 20);
      ctx.restore();
    }
  }

  drawFence(x, y, size, color) {
    const ctx = this.ctx;
    const fenceDistance = size / 2 + 15;
    const postSpacing = 20;
    const postHeight = 25;
    const postWidth = 4;

    // Fence color (wood brown)
    const fenceColor = '#8B4513';
    const fenceDark = '#5D3A1A';

    // Draw fence posts around the school
    const positions = [
      { startX: x - fenceDistance, startY: y - fenceDistance, endX: x + fenceDistance, endY: y - fenceDistance, horizontal: true },
      { startX: x - fenceDistance, startY: y + fenceDistance, endX: x + fenceDistance, endY: y + fenceDistance, horizontal: true },
      { startX: x - fenceDistance, startY: y - fenceDistance, endX: x - fenceDistance, endY: y + fenceDistance, horizontal: false },
      { startX: x + fenceDistance, startY: y - fenceDistance, endX: x + fenceDistance, endY: y + fenceDistance, horizontal: false }
    ];

    for (const pos of positions) {
      if (pos.horizontal) {
        // Horizontal fence
        const length = pos.endX - pos.startX;
        const numPosts = Math.floor(length / postSpacing);

        for (let i = 0; i <= numPosts; i++) {
          const px = pos.startX + i * postSpacing;
          // Fence post
          ctx.fillStyle = fenceColor;
          ctx.fillRect(px - postWidth / 2, pos.startY - postHeight, postWidth, postHeight);
          // Post top (pointed)
          ctx.beginPath();
          ctx.moveTo(px - postWidth / 2 - 1, pos.startY - postHeight);
          ctx.lineTo(px, pos.startY - postHeight - 6);
          ctx.lineTo(px + postWidth / 2 + 1, pos.startY - postHeight);
          ctx.closePath();
          ctx.fill();
        }

        // Horizontal bars
        ctx.fillStyle = fenceDark;
        ctx.fillRect(pos.startX, pos.startY - postHeight + 5, length, 3);
        ctx.fillRect(pos.startX, pos.startY - 8, length, 3);
      } else {
        // Vertical fence
        const length = pos.endY - pos.startY;
        const numPosts = Math.floor(length / postSpacing);

        for (let i = 0; i <= numPosts; i++) {
          const py = pos.startY + i * postSpacing;
          // Fence post
          ctx.fillStyle = fenceColor;
          ctx.fillRect(pos.startX - postWidth / 2, py - postHeight / 2, postWidth, postHeight);
        }

        // Vertical bars
        ctx.fillStyle = fenceDark;
        ctx.fillRect(pos.startX - 1, pos.startY, 3, length);
        ctx.fillRect(pos.startX - 1, pos.startY, 3, length);
      }
    }
  }

  drawGuardTower(x, y, color) {
    const ctx = this.ctx;

    // Tower base/legs
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 12, y, 6, 40);
    ctx.fillRect(x + 6, y, 6, 40);

    // Cross beams
    ctx.fillRect(x - 12, y + 15, 24, 4);
    ctx.fillRect(x - 12, y + 30, 24, 4);

    // Platform
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(x - 18, y - 5, 36, 8);

    // Guard booth
    ctx.fillStyle = color;
    ctx.fillRect(x - 14, y - 35, 28, 30);

    // Roof
    ctx.fillStyle = this.darkenColor(color, 30);
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 35);
    ctx.lineTo(x, y - 50);
    ctx.lineTo(x + 18, y - 35);
    ctx.closePath();
    ctx.fill();

    // Window
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(x - 8, y - 28, 16, 12);

    // Window frame
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 8, y - 28, 16, 12);
    ctx.beginPath();
    ctx.moveTo(x, y - 28);
    ctx.lineTo(x, y - 16);
    ctx.stroke();

    // Animated guard silhouette in window
    const guardOffset = Math.sin(this.animTime * 2) * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(x + guardOffset, y - 24, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 3 + guardOffset, y - 20, 6, 6);

    // Flashlight beam (sweeping)
    const beamAngle = Math.sin(this.animTime * 1.5) * 0.5;
    ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
    ctx.beginPath();
    ctx.moveTo(x + guardOffset, y - 20);
    ctx.lineTo(x + guardOffset + Math.cos(beamAngle - 0.3) * 60, y - 20 + Math.sin(beamAngle - 0.3) * 60);
    ctx.lineTo(x + guardOffset + Math.cos(beamAngle + 0.3) * 60, y - 20 + Math.sin(beamAngle + 0.3) * 60);
    ctx.closePath();
    ctx.fill();
  }

  drawPrestigeBanner(x, y, color) {
    const ctx = this.ctx;

    // Tall flag pole
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(x - 2, y - 35, 4, 40);

    // Gold ball on top
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y - 38, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Animated waving banner
    const waveOffset1 = Math.sin(this.animTime * 3) * 3;
    const waveOffset2 = Math.sin(this.animTime * 3 + 1) * 4;
    const waveOffset3 = Math.sin(this.animTime * 3 + 2) * 3;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 33);
    ctx.quadraticCurveTo(x + 15, y - 30 + waveOffset1, x + 35, y - 28 + waveOffset2);
    ctx.lineTo(x + 35, y - 8 + waveOffset3);
    ctx.quadraticCurveTo(x + 15, y - 5 + waveOffset1, x + 2, y - 3);
    ctx.closePath();
    ctx.fill();

    // Banner border
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Star on banner (moves with wave)
    ctx.fillStyle = '#FFD700';
    this.drawStar(x + 18, y - 18 + waveOffset1, 8, 5);

    // Animated banner tail
    const tailWave1 = Math.sin(this.animTime * 4) * 3;
    const tailWave2 = Math.sin(this.animTime * 4 + 0.5) * 4;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 35, y - 28 + waveOffset2);
    ctx.quadraticCurveTo(x + 40, y - 23 + tailWave1, x + 45, y - 23 + tailWave2);
    ctx.lineTo(x + 35, y - 18 + (waveOffset2 + waveOffset3) / 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 35, y - 18 + (waveOffset2 + waveOffset3) / 2);
    ctx.quadraticCurveTo(x + 40, y - 13 + tailWave1, x + 45, y - 13 + tailWave2);
    ctx.lineTo(x + 35, y - 8 + waveOffset3);
    ctx.closePath();
    ctx.fill();
  }

  drawStar(cx, cy, radius, points) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : radius / 2;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawUnit(unit) {
    const ctx = this.ctx;
    const color = CONSTANTS.PLAYER_COLORS[unit.playerId];
    const config = CONSTANTS.UNIT_TYPES[unit.type];

    // Unit size based on type
    let scale;
    switch (unit.type) {
      case 'BOXER':
        scale = 1.4;
        break;
      case 'SENIOR':
        scale = 1.15;
        break;
      case 'KID':
        scale = 0.85;
        break;
      default:
        scale = 1.0;
    }

    // Selection indicator (draw first, behind unit)
    if (unit.selected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;

      // Selection ellipse on ground
      ctx.beginPath();
      ctx.ellipse(unit.x, unit.y + 12 * scale, 14 * scale, 7 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(74, 144, 217, 0.3)';
      ctx.fill();
    }

    // Draw the humanoid figure
    const isMoving = unit.state === 'moving';
    const isAttacking = unit.state === 'attacking';
    this.drawHumanoid(unit.x, unit.y, scale, color, unit.type, isAttacking, isMoving, unit);

    // Health bar (only show if damaged)
    if (unit.health < unit.maxHealth) {
      this.drawHealthBar(unit.x, unit.y - 28 * scale, 20 * scale, unit.health, unit.maxHealth);
    }

    // Attack indicator line
    if (unit.attackTarget && unit.state === 'attacking') {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(unit.x, unit.y);
      ctx.lineTo(unit.attackTarget.x, unit.attackTarget.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawHumanoid(x, y, scale, color, unitType, isAttacking, isMoving = false, unit = null) {
    const ctx = this.ctx;
    const skinColor = '#FFDAB9';
    const darkSkin = '#DEB887';
    const outlineColor = this.darkenColor(color, 50);

    // Attack animation phase (0-1 cycle based on attack cooldown)
    const attackPhase = unit && isAttacking ?
      (unit.lastAttackTime / unit.attackCooldown) : 0;
    const attackCycle = Math.sin(this.animTime * 15); // Fast attack cycling

    // Walking animation offsets
    const walkCycle = isMoving ? Math.sin(this.animTime * 12) : 0;
    const walkCycle2 = isMoving ? Math.cos(this.animTime * 12) : 0;
    const bobOffset = isMoving ? Math.abs(Math.sin(this.animTime * 24)) * 2 : 0;

    // Attack bob for impact feel
    const attackBob = isAttacking ? Math.abs(Math.sin(this.animTime * 20)) * 1.5 : 0;

    ctx.save();
    ctx.translate(x, y - bobOffset - attackBob);

    // Body lean during attacks
    if (isAttacking) {
      const leanAngle = Math.sin(this.animTime * 15) * 0.1;
      ctx.rotate(leanAngle);
    }

    ctx.scale(scale, scale);

    // Shadow (moves with walking)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    const shadowStretch = isMoving ? 1 + Math.abs(walkCycle) * 0.2 : (isAttacking ? 1.2 : 1);
    ctx.ellipse(0, 12 + bobOffset, 10 * shadowStretch, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw attack effects
    if (isAttacking && attackCycle > 0.5) {
      this.drawAttackEffect(ctx, unitType, attackCycle);
    }

    // Legs with more dynamic movement
    ctx.fillStyle = '#333';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;

    if (isAttacking && unitType !== 'KID') {
      // Fighting stance - legs apart
      const stanceWidth = 2 + Math.abs(attackCycle) * 2;

      // Left leg (planted)
      ctx.beginPath();
      ctx.moveTo(-4 - stanceWidth, 5);
      ctx.lineTo(-7 - stanceWidth, 12);
      ctx.lineTo(-4 - stanceWidth, 12);
      ctx.lineTo(-2 - stanceWidth, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right leg (dynamic based on attack type)
      if (unitType === 'SENIOR' && attackCycle > 0) {
        // Senior does kick attacks sometimes
        const kickPhase = Math.sin(this.animTime * 18);
        if (kickPhase > 0.7) {
          // Kicking leg
          ctx.beginPath();
          ctx.moveTo(4 + stanceWidth, 5);
          ctx.lineTo(12 + kickPhase * 8, 2);
          ctx.lineTo(14 + kickPhase * 8, 5);
          ctx.lineTo(6 + stanceWidth, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Shoe
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.ellipse(15 + kickPhase * 8, 3.5, 4, 2.5, 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#333';
        } else {
          // Normal stance
          ctx.beginPath();
          ctx.moveTo(4 + stanceWidth, 5);
          ctx.lineTo(6 + stanceWidth, 12);
          ctx.lineTo(3 + stanceWidth, 12);
          ctx.lineTo(2 + stanceWidth, 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else {
        // Right leg (shifted for power)
        ctx.beginPath();
        ctx.moveTo(4 + stanceWidth, 5);
        ctx.lineTo(6 + stanceWidth, 12);
        ctx.lineTo(3 + stanceWidth, 12);
        ctx.lineTo(2 + stanceWidth, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // Walking or idle legs
      const leftLegSwing = walkCycle * 4;
      ctx.beginPath();
      ctx.moveTo(-4, 5);
      ctx.lineTo(-6 + leftLegSwing, 12);
      ctx.lineTo(-3 + leftLegSwing, 12);
      ctx.lineTo(-2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const rightLegSwing = -walkCycle * 4;
      ctx.beginPath();
      ctx.moveTo(4, 5);
      ctx.lineTo(6 + rightLegSwing, 12);
      ctx.lineTo(3 + rightLegSwing, 12);
      ctx.lineTo(2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Body/shirt with dynamic twist during attacks
    ctx.fillStyle = color;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;

    const bodyTwist = isAttacking ? Math.sin(this.animTime * 15) * 2 : 0;
    ctx.beginPath();
    ctx.moveTo(-7 + bodyTwist, -5);
    ctx.lineTo(-8 + bodyTwist * 0.5, 6);
    ctx.lineTo(8 + bodyTwist * 0.5, 6);
    ctx.lineTo(7 + bodyTwist, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Arms based on state and unit type
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = darkSkin;

    if (unitType === 'BOXER') {
      this.drawBoxerArms(ctx, isAttacking, isMoving, walkCycle, color, outlineColor);
    } else if (unitType === 'SENIOR') {
      this.drawSeniorArms(ctx, isAttacking, isMoving, walkCycle, skinColor, darkSkin);
    } else if (unitType === 'KID') {
      this.drawKidArms(ctx, isAttacking, isMoving, walkCycle, skinColor, darkSkin);
    } else {
      this.drawRegularArms(ctx, isAttacking, isMoving, walkCycle, skinColor, darkSkin);
    }

    // Head with movement
    const headBob = isAttacking ? Math.sin(this.animTime * 20) * 1 : 0;
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = darkSkin;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(headBob, -12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hair based on unit type
    this.drawUnitHair(ctx, unitType, color, headBob);

    // Eyes with expression
    this.drawUnitEyes(ctx, unitType, isAttacking, isMoving, headBob);

    // Unit type badge on chest
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = outlineColor;
    ctx.font = 'bold 6px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let symbol;
    switch (unitType) {
      case 'BOXER': symbol = 'B'; break;
      case 'SENIOR': symbol = 'S'; break;
      case 'KID': symbol = 'K'; break;
      default: symbol = 'R';
    }
    ctx.fillText(symbol, 0, 0.5);

    ctx.restore();
  }

  drawAttackEffect(ctx, unitType, attackCycle) {
    // Draw impact lines/stars during attack
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = attackCycle * 0.6;

    if (unitType === 'BOXER') {
      // Punch impact lines
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 0.5 - Math.PI * 0.25;
        const len = 8 + attackCycle * 6;
        ctx.beginPath();
        ctx.moveTo(16, -4);
        ctx.lineTo(16 + Math.cos(angle) * len, -4 + Math.sin(angle) * len);
        ctx.stroke();
      }
    } else if (unitType === 'SENIOR') {
      // Power strike effect
      ctx.strokeStyle = '#ffd700';
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 0.4 - Math.PI * 0.2;
        const len = 10 + attackCycle * 5;
        ctx.beginPath();
        ctx.moveTo(14, -8);
        ctx.lineTo(14 + Math.cos(angle) * len, -8 + Math.sin(angle) * len);
        ctx.stroke();
      }
    } else {
      // Regular punch dust
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(12, -8, 4 * attackCycle, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawBoxerArms(ctx, isAttacking, isMoving, walkCycle, color, outlineColor) {
    ctx.fillStyle = '#8B0000'; // Dark red gloves
    ctx.strokeStyle = '#5a0000';

    if (isAttacking) {
      // Combo punching - alternates between jab and cross
      const punchPhase = Math.sin(this.animTime * 18);
      const isLeftPunch = punchPhase > 0;

      if (isLeftPunch) {
        // Left jab extended
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-18 - punchPhase * 4, -6 + punchPhase);
        ctx.lineTo(-18 - punchPhase * 4, -2 + punchPhase);
        ctx.lineTo(-8, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Left glove (bigger for impact)
        ctx.beginPath();
        ctx.arc(-20 - punchPhase * 4, -4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right arm guard position
        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(6, -10);
        ctx.lineTo(4, -12);
        ctx.lineTo(5, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(5, -13, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Left arm guard
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-6, -10);
        ctx.lineTo(-4, -12);
        ctx.lineTo(-5, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-5, -13, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right cross extended
        const crossPower = -punchPhase;
        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(20 + crossPower * 5, -5 - crossPower);
        ctx.lineTo(20 + crossPower * 5, -1 - crossPower);
        ctx.lineTo(8, 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right glove with motion blur effect
        ctx.beginPath();
        ctx.arc(22 + crossPower * 5, -3, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Add sweat drops during intense fighting
      ctx.fillStyle = '#88ccff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(-8 + Math.random() * 16, -18, 1, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (isMoving) {
      // Running boxer stance
      const armPump = walkCycle * 2;

      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-12 - armPump, -8 - armPump);
      ctx.lineTo(-10 - armPump, -10 - armPump);
      ctx.lineTo(-6, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-11 - armPump, -10 - armPump, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(10 + armPump, -10 + armPump);
      ctx.lineTo(8 + armPump, -12 + armPump);
      ctx.lineTo(5, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(9 + armPump, -12 + armPump, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Boxing guard stance with slight bobbing
      const guardBob = Math.sin(this.animTime * 3) * 0.5;

      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-12, -8 + guardBob);
      ctx.lineTo(-10, -10 + guardBob);
      ctx.lineTo(-6, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-11, -10 + guardBob, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(10, -10 - guardBob);
      ctx.lineTo(8, -12 - guardBob);
      ctx.lineTo(5, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(9, -12 - guardBob, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  drawSeniorArms(ctx, isAttacking, isMoving, walkCycle, skinColor, darkSkin) {
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = darkSkin;

    if (isAttacking) {
      // Senior has powerful combo attacks
      const attackPhase = Math.sin(this.animTime * 16);
      const attackType = Math.floor((this.animTime * 2) % 3); // Cycle through 3 attack types

      if (attackType === 0) {
        // Straight punch
        const punchExt = Math.abs(attackPhase) * 8;

        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-11, 2);
        ctx.lineTo(-9, 3);
        ctx.lineTo(-6, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(14 + punchExt, -8);
        ctx.lineTo(12 + punchExt, -10);
        ctx.lineTo(6, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Fist
        ctx.beginPath();
        ctx.arc(13 + punchExt, -9, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (attackType === 1) {
        // Elbow strike
        const elbowSwing = attackPhase * 6;

        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-10, 2);
        ctx.lineTo(-8, 3);
        ctx.lineTo(-6, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Elbow arm
        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(12 + elbowSwing, -2);
        ctx.lineTo(10 + elbowSwing, 0);
        ctx.lineTo(6, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Elbow point
        ctx.beginPath();
        ctx.arc(13 + elbowSwing, -1, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Uppercut
        const upperPhase = attackPhase > 0 ? attackPhase : 0;

        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-11, 1);
        ctx.lineTo(-9, 2);
        ctx.lineTo(-6, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(10, -6 - upperPhase * 10);
        ctx.lineTo(8, -8 - upperPhase * 10);
        ctx.lineTo(5, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(9, -8 - upperPhase * 10, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (isMoving) {
      const leftArmSwing = -walkCycle * 3;
      const rightArmSwing = walkCycle * 3;

      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-11 + leftArmSwing, 3 - Math.abs(leftArmSwing) * 0.3);
      ctx.lineTo(-9 + leftArmSwing, 4 - Math.abs(leftArmSwing) * 0.3);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(11 + rightArmSwing, 3 - Math.abs(rightArmSwing) * 0.3);
      ctx.lineTo(9 + rightArmSwing, 4 - Math.abs(rightArmSwing) * 0.3);
      ctx.lineTo(6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Confident stance
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-10, 1);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(12, 0);
      ctx.lineTo(10, 1);
      ctx.lineTo(6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  drawRegularArms(ctx, isAttacking, isMoving, walkCycle, skinColor, darkSkin) {
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = darkSkin;

    if (isAttacking) {
      // Regular has scrappy punch combos
      const punchPhase = Math.sin(this.animTime * 14);
      const isLeftPunch = punchPhase > 0;

      if (isLeftPunch) {
        // Left hook
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-14 - punchPhase * 3, -6);
        ctx.lineTo(-13 - punchPhase * 3, -8);
        ctx.lineTo(-6, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-14 - punchPhase * 3, -7, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right arm ready
        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(10, -4);
        ctx.lineTo(9, -6);
        ctx.lineTo(6, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(9, -6, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Left arm ready
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-10, -4);
        ctx.lineTo(-9, -6);
        ctx.lineTo(-6, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-9, -6, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right haymaker
        const haymaker = -punchPhase;
        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(12 + haymaker * 5, -9);
        ctx.lineTo(10 + haymaker * 5, -11);
        ctx.lineTo(5, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(11 + haymaker * 5, -10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (isMoving) {
      const leftArmSwing = -walkCycle * 3;
      const rightArmSwing = walkCycle * 3;

      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-11 + leftArmSwing, 3 - Math.abs(leftArmSwing) * 0.3);
      ctx.lineTo(-9 + leftArmSwing, 4 - Math.abs(leftArmSwing) * 0.3);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(11 + rightArmSwing, 3 - Math.abs(rightArmSwing) * 0.3);
      ctx.lineTo(9 + rightArmSwing, 4 - Math.abs(rightArmSwing) * 0.3);
      ctx.lineTo(6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-11, 3);
      ctx.lineTo(-9, 4);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(11, 3);
      ctx.lineTo(9, 4);
      ctx.lineTo(6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  drawKidArms(ctx, isAttacking, isMoving, walkCycle, skinColor, darkSkin) {
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = darkSkin;

    if (isAttacking) {
      // Kid throwing animation
      const throwPhase = Math.sin(this.animTime * 10);

      if (throwPhase > 0) {
        // Wind up
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-10, 2);
        ctx.lineTo(-8, 3);
        ctx.lineTo(-6, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right arm winding back with grenade
        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(4 - throwPhase * 6, -10 - throwPhase * 4);
        ctx.lineTo(2 - throwPhase * 6, -12 - throwPhase * 4);
        ctx.lineTo(5, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Hand
        ctx.beginPath();
        ctx.arc(3 - throwPhase * 6, -12 - throwPhase * 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Grenade in hand
        ctx.fillStyle = '#4a5';
        ctx.beginPath();
        ctx.ellipse(3 - throwPhase * 6, -15 - throwPhase * 4, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#363';
        ctx.stroke();
      } else {
        // Throw release
        const releasePhase = -throwPhase;

        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-10, 1);
        ctx.lineTo(-8, 2);
        ctx.lineTo(-6, -1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right arm extended forward
        ctx.beginPath();
        ctx.moveTo(8, -3);
        ctx.lineTo(14 + releasePhase * 6, -6 + releasePhase * 2);
        ctx.lineTo(12 + releasePhase * 6, -8 + releasePhase * 2);
        ctx.lineTo(6, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(13 + releasePhase * 6, -7 + releasePhase * 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (isMoving) {
      // Running with smaller arm swings (kid is smaller)
      const leftArmSwing = -walkCycle * 2.5;
      const rightArmSwing = walkCycle * 2.5;

      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-10 + leftArmSwing, 2);
      ctx.lineTo(-8 + leftArmSwing, 3);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(10 + rightArmSwing, 2);
      ctx.lineTo(8 + rightArmSwing, 3);
      ctx.lineTo(6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Idle - holding grenade
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-10, 2);
      ctx.lineTo(-8, 3);
      ctx.lineTo(-6, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(10, 0);
      ctx.lineTo(8, 1);
      ctx.lineTo(6, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Grenade in right hand
      ctx.fillStyle = '#4a5';
      ctx.beginPath();
      ctx.ellipse(11, -1, 2.5, 3.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#363';
      ctx.stroke();
    }
  }

  drawUnitHair(ctx, unitType, color, headBob) {
    if (unitType === 'SENIOR') {
      // Senior has styled/slicked back hair
      ctx.fillStyle = '#2F1810';
      ctx.beginPath();
      ctx.arc(headBob, -14, 6, Math.PI, 0, false);
      ctx.lineTo(5 + headBob, -12);
      ctx.quadraticCurveTo(6 + headBob, -17, 3 + headBob, -19);
      ctx.lineTo(-3 + headBob, -19);
      ctx.quadraticCurveTo(-6 + headBob, -17, -5 + headBob, -12);
      ctx.closePath();
      ctx.fill();
    } else if (unitType === 'BOXER') {
      // Boxer has short/buzz cut
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(headBob, -13, 6.5, Math.PI * 1.2, Math.PI * -0.2, false);
      ctx.closePath();
      ctx.fill();

      // Headband
      ctx.fillStyle = color;
      ctx.fillRect(-7 + headBob, -15, 14, 3);
    } else if (unitType === 'KID') {
      // Kid has messy spiky hair
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.arc(headBob, -14, 5.5, Math.PI * 1.1, Math.PI * -0.1, false);
      ctx.closePath();
      ctx.fill();

      // Spiky strands
      ctx.strokeStyle = '#6B3513';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4 + headBob, -18);
      ctx.lineTo(-3 + headBob, -15);
      ctx.moveTo(-1 + headBob, -19);
      ctx.lineTo(0 + headBob, -16);
      ctx.moveTo(2 + headBob, -18);
      ctx.lineTo(2 + headBob, -15);
      ctx.moveTo(5 + headBob, -17);
      ctx.lineTo(4 + headBob, -14);
      ctx.stroke();
    } else {
      // Regular has messy/normal hair
      ctx.fillStyle = '#4a3728';
      ctx.beginPath();
      ctx.arc(headBob, -14, 6, Math.PI * 1.1, Math.PI * -0.1, false);
      ctx.closePath();
      ctx.fill();

      // Some hair strands
      ctx.strokeStyle = '#3a2718';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3 + headBob, -19);
      ctx.lineTo(-2 + headBob, -17);
      ctx.moveTo(0 + headBob, -19);
      ctx.lineTo(0 + headBob, -17);
      ctx.moveTo(3 + headBob, -19);
      ctx.lineTo(2 + headBob, -17);
      ctx.stroke();
    }
  }

  drawUnitEyes(ctx, unitType, isAttacking, isMoving, headBob) {
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-3 + headBob, -12, 1.2, 0, Math.PI * 2);
    ctx.arc(3 + headBob, -12, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Expression based on state and unit type
    if (isAttacking) {
      // Angry eyebrows
      ctx.strokeStyle = unitType === 'KID' ? '#6B3513' : '#4a3728';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5 + headBob, -15);
      ctx.lineTo(-2 + headBob, -14);
      ctx.moveTo(5 + headBob, -15);
      ctx.lineTo(2 + headBob, -14);
      ctx.stroke();

      // Open mouth (yelling)
      if (unitType === 'BOXER') {
        // Boxer has mouthguard
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(headBob, -8, 3, 1.5, 0, 0, Math.PI);
        ctx.fill();
      } else if (unitType === 'KID') {
        // Kid yelling
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.ellipse(headBob, -8, 2.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Others yelling
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.ellipse(headBob, -8, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isMoving) {
      // Focused expression
      ctx.strokeStyle = '#4a3728';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4 + headBob, -14.5);
      ctx.lineTo(-2 + headBob, -14);
      ctx.moveTo(4 + headBob, -14.5);
      ctx.lineTo(2 + headBob, -14);
      ctx.stroke();
    } else {
      // Neutral/idle expression
      if (unitType === 'SENIOR') {
        // Senior has confident smirk
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-2 + headBob, -8);
        ctx.quadraticCurveTo(headBob, -7, 3 + headBob, -8);
        ctx.stroke();
      } else if (unitType === 'KID') {
        // Kid has mischievous grin
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-2 + headBob, -8);
        ctx.quadraticCurveTo(headBob, -6.5, 2 + headBob, -8);
        ctx.stroke();
      }
    }
  }

  drawFlag(flag, grayed = false) {
    const ctx = this.ctx;
    const size = CONSTANTS.FLAG_SIZE;

    // Selection indicator
    if (flag.selected && !grayed) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(flag.x, flag.y, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw sandbags if present
    if ((flag.hasSandbags || flag.sandbagsBuilding) && !grayed) {
      this.drawSandbags(flag);
    }

    // Draw tower if present
    if ((flag.hasTower || flag.towerBuilding) && !grayed) {
      this.drawTower(flag);
    }

    // Flag pole
    ctx.fillStyle = grayed ? '#444' : '#8b4513';
    ctx.fillRect(flag.x - 2, flag.y - size, 4, size + 10);

    // Flag fabric
    const flagColor = flag.ownerId !== null ?
      (grayed ? '#555' : CONSTANTS.PLAYER_COLORS[flag.ownerId]) :
      (grayed ? '#555' : '#fff');

    ctx.fillStyle = flagColor;
    ctx.beginPath();
    ctx.moveTo(flag.x + 2, flag.y - size);
    ctx.lineTo(flag.x + size, flag.y - size + 10);
    ctx.lineTo(flag.x + 2, flag.y - size + 20);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = grayed ? '#333' : '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Capture progress indicator
    if (flag.captureProgress > 0 && !grayed) {
      const progressColor = CONSTANTS.PLAYER_COLORS[flag.capturingPlayerId] || '#fff';

      ctx.strokeStyle = progressColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(flag.x, flag.y, CONSTANTS.FLAG_CAPTURE_RADIUS,
        -Math.PI / 2,
        -Math.PI / 2 + (flag.captureProgress / CONSTANTS.FLAG_CAPTURE_TIME) * Math.PI * 2
      );
      ctx.stroke();
    }

    // Capture radius indicator (when units nearby)
    if (flag.showCaptureRadius && !grayed) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(flag.x, flag.y, CONSTANTS.FLAG_CAPTURE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawSandbags(flag) {
    const ctx = this.ctx;
    const x = flag.x;
    const y = flag.y;

    // Building animation
    if (flag.sandbagsBuilding) {
      const progress = flag.sandbagsBuildProgress / 3000;
      ctx.globalAlpha = 0.3 + progress * 0.7;
    }

    // Draw sandbag circle around flag
    const radius = 35;
    const bagCount = 12;

    for (let i = 0; i < bagCount; i++) {
      const angle = (i / bagCount) * Math.PI * 2;
      const bx = x + Math.cos(angle) * radius;
      const by = y + Math.sin(angle) * radius;

      // Sandbag
      ctx.fillStyle = '#8B7355';
      ctx.strokeStyle = '#5D4E37';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.ellipse(bx, by, 12, 8, angle + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bag texture lines
      ctx.strokeStyle = '#6B5D47';
      ctx.beginPath();
      ctx.moveTo(bx - 6, by);
      ctx.lineTo(bx + 6, by);
      ctx.stroke();
    }

    // Second layer (stacked)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const bx = x + Math.cos(angle) * radius;
      const by = y + Math.sin(angle) * radius - 8;

      ctx.fillStyle = '#9B8365';
      ctx.strokeStyle = '#5D4E37';
      ctx.beginPath();
      ctx.ellipse(bx, by, 10, 6, angle + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (flag.sandbagsBuilding) {
      ctx.globalAlpha = 1;
    }
  }

  drawTower(flag) {
    const ctx = this.ctx;
    const x = flag.x + 25;
    const y = flag.y;
    const ownerColor = CONSTANTS.PLAYER_COLORS[flag.ownerId] || '#888';

    // Building animation
    if (flag.towerBuilding) {
      const progress = flag.towerBuildProgress / 2000;
      ctx.globalAlpha = 0.3 + progress * 0.7;

      // Scaffolding animation
      const buildHeight = 50 * progress;

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(x - 8, y - buildHeight, 16, buildHeight);

      // Animated construction lines
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      const sparkle = Math.sin(this.animTime * 10) > 0;
      if (sparkle) {
        ctx.beginPath();
        ctx.moveTo(x - 10, y - buildHeight);
        ctx.lineTo(x + 10, y - buildHeight + 10);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      return;
    }

    // Tower base
    ctx.fillStyle = '#654321';
    ctx.fillRect(x - 10, y - 15, 20, 15);

    // Tower body
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 8, y - 45, 16, 30);

    // Tower top platform
    ctx.fillStyle = ownerColor;
    ctx.fillRect(x - 12, y - 50, 24, 8);

    // Roof
    ctx.fillStyle = this.darkenColor(ownerColor, 30);
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 50);
    ctx.lineTo(x, y - 65);
    ctx.lineTo(x + 14, y - 50);
    ctx.closePath();
    ctx.fill();

    // Window/shooting hole
    ctx.fillStyle = '#333';
    ctx.fillRect(x - 4, y - 40, 8, 6);

    // Tower gun (rotates toward target)
    if (flag.towerTarget) {
      const angle = Math.atan2(flag.towerTarget.y - (y - 37), flag.towerTarget.x - x);
      ctx.save();
      ctx.translate(x, y - 37);
      ctx.rotate(angle);
      ctx.fillStyle = '#444';
      ctx.fillRect(0, -2, 20, 4);
      ctx.restore();
    }

    // Health bar if damaged
    if (flag.towerHealth < flag.towerMaxHealth) {
      this.drawHealthBar(x, y - 70, 24, flag.towerHealth, flag.towerMaxHealth);
    }

    // Attack animation - muzzle flash
    if (flag.towerLastAttack > flag.towerAttackCooldown - 100) {
      ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
      ctx.beginPath();
      ctx.arc(x + 18, y - 37, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHealthBar(x, y, width, health, maxHealth) {
    const ctx = this.ctx;
    const height = 6;
    const ratio = health / maxHealth;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(x - width / 2, y, width, height);

    // Health
    let color;
    if (ratio > 0.6) color = '#4a4';
    else if (ratio > 0.3) color = '#aa4';
    else color = '#a44';

    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, y, width * ratio, height);

    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2, y, width, height);
  }

  drawSelectionBox() {
    const ctx = this.ctx;
    const sel = this.game.selection;

    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(74, 144, 217, 0.2)';

    const x = Math.min(sel.startX, sel.endX);
    const y = Math.min(sel.startY, sel.endY);
    const w = Math.abs(sel.endX - sel.startX);
    const h = Math.abs(sel.endY - sel.startY);

    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  drawFogBase() {
    // This draws unexplored areas as completely black
    // Implemented in drawFogOverlay for performance
  }

  drawFogOverlay() {
    const ctx = this.ctx;
    const fogData = this.game.fogOfWar.getVisibilityData(this.game.localPlayerId);

    if (!fogData) return;

    // Collect all vision sources for the local player
    const visionSources = [];

    // Add school vision
    const localSchool = this.game.schools[this.game.localPlayerId];
    if (localSchool && localSchool.health > 0 && !localSchool.destroyed) {
      visionSources.push({
        x: localSchool.x,
        y: localSchool.y,
        radius: localSchool.visionRadius
      });
    }

    // Add unit vision
    for (const unit of this.game.units) {
      if (unit.playerId !== this.game.localPlayerId) continue;
      if (unit.health <= 0) continue;
      visionSources.push({
        x: unit.x,
        y: unit.y,
        radius: unit.visionRadius
      });
    }

    // Add owned flag vision
    for (const flag of this.game.flags) {
      if (flag.ownerId !== this.game.localPlayerId) continue;
      visionSources.push({
        x: flag.x,
        y: flag.y,
        radius: flag.visionRadius
      });
    }

    // Draw fog using grid but with circular visibility check
    const gridSize = 50;
    const cols = Math.ceil(this.game.mapWidth / gridSize);
    const rows = Math.ceil(this.game.mapHeight / gridSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * gridSize;
        const y = row * gridSize;
        const cellCenterX = x + gridSize / 2;
        const cellCenterY = y + gridSize / 2;
        const index = row * cols + col;
        const baseVisibility = fogData[index] || 0;

        // Check distance to all vision sources for circular fog
        let minDistRatio = Infinity;
        for (const source of visionSources) {
          const dist = Math.hypot(cellCenterX - source.x, cellCenterY - source.y);
          const ratio = dist / source.radius;
          if (ratio < minDistRatio) {
            minDistRatio = ratio;
          }
        }

        // Determine fog opacity based on distance
        let fogOpacity = 0;
        if (minDistRatio > 1.0) {
          // Outside all vision circles
          if (baseVisibility === 0) {
            fogOpacity = 0.9; // Unexplored - dark
          } else {
            fogOpacity = 0.5; // Explored but not visible - gray
          }
        } else if (minDistRatio > 0.7) {
          // Edge of vision - soft fade
          const fadeProgress = (minDistRatio - 0.7) / 0.3;
          if (baseVisibility === 0) {
            fogOpacity = fadeProgress * 0.9;
          } else {
            fogOpacity = fadeProgress * 0.5;
          }
        }
        // else: inside vision circle, no fog (fogOpacity = 0)

        if (fogOpacity > 0.01) {
          ctx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      }
    }
  }

  drawDyingUnit(dying) {
    const ctx = this.ctx;
    const color = CONSTANTS.PLAYER_COLORS[dying.playerId];

    ctx.save();
    ctx.globalAlpha = dying.opacity;

    // Death animation - falling and fading
    const fallOffset = (1 - dying.opacity) * 20;
    const rotation = (1 - dying.opacity) * 0.5;

    ctx.translate(dying.x, dying.y + fallOffset);
    ctx.rotate(rotation);

    // Draw simplified dying figure
    const scale = dying.type === 'BOXER' ? 1.4 : (dying.type === 'SENIOR' ? 1.15 : 1.0);
    ctx.scale(scale, scale);

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-7, -5, 14, 12);

    // Head
    ctx.fillStyle = '#FFDAB9';
    ctx.beginPath();
    ctx.arc(0, -12, 7, 0, Math.PI * 2);
    ctx.fill();

    // X eyes (dead)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -14);
    ctx.lineTo(-1, -10);
    ctx.moveTo(-1, -14);
    ctx.lineTo(-5, -10);
    ctx.moveTo(1, -14);
    ctx.lineTo(5, -10);
    ctx.moveTo(5, -14);
    ctx.lineTo(1, -10);
    ctx.stroke();

    ctx.restore();
  }

  drawAirstrike(strike) {
    const ctx = this.ctx;

    // Draw target indicator first (before plane)
    if (!strike.dropped) {
      // Animated pulsing target circle
      const pulse = Math.sin(this.animTime * 6) * 0.3 + 0.7;

      ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([15, 8]);
      ctx.beginPath();
      ctx.arc(strike.targetX, strike.targetY, CONSTANTS.AIRSTRIKE.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner crosshair
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(strike.targetX - 30, strike.targetY);
      ctx.lineTo(strike.targetX + 30, strike.targetY);
      ctx.moveTo(strike.targetX, strike.targetY - 30);
      ctx.lineTo(strike.targetX, strike.targetY + 30);
      ctx.stroke();
    }

    // Draw plane shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(strike.planeX + 20, strike.planeY + 80, 50, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw plane
    ctx.save();
    ctx.translate(strike.planeX, strike.planeY);
    ctx.rotate(strike.planeAngle);

    // Contrails
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, -15);
    ctx.lineTo(100, -15);
    ctx.moveTo(40, 15);
    ctx.lineTo(100, 15);
    ctx.stroke();

    // Plane body (larger and more visible)
    ctx.fillStyle = '#556B2F'; // Military green
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 50, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wings
    ctx.fillStyle = '#6B8E23';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-20, -45);
    ctx.lineTo(15, -45);
    ctx.lineTo(10, 0);
    ctx.lineTo(15, 45);
    ctx.lineTo(-20, 45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tail fin
    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.lineTo(50, -25);
    ctx.lineTo(55, -25);
    ctx.lineTo(45, 0);
    ctx.lineTo(55, 25);
    ctx.lineTo(50, 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = '#87CEEB';
    ctx.strokeStyle = '#4682B4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-30, 0, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Engine exhausts (animated)
    const flicker = Math.random() * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 150, 50, ${flicker})`;
    ctx.beginPath();
    ctx.ellipse(55, -10, 8, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(55, 10, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Draw falling books
    for (const book of strike.books) {
      if (!book.landed) {
        ctx.save();
        ctx.translate(book.x, book.y);
        ctx.rotate(book.rotation);

        // Book shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(5, book.targetY - book.y + 5, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Book (larger)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-12, -8, 24, 16);
        ctx.fillStyle = '#F5F5DC';
        ctx.fillRect(-10, -6, 18, 12);

        // Book spine
        ctx.fillStyle = '#654321';
        ctx.fillRect(-12, -8, 4, 16);

        // Book title lines
        ctx.fillStyle = '#333';
        ctx.fillRect(-6, -3, 10, 2);
        ctx.fillRect(-6, 1, 8, 2);

        ctx.restore();
      }
    }
  }

  drawEffect(effect) {
    const ctx = this.ctx;
    const progress = effect.time / effect.duration;

    if (effect.type === 'explosion') {
      // Expanding ring explosion
      const maxRadius = effect.radius * 1.5;
      const currentRadius = maxRadius * progress;
      const opacity = 1 - progress;

      // Outer ring
      ctx.strokeStyle = `rgba(255, 100, 0, ${opacity})`;
      ctx.lineWidth = 10 * (1 - progress);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner flash
      if (progress < 0.3) {
        const flashOpacity = 1 - progress / 0.3;
        ctx.fillStyle = `rgba(255, 255, 200, ${flashOpacity * 0.5})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }

      // Debris particles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + progress * 2;
        const dist = currentRadius * 0.8;
        const px = effect.x + Math.cos(angle) * dist;
        const py = effect.y + Math.sin(angle) * dist;

        ctx.fillStyle = `rgba(100, 100, 100, ${opacity})`;
        ctx.beginPath();
        ctx.arc(px, py, 5 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (effect.type === 'book_impact') {
      // Small dust cloud
      const opacity = 1 - progress;
      const size = 20 + progress * 30;

      ctx.fillStyle = `rgba(139, 119, 101, ${opacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'tower_shot') {
      // Projectile line from tower to target
      const opacity = 1 - progress;

      // Calculate current position along the line
      const currentX = effect.startX + (effect.endX - effect.startX) * progress;
      const currentY = effect.startY + (effect.endY - effect.startY) * progress;

      // Draw projectile trail
      ctx.strokeStyle = `rgba(255, 200, 100, ${opacity})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(effect.startX, effect.startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      // Draw projectile head
      ctx.fillStyle = `rgba(255, 100, 50, ${opacity})`;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'heal') {
      // Healing sparkles
      const opacity = 1 - progress;

      // Green glow
      ctx.fillStyle = `rgba(100, 255, 100, ${opacity * 0.3})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 30 + progress * 20, 0, Math.PI * 2);
      ctx.fill();

      // Rising plus signs
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + progress * 2;
        const dist = 15 + progress * 30;
        const px = effect.x + Math.cos(angle) * dist;
        const py = effect.y - progress * 40 + Math.sin(angle) * 10;

        ctx.fillStyle = `rgba(100, 255, 100, ${opacity})`;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('+', px, py);
      }
    } else if (effect.type === 'grenade_explosion') {
      // Grenade explosion
      const maxRadius = effect.radius;
      const currentRadius = maxRadius * Math.min(1, progress * 2);
      const opacity = 1 - progress;

      // Fire ring
      ctx.strokeStyle = `rgba(255, 150, 50, ${opacity})`;
      ctx.lineWidth = 8 * (1 - progress);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner flash
      if (progress < 0.3) {
        const flashOpacity = 1 - progress / 0.3;
        ctx.fillStyle = `rgba(255, 200, 100, ${flashOpacity * 0.6})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, maxRadius * 0.6 * (1 - progress), 0, Math.PI * 2);
        ctx.fill();
      }

      // Smoke puffs
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const dist = currentRadius * 0.7;
        const px = effect.x + Math.cos(angle) * dist;
        const py = effect.y + Math.sin(angle) * dist;

        ctx.fillStyle = `rgba(80, 80, 80, ${opacity * 0.5})`;
        ctx.beginPath();
        ctx.arc(px, py, 10 + progress * 15, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (effect.type === 'bullet') {
      // Bullet trail
      const opacity = 1 - progress;
      const currentX = effect.startX + (effect.endX - effect.startX) * progress;
      const currentY = effect.startY + (effect.endY - effect.startY) * progress;

      ctx.strokeStyle = `rgba(255, 255, 150, ${opacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(effect.startX, effect.startY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      // Bullet head
      ctx.fillStyle = `rgba(255, 255, 200, ${opacity})`;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.type === 'airdrop') {
      // Parachute drop visual
      const opacity = 1 - progress;

      // Parachutes descending
      for (let i = 0; i < 3; i++) {
        const px = effect.x + (i - 1) * 40;
        const py = effect.y - 100 + progress * 100;

        // Parachute canopy
        ctx.fillStyle = `rgba(200, 200, 200, ${opacity})`;
        ctx.beginPath();
        ctx.arc(px, py - 30, 20, Math.PI, 0, false);
        ctx.fill();

        // Strings
        ctx.strokeStyle = `rgba(100, 100, 100, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - 15, py - 20);
        ctx.lineTo(px, py);
        ctx.moveTo(px + 15, py - 20);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Crate
        ctx.fillStyle = `rgba(139, 90, 43, ${opacity})`;
        ctx.fillRect(px - 10, py - 5, 20, 15);
      }
    } else if (effect.type === 'punch_impact') {
      // Melee hit impact - stars and dust
      const opacity = 1 - progress;
      const size = effect.size || 1;

      // Impact flash
      if (progress < 0.2) {
        ctx.fillStyle = `rgba(255, 255, 200, ${(0.2 - progress) * 3})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 15 * size * (1 - progress * 3), 0, Math.PI * 2);
        ctx.fill();
      }

      // Impact stars
      const starCount = effect.isBoxer ? 5 : 3;
      for (let i = 0; i < starCount; i++) {
        const angle = (i / starCount) * Math.PI * 2 + progress * 3;
        const dist = 10 + progress * 25 * size;
        const px = effect.x + Math.cos(angle) * dist;
        const py = effect.y + Math.sin(angle) * dist - progress * 15;

        ctx.fillStyle = `rgba(255, 255, 100, ${opacity})`;
        ctx.font = `${12 * size}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('★', px, py);
      }

      // Dust puff
      ctx.fillStyle = `rgba(200, 180, 150, ${opacity * 0.4})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 8 + progress * 20, 0, Math.PI * 2);
      ctx.fill();

      // Impact lines
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
      ctx.lineWidth = 2 * size;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + 0.4;
        const innerDist = 5 + progress * 10;
        const outerDist = 15 + progress * 20;
        ctx.beginPath();
        ctx.moveTo(effect.x + Math.cos(angle) * innerDist, effect.y + Math.sin(angle) * innerDist);
        ctx.lineTo(effect.x + Math.cos(angle) * outerDist, effect.y + Math.sin(angle) * outerDist);
        ctx.stroke();
      }
    } else if (effect.type === 'kick_impact') {
      // Kick impact - bigger swoosh
      const opacity = 1 - progress;

      // Swoosh arc
      ctx.strokeStyle = `rgba(255, 200, 100, ${opacity})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 25 + progress * 15, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();

      // Dust cloud
      ctx.fillStyle = `rgba(180, 160, 140, ${opacity * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(effect.x + 15, effect.y + 5, 20 + progress * 30, 10 + progress * 15, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Impact text
      if (progress < 0.5) {
        ctx.fillStyle = `rgba(255, 100, 50, ${(0.5 - progress) * 2})`;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('WHAM!', effect.x, effect.y - 20 - progress * 20);
      }
    } else if (effect.type === 'uppercut_impact') {
      // Uppercut - upward trajectory
      const opacity = 1 - progress;

      // Upward swoosh
      ctx.strokeStyle = `rgba(255, 220, 100, ${opacity})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(effect.x - 10, effect.y + 10);
      ctx.quadraticCurveTo(effect.x, effect.y - 20 - progress * 30, effect.x + 10, effect.y - 40 - progress * 20);
      ctx.stroke();

      // Rising stars
      for (let i = 0; i < 4; i++) {
        const py = effect.y - progress * 50 - i * 12;
        const px = effect.x + Math.sin(progress * 10 + i) * 8;

        ctx.fillStyle = `rgba(255, 255, 100, ${opacity * (1 - i * 0.2)})`;
        ctx.font = '10px Arial';
        ctx.fillText('★', px, py);
      }
    }
  }

  drawAirstrikeTarget() {
    const ctx = this.ctx;
    const mouse = this.game.input.mouse;

    // Draw target circle at mouse position
    const radius = CONSTANTS.AIRSTRIKE.radius;

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.arc(mouse.worldX, mouse.worldY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshair
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mouse.worldX - 20, mouse.worldY);
    ctx.lineTo(mouse.worldX + 20, mouse.worldY);
    ctx.moveTo(mouse.worldX, mouse.worldY - 20);
    ctx.lineTo(mouse.worldX, mouse.worldY + 20);
    ctx.stroke();

    // Animated pulse
    const pulse = Math.sin(this.animTime * 5) * 10 + 10;
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouse.worldX, mouse.worldY, radius + pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawMinimap() {
    const ctx = this.minimapCtx;
    const scale = this.minimapCanvas.width / this.game.mapWidth;

    // Clear minimap
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

    // Draw schools
    for (const school of this.game.schools) {
      ctx.fillStyle = CONSTANTS.PLAYER_COLORS[school.playerId];
      ctx.fillRect(
        school.x * scale - 4,
        school.y * scale - 4,
        8, 8
      );
    }

    // Draw flags
    for (const flag of this.game.flags) {
      ctx.fillStyle = flag.ownerId !== null ?
        CONSTANTS.PLAYER_COLORS[flag.ownerId] : '#fff';
      ctx.beginPath();
      ctx.arc(flag.x * scale, flag.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw units (only friendly or visible)
    for (const unit of this.game.units) {
      if (unit.playerId === this.game.localPlayerId ||
          this.game.fogOfWar.isVisible(unit.x, unit.y, this.game.localPlayerId)) {
        ctx.fillStyle = CONSTANTS.PLAYER_COLORS[unit.playerId];
        ctx.beginPath();
        ctx.arc(unit.x * scale, unit.y * scale, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw airstrikes
    for (const strike of this.game.airstrikes) {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.7)';
      ctx.beginPath();
      ctx.arc(strike.targetX * scale, strike.targetY * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw camera viewport
    const camera = this.game.camera;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      camera.x * scale,
      camera.y * scale,
      (this.game.canvas.width / camera.zoom) * scale,
      (this.game.canvas.height / camera.zoom) * scale
    );
  }

  drawGrenade(grenade) {
    const ctx = this.ctx;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(grenade.x, grenade.targetY, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Grenade body (offset by height for arc)
    const drawY = grenade.y - grenade.height;

    ctx.save();
    ctx.translate(grenade.x, drawY);
    ctx.rotate(grenade.rotation);

    // Grenade body
    ctx.fillStyle = '#2F4F2F';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Handle/spoon
    ctx.fillStyle = '#666';
    ctx.fillRect(-2, -14, 4, 6);

    // Pin ring
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -16, 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Trail
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(grenade.x - 20, drawY + 10);
    ctx.lineTo(grenade.x, drawY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawMilitary(military) {
    const ctx = this.ctx;
    const x = military.x;
    const y = military.y;
    const isMoving = military.state === 'moving';
    const isAttacking = military.state === 'attacking';
    const animTime = military.animTime || 0;

    // Walking animation offsets
    const walkCycle = isMoving ? Math.sin(animTime * 10) : 0;
    const bobOffset = isMoving ? Math.abs(Math.sin(animTime * 20)) * 2 : 0;

    ctx.save();
    ctx.translate(x, y - bobOffset);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    const shadowStretch = isMoving ? 1 + Math.abs(walkCycle) * 0.2 : 1;
    ctx.ellipse(0, 12 + bobOffset, 12 * shadowStretch, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (camo pants) - animated when walking
    ctx.fillStyle = '#4A5D23';
    const leftLegSwing = walkCycle * 4;
    const rightLegSwing = -walkCycle * 4;

    // Left leg
    ctx.beginPath();
    ctx.moveTo(-5, 2);
    ctx.lineTo(-6 + leftLegSwing, 14);
    ctx.lineTo(-2 + leftLegSwing, 14);
    ctx.lineTo(-1, 2);
    ctx.closePath();
    ctx.fill();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.lineTo(2 + rightLegSwing, 14);
    ctx.lineTo(6 + rightLegSwing, 14);
    ctx.lineTo(5, 2);
    ctx.closePath();
    ctx.fill();

    // Body (camo shirt)
    ctx.fillStyle = '#556B2F';
    ctx.fillRect(-8, -8, 16, 12);

    // Body armor/vest
    ctx.fillStyle = '#3D4F1D';
    ctx.fillRect(-6, -6, 12, 8);

    // Arms - animated
    ctx.fillStyle = '#556B2F';
    if (isMoving) {
      // Arms swing opposite to legs
      const leftArmSwing = -walkCycle * 3;
      const rightArmSwing = walkCycle * 3;
      ctx.fillRect(-12 + leftArmSwing, -6, 5, 10);
      ctx.fillRect(7 + rightArmSwing, -6, 5, 10);
    } else if (isAttacking) {
      // Arms in shooting position
      ctx.fillRect(-10, -8, 5, 8);
      ctx.fillRect(5, -8, 5, 8);
    } else {
      ctx.fillRect(-12, -6, 5, 10);
      ctx.fillRect(7, -6, 5, 10);
    }

    // Rifle
    if (military.target) {
      const angle = Math.atan2(military.target.y - y, military.target.x - x);
      ctx.save();
      ctx.translate(0, -2);
      ctx.rotate(angle);

      // Gun recoil when firing
      const recoil = military.muzzleFlash > 0 ? -3 : 0;

      ctx.fillStyle = '#2F2F2F';
      ctx.fillRect(recoil, -2, 28, 4);
      ctx.fillRect(20 + recoil, -4, 8, 8); // Stock

      // Muzzle flash
      if (military.muzzleFlash > 0) {
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.moveTo(28, 0);
        ctx.lineTo(35, -4);
        ctx.lineTo(38, 0);
        ctx.lineTo(35, 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(30, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    } else {
      ctx.fillStyle = '#2F2F2F';
      ctx.fillRect(8, -8, 4, 15);
    }

    // Head
    ctx.fillStyle = '#DEB887';
    ctx.beginPath();
    ctx.arc(0, -14, 6, 0, Math.PI * 2);
    ctx.fill();

    // Helmet
    ctx.fillStyle = '#3D4F1D';
    ctx.beginPath();
    ctx.arc(0, -15, 7, Math.PI, 0, false);
    ctx.fill();

    // Helmet strap
    ctx.strokeStyle = '#2D3D15';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -12);
    ctx.lineTo(-5, -9);
    ctx.lineTo(5, -9);
    ctx.lineTo(5, -12);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-2, -14, 1, 0, Math.PI * 2);
    ctx.arc(2, -14, 1, 0, Math.PI * 2);
    ctx.fill();

    // Angry eyebrows when attacking
    if (isAttacking) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -17);
      ctx.lineTo(-1, -16);
      ctx.moveTo(4, -17);
      ctx.lineTo(1, -16);
      ctx.stroke();
    }

    ctx.restore();

    // Health bar
    if (military.health < military.maxHealth) {
      this.drawHealthBar(x, y - 30, 20, military.health, military.maxHealth);
    }

    // Danger indicator (pulsing)
    const pulse = Math.sin(animTime * 5) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 100, 0, ${pulse})`;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y - 34);
  }

  darkenColor(hex, amount) {
    // Convert hex to RGB, darken, and convert back
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);

    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
}
