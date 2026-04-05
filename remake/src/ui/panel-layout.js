export const STANDARD_PANEL_LAYOUT = Object.freeze({
  meter: { asset: 'METER', x: 0, y: 180 },
  panel: { asset: 'PANEL', x: 0, y: 167, revealY: 166 },
  money: {
    x: 142,
    y: 185,
    digitWidth: 5,
    gap: 2,
    coinOutStartX: 163,
    coinOutEndX: 305,
    coinInStartX: 110,
    coinInEndX: 163,
    coinY: 181,
    coinDurationTicks: 24,
    coinFrameTicks: 3,
    colors: { on: '#0ccc0c', off: '#744c0c' },
  },
});
