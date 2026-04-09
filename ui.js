/**
 * 咒印小英雄 - UI System
 * Roguelike Survivor H5 Canvas Game
 * Manages all UI screens, overlays, save data, and player progression.
 * Depends on GameData (data.js) and GameEngine (engine.js).
 */

/* global GameData, GameEngine */

// =============================================================================
//  SECTION: Save Manager
// =============================================================================

const SaveManager = {
  data: {
    gold: 0,
    roles: {
      swordsman: { level: 1, unlocked: true },
      mage: { level: 0, unlocked: false },
      summoner: { level: 0, unlocked: false },
      icemaiden: { level: 0, unlocked: false }
    },
    talents: {},
    settings: { sound: true, music: true },
    stats: { totalGames: 0, totalKills: 0, bestTime: 0 }
  },

  save() {
    try {
      localStorage.setItem('spell_hero_save', JSON.stringify(this.data));
    } catch (e) { /* storage full or unavailable */ }
  },

  load() {
    try {
      const saved = localStorage.getItem('spell_hero_save');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults so new fields are present
        this.data = Object.assign({}, this._defaults(), parsed);
        this.data.roles = Object.assign({}, this._defaults().roles, parsed.roles || {});
        this.data.settings = Object.assign({}, this._defaults().settings, parsed.settings || {});
        this.data.stats = Object.assign({}, this._defaults().stats, parsed.stats || {});
      }
    } catch (e) { /* corrupt data, use defaults */ }
  },

  _defaults() {
    return {
      gold: 0,
      roles: {
        swordsman: { level: 1, unlocked: true },
        mage: { level: 0, unlocked: false },
        summoner: { level: 0, unlocked: false },
        icemaiden: { level: 0, unlocked: false }
      },
      talents: {},
      settings: { sound: true, music: true },
      stats: { totalGames: 0, totalKills: 0, bestTime: 0 }
    };
  },

  spendGold(amount) {
    if (this.data.gold >= amount) {
      this.data.gold -= amount;
      this.save();
      return true;
    }
    return false;
  },

  addGold(amount) {
    this.data.gold += amount;
    this.save();
  },

  getRoleLevel(roleId) {
    return (this.data.roles[roleId] && this.data.roles[roleId].level) || 0;
  },

  isRoleUnlocked(roleId) {
    return !!(this.data.roles[roleId] && this.data.roles[roleId].unlocked);
  },

  getTalentLevel(talentId) {
    return this.data.talents[talentId] || 0;
  },

  getTalentBonuses() {
    const bonuses = {
      attack_power: 0, critical_rate: 0, critical_damage: 0,
      toughness: 0, regen: 0, invincible: 0,
      wisdom: 0, magnet: 0, fortune: 0
    };
    for (const catKey in GameData.TALENTS) {
      const cat = GameData.TALENTS[catKey];
      for (const tId in cat.talents) {
        const t = cat.talents[tId];
        const lvl = this.getTalentLevel(tId);
        if (lvl > 0 && t.levels[lvl - 1]) {
          bonuses[tId] = t.levels[lvl - 1].bonus;
        }
      }
    }
    return bonuses;
  },

  getFortuneBonus() {
    const lvl = this.getTalentLevel('fortune');
    if (lvl > 0) {
      const t = GameData.TALENTS.growth.talents.fortune;
      return t.levels[lvl - 1].bonus;
    }
    return 0;
  }
};

// =============================================================================
//  SECTION: CSS Styles
// =============================================================================

const UI_STYLES = `
/* PLACEHOLDER - styles injected below */
`;

function injectStyles() {
  const style = document.createElement('style');
  style.id = 'game-ui-styles';
  style.textContent = _buildCSS();
  document.head.appendChild(style);
}

function _buildCSS() {
  // Built in sections to keep it readable
  return _cssBase() + _cssMenu() + _cssCharacters() + _cssMaps() + _cssTalents()
    + _cssLevelUp() + _cssPause() + _cssGameOver() + _cssSettings()
    + _cssAnimations();
}

// --- CSS subsections (placeholder bodies, filled via Edit) ---
function _cssBase() {
  return `
/* BASE */
#game-ui-layer {
  position: fixed; top:0; left:0; width:100%; height:100%;
  pointer-events: none; z-index: 10;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #e0e0e0;
  user-select: none; -webkit-user-select: none;
  overflow: hidden;
}
#game-ui-layer .screen, #game-ui-layer .overlay {
  position: absolute; top:0; left:0; width:100%; height:100%;
  display: none; pointer-events: auto;
  flex-direction: column; align-items: center; justify-content: center;
}
#game-ui-layer .screen.active, #game-ui-layer .overlay.active {
  display: flex;
}
.ui-btn {
  border: none; outline: none; cursor: pointer;
  padding: 12px 32px; border-radius: 8px;
  font-size: 18px; letter-spacing: 2px;
  color: #fff; background: linear-gradient(135deg, #e74c3c, #c0392b);
  box-shadow: 0 4px 12px rgba(231,76,60,0.3);
  transition: transform 0.15s, box-shadow 0.15s;
  font-family: inherit;
}
.ui-btn:active { transform: scale(0.95); box-shadow: 0 2px 6px rgba(231,76,60,0.2); }
.ui-btn.secondary {
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
  box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
}
.ui-btn.gold-btn {
  background: linear-gradient(135deg, #f1c40f, #d4a50a);
  color: #1a1a2e;
}
.ui-btn:disabled {
  opacity: 0.4; cursor: default; transform: none;
}
.gold-display {
  position: absolute; top: 16px; right: 16px;
  font-size: 18px; color: #f1c40f;
  text-shadow: 0 0 8px rgba(241,196,15,0.4);
  z-index: 5;
}
.gold-display::before { content: '💰 '; }
.back-btn {
  position: absolute; top: 16px; left: 16px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
  color: #e0e0e0; padding: 8px 20px; border-radius: 6px; cursor: pointer;
  font-size: 16px; font-family: inherit; z-index: 5;
}
.back-btn:active { background: rgba(255,255,255,0.15); }
`;
}

function _cssMenu() {
  return `
/* MENU */
#screen-menu { background: #0d1117; }
#screen-menu .menu-title {
  font-size: 48px; font-weight: bold; color: #fff;
  text-shadow: 0 0 10px rgba(231,76,60,0.6), 0 0 30px rgba(231,76,60,0.3),
    2px 2px 0 #c0392b, -1px -1px 0 rgba(0,0,0,0.5);
  letter-spacing: 8px; margin-bottom: 48px;
}
#screen-menu .menu-buttons { display: flex; flex-direction: column; gap: 16px; align-items: center; }
#screen-menu .menu-buttons .ui-btn { min-width: 200px; text-align: center; }
.menu-particles {
  position: absolute; top:0; left:0; width:100%; height:100%;
  pointer-events: none; z-index: 0;
}
#screen-menu .menu-content { z-index: 1; display:flex; flex-direction:column; align-items:center; }
`;
}

