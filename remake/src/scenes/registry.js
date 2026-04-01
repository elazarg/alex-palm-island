import { AirportScene } from './airport/scene.js';
import { defaultAirportRoute, formatAirportRoute, normalizeAirportRoute, parseAirportRoute } from './airport/route.js';
import { ArrestScene } from './arrest/scene.js';
import { IntroScene, INTRO_PARTS } from './intro.js';
import { LogoScene } from './logo.js';
import { MainMenuScene } from './main-menu.js';
import { PrisonScene } from './prison/scene.js';

function defaultSimpleRoute(scene) {
  return { scene };
}

function simpleFormat(scene) {
  return {
    segments: [scene],
    params: new URLSearchParams(),
  };
}

function simpleDescriptor(scene, create) {
  return {
    defaultRoute: () => defaultSimpleRoute(scene),
    parse: () => defaultSimpleRoute(scene),
    normalize: (route = {}) => ({ scene, ...route }),
    format: () => simpleFormat(scene),
    create,
  };
}

export const SCENE_REGISTRY = Object.freeze({
  logo: simpleDescriptor('logo', () => new LogoScene()),
  menu: simpleDescriptor('menu', () => new MainMenuScene()),
  intro: {
    defaultRoute: () => ({ scene: 'intro', part: null }),
    parse: (segments) => ({ scene: 'intro', part: INTRO_PARTS.includes(segments[0]) ? segments[0] : null }),
    normalize: (route = {}) => ({ scene: 'intro', part: INTRO_PARTS.includes(route.part) ? route.part : null }),
    format: (route = {}) => {
      const normalized = SCENE_REGISTRY.intro.normalize(route);
      return {
        segments: normalized.part ? ['intro', normalized.part] : ['intro'],
        params: new URLSearchParams(),
      };
    },
    create: (route = {}) => new IntroScene({ startPart: route.part || null }),
  },
  airport: {
    defaultRoute: defaultAirportRoute,
    parse: parseAirportRoute,
    normalize: normalizeAirportRoute,
    format: formatAirportRoute,
    create: (route = {}) => new AirportScene({ route: normalizeAirportRoute(route) }),
  },
  arrest: {
    defaultRoute: () => ({ scene: 'arrest', reasonCode: 503 }),
    parse: (segments) => {
      const reasonCode = Number(segments[0]);
      return { scene: 'arrest', reasonCode: Number.isFinite(reasonCode) ? reasonCode : 503 };
    },
    normalize: (route = {}) => {
      const reasonCode = Number(route.reasonCode);
      return { scene: 'arrest', reasonCode: Number.isFinite(reasonCode) ? reasonCode : 503 };
    },
    format: (route = {}) => {
      const normalized = SCENE_REGISTRY.arrest.normalize(route);
      return { segments: ['arrest', String(normalized.reasonCode)], params: new URLSearchParams() };
    },
    create: (route = {}) => new ArrestScene({ reasonCode: route.reasonCode }),
  },
  prison: {
    defaultRoute: () => ({ scene: 'prison', reasonCode: 503 }),
    parse: (segments) => {
      const reasonCode = Number(segments[0]);
      return { scene: 'prison', reasonCode: Number.isFinite(reasonCode) ? reasonCode : 503 };
    },
    normalize: (route = {}) => {
      const reasonCode = Number(route.reasonCode);
      return { scene: 'prison', reasonCode: Number.isFinite(reasonCode) ? reasonCode : 503 };
    },
    format: (route = {}) => {
      const normalized = SCENE_REGISTRY.prison.normalize(route);
      return { segments: ['prison', String(normalized.reasonCode)], params: new URLSearchParams() };
    },
    create: (route = {}) => new PrisonScene({ reasonCode: route.reasonCode }),
  },
});
