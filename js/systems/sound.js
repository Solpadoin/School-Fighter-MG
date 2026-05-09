// Sound System - Procedural audio using Web Audio API

class SoundSystem {
  constructor(game) {
    this.game = game;
    this.enabled = true;
    this.masterVolume = 0.5;
    this.sfxVolume = 0.5;
    this.musicVolume = 0.3;

    // Initialize Web Audio API
    this.audioContext = null;
    this.initialized = false;

    // Sound cooldowns to prevent spam
    this.lastPlayTime = {};
    this.minInterval = {
      footstep: 150,
      punch: 200,
      hit: 100,
      capture: 500
    };

    // Footstep tracking
    this.footstepTimers = {};
  }

  init() {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.masterVolume;
      this.initialized = true;
      console.log('Sound system initialized');
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
      this.enabled = false;
    }
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  canPlay(soundType) {
    const now = Date.now();
    const lastTime = this.lastPlayTime[soundType] || 0;
    const minInterval = this.minInterval[soundType] || 100;

    if (now - lastTime < minInterval) return false;

    this.lastPlayTime[soundType] = now;
    return true;
  }

  setVolume(type, value) {
    if (type === 'master') {
      this.masterVolume = value;
      if (this.masterGain) {
        this.masterGain.gain.value = value;
      }
    } else if (type === 'sfx') {
      this.sfxVolume = value;
    } else if (type === 'music') {
      this.musicVolume = value;
    }
  }

  // Create oscillator-based sound
  createOscillator(frequency, type = 'sine', duration = 0.1) {
    if (!this.initialized || !this.enabled) return null;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(this.masterGain);

    return { osc, gain, duration };
  }

  // Create noise-based sound
  createNoise(duration = 0.1) {
    if (!this.initialized || !this.enabled) return null;

    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const gain = this.audioContext.createGain();
    noise.connect(gain);
    gain.connect(this.masterGain);

    return { noise, gain, duration };
  }