function _cssCharacters() {
  return `
/* CHARACTERS */
#screen-characters { background: #0d1117; padding: 60px 16px 16px; }
.char-title { font-size: 28px; color: #fff; letter-spacing: 4px; margin-bottom: 20px; }
.char-list {
  display: flex; gap: 16px; overflow-x: auto; padding: 16px 8px;
  max-width: 100%; scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.char-card {
  flex: 0 0 160px; min-height: 220px; border-radius: 12px;
  background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.08);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 16px 8px; cursor: pointer; transition: border-color 0.2s, transform 0.2s;
  scroll-snap-align: center; position: relative;
}
.char-card.selected { border-color: #f1c40f; transform: scale(1.05); box-shadow: 0 0 20px rgba(241,196,15,0.2); }
.char-card.locked { opacity: 0.6; }
.char-card .char-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  margin-bottom: 8px; display:flex; align-items:center; justify-content:center;
  font-size: 32px;
}
.char-card .char-name { font-size: 18px; color: #fff; margin-bottom: 4px; letter-spacing: 2px; }
.char-card .char-level { font-size: 13px; color: #aaa; margin-bottom: 4px; }
.char-card .char-skill { font-size: 12px; color: #888; }
.char-card .char-stats {
  display: flex; gap: 8px; margin-top: 6px; font-size: 11px;
}
.char-card .char-stats .cstat {
  display: flex; align-items: center; gap: 2px; color: #bbb;
}
.char-card .char-stats .cstat .cstat-val { color: #fff; font-weight: bold; }
.char-card .lock-overlay {
  position: absolute; top:0; left:0; width:100%; height:100%;
  background: rgba(0,0,0,0.5); border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 14px; color: #aaa;
}
.char-card .lock-overlay .lock-icon { font-size: 36px; margin-bottom: 8px; }
.char-actions { display: flex; gap: 12px; margin-top: 20px; }
/* Detail panel for selected character */
.char-detail {
  width: 100%; max-width: 400px; margin-top: 16px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 16px; display: none;
}
.char-detail.visible { display: block; }
.char-detail .cd-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.char-detail .cd-header .cd-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.char-detail .cd-header .cd-name { font-size: 18px; color: #fff; font-weight: bold; }
.char-detail .cd-header .cd-lvl { font-size: 13px; color: #f1c40f; margin-left: auto; }
.char-detail .cd-desc { font-size: 12px; color: #888; margin-bottom: 12px; line-height: 1.4; }
.char-detail .cd-stats-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;
}
.char-detail .cd-stat-item {
  display: flex; align-items: center; gap: 6px; font-size: 13px;
}
.char-detail .cd-stat-item .cd-stat-label { color: #888; }
.char-detail .cd-stat-item .cd-stat-val { color: #fff; font-weight: bold; }
.char-detail .cd-stat-item .cd-stat-arrow { color: #2ecc71; font-size: 11px; margin-left: 2px; }
.char-detail .cd-stat-item .cd-stat-next { color: #2ecc71; font-weight: bold; }
.char-detail .cd-upgrade-bar {
  display: flex; align-items: center; gap: 10px; padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.char-detail .cd-upgrade-bar .cd-cost { font-size: 14px; color: #f1c40f; flex: 1; }
.char-detail .cd-maxlevel { font-size: 14px; color: #f1c40f; text-align: center; padding-top: 8px; }
@keyframes upgrade-flash {
  0% { background: rgba(241,196,15,0.3); }
  100% { background: rgba(255,255,255,0.04); }
}
.char-detail.flash { animation: upgrade-flash 0.6s ease-out; }
`;
}

function _cssMaps() {
  return `
/* MAPS */
#screen-maps { background: #0d1117; padding: 60px 16px 16px; }
.map-list {
  display: flex; gap: 14px; width: 100%; max-width: 640px;
  overflow-x: auto; padding: 8px 0; justify-content: center; flex-wrap: wrap;
}
.map-card {
  flex: 0 0 120px; border-radius: 10px; overflow: hidden;
  border: 2px solid rgba(255,255,255,0.1); cursor: pointer;
  transition: all 0.2s; background: rgba(255,255,255,0.03);
}
.map-card:hover { border-color: rgba(255,255,255,0.3); transform: translateY(-2px); }
.map-card.selected { border-color: #f1c40f; box-shadow: 0 0 12px rgba(241,196,15,0.3); }
.map-card.locked { opacity: 0.5; cursor: default; }
.map-card.locked:hover { transform: none; border-color: rgba(255,255,255,0.1); }
.map-preview {
  width: 100%; height: 70px; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.map-icon { font-size: 28px; text-shadow: 0 2px 8px rgba(0,0,0,0.6); }
.map-name {
  padding: 8px 4px; text-align: center; color: #ddd;
  font-size: 13px; font-weight: bold; letter-spacing: 1px;
}
.map-lock {
  padding: 4px; text-align: center; font-size: 11px; color: #888;
}
.map-lock-text { font-size: 10px; color: #666; margin-top: 2px; }
.map-detail {
  width: 100%; max-width: 400px; background: rgba(255,255,255,0.04);
  border-radius: 10px; padding: 16px; margin-top: 16px;
}
.md-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.md-icon { font-size: 28px; }
.md-name { font-size: 20px; color: #fff; font-weight: bold; }
.md-desc { font-size: 12px; color: #888; margin-bottom: 12px; line-height: 1.5; }
.md-stats { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.md-stat {
  display: flex; justify-content: space-between; font-size: 12px;
  color: #aaa; padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 4px;
}
.md-stat span:last-child { color: #fff; font-weight: bold; }
.md-progress { margin-top: 8px; }
.md-progress-label { font-size: 11px; color: #888; margin-bottom: 4px; }
.md-progress-track {
  width: 100%; height: 6px; background: rgba(255,255,255,0.1);
  border-radius: 3px; overflow: hidden;
}
.md-progress-fill {
  height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71);
  border-radius: 3px; transition: width 0.3s;
}
`;
}

function _cssTalents() {
  return `
/* TALENTS */
#screen-talents { background: #0d1117; padding: 60px 16px 16px; }
.talent-title { font-size: 28px; color: #fff; letter-spacing: 4px; margin-bottom: 16px; }
.talent-columns {
  display: flex; gap: 24px; width: 100%; max-width: 600px; justify-content: center;
}
.talent-column {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 16px;
}
.talent-col-header { font-size: 16px; color: #f1c40f; letter-spacing: 2px; margin-bottom: 4px; }
.talent-node {
  width: 64px; height: 64px; border-radius: 50%;
  background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.1);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  cursor: pointer; transition: border-color 0.2s, background 0.2s;
  font-size: 24px; position: relative;
}
.talent-node:active { background: rgba(255,255,255,0.12); }
.talent-node.has-points { border-color: #f1c40f; }
.talent-node .talent-pips {
  position: absolute; bottom: -8px; display: flex; gap: 3px;
}
.talent-node .talent-pip {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(255,255,255,0.2);
}
.talent-node .talent-pip.filled { background: #f1c40f; }
.talent-node .talent-label {
  font-size: 10px; color: #ccc; position: absolute; bottom: -22px;
  white-space: nowrap;
}
.talent-popup {
  position: fixed; top:50%; left:50%; transform: translate(-50%,-50%);
  background: #1a1a2e; border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12px; padding: 24px; min-width: 280px;
  z-index: 100; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.talent-popup .tp-name { font-size: 20px; color: #fff; margin-bottom: 8px; letter-spacing: 2px; }
.talent-popup .tp-desc { font-size: 14px; color: #aaa; margin-bottom: 12px; }
.talent-popup .tp-effect { font-size: 14px; color: #e0e0e0; margin-bottom: 4px; }
.talent-popup .tp-cost { font-size: 14px; color: #f1c40f; margin: 8px 0; }
.talent-popup-backdrop {
  position: fixed; top:0; left:0; width:100%; height:100%;
  background: rgba(0,0,0,0.5); z-index: 99;
}
`;
}

function _cssLevelUp() {
  return `
/* LEVEL UP */
#overlay-levelup {
  background: rgba(0,0,0,0.75); z-index: 50;
}
.levelup-title {
  font-size: 36px; color: #f1c40f; letter-spacing: 6px; margin-bottom: 8px;
  text-shadow: 0 0 20px rgba(241,196,15,0.5);
}
.levelup-subtitle { font-size: 16px; color: #aaa; margin-bottom: 24px; }
.levelup-choices { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; padding: 0 16px; }
.levelup-card {
  width: 140px; padding: 16px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.1);
  display: flex; flex-direction: column; align-items: center; text-align: center;
  cursor: pointer; transition: border-color 0.2s, transform 0.2s, background 0.2s;
}
.levelup-card:active { transform: scale(0.97); }
.levelup-card:hover { border-color: #f1c40f; background: rgba(255,255,255,0.1); }
.levelup-card .lc-icon { font-size: 32px; margin-bottom: 8px; }
.levelup-card .lc-name { font-size: 16px; color: #fff; margin-bottom: 4px; letter-spacing: 1px; }
.levelup-card .lc-desc { font-size: 12px; color: #aaa; margin-bottom: 6px; line-height: 1.4; }
.levelup-card .lc-level { font-size: 12px; color: #f1c40f; }
.levelup-refresh {
  margin-top: 16px; font-size: 14px; color: #aaa;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  padding: 8px 20px; border-radius: 6px; cursor: pointer; font-family: inherit;
}
`;
}

