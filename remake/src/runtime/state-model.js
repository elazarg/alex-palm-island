export function pickStateKeys(state = {}, keys = []) {
  return Object.fromEntries(
    keys
      .filter((key) => Object.prototype.hasOwnProperty.call(state, key))
      .map((key) => [key, state[key]])
  );
}

export function splitStateLayers(state = {}, {
  alexKeys = [],
  globalKeys = [],
  sceneKeys = [],
} = {}) {
  return {
    alexState: pickStateKeys(state, alexKeys),
    globalState: pickStateKeys(state, globalKeys),
    sceneState: pickStateKeys(state, sceneKeys),
  };
}

export function mergeStateLayers({
  alexState = {},
  globalState = {},
  sceneState = {},
} = {}) {
  return {
    ...alexState,
    ...globalState,
    ...sceneState,
  };
}
