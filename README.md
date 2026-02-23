# Seinfeld Mini Games

A collection of Seinfeld-themed mini-games built with [Phaser 3](https://phaser.io/) and [Vite](https://vitejs.dev/).

## Games

| Game | Description |
|------|-------------|
| **The Contest** | A reflex/timing game — test your self-control by resisting distractions |
| **Marble Rye** | A stealth/platformer — snag the bread and sneak it past the old lady |
| **The Soup Nazi** | An order management game — get your soup without breaking protocol |
| **Parking Garage** | A maze/navigation game — find your car before time runs out |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Preview the production build locally |

## Project Structure

```
src/
├── main.js                          # Phaser game config & entry point
├── scenes/
│   ├── BootScene.js                 # Asset preloading
│   └── MenuScene.js                 # Game selection menu
└── games/
    ├── the-contest/
    │   └── ContestScene.js          # The Contest mini-game
    ├── marble-rye/
    │   └── MarbleRyeScene.js        # Marble Rye mini-game
    ├── soup-nazi/
    │   └── SoupNaziScene.js         # The Soup Nazi mini-game
    └── parking-garage/
        └── ParkingGarageScene.js    # Parking Garage mini-game
public/
└── assets/                          # Static assets (images, audio, fonts)
    └── games/                       # Per-game asset directories
```

## Tech Stack

- **Phaser 3** — HTML5 game framework
- **Vite** — Fast dev server & bundler
- **Arcade Physics** — Lightweight physics engine (included with Phaser)