function _cssPause() {
  return `
/* PAUSE */
#overlay-pause {
  background: rgba(0,0,0,0.7); z-index: 50;
}
.pause-icon { font-size: 48px; margin-bottom: 8px; }
.pause-title { font-size: 32px; color: #fff; letter-spacing: 6px; margin-bottom: 24px; }
.pause-buttons { display: flex; flex-direction: column; gap: 12px; }
`;
}

function _cssGameOver() {
  return `
/* GAME OVER */
#screen-gameover {
  background: rgba(0,0,0,0.85); z-index: 50;
}
.gameover-title {
  font-size: 40px; font-weight: bold; letter-spacing: 6px; margin-bottom: 24px;
  text-shadow: 0 0 20px currentColor;
}
.gameover-title.victory { color: #f1c40f; }
.gameover-title.defeat { color: #e74c3c; }
.gameover-stats {
  display: flex; flex-direction: column; gap: 8px;
  margin-bottom: 24px; font-size: 16px;
}
.gameover-stats .stat-row { display: flex; justify-content: space-between; gap: 32px; }
.gameover-stats .stat-label { color: #aaa; }
.gameover-stats .stat-value { color: #fff; font-weight: bold; }
.gameover-gold {
  font-size: 24px; color: #f1c40f; margin-bottom: 24px;
  text-shadow: 0 0 10px rgba(241,196,15,0.4);
}
.gameover-buttons { display: flex; flex-direction: column; gap: 12px; align-items: center; }
`;
}

function _cssSettings() {
  return `
/* SETTINGS */
#screen-settings { background: #0d1117; padding: 60px 16px 16px; }
.settings-title { font-size: 28px; color: #fff; letter-spacing: 4px; margin-bottom: 32px; }
.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  width: 260px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.setting-label { font-size: 18px; letter-spacing: 2px; }
.setting-toggle {
  width: 52px; height: 28px; border-radius: 14px; cursor: pointer;
  background: rgba(255,255,255,0.15); position: relative; transition: background 0.2s;
  border: none; outline: none;
}
.setting-toggle.on { background: #e74c3c; }
.setting-toggle::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 22px; height: 22px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
}
.setting-toggle.on::after { transform: translateX(24px); }
`;
}

function _cssAnimations() {
  return `
/* ANIMATIONS */
@keyframes float-particle {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.6; }
  100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
}
.particle {
  position: absolute; border-radius: 50%; pointer-events: none;
  animation: float-particle linear infinite;
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 10px rgba(241,196,15,0.2); }
  50% { box-shadow: 0 0 20px rgba(241,196,15,0.5); }
}
`;
}

// =============================================================================
//  SECTION: GameUI
// =============================================================================

