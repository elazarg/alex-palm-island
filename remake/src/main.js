import { Engine } from './core/engine.js';
import { defaultRouteForScene, formatRouteHash, normalizeRoute, parseRouteHash, routeCacheKey } from './core/router.js';
import { SCENE_REGISTRY } from './scenes/registry.js';

async function main() {
  const canvas = document.getElementById('screen');
  const engine = new Engine(canvas);
  const scenes = new Map();
  let currentRouteHash = null;

  async function getScene(route) {
    const key = routeCacheKey(route);
    if (scenes.has(key)) return scenes.get(key);
    const descriptor = SCENE_REGISTRY[route.scene] || SCENE_REGISTRY.logo;
    const scene = descriptor.create(route);
    if (!scene) return null;
    await scene.load(engine);
    scenes.set(key, scene);
    return scene;
  }

  async function openRoute(route, { updateUrl = true, replace = false } = {}) {
    route = normalizeRoute(route);
    const hash = formatRouteHash(route);
    if (engine.scene && hash === currentRouteHash && !updateUrl) {
      return engine.scene;
    }
    currentRouteHash = hash;
    if (updateUrl) {
      if (replace) history.replaceState(null, '', hash);
      else if (location.hash !== hash) location.hash = hash;
    }

    const scene = await getScene(route);
    if (!scene) return null;

    if (route.scene === 'logo') {
      scene.onDone = async () => { await openRoute(defaultRouteForScene('menu'), { replace: true }); };
    }
    if (route.scene === 'menu') {
      scene.onButton = async (name) => {
        if (name === 'intro') await openRoute(defaultRouteForScene('intro'));
        else if (name === 'play') await openRoute(defaultRouteForScene('airport'));
      };
    }
    if (route.scene === 'intro') {
      scene.onDone = async () => { await openRoute(defaultRouteForScene('airport')); };
      scene.onRouteChange = async (nextRoute) => {
        if (formatRouteHash(nextRoute) === currentRouteHash) return;
        const nextHash = formatRouteHash(nextRoute);
        currentRouteHash = nextHash;
        history.replaceState(null, '', nextHash);
      };
    }
    if (route.scene === 'airport') {
      scene.onTransition = async (target) => {
        if (!target?.scene) return;
        await openRoute(target);
      };
      scene.onRouteChange = async (nextRoute) => {
        if (formatRouteHash(nextRoute) === currentRouteHash) return;
        const nextHash = formatRouteHash(nextRoute);
        currentRouteHash = nextHash;
        history.replaceState(null, '', nextHash);
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
    const route = normalizeRoute(parseRouteHash(location.hash));
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
