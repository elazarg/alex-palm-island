import { Engine } from './core/engine.js';
import { AirportScene } from './scenes/airport/scene.js';

async function main() {
  const canvas = document.getElementById('screen');
  const engine = new Engine(canvas);
  const search = new URLSearchParams(location.search);
  const previewDialogId = search.get('dialog');

  const airport = new AirportScene({ previewDialogId });
  await airport.load(engine);
  engine.setScene(airport);
  engine.start();
}

main().catch((err) => {
  console.error('Engine failed to start:', err);
  document.body.style.color = '#f00';
  document.body.textContent = `Error: ${err.message}`;
});
