export const WALK_DELTAS = Object.freeze({
  1: [{dx:0,dy:0},{dx:-4,dy:2},{dx:-4,dy:3},{dx:0,dy:0},{dx:0,dy:0},{dx:-4,dy:2},{dx:-4,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
  2: [{dx:0,dy:0},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
  3: [{dx:0,dy:0},{dx:4,dy:2},{dx:4,dy:3},{dx:0,dy:0},{dx:0,dy:0},{dx:4,dy:2},{dx:4,dy:3},{dx:0,dy:0},{dx:0,dy:0}],
  4: [{dx:0,dy:0},{dx:0,dy:0},{dx:0,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:-12,dy:0},{dx:0,dy:0},{dx:0,dy:0}],
  6: [{dx:0,dy:0},{dx:0,dy:0},{dx:0,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:12,dy:0},{dx:0,dy:0},{dx:0,dy:0}],
  7: [{dx:0,dy:0},{dx:-4,dy:-2},{dx:-4,dy:-3},{dx:0,dy:0},{dx:0,dy:0},{dx:-4,dy:-2},{dx:-4,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
  8: [{dx:0,dy:0},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
  9: [{dx:0,dy:0},{dx:4,dy:-2},{dx:4,dy:-3},{dx:0,dy:0},{dx:0,dy:0},{dx:4,dy:-2},{dx:4,dy:-3},{dx:0,dy:0},{dx:0,dy:0}],
});

export const WALK_FRAME_CYCLES = Object.freeze({
  1: [1, 2, 5, 6], 2: [1, 2, 3, 4, 5, 6], 3: [1, 2, 5, 6], 4: [3, 4, 5, 6],
  6: [3, 4, 5, 6], 7: [1, 2, 5, 6], 8: [1, 2, 3, 4, 5, 6], 9: [1, 2, 5, 6],
});
