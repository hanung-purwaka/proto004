import Phaser from 'phaser'
import './style.css'
import { gameConfig } from './game/config.js'

document.querySelector('#app').innerHTML = `
  <main class="layout">
    <section class="intro">
      <p class="eyebrow">Phaser + Vite starter</p>
      <h1>proto004</h1>
      <p class="summary">
        This project is ready for AI-driven game building. The canvas on the right is a live
        Phaser scene, not a placeholder web page.
      </p>
      <ul class="checklist">
        <li>Local project dependencies are installed in <code>node_modules/</code>.</li>
        <li>Only source files and lockfiles belong in GitHub.</li>
        <li>Run <code>npm run dev</code> to keep building from here.</li>
      </ul>
    </section>
    <section class="stage-shell">
      <div class="stage-meta">
        <div>
          <p class="label">Current scene</p>
          <strong>Playable starter</strong>
        </div>
        <div>
          <p class="label">Controls</p>
          <strong>Arrow keys or WASD</strong>
        </div>
      </div>
      <div id="game-container" class="game-container" aria-label="Game canvas"></div>
    </section>
  </main>
`

new Phaser.Game(gameConfig)
