/**
 * 咒印小英雄 - Core Game Engine
 * Roguelike Survivor H5 Canvas Game
 * Handles all gameplay logic, rendering, and entity management.
 * Depends on GameData from data.js (loaded before this script).
 */

/* global GameData */

const GameEngine = {
  // --- Canvas ---
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,

  // --- Game state ---
  state: 'menu', // 'menu','playing','paused','levelup','gameover','victory'
  gameTime: 0,
  gold: 0,
  killCount: 0,

  // --- Camera ---
  camera: { x: 0, y: 0 },
  WORLD_WIDTH: 2000,
  WORLD_HEIGHT: 2000,

  // --- Entities ---
  player: null,
  enemies: [],
  projectiles: [],
  expOrbs: [],
  damageNumbers: [],
  particles: [],
  pickups: [],
  bossWarningTimer: 0,
  bossWarningText: '',
  damageVignetteTimer: 0,

  // --- Wave / Spawn ---
  waveIndex: 0,
  spawnTimer: 0,
  bossSpawned: {},

  // --- Active map ---
  activeMap: null,
  mapDecoCache: null,
  ambientParticles: [],

  // --- Level-up callback (set by UI layer) ---
  onLevelUp: null,   // function(choices)
  onGameOver: null,   // function(stats)
  onVictory: null,    // function(stats)

  // --- Object pools ---
  pools: {
    enemies: [],
    projectiles: [],
    expOrbs: [],
    damageNumbers: [],
    particles: [],
    pickups: []
  },

  // --- Input ---
  input: {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dirX: 0,
    dirY: 0,
    tap: false,
    tapX: 0,
    tapY: 0
  },

  // --- Animation frame handle ---
  _rafId: null,
  _lastTime: 0,

  // =========================================================================
  //  SECTION: Utility helpers
  // =========================================================================

  dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  },

  randRange(min, max) {
    return Math.random() * (max - min) + min;
  },

  randInt(min, max) {
    return Math.floor(this.randRange(min, max + 1));
  },

  randSign() {
    return Math.random() < 0.5 ? -1 : 1;
  },

  circleCollide(a, ar, b, br) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const r = ar + br;
    return dx * dx + dy * dy < r * r;
  },

  normalize(dx, dy) {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  },

  // =========================================================================
  //  SECTION: Object Pool helpers
  // =========================================================================

  poolGet(poolName) {
    const pool = this.pools[poolName];
    if (pool.length > 0) return pool.pop();
    return {};
  },

  poolRelease(poolName, obj) {
    this.pools[poolName].push(obj);
  },

  // =========================================================================
  //  SECTION: Initialization
  // =========================================================================

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.state = 'menu';
  },

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.imageSmoothingEnabled = false;
  },

  startGame(roleId, mapId) {
    this.state = 'playing';
    this.gameTime = 0;
    this.gold = 0;
    this.killCount = 0;
    this.waveIndex = 0;
    this.spawnTimer = 0;
    this.bossSpawned = {};

    // Apply map
    const maps = (typeof GameData !== 'undefined' && GameData.MAPS) ? GameData.MAPS : {};
    this.activeMap = maps[mapId] || maps.dark_forest || null;
    if (this.activeMap) {
      this.WORLD_WIDTH = this.activeMap.worldWidth || 2000;
      this.WORLD_HEIGHT = this.activeMap.worldHeight || 2000;
    } else {
      this.WORLD_WIDTH = 2000;
      this.WORLD_HEIGHT = 2000;
    }
    this.mapDecoCache = null;
    this.ambientParticles = [];

    // Clear entity arrays
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.expOrbs.length = 0;
    this.damageNumbers.length = 0;
    this.particles.length = 0;
    this.pickups.length = 0;
    this.bossWarningTimer = 0;
    this.bossWarningText = '';

    // Create player
    this.createPlayer(roleId);

    // Start loop
    this._lastTime = performance.now();
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._loop();
  },

  stop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  // =========================================================================
  //  SECTION: Input binding
  // =========================================================================

  bindInput() {
    const c = this.canvas;
    const inp = this.input;
    const self = this;

    function getPos(e) {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    function onStart(e) {
      e.preventDefault();
      const p = getPos(e);
      inp.active = true;
      inp.startX = p.x;
      inp.startY = p.y;
      inp.currentX = p.x;
      inp.currentY = p.y;
      inp.tap = true;
      inp.tapX = p.x;
      inp.tapY = p.y;
    }

    function onMove(e) {
      e.preventDefault();
      if (!inp.active) return;
      const p = getPos(e);
      inp.currentX = p.x;
      inp.currentY = p.y;
      inp.tap = false;

      // Calculate direction from player screen position to touch
      if (self.player) {
        const playerScreenX = self.player.x - self.camera.x;
        const playerScreenY = self.player.y - self.camera.y;
        const dx = p.x - playerScreenX;
        const dy = p.y - playerScreenY;
        const n = self.normalize(dx, dy);
        inp.dirX = n.x;
        inp.dirY = n.y;
      }
    }

    function onEnd(e) {
      e.preventDefault();
      // Check for pause button tap before clearing state
      if (inp.tap && self.state === 'playing') {
        if (inp.tapX > self.width - 50 && inp.tapY > 40 && inp.tapY < 90) {
          if (typeof GameUI !== 'undefined' && GameUI.showPauseOverlay) {
            GameUI.showPauseOverlay();
          }
        }
      }
      inp.active = false;
      inp.dirX = 0;
      inp.dirY = 0;
    }

    c.addEventListener('touchstart', onStart, { passive: false });
    c.addEventListener('touchmove', onMove, { passive: false });
    c.addEventListener('touchend', onEnd, { passive: false });
    c.addEventListener('mousedown', onStart);
    c.addEventListener('mousemove', onMove);
    c.addEventListener('mouseup', onEnd);
  },

  // =========================================================================
  //  SECTION: Player helpers
  // =========================================================================

  createPlayer(roleId) {
    const role = (typeof GameData !== 'undefined' && GameData.ROLES)
      ? GameData.ROLES[roleId] || {}
      : {};

    const hp = role.hpGrowth ? role.hpGrowth[0] : 5;
    const atk = role.attackGrowth ? role.attackGrowth[0] : 100;

    this.player = {
      x: this.WORLD_WIDTH / 2,
      y: this.WORLD_HEIGHT / 2,
      width: 24,
      height: 24,
      hp: hp,
      maxHp: hp,
      attack: atk,
      speed: GameData.GAME_CONFIG.PLAYER_BASE_SPEED,
      level: 1,
      exp: 0,
      expToNext: 30,
      skills: [],
      passives: [],
      invincibleTimer: 0,
      knockbackTimer: 0,
      knockbackX: 0,
      knockbackY: 0,
      facing: 1,
      animFrame: 0,
      animTimer: 0,
      roleId: roleId || 'swordsman',
      // Computed stats
      damageMultiplier: 1,
      attackSpeedMultiplier: 1,
      rangeMultiplier: 1,
      moveSpeedMultiplier: 1,
      pickupRange: GameData.GAME_CONFIG.PLAYER_BASE_PICKUP_RANGE || 50,
      critRate: 0,
      critDamage: 1.5,
      // Regen & bonus fields
      regenTimer: 0,
      regenBonus: 0,
      invincibleBonus: 0,
      expMultiplier: 1
    };

    // Give the player their starting skill from role config
    const startSkill = role.skill || 'flying_sword';
    this.addSkillToPlayer(startSkill);
  },

  addSkillToPlayer(skillId) {
    const skillDef = (typeof GameData !== 'undefined' && GameData.SKILLS)
      ? GameData.SKILLS[skillId]
      : null;
    if (!skillDef) return;

    const existing = this.player.skills.find(s => s.id === skillId);
    if (existing) {
      existing.level = Math.min(existing.level + 1, skillDef.maxLevel || 5);
      // Evolution at level 5
      if (existing.level >= 5 && !existing.evolved) {
        existing.evolved = true;
      }
      return;
    }

    this.player.skills.push({
      id: skillId,
      level: 1,
      cooldownTimer: 0,
      baseCooldown: skillDef.baseCooldown || 2,
      baseDamage: skillDef.baseDamage || 10,
      range: skillDef.baseRange || 200,
      evolved: false
    });
  },

  addPassiveToPlayer(passiveId) {
    const def = (typeof GameData !== 'undefined' && GameData.PASSIVE_SKILLS)
      ? GameData.PASSIVE_SKILLS[passiveId]
      : null;
    if (!def) return;

    const existing = this.player.passives.find(p => p.id === passiveId);
    if (existing) {
      existing.level = Math.min(existing.level + 1, def.maxLevel || 5);
    } else {
      this.player.passives.push({ id: passiveId, level: 1 });
    }
    this.recalcPlayerStats();
  },

  recalcPlayerStats() {
    const p = this.player;
    // Reset to base
    p.damageMultiplier = 1;
    p.attackSpeedMultiplier = 1;
    p.rangeMultiplier = 1;
    p.moveSpeedMultiplier = 1;
    p.pickupRange = GameData.GAME_CONFIG.PLAYER_BASE_PICKUP_RANGE || 50;
    p.critChance = 0; // accumulator, applied to critRate at end
    p.lifeSteal = 0;
    p.armor = 0;
    p.expMultiplier = p.baseExpMultiplier || 1;

    for (const pas of p.passives) {
      const def = GameData.PASSIVE_SKILLS ? GameData.PASSIVE_SKILLS[pas.id] : null;
      if (!def) continue;
      const bonus = def.bonusPerLevel * pas.level;
      switch (pas.id) {
        case 'damage_boost': p.damageMultiplier += bonus; break;
        case 'attack_speed': p.attackSpeedMultiplier += bonus; break;
        case 'range_boost': p.rangeMultiplier += bonus; break;
        case 'move_speed': p.moveSpeedMultiplier += bonus; break;
        case 'pickup_range': p.pickupRange += bonus * 100; break;
        case 'max_hp':
          const hpBonus = Math.floor(p.maxHp * bonus);
          p.maxHp += hpBonus;
          p.hp = Math.min(p.hp + hpBonus, p.maxHp);
          break;
        case 'crit_chance': p.critChance += bonus; break;
        case 'life_steal': p.lifeSteal += bonus; break;
        case 'armor': p.armor += bonus; break;
        case 'exp_boost': p.expMultiplier += bonus; break;
      }
    }
    // Apply crit from passive to critRate
    p.critRate = Math.min(p.critRate + p.critChance, 0.8);
  },

  // =========================================================================
  //  SECTION: Game Loop
  // =========================================================================

  _loop() {
    const now = performance.now();
    let dt = (now - this._lastTime) / 1000;
    this._lastTime = now;
    // Cap dt to prevent physics explosions
    if (dt > 0.1) dt = 0.1;

    this.update(dt);
    this.render();

    this._rafId = requestAnimationFrame(() => this._loop());
  },

  update(dt) {
    if (this.state !== 'playing') return;

    this.gameTime += dt;

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateExpOrbs(dt);
    this.updateSkillCooldowns(dt);
    this.updateDamageNumbers(dt);
    this.updateParticles(dt);
    this.updatePickups(dt);
    if (this.bossWarningTimer > 0) this.bossWarningTimer -= dt;
    if (this.damageVignetteTimer > 0) this.damageVignetteTimer -= dt;
    this.updateCamera(dt);
    this.updateSpawner(dt);
    this.checkVictory();
  },

  // =========================================================================
  //  SECTION: Player Update
  // =========================================================================

  updatePlayer(dt) {
    const p = this.player;
    if (!p) return;

    // Invincibility timer
    if (p.invincibleTimer > 0) p.invincibleTimer -= dt;

    // Knockback
    if (p.knockbackTimer > 0) {
      p.knockbackTimer -= dt;
      p.x += p.knockbackX * dt;
      p.y += p.knockbackY * dt;
    }

    // Movement
    const inp = this.input;
    if (inp.active && (inp.dirX !== 0 || inp.dirY !== 0)) {
      const spd = p.speed * p.moveSpeedMultiplier;
      p.x += inp.dirX * spd * dt;
      p.y += inp.dirY * spd * dt;

      if (inp.dirX !== 0) p.facing = inp.dirX > 0 ? 1 : -1;

      // Walk animation
      p.animTimer += dt;
      if (p.animTimer > 0.15) {
        p.animTimer = 0;
        p.animFrame = (p.animFrame + 1) % 4;
      }
    } else {
      p.animFrame = 0;
      p.animTimer = 0;
    }

    // Clamp to world
    p.x = this.clamp(p.x, p.width / 2, this.WORLD_WIDTH - p.width / 2);
    p.y = this.clamp(p.y, p.height / 2, this.WORLD_HEIGHT - p.height / 2);

    // Regen logic
    if (p.regenBonus > 0) {
      p.regenTimer += dt;
      if (p.regenTimer >= 30) {
        p.regenTimer = 0;
        p.hp = Math.min(p.hp + p.regenBonus, p.maxHp);
      }
    }
  },

  // =========================================================================
  //  SECTION: Camera
  // =========================================================================

  updateCamera(dt) {
    if (!this.player) return;
    const target_x = this.player.x - this.width / 2;
    const target_y = this.player.y - this.height / 2;
    const lerp = 1 - Math.pow(0.001, dt); // smooth follow
    this.camera.x += (target_x - this.camera.x) * lerp;
    this.camera.y += (target_y - this.camera.y) * lerp;
    // Clamp
    this.camera.x = this.clamp(this.camera.x, 0, this.WORLD_WIDTH - this.width);
    this.camera.y = this.clamp(this.camera.y, 0, this.WORLD_HEIGHT - this.height);
  },

  // =========================================================================
  //  SECTION: Enemy System
  // =========================================================================

  spawnEnemy(type, x, y, overrides) {
    const def = (typeof GameData !== 'undefined' && GameData.ENEMIES)
      ? GameData.ENEMIES[type]
      : null;

    const e = this.poolGet('enemies');
    e.x = x;
    e.y = y;
    e.type = type;
    // Use per-wave multipliers from WAVES data for progressive scaling
    const wave = (typeof GameData !== 'undefined' && GameData.WAVES) ? GameData.WAVES[this.waveIndex] : null;
    const hpMul = wave && wave.hpMul ? wave.hpMul : (1 + this.waveIndex * 0.1);
    const dmgMul = wave && wave.dmgMul ? wave.dmgMul : (1 + this.waveIndex * 0.05);
    const spdMul = wave && wave.spdMul ? wave.spdMul : 1.0;
    // Elite waves get an extra 40% HP and 20% damage
    const eliteBonus = wave && wave.elite ? 1.4 : 1.0;
    const eliteDmg = wave && wave.elite ? 1.2 : 1.0;

    e.hp = (def ? def.hp : 20) * hpMul * eliteBonus;
    e.maxHp = e.hp;
    e.speed = (def ? def.speed : 60) * spdMul;
    e.damage = (def ? def.damage : 5) * dmgMul * eliteDmg;
    e.isElite = !!(wave && wave.elite);
    e.expValue = def ? def.expValue : 5;
    e.size = def ? (def.size || 16) : 16;
    e.color = def ? (def.color || '#e74c3c') : '#e74c3c';
    e.animFrame = 0;
    e.animTimer = 0;
    e.knockbackX = 0;
    e.knockbackY = 0;
    e.knockbackTimer = 0;
    e.isBoss = !!(overrides && overrides.isBoss);
    e.freezeTimer = 0;
    e.hitFlash = 0;
    e.alive = true;

    if (overrides) Object.assign(e, overrides);

    this.enemies.push(e);
    return e;
  },

  updateEnemies(dt) {
    const p = this.player;
    if (!p) return;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        this.enemies.splice(i, 1);
        this.poolRelease('enemies', e);
        continue;
      }

      // Animation
      e.animTimer += dt;
      if (e.animTimer > 0.2) {
        e.animTimer = 0;
        e.animFrame = (e.animFrame + 1) % 2;
      }

      // Hit flash decay
      if (e.hitFlash > 0) e.hitFlash -= dt;

      // Knockback
      if (e.knockbackTimer > 0) {
        e.knockbackTimer -= dt;
        e.x += e.knockbackX * dt;
        e.y += e.knockbackY * dt;
        continue; // skip movement while knocked back
      }

      // Freeze
      if (e.freezeTimer > 0) {
        e.freezeTimer -= dt;
        continue;
      }

      // Move toward player
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const n = this.normalize(dx, dy);
      e.x += n.x * e.speed * dt;
      e.y += n.y * e.speed * dt;

      // Collision with player
      if (p.invincibleTimer <= 0) {
        const pr = (p.width + p.height) / 4;
        const er = e.size / 2;
        if (this.circleCollide(p, pr, e, er)) {
          this.damagePlayer(e.damage, e);
        }
      }
    }
  },

  damagePlayer(amount, source) {
    const p = this.player;
    if (p.invincibleTimer > 0) return;

    // Armor reduces damage
    const reduction = p.armor || 0;
    amount = Math.max(1, amount * (1 - reduction));

    p.hp -= amount;
    p.invincibleTimer = 1.0 + (p.invincibleBonus || 0);

    // Knockback away from source
    if (source) {
      const n = this.normalize(p.x - source.x, p.y - source.y);
      p.knockbackX = n.x * 300;
      p.knockbackY = n.y * 300;
      p.knockbackTimer = 0.15;
    }

    this.spawnDamageNumber(p.x, p.y - 20, Math.round(amount), '#e74c3c', true);
    this.triggerShake(4, 0.2);
    this.damageVignetteTimer = 0.3;

    if (p.hp <= 0) {
      p.hp = 0;
      this.state = 'gameover';
      if (this.onGameOver) {
        this.onGameOver({
          time: this.gameTime,
          kills: this.killCount,
          gold: this.gold,
          level: p.level,
          waveIndex: this.waveIndex + 1,
          totalWaves: GameData.WAVES ? GameData.WAVES.length : 17
        });
      }
    }
  },

  killEnemy(enemy) {
    enemy.alive = false;
    this.killCount++;

    // Spawn exp orb
    this.spawnExpOrb(enemy.x, enemy.y, enemy.expValue);

    // Chance to drop gold pickup (15%)
    if (Math.random() < 0.15) {
      const goldVal = enemy.isBoss ? 20 : (3 + this.randInt(0, 2));
      this.spawnPickup(enemy.x, enemy.y, 'gold', goldVal);
    }

    // Boss drops treasure + health potion
    if (enemy.isBoss) {
      this.spawnPickup(enemy.x + 15, enemy.y, 'gold', 50);
      this.spawnPickup(enemy.x - 15, enemy.y, 'health', 0);
      // Trigger a bonus level-up choice
      this.triggerLevelUp();
    }

    // Death particles
    this.spawnBurstParticles(enemy.x, enemy.y, enemy.color, 8);
  },

  spawnPickup(x, y, type, value) {
    let pickup = this.pools.pickups.pop();
    if (!pickup) pickup = {};
    pickup.x = x + (Math.random() - 0.5) * 10;
    pickup.y = y + (Math.random() - 0.5) * 10;
    pickup.type = type;               // 'gold' or 'health'
    pickup.value = value;
    pickup.alive = true;
    pickup.life = 10;                  // seconds before despawn
    pickup.size = type === 'health' ? 10 : 7;
    pickup.bobPhase = Math.random() * Math.PI * 2;
    this.pickups.push(pickup);
  },

  updatePickups(dt) {
    const p = this.player;
    if (!p) return;
    const magnetRange = 80;
    const collectRange = 18;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (!pk.alive) {
        this.pools.pickups.push(pk);
        this.pickups.splice(i, 1);
        continue;
      }

      pk.life -= dt;
      pk.bobPhase += dt * 3;
      if (pk.life <= 0) {
        pk.alive = false;
        this.pools.pickups.push(pk);
        this.pickups.splice(i, 1);
        continue;
      }

      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Magnetize when close
      if (dist < magnetRange && dist > 0) {
        const speed = 200 * dt;
        pk.x += (dx / dist) * speed;
        pk.y += (dy / dist) * speed;
      }

      // Collect
      if (dist < collectRange) {
        pk.alive = false;
        if (pk.type === 'gold') {
          this.gold += pk.value;
          this.spawnDamageNumber(pk.x, pk.y, `+${pk.value}g`, '#f1c40f', false);
        } else if (pk.type === 'health') {
          const heal = Math.floor(p.maxHp * 0.1);
          p.hp = Math.min(p.hp + heal, p.maxHp);
          this.spawnDamageNumber(pk.x, pk.y, `+${heal}HP`, '#2ecc71', false);
        }
        this.pools.pickups.push(pk);
        this.pickups.splice(i, 1);
      }
    }
  },

  // =========================================================================
  //  SECTION: Wave & Spawn System
  // =========================================================================

  updateSpawner(dt) {
    const waves = (typeof GameData !== 'undefined' && GameData.WAVES)
      ? GameData.WAVES : null;
    if (!waves) return;

    // Determine current wave
    for (let i = waves.length - 1; i >= 0; i--) {
      if (this.gameTime >= waves[i].time) {
        this.waveIndex = i;
        break;
      }
    }

    const wave = waves[this.waveIndex];
    if (!wave) return;

    // Check for mini-boss in wave data
    if (wave.miniBoss && !this.bossSpawned[wave.time]) {
      this.bossSpawned[wave.time] = true;
      const bossType = wave.miniBoss.type;
      const bossDef = GameData.ENEMIES[bossType];
      const bossStats = bossDef ? bossDef.boss : {};
      const bossCount = wave.miniBoss.count || 1;
      const bHpMul = wave.hpMul || 1;
      const bDmgMul = wave.dmgMul || 1;
      const bSpdMul = wave.spdMul || 1;
      for (let bi = 0; bi < bossCount; bi++) {
        const pos = this.getSpawnPositionOutsideScreen();
        this.spawnEnemy(bossType, pos.x, pos.y, {
          isBoss: true,
          hp: (bossStats.hp || 200) * bHpMul,
          maxHp: (bossStats.hp || 200) * bHpMul,
          size: bossStats.size || 30,
          damage: (bossStats.damage || 4) * bDmgMul,
          speed: (bossStats.speed || bossDef.speed || 40) * bSpdMul,
          expValue: (bossStats.expValue || 50) * Math.max(1, bHpMul * 0.5)
        });
      }
      this.triggerShake(6, 0.4);
      this.bossWarningTimer = 2.0;
      this.bossWarningText = bossCount > 1 ? `${bossCount}x BOSS INCOMING!` : 'BOSS INCOMING!';
    }

    // Check for final boss in wave data
    if (wave.finalBoss && !this.bossSpawned['final_' + wave.time]) {
      this.bossSpawned['final_' + wave.time] = true;
      const bossType = wave.finalBoss.type;
      const bossDef = GameData.ENEMIES[bossType];
      const bossStats = bossDef ? bossDef.boss : {};
      const bHpMul = wave.hpMul || 1;
      const bDmgMul = wave.dmgMul || 1;
      // Final boss gets extra 2x multiplier on top of wave scaling
      const pos = this.getSpawnPositionOutsideScreen();
      this.spawnEnemy(bossType, pos.x, pos.y, {
        isBoss: true,
        hp: (bossStats.hp || 200) * bHpMul * 2,
        maxHp: (bossStats.hp || 200) * bHpMul * 2,
        size: (bossStats.size || 30) * 1.3,
        damage: (bossStats.damage || 4) * bDmgMul * 1.5,
        speed: (bossStats.speed || bossDef.speed || 40) * 0.9,
        expValue: (bossStats.expValue || 50) * bHpMul
      });
      this.triggerShake(10, 0.6);
      this.bossWarningTimer = 2.5;
      this.bossWarningText = '\u7EC8\u6781BOSS!';
    }

    // Regular spawn - convert spawnRate (per second) to interval
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const interval = 1.0 / (wave.spawnRate || 1);
      this.spawnTimer = interval;

      const types = wave.enemyTypes || ['skeleton'];
      if (this.enemies.length < (wave.maxEnemies || 35)) {
        const type = types[this.randInt(0, types.length - 1)];
        const pos = this.getSpawnPositionOutsideScreen();
        this.spawnEnemy(type, pos.x, pos.y);
      }
    }
  },

  getSpawnPositionOutsideScreen() {
    const margin = 80;
    const cx = this.camera.x;
    const cy = this.camera.y;
    const side = this.randInt(0, 3);
    let x, y;

    switch (side) {
      case 0: // top
        x = this.randRange(cx - margin, cx + this.width + margin);
        y = cy - margin;
        break;
      case 1: // right
        x = cx + this.width + margin;
        y = this.randRange(cy - margin, cy + this.height + margin);
        break;
      case 2: // bottom
        x = this.randRange(cx - margin, cx + this.width + margin);
        y = cy + this.height + margin;
        break;
      default: // left
        x = cx - margin;
        y = this.randRange(cy - margin, cy + this.height + margin);
    }

    x = this.clamp(x, 10, this.WORLD_WIDTH - 10);
    y = this.clamp(y, 10, this.WORLD_HEIGHT - 10);
    return { x, y };
  },

  checkVictory() {
    const victoryTime = GameData.GAME_CONFIG ? GameData.GAME_CONFIG.GAME_DURATION : 480;
    if (this.gameTime >= victoryTime) {
      this.state = 'victory';
      if (this.onVictory) {
        this.onVictory({
          time: this.gameTime,
          kills: this.killCount,
          gold: this.gold,
          level: this.player.level,
          waveIndex: this.waveIndex + 1,
          totalWaves: GameData.WAVES ? GameData.WAVES.length : 17,
          victory: true
        });
      }
    }
  },

  // =========================================================================
  //  SECTION: Skill / Projectile System
  // =========================================================================

  updateSkillCooldowns(dt) {
    const p = this.player;
    if (!p) return;

    for (const skill of p.skills) {
      skill.cooldownTimer -= dt;
      if (skill.cooldownTimer <= 0) {
        const cd = skill.baseCooldown / p.attackSpeedMultiplier;
        skill.cooldownTimer = cd;
        this.fireSkill(skill);
      }
    }
  },

  fireSkill(skill) {
    switch (skill.id) {
      case 'flying_sword': this.fireFlyingSword(skill); break;
      case 'fireball': this.fireFireball(skill); break;
      case 'ice_ring': this.fireIceRing(skill); break;
      case 'lightning': this.fireLightning(skill); break;
      case 'whirlwind': this.fireWhirlwind(skill); break;
      case 'summon': this.fireSummon(skill); break;
      case 'poison_cloud': this.firePoisonCloud(skill); break;
      case 'shield_orb': this.fireShieldOrb(skill); break;
    }
  },

  calcSkillDamage(skill) {
    const p = this.player;
    let dmg = (skill.baseDamage + p.attack) * (1 + (skill.level - 1) * 0.3) * p.damageMultiplier;
    let crit = false;
    if (Math.random() < p.critRate) {
      dmg *= p.critDamage;
      crit = true;
    }
    return { dmg: Math.round(dmg), crit };
  },

  getNearestEnemy(x, y, maxRange) {
    let best = null;
    let bestDist = maxRange || Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = this.dist({ x, y }, e);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  },

  spawnProjectile(opts) {
    const proj = this.poolGet('projectiles');
    proj.x = opts.x;
    proj.y = opts.y;
    proj.vx = opts.vx || 0;
    proj.vy = opts.vy || 0;
    proj.speed = opts.speed || 300;
    proj.damage = opts.damage || 10;
    proj.crit = opts.crit || false;
    proj.type = opts.type || 'linear';
    proj.pierce = opts.pierce || 0;
    proj.hitCount = 0;
    proj.radius = opts.radius || 6;
    proj.color = opts.color || '#f1c40f';
    proj.life = opts.life || 3;
    proj.maxLife = proj.life;
    proj.alive = true;
    proj.target = opts.target || null;
    proj.owner = opts.owner || null;
    proj.aoeRadius = opts.aoeRadius || 0;
    proj.angle = opts.angle || 0;
    proj.orbitDist = opts.orbitDist || 0;
    proj.orbitSpeed = opts.orbitSpeed || 0;
    proj.hitEnemies = new Set();
    proj.onHit = opts.onHit || null;
    this.projectiles.push(proj);
    return proj;
  },

  // --- Individual skill implementations ---

  fireFlyingSword(skill) {
    const p = this.player;
    const range = skill.range * p.rangeMultiplier;
    const { dmg, crit } = this.calcSkillDamage(skill);

    const nearest = this.getNearestEnemy(p.x, p.y, range);
    let dirX = p.facing;
    let dirY = 0;
    if (nearest) {
      const n = this.normalize(nearest.x - p.x, nearest.y - p.y);
      dirX = n.x;
      dirY = n.y;
    }

    const count = skill.evolved ? 3 : 1;
    const spreadAngle = 0.3; // radians

    for (let i = 0; i < count; i++) {
      let angle = Math.atan2(dirY, dirX);
      if (count > 1) {
        angle += (i - (count - 1) / 2) * spreadAngle;
      }
      this.spawnProjectile({
        x: p.x,
        y: p.y,
        vx: Math.cos(angle),
        vy: Math.sin(angle),
        speed: 350,
        damage: dmg,
        crit: crit,
        type: 'linear',
        pierce: skill.level + (skill.evolved ? 3 : 0),
        color: '#3498db',
        life: 1.5,
        radius: 8
      });
    }
  },

  fireFireball(skill) {
    const p = this.player;
    const range = skill.range * p.rangeMultiplier;
    const { dmg, crit } = this.calcSkillDamage(skill);
    const target = this.getNearestEnemy(p.x, p.y, range);
    if (!target) return;

    this.spawnProjectile({
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      speed: 250,
      damage: dmg,
      crit: crit,
      type: 'homing',
      target: target,
      color: '#e67e22',
      life: 3,
      radius: 10,
      aoeRadius: skill.evolved ? 80 : 50,
      onHit: skill.evolved ? 'burn' : null
    });
  },

  fireIceRing(skill) {
    const p = this.player;
    const { dmg, crit } = this.calcSkillDamage(skill);
    const range = (100 + skill.level * 20) * p.rangeMultiplier;

    this.spawnProjectile({
      x: p.x,
      y: p.y,
      type: 'aoe_ring',
      damage: dmg,
      crit: crit,
      radius: 0,
      aoeRadius: range,
      color: '#1abc9c',
      life: 0.6,
      speed: range / 0.6,
      onHit: skill.evolved ? 'shatter' : 'freeze'
    });
  },

  fireLightning(skill) {
    const p = this.player;
    const range = skill.range * p.rangeMultiplier;
    const { dmg, crit } = this.calcSkillDamage(skill);
    const target = this.getNearestEnemy(p.x, p.y, range);
    if (!target) return;

    // Initialize bolt storage
    if (!this._lightningBolts) this._lightningBolts = [];

    // Direct strike with visual bolt
    this.applyDamageToEnemy(target, dmg, crit);
    this.spawnBurstParticles(target.x, target.y, '#f1c40f', 8);
    this._lightningBolts.push({
      points: this.generateBoltPoints(p.x, p.y - 10, target.x, target.y),
      life: 0.25
    });

    // Chain if evolved
    if (skill.evolved) {
      const chains = 2;
      let lastTarget = target;
      for (let c = 0; c < chains; c++) {
        let best = null;
        let bestD = 150;
        for (const e of this.enemies) {
          if (!e.alive || e === target || e === lastTarget) continue;
          const d = this.dist(lastTarget, e);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          this.applyDamageToEnemy(best, Math.round(dmg * 0.7), crit);
          this.spawnBurstParticles(best.x, best.y, '#f1c40f', 5);
          this._lightningBolts.push({
            points: this.generateBoltPoints(lastTarget.x, lastTarget.y, best.x, best.y),
            life: 0.2
          });
          lastTarget = best;
        }
      }
    }
  },

  fireWhirlwind(skill) {
    const p = this.player;
    const { dmg, crit } = this.calcSkillDamage(skill);
    const count = skill.evolved ? 2 : 1;
    const dist = 60 + skill.level * 10;

    for (let i = 0; i < count; i++) {
      const startAngle = (Math.PI * 2 / count) * i;
      this.spawnProjectile({
        x: p.x + Math.cos(startAngle) * dist,
        y: p.y + Math.sin(startAngle) * dist,
        type: 'orbital',
        damage: dmg,
        crit: crit,
        radius: 14,
        color: '#9b59b6',
        life: 3,
        angle: startAngle,
        orbitDist: dist,
        orbitSpeed: 3 + skill.level * 0.5,
        owner: p
      });
    }
  },

  fireSummon(skill) {
    const p = this.player;
    const { dmg } = this.calcSkillDamage(skill);
    const count = skill.evolved ? 2 : 1;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.spawnProjectile({
        x: p.x + Math.cos(angle) * 40,
        y: p.y + Math.sin(angle) * 40,
        type: 'pet',
        damage: dmg,
        radius: 10,
        color: '#bdc3c7',
        life: 5 + skill.level,
        speed: 120
      });
    }
  },

  firePoisonCloud(skill) {
    const p = this.player;
    const { dmg } = this.calcSkillDamage(skill);
    const range = (skill.range || 100) * p.rangeMultiplier * (skill.evolved ? 1.6 : 1);
    // Place cloud at nearest enemy or random offset
    const target = this.getNearestEnemy(p.x, p.y, 300);
    const tx = target ? target.x : p.x + (Math.random() - 0.5) * 200;
    const ty = target ? target.y : p.y + (Math.random() - 0.5) * 200;

    this.spawnProjectile({
      x: tx,
      y: ty,
      type: 'poison_cloud',
      damage: dmg,
      radius: range,
      color: '#66CC44',
      life: 3 + skill.level * 0.5,
      speed: 0,
      tickTimer: 0,
      tickInterval: 0.5,
      slowAmount: skill.evolved ? 0.5 : 0
    });
  },

  fireShieldOrb(skill) {
    const p = this.player;
    const { dmg } = this.calcSkillDamage(skill);
    const orbCount = 2 + Math.floor(skill.level / 2) + (skill.evolved ? 2 : 0);

    // Only spawn if fewer shield orbs exist than allowed
    const existing = this.projectiles.filter(pr => pr.type === 'shield_orb' && pr.alive).length;
    const toSpawn = Math.max(0, orbCount - existing);

    for (let i = 0; i < toSpawn; i++) {
      const angle = (existing + i) * (Math.PI * 2 / orbCount);
      this.spawnProjectile({
        x: p.x,
        y: p.y,
        type: 'shield_orb',
        damage: dmg,
        radius: 8,
        color: '#FFD700',
        life: 6 + skill.level,
        speed: 0,
        orbAngle: angle,
        orbDist: 50 + skill.level * 5,
        orbSpeed: 2 + skill.level * 0.3,
        evolved: skill.evolved,
        hitCooldown: {}
      });
    }
  },

  // =========================================================================
  //  SECTION: Projectile Update
  // =========================================================================

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life -= dt;
      if (proj.life <= 0 || !proj.alive) {
        this.projectiles.splice(i, 1);
        this.poolRelease('projectiles', proj);
        continue;
      }

      switch (proj.type) {
        case 'linear':
          this.updateLinearProjectile(proj, dt);
          break;
        case 'homing':
          this.updateHomingProjectile(proj, dt);
          break;
        case 'aoe_ring':
          this.updateAoeRingProjectile(proj, dt);
          break;
        case 'orbital':
          this.updateOrbitalProjectile(proj, dt);
          break;
        case 'pet':
          this.updatePetProjectile(proj, dt);
          break;
        case 'poison_cloud':
          this.updatePoisonCloud(proj, dt);
          break;
        case 'shield_orb':
          this.updateShieldOrb(proj, dt);
          break;
      }
    }
  },

  updateLinearProjectile(proj, dt) {
    proj.x += proj.vx * proj.speed * dt;
    proj.y += proj.vy * proj.speed * dt;
    this.checkProjectileEnemyCollision(proj);
  },

  updateHomingProjectile(proj, dt) {
    const t = proj.target;
    if (t && t.alive) {
      const n = this.normalize(t.x - proj.x, t.y - proj.y);
      proj.vx += (n.x - proj.vx) * 5 * dt;
      proj.vy += (n.y - proj.vy) * 5 * dt;
      const nv = this.normalize(proj.vx, proj.vy);
      proj.vx = nv.x;
      proj.vy = nv.y;
    }
    proj.x += proj.vx * proj.speed * dt;
    proj.y += proj.vy * proj.speed * dt;

    // Check collision
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (this.circleCollide(proj, proj.radius, e, e.size / 2)) {
        this.applyDamageToEnemy(e, proj.damage, proj.crit);
        // AOE explosion
        if (proj.aoeRadius > 0) {
          this.doAoeExplosion(proj.x, proj.y, proj.aoeRadius, proj.damage * 0.6, proj.color);
          if (proj.onHit === 'burn') {
            this.spawnBurstParticles(proj.x, proj.y, '#e67e22', 12);
          }
        }
        proj.alive = false;
        break;
      }
    }
  },

  updateAoeRingProjectile(proj, dt) {
    proj.radius += proj.speed * dt;
    // Check enemies within the ring
    for (const e of this.enemies) {
      if (!e.alive || proj.hitEnemies.has(e)) continue;
      const d = this.dist(proj, e);
      if (d <= proj.radius + e.size / 2 && d >= proj.radius - 20) {
        proj.hitEnemies.add(e);
        this.applyDamageToEnemy(e, proj.damage, proj.crit);
        if (proj.onHit === 'freeze') {
          e.freezeTimer = 1.5;
        } else if (proj.onHit === 'shatter') {
          e.freezeTimer = 1.5;
          this.applyDamageToEnemy(e, Math.round(proj.damage * 0.5), false);
        }
      }
    }
  },

  updateOrbitalProjectile(proj, dt) {
    const owner = proj.owner || this.player;
    proj.angle += proj.orbitSpeed * dt;
    proj.x = owner.x + Math.cos(proj.angle) * proj.orbitDist;
    proj.y = owner.y + Math.sin(proj.angle) * proj.orbitDist;
    this.checkProjectileEnemyCollision(proj);
  },

  updatePetProjectile(proj, dt) {
    // Move toward nearest enemy
    const target = this.getNearestEnemy(proj.x, proj.y, 300);
    if (target) {
      const n = this.normalize(target.x - proj.x, target.y - proj.y);
      proj.x += n.x * proj.speed * dt;
      proj.y += n.y * proj.speed * dt;
      // Melee hit
      if (this.circleCollide(proj, proj.radius, target, target.size / 2)) {
        this.applyDamageToEnemy(target, proj.damage, false);
        proj.hitEnemies.clear(); // Reset so it can hit again
      }
    } else {
      // Wander near player
      const n = this.normalize(this.player.x - proj.x, this.player.y - proj.y);
      proj.x += n.x * proj.speed * 0.5 * dt;
      proj.y += n.y * proj.speed * 0.5 * dt;
    }
  },

  updatePoisonCloud(proj, dt) {
    // Periodic tick damage to enemies inside cloud
    proj.tickTimer = (proj.tickTimer || 0) + dt;
    if (proj.tickTimer >= (proj.tickInterval || 0.5)) {
      proj.tickTimer = 0;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = this.dist(proj, e);
        if (d < proj.radius + e.size / 2) {
          this.applyDamageToEnemy(e, proj.damage, false);
          // Slow from evolved poison
          if (proj.slowAmount > 0) {
            e.freezeTimer = Math.max(e.freezeTimer, 0.3);
          }
        }
      }
    }
    // Slight grow/shrink animation
    proj._pulse = (proj._pulse || 0) + dt;
  },

  updateShieldOrb(proj, dt) {
    const p = this.player;
    // Orbit around player
    proj.orbAngle += (proj.orbSpeed || 2) * dt;
    proj.x = p.x + Math.cos(proj.orbAngle) * (proj.orbDist || 55);
    proj.y = p.y + Math.sin(proj.orbAngle) * (proj.orbDist || 55);

    // Hit enemies with cooldown per-enemy
    if (!proj.hitCooldown) proj.hitCooldown = {};
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = this.dist(proj, e);
      if (d < proj.radius + e.size / 2) {
        const eKey = e.x + '_' + e.y; // rough key
        const lastHit = proj.hitCooldown[eKey] || 0;
        if (this.gameTime - lastHit > 0.5) {
          proj.hitCooldown[eKey] = this.gameTime;
          this.applyDamageToEnemy(e, proj.damage, false);
          // Knockback from orb
          const n = this.normalize(e.x - proj.x, e.y - proj.y);
          e.knockbackX = n.x * 250;
          e.knockbackY = n.y * 250;
          e.knockbackTimer = 0.12;
          // Evolved: reflect damage
          if (proj.evolved) {
            this.spawnBurstParticles(e.x, e.y, '#FFD700', 5);
          }
        }
      }
    }
  },

  checkProjectileEnemyCollision(proj) {
    for (const e of this.enemies) {
      if (!e.alive || proj.hitEnemies.has(e)) continue;
      if (this.circleCollide(proj, proj.radius, e, e.size / 2)) {
        proj.hitEnemies.add(e);
        this.applyDamageToEnemy(e, proj.damage, proj.crit);
        proj.hitCount++;
        if (proj.pierce <= 0 || proj.hitCount > proj.pierce) {
          proj.alive = false;
        }
        break;
      }
    }
  },

  doAoeExplosion(x, y, radius, damage, color) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (this.dist({ x, y }, e) <= radius) {
        this.applyDamageToEnemy(e, Math.round(damage), false);
      }
    }
    // Ring of particles outward
    this.spawnBurstParticles(x, y, color, 12);
    this.spawnBurstParticles(x, y, '#f39c12', 6);
    // Create expanding explosion ring
    this.spawnProjectile({
      x: x,
      y: y,
      type: 'aoe_ring',
      damage: 0,
      radius: 0,
      aoeRadius: radius,
      color: color,
      life: 0.3,
      speed: radius / 0.3,
    });
  },

  applyDamageToEnemy(enemy, damage, crit) {
    if (!enemy.alive) return;
    enemy.hp -= damage;
    enemy.hitFlash = 0.12; // white flash timer

    // Knockback
    const n = this.normalize(enemy.x - this.player.x, enemy.y - this.player.y);
    enemy.knockbackX = n.x * 200;
    enemy.knockbackY = n.y * 200;
    enemy.knockbackTimer = 0.1;

    this.spawnDamageNumber(enemy.x, enemy.y - enemy.size / 2, damage, crit ? '#f1c40f' : '#ffffff', false, crit);

    // Life steal
    if (this.player.lifeSteal > 0 && damage > 0) {
      const heal = Math.max(1, Math.floor(damage * this.player.lifeSteal));
      this.player.hp = Math.min(this.player.hp + heal, this.player.maxHp);
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  },

  // =========================================================================
  //  SECTION: Experience & Leveling
  // =========================================================================

  spawnExpOrb(x, y, value) {
    const orb = this.poolGet('expOrbs');
    orb.x = x + this.randRange(-10, 10);
    orb.y = y + this.randRange(-10, 10);
    orb.value = value;
    orb.alive = true;
    orb.life = 30;
    orb.radius = 5;
    orb.magnet = false;
    this.expOrbs.push(orb);
  },

  updateExpOrbs(dt) {
    const p = this.player;
    if (!p) return;

    for (let i = this.expOrbs.length - 1; i >= 0; i--) {
      const orb = this.expOrbs[i];
      orb.life -= dt;
      if (orb.life <= 0 || !orb.alive) {
        this.expOrbs.splice(i, 1);
        this.poolRelease('expOrbs', orb);
        continue;
      }

      const d = this.dist(p, orb);

      // Magnet pull when within pickup range
      if (d < p.pickupRange) {
        orb.magnet = true;
      }

      if (orb.magnet) {
        const n = this.normalize(p.x - orb.x, p.y - orb.y);
        const magnetSpeed = 300;
        orb.x += n.x * magnetSpeed * dt;
        orb.y += n.y * magnetSpeed * dt;
      }

      // Collect
      if (d < 15) {
        orb.alive = false;
        this.addExp(orb.value);
      }
    }
  },

  addExp(amount) {
    const p = this.player;
    const mult = p.expMultiplier || 1;
    p.exp += Math.floor(amount * mult);
    while (p.exp >= p.expToNext) {
      p.exp -= p.expToNext;
      p.level++;
      p.expToNext = Math.floor(30 * Math.pow(1.15, p.level - 1));
      // Heal a bit on level up
      p.hp = Math.min(p.hp + p.maxHp * 0.1, p.maxHp);
      // Particles
      this.spawnBurstParticles(p.x, p.y, '#f1c40f', 20);
      // Trigger level-up choice
      this.triggerLevelUp();
    }
  },

  triggerLevelUp() {
    this.state = 'levelup';
    const choices = this.generateLevelUpChoices();
    if (this.onLevelUp) {
      this.onLevelUp(choices);
    }
  },

  generateLevelUpChoices() {
    const p = this.player;
    const allSkills = (typeof GameData !== 'undefined' && GameData.SKILLS) ? GameData.SKILLS : {};
    const allPassives = (typeof GameData !== 'undefined' && GameData.PASSIVE_SKILLS) ? GameData.PASSIVE_SKILLS : {};
    const maxActive = GameData.GAME_CONFIG ? GameData.GAME_CONFIG.MAX_ACTIVE_SKILLS : 4;
    const maxPassive = GameData.GAME_CONFIG ? GameData.GAME_CONFIG.MAX_PASSIVE_SKILLS : 3;
    const choices = [];
    const candidates = [];

    // Upgradeable existing skills
    for (const s of p.skills) {
      const def = allSkills[s.id];
      if (def && s.level < 5) {
        candidates.push({ type: 'skill_upgrade', id: s.id, level: s.level + 1, currentLevel: s.level, name: def.name, desc: def.description });
      }
    }

    // New skills
    if (p.skills.length < maxActive) {
      for (const id in allSkills) {
        if (!p.skills.find(s => s.id === id)) {
          const def = allSkills[id];
          candidates.push({ type: 'skill_new', id: id, level: 1, currentLevel: 0, name: def.name, desc: def.description });
        }
      }
    }

    // Passive upgrades (existing)
    for (const pas of p.passives) {
      const def = allPassives[pas.id];
      if (def && pas.level < def.maxLevel) {
        candidates.push({ type: 'passive', id: pas.id, level: pas.level + 1, currentLevel: pas.level, name: def.name, desc: def.description });
      }
    }

    // New passives
    if (p.passives.length < maxPassive) {
      for (const id in allPassives) {
        if (!p.passives.find(pa => pa.id === id)) {
          const def = allPassives[id];
          candidates.push({ type: 'passive', id: id, level: 1, currentLevel: 0, name: def.name, desc: def.description });
        }
      }
    }

    // Pick 3 random choices
    for (let i = 0; i < 3 && candidates.length > 0; i++) {
      const idx = this.randInt(0, candidates.length - 1);
      choices.push(candidates[idx]);
      candidates.splice(idx, 1);
    }

    return choices;
  },

  applyLevelUpChoice(choice) {
    if (choice.type === 'skill_upgrade' || choice.type === 'skill_new') {
      this.addSkillToPlayer(choice.id);
    } else if (choice.type === 'passive') {
      this.addPassiveToPlayer(choice.id);
    }
    this.state = 'playing';
  },

  // =========================================================================
  //  SECTION: Damage Numbers
  // =========================================================================

  spawnDamageNumber(x, y, amount, color, isPlayerDmg, isCrit) {
    const dn = this.poolGet('damageNumbers');
    dn.x = x + this.randRange(-10, 10);
    dn.y = y;
    dn.text = String(amount);
    dn.color = color || '#ffffff';
    dn.life = 0.8;
    dn.maxLife = 0.8;
    dn.isPlayerDmg = isPlayerDmg || false;
    dn.isCrit = isCrit || false;
    dn.vy = -80;
    this.damageNumbers.push(dn);
  },

  updateDamageNumbers(dt) {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.life -= dt;
      dn.y += dn.vy * dt;
      dn.vy *= 0.95;
      if (dn.life <= 0) {
        this.damageNumbers.splice(i, 1);
        this.poolRelease('damageNumbers', dn);
      }
    }
  },

  // =========================================================================
  //  SECTION: Particle System
  // =========================================================================

  spawnBurstParticles(x, y, color, count) {
    const shapes = ['circle', 'star', 'square'];
    for (let i = 0; i < count; i++) {
      const p = this.poolGet('particles');
      p.x = x;
      p.y = y;
      const angle = Math.random() * Math.PI * 2;
      const spd = this.randRange(60, 200);
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = this.randRange(0.3, 0.8);
      p.maxLife = p.life;
      p.color = color;
      p.size = this.randRange(2, 6);
      p.shape = shapes[Math.floor(Math.random() * shapes.length)];
      this.particles.push(p);
    }
  },

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        this.poolRelease('particles', p);
      }
    }
  },

  // =========================================================================
  //  SECTION: Collision Detection (spatial optimization)
  // =========================================================================

  isOnScreen(entity, margin) {
    margin = margin || 100;
    const sx = entity.x - this.camera.x;
    const sy = entity.y - this.camera.y;
    return sx > -margin && sx < this.width + margin &&
           sy > -margin && sy < this.height + margin;
  },

  // =========================================================================
  //  SECTION: Rendering
  // =========================================================================

  // --- Screen shake ---
  shakeTimer: 0,
  shakeIntensity: 0,

  triggerShake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  },

  render() {
    const ctx = this.ctx;
    const cam = this.camera;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.state === 'menu') return;

    // Screen shake offset
    let shakeX = 0, shakeY = 0;
    if (this.shakeTimer > 0) {
      shakeX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeTimer -= 1/60;
      this.shakeIntensity *= 0.9;
    }

    ctx.save();
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

    this.renderGround(ctx);
    this.renderExpOrbs(ctx);
    this.renderPickups(ctx);
    this.renderEnemies(ctx);
    this.renderProjectiles(ctx);
    this.renderPlayer(ctx);
    this.renderParticles(ctx);
    this.renderDamageNumbers(ctx);

    ctx.restore();

    // UI overlay (always screen-space)
    this.renderHUD(ctx);
    this.renderJoystick(ctx);
  },

  renderJoystick(ctx) {
    const inp = this.input;
    if (!inp.active || (inp.dirX === 0 && inp.dirY === 0)) return;

    const cx = inp.startX;
    const cy = inp.startY;
    const maxDist = 40;

    // Outer ring
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, maxDist, 0, Math.PI * 2);
    ctx.stroke();

    // Inner knob
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + inp.dirX * maxDist * 0.7, cy + inp.dirY * maxDist * 0.7, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  renderGround(ctx) {
    const cam = this.camera;
    const map = this.activeMap;
    const tileSize = (map && map.tileSize) || 64;
    const colA = (map && map.colors) ? map.colors.a : '#16213e';
    const colB = (map && map.colors) ? map.colors.b : '#1a1a2e';
    const borderCol = (map && map.colors) ? map.colors.border : '#e74c3c';

    const startX = Math.floor(cam.x / tileSize) * tileSize;
    const startY = Math.floor(cam.y / tileSize) * tileSize;
    const endX = startX + this.width + tileSize * 2;
    const endY = startY + this.height + tileSize * 2;

    for (let gx = startX; gx < endX; gx += tileSize) {
      for (let gy = startY; gy < endY; gy += tileSize) {
        if (gx < 0 || gy < 0 || gx >= this.WORLD_WIDTH || gy >= this.WORLD_HEIGHT) continue;
        const checker = ((gx / tileSize) + (gy / tileSize)) % 2 === 0;
        ctx.fillStyle = checker ? colA : colB;
        ctx.fillRect(gx, gy, tileSize, tileSize);
      }
    }

    // Render map decorations
    this._renderMapDecorations(ctx, startX, startY, endX, endY);

    // Edge fog gradient
    if (map && map.fogColor) {
      this._renderEdgeFog(ctx, map.fogColor);
    }

    // World border
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);

    // Render ambient particles
    this._renderAmbientParticles(ctx);
  },

  // Generate and cache decoration positions (seeded by tile coords)
  _getDecoCache() {
    if (this.mapDecoCache) return this.mapDecoCache;
    const map = this.activeMap;
    if (!map || !map.decorations) { this.mapDecoCache = []; return []; }

    const decos = [];
    const seed = (map.id || 'default').length * 137;
    // Simple seeded random
    let s = seed;
    function srand() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }

    for (const decoDef of map.decorations) {
      const count = Math.floor(decoDef.density * (this.WORLD_WIDTH / 64) * (this.WORLD_HEIGHT / 64));
      for (let i = 0; i < count; i++) {
        decos.push({
          type: decoDef.type,
          x: srand() * (this.WORLD_WIDTH - 40) + 20,
          y: srand() * (this.WORLD_HEIGHT - 40) + 20,
          scale: 0.6 + srand() * 0.8,
          color: decoDef.colors[Math.floor(srand() * decoDef.colors.length)],
          rotation: srand() * Math.PI * 2,
          variant: Math.floor(srand() * 3)
        });
      }
    }
    this.mapDecoCache = decos;
    return decos;
  },

  _renderMapDecorations(ctx, startX, startY, endX, endY) {
    const decos = this._getDecoCache();
    const pad = 40;
    for (const d of decos) {
      if (d.x < startX - pad || d.x > endX + pad || d.y < startY - pad || d.y > endY + pad) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.globalAlpha = 0.5 + d.scale * 0.2;

      switch (d.type) {
        case 'tree':
          this._drawTree(ctx, d);
          break;
        case 'mushroom':
          this._drawMushroom(ctx, d);
          break;
        case 'grass':
          this._drawGrass(ctx, d);
          break;
        case 'lava_crack':
          this._drawLavaCrack(ctx, d);
          break;
        case 'rock':
          this._drawRock(ctx, d);
          break;
        case 'ember':
          this._drawEmber(ctx, d);
          break;
        case 'ice_crystal':
          this._drawIceCrystal(ctx, d);
          break;
        case 'snow_pile':
          this._drawSnowPile(ctx, d);
          break;
        case 'frost':
          this._drawFrost(ctx, d);
          break;
        case 'void_rift':
          this._drawVoidRift(ctx, d);
          break;
        case 'rune':
          this._drawRune(ctx, d);
          break;
        case 'crystal':
          this._drawCrystal(ctx, d);
          break;
      }
      ctx.restore();
    }
  },

  // --- Decoration draw functions ---
  _drawTree(ctx, d) {
    const s = d.scale * 10;
    // Trunk
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(-2, -s * 0.3, 4, s * 0.8);
    // Canopy
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.2);
    ctx.lineTo(-s * 0.7, -s * 0.1);
    ctx.lineTo(s * 0.7, -s * 0.1);
    ctx.closePath();
    ctx.fill();
    // Second canopy layer
    ctx.globalAlpha *= 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.6);
    ctx.lineTo(-s * 0.5, -s * 0.6);
    ctx.lineTo(s * 0.5, -s * 0.6);
    ctx.closePath();
    ctx.fill();
  },

  _drawMushroom(ctx, d) {
    const s = d.scale * 6;
    // Stem
    ctx.fillStyle = '#d5c4a1';
    ctx.fillRect(-s * 0.2, -s * 0.3, s * 0.4, s * 0.6);
    // Cap
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(0, -s * 0.3, s * 0.5, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // Spots
    ctx.fillStyle = '#fff';
    ctx.globalAlpha *= 0.5;
    ctx.beginPath();
    ctx.arc(-s * 0.15, -s * 0.45, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.15, -s * 0.35, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  },

  _drawGrass(ctx, d) {
    const s = d.scale * 5;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.3, 0);
      ctx.quadraticCurveTo(i * s * 0.5, -s * 0.6, i * s * 0.2, -s);
      ctx.stroke();
    }
  },

  _drawLavaCrack(ctx, d) {
    const s = d.scale * 12;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.3);
    ctx.lineTo(-s * 0.1, s * 0.1);
    ctx.lineTo(s * 0.2, -s * 0.15);
    ctx.lineTo(s * 0.4, s * 0.3);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Glow
    ctx.globalAlpha *= 0.3;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },

  _drawRock(ctx, d) {
    const s = d.scale * 8;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, s * 0.1);
    ctx.lineTo(-s * 0.3, -s * 0.3);
    ctx.lineTo(s * 0.1, -s * 0.4);
    ctx.lineTo(s * 0.4, -s * 0.1);
    ctx.lineTo(s * 0.3, s * 0.2);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = '#fff';
    ctx.globalAlpha *= 0.15;
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.25);
    ctx.lineTo(s * 0.05, -s * 0.35);
    ctx.lineTo(s * 0.1, -s * 0.15);
    ctx.closePath();
    ctx.fill();
  },

  _drawEmber(ctx, d) {
    const s = d.scale * 4;
    const pulse = Math.sin(this.gameTime * 3 + d.rotation) * 0.3 + 0.7;
    ctx.globalAlpha *= pulse;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha *= 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
  },

  _drawIceCrystal(ctx, d) {
    const s = d.scale * 8;
    ctx.fillStyle = d.color;
    ctx.rotate(d.rotation);
    // Hexagonal crystal
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = Math.cos(a) * s * 0.4;
      const py = Math.sin(a) * s * 0.4;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Shine
    ctx.fillStyle = '#fff';
    ctx.globalAlpha *= 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.35);
    ctx.lineTo(-s * 0.1, -s * 0.1);
    ctx.lineTo(s * 0.1, -s * 0.1);
    ctx.closePath();
    ctx.fill();
  },

  _drawSnowPile(ctx, d) {
    const s = d.scale * 7;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-s * 0.3, s * 0.05, s * 0.35, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  },

  _drawFrost(ctx, d) {
    const s = d.scale * 5;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha *= 0.4;
    // Frost star pattern
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + d.rotation;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.stroke();
    }
  },

  _drawVoidRift(ctx, d) {
    const s = d.scale * 10;
    const pulse = Math.sin(this.gameTime * 2 + d.rotation) * 0.3 + 0.7;
    ctx.globalAlpha *= pulse;
    // Swirling rift
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5);
    grd.addColorStop(0, d.color);
    grd.addColorStop(1, d.color + '00');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.5, s * 0.3, d.rotation + this.gameTime * 0.5, 0, Math.PI * 2);
    ctx.fill();
  },

  _drawRune(ctx, d) {
    const s = d.scale * 6;
    const pulse = Math.sin(this.gameTime * 1.5 + d.rotation * 3) * 0.4 + 0.6;
    ctx.globalAlpha *= pulse * 0.6;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1;
    // Circle with inner lines
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI * 2 / 3) * i + d.rotation;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
    }
    ctx.stroke();
  },

  _drawCrystal(ctx, d) {
    const s = d.scale * 7;
    ctx.fillStyle = d.color;
    ctx.globalAlpha *= 0.7;
    // Tall crystal shard
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(s * 0.25, s * 0.1);
    ctx.lineTo(-s * 0.25, s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha *= 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.6);
    ctx.lineTo(s * 0.08, 0);
    ctx.lineTo(-s * 0.1, 0);
    ctx.closePath();
    ctx.fill();
  },

  // Edge fog vignette
  _renderEdgeFog(ctx, fogColor) {
    const cam = this.camera;
    const w = this.width;
    const h = this.height;
    const fogSize = 80;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen coords
    // Top
    let grd = ctx.createLinearGradient(0, 0, 0, fogSize);
    grd.addColorStop(0, fogColor);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, fogSize);
    // Bottom
    grd = ctx.createLinearGradient(0, h, 0, h - fogSize);
    grd.addColorStop(0, fogColor);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, h - fogSize, w, fogSize);
    // Left
    grd = ctx.createLinearGradient(0, 0, fogSize, 0);
    grd.addColorStop(0, fogColor);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, fogSize, h);
    // Right
    grd = ctx.createLinearGradient(w, 0, w - fogSize, 0);
    grd.addColorStop(0, fogColor);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(w - fogSize, 0, fogSize, h);
    ctx.restore();
  },

  // Ambient floating particles (fireflies, embers, snow, etc.)
  _renderAmbientParticles(ctx) {
    const map = this.activeMap;
    if (!map || !map.ambientParticles) return;

    const ap = map.ambientParticles;
    // Lazy init
    while (this.ambientParticles.length < ap.count) {
      this.ambientParticles.push({
        x: Math.random() * this.WORLD_WIDTH,
        y: Math.random() * this.WORLD_HEIGHT,
        phase: Math.random() * Math.PI * 2,
        speed: 5 + Math.random() * 15,
        size: 1 + Math.random() * 2.5
      });
    }

    const cam = this.camera;
    for (const p of this.ambientParticles) {
      // Move
      if (ap.type === 'snow') {
        p.y += p.speed * 0.016;
        p.x += Math.sin(this.gameTime + p.phase) * 0.3;
        if (p.y > this.WORLD_HEIGHT) { p.y = 0; p.x = Math.random() * this.WORLD_WIDTH; }
      } else if (ap.type === 'ember') {
        p.y -= p.speed * 0.016;
        p.x += Math.sin(this.gameTime * 2 + p.phase) * 0.5;
        if (p.y < 0) { p.y = this.WORLD_HEIGHT; p.x = Math.random() * this.WORLD_WIDTH; }
      } else {
        p.x += Math.sin(this.gameTime * 0.5 + p.phase) * p.speed * 0.016;
        p.y += Math.cos(this.gameTime * 0.3 + p.phase * 1.3) * p.speed * 0.016;
        p.x = ((p.x % this.WORLD_WIDTH) + this.WORLD_WIDTH) % this.WORLD_WIDTH;
        p.y = ((p.y % this.WORLD_HEIGHT) + this.WORLD_HEIGHT) % this.WORLD_HEIGHT;
      }

      // Screen check
      if (p.x < cam.x - 10 || p.x > cam.x + this.width + 10) continue;
      if (p.y < cam.y - 10 || p.y > cam.y + this.height + 10) continue;

      const alpha = 0.3 + Math.sin(this.gameTime * 2 + p.phase) * 0.2;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ap.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Glow for fireflies/embers/void
      if (ap.type !== 'snow') {
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  renderPlayer(ctx) {
    const p = this.player;
    if (!p) return;

    // Invincibility flash
    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 10) % 2 === 0) return;

    const x = p.x;
    const y = p.y;
    const w = p.width;
    const h = p.height;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + h / 2 + 2, w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body bounce for walk anim
    const bounce = (p.animFrame % 2 === 1) ? -2 : 0;
    const bodyColor = this.getRoleColor(p.roleId);
    const facing = p.facing || 1;

    ctx.save();

    switch (p.roleId) {
      case 'swordsman': {
        // Armored knight: body + shoulder pads + sword
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x - w / 2, y - h / 2 + bounce, w, h);
        ctx.strokeStyle = '#2255AA';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - w / 2, y - h / 2 + bounce, w, h);
        // Shoulder pads
        ctx.fillStyle = '#3366BB';
        ctx.fillRect(x - w / 2 - 3, y - h / 2 + 2 + bounce, 5, 6);
        ctx.fillRect(x + w / 2 - 2, y - h / 2 + 2 + bounce, 5, 6);
        // Sword on side
        const sx = x + facing * (w / 2 + 3);
        ctx.strokeStyle = '#AAC8FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, y - 2 + bounce);
        ctx.lineTo(sx, y - h / 2 - 8 + bounce);
        ctx.stroke();
        // Sword hilt
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 3, y - 1 + bounce);
        ctx.lineTo(sx + 3, y - 1 + bounce);
        ctx.stroke();
        // Helmet visor
        ctx.fillStyle = '#223366';
        ctx.fillRect(x - 3, y - h / 2 + bounce, 6, 3);
        break;
      }
      case 'mage': {
        // Robed mage with pointy hat
        ctx.fillStyle = bodyColor;
        // Robe body (wider at bottom)
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + 2, y - h / 2 + 4 + bounce);
        ctx.lineTo(x + w / 2 - 2, y - h / 2 + 4 + bounce);
        ctx.lineTo(x + w / 2 + 2, y + h / 2 + bounce);
        ctx.lineTo(x - w / 2 - 2, y + h / 2 + bounce);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#AA2222';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Pointed hat
        ctx.fillStyle = '#CC3333';
        ctx.beginPath();
        ctx.moveTo(x, y - h / 2 - 10 + bounce);
        ctx.lineTo(x - w / 2 + 1, y - h / 2 + 4 + bounce);
        ctx.lineTo(x + w / 2 - 1, y - h / 2 + 4 + bounce);
        ctx.closePath();
        ctx.fill();
        // Hat brim
        ctx.fillStyle = '#992222';
        ctx.fillRect(x - w / 2 - 1, y - h / 2 + 2 + bounce, w + 2, 3);
        // Staff
        const stx = x + facing * (w / 2 + 4);
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(stx, y + h / 2 + bounce);
        ctx.lineTo(stx, y - h / 2 - 4 + bounce);
        ctx.stroke();
        // Staff orb
        ctx.fillStyle = '#FF6644';
        ctx.beginPath();
        ctx.arc(stx, y - h / 2 - 6 + bounce, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,100,60,0.3)';
        ctx.beginPath();
        ctx.arc(stx, y - h / 2 - 6 + bounce, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'summoner': {
        // Hooded summoner with glowing eyes
        ctx.fillStyle = bodyColor;
        // Cloak body
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y - h / 2 + 2 + bounce);
        ctx.lineTo(x + w / 2, y - h / 2 + 2 + bounce);
        ctx.lineTo(x + w / 2 + 3, y + h / 2 + 2 + bounce);
        ctx.lineTo(x - w / 2 - 3, y + h / 2 + 2 + bounce);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#7722CC';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Hood
        ctx.fillStyle = '#7733DD';
        ctx.beginPath();
        ctx.arc(x, y - h / 2 + 2 + bounce, w / 2 + 1, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // Glowing purple eyes
        ctx.fillStyle = '#FF66FF';
        ctx.shadowColor = '#FF66FF';
        ctx.shadowBlur = 6;
        ctx.fillRect(x - 4, y - h / 2 + 4 + bounce, 3, 2);
        ctx.fillRect(x + 2, y - h / 2 + 4 + bounce, 3, 2);
        ctx.shadowBlur = 0;
        // Book
        const bx = x - facing * (w / 2 + 4);
        ctx.fillStyle = '#553399';
        ctx.fillRect(bx - 3, y - 2 + bounce, 6, 8);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(bx - 2, y + bounce, 4, 1);
        ctx.restore();
        return; // skip default eyes
      }
      case 'icemaiden': {
        // Crystal ice maiden with tiara
        ctx.fillStyle = bodyColor;
        // Body (slightly narrower, elegant)
        ctx.fillRect(x - w / 2 + 1, y - h / 2 + bounce, w - 2, h);
        // Skirt flare
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + 2 + bounce);
        ctx.lineTo(x + w / 2, y + 2 + bounce);
        ctx.lineTo(x + w / 2 + 3, y + h / 2 + 2 + bounce);
        ctx.lineTo(x - w / 2 - 3, y + h / 2 + 2 + bounce);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#22AACC';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Ice tiara
        ctx.fillStyle = '#AAF0FF';
        ctx.beginPath();
        ctx.moveTo(x - 6, y - h / 2 + 1 + bounce);
        ctx.lineTo(x - 3, y - h / 2 - 5 + bounce);
        ctx.lineTo(x, y - h / 2 + 1 + bounce);
        ctx.lineTo(x + 3, y - h / 2 - 7 + bounce);
        ctx.lineTo(x + 6, y - h / 2 + 1 + bounce);
        ctx.closePath();
        ctx.fill();
        // Ice aura particles
        const t = this.gameTime * 2;
        ctx.fillStyle = 'rgba(170,240,255,0.5)';
        for (let i = 0; i < 3; i++) {
          const ang = t + i * (Math.PI * 2 / 3);
          const r = w / 2 + 6;
          const px = x + Math.cos(ang) * r;
          const py = y + Math.sin(ang) * r * 0.6 + bounce;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x - w / 2, y - h / 2 + bounce, w, h);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - w / 2, y - h / 2 + bounce, w, h);
        break;
      }
    }

    // Eyes (shared for most roles)
    const eyeOffsetX = facing > 0 ? 3 : -3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + eyeOffsetX - 4, y - 4 + bounce, 4, 4);
    ctx.fillRect(x + eyeOffsetX + 2, y - 4 + bounce, 4, 4);
    // Pupils
    ctx.fillStyle = '#000';
    ctx.fillRect(x + eyeOffsetX - 3 + (facing > 0 ? 1 : 0), y - 3 + bounce, 2, 2);
    ctx.fillRect(x + eyeOffsetX + 3 + (facing > 0 ? 1 : 0), y - 3 + bounce, 2, 2);

    ctx.restore();
  },

  getRoleColor(roleId) {
    const role = GameData.ROLES ? GameData.ROLES[roleId] : null;
    return (role && role.color) || '#3498db';
  },

  renderEnemies(ctx) {
    for (const e of this.enemies) {
      if (!e.alive || !this.isOnScreen(e)) continue;

      const bounce = (e.animFrame % 2 === 1) ? -1 : 0;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.size / 2 + 2, e.size / 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Freeze tint / hit flash
      const col = e.hitFlash > 0 ? '#ffffff' : (e.freezeTimer > 0 ? '#88e0ef' : e.color);

      if (e.isBoss) {
        // Boss: larger, with crown
        ctx.fillStyle = col;
        ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2 + bounce, e.size, e.size);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.strokeRect(e.x - e.size / 2, e.y - e.size / 2 + bounce, e.size, e.size);
        // Crown
        ctx.fillStyle = '#f1c40f';
        const cw = e.size * 0.6;
        ctx.fillRect(e.x - cw / 2, e.y - e.size / 2 - 8 + bounce, cw, 6);
        ctx.fillRect(e.x - cw / 2, e.y - e.size / 2 - 12 + bounce, 4, 8);
        ctx.fillRect(e.x + cw / 2 - 4, e.y - e.size / 2 - 12 + bounce, 4, 8);
        ctx.fillRect(e.x - 2, e.y - e.size / 2 - 14 + bounce, 4, 10);
      } else {
        // Type-specific enemy shapes
        const s = e.size / 2;
        ctx.fillStyle = col;
        switch (e.type) {
          case 'skeleton': {
            // Skull: round head + jaw
            ctx.beginPath();
            ctx.arc(e.x, e.y - 2 + bounce, s * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(e.x - s * 0.45, e.y + s * 0.3 + bounce, s * 0.9, s * 0.4);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
          }
          case 'ghost': {
            // Semi-transparent wavy oval
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.ellipse(e.x, e.y + bounce, s * 0.9, s * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();
            // Wavy bottom edge
            ctx.beginPath();
            ctx.moveTo(e.x - s, e.y + s * 0.6 + bounce);
            for (let w = 0; w <= 4; w++) {
              const wx = e.x - s + (s * 2) * (w / 4);
              const wy = e.y + s * 0.6 + bounce + Math.sin(e.animFrame + w * 2) * 3;
              ctx.lineTo(wx, wy);
            }
            ctx.lineTo(e.x + s, e.y + bounce);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            break;
          }
          case 'gargoyle': {
            // Angular rock shape
            ctx.beginPath();
            ctx.moveTo(e.x, e.y - s + bounce);
            ctx.lineTo(e.x + s * 0.8, e.y - s * 0.3 + bounce);
            ctx.lineTo(e.x + s, e.y + s * 0.5 + bounce);
            ctx.lineTo(e.x + s * 0.4, e.y + s + bounce);
            ctx.lineTo(e.x - s * 0.4, e.y + s + bounce);
            ctx.lineTo(e.x - s, e.y + s * 0.5 + bounce);
            ctx.lineTo(e.x - s * 0.8, e.y - s * 0.3 + bounce);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
          }
          case 'slime': {
            // Wobbly squish oval
            const squish = 1 + Math.sin(e.animFrame * 2) * 0.15;
            ctx.beginPath();
            ctx.ellipse(e.x, e.y + bounce + s * (squish - 1) * 0.5, s * (2 - squish) * 0.55, s * squish * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
          }
          case 'bat': {
            // Triangle wings + small body
            ctx.beginPath();
            ctx.arc(e.x, e.y + bounce, s * 0.35, 0, Math.PI * 2);
            ctx.fill();
            // Left wing
            ctx.beginPath();
            ctx.moveTo(e.x - s * 0.3, e.y + bounce);
            ctx.lineTo(e.x - s * 1.1, e.y - s * 0.7 + bounce + Math.sin(e.animFrame * 3) * 3);
            ctx.lineTo(e.x - s * 0.5, e.y + s * 0.3 + bounce);
            ctx.closePath();
            ctx.fill();
            // Right wing
            ctx.beginPath();
            ctx.moveTo(e.x + s * 0.3, e.y + bounce);
            ctx.lineTo(e.x + s * 1.1, e.y - s * 0.7 + bounce + Math.sin(e.animFrame * 3) * 3);
            ctx.lineTo(e.x + s * 0.5, e.y + s * 0.3 + bounce);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'zombie': {
            // Square body with arms
            ctx.fillRect(e.x - s * 0.5, e.y - s * 0.6 + bounce, s, s * 1.2);
            // Left arm
            ctx.fillRect(e.x - s * 0.9, e.y - s * 0.2 + bounce, s * 0.4, s * 0.3);
            // Right arm
            ctx.fillRect(e.x + s * 0.5, e.y - s * 0.2 + bounce, s * 0.4, s * 0.3);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(e.x - s * 0.5, e.y - s * 0.6 + bounce, s, s * 1.2);
            break;
          }
          case 'demon': {
            // Horned square
            ctx.fillRect(e.x - s * 0.55, e.y - s * 0.5 + bounce, s * 1.1, s * 1.1);
            // Left horn
            ctx.beginPath();
            ctx.moveTo(e.x - s * 0.55, e.y - s * 0.5 + bounce);
            ctx.lineTo(e.x - s * 0.7, e.y - s + bounce);
            ctx.lineTo(e.x - s * 0.25, e.y - s * 0.5 + bounce);
            ctx.closePath();
            ctx.fill();
            // Right horn
            ctx.beginPath();
            ctx.moveTo(e.x + s * 0.55, e.y - s * 0.5 + bounce);
            ctx.lineTo(e.x + s * 0.7, e.y - s + bounce);
            ctx.lineTo(e.x + s * 0.25, e.y - s * 0.5 + bounce);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(e.x - s * 0.55, e.y - s * 0.5 + bounce, s * 1.1, s * 1.1);
            break;
          }
          case 'wraith': {
            // Ghostly flame shape (tapering triangle)
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y - s * 1.1 + bounce);
            ctx.quadraticCurveTo(e.x + s * 0.9, e.y - s * 0.2 + bounce, e.x + s * 0.4, e.y + s + bounce);
            ctx.lineTo(e.x, e.y + s * 0.6 + bounce);
            ctx.lineTo(e.x - s * 0.4, e.y + s + bounce);
            ctx.quadraticCurveTo(e.x - s * 0.9, e.y - s * 0.2 + bounce, e.x, e.y - s * 1.1 + bounce);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            break;
          }
          default: {
            // Fallback: colored circle
            ctx.beginPath();
            ctx.arc(e.x, e.y + bounce, s, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;
          }
        }
      }

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x - 4, e.y - 3 + bounce, 3, 3);
      ctx.fillRect(e.x + 2, e.y - 3 + bounce, 3, 3);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x - 3, e.y - 2 + bounce, 2, 2);
      ctx.fillRect(e.x + 3, e.y - 2 + bounce, 2, 2);

      // Elite aura (pulsing red glow)
      if (e.isElite && !e.isBoss) {
        const pulse = 0.4 + 0.3 * Math.sin(this.gameTime * 4 + e.x * 0.1);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(e.x, e.y + bounce, e.size / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // HP bar (if damaged)
      if (e.hp < e.maxHp) {
        const barW = e.size;
        const barH = 3;
        const barX = e.x - barW / 2;
        const barY = e.y - e.size / 2 - 8 + bounce + (e.isBoss ? -14 : 0);
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
      }
    }
  },

  renderProjectiles(ctx) {
    for (const proj of this.projectiles) {
      if (!proj.alive || !this.isOnScreen(proj, 200)) continue;

      switch (proj.type) {
        case 'aoe_ring':   this.renderAoeRing(ctx, proj); break;
        case 'linear':     this.renderLinearProj(ctx, proj); break;
        case 'homing':     this.renderHomingProj(ctx, proj); break;
        case 'orbital':    this.renderOrbitalProj(ctx, proj); break;
        case 'pet':        this.renderPetProj(ctx, proj); break;
        case 'poison_cloud': this.renderPoisonCloudProj(ctx, proj); break;
        case 'shield_orb':  this.renderShieldOrbProj(ctx, proj); break;
        default:
          ctx.fillStyle = proj.color;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
          ctx.fill();
      }
    }

    // Render lightning bolts (stored temporarily)
    if (this._lightningBolts) {
      for (let i = this._lightningBolts.length - 1; i >= 0; i--) {
        const bolt = this._lightningBolts[i];
        this.renderLightningBolt(ctx, bolt);
        bolt.life -= 0.016;
        if (bolt.life <= 0) this._lightningBolts.splice(i, 1);
      }
    }
  },

  // --- Flying Sword: blade shape with energy trail ---
  renderLinearProj(ctx, proj) {
    const angle = Math.atan2(proj.vy, proj.vx);
    const r = proj.radius;

    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(angle);

    // Trail (fading afterimages)
    const trailLen = 3;
    for (let t = 1; t <= trailLen; t++) {
      const alpha = 0.15 * (1 - t / (trailLen + 1));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.ellipse(-t * r * 0.8, 0, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Sword blade shape
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);            // Tip
    ctx.lineTo(-r * 0.5, -r * 0.55);   // Top edge
    ctx.lineTo(-r * 0.8, 0);           // Hilt notch
    ctx.lineTo(-r * 0.5, r * 0.55);    // Bottom edge
    ctx.closePath();
    ctx.fill();

    // Bright core highlight
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(r * 1.2, 0);
    ctx.lineTo(-r * 0.2, -r * 0.15);
    ctx.lineTo(-r * 0.2, r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Outer glow
    const grd = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2);
    grd.addColorStop(0, proj.color + '44');
    grd.addColorStop(1, proj.color + '00');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // --- Fireball: burning sphere with flame trail ---
  renderHomingProj(ctx, proj) {
    const r = proj.radius;
    const time = proj.maxLife - proj.life;

    // Flame trail particles
    ctx.save();
    for (let t = 0; t < 5; t++) {
      const trailAlpha = 0.4 * (1 - t / 5);
      const ox = (proj.vx || 0) * -t * 4;
      const oy = (proj.vy || 0) * -t * 4;
      const flicker = Math.sin(time * 15 + t * 2) * 2;
      ctx.globalAlpha = trailAlpha;
      ctx.fillStyle = t < 2 ? '#e67e22' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(proj.x + ox + flicker, proj.y + oy + flicker, r * (1 - t * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }

    // Core fireball
    ctx.globalAlpha = 1;
    const gradient = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, r);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.3, '#f39c12');
    gradient.addColorStop(0.7, '#e67e22');
    gradient.addColorStop(1, '#e74c3c');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Outer fire glow
    ctx.globalAlpha = 0.3 + Math.sin(time * 12) * 0.1;
    const glowGrd = ctx.createRadialGradient(proj.x, proj.y, r, proj.x, proj.y, r * 2.5);
    glowGrd.addColorStop(0, '#e67e2266');
    glowGrd.addColorStop(1, '#e74c3c00');
    ctx.fillStyle = glowGrd;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  // --- Ice Ring: crystalline expanding ring with frost particles ---
  renderAoeRing(ctx, proj) {
    const alpha = proj.life / proj.maxLife;
    const r = proj.radius;
    const time = proj.maxLife - proj.life;

    ctx.save();

    // Outer frost glow
    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = '#1abc9c';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r + 8, 0, Math.PI * 2);
    ctx.fill();

    // Main ring - double stroke with gradient
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = '#a8f0e6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#1abc9c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Ice crystal spikes along the ring
    const crystalCount = Math.min(Math.floor(r / 15), 24);
    ctx.fillStyle = '#e0ffff';
    ctx.globalAlpha = alpha * 0.7;
    for (let i = 0; i < crystalCount; i++) {
      const a = (Math.PI * 2 / crystalCount) * i + time * 2;
      const cx = proj.x + Math.cos(a) * r;
      const cy = proj.y + Math.sin(a) * r;
      const spikeLen = 6 + Math.sin(a * 3 + time * 8) * 3;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(spikeLen, 0);
      ctx.lineTo(-2, -3);
      ctx.lineTo(-2, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Inner shimmer
    ctx.globalAlpha = alpha * 0.05;
    ctx.fillStyle = '#1abc9c';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // --- Whirlwind: spinning blade with wind streaks ---
  renderOrbitalProj(ctx, proj) {
    const r = proj.radius;
    const angle = proj.angle || 0;
    const time = proj.maxLife - proj.life;

    ctx.save();
    ctx.translate(proj.x, proj.y);

    // Wind streak trail
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 3; i++) {
      const trailAngle = angle - i * 0.3;
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(trailAngle + Math.PI) * r * 0.3 * i,
        Math.sin(trailAngle + Math.PI) * r * 0.3 * i,
        r * (1 - i * 0.2), r * 0.3 * (1 - i * 0.2),
        trailAngle, 0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Spinning blade (4-pointed star)
    ctx.rotate(time * 8);
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * 2 / 4) * i;
      const outerX = Math.cos(a) * r;
      const outerY = Math.sin(a) * r;
      const midA = a + Math.PI / 4;
      const midX = Math.cos(midA) * r * 0.35;
      const midY = Math.sin(midA) * r * 0.35;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(midX, midY);
    }
    ctx.closePath();
    ctx.fill();

    // Blade highlight
    ctx.fillStyle = '#c39bd3';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * 2 / 4) * i;
      const outerX = Math.cos(a) * r * 0.6;
      const outerY = Math.sin(a) * r * 0.6;
      const midA = a + Math.PI / 4;
      const midX = Math.cos(midA) * r * 0.2;
      const midY = Math.sin(midA) * r * 0.2;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(midX, midY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Center glow
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.4);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(1, '#9b59b600');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // --- Summon Pet: ghostly spirit creature ---
  renderPetProj(ctx, proj) {
    const r = proj.radius;
    const time = proj.maxLife - proj.life;
    const bob = Math.sin(time * 4) * 2;

    ctx.save();
    ctx.translate(proj.x, proj.y + bob);

    // Shadow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.8, r * 0.6, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Body (ghost shape)
    ctx.fillStyle = '#bdc3c7';
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.7, Math.PI, 0, false); // Head dome
    // Wavy bottom
    ctx.lineTo(r * 0.7, r * 0.4);
    const waveSegs = 4;
    for (let i = 0; i < waveSegs; i++) {
      const wx = r * 0.7 - (r * 1.4 / waveSegs) * (i + 0.5);
      const wy = r * 0.4 + ((i % 2 === 0) ? r * 0.3 : 0);
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    ctx.fill();

    // Ghostly glow
    ctx.globalAlpha = 0.2;
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
    grd.addColorStop(0, '#ecf0f1');
    grd.addColorStop(1, '#bdc3c700');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Eyes (glowing)
    const eyeY = -r * 0.2;
    const eyeGlow = 0.6 + Math.sin(time * 6) * 0.3;
    ctx.fillStyle = `rgba(52,152,219,${eyeGlow})`;
    ctx.beginPath();
    ctx.arc(-r * 0.22, eyeY, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.22, eyeY, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Eye highlights
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.18, eyeY - r * 0.05, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.26, eyeY - r * 0.05, r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // --- Poison Cloud: swirling toxic mist ---
  renderPoisonCloudProj(ctx, proj) {
    const r = proj.radius;
    const pulse = proj._pulse || 0;
    const breathe = 1 + Math.sin(pulse * 2) * 0.08;
    const alpha = Math.min(proj.life / 0.5, 1) * 0.5;

    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.globalAlpha = alpha;

    // Outer mist gradient
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * breathe);
    grd.addColorStop(0, 'rgba(80,180,50,0.4)');
    grd.addColorStop(0.6, 'rgba(60,150,30,0.2)');
    grd.addColorStop(1, 'rgba(40,120,20,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, r * breathe, 0, Math.PI * 2);
    ctx.fill();

    // Swirling particles inside cloud
    for (let i = 0; i < 6; i++) {
      const ang = pulse * 1.5 + i * (Math.PI * 2 / 6);
      const dist = r * (0.3 + 0.3 * Math.sin(pulse * 2 + i));
      const px = Math.cos(ang) * dist;
      const py = Math.sin(ang) * dist;
      ctx.fillStyle = 'rgba(100,204,68,0.6)';
      ctx.beginPath();
      ctx.arc(px, py, 3 + Math.sin(pulse * 3 + i) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Skull icon in center (subtle)
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#88DD66';
    ctx.font = `${Math.floor(r * 0.3)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☠', 0, 0);

    ctx.restore();
  },

  // --- Shield Orb: golden rotating orb ---
  renderShieldOrbProj(ctx, proj) {
    const r = proj.radius;
    const time = proj.maxLife - proj.life;
    const glow = 0.5 + Math.sin(time * 6) * 0.2;

    ctx.save();
    ctx.translate(proj.x, proj.y);

    // Outer glow
    ctx.globalAlpha = glow * 0.4;
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Core sphere
    ctx.globalAlpha = 0.9;
    const grd = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
    grd.addColorStop(0, '#FFF8DC');
    grd.addColorStop(0.5, '#FFD700');
    grd.addColorStop(1, '#DAA520');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.25, r * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Spinning cross pattern
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#FFF8DC';
    ctx.lineWidth = 1.5;
    const rot = time * 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rot) * r * 0.7, Math.sin(rot) * r * 0.7);
    ctx.lineTo(Math.cos(rot + Math.PI) * r * 0.7, Math.sin(rot + Math.PI) * r * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(Math.cos(rot + Math.PI / 2) * r * 0.7, Math.sin(rot + Math.PI / 2) * r * 0.7);
    ctx.lineTo(Math.cos(rot + Math.PI * 1.5) * r * 0.7, Math.sin(rot + Math.PI * 1.5) * r * 0.7);
    ctx.stroke();

    ctx.restore();
  },

  // --- Lightning bolt rendering ---
  renderLightningBolt(ctx, bolt) {
    ctx.save();
    ctx.globalAlpha = Math.min(bolt.life / 0.1, 1);

    // Main bolt
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i++) {
      ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    }
    ctx.stroke();

    // White core
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i++) {
      ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    }
    ctx.stroke();

    // Glow
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 8;
    ctx.globalAlpha *= 0.2;
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i++) {
      ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    }
    ctx.stroke();

    // Impact flash at end
    const last = bolt.points[bolt.points.length - 1];
    ctx.globalAlpha = Math.min(bolt.life / 0.1, 1) * 0.5;
    const flashGrd = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 25);
    flashGrd.addColorStop(0, '#fff');
    flashGrd.addColorStop(0.5, '#f1c40f88');
    flashGrd.addColorStop(1, '#f1c40f00');
    ctx.fillStyle = flashGrd;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // Generate lightning bolt points between two positions
  generateBoltPoints(x1, y1, x2, y2) {
    const points = [{ x: x1, y: y1 }];
    const segments = 6;
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    const perpX = -dy;
    const perpY = dx;
    const len = Math.sqrt(perpX * perpX + perpY * perpY);
    const nx = len > 0 ? perpX / len : 0;
    const ny = len > 0 ? perpY / len : 0;

    for (let i = 1; i < segments; i++) {
      const jitter = (Math.random() - 0.5) * 30;
      points.push({
        x: x1 + dx * i + nx * jitter,
        y: y1 + dy * i + ny * jitter
      });
    }
    points.push({ x: x2, y: y2 });
    return points;
  },

  renderExpOrbs(ctx) {
    for (const orb of this.expOrbs) {
      if (!orb.alive || !this.isOnScreen(orb)) continue;
      // Green glowing gem
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      // Diamond shape
      ctx.moveTo(orb.x, orb.y - orb.radius);
      ctx.lineTo(orb.x + orb.radius, orb.y);
      ctx.lineTo(orb.x, orb.y + orb.radius);
      ctx.lineTo(orb.x - orb.radius, orb.y);
      ctx.closePath();
      ctx.fill();

      // Subtle glow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  renderParticles(ctx) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 8);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI / 2) * i;
          ctx.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * p.size * 0.3, Math.sin(a + Math.PI / 4) * p.size * 0.3);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // Default square but rotated for sparkle effect
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 5);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      // Soft glow for larger particles
      if (p.size > 3) {
        ctx.globalAlpha = alpha * 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  renderPickups(ctx) {
    for (const pk of this.pickups) {
      if (!pk.alive || !this.isOnScreen(pk, 100)) continue;
      const bob = Math.sin(pk.bobPhase) * 2;
      const fadeAlpha = pk.life < 2 ? pk.life / 2 : 1;
      ctx.globalAlpha = fadeAlpha;

      if (pk.type === 'gold') {
        // Gold coin: small yellow circle with glint
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, pk.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d4ac0d';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Glint
        ctx.fillStyle = '#fff';
        ctx.fillRect(pk.x - 1, pk.y - 2 + bob, 2, 2);
      } else if (pk.type === 'health') {
        // Health potion: red cross
        ctx.fillStyle = '#e74c3c';
        const hs = pk.size / 2;
        ctx.fillRect(pk.x - hs * 0.3, pk.y - hs + bob, hs * 0.6, hs * 2);
        ctx.fillRect(pk.x - hs, pk.y - hs * 0.3 + bob, hs * 2, hs * 0.6);
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 1;
        ctx.strokeRect(pk.x - hs - 1, pk.y - hs - 1 + bob, hs * 2 + 2, hs * 2 + 2);
      }
    }
    ctx.globalAlpha = 1;
  },

  renderDamageNumbers(ctx) {
    for (const dn of this.damageNumbers) {
      const alpha = dn.life / dn.maxLife;
      ctx.globalAlpha = alpha;
      const size = dn.isCrit ? 18 : 14;
      ctx.font = `bold ${size}px monospace`;
      ctx.fillStyle = dn.color;
      ctx.textAlign = 'center';
      ctx.fillText(dn.text, dn.x, dn.y);

      // Outline for readability
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText(dn.text, dn.x, dn.y);
      ctx.fillText(dn.text, dn.x, dn.y);
    }
    ctx.globalAlpha = 1;
  },

  // =========================================================================
  //  SECTION: HUD Rendering (screen-space overlay)
  // =========================================================================

  renderHUD(ctx) {
    const p = this.player;
    if (!p) return;

    const pad = 10;

    // HP bar (top-left)
    const hpBarW = 160;
    const hpBarH = 14;
    const hpX = pad;
    const hpY = pad;

    ctx.fillStyle = '#333';
    ctx.fillRect(hpX, hpY, hpBarW, hpBarH);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(hpX, hpY, hpBarW * (p.hp / p.maxHp), hpBarH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpX, hpY, hpBarW, hpBarH);

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`, hpX + hpBarW / 2, hpY + 11);

    // EXP bar (below HP)
    const expY = hpY + hpBarH + 4;
    ctx.fillStyle = '#333';
    ctx.fillRect(hpX, expY, hpBarW, 8);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(hpX, expY, hpBarW * (p.exp / p.expToNext), 8);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(hpX, expY, hpBarW, 8);

    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Lv.${p.level}`, hpX, expY + 20);

    // Timer (top-center)
    const minutes = Math.floor(this.gameTime / 60);
    const seconds = Math.floor(this.gameTime % 60);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, this.width / 2, 24);

    // Kill count (top-right)
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e74c3c';
    ctx.fillText(`Kill: ${this.killCount}`, this.width - pad, 20);

    // Gold (below kills)
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`Gold: ${this.gold}`, this.width - pad, 36);

    // Pause button (top-right)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(this.width - 44, 44, 34, 34);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('\u23F8', this.width - 27, 67);

    // Skill icons (bottom-center)
    const iconSize = 28;
    const iconPad = 4;
    const totalW = p.skills.length * (iconSize + iconPad) - iconPad;
    let sx = (this.width - totalW) / 2;
    const sy = this.height - iconSize - pad - 20;

    for (const skill of p.skills) {
      // Background
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(sx, sy, iconSize, iconSize);

      // Skill color
      const skillColors = {
        flying_sword: '#3498db',
        fireball: '#e67e22',
        ice_ring: '#1abc9c',
        lightning: '#f1c40f',
        whirlwind: '#9b59b6',
        summon: '#bdc3c7'
      };
      ctx.fillStyle = skillColors[skill.id] || '#fff';
      ctx.fillRect(sx + 3, sy + 3, iconSize - 6, iconSize - 6);

      // Cooldown overlay
      const cdRatio = skill.cooldownTimer / (skill.baseCooldown / this.player.attackSpeedMultiplier);
      if (cdRatio > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx, sy, iconSize, iconSize * Math.min(cdRatio, 1));
      }

      // Level text
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(`${skill.level}`, sx + iconSize - 2, sy + iconSize - 2);

      ctx.strokeStyle = skill.evolved ? '#f1c40f' : '#fff';
      ctx.lineWidth = skill.evolved ? 2 : 1;
      ctx.strokeRect(sx, sy, iconSize, iconSize);

      // Evolved indicator
      if (skill.evolved) {
        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = '#f1c40f';
        ctx.textAlign = 'left';
        ctx.fillText('MAX', sx + 1, sy + 8);
      }

      sx += iconSize + iconPad;
    }

    // Enemy count (debug info, small)
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#888';
    ctx.fillText(`Enemies: ${this.enemies.length}`, pad, this.height - 6);

    // --- Game Progress Timeline ---
    this.renderProgressTimeline(ctx);

    // --- Boss Warning Banner ---
    if (this.bossWarningTimer > 0) {
      const alpha = Math.min(this.bossWarningTimer / 0.5, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Red glow (shadow)
      ctx.shadowColor = '#e74c3c';
      ctx.shadowBlur = 20 + Math.sin(this.bossWarningTimer * 8) * 10;
      ctx.fillStyle = '#e74c3c';
      ctx.fillText(this.bossWarningText, this.width / 2, this.height / 2 - 40);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.restore();
    }

    // --- Mini-map (bottom-right) ---
    this.renderMiniMap(ctx);

    // --- Damage vignette (red flash on player hit) ---
    if (this.damageVignetteTimer > 0) {
      const alpha = (this.damageVignetteTimer / 0.3) * 0.35;
      const grd = ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.width * 0.3,
        this.width / 2, this.height / 2, this.width * 0.7
      );
      grd.addColorStop(0, 'rgba(200,0,0,0)');
      grd.addColorStop(1, `rgba(200,0,0,${alpha})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  },

  renderProgressTimeline(ctx) {
    const waves = (typeof GameData !== 'undefined' && GameData.WAVES) ? GameData.WAVES : null;
    const totalWaves = waves ? waves.length : 17;
    const duration = GameData.GAME_CONFIG.GAME_DURATION;
    const progress = Math.min(this.gameTime / duration, 1);

    // Bar dimensions - wider and taller for visibility
    const barW = Math.min(this.width - 60, 320);
    const barH = 10;
    const barX = (this.width - barW) / 2;
    const barY = 44;

    // Semi-transparent panel behind the whole progress area
    const panelPad = 6;
    ctx.fillStyle = 'rgba(20,30,50,0.75)';
    const rr = 4;
    const panelX = barX - panelPad;
    const panelY = barY - panelPad;
    const panelW = barW + panelPad * 2;
    const panelH = barH + 32 + panelPad * 2;
    ctx.beginPath();
    ctx.moveTo(panelX + rr, panelY);
    ctx.lineTo(panelX + panelW - rr, panelY);
    ctx.quadraticCurveTo(panelX + panelW, panelY, panelX + panelW, panelY + rr);
    ctx.lineTo(panelX + panelW, panelY + panelH - rr);
    ctx.quadraticCurveTo(panelX + panelW, panelY + panelH, panelX + panelW - rr, panelY + panelH);
    ctx.lineTo(panelX + rr, panelY + panelH);
    ctx.quadraticCurveTo(panelX, panelY + panelH, panelX, panelY + panelH - rr);
    ctx.lineTo(panelX, panelY + rr);
    ctx.quadraticCurveTo(panelX, panelY, panelX + rr, panelY);
    ctx.closePath();
    ctx.fill();

    // Background track
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, barW, barH);

    // Filled portion - gradient from blue to gold
    if (progress > 0) {
      const grd = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grd.addColorStop(0, '#3498db');
      grd.addColorStop(Math.min(progress, 1), progress > 0.8 ? '#f1c40f' : '#2ecc71');
      ctx.fillStyle = grd;
      ctx.fillRect(barX, barY, barW * progress, barH);
    }

    // Glow on leading edge
    if (progress > 0.01) {
      const edgeX = barX + barW * progress;
      const glowGrd = ctx.createRadialGradient(edgeX, barY + barH / 2, 0, edgeX, barY + barH / 2, 8);
      glowGrd.addColorStop(0, 'rgba(255,255,255,0.4)');
      glowGrd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glowGrd;
      ctx.fillRect(edgeX - 8, barY - 4, 16, barH + 8);
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Boss markers on the bar (at 120s, 240s, 480s)
    const bossTimes = GameData.GAME_CONFIG.BOSS_TIMES || [120, 240, 480];
    const bossIcons = ['💀', '👹', '🔥'];
    for (let i = 0; i < bossTimes.length; i++) {
      const t = bossTimes[i];
      const mx = barX + (t / duration) * barW;
      const passed = this.gameTime >= t;
      // Marker line
      ctx.strokeStyle = passed ? '#f1c40f' : 'rgba(231,76,60,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, barY - 3);
      ctx.lineTo(mx, barY + barH + 3);
      ctx.stroke();
      // Boss icon label above bar
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = passed ? '#f1c40f' : '#e74c3c';
      ctx.fillText(bossIcons[i] || '💀', mx, barY - 5);
    }

    // Player position indicator (triangle below bar)
    const posX = barX + progress * barW;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(posX, barY + barH + 2);
    ctx.lineTo(posX - 4, barY + barH + 7);
    ctx.lineTo(posX + 4, barY + barH + 7);
    ctx.closePath();
    ctx.fill();

    // Wave text + percentage on same line below bar
    const infoY = barY + barH + 18;
    const pctText = `${Math.floor(progress * 100)}%`;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#bbb';
    ctx.fillText(`Wave ${this.waveIndex + 1}/${totalWaves}`, barX, infoY);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    // Current wave enemy types
    if (waves && waves[this.waveIndex]) {
      const w = waves[this.waveIndex];
      const enemyNames = w.enemyTypes.slice(0, 3).join('·');
      ctx.font = '9px monospace';
      ctx.fillText(enemyNames, this.width / 2, infoY);
    }

    ctx.textAlign = 'right';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ddd';
    ctx.fillText(pctText, barX + barW, infoY);

    // Kill milestone badges below
    const milestones = [50, 100, 200, 500];
    const badgeY = infoY + 6;
    const badgeW = 28;
    const badgePad = 4;
    const totalBadgeW = milestones.length * (badgeW + badgePad) - badgePad;
    let bx = (this.width - totalBadgeW) / 2;
    ctx.font = 'bold 8px monospace';
    for (const m of milestones) {
      const reached = this.killCount >= m;
      ctx.fillStyle = reached ? 'rgba(241,196,15,0.3)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(bx, badgeY, badgeW, 12);
      ctx.strokeStyle = reached ? '#f1c40f' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, badgeY, badgeW, 12);
      ctx.fillStyle = reached ? '#f1c40f' : '#555';
      ctx.textAlign = 'center';
      ctx.fillText(`${m}`, bx + badgeW / 2, badgeY + 9);
      bx += badgeW + badgePad;
    }
  },

  renderMiniMap(ctx) {
    const mapSize = 80;
    const mx = this.width - mapSize - 8;
    const my = this.height - mapSize - 8;
    const scaleX = mapSize / this.WORLD_WIDTH;
    const scaleY = mapSize / this.WORLD_HEIGHT;

    // Dark background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(mx, my, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mapSize, mapSize);

    // Enemies as red dots
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.isBoss) {
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(mx + e.x * scaleX - 2, my + e.y * scaleY - 2, 4, 4);
      } else {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(mx + e.x * scaleX - 0.5, my + e.y * scaleY - 0.5, 2, 2);
      }
    }

    // Player as white dot
    if (this.player) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(mx + this.player.x * scaleX - 1.5, my + this.player.y * scaleY - 1.5, 3, 3);
    }
  }
};
