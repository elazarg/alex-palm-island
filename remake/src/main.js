import { Engine } from './core/engine.js';
import { formatRouteHash, parseRouteHash, routeCacheKey } from './core/router.js';
import { ArrestScene } from './scenes/arrest/scene.js';
import { AirportScene } from './scenes/airport/scene.js';
import { IntroScene } from './scenes/intro.js';
import { LogoScene } from './scenes/logo.js';
import { MainMenuScene } from './scenes/main-menu.js';
import { PrisonScene } from './scenes/prison/scene.js';

async function main() {
  const canvas = document.getElementById('screen');
  const engine = new Engine(canvas);
  const scenes = new Map();
  let currentRouteHash = null;

  function createScene(route) {
    switch (route.scene) {
      case 'logo':
        return new LogoScene();
      case 'menu':
        return new MainMenuScene();
      case 'intro':
        return new IntroScene({ startPart: route.part || null });
      case 'airport':
        return new AirportScene({
          view: route.view || 'scene',
          dialogId: route.dialogId || null,
          formId: route.formId || null,
          resourceSectionId: route.resourceSectionId ?? null,
          stateOverrides: route.state || {},
        });
      case 'arrest':
        return new ArrestScene({ reasonCode: route.reasonCode });
      case 'prison':
        return new PrisonScene({ reasonCode: route.reasonCode });
      default:
        console.warn(`Unknown route scene: ${route.scene}`);
        return null;
    }
  }

  async function getScene(route) {
    const key = routeCacheKey(route);
    if (scenes.has(key)) return scenes.get(key);
    const scene = createScene(route);
    if (!scene) return null;
    await scene.load(engine);
    scenes.set(key, scene);
    return scene;
  }

  async function openRoute(route, { updateUrl = true, replace = false } = {}) {
    const hash = formatRouteHash(route);
    currentRouteHash = hash;
    if (updateUrl) {
      if (replace) history.replaceState(null, '', hash);
      else if (location.hash !== hash) location.hash = hash;
    }

    const scene = await getScene(route);
    if (!scene) return null;

    if (route.scene === 'logo') {
      scene.onDone = async () => { await openRoute({ scene: 'menu' }, { replace: true }); };
    }
    if (route.scene === 'menu') {
      scene.onButton = async (name) => {
        if (name === 'intro') await openRoute({ scene: 'intro' });
        else if (name === 'play') await openRoute({ scene: 'airport', view: 'scene', state: {} });
      };
    }
    if (route.scene === 'intro') {
      scene.onDone = async () => { await openRoute({ scene: 'airport', view: 'scene', state: {} }); };
      scene.onRouteChange = async (nextRoute) => { await openRoute(nextRoute, { replace: true }); };
    }
    if (route.scene === 'airport') {
      scene.onTransition = async (target) => {
        if (!target?.scene) return;
        await openRoute(target);
      };
      scene.onRouteChange = async (nextRoute) => {
        await openRoute(nextRoute, { replace: true });
      };
    }
    if (route.scene === 'arrest') {
      scene.reasonCode = route.reasonCode ?? scene.reasonCode;
      scene.onDone = async (target) => {
        if (!target?.scene) return;
        await openRoute(target);
      };
    }
    if (route.scene === 'prison') {
      scene.reasonCode = route.reasonCode ?? scene.reasonCode;
      scene.onDone = async (target) => {
        if (!target?.scene) return;
        await openRoute(target);
      };
    }

    engine.setScene(scene);
    return scene;
  }

  async function syncToLocation({ replace = false } = {}) {
    const route = parseRouteHash(location.hash);
    const hash = formatRouteHash(route);
    const updateUrl = replace || location.hash !== hash;
    await openRoute(route, { updateUrl, replace: replace || updateUrl });
  }

  window.addEventListener('hashchange', async () => {
    if (location.hash === currentRouteHash) return;
    await syncToLocation();
  });

  if (!location.hash) history.replaceState(null, '', '#/logo');
  await syncToLocation({ replace: true });
  engine.start();
}

main().catch((err) => {
  console.error('Engine failed to start:', err);
  document.body.style.color = '#f00';
  document.body.textContent = `Error: ${err.message}`;
});
