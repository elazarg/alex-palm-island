import { Engine } from './core/engine.js';
import { SceneManager } from './core/scene-manager.js';

async function main() {
  const canvas = document.getElementById('screen');
  const overlayCanvas = document.getElementById('overlay');
  const engine = new Engine(canvas, overlayCanvas);
  const sceneManager = new SceneManager(engine);
  await sceneManager.start();
  engine.start();
}

main().catch((err) => {
  console.error('Engine failed to start:', err);
  document.body.style.color = '#f00';
  document.body.textContent = `Error: ${err.message}`;
});
