import { WIDTH, HEIGHT } from '../core/engine.js';

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function findNearestWalkablePoint(
  point,
  isWalkable,
  { width = WIDTH, height = HEIGHT, step = 2, maxRadius = 200 } = {},
) {
  const clampPoint = (x, y) => ({
    x: Math.max(0, Math.min(width - 1, x)),
    y: Math.max(0, Math.min(height - 1, y)),
  });

  const origin = clampPoint(point.x, point.y);
  if (isWalkable(origin.x, origin.y)) return origin;

  for (let radius = step; radius <= maxRadius; radius += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      const candidates = [
        clampPoint(origin.x + dx, origin.y - radius),
        clampPoint(origin.x + dx, origin.y + radius),
      ];
      for (const candidate of candidates) {
        if (isWalkable(candidate.x, candidate.y)) return candidate;
      }
    }
    for (let dy = -radius + step; dy <= radius - step; dy += step) {
      const candidates = [
        clampPoint(origin.x - radius, origin.y + dy),
        clampPoint(origin.x + radius, origin.y + dy),
      ];
      for (const candidate of candidates) {
        if (isWalkable(candidate.x, candidate.y)) return candidate;
      }
    }
  }

  return origin;
}

function sampleSegmentWalkable(a, b, isWalkable, step = 2) {
  const len = distance(a, b);
  const samples = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (!isWalkable(x, y)) return false;
  }
  return true;
}

function nearestWalkableCell(startCell, isCellWalkable, cols, rows) {
  if (isCellWalkable(startCell.x, startCell.y)) return startCell;
  const seen = new Set([pointKey(startCell)]);
  const queue = [startCell];
  while (queue.length) {
    const current = queue.shift();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: current.x + dx, y: current.y + dy };
        if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) continue;
        const key = pointKey(next);
        if (seen.has(key)) continue;
        if (isCellWalkable(next.x, next.y)) return next;
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return null;
}

function smoothPath(points, isWalkable, canTraverseSegment = null) {
  if (points.length <= 2) return points;
  const result = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let furthest = points.length - 1;
    while (furthest > anchor + 1) {
      const ok = canTraverseSegment
        ? canTraverseSegment(points[anchor], points[furthest])
        : sampleSegmentWalkable(points[anchor], points[furthest], isWalkable);
      if (ok) break;
      furthest--;
    }
    result.push(points[furthest]);
    anchor = furthest;
  }
  return result;
}

export function findPathOnGrid(
  start,
  goal,
  isWalkable,
  { width = WIDTH, height = HEIGHT, cellSize = 8, canTraverseSegment = null } = {},
) {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const cellCenter = (cx, cy) => ({
    x: Math.min(width - 1, cx * cellSize + cellSize / 2),
    y: Math.min(height - 1, cy * cellSize + cellSize / 2),
  });
  const toCell = (point) => ({
    x: Math.max(0, Math.min(cols - 1, Math.floor(point.x / cellSize))),
    y: Math.max(0, Math.min(rows - 1, Math.floor(point.y / cellSize))),
  });
  const isCellWalkable = (cx, cy) => {
    const center = cellCenter(cx, cy);
    return isWalkable(center.x, center.y);
  };

  const startCell = nearestWalkableCell(toCell(start), isCellWalkable, cols, rows);
  const goalCell = nearestWalkableCell(toCell(goal), isCellWalkable, cols, rows);
  if (!startCell || !goalCell) return [goal];
  if (startCell.x === goalCell.x && startCell.y === goalCell.y) return [goal];

  const open = [{ ...startCell, score: 0 }];
  const cameFrom = new Map([[pointKey(startCell), null]]);
  const costSoFar = new Map([[pointKey(startCell), 0]]);

  while (open.length) {
    open.sort((a, b) => a.score - b.score);
    const current = open.shift();
    if (current.x === goalCell.x && current.y === goalCell.y) break;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const next = { x: current.x + dx, y: current.y + dy };
        if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) continue;
        if (!isCellWalkable(next.x, next.y)) continue;
        const nextCenter = cellCenter(next.x, next.y);
        const currentCenter = cellCenter(current.x, current.y);
        const ok = canTraverseSegment
          ? canTraverseSegment(currentCenter, nextCenter)
          : sampleSegmentWalkable(currentCenter, nextCenter, isWalkable, Math.max(2, cellSize / 2));
        if (!ok) continue;
        const newCost = costSoFar.get(pointKey(current)) + distance(currentCenter, nextCenter);
        const nextKey = pointKey(next);
        if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
          costSoFar.set(nextKey, newCost);
          cameFrom.set(nextKey, current);
          open.push({
            ...next,
            score: newCost + distance(nextCenter, cellCenter(goalCell.x, goalCell.y)),
          });
        }
      }
    }
  }

  const goalKey = pointKey(goalCell);
  if (!cameFrom.has(goalKey)) return [goal];

  const reverse = [];
  for (let current = goalCell; current; current = cameFrom.get(pointKey(current))) {
    reverse.push(cellCenter(current.x, current.y));
  }
  reverse.reverse();
  const rawPath = [start, ...reverse.slice(1, -1), goal];
  const smoothed = smoothPath(rawPath, isWalkable, canTraverseSegment);
  return smoothed.slice(1);
}
