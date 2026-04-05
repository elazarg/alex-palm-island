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

function buildNodeMap(graph) {
  return Object.fromEntries((graph?.nodes || []).map((node) => [node.id, node]));
}

function buildAdjacency(graph) {
  const adjacency = new Map();
  for (const node of graph?.nodes || []) adjacency.set(node.id, []);
  for (const edge of graph?.edges || []) {
    if (!adjacency.has(edge[0]) || !adjacency.has(edge[1])) continue;
    adjacency.get(edge[0]).push(edge[1]);
    adjacency.get(edge[1]).push(edge[0]);
  }
  return adjacency;
}

export function findNavigationPath(graph, start, goal) {
  if (!graph?.nodes?.length) return [goal];
  const nodes = buildNodeMap(graph);
  const adjacency = buildAdjacency(graph);

  const startNode = graph.nodes.reduce((best, node) => (
    !best || distance(start, node) < distance(start, best) ? node : best
  ), null);
  const goalNode = graph.nodes.reduce((best, node) => (
    !best || distance(goal, node) < distance(goal, best) ? node : best
  ), null);
  if (!startNode || !goalNode) return [goal];
  if (startNode.id === goalNode.id) return [goal];

  const frontier = [startNode.id];
  const cameFrom = new Map([[startNode.id, null]]);
  while (frontier.length) {
    const current = frontier.shift();
    if (current === goalNode.id) break;
    for (const next of adjacency.get(current) || []) {
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, current);
      frontier.push(next);
    }
  }

  if (!cameFrom.has(goalNode.id)) return [goal];

  const pathIds = [];
  for (let current = goalNode.id; current != null; current = cameFrom.get(current)) {
    pathIds.push(current);
  }
  pathIds.reverse();

  const points = [];
  if (distance(start, startNode) > 2) {
    points.push({ x: startNode.x, y: startNode.y });
  }
  for (let index = 1; index < pathIds.length; index++) {
    const node = nodes[pathIds[index]];
    points.push({ x: node.x, y: node.y });
  }
  if (distance(points[points.length - 1] || start, goal) > 2) {
    points.push({ x: goal.x, y: goal.y });
  }
  return points;
}

function pointInRect(point, rect) {
  const [x1, y1, x2, y2] = rect;
  return point.x > x1 && point.x < x2 && point.y > y1 && point.y < y2;
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(c, a, b)) return true;
  if (o2 === 0 && pointOnSegment(d, a, b)) return true;
  if (o3 === 0 && pointOnSegment(a, c, d)) return true;
  if (o4 === 0 && pointOnSegment(b, c, d)) return true;
  return false;
}

function segmentIntersectsRect(a, b, rect) {
  const [x1, y1, x2, y2] = rect;
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
  const corners = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
  for (let i = 0; i < 4; i++) {
    const c = corners[i];
    const d = corners[(i + 1) % 4];
    if (segmentsIntersect(a, b, c, d)) return true;
  }
  return false;
}

function pointOnSegment(point, a, b) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > 1e-6) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < 0) return false;
  const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= lenSq;
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-6) return 0;
  return value > 0 ? 1 : 2;
}

function polygonEdges(polygon) {
  const edges = [];
  for (let i = 0; i < polygon.length; i++) {
    edges.push([polygon[i], polygon[(i + 1) % polygon.length]]);
  }
  return edges;
}

function segmentIntersectsPolygon(a, b, polygon) {
  if (pointInPolygon(a, polygon) || pointInPolygon(b, polygon)) return true;
  for (const [c, d] of polygonEdges(polygon)) {
    if (pointOnSegment(a, c, d) || pointOnSegment(b, c, d)) continue;
    if (segmentsIntersect(a, b, c, d)) return true;
  }
  return false;
}