const GameUI = {
  currentScreen: 'menu',
  selectedRole: 'swordsman',
  selectedMap: 'dark_forest',
  _uiLayer: null,
  _screens: {},
  _overlays: {},
  _talentPopup: null,
  _talentPopupBackdrop: null,

  // -------------------------------------------------------------------------
  //  init
  // -------------------------------------------------------------------------
  init() {
    injectStyles();
    SaveManager.load();

    // Create the UI layer container
    this._uiLayer = document.createElement('div');
    this._uiLayer.id = 'game-ui-layer';
    document.body.appendChild(this._uiLayer);

    // Build all screens and overlays
    this.buildMenuScreen();
    this.buildCharacterScreen();
    this.buildMapScreen();
    this.buildTalentScreen();
    this.buildSettingsScreen();
    this.buildLevelUpOverlay();
    this.buildPauseOverlay();
    this.buildGameOverScreen();

    // Init engine
    if (typeof GameEngine !== 'undefined') {
      GameEngine.init('gameCanvas');
      GameEngine.onLevelUp = (choices) => this.showLevelUpChoices(choices);
      GameEngine.onGameOver = (stats) => this.showGameOverScreen(stats, false);
      GameEngine.onVictory = (stats) => this.showGameOverScreen(stats, true);
    }

    // Check unlocks and show menu
    this.checkUnlockConditions();
    this.showScreen('menu');
  },

  // -------------------------------------------------------------------------
  //  Screen management
  // -------------------------------------------------------------------------
  showScreen(screenId) {
    this.currentScreen = screenId;
    // Hide all screens and overlays
    const all = this._uiLayer.querySelectorAll('.screen, .overlay');
    all.forEach(el => el.classList.remove('active'));
    // Show target
    const target = this._screens[screenId] || this._overlays[screenId];
    if (target) target.classList.add('active');
  },

  showOverlay(overlayId) {
    const target = this._overlays[overlayId];
    if (target) target.classList.add('active');
  },

  hideOverlay(overlayId) {
    const target = this._overlays[overlayId];
    if (target) target.classList.remove('active');
  },

  // -------------------------------------------------------------------------
  //  PLACEHOLDER BUILDERS - filled in via Edit
  // -------------------------------------------------------------------------
  buildMenuScreen() {
    const screen = this._el('div', 'screen');
    screen.id = 'screen-menu';
    this._screens.menu = screen;

    // Particle background
    const particleContainer = this._el('div', 'menu-particles');
    screen.appendChild(particleContainer);
    this.createParticleBackground(particleContainer);

    // Gold display
    const goldDisp = this._el('div', 'gold-display');
    goldDisp.id = 'menu-gold';
    goldDisp.textContent = this.formatGold(SaveManager.data.gold);
    screen.appendChild(goldDisp);

    // Content wrapper
    const content = this._el('div', 'menu-content');

    // Title
    const title = this._el('div', 'menu-title', '咒印小英雄');
    content.appendChild(title);

    // Buttons
    const btns = this._el('div', 'menu-buttons');

    const btnStart = this._el('button', 'ui-btn', '开始游戏');
    btnStart.addEventListener('click', () => this.showScreen('characters'));

    const btnChars = this._el('button', 'ui-btn secondary', '角色');
    btnChars.addEventListener('click', () => {
      this.refreshCharacterCards();
      this.showScreen('characters');
    });

    const btnTalents = this._el('button', 'ui-btn secondary', '天赋');
    btnTalents.addEventListener('click', () => {
      this.refreshTalentNodes();
      this.showScreen('talents');
    });

    const btnSettings = this._el('button', 'ui-btn secondary', '设置');
    btnSettings.addEventListener('click', () => this.showScreen('settings'));

    btns.appendChild(btnStart);
    btns.appendChild(btnChars);
    btns.appendChild(btnTalents);
    btns.appendChild(btnSettings);
    content.appendChild(btns);

    screen.appendChild(content);
    this._uiLayer.appendChild(screen);
  },
  buildCharacterScreen() {
    const screen = this._el('div', 'screen');
    screen.id = 'screen-characters';
    this._screens.characters = screen;

    // Back button
    const backBtn = this._el('button', 'back-btn', '← 返回');
    backBtn.addEventListener('click', () => this.showScreen('menu'));
    screen.appendChild(backBtn);

    // Gold display
    const goldDisp = this._el('div', 'gold-display');
    goldDisp.id = 'char-gold';
    screen.appendChild(goldDisp);

    // Title
    const title = this._el('div', 'char-title', '角色选择');
    screen.appendChild(title);

    // Card list container
    const list = this._el('div', 'char-list');
    list.id = 'char-list';
    screen.appendChild(list);

    // Detail panel (shows stats + upgrade preview for selected character)
    const detail = this._el('div', 'char-detail');
    detail.id = 'char-detail';
    screen.appendChild(detail);

    // Action buttons
    const actions = this._el('div', 'char-actions');

    const upgradeBtn = this._el('button', 'ui-btn gold-btn', '升级');
    upgradeBtn.id = 'char-upgrade-btn';
    upgradeBtn.addEventListener('click', () => this.upgradeCharacter(this.selectedRole));

    const selectBtn = this._el('button', 'ui-btn', '选择出战');
    selectBtn.id = 'char-select-btn';
    selectBtn.addEventListener('click', () => {
      this.refreshMapCards();
      this.showScreen('maps');
    });

    actions.appendChild(upgradeBtn);
    actions.appendChild(selectBtn);
    screen.appendChild(actions);

    this._uiLayer.appendChild(screen);
    this.refreshCharacterCards();
  },

  // -------------------------------------------------------------------------
  //  Map Selection Screen
  // -------------------------------------------------------------------------
  buildMapScreen() {
    const screen = this._el('div', 'screen');
    screen.id = 'screen-maps';
    this._screens.maps = screen;

    // Back button
    const backBtn = this._el('button', 'back-btn', '← 返回');
    backBtn.addEventListener('click', () => this.showScreen('characters'));
    screen.appendChild(backBtn);

    // Title
    const title = this._el('div', 'char-title', '场景选择');
    screen.appendChild(title);

    // Map cards container
    const list = this._el('div', 'map-list');
    list.id = 'map-list';
    screen.appendChild(list);

    // Map detail panel
    const detail = this._el('div', 'map-detail');
    detail.id = 'map-detail';
    screen.appendChild(detail);

    // Start button
    const actions = this._el('div', 'char-actions');
    const startBtn = this._el('button', 'ui-btn', '开始战斗');
    startBtn.id = 'map-start-btn';
    startBtn.addEventListener('click', () => this.startGame());
    actions.appendChild(startBtn);
    screen.appendChild(actions);

    this._uiLayer.appendChild(screen);
  },

  refreshMapCards() {
    const list = document.getElementById('map-list');
    if (!list) return;
    list.innerHTML = '';

    const maps = (typeof GameData !== 'undefined' && GameData.MAPS) ? GameData.MAPS : {};
    const save = SaveManager.data;
    const totalKills = (save.stats && save.stats.totalKills) || 0;

    for (const mid of Object.keys(maps)) {
      const m = maps[mid];
      const cond = m.unlockCondition;
      const unlocked = !cond || (cond.totalKills && totalKills >= cond.totalKills);

      const card = this._el('div', 'map-card' + (unlocked ? '' : ' locked'));
      if (mid === this.selectedMap && unlocked) card.classList.add('selected');

      // Map preview (colored tile preview)
      const preview = this._el('div', 'map-preview');
      const colA = m.colors ? m.colors.a : '#16213e';
      const colB = m.colors ? m.colors.b : '#1a1a2e';
      const borderC = m.colors ? m.colors.border : '#e74c3c';
      preview.style.background = `repeating-conic-gradient(${colA} 0% 25%, ${colB} 25% 50%) 0 0 / 20px 20px`;
      preview.style.borderBottom = `2px solid ${borderC}`;

      // Icon overlay
      const icon = this._el('div', 'map-icon', m.icon || '?');
      preview.appendChild(icon);
      card.appendChild(preview);

      // Name
      const name = this._el('div', 'map-name', m.name);
      card.appendChild(name);

      if (!unlocked) {
        const lock = this._el('div', 'map-lock');
        const lockIcon = this._el('div', '', '🔒');
        const lockText = this._el('div', 'map-lock-text',
          `击杀 ${cond.totalKills} 敌人解锁`);
        lock.appendChild(lockIcon);
        lock.appendChild(lockText);
        card.appendChild(lock);
      }

      card.addEventListener('click', () => {
        if (!unlocked) return;
        this.selectedMap = mid;
        this.refreshMapCards();
        this._refreshMapDetail();
      });

      list.appendChild(card);
    }

    this._refreshMapDetail();
  },

  _refreshMapDetail() {
    const detail = document.getElementById('map-detail');
    if (!detail) return;
    detail.innerHTML = '';

    const maps = (typeof GameData !== 'undefined' && GameData.MAPS) ? GameData.MAPS : {};
    const m = maps[this.selectedMap];
    if (!m) return;

    const save = SaveManager.data;
    const totalKills = (save.stats && save.stats.totalKills) || 0;
    const cond = m.unlockCondition;
    const unlocked = !cond || (cond.totalKills && totalKills >= cond.totalKills);

    // Header
    const header = this._el('div', 'md-header');
    const icon = this._el('span', 'md-icon', m.icon || '?');
    const name = this._el('span', 'md-name', m.name);
    header.appendChild(icon);
    header.appendChild(name);
    detail.appendChild(header);

    // Description
    const desc = this._el('div', 'md-desc', m.description);
    detail.appendChild(desc);

    // Stats
    const stats = this._el('div', 'md-stats');
    const ambientNames = { firefly: '萤火虫', ember: '余烬', snow: '飘雪', void: '虚空' };
    stats.innerHTML = `
      <div class="md-stat"><span>地图尺寸</span><span>${m.worldWidth}×${m.worldHeight}</span></div>
      <div class="md-stat"><span>场景氛围</span><span>${ambientNames[m.ambientParticles ? m.ambientParticles.type : ''] || '无'}</span></div>
    `;
    detail.appendChild(stats);

    // Unlock progress
    if (cond && cond.totalKills) {
      const bar = this._el('div', 'md-progress');
      const pct = Math.min(totalKills / cond.totalKills, 1);
      bar.innerHTML = `
        <div class="md-progress-label">解锁进度: ${totalKills}/${cond.totalKills}</div>
        <div class="md-progress-track">
          <div class="md-progress-fill" style="width:${pct * 100}%"></div>
        </div>
      `;
      detail.appendChild(bar);
    }

    // Update start button
    const startBtn = document.getElementById('map-start-btn');
    if (startBtn) {
      startBtn.disabled = !unlocked;
      startBtn.textContent = unlocked ? '开始战斗' : '未解锁';
    }
  },
  buildTalentScreen() {
    const screen = this._el('div', 'screen');
    screen.id = 'screen-talents';
    this._screens.talents = screen;

    // Back button
    const backBtn = this._el('button', 'back-btn', '← 返回');
    backBtn.addEventListener('click', () => {
      this._closeTalentPopup();
      this.showScreen('menu');
    });
    screen.appendChild(backBtn);

    // Gold display
    const goldDisp = this._el('div', 'gold-display');
    goldDisp.id = 'talent-gold';
    screen.appendChild(goldDisp);

    // Title
    const title = this._el('div', 'talent-title', '天赋树');
    screen.appendChild(title);

    // Three columns
    const columns = this._el('div', 'talent-columns');
    columns.id = 'talent-columns';

    const categories = ['attack', 'defense', 'growth'];
    categories.forEach(catKey => {
      const cat = GameData.TALENTS[catKey];
      const col = this._el('div', 'talent-column');
      const header = this._el('div', 'talent-col-header', cat.name);
      col.appendChild(header);

      for (const tId in cat.talents) {
        const t = cat.talents[tId];
        const node = this._el('div', 'talent-node');
        node.dataset.talentId = tId;
        node.dataset.category = catKey;

        // Icon (use first char of name or a generic symbol)
        const iconMap = {
          attack_power: '⚔️', critical_rate: '🎯', critical_damage: '💀',
          toughness: '🛡️', regen: '💚', invincible: '✨',
          wisdom: '📖', magnet: '🧲', fortune: '💰'
        };
        const iconSpan = this._el('span', null, iconMap[tId] || '◆');
        node.appendChild(iconSpan);

        // Level pips
        const pips = this._el('div', 'talent-pips');
        const maxLvl = t.levels.length;
        for (let i = 0; i < maxLvl; i++) {
          const pip = this._el('div', 'talent-pip');
          pips.appendChild(pip);
        }
        node.appendChild(pips);

        // Label
        const label = this._el('div', 'talent-label', t.name);
        node.appendChild(label);

        node.addEventListener('click', () => this._showTalentPopup(tId, catKey));
        col.appendChild(node);
      }

      columns.appendChild(col);
    });

    screen.appendChild(columns);

    // Popup elements (hidden by default)
    this._talentPopupBackdrop = this._el('div', 'talent-popup-backdrop');
    this._talentPopupBackdrop.style.display = 'none';
    this._talentPopupBackdrop.addEventListener('click', () => this._closeTalentPopup());

    this._talentPopup = this._el('div', 'talent-popup');
    this._talentPopup.style.display = 'none';
    this._talentPopup.id = 'talent-popup';

    screen.appendChild(this._talentPopupBackdrop);
    screen.appendChild(this._talentPopup);

    this._uiLayer.appendChild(screen);
  },
  buildSettingsScreen() {
    const screen = this._el('div', 'screen');
    screen.id = 'screen-settings';
    this._screens.settings = screen;

    // Back button
    const backBtn = this._el('button', 'back-btn', '← 返回');
    backBtn.addEventListener('click', () => this.showScreen('menu'));
    screen.appendChild(backBtn);

    // Title
    const title = this._el('div', 'settings-title', '设置');
    screen.appendChild(title);

    // Sound toggle
    const soundRow = this._el('div', 'setting-row');
    const soundLabel = this._el('span', 'setting-label', '音效');
    const soundToggle = this._el('button', 'setting-toggle');
    soundToggle.id = 'toggle-sound';
    if (SaveManager.data.settings.sound) soundToggle.classList.add('on');
    soundToggle.addEventListener('click', () => {
      SaveManager.data.settings.sound = !SaveManager.data.settings.sound;
      soundToggle.classList.toggle('on', SaveManager.data.settings.sound);
      SaveManager.save();
    });
    soundRow.appendChild(soundLabel);
    soundRow.appendChild(soundToggle);
    screen.appendChild(soundRow);

    // Music toggle
    const musicRow = this._el('div', 'setting-row');
    const musicLabel = this._el('span', 'setting-label', '音乐');
    const musicToggle = this._el('button', 'setting-toggle');
    musicToggle.id = 'toggle-music';
    if (SaveManager.data.settings.music) musicToggle.classList.add('on');
    musicToggle.addEventListener('click', () => {
      SaveManager.data.settings.music = !SaveManager.data.settings.music;
      musicToggle.classList.toggle('on', SaveManager.data.settings.music);
      SaveManager.save();
    });
    musicRow.appendChild(musicLabel);
    musicRow.appendChild(musicToggle);
    screen.appendChild(musicRow);

    this._uiLayer.appendChild(screen);
  },
  buildLevelUpOverlay() {
    const overlay = this._el('div', 'overlay');
    overlay.id = 'overlay-levelup';
    this._overlays.levelup = overlay;

    const title = this._el('div', 'levelup-title', '升级!');
    overlay.appendChild(title);

    const subtitle = this._el('div', 'levelup-subtitle', '选择强化');
    overlay.appendChild(subtitle);

    const choices = this._el('div', 'levelup-choices');
    choices.id = 'levelup-choices';
    overlay.appendChild(choices);

    const refreshBtn = this._el('button', 'levelup-refresh', '🔄 刷新');
    refreshBtn.addEventListener('click', () => {
      // Placeholder for ad-based refresh; non-functional for now
    });
    overlay.appendChild(refreshBtn);

    this._uiLayer.appendChild(overlay);
  },
  buildPauseOverlay() {
    const overlay = this._el('div', 'overlay');
    overlay.id = 'overlay-pause';
    this._overlays.pause = overlay;

    const icon = this._el('div', 'pause-icon', '⏸');
    overlay.appendChild(icon);

    const title = this._el('div', 'pause-title', '暂停');
    overlay.appendChild(title);

    const btns = this._el('div', 'pause-buttons');

    const resumeBtn = this._el('button', 'ui-btn', '继续');
    resumeBtn.addEventListener('click', () => {
      this.hideOverlay('pause');
      if (typeof GameEngine !== 'undefined') {
        GameEngine.state = 'playing';
        GameEngine._lastTime = performance.now();
        GameEngine._loop();
      }
    });

    const quitBtn = this._el('button', 'ui-btn secondary', '放弃');
    quitBtn.addEventListener('click', () => {
      this.hideOverlay('pause');
      if (typeof GameEngine !== 'undefined') {
        GameEngine.stop();
      }
      this.showScreen('menu');
      this._updateAllGoldDisplays();
    });

    btns.appendChild(resumeBtn);
    btns.appendChild(quitBtn);
    overlay.appendChild(btns);

    this._uiLayer.appendChild(overlay);
  },
  buildGameOverScreen() {
    const screen = this._el('div', 'overlay');
    screen.id = 'screen-gameover';
    this._overlays.gameover = screen;

    // Title (set dynamically)
    const title = this._el('div', 'gameover-title');
    title.id = 'gameover-title';
    screen.appendChild(title);

    // Stats
    const stats = this._el('div', 'gameover-stats');
    stats.id = 'gameover-stats';
    screen.appendChild(stats);

    // Gold earned
    const goldLine = this._el('div', 'gameover-gold');
    goldLine.id = 'gameover-gold';
    screen.appendChild(goldLine);

    // Buttons
    const btns = this._el('div', 'gameover-buttons');

    const doubleBtn = this._el('button', 'ui-btn gold-btn', '💰 金币翻倍');
    doubleBtn.id = 'gameover-double-btn';
    doubleBtn.addEventListener('click', () => {
      // Placeholder for ad-based doubling
      doubleBtn.disabled = true;
      doubleBtn.textContent = '已领取';
    });

    const retryBtn = this._el('button', 'ui-btn', '再来一局');
    retryBtn.addEventListener('click', () => {
      this.hideOverlay('gameover');
      this.refreshCharacterCards();
      this.showScreen('characters');
    });

    const returnBtn = this._el('button', 'ui-btn secondary', '返回');
    returnBtn.addEventListener('click', () => {
      this.hideOverlay('gameover');
      this.showScreen('menu');
      this._updateAllGoldDisplays();
    });

    btns.appendChild(doubleBtn);
    btns.appendChild(retryBtn);
    btns.appendChild(returnBtn);
    screen.appendChild(btns);

    this._uiLayer.appendChild(screen);
  },

  // -------------------------------------------------------------------------
  //  Character helpers
  // -------------------------------------------------------------------------
  refreshCharacterCards() {
    const list = document.getElementById('char-list');
    if (!list) return;
    list.innerHTML = '';

    const goldDisp = document.getElementById('char-gold');
    if (goldDisp) goldDisp.textContent = this.formatGold(SaveManager.data.gold);

    const roleIds = Object.keys(GameData.ROLES);
    const colorMap = {
      swordsman: '#4488FF', mage: '#FF4444', summoner: '#AA44FF', icemaiden: '#44DDFF'
    };
    const emojiMap = {
      swordsman: '⚔️', mage: '🔥', summoner: '💀', icemaiden: '❄️'
    };

    roleIds.forEach(rid => {
      const role = GameData.ROLES[rid];
      const unlocked = SaveManager.isRoleUnlocked(rid);
      const level = SaveManager.getRoleLevel(rid);
      const lvlIdx = Math.max(0, level - 1);

      const card = this._el('div', 'char-card');
      if (!unlocked) card.classList.add('locked');
      if (rid === this.selectedRole && unlocked) card.classList.add('selected');
      card.dataset.roleId = rid;

      // Avatar
      const avatar = this._el('div', 'char-avatar');
      avatar.style.background = colorMap[rid] || '#888';
      avatar.textContent = unlocked ? (emojiMap[rid] || '?') : '?';
      card.appendChild(avatar);

      // Name
      const name = this._el('div', 'char-name', role.name);
      card.appendChild(name);

      // Level + stats
      if (unlocked) {
        const lvl = this._el('div', 'char-level', 'Lv.' + level);
        card.appendChild(lvl);

        // Stats row: HP and ATK
        const hp = role.hpGrowth ? role.hpGrowth[lvlIdx] : 0;
        const atk = role.attackGrowth ? role.attackGrowth[lvlIdx] : 0;

        const statsRow = this._el('div', 'char-stats');
        const hpStat = this._el('span', 'cstat');
        hpStat.innerHTML = '❤️<span class="cstat-val">' + hp + '</span>';
        const atkStat = this._el('span', 'cstat');
        atkStat.innerHTML = '⚔️<span class="cstat-val">' + atk + '</span>';
        statsRow.appendChild(hpStat);
        statsRow.appendChild(atkStat);
        card.appendChild(statsRow);

        // Skill
        const skillDef = GameData.SKILLS[role.skill];
        if (skillDef) {
          const skillLvl = role.skillLevels ? role.skillLevels[lvlIdx] : 1;
          const skillLabel = this._el('div', 'char-skill', skillDef.name + ' Lv.' + skillLvl);
          card.appendChild(skillLabel);
        }
      }

      // Lock overlay for locked chars
      if (!unlocked) {
        const lockOv = this._el('div', 'lock-overlay');
        const lockIcon = this._el('div', 'lock-icon', '🔒');
        lockOv.appendChild(lockIcon);

        if (role.unlockCondition) {
          const condRole = GameData.ROLES[role.unlockCondition.role];
          const condText = this._el('div', null,
            '解锁条件: ' + (condRole ? condRole.name : role.unlockCondition.role)
            + ' Lv.' + role.unlockCondition.level
          );
          condText.style.fontSize = '11px';
          condText.style.marginTop = '4px';
          condText.style.textAlign = 'center';
          lockOv.appendChild(condText);
        }
        card.appendChild(lockOv);
      }

      card.addEventListener('click', () => {
        if (!unlocked) return;
        this.selectedRole = rid;
        this.refreshCharacterCards();
      });

      list.appendChild(card);
    });

    // Update detail panel and action buttons
    this._refreshCharDetail();
    this._updateCharActionButtons();
  },

  _refreshCharDetail() {
    const detail = document.getElementById('char-detail');
    if (!detail) return;
    detail.innerHTML = '';
    detail.classList.remove('visible', 'flash');

    const rid = this.selectedRole;
    const role = GameData.ROLES[rid];
    const unlocked = SaveManager.isRoleUnlocked(rid);
    if (!role || !unlocked) { return; }

    detail.classList.add('visible');

    const level = SaveManager.getRoleLevel(rid);
    const lvlIdx = Math.max(0, level - 1);
    const isMaxLevel = level >= (role.upgradeCost ? role.upgradeCost.length : 10);
    const nextLvlIdx = Math.min(lvlIdx + 1, (role.hpGrowth ? role.hpGrowth.length - 1 : 0));

    const colorMap = {
      swordsman: '#4488FF', mage: '#FF4444', summoner: '#AA44FF', icemaiden: '#44DDFF'
    };
    const emojiMap = {
      swordsman: '⚔️', mage: '🔥', summoner: '💀', icemaiden: '❄️'
    };

    // Header row
    const header = this._el('div', 'cd-header');
    const avatar = this._el('div', 'cd-avatar');
    avatar.style.background = colorMap[rid] || '#888';
    avatar.textContent = emojiMap[rid] || '?';
    header.appendChild(avatar);
    const nameEl = this._el('div', 'cd-name', role.name);
    header.appendChild(nameEl);
    const lvlEl = this._el('div', 'cd-lvl', 'Lv.' + level + (isMaxLevel ? ' (MAX)' : ' / ' + role.upgradeCost.length));
    header.appendChild(lvlEl);
    detail.appendChild(header);

    // Description
    const desc = this._el('div', 'cd-desc', role.description);
    detail.appendChild(desc);

    // Stats grid with upgrade preview
    const grid = this._el('div', 'cd-stats-grid');

    const curHP = role.hpGrowth ? role.hpGrowth[lvlIdx] : 0;
    const nxtHP = role.hpGrowth ? role.hpGrowth[nextLvlIdx] : 0;
    const curATK = role.attackGrowth ? role.attackGrowth[lvlIdx] : 0;
    const nxtATK = role.attackGrowth ? role.attackGrowth[nextLvlIdx] : 0;
    const curSkLv = role.skillLevels ? role.skillLevels[lvlIdx] : 1;
    const nxtSkLv = role.skillLevels ? role.skillLevels[nextLvlIdx] : 1;

    const skillDef = GameData.SKILLS[role.skill];
    const skillName = skillDef ? skillDef.name : '?';

    const stats = [
      { label: '❤️ 生命', cur: curHP, next: nxtHP },
      { label: '⚔️ 攻击', cur: curATK, next: nxtATK },
      { label: '🗡️ ' + skillName, cur: 'Lv.' + curSkLv, next: 'Lv.' + nxtSkLv, isText: true },
      { label: '🏃 速度', cur: GameData.GAME_CONFIG.PLAYER_BASE_SPEED, next: null },
    ];

    stats.forEach(s => {
      const item = this._el('div', 'cd-stat-item');
      const label = this._el('span', 'cd-stat-label', s.label);
      item.appendChild(label);
      const val = this._el('span', 'cd-stat-val', String(s.cur));
      item.appendChild(val);

      if (!isMaxLevel && s.next !== null && s.next !== s.cur) {
        const arrow = this._el('span', 'cd-stat-arrow', '→');
        item.appendChild(arrow);
        const nextVal = this._el('span', 'cd-stat-next', String(s.next));
        item.appendChild(nextVal);
      }
      grid.appendChild(item);
    });

    detail.appendChild(grid);

    // Upgrade bar (cost + button) or max level indicator
    if (isMaxLevel) {
      const maxEl = this._el('div', 'cd-maxlevel', '已达最高等级');
      detail.appendChild(maxEl);
    } else {
      const bar = this._el('div', 'cd-upgrade-bar');
      const cost = role.upgradeCost[level];
      const costEl = this._el('div', 'cd-cost', '升级费用: ' + cost + ' 💰');
      bar.appendChild(costEl);

      const upgradeBtn = this._el('button', 'ui-btn gold-btn', '升级 Lv.' + (level + 1));
      upgradeBtn.style.padding = '8px 20px';
      upgradeBtn.style.fontSize = '14px';
      upgradeBtn.disabled = SaveManager.data.gold < cost;
      upgradeBtn.addEventListener('click', () => this.upgradeCharacter(rid));
      bar.appendChild(upgradeBtn);
      detail.appendChild(bar);
    }
  },

  _updateCharActionButtons() {
    const upgradeBtn = document.getElementById('char-upgrade-btn');
    const selectBtn = document.getElementById('char-select-btn');
    if (!upgradeBtn || !selectBtn) return;

    const unlocked = SaveManager.isRoleUnlocked(this.selectedRole);
    const level = SaveManager.getRoleLevel(this.selectedRole);
    const role = GameData.ROLES[this.selectedRole];

    selectBtn.disabled = !unlocked;

    if (unlocked && role && role.upgradeCost && level < role.upgradeCost.length) {
      const cost = role.upgradeCost[level];
      if (cost > 0) {
        upgradeBtn.textContent = '升级 (' + cost + '💰)';
        upgradeBtn.disabled = SaveManager.data.gold < cost;
        upgradeBtn.style.display = '';
      } else {
        upgradeBtn.style.display = 'none';
      }
    } else {
      upgradeBtn.textContent = '已满级';
      upgradeBtn.disabled = true;
    }
  },
  upgradeCharacter(roleId) {
    const role = GameData.ROLES[roleId];
    if (!role) return;
    const level = SaveManager.getRoleLevel(roleId);
    if (level >= role.upgradeCost.length) return;

    const cost = role.upgradeCost[level];
    if (cost <= 0) return;

    if (SaveManager.spendGold(cost)) {
      SaveManager.data.roles[roleId].level = level + 1;
      SaveManager.save();
      this.checkUnlockConditions();
      this.refreshCharacterCards();
      this._updateAllGoldDisplays();

      // Flash animation on detail panel
      const detail = document.getElementById('char-detail');
      if (detail) {
        detail.classList.remove('flash');
        // Force reflow to restart animation
        void detail.offsetWidth;
        detail.classList.add('flash');
      }
    }
  },
  checkUnlockConditions() {
    for (const rid in GameData.ROLES) {
      const role = GameData.ROLES[rid];
      if (SaveManager.isRoleUnlocked(rid)) continue;
      if (!role.unlockCondition) {
        // No condition means always unlocked
        SaveManager.data.roles[rid] = SaveManager.data.roles[rid] || { level: 1, unlocked: true };
        SaveManager.data.roles[rid].unlocked = true;
        if (SaveManager.data.roles[rid].level < 1) SaveManager.data.roles[rid].level = 1;
        continue;
      }
      const cond = role.unlockCondition;
      if (cond.role && cond.level) {
        const condLevel = SaveManager.getRoleLevel(cond.role);
        if (condLevel >= cond.level) {
          SaveManager.data.roles[rid] = SaveManager.data.roles[rid] || { level: 0, unlocked: false };
          SaveManager.data.roles[rid].unlocked = true;
          if (SaveManager.data.roles[rid].level < 1) SaveManager.data.roles[rid].level = 1;
        }
      }
    }
    SaveManager.save();
  },

  // -------------------------------------------------------------------------
  //  Talent helpers
  // -------------------------------------------------------------------------
  refreshTalentNodes() {
    const goldDisp = document.getElementById('talent-gold');
    if (goldDisp) goldDisp.textContent = this.formatGold(SaveManager.data.gold);

    const nodes = document.querySelectorAll('.talent-node');
    nodes.forEach(node => {
      const tId = node.dataset.talentId;
      const catKey = node.dataset.category;
      if (!tId || !catKey) return;

      const cat = GameData.TALENTS[catKey];
      if (!cat || !cat.talents[tId]) return;
      const t = cat.talents[tId];
      const lvl = SaveManager.getTalentLevel(tId);

      // Update pips
      const pips = node.querySelectorAll('.talent-pip');
      pips.forEach((pip, i) => {
        pip.classList.toggle('filled', i < lvl);
      });

      // Highlight if has points
      node.classList.toggle('has-points', lvl > 0);
    });
  },
  upgradeTalent(talentId) {
    // Find the talent definition
    let talentDef = null;
    for (const catKey in GameData.TALENTS) {
      const cat = GameData.TALENTS[catKey];
      if (cat.talents[talentId]) {
        talentDef = cat.talents[talentId];
        break;
      }
    }
    if (!talentDef) return;

    const lvl = SaveManager.getTalentLevel(talentId);
    if (lvl >= talentDef.levels.length) return; // max level

    const cost = talentDef.levels[lvl].cost;
    if (SaveManager.spendGold(cost)) {
      SaveManager.data.talents[talentId] = lvl + 1;
      SaveManager.save();
      this.refreshTalentNodes();
      this._updateAllGoldDisplays();
      // Refresh popup if open
      this._closeTalentPopup();
    }
  },

  _showTalentPopup(talentId, catKey) {
    const cat = GameData.TALENTS[catKey];
    if (!cat || !cat.talents[talentId]) return;
    const t = cat.talents[talentId];
    const lvl = SaveManager.getTalentLevel(talentId);

    const popup = this._talentPopup;
    popup.innerHTML = '';

    const nameEl = this._el('div', 'tp-name', t.name);
    popup.appendChild(nameEl);

    const descEl = this._el('div', 'tp-desc', t.description);
    popup.appendChild(descEl);

    // Current effect
    if (lvl > 0) {
      const curr = this._el('div', 'tp-effect', '当前效果: +' + t.levels[lvl - 1].bonus);
      popup.appendChild(curr);
    }

    // Next level effect
    if (lvl < t.levels.length) {
      const next = this._el('div', 'tp-effect', '下一级: +' + t.levels[lvl].bonus);
      popup.appendChild(next);

      const cost = this._el('div', 'tp-cost', '费用: ' + t.levels[lvl].cost + ' 💰');
      popup.appendChild(cost);

      const upgradeBtn = this._el('button', 'ui-btn gold-btn', '升级');
      upgradeBtn.style.marginTop = '12px';
      upgradeBtn.disabled = SaveManager.data.gold < t.levels[lvl].cost;
      upgradeBtn.addEventListener('click', () => this.upgradeTalent(talentId));
      popup.appendChild(upgradeBtn);
    } else {
      const maxEl = this._el('div', 'tp-effect', '已满级');
      maxEl.style.color = '#f1c40f';
      popup.appendChild(maxEl);
    }

    this._talentPopupBackdrop.style.display = 'block';
    popup.style.display = 'block';
  },

  _closeTalentPopup() {
    if (this._talentPopupBackdrop) this._talentPopupBackdrop.style.display = 'none';
    if (this._talentPopup) this._talentPopup.style.display = 'none';
  },

  // -------------------------------------------------------------------------
  //  Level up overlay
  // -------------------------------------------------------------------------
  showLevelUpChoices(choices) {
    const container = document.getElementById('levelup-choices');
    if (!container) return;
    container.innerHTML = '';

    const skillIcons = {
      flying_sword: '🗡️', fireball: '🔥', ice_ring: '❄️',
      lightning: '⚡', whirlwind: '🌀', summon: '💀',
      poison_cloud: '☠️', shield_orb: '🛡️'
    };

    choices.forEach(choice => {
      const card = this._el('div', 'levelup-card');

      // Determine icon and display info
      let icon = '';
      let name = '';
      let desc = '';
      let levelText = '';
      let rarity = 'common';

      if (choice.type === 'passive') {
        const pDef = GameData.PASSIVE_SKILLS[choice.id];
        icon = pDef ? pDef.icon : '◆';
        name = pDef ? pDef.name : choice.id;
        desc = pDef ? pDef.description : '';
        const currentLvl = choice.currentLevel || 0;
        levelText = 'Lv.' + currentLvl + ' → Lv.' + (currentLvl + 1);
        // Show numeric bonus
        if (pDef && pDef.bonusPerLevel) {
          const pct = Math.round(pDef.bonusPerLevel * 100);
          desc += ` (+${pct}%/级)`;
        }
      } else {
        // skill_upgrade or skill_new
        const sDef = GameData.SKILLS[choice.id];
        icon = skillIcons[choice.id] || '✦';
        name = sDef ? sDef.name : choice.id;
        rarity = (sDef && sDef.rarity) || 'common';
        if (choice.type === 'skill_new') {
          desc = sDef ? sDef.description : '';
          levelText = '新技能!';
        } else {
          const currentLvl = choice.currentLevel || 0;
          // Show evolution description when upgrading to level 5
          if (currentLvl === 4 && sDef && sDef.evolveDescription) {
            desc = sDef.evolveDescription;
            levelText = 'Lv.4 → Lv.5 进化!';
            rarity = 'epic';
          } else {
            desc = sDef ? sDef.description : '';
            levelText = 'Lv.' + currentLvl + ' → Lv.' + (currentLvl + 1);
            // Show damage info
            if (sDef && sDef.baseDamage) {
              const dmgNow = Math.round(sDef.baseDamage * (1 + (currentLvl - 1) * 0.3));
              const dmgNext = Math.round(sDef.baseDamage * (1 + currentLvl * 0.3));
              desc += ` (${dmgNow}→${dmgNext})`;
            }
          }
        }
      }

      const iconEl = this._el('div', 'lc-icon', icon);
      const nameEl = this._el('div', 'lc-name', name);
      const descEl = this._el('div', 'lc-desc', desc);
      const lvlEl = this._el('div', 'lc-level', levelText);

      // Apply rarity colors
      const rarityColors = {
        common: { border: 'rgba(255,255,255,0.15)', glow: 'none', nameColor: '#fff' },
        rare: { border: '#5588FF', glow: '0 0 12px rgba(85,136,255,0.3)', nameColor: '#88BBFF' },
        epic: { border: '#f1c40f', glow: '0 0 16px rgba(241,196,15,0.4)', nameColor: '#f1c40f' },
      };
      const rc = rarityColors[rarity] || rarityColors.common;
      card.style.borderColor = rc.border;
      if (rc.glow !== 'none') card.style.boxShadow = rc.glow;
      nameEl.style.color = rc.nameColor;

      // New skill badge
      if (levelText === '新技能!') {
        lvlEl.style.color = rarity === 'rare' ? '#88BBFF' : '#2ecc71';
        lvlEl.style.fontWeight = 'bold';
      }

      // Highlight evolution cards
      if (levelText.includes('进化')) {
        card.style.borderColor = '#f1c40f';
        card.style.boxShadow = '0 0 16px rgba(241,196,15,0.4)';
        lvlEl.style.color = '#f1c40f';
        lvlEl.style.fontWeight = 'bold';
      }

      card.appendChild(iconEl);
      card.appendChild(nameEl);
      card.appendChild(descEl);
      card.appendChild(lvlEl);

      card.addEventListener('click', () => {
        this.hideOverlay('levelup');
        if (typeof GameEngine !== 'undefined') {
          GameEngine.applyLevelUpChoice(choice);
        }
      });

      container.appendChild(card);
    });

    this.showOverlay('levelup');
  },

  // -------------------------------------------------------------------------
  //  Pause overlay
  // -------------------------------------------------------------------------
  showPauseOverlay() {
    if (typeof GameEngine !== 'undefined') {
      GameEngine.state = 'paused';
      GameEngine.stop();
    }
    this.showOverlay('pause');
  },

  // -------------------------------------------------------------------------
  //  Game over
  // -------------------------------------------------------------------------
  showGameOverScreen(stats, isVictory) {
    if (typeof GameEngine !== 'undefined') {
      GameEngine.stop();
    }

    const titleEl = document.getElementById('gameover-title');
    const statsEl = document.getElementById('gameover-stats');
    const goldEl = document.getElementById('gameover-gold');
    const doubleBtn = document.getElementById('gameover-double-btn');

    if (titleEl) {
      titleEl.textContent = isVictory ? '通关!' : '阵亡!';
      titleEl.className = 'gameover-title ' + (isVictory ? 'victory' : 'defeat');
    }

    // Compute gold earned
    const kills = (stats && stats.kills) || 0;
    const time = (stats && stats.time) || 0;
    const playerLevel = (stats && stats.level) || 1;
    const fortuneBonus = SaveManager.getFortuneBonus();
    const goldEarned = Math.floor(
      GameData.GAME_CONFIG.GOLD_PER_GAME_BASE
      + kills * 0.5
      + fortuneBonus * playerLevel
    );

    // Add gold to save
    SaveManager.addGold(goldEarned);

    // Update stats
    SaveManager.data.stats.totalGames++;
    SaveManager.data.stats.totalKills += kills;
    if (time > SaveManager.data.stats.bestTime) {
      SaveManager.data.stats.bestTime = time;
    }
    SaveManager.save();

    // Check unlock conditions (maybe leveled up enough)
    this.checkUnlockConditions();

    // Display stats
    if (statsEl) {
      statsEl.innerHTML = '';
      const waveText = (stats && stats.waveIndex)
        ? `${stats.waveIndex} / ${stats.totalWaves || 17}`
        : '-';
      const rows = [
        ['存活时间', this.formatTime(time)],
        ['击杀数', String(kills)],
        ['到达等级', 'Lv.' + playerLevel],
        ['到达波次', waveText],
        ['累计击杀', String(SaveManager.data.stats.totalKills)],
        ['最佳时间', this.formatTime(SaveManager.data.stats.bestTime)],
      ];
      rows.forEach(([label, value]) => {
        const row = this._el('div', 'stat-row');
        row.appendChild(this._el('span', 'stat-label', label));
        row.appendChild(this._el('span', 'stat-value', value));
        statsEl.appendChild(row);
      });
    }

    if (goldEl) {
      goldEl.textContent = '获得金币: ' + goldEarned + ' 💰';
    }

    // Reset double button
    if (doubleBtn) {
      doubleBtn.disabled = false;
      doubleBtn.textContent = '💰 金币翻倍';
      // Store earned gold for potential doubling
      doubleBtn._goldEarned = goldEarned;
      doubleBtn.onclick = () => {
        SaveManager.addGold(goldEarned);
        doubleBtn.disabled = true;
        doubleBtn.textContent = '已领取';
        if (goldEl) goldEl.textContent = '获得金币: ' + (goldEarned * 2) + ' 💰';
        this._updateAllGoldDisplays();
      };
    }

    this.showOverlay('gameover');
  },

  // -------------------------------------------------------------------------
  //  Game flow
  // -------------------------------------------------------------------------
  startGame() {
    if (!SaveManager.isRoleUnlocked(this.selectedRole)) return;

    // Compute talent bonuses and apply to engine before starting
    const bonuses = SaveManager.getTalentBonuses();
    const roleData = GameData.ROLES[this.selectedRole];
    const roleLevel = SaveManager.getRoleLevel(this.selectedRole);
    const roleLevelIdx = Math.max(0, roleLevel - 1);

    // Hide UI screens
    this.showScreen(null);
    // Actually hide all screens (showScreen(null) won't match anything)
    const all = this._uiLayer.querySelectorAll('.screen, .overlay');
    all.forEach(el => el.classList.remove('active'));

    if (typeof GameEngine !== 'undefined') {
      GameEngine.startGame(this.selectedRole, this.selectedMap);

      // Apply talent bonuses to player after creation
      const p = GameEngine.player;
      if (p) {
        // Apply role level scaling FIRST (base stats)
        if (roleData) {
          const hp = roleData.hpGrowth ? roleData.hpGrowth[roleLevelIdx] : 0;
          const atk = roleData.attackGrowth ? roleData.attackGrowth[roleLevelIdx] : 0;
          if (hp) { p.maxHp = hp; p.hp = hp; }
          if (atk) { p.attack = atk; }

          // Set initial skill level based on character level
          const skillLevel = roleData.skillLevels ? roleData.skillLevels[roleLevelIdx] : 1;
          if (p.skills.length > 0 && skillLevel > 1) {
            p.skills[0].level = skillLevel;
            if (skillLevel >= 5) p.skills[0].evolved = true;
          }
        }

        // Attack talents (applied on top of base stats)
        p.damageMultiplier += bonuses.attack_power || 0;
        p.critRate += bonuses.critical_rate || 0;
        p.critDamage += bonuses.critical_damage || 0;

        // Defense talents
        const toughnessBonus = bonuses.toughness || 0;
        p.maxHp += toughnessBonus;
        p.hp += toughnessBonus;
        p.regenBonus = bonuses.regen || 0;
        p.invincibleBonus = bonuses.invincible || 0;

        // Growth talents
        p.expMultiplier = 1 + (bonuses.wisdom || 0);
        p.pickupRange += bonuses.magnet || 0;
      }
    }
  },
  endGame(stats) {
    const isVictory = stats && stats.victory;
    this.showGameOverScreen(stats, isVictory);
  },

  // -------------------------------------------------------------------------
  //  Utility
  // -------------------------------------------------------------------------
  formatGold(amount) {
    if (amount >= 10000) return (amount / 10000).toFixed(1) + '万';
    return String(amount);
  },

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  },

  createParticleBackground(container) {
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = 2 + Math.random() * 4;
      p.style.cssText = `
        width:${size}px; height:${size}px;
        left:${Math.random()*100}%; bottom:${-10 - Math.random()*20}%;
        background: rgba(${Math.random()>0.5?'231,76,60':'241,196,15'},${0.3+Math.random()*0.4});
        animation-duration: ${8+Math.random()*12}s;
        animation-delay: ${Math.random()*10}s;
      `;
      container.appendChild(p);
    }
  },

  _el(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  },

  _updateAllGoldDisplays() {
    const goldStr = this.formatGold(SaveManager.data.gold);
    ['menu-gold', 'char-gold', 'talent-gold'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = goldStr;
    });
  }
};

// =============================================================================
//  Auto-init when DOM ready
// =============================================================================
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GameUI.init());
  } else {
    GameUI.init();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SaveManager, GameUI };
}
