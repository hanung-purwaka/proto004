# proto004

Phaser + Vite starter project for a browser game.

## Commands

```bash
npm install
npm run dev
npm run build
```

## What goes to GitHub

- `package.json`
- `package-lock.json`
- `index.html`
- `src/`
- `public/`
- `.gitignore`
- `README.md`

## What does not go to GitHub

- `node_modules/`
- `dist/`

## Current structure

- `src/main.js` creates the page shell and starts Phaser.
- `src/game/config.js` holds the Phaser game config.
- `src/scenes/BootScene.js` creates generated starter textures.
- `src/scenes/GameScene.js` contains the first playable scene.