  // Play punch/attack sound
  playPunch(isBoxer = false) {
    if (!this.canPlay('punch')) return;
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * (isBoxer ? 0.7 : 0.4);

    if (isBoxer) {
      // Heavy boxer punch - low thud with impact
      const { noise, gain } = this.createNoise(0.15);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialDecayTo = 0.01;
      gain.gain.setTargetAtTime(0.01, now, 0.05);

      // Add low frequency punch
      const osc = this.audioContext.createOscillator();
      const oscGain = this.audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      oscGain.gain.setValueAtTime(volume * 0.8, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      noise.start(now);
      noise.stop(now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      // Regular punch - quick slap sound
      const { noise, gain } = this.createNoise(0.08);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      // High frequency snap
      const osc = this.audioContext.createOscillator();
      const oscGain = this.audioContext.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      oscGain.gain.setValueAtTime(volume * 0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

      noise.start(now);
      noise.stop(now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }

  // Play hit/damage taken sound
  playHit() {
    if (!this.canPlay('hit')) return;
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.3;

    // Pain grunt - filtered noise
    const { noise, gain } = this.createNoise(0.12);

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 2;

    noise.disconnect();
    noise.connect(filter);
    filter.connect(gain);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    noise.start(now);
    noise.stop(now + 0.12);
  }

  // Play footstep sound
  playFootstep() {
    if (!this.canPlay('footstep')) return;
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.15;

    // Soft footstep - low thump
    const { noise, gain } = this.createNoise(0.06);

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    noise.disconnect();
    noise.connect(filter);
    filter.connect(gain);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    noise.start(now);
    noise.stop(now + 0.06);
  }

  // Play flag capture sound - victory fanfare for player
  playFlagCapturePlayer() {
    if (!this.canPlay('capture')) return;
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.4;

    // Triumphant ascending notes
    const notes = [523, 659, 784]; // C5, E5, G5 (major chord arpeggio)

    notes.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const oscGain = this.audioContext.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);

      const startTime = now + i * 0.1;
      oscGain.gain.setValueAtTime(0, startTime);
      oscGain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      oscGain.gain.setValueAtTime(volume, startTime + 0.15);
      oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  // Play flag capture sound - warning for enemy capture
  playFlagCaptureEnemy() {
    if (!this.canPlay('capture')) return;
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.4;

    // Warning descending notes
    const notes = [392, 330, 262]; // G4, E4, C4 (descending)

    notes.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const oscGain = this.audioContext.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);

      const startTime = now + i * 0.12;
      oscGain.gain.setValueAtTime(0, startTime);
      oscGain.gain.linearRampToValueAtTime(volume * 0.5, startTime + 0.02);
      oscGain.gain.setValueAtTime(volume * 0.5, startTime + 0.1);
      oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  // Play flag lost sound
  playFlagLost() {
    if (!this.canPlay('capture')) return;
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.35;

    // Sad descending tone
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.4);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  // Play unit death sound
  playDeath() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.3;

    // Dying groan
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Play UI click sound
  playClick() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.2;

    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.value = 800;
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Play unit spawn sound
  playSpawn() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.25;

    // Quick ascending blip
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Play airstrike incoming sound
  playAirstrikeIncoming() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.5;

    // Jet engine sound
    const { noise, gain } = this.createNoise(1.5);

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(400, now + 1.5);
    filter.Q.value = 1;

    noise.disconnect();
    noise.connect(filter);
    filter.connect(gain);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.5);
    gain.gain.setValueAtTime(volume, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

    noise.start(now);
    noise.stop(now + 1.5);
  }

  // Play explosion sound
  playExplosion() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.6;

    // Low boom
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    // Noise crackle
    const { noise, gain } = this.createNoise(0.5);
    gain.gain.setValueAtTime(volume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.4);
    noise.start(now);
    noise.stop(now + 0.5);
  }

  // Play tower shot sound
  playTowerShot() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.25;

    // Quick pew sound
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Update footsteps for moving units
  updateFootsteps(units, localPlayerId) {
    if (!this.initialized || !this.enabled) return;

    const movingSelectedUnits = units.filter(u =>
      u.playerId === localPlayerId &&
      u.selected &&
      u.state === 'moving' &&
      u.health > 0
    );

    if (movingSelectedUnits.length > 0) {
      this.playFootstep();
    }
  }

  // Glory To Victory healing sound
  playGlory() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.5;

    // Triumphant fanfare with healing shimmer
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      const oscGain = this.audioContext.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);

      const startTime = now + i * 0.15;
      oscGain.gain.setValueAtTime(0, startTime);
      oscGain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
      oscGain.gain.setValueAtTime(volume, startTime + 0.2);
      oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

      osc.start(startTime);
      osc.stop(startTime + 0.55);
    });

    // Shimmer effect
    const shimmer = this.audioContext.createOscillator();
    const shimmerGain = this.audioContext.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2000, now);
    shimmer.frequency.exponentialRampToValueAtTime(4000, now + 0.8);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.masterGain);
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.2);
    shimmerGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    shimmer.start(now);
    shimmer.stop(now + 0.85);
  }

  // Grenade explosion sound
  playGrenadeExplosion() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.4;

    // Medium explosion
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    // Noise burst
    const { noise, gain } = this.createNoise(0.3);
    gain.gain.setValueAtTime(volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.25);
    noise.start(now);
    noise.stop(now + 0.3);
  }

  // Gunshot sound (for military units)
  playGunshot() {
    if (!this.canPlay('gunshot')) return;
    if (!this.initialized || !this.enabled) return;

    this.minInterval.gunshot = 150;
    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.25;

    // Sharp crack
    const { noise, gain } = this.createNoise(0.08);

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    noise.disconnect();
    noise.connect(filter);
    filter.connect(gain);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // Low thump
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    oscGain.gain.setValueAtTime(volume * 0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    noise.start(now);
    noise.stop(now + 0.08);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Grenade throw sound
  playGrenadeThrow() {
    if (!this.initialized || !this.enabled) return;

    this.resume();
    const now = this.audioContext.currentTime;
    const volume = this.sfxVolume * 0.2;

    // Whoosh sound
    const { noise, gain } = this.createNoise(0.2);

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    filter.Q.value = 2;

    noise.disconnect();
    noise.connect(filter);
    filter.connect(gain);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    noise.start(now);
    noise.stop(now + 0.2);
  }
}
