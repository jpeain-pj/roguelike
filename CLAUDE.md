# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a roguelike survivor H5 canvas game called "咒印小英雄" (Spell Hero). It's a Chinese-language mobile-friendly game featuring character progression, talent trees, and survival gameplay.

## Architecture

The game consists of three main JavaScript modules:

1. **data.js** - Contains all game configuration data including:
   - Game constants and configurations
   - Character definitions (roles, stats, upgrade costs)
   - Skill definitions and properties
   - Passive abilities
   - Talent trees organized by category (attack, defense, growth)
   - Enemy definitions and stats
   - Wave spawning configurations

2. **engine.js** - Core game engine handling:
   - Game state management (menu, playing, paused, levelup, gameover, victory)
   - Canvas rendering and camera system
   - Entity management (player, enemies, projectiles, particles)
   - Physics and collision detection
   - Input handling (touch/mouse controls)
   - Spawning system and wave management
   - Skill/projectile system with various types (linear, homing, orbital, etc.)

3. **ui.js** - User interface system managing:
   - Screen navigation (menu, character selection, talents, settings)
   - Save/load system using localStorage
   - Level up choice UI
   - Game over/victory screens
   - Dynamic UI updates (gold, talents, character stats)

## File Structure

- `index.html` - Main entry point with canvas and UI layer
- `style.css` - Complete styling with responsive design for mobile
- `data.js` - Game configuration data
- `engine.js` - Core game engine
- `ui.js` - User interface and state management

## Development Guidelines

### Running the Game
- Simply open `index.html` in a browser - no build step required
- The game is designed for mobile touch controls but works on desktop too

### Key Game Systems
- Character progression: Characters gain levels through XP orbs and can be upgraded with gold
- Talent tree: Three categories (attack, defense, growth) with upgradeable nodes
- Skill system: Active skills with cooldowns and passive abilities
- Wave-based enemy spawning with increasing difficulty

### Modifying Game Content
- Adjust game balance by changing values in `data.js`
- Add new characters by extending the `ROLES` object in `data.js`
- Add new skills by extending the `SKILLS` object in `data.js`
- Modify UI by adjusting CSS in `style.css` or HTML/CSS in `ui.js`

### Mobile Optimization
- The game uses touch event handling with prevention of default behaviors
- Responsive CSS with media queries for different screen sizes
- Optimized for mobile with viewport settings and touch controls

## Important Notes

- Game data is stored in localStorage with the key 'spell_hero_save'
- Canvas uses a world coordinate system with camera offset for rendering
- Entity pooling is used for performance optimization
- The game includes a complete save system with character progression
- Screen shake effects and particle systems enhance visual feedback