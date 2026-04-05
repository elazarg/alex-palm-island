function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

function ccw(a, b, c) {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
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