function samplePointOnSegment(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function pointBlockedByObstacles(point, rects, polygons) {
  return rects.some((rect) => pointInRect(point, rect))
    || polygons.some((polygon) => pointInPolygon(point, polygon));
}

function segmentBlockedByObstacles(a, b, rects, polygons, step = 2) {
  if (pointBlockedByObstacles(a, rects, polygons) || pointBlockedByObstacles(b, rects, polygons)) {
    return true;
  }
  const len = distance(a, b);
  const samples = Math.max(1, Math.ceil(len / step));
  for (let i = 1; i < samples; i++) {
    const point = samplePointOnSegment(a, b, i / samples);
    if (pointBlockedByObstacles(point, rects, polygons)) return true;
  }
  return false;
}

function expandRect(rect, padding) {
  const [x1, y1, x2, y2] = rect;
  return [x1 - padding, y1 - padding, x2 + padding, y2 + padding];
}

function buildVisibilityNodes(start, goal, obstacles, padding) {
  const nodes = [
    { id: 'start', x: start.x, y: start.y },
    { id: 'goal', x: goal.x, y: goal.y },
  ];
  for (const rect of obstacles) {
    const [x1, y1, x2, y2] = expandRect(rect, padding);
    nodes.push(
      { id: `${x1},${y1}`, x: x1, y: y1 },
      { id: `${x1},${y2}`, x: x1, y: y2 },
      { id: `${x2},${y1}`, x: x2, y: y1 },
      { id: `${x2},${y2}`, x: x2, y: y2 },
    );
  }
  return nodes.filter((node, index, arr) => arr.findIndex((other) => other.id === node.id) === index);
}

function buildVisibilityNodesWithPolygons(start, goal, rects, polygons, padding) {
  const nodes = buildVisibilityNodes(start, goal, rects, padding);
  for (const polygon of polygons) {
    const centroid = polygon.reduce((acc, point) => ({
      x: acc.x + point.x / polygon.length,
      y: acc.y + point.y / polygon.length,
    }), { x: 0, y: 0 });
    for (const point of polygon) {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      const len = Math.hypot(dx, dy) || 1;
      const x = point.x + (dx / len) * padding;
      const y = point.y + (dy / len) * padding;
      nodes.push({ id: `${x},${y}`, x, y });
    }
  }
  return nodes.filter((node, index, arr) => arr.findIndex((other) => other.id === node.id) === index);
}

export function findPathAroundRects(start, goal, obstacles = [], { padding = 2 } = {}) {
  if (!obstacles.length) return [goal];
  const blocked = obstacles.map((rect) => expandRect(rect, padding));
  if (!blocked.some((rect) => segmentIntersectsRect(start, goal, rect))) return [goal];

  const nodes = buildVisibilityNodes(start, goal, obstacles, padding);
  const adjacency = new Map(nodes.map((node) => [node.id, []]));

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (blocked.some((rect) => segmentIntersectsRect(a, b, rect))) continue;
      adjacency.get(a.id).push(b.id);
      adjacency.get(b.id).push(a.id);
    }
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const frontier = [{ id: 'start', score: 0 }];
  const cameFrom = new Map([['start', null]]);
  const costSoFar = new Map([['start', 0]]);

  while (frontier.length) {
    frontier.sort((a, b) => a.score - b.score);
    const current = frontier.shift().id;
    if (current === 'goal') break;
    for (const next of adjacency.get(current) || []) {
      const newCost = costSoFar.get(current) + distance(nodeMap.get(current), nodeMap.get(next));
      if (!costSoFar.has(next) || newCost < costSoFar.get(next)) {
        costSoFar.set(next, newCost);
        cameFrom.set(next, current);
        frontier.push({
          id: next,
          score: newCost + distance(nodeMap.get(next), nodeMap.get('goal')),
        });
      }
    }
  }

  if (!cameFrom.has('goal')) return [goal];

  const path = [];
  for (let current = 'goal'; current && current !== 'start'; current = cameFrom.get(current)) {
    const node = nodeMap.get(current);
    path.push({ x: node.x, y: node.y });
  }
  path.reverse();
  return path.length ? path : [goal];
}

export function findPathAroundObstacles(
  start,
  goal,
  { rects = [], polygons = [] } = {},
  { padding = 2 } = {},
) {
  if (!rects.length && !polygons.length) return [goal];
  const blockedRects = rects.map((rect) => expandRect(rect, padding));
  const directBlocked = segmentBlockedByObstacles(start, goal, blockedRects, polygons)
    || blockedRects.some((rect) => segmentIntersectsRect(start, goal, rect))
    || polygons.some((polygon) => segmentIntersectsPolygon(start, goal, polygon));
  if (!directBlocked) return [goal];

  const nodes = buildVisibilityNodesWithPolygons(start, goal, rects, polygons, padding);
  const adjacency = new Map(nodes.map((node) => [node.id, []]));

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (segmentBlockedByObstacles(a, b, blockedRects, polygons)) continue;
      if (blockedRects.some((rect) => segmentIntersectsRect(a, b, rect))) continue;
      if (polygons.some((polygon) => segmentIntersectsPolygon(a, b, polygon))) continue;
      adjacency.get(a.id).push(b.id);
      adjacency.get(b.id).push(a.id);
    }
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const frontier = [{ id: 'start', score: 0 }];
  const cameFrom = new Map([['start', null]]);
  const costSoFar = new Map([['start', 0]]);

  while (frontier.length) {
    frontier.sort((a, b) => a.score - b.score);
    const current = frontier.shift().id;
    if (current === 'goal') break;
    for (const next of adjacency.get(current) || []) {
      const newCost = costSoFar.get(current) + distance(nodeMap.get(current), nodeMap.get(next));
      if (!costSoFar.has(next) || newCost < costSoFar.get(next)) {
        costSoFar.set(next, newCost);
        cameFrom.set(next, current);
        frontier.push({
          id: next,
          score: newCost + distance(nodeMap.get(next), nodeMap.get('goal')),
        });
      }
    }
  }

  if (!cameFrom.has('goal')) return [goal];

  const path = [];
  for (let current = 'goal'; current && current !== 'start'; current = cameFrom.get(current)) {
    const node = nodeMap.get(current);
    path.push({ x: node.x, y: node.y });
  }
  path.reverse();
  return path.length ? path : [goal];
}

export function findNearestWalkablePoint(
  point,
  isWalkable,
  { width = 320, height = 200, step = 2, maxRadius = 200 } = {},
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
  { width = 320, height = 200, cellSize = 8, canTraverseSegment = null } = {},
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
