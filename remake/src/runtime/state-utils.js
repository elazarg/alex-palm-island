const BAG_ITEM_VALUES = Object.freeze(['passport', 'letter']);

export function parseBooleanFlag(value) {
  if (value == null) return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return null;
}

export function parseTriStateFlag(value) {
  if (value == null || value === '') return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'null') return null;
  return null;
}

export function normalizeBagItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item, index) => BAG_ITEM_VALUES.includes(item) && items.indexOf(item) === index);
}

export const CARRY_STATE_KEYS = Object.freeze(['palmettoes', 'bag', 'map']);

export function buildCarryState(state = {}) {
  return {
    palmettoes: state.palmettoes,
    bag: state.bag,
    map: state.map === true ? true : (state.map === false ? false : null),
  };
}
