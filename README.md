# Seinfeld Games

A browser-based collection of Seinfeld mini games built with [Phaser 3](https://phaser.io/) and [Vite](https://vitejs.dev/).

## Mini Games

| Game | Description |
|------|-------------|
| **No Soup For You!** | Follow the Soup Nazi's strict ordering rules — one wrong move and it's no soup for you! |
| **Feats of Strength** | Festivus isn't over until you pin George! Mash the button to fill your strength meter before time runs out. |
| **Yada Yada Yada** | Fill in the blanks — Elaine skipped the details. Can you guess what she left out? |

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for Production

```bash
npm run build
```

The output will be in the `dist/` directory.

## Adding a New Game

1. Create a new file in `src/games/MyGame.js` that `export default`s a Phaser `Scene`.
2. Import it in `src/main.js` and add it to the `scene` array in the Phaser config.
3. Add an entry to the `GAMES` array in `src/scenes/MainMenu.js` with the scene key, label, and description.

Each game scene is fully self-contained — multiple developers can work on different games in parallel without conflicts.

## Project Structure

```
seinfeld-games/
├── index.html              # Entry point
├── vite.config.js          # Vite configuration
├── src/
│   ├── main.js             # Phaser game config & scene registration
│   ├── scenes/
│   │   └── MainMenu.js     # Main menu scene
│   └── games/
│       ├── NoSoupForYou.js # Game 1 — No Soup For You!
│       ├── FestivusFeats.js# Game 2 — Feats of Strength
│       └── YadaYada.js     # Game 3 — Yada Yada Yada
└── public/                 # Static assets (images, audio, etc.)
```
