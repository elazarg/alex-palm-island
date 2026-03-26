import { Engine } from './engine.js';
import { LogoScene } from './scenes/logo.js';
import { MainMenuScene } from './scenes/mainmenu.js';

async function main() {
  const canvas = document.getElementById('screen');
  const engine = new Engine(canvas);

  // Determine starting scene from URL hash: #menu, #logo (default)
  const startScene = location.hash.replace('#', '') || 'logo';

  // Preload all scenes
  const logo = new LogoScene();
  await logo.load(engine);

  const menu = new MainMenuScene();
  await menu.load(engine);

  function showMenu() {
    location.hash = 'menu';
    engine.setScene(menu);
    menu.onButton = (name) => {
      console.log(`Button pressed: ${name}`);
    };
  }

  logo.onDone = showMenu;

  if (startScene === 'menu') {
    showMenu();
  } else {
    engine.setScene(logo);
  }

  engine.start();
}

main().catch(err => {
  console.error('Engine failed to start:', err);
  document.body.style.color = '#f00';
  document.body.textContent = `Error: ${err.message}`;
});
