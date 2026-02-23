# Copilot Instructions

## Project Summary

A collection of Seinfeld-themed mini-games built with **Phaser 3** and **Vite**. Each game is a self-contained Phaser `Scene` that plugs into a shared menu. The project is deployed as a static site to GitHub Pages.

## Tech Stack

- **Language**: JavaScript (ES modules, no TypeScript)
- **Game framework**: Phaser 3 (`phaser` npm package)
- **Bundler / dev server**: Vite 7
- **Node version**: 22 (matches CI)
- **No linter, no test runner** — only build validation matters

## Bootstrap & Build

Always run `npm install` (or `npm ci` in CI) before building.

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server at http://localhost:3000 (opens browser)
npm run build        # production build → dist/
npm run preview      # serve the production build locally
```

There are no tests. The only validation is that `npm run build` (or `npx vite build`) succeeds without errors.

## CI / CD

`.github/workflows/deploy.yml` runs on every push to `main`:

1. `npm ci`
2. `npx vite build`
3. Uploads `dist/` as a GitHub Pages artifact and deploys it.

A pull request is considered valid when `npm run build` succeeds locally (mirrors CI exactly).

## Project Layout

```
.github/
  workflows/deploy.yml    # GitHub Pages deploy pipeline
public/
  assets/
    audio/seinfeld.mp3    # Theme music loaded by BootScene
    games/<name>/         # Per-game static assets (images, audio, etc.)
src/
  main.js                 # Phaser game config & scene registry (ENTRY POINT)
  scenes/
    BootScene.js          # Preloads shared assets, then starts MenuScene
    MenuScene.js          # Main menu; contains the GAMES list shown to players
  games/
    frogger/FroggerScene.js
    hole-in-one/HoleInOneScene.js
    laser-pointer/LaserPointerScene.js
    parking-garage/
      ParkingGarageScene.js
      MazeGenerator.js
      SecurityGuard.js
      Characters.js
    rye-match3/RyeMatch3Scene.js
    soup-nazi/SoupNaziScene.js
index.html                # Single HTML page; mounts #game-container
vite.config.js            # base: './', outDir: 'dist', devServer port 3000
package.json
```

## Adding a New Game

1. Create `src/games/<kebab-name>/<PascalName>Scene.js` — a class extending `Phaser.Scene` with `super({ key: '<PascalName>Scene' })`.
2. Import it in `src/main.js` and add it to the `scene` array in the Phaser config.
3. Add an entry to the `GAMES` array at the top of `src/scenes/MenuScene.js`:
   ```js
   { key: '<PascalName>Scene', title: 'Display Title', description: 'Short description' }
   ```
4. Place any static assets in `public/assets/games/<kebab-name>/` — reference them in `preload()` as `'assets/games/<kebab-name>/file.ext'`.

## Key Conventions

- All scenes call `ensureThemePlaying(this)` from `BootScene.js` inside `create()` to handle browser autoplay restrictions.
- Phaser config: `width: 800`, `height: 600`, `backgroundColor: '#1a1a2e'`, arcade physics with no gravity.
- Assets are loaded relative to `public/` (Vite serves `public/` at the root). Use paths like `'assets/audio/seinfeld.mp3'`.
- The `vite.config.js` sets `base: './'` so the built site works when hosted at a sub-path (GitHub Pages).
- No TypeScript, no ESLint config — keep code in plain JavaScript ES module style matching existing files.
