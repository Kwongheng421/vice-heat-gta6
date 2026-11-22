// Vice Heat city generation — written fresh in the recorded session.
// A varied, non-grid city: jittered intersections, a diagonal avenue and a
// curved coastal ring road. Nothing here is a regular 8x8 block grid.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WORLD_W = 2400, WORLD_H = 1800;
export const SEA_Y = 1580, BEACH_Y = 1500;

export function buildCity(seed) {
  const rnd = mulberry32(seed || 12345);
  const nodes = [];
  const segSet = new Set();
  const segs = [];
  function addNode(x, y) { const id = nodes.length; nodes.push({ x, y, id }); return id; }
  function addSeg(a, b) {
    if (a === b) return;
    const k = a < b ? a + '-' + b : b + '-' + a;
    if (segSet.has(k)) return; segSet.add(k); segs.push({ a, b });
  }
  const grid = [];
  const colX = [170, 430, 700, 970, 1240, 1520, 1800, 2080];
  const rowY = [170, 400, 620, 850, 1080, 1310];
  for (let r = 0; r < rowY.length; r++) {
    grid[r] = [];
    for (let c = 0; c < colX.length; c++) {
      if (rnd() < 0.12 && !(r === 4 && c === 1)) { grid[r][c] = -1; continue; }
      const jx = (rnd() - 0.5) * 90, jy = (rnd() - 0.5) * 70;
      grid[r][c] = addNode(colX[c] + jx, rowY[r] + jy);
    }
  }
  for (let r = 0; r < rowY.length; r++) for (let c = 0; c < colX.length; c++) {
    const id = grid[r][c]; if (id < 0) continue;
    if (c + 1 < colX.length && grid[r][c + 1] >= 0) addSeg(id, grid[r][c + 1]);
    if (r + 1 < rowY.length && grid[r + 1][c] >= 0) addSeg(id, grid[r + 1][c]);
    if (r + 1 < rowY.length && c + 1 < colX.length && grid[r + 1][c + 1] >= 0 && rnd() < 0.22) addSeg(id, grid[r + 1][c + 1]);
  }
  let prev = -1;
  const diag = [[150, 1420], [520, 1180], [900, 940], [1280, 700], [1660, 460], [2050, 220]];
  for (const [x, y] of diag) { const id = addNode(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30); if (prev >= 0) addSeg(prev, id); prev = id; }
  prev = -1;
  const coast = [[120, 1470], [500, 1440], [900, 1470], [1300, 1430], [1700, 1460], [2100, 1440], [2280, 1470]];
  const coastIds = [];
  for (const [x, y] of coast) { const id = addNode(x, y); coastIds.push(id); if (prev >= 0) addSeg(prev, id); prev = id; }
  addSeg(coastIds[1], grid[5][1] >= 0 ? grid[5][1] : grid[5][2]);
  addSeg(coastIds[3], grid[5][4] >= 0 ? grid[5][4] : grid[5][3]);
  addSeg(coastIds[5], grid[5][6] >= 0 ? grid[5][6] : grid[5][5]);

  const adj = nodes.map(() => []);
  for (const s of segs) { adj[s.a].push(s.b); adj[s.b].push(s.a); }
  function nodeAt(x, y) { let best = 0, bd = 1e18; nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = i; } }); return best; }
  function distToSeg(px, py, s) {
    const a = nodes[s.a], b = nodes[s.b];
    const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / L; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }
  function onRoad(x, y, w) { for (const s of segs) if (distToSeg(x, y, s) < w) return true; return false; }
  function inPark(x, y) { return Math.hypot(x - 1180, y - 640) < 215; }
  function inLake(x, y) { return Math.hypot(x - 1180, y - 640) < 88; }
  function inSea(x, y) { return y > SEA_Y; }
  const buildings = [];
  function blocked(x, y, r) {
    if (x < 20 || y < 20 || x > WORLD_W - 20 || y > WORLD_H - 20) return true;
    if (inLake(x, y) || inSea(x, y)) return true;
    for (const b of buildings) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    return false;
  }
  const roofTypes = ['highrise', 'house', 'warehouse', 'office'];
  let tries = 0;
  while (buildings.length < 96 && tries++ < 3000) {
    const s = segs[Math.floor(rnd() * segs.length)];
    const a = nodes[s.a], b = nodes[s.b];
    const t = rnd();
    const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    const side = rnd() < 0.5 ? 1 : -1, off = 52 + rnd() * 55;
    const bx = cx + Math.cos(ang) * off * side, by = cy + Math.sin(ang) * off * side;
    const w = 44 + rnd() * 52, h = 40 + rnd() * 48;
    const x = bx - w / 2, y = by - h / 2;
    if (onRoad(bx, by, 44) || inPark(bx, by) || inLake(bx, by) || y > BEACH_Y - 20) continue;
    if (Math.hypot(bx - 380, by - 1180) < 130) continue;
    let ok = true;
    for (const o of buildings) if (x < o.x + o.w + 14 && x + w + 14 > o.x && y < o.y + o.h + 14 && y + h + 14 > o.y) { ok = false; break; }
    if (!ok) continue;
    let type = roofTypes[Math.floor(rnd() * roofTypes.length)];
    if (Math.hypot(bx - 1450, by - 320) < 320) type = 'highrise';
    else if (Math.hypot(bx - 1950, by - 1080) < 260) type = 'house';
    else if (Math.hypot(bx - 260, by - 1300) < 260) type = 'warehouse';
    buildings.push({ x, y, w, h, type, hue: Math.floor(rnd() * 360) });
  }
  function freeSpot(x, y) {
    for (let r = 0; r < 200; r += 12) for (let a = 0; a < 6.28; a += 0.9) {
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (!blocked(px, py, 18) && !onRoad(px, py, 20)) return { x: px, y: py };
    }
    return { x, y };
  }
  const bar = { x: 380, y: 1180 };
  const gunShop = { x: 1960, y: 430 };
  const hospital = { x: 900, y: 300 };
  const carShop = { x: 520, y: 1360 };
  const bank = { x: 1450, y: 300 };
  const dock = { x: 2180, y: 1520 };
  const nightMarket = { x: 660, y: 1080 };
  const pinkCarSpot = { x: 1830, y: 520 };
  const packages = [];
  let pt = 0;
  while (packages.length < 20 && pt++ < 2000) {
    const x = 80 + rnd() * (WORLD_W - 160), y = 80 + rnd() * (BEACH_Y - 160);
    if (onRoad(x, y, 26) && !inPark(x, y) && !blocked(x, y, 10) && Math.hypot(x - bar.x, y - bar.y) > 120)
      packages.push({ x, y, got: false });
  }
  function district(x, y) {
    if (y > BEACH_Y) return '南海滩';
    if (inPark(x, y)) return '中央公园';
    if (Math.hypot(x - nightMarket.x, y - nightMarket.y) < 170) return '夜市广场';
    if (Math.hypot(x - 260, y - 1300) < 260) return '港口工业区';
    if (Math.hypot(x - 1950, y - 1080) < 280) return '住宅区';
    if (Math.hypot(x - 1450, y - 320) < 330) return '市中心';
    if (y < 300) return '北岸';
    return '老城区';
  }
  return {
    nodes, segs, adj, buildings, packages, bar, gunShop, hospital, carShop, bank, dock,
    nightMarket, pinkCarSpot, nodeAt, distToSeg, onRoad, inPark, inLake, inSea, blocked, freeSpot, district,
    park: { x: 1180, y: 640, r: 215, lakeR: 88 },
  };
}
