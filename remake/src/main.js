import { Engine } from './core/engine.js';
import { ArrestScene } from './scenes/arrest/scene.js';
import { AirportScene } from './scenes/airport/scene.js';
import { LogoScene } from './scenes/logo.js';
import { MainMenuScene } from './scenes/main-menu.js';
import { IntroScene } from './scenes/intro.js';
import { PrisonScene } from './scenes/prison/scene.js';

function parseHashRoute() {
  const raw = location.hash.replace('#', '') || 'logo';
  const [name, arg] = raw.split('-', 2);
  if (name === 'arrest' || name === 'prison') {
    const reasonCode = Number(arg);
    return { name, reasonCode: Number.isFinite(reasonCode) ? reasonCode : 503 };
  }
  return { name };
}

function formatHashRoute(name, options = {}) {
  if ((name === 'arrest' || name === 'prison') && Number.isFinite(options.reasonCode)) {
    return `${name}-${options.reasonCode}`;
  }
  return name;
}

async function main() {
  const canvas = document.getElementById('screen');
  const engine = new Engine(canvas);
  const search = new URLSearchParams(location.search);
  const previewScene = search.get('scene') || 'airport';
  const previewDialogId = search.get('dialog');
  const startFromDialogPreview = Boolean(previewDialogId);
  const startRoute = parseHashRoute();
  const startScene = startFromDialogPreview ? previewScene : startRoute.name;
  const scenes = {};

  function getSceneCacheKey(name, options = {}) {
    if (options.previewDialogId) return `${name}:dialog:${options.previewDialogId}`;
    if (Number.isFinite(options.reasonCode)) return `${name}:${options.reasonCode}`;
    return name;
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
      case 'arrest':
        return new ArrestScene({ reasonCode: options.reasonCode });
      case 'prison':
        return new PrisonScene({ reasonCode: options.reasonCode });
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
    const { preserveHash = false, previewDialogId = null, reasonCode = null } = options;
    if (!preserveHash) location.hash = formatHashRoute(name, { reasonCode });
    const scene = await getScene(name, { previewDialogId, reasonCode });
    if (!scene) return null;
    if (name === 'airport') {
      scene.onTransition = async (target) => {
        if (!target?.scene) return;
        await showScene(target.scene, { reasonCode: target.reasonCode ?? null });
      };
    }
    if (name === 'arrest') {
      scene.reasonCode = reasonCode ?? scene.reasonCode;
      scene.onDone = async (target) => {
        if (!target?.scene) return;
        await showScene(target.scene, { reasonCode: target.reasonCode ?? scene.reasonCode });
      };
    }
    if (name === 'prison') {
      scene.reasonCode = reasonCode ?? scene.reasonCode;
      scene.onDone = async (target) => {
        if (!target?.scene) return;
        await showScene(target.scene, { reasonCode: target.reasonCode ?? null });
      };
    }
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
    reasonCode: startFromDialogPreview ? null : startRoute.reasonCode ?? null,
  });
  engine.start();
}

main().catch((err) => {
  console.error('Engine failed to start:', err);
  document.body.style.color = '#f00';
  document.body.textContent = `Error: ${err.message}`;
});
