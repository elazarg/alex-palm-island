import { defaultRouteForScene, formatRouteHash, normalizeRoute, parseRouteHash, routeCacheKey } from './router.js';
import { SCENE_REGISTRY } from '../scenes/registry.js';

export class SceneManager {
  constructor(engine) {
    this.engine = engine;
    this.scenes = new Map();
    this.currentRouteHash = null;
  }

  async start() {
    window.addEventListener('hashchange', async () => {
      if (location.hash === this.currentRouteHash) return;
      await this.syncToLocation();
    });

    if (!location.hash) history.replaceState(null, '', '#/logo');
    await this.syncToLocation({ replace: true });
  }

  async syncToLocation({ replace = false } = {}) {
    const route = normalizeRoute(parseRouteHash(location.hash));
    const hash = formatRouteHash(route);
    const updateUrl = replace || location.hash !== hash;
    await this.openRoute(route, { updateUrl, replace: replace || updateUrl });
  }

  async openRoute(route, { updateUrl = true, replace = false } = {}) {
    route = normalizeRoute(route);
    const hash = formatRouteHash(route);
    if (this.engine.scene && hash === this.currentRouteHash && !updateUrl) {
      return this.engine.scene;
    }
    this.currentRouteHash = hash;
    if (updateUrl) {
      if (replace) history.replaceState(null, '', hash);
      else if (location.hash !== hash) location.hash = hash;
    }

    const prevScene = this.engine.scene;
    const scene = await this._getScene(route);
    if (!scene) return null;

    const descriptor = SCENE_REGISTRY[route.scene] || SCENE_REGISTRY.logo;
    if (typeof descriptor.wire === 'function') {
      descriptor.wire(this, scene, route);
    }

    if (scene === prevScene) {
      if (typeof scene.applyRoute === 'function') scene.applyRoute(route);
    } else {
      this.engine.setScene(scene);
    }
    return scene;
  }

  publishRoute(route) {
    const nextRoute = normalizeRoute(route);
    const nextHash = formatRouteHash(nextRoute);
    if (nextHash === this.currentRouteHash) return;
    this.currentRouteHash = nextHash;
    history.replaceState(null, '', nextHash);
  }

  async _getScene(route) {
    const key = routeCacheKey(route);
    if (this.scenes.has(key)) {
      const scene = this.scenes.get(key);
      if ('route' in scene) {
        const descriptor = SCENE_REGISTRY[route.scene] || SCENE_REGISTRY.logo;
        scene.route = descriptor.normalize(route);
      }
      return scene;
    }
    const descriptor = SCENE_REGISTRY[route.scene] || SCENE_REGISTRY.logo;
    const scene = descriptor.create(route);
    if (!scene) return null;
    await scene.load(this.engine);
    this.scenes.set(key, scene);
    return scene;
  }
}
