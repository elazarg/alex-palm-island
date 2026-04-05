import { Engine, WIDTH, HEIGHT } from './core/engine.js';
import { SceneManager } from './core/scene-manager.js';

async function main() {
  const viewport = document.getElementById('viewport');
  const canvas = document.getElementById('screen');
  const overlayCanvas = document.getElementById('overlay');
  const syncViewportSize = () => {
    if (!viewport) return;
    const styles = getComputedStyle(document.documentElement);
    const offsetX = parseFloat(styles.getPropertyValue('--canvas-offset-x')) || 0;
    const maxWidth = Math.max(WIDTH, window.innerWidth - offsetX);
    const maxHeight = Math.max(HEIGHT, window.innerHeight);
    const width = Math.floor(Math.min(maxWidth, maxHeight * (WIDTH / HEIGHT)));
    const height = Math.floor(width * (HEIGHT / WIDTH));
    viewport.style.width = `${width}px`;
    viewport.style.height = `${height}px`;
  };
  syncViewportSize();
  window.addEventListener('resize', syncViewportSize);
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
