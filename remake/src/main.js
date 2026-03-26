import { Engine } from './engine.js';
import { LogoScene } from './scenes/logo.js';

async function main() {
  const canvas = document.getElementById('screen');
  const engine = new Engine(canvas);

  const logo = new LogoScene();
  await logo.load(engine);
  engine.setScene(logo);
  engine.start();
}

main().catch(err => {
  console.error('Engine failed to start:', err);
  document.body.style.color = '#f00';
  document.body.textContent = `Error: ${err.message}`;
});
