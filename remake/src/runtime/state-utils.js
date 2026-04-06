const BAG_ITEM_VALUES = Object.freeze(['passport', 'letter']);
const INVENTORY_ITEM_VALUES = Object.freeze([
  'passport',
  'letter',
  'coupon',
  'zooCoupon',
  'chocolate',
  'credit',
  'key303',
  'pin',
  'drawerKey',
  'glue',
  'burger',
  'drink',
  'egg',
  'envelope',
  'beef',
  'hotdog',
  'notebook',
  'photo',
  'milk',
  'peanut',
  'idCard',
  'zooTicket',
  'hammer',
  'brain',
]);
const REASON_FOR_COMING_VALUES = Object.freeze(['holiday', 'business']);

export function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim())
    .filter((value, index, list) => value && list.indexOf(value) === index);
}

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

export function normalizeInventoryItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item, index) => INVENTORY_ITEM_VALUES.includes(item) && items.indexOf(item) === index);
}

export function normalizeFlagIds(flags) {
  if (!Array.isArray(flags)) return [];
  return flags
    .map((flag) => Number(flag))
    .filter((flag, index, list) => Number.isInteger(flag) && flag > 0 && list.indexOf(flag) === index)
    .sort((a, b) => a - b);
}

export function normalizeReasonForComing(value) {
  return REASON_FOR_COMING_VALUES.includes(value) ? value : null;
}

export const CARRY_STATE_KEYS = Object.freeze(['palmettoes', 'bag', 'map', 'flags', 'items', 'reasonForComing']);

export function buildCarryState(state = {}) {
  return {
    palmettoes: state.palmettoes,
    bag: state.bag,
    map: state.map === true ? true : (state.map === false ? false : null),
    flags: normalizeFlagIds(state.flags),
    items: normalizeInventoryItems(state.items),
    reasonForComing: normalizeReasonForComing(state.reasonForComing),
  };
}
