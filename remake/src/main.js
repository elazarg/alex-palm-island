import { Engine } from './core/engine.js';
import { AirportScene } from './scenes/airport/scene.js';
import { LogoScene } from './scenes/logo.js';
import { MainMenuScene } from './scenes/main-menu.js';
import { IntroScene } from './scenes/intro.js';

async function main() {
  const canvas = document.getElementById('screen');
  const engine = new Engine(canvas);
  const search = new URLSearchParams(location.search);
  const previewScene = search.get('scene') || 'airport';
  const previewDialogId = search.get('dialog');
  const startFromDialogPreview = Boolean(previewDialogId);
  const fullHash = location.hash.replace('#', '') || 'logo';
  const startScene = startFromDialogPreview ? previewScene : fullHash.split('-')[0];
  const scenes = {};

  function getSceneCacheKey(name, options = {}) {
    return options.previewDialogId ? `${name}:dialog:${options.previewDialogId}` : name;
  }

  function createScene(name, options = {}) {
    switch (name) {
      case 'logo':
        return new LogoScene();
      case 'menu':
        return new MainMenuScene();
      case 'intro':
        return new IntroScene();
      case 'airport':
        return new AirportScene({
          previewDialogId: options.previewDialogId || null,
        });
      default:
        console.warn(`Unknown scene: ${name}`);
        return null;
    }
  }

  async function getScene(name, options = {}) {
    const cacheKey = getSceneCacheKey(name, options);
    if (scenes[cacheKey]) return scenes[cacheKey];
    const scene = createScene(name, options);
    if (!scene) return null;
    await scene.load(engine);
    scenes[cacheKey] = scene;
    return scene;
  }

  async function showScene(name, options = {}) {
    const { preserveHash = false, previewDialogId = null } = options;
    if (!preserveHash) location.hash = name;
    const scene = await getScene(name, { previewDialogId });
    if (!scene) return null;
    engine.setScene(scene);
    return scene;
  }

  if (startScene === 'logo' || startScene === 'menu') {
    await getScene('logo');
    await getScene('menu');
  }
  if (startScene === 'intro') {
    await getScene('intro');
  }

  const logo = await getScene('logo');
  logo.onDone = async () => { await showScene('menu'); };

  const intro = await getScene('intro');
  intro.onDone = async () => { await showScene('airport'); };

  const menu = await getScene('menu');
  menu.onButton = async (name) => {
    if (name === 'intro') {
      await showScene('intro');
    } else if (name === 'play') {
      await showScene('airport');
    }
  };

  await showScene(startScene, {
    preserveHash: true,
    previewDialogId: startFromDialogPreview && startScene === previewScene ? previewDialogId : null,
  });
  engine.start();
}

main().catch((err) => {
  console.error('Engine failed to start:', err);
  document.body.style.color = '#f00';
  document.body.textContent = `Error: ${err.message}`;
});
