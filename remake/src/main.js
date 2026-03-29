import { Engine } from './engine.js';
import { LogoScene } from './scenes/logo.js';
import { MainMenuScene } from './scenes/mainmenu.js';
import { IntroScene } from './scenes/intro.js';
import { GameScene } from './scenes/game-scene.js';

async function main() {
  const canvas = document.getElementById('screen');
  const engine = new Engine(canvas);

  // Determine starting scene from URL hash (supports #intro-spymastr etc.)
  const fullHash = location.hash.replace('#', '') || 'logo';
  const startScene = fullHash.split('-')[0];
  const subScene = fullHash.split('-')[1] || null;

  // Preload scenes on demand
  const scenes = {};

  async function getScene(name) {
    if (scenes[name]) return scenes[name];
    let scene;
    switch (name) {
      case 'logo':
        scene = new LogoScene();
        break;
      case 'menu':
        scene = new MainMenuScene();
        break;
      case 'intro':
        scene = new IntroScene();
        break;
      case 'airport':
        scene = new GameScene('airport');
        break;
      default:
        console.warn(`Unknown scene: ${name}`);
        return null;
    }
    await scene.load(engine);
    scenes[name] = scene;
    return scene;
  }

  async function showScene(name, preserveHash) {
    if (!preserveHash) location.hash = name;
    const scene = await getScene(name);
    if (!scene) return;
    engine.setScene(scene);
    return scene;
  }

  // Preload initial scene chain
  if (startScene === 'logo' || startScene === 'menu') {
    await getScene('logo');
    await getScene('menu');
  }
  if (startScene === 'intro') {
    await getScene('intro');
  }

  // Scene flow
  const logo = await getScene('logo');
  logo.onDone = async () => { await showScene('menu'); };

  const menu = await getScene('menu');
  menu.onButton = async (name) => {
    if (name === 'intro') {
      const intro = await showScene('intro');
      intro.onDone = async () => { await showScene('menu'); };
    } else if (name === 'play') {
      await showScene('airport');
    }
  };

  // Start (preserve hash for sub-scene routing like #intro-spymastr)
  await showScene(startScene, true);
  engine.start();
}

main().catch(err => {
  console.error('Engine failed to start:', err);
  document.body.style.color = '#f00';
  document.body.textContent = `Error: ${err.message}`;
});
