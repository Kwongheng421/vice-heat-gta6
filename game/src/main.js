// Vice Heat — open-world crime game, written fresh in this session for gta6-01.
// Top-down 2D canvas, fully offline, no network calls, all art drawn in code
// and all sound synthesised with WebAudio. Nothing here copies Rockstar/GTA.
'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const el = id => document.getElementById(id);
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const hyp = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const wrapAngle = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function seededRandom(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
const rnd = seededRandom(20261124);
const between = (a, b) => a + rnd() * (b - a);
const betweenInt = (a, b) => Math.floor(between(a, b + 1));
const choice = arr => arr[Math.floor(rnd() * arr.length)];

// ---------------- City: a NON-GRID town ----------------
const MAP_W = 3200, MAP_H = 2400;
// 54 jittered intersections: six uneven rows plus a diagonal avenue and a
// curved coastal ring along the south shore. No 8x8 grid anywhere.
const POINTS = [
  [300,250],[700,220],[1100,260],[1500,230],[1900,270],[2300,240],[2700,260],[3000,250],
  [250,600],[650,580],[1050,620],[1450,590],[1850,610],[2250,580],[2650,620],[2950,600],
  [300,950],[700,930],[1100,970],[1500,940],[1900,960],[2300,930],[2700,970],[3000,950],
  [250,1300],[650,1280],[1050,1320],[1450,1290],[1850,1310],[2250,1280],[2650,1320],[2950,1300],
  [300,1650],[700,1630],[1100,1670],[1500,1640],[1900,1660],[2300,1630],[2700,1670],[3000,1650],
  [350,1950],[750,1930],[1150,1970],[1550,1940],[1950,1960],[2350,1930],[2750,1970],[2950,1950],
  [420,380],[820,730],[1180,1010],[1620,1380],[2080,1690],[2580,1920],
];
const pt = i => ({ x: POINTS[i][0], y: POINTS[i][1] });
const ROADS = [];
const link = (a, b) => ROADS.push([a, b]);
for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) link(r * 8 + c, r * 8 + c + 1);
for (let c = 0; c < 8; c++) for (let r = 0; r < 5; r++) link(r * 8 + c, (r + 1) * 8 + c);
// Diagonal avenue: each diagonal node only joins its neighbours and ONE
// nearby grid node, so no long diagonal ever slashes across blocks.
link(48, 49); link(49, 50); link(50, 51); link(51, 52); link(52, 53);
link(0, 48); link(48, 9); link(49, 17); link(50, 26); link(51, 34); link(52, 44); link(53, 45);
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = clamp(t, 0, 1);
  return hyp(px, py, ax + dx * t, ay + dy * t);
}
function closestPoint(x, y) { let bi = 0, bd = 1e9; POINTS.forEach((n, i) => { const d = hyp(x, y, n[0], n[1]); if (d < bd) { bd = d; bi = i; } }); return bi; }
function findRoute(a, b) {
  const adj = {}; ROADS.forEach(([u, v]) => { (adj[u] = adj[u] || []).push(v); (adj[v] = adj[v] || []).push(u); });
  const prev = { [a]: -1 }, q = [a];
  while (q.length) { const u = q.shift(); if (u === b) break; for (const v of (adj[u] || [])) if (!(v in prev)) { prev[v] = u; q.push(v); } }
  if (!(b in prev)) return null;
  const path = []; let c = b; while (c !== -1) { path.unshift(c); c = prev[c]; } return path;
}
// Districts and water
const PARK = { x: 1420, y: 950, w: 560, h: 420 };
const LAKE = { x: 1700, y: 1160, rx: 170, ry: 110 };
const MARKET = { x: 2150, y: 1180, w: 340, h: 240 };
const PORT = { x: 2820, y: 1180, w: 330, h: 300 };
const BEACH_Y = 2030, SEA_Y = 2150, DOCK = { x: 1550, y: 2060 };
const inLake = (x, y) => { const dx = (x - LAKE.x) / LAKE.rx, dy = (y - LAKE.y) / LAKE.ry; return dx * dx + dy * dy < 1; };
const inSea = (x, y) => y > SEA_Y;
// True rect-to-centreline clearance. A car is radius 20 and weaves ~35px off
// the centreline when cutting corners, so generation demands >= 75px.
function rectClearance(x, y, w, h) {
  const b = { x, y, w, h };
  const dPt = (px, py) => { const dx = Math.max(b.x - px, 0, px - (b.x + b.w)), dy = Math.max(b.y - py, 0, py - (b.y + b.h)); return Math.hypot(dx, dy); };
  let best = 1e9;
  for (const [a, bb] of ROADS) {
    const A = pt(a), B = pt(bb);
    if (A.x > b.x && A.x < b.x + b.w && A.y > b.y && A.y < b.y + b.h) return 0;
    if (B.x > b.x && B.x < b.x + b.w && B.y > b.y && B.y < b.y + b.h) return 0;
    let d = Math.min(dPt(A.x, A.y), dPt(B.x, B.y));
    for (const [cx, cy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) d = Math.min(d, segDist(cx, cy, A.x, A.y, B.x, B.y));
    best = Math.min(best, d);
  }
  return best;
}
// Buildings. Specials first: each sits between road rows AND between road
// columns, verified >= 75px clear of every centreline (see __VH.roadClearance).
const HOUSES = [];
const ROOF_COLOURS = ['#c94f4f', '#4f7ec9', '#4fc98a', '#c9a44f'];
function putHouse(x, y, w, h, opt = {}) { HOUSES.push({ x, y, w, h, colour: opt.colour || choice(ROOF_COLOURS), roof: opt.roof ?? betweenInt(0, 3), label: opt.label || '', kind: opt.kind || 'house' }); }
const BAR = { x: 470, y: 760, w: 120, h: 80, label: '龙叔酒吧', kind: 'bar' };
const GUN = { x: 2460, y: 420, w: 120, h: 80, label: '枪店', kind: 'gun' };
const CLINIC = { x: 860, y: 360, w: 130, h: 80, label: '医院', kind: 'hospital' };
const GARAGE = { x: 1680, y: 1740, w: 140, h: 80, label: '修车行', kind: 'carshop' };
const BANK = { x: 1620, y: 420, w: 130, h: 90, label: '银行', kind: 'bank' };
[BAR, GUN, CLINIC, GARAGE, BANK].forEach(s => putHouse(s.x, s.y, s.w, s.h, { label: s.label, kind: s.kind, colour: '#8a5fd0' }));
function hitsHouse(x, y, r) { for (const b of HOUSES) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b; return null; }
let placed = 0, tries = 0;
while (HOUSES.length < 110 && tries < 4000) {
  tries++;
  const x = between(80, MAP_W - 220), y = between(80, 2000), w = between(70, 140);
  const cx = x + w / 2, downtown = cx > 1300 && cx < 2300 && y < 900;
  const h = downtown ? between(110, 150) : between(60, 120);
  if (rectClearance(x, y, w, h) < 75) continue;
  if (cx > PARK.x - 40 && cx < PARK.x + PARK.w + 40 && y > PARK.y - 40 && y < PARK.y + PARK.h + 40) continue;
  if (cx > MARKET.x - 30 && cx < MARKET.x + MARKET.w + 30 && y > MARKET.y - 30 && y < MARKET.y + MARKET.h + 30) continue;
  if (cx > PORT.x - 20 && cx < PORT.x + PORT.w + 20 && y > PORT.y - 20 && y < PORT.y + PORT.h + 20) continue;
  if (inLake(cx, y + h / 2) || y > BEACH_Y) continue;
  if (HOUSES.some(b => cx > b.x - 30 && cx < b.x + b.w + 30 && y + h / 2 > b.y - 30 && y + h / 2 < b.y + b.h + 30)) continue;
  putHouse(x, y, w, h, { colour: downtown ? '#3a6ea8' : undefined, roof: downtown ? 3 : betweenInt(0, 3) });
  placed++;
}
// Port warehouses: tucked in the pocket east of the x=2950 road, south of the
// y=1300 road, so they never block a centreline.
for (let i = 0; i < 4; i++) putHouse(PORT.x + 240 + (i % 2) * 55, PORT.y + 180 + Math.floor(i / 2) * 60, 50, 50, { colour: '#7a6a55', roof: 1 });
const CRATES = []; for (let i = 0; i < 10; i++) CRATES.push({ x: PORT.x + between(0, 260), y: PORT.y + 160 + between(0, 110), w: 44, h: 20, colour: choice(['#d06030', '#30a0d0', '#d0b030']) });
const TREES = [];
for (let i = 0; i < 90; i++) { const x = between(60, MAP_W - 60), y = between(60, 2120); if (rectClearance(x - 12, y - 12, 24, 24) < 30 || hitsHouse(x, y, 20) || inLake(x, y)) continue; TREES.push({ x, y, palm: y > BEACH_Y || rnd() < 0.3 }); }
const LOTS = [{ x: 2250, y: 880, w: 180, h: 90 }, { x: 600, y: 1560, w: 180, h: 90 }, { x: 2650, y: 1560, w: 180, h: 90 }];
const PKG_SPOTS = [[760,1010],[2620,640],[1080,300],[1900,1980],[1900,650],[2300,1250],[2900,1250],[1500,1000],[1850,1160],[350,300],[2950,300],[300,1650],[1100,1670],[1550,2060],[700,1630],[2700,1670],[420,380],[2080,1690],[1050,1320],[650,580]];
const DELIVERY_POINTS = [[350,1950],[2950,600],[300,250],[2700,1670]];

// ---------------- Synthesised audio (no files) ----------------
let actx = null, radioOn = false, radioTick = 0;
function audioCtx() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
function tone(freq, dur = 0.08, type = 'square', vol = 0.05) { const a = audioCtx(); if (!a) return; try { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol; o.connect(g); g.connect(a.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur); o.stop(a.currentTime + dur); } catch (e) {} }
const sfx = {
  shoot: () => tone(220, 0.07, 'square', 0.06),
  hit: () => tone(140, 0.1, 'sawtooth', 0.06),
  pickup: () => { tone(660, 0.08); setTimeout(() => tone(880, 0.1), 80); },
  coin: () => tone(990, 0.12, 'sine', 0.06),
  horn: () => tone(330, 0.25, 'sawtooth', 0.05),
  busted: () => tone(110, 0.5, 'sawtooth', 0.08),
};

// ---------------- Game state ----------------
const GUNS = [
  { name: '拳头', dmg: 12, rate: 0.35, range: 46, auto: false, ammo: Infinity },
  { name: '手枪', dmg: 22, rate: 0.32, range: 420, auto: false, ammo: 120 },
  { name: '冲锋枪', dmg: 11, rate: 0.09, range: 380, auto: true, ammo: 240 },
  { name: '霰弹枪', dmg: 14, rate: 0.8, range: 300, auto: false, ammo: 40, pellets: 6 },
];
function newGame() {
  return {
    mode: 'menu', chapter: 1, stage: 0, clock: 8 * 60,
    hero: { x: 700, y: 1000, angle: -Math.PI / 2, hp: 100, armor: 0, inCar: null, weapon: 0, fireCd: 0 },
    money: 500, gold: 0, rep: 0, wanted: 0, outOfSight: 0, bustedTimer: 0,
    owned: [true, false, false, false], ammo: [Infinity, 0, 0, 0],
    cars: [], walkers: [], cops: [], heli: null, shots: [], foes: [], gangLeft: 0,
    packs: PKG_SPOTS.map(([x, y]) => ({ x, y, got: false })),
    stats: { stolen: 0, fired: 0, landed: 0, driven: 0, maxWanted: 0 },
    vault: 0, vaultTier: 0, shipTimer: 150, shipIdx: 0, bagOut: false, bagTaken: false, bagAt: null,
    truckHp: 300, truck: null, banner: '', bannerT: 0, shake: 0, flash: 0,
    objective: '去龙叔酒吧接任务', camX: 700, camY: 1000,
    pilot: null, testMode: null, testClock: 0, testResult: '',
  };
}
let G = newGame();
const SLOTS = [null, null, null]; // in-memory only, never localStorage
function toast(msg) { const t = el('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2600); }
function showDlg(html) { const d = el('dlg'); d.innerHTML = html; d.classList.remove('hidden'); }
function hideDlg() { el('dlg').classList.add('hidden'); }
function showShop(html) { const d = el('shop'); d.innerHTML = html; d.classList.remove('hidden'); }
function hideShop() { el('shop').classList.add('hidden'); }
function hideMenus() { el('menu').classList.add('hidden'); el('pauseMenu').classList.add('hidden'); el('endMenu').classList.add('hidden'); }
function showBanner(t) { G.banner = t; G.bannerT = 2.6; tone(520, 0.15); setTimeout(() => tone(780, 0.2), 140); }
function statsLine() {
  const acc = G.stats.fired ? Math.round(100 * G.stats.landed / G.stats.fired) : 0;
  const pkgs = G.packs.filter(p => p.got).length;
  return `金钱 $${G.money} · 金块 ${G.gold} · 声望 ${G.rep} · 包裹 ${pkgs}/20 · 偷车 ${G.stats.stolen} · 命中率 ${acc}% · 驾驶 ${Math.round(G.stats.driven)}m · 最高通缉 ${G.stats.maxWanted}★`;
}
function refreshObjective() {
  const h = G.hero;
  if (G.chapter === 1) G.objective = G.stage === 0 ? '去龙叔酒吧（粉色点）按 E 接任务' : G.stage === 1 ? '去东边枪店取手枪，再回酒吧' : '回酒吧见龙叔，完成第一章';
  else if (G.chapter === 2) G.objective = '偷粉色跑车（停车场），开回酒吧';
  else if (G.chapter === 3) G.objective = '击败鲨鱼帮：剩余 ' + G.gangLeft + ' 人';
  else if (G.chapter === 4) G.objective = '限时送货：已送 ' + G.shipIdx + '/4，剩余 ' + Math.ceil(G.shipTimer) + ' 秒（须在黄色货车内）';
  else if (G.chapter === 5) G.objective = G.bagTaken ? '甩掉警察（通缉归零）' : '撞停或打停运钞车，捡绿色钱袋';
  else if (G.chapter === 6) G.objective = G.vault >= 45 ? '甩掉警察，撤到南码头' : '在银行金库坚守：' + Math.floor(G.vault) + '/45 秒';
  else G.objective = '自由漫游：收集 20 个隐藏包裹';
}
function missionSpot() {
  if (G.chapter === 1) return G.stage === 1 ? { x: GUN.x + 60, y: GUN.y + 40 } : { x: BAR.x + 60, y: BAR.y + 40 };
  if (G.chapter === 2) return { x: 2320, y: 920 };
  if (G.chapter === 3 && G.foes.length) return { x: G.foes[0].x, y: G.foes[0].y };
  if (G.chapter === 4) return { x: DELIVERY_POINTS[G.shipIdx][0], y: DELIVERY_POINTS[G.shipIdx][1] };
  if (G.chapter === 5) return G.bagOut && !G.bagTaken ? { x: G.bagAt.x, y: G.bagAt.y } : { x: G.truck.x, y: G.truck.y };
  if (G.chapter === 6) return G.vault >= 45 ? { x: DOCK.x, y: DOCK.y } : { x: BANK.x + 65, y: BANK.y + 45 };
  return null;
}
function saveSlot(i) { SLOTS[i] = JSON.stringify({ chapter: G.chapter, stage: G.stage, money: G.money, gold: G.gold, rep: G.rep, owned: G.owned, ammo: G.ammo, px: G.hero.x, py: G.hero.y, packs: G.packs.map(p => p.got) }); toast('已保存到存档 ' + (i + 1)); }
function loadSlot(i) {
  const raw = SLOTS[i]; if (!raw) { toast('存档 ' + (i + 1) + ' 为空'); return false; }
  try {
    const d = JSON.parse(raw); G = newGame();
    Object.assign(G, { chapter: d.chapter, stage: d.stage, money: d.money, gold: d.gold, rep: d.rep, owned: d.owned, ammo: d.ammo });
    G.hero.x = d.px; G.hero.y = d.py; d.packs.forEach((g, j) => { if (G.packs[j]) G.packs[j].got = g; });
    buildWorld(); G.mode = 'play'; hideMenus(); refreshObjective(); return true;
  } catch (e) { toast('存档损坏'); return false; }
}
function exportSave() {
  const blob = new Blob([JSON.stringify({ chapter: G.chapter, stage: G.stage, money: G.money, gold: G.gold, owned: G.owned, ammo: G.ammo, px: G.hero.x, py: G.hero.y })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vice-heat-save.json'; a.click();
}
function addWanted(n) { G.wanted = clamp(G.wanted + n, 0, 5); G.stats.maxWanted = Math.max(G.stats.maxWanted, G.wanted); }
function finishChapter(n) {
  showBanner('MISSION PASSED · 第 ' + n + ' 章完成');
  G.money += 300 + n * 100; G.gold += 1; G.rep += 20;
  G.chapter = n + 1; G.stage = 0; G.gangLeft = 0; G.vault = 0;
  if (n === 3) G.foes = [];
  if (n === 6) showEnding('通关！', '你完成了全部 6 章，成为罪恶都市的传奇。之后可以自由漫游，收集剩下的隐藏包裹。');
  refreshObjective(); hideDlg();
}
function showEnding(title, text) { G.mode = 'end'; el('endTitle').textContent = title; el('endText').textContent = text + ' ' + statsLine(); el('endMenu').classList.remove('hidden'); }
function wasted() { G.mode = 'end'; sfx.busted(); G.money = Math.max(0, G.money - 200); G.wanted = 0; G.hero.hp = 100; G.hero.x = BAR.x + 60; G.hero.y = BAR.y + 120; G.hero.inCar = null; showEnding('WASTED', '你倒下了。医院账单 $200，通缉清零。'); }
function busted() { G.mode = 'end'; sfx.busted(); G.money = Math.max(0, G.money - 200); G.wanted = 0; G.hero.x = BAR.x + 60; G.hero.y = BAR.y + 120; G.hero.inCar = null; showEnding('BUSTED', '你被警察抓住了。保释金 $200，通缉清零。'); }

// ---------------- Spawning ----------------
const CAR_PAINT = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2ecc71'];
function makeCar(x, y, colour, opt = {}) {
  return { x, y, angle: opt.angle ?? between(0, Math.PI * 2), speed: 0, colour, owned: !!opt.owned, quest: !!opt.quest, armoured: !!opt.armoured, pink: !!opt.pink, hp: opt.hp ?? 100, edge: opt.edge ?? betweenInt(0, ROADS.length - 1), t: rnd(), dir: rnd() < 0.5 ? 1 : -1, traffic: !!opt.traffic, dead: false };
}
function buildWorld() {
  G.cars = []; G.walkers = []; G.cops = []; G.heli = null; G.shots = []; G.foes = [];
  G.cars.push(makeCar(770, 985, '#00d0d0', { owned: true, angle: 0 })); // starter car, on open ground by the bar
  for (const lot of LOTS) for (let i = 0; i < 3; i++) G.cars.push(makeCar(lot.x + 20 + i * 55, lot.y + 30, '#888888', { angle: 0 }));
  const pink = G.cars[G.cars.length - 1]; pink.x = 2320; pink.y = 920; pink.colour = '#ff69b4'; pink.pink = true;
  G.cars.push(makeCar(860, 985, '#ffd400', { quest: true, angle: 0 })); // yellow delivery truck
  const arm = makeCar(1500, 940, '#5a6a7a', { armoured: true, hp: 300 }); arm.edge = 18; arm.t = 0.2; G.cars.push(arm); G.truck = arm;
  for (let i = 0; i < 14; i++) G.cars.push(makeCar(0, 0, choice(CAR_PAINT), { traffic: true }));
  G.cars.filter(c => c.traffic).forEach(c => { const [a, b] = ROADS[c.edge]; const A = pt(a), B = pt(b); c.x = A.x + (B.x - A.x) * c.t; c.y = A.y + (B.y - A.y) * c.t; c.angle = Math.atan2(B.y - A.y, B.x - A.x) + (c.dir < 0 ? Math.PI : 0); });
  for (let i = 0; i < 20; i++) { let x, y; do { x = between(150, MAP_W - 150); y = between(150, 2000); } while (hitsHouse(x, y, 16) || inLake(x, y) || rectClearance(x - 16, y - 16, 32, 32) < 40); G.walkers.push({ x, y, angle: between(0, 6.28), speed: between(20, 45), hp: 50, tx: x, ty: y, wait: between(0, 2) }); }
  G.gangLeft = 0; G.shipIdx = 0; G.shipTimer = 150; G.vault = 0; G.vaultTier = 0; G.bagOut = false; G.bagTaken = false; G.truckHp = 300;
  refreshObjective();
}
function nearestCar(x, y, maxD) { let best = null, bd = maxD; for (const c of G.cars) { if (c.dead) continue; const d = hyp(x, y, c.x, c.y); if (d < bd) { bd = d; best = c; } } return best; }

// ---------------- Movement: WALL SLIDING ----------------
// Axis-separated collision: move X first, then Y. A wall blocks one axis
// only, so the other axis still moves — cars slide along buildings instead
// of dead-stopping on impact.
function slideMove(e, dx, dy, r) {
  const nx = e.x + dx;
  if (!hitsHouse(nx, e.y, r) && !inLake(nx, e.y) && !inSea(nx, e.y)) e.x = nx;
  const ny = e.y + dy;
  if (!hitsHouse(e.x, ny, r) && !inLake(e.x, ny) && !inSea(e.x, ny)) e.y = ny;
}
// ---------------- Input ----------------
const keys = {}; const mouse = { x: 640, y: 360, down: false };
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
    if (G.mode === 'play') { G.mode = 'pause'; el('pauseStats').textContent = statsLine(); el('pauseMenu').classList.remove('hidden'); }
    else if (G.mode === 'pause') { G.mode = 'play'; el('pauseMenu').classList.add('hidden'); }
  }
  if (e.key.toLowerCase() === 'e' && G.mode === 'play') interact();
  if (e.key.toLowerCase() === 'h' && G.mode === 'play') { sfx.horn(); toast('哔——！'); }
  if (e.key.toLowerCase() === 'm' && G.mode === 'play') { radioOn = !radioOn; toast(radioOn ? '电台：开启（合成音乐）' : '电台：关闭'); }
  if (['1', '2', '3', '4'].includes(e.key) && G.mode === 'play') { const i = +e.key - 1; if (G.owned[i]) { G.hero.weapon = i; toast('武器：' + GUNS[i].name); } }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (cv.width / r.width); mouse.y = (e.clientY - r.top) * (cv.height / r.height); });
cv.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
addEventListener('mouseup', () => { mouse.down = false; });
if ('ontouchstart' in window) {
  el('touch').style.display = 'block';
  el('tEnter').onclick = () => interact();
  el('tFire').onclick = () => { mouse.down = true; setTimeout(() => mouse.down = false, 120); };
  el('tRun').onclick = () => { keys['shift'] = true; setTimeout(() => keys['shift'] = false, 600); };
}
// E interaction: a vehicle within 52px beats dialogue (56px radius).
function interact() {
  const h = G.hero;
  if (h.inCar) { const c = h.inCar; h.inCar = null; c.speed = 0; h.x = c.x + 34; h.y = c.y; toast('已下车'); return; }
  const car = nearestCar(h.x, h.y, 88);
  if (car && hyp(h.x, h.y, car.x, car.y) <= 52) { boardCar(car); return; }
  const nearSpot = s => hyp(h.x, h.y, s.x + s.w / 2, s.y + s.h / 2) < Math.max(s.w, s.h) / 2 + 56;
  if (nearSpot(BAR)) {
    if (G.chapter === 1 && G.stage === 0) { G.stage = 1; refreshObjective(); showDlg('龙叔：“阿杰，回来啦。先去东边枪店取把手枪防身，取到了再回来见我。”<br><button class="btn" onclick="document.getElementById(\'dlg\').classList.add(\'hidden\')">出发</button>'); }
    else if (G.chapter === 1 && G.stage === 2) finishChapter(1);
    else if (G.chapter === 2 && G.stage === 2) finishChapter(2);
    else showDlg('龙叔：“按左上角目标走，遇到麻烦就开车甩掉他们。”<br><button class="btn" onclick="document.getElementById(\'dlg\').classList.add(\'hidden\')">知道了</button>');
    return;
  }
  if (nearSpot(GUN)) {
    if (G.chapter === 1 && G.stage === 1) { G.owned[1] = true; G.ammo[1] = 120; G.hero.weapon = 1; G.stage = 2; refreshObjective(); sfx.pickup(); showDlg('枪店老板：“手枪给你，子弹 120 发。回酒吧见龙叔。”<br><button class="btn" onclick="document.getElementById(\'dlg\').classList.add(\'hidden\')">收下</button>'); }
    else {
      showShop('<b>枪店</b><br>子弹 $50<button class="btn" id="shAmmo">买</button><br>冲锋枪 $800<button class="btn" id="shSmg">买</button><br>霰弹枪 $600<button class="btn" id="shSg">买</button><br>防弹衣 $300<button class="btn" id="shAr">买</button><br><button class="btn ghost" onclick="document.getElementById(\'shop\').classList.add(\'hidden\')">关闭</button>');
      el('shAmmo') && (el('shAmmo').onclick = () => { if (G.money >= 50) { G.money -= 50; G.ammo[G.hero.weapon] += 30; toast('子弹 +30'); } else toast('钱不够'); });
      el('shSmg') && (el('shSmg').onclick = () => { if (G.money >= 800) { G.money -= 800; G.owned[2] = true; G.ammo[2] = 240; toast('已购冲锋枪'); } else toast('钱不够'); });
      el('shSg') && (el('shSg').onclick = () => { if (G.money >= 600) { G.money -= 600; G.owned[3] = true; G.ammo[3] = 40; toast('已购霰弹枪'); } else toast('钱不够'); });
      el('shAr') && (el('shAr').onclick = () => { if (G.money >= 300) { G.money -= 300; G.hero.armor = 100; toast('防弹衣已穿'); } else toast('钱不够'); });
    }
    return;
  }
  if (nearSpot(CLINIC)) { if (G.money >= 100) { G.money -= 100; G.hero.hp = 100; toast('已治疗，生命回满'); } else toast('治疗要 $100，钱不够'); return; }
  if (nearSpot(GARAGE)) { if (G.money >= 200) { G.money -= 200; G.wanted = 0; G.cops = []; G.heli = null; toast('已喷漆，通缉清零'); } else toast('喷漆要 $200，钱不够'); return; }
  if (nearSpot(BANK) && G.chapter === 6) { toast('在金库门口站住坚守，警察会来，别离开太远'); return; }
  if (car) boardCar(car);
}
function boardCar(car) {
  const h = G.hero;
  if (car.quest && G.chapter !== 4) { toast('这是送货货车，第四章才能开'); return; }
  if (car.armoured) { toast('运钞车锁着，撞停它再说'); return; }
  h.inCar = car; car.traffic = false;
  if (car.quest) toast('送货货车，出发！'); // quest truck is never "stolen"
  else if (car.pink) { toast('粉色跑车到手！开回酒吧'); if (G.chapter === 2) { G.stage = 1; refreshObjective(); } }
  else if (!car.owned) { G.stats.stolen++; addWanted(1); toast('偷车！通缉 +1★'); }
  else toast('上车了');
  sfx.horn();
}
// ---------------- Combat ----------------
function fireWeapon() {
  const h = G.hero, w = GUNS[h.weapon];
  if (h.fireCd > 0) return;
  if (h.weapon > 0 && G.ammo[h.weapon] <= 0) { toast('没子弹了，去枪店买'); h.fireCd = 0.3; return; }
  h.fireCd = w.rate; G.stats.fired++;
  if (h.weapon > 0) G.ammo[h.weapon]--;
  const a = h.angle; sfx.shoot(); G.shake = Math.max(G.shake, 2);
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) { const aa = a + (i - (n - 1) / 2) * 0.07 + rnd() * 0.02; G.shots.push({ x: h.x + Math.cos(a) * 22, y: h.y + Math.sin(a) * 22, vx: Math.cos(aa) * 620, vy: Math.sin(aa) * 620, dmg: w.dmg, life: w.range / 620, foe: false }); }
}
function hurtHero(dmg) {
  const h = G.hero;
  if (h.armor > 0) { const ab = Math.min(h.armor, dmg); h.armor -= ab; dmg -= ab; }
  h.hp -= dmg; G.flash = 0.5; G.shake = Math.max(G.shake, 4);
  if (h.hp <= 0) wasted();
}

// ---------------- Update ----------------
let lastT = performance.now();
function update(dt) {
  if (G.mode !== 'play') return;
  G.clock += dt * 2;
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.flash > 0) G.flash -= dt;
  if (G.shake > 0) G.shake -= dt * 8;
  const h = G.hero;
  const wx = G.camX + (mouse.x - cv.width / 2), wy = G.camY + (mouse.y - cv.height / 2);
  h.angle = Math.atan2(wy - h.y, wx - h.x);
  if (h.fireCd > 0) h.fireCd -= dt;
  if (mouse.down && !h.inCar) fireWeapon();
  // --- walk / drive ---
  if (h.inCar) {
    const c = h.inCar;
    const fwd = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 0.55 : 0);
    const steer = (keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0);
    if (keys[' ']) c.speed *= Math.pow(0.02, dt);
    c.speed += fwd * 260 * dt; c.speed *= Math.pow(0.4, dt); c.speed = clamp(c.speed, -120, 340);
    if (Math.abs(c.speed) > 5) c.angle += steer * 1.9 * dt * Math.sign(c.speed) * (Math.abs(c.speed) / 200 + 0.3);
    const ox = c.x, oy = c.y;
    slideMove(c, Math.cos(c.angle) * c.speed * dt, Math.sin(c.angle) * c.speed * dt, 20);
    if (Math.abs(c.x - ox) < 0.01 && Math.abs(c.y - oy) < 0.01 && Math.abs(c.speed) > 40) c.speed *= 0.92; // wedged: bleed speed
    G.stats.driven += hyp(ox, oy, c.x, c.y) / 40;
    h.x = c.x; h.y = c.y; h.angle = c.angle;
    if (keys[' '] && Math.abs(c.speed) > 60 && rnd() < 0.5) G.shots.push({ x: c.x, y: c.y, vx: 0, vy: 0, dmg: 0, life: 0.01, foe: false, mark: true });
  } else {
    const sp = (keys['shift'] ? 5.2 : 3.2) * 60 * dt;
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1; if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1; if (keys['d'] || keys['arrowright']) dx += 1;
    if (dx || dy) { const L = Math.hypot(dx, dy); slideMove(h, dx / L * sp, dy / L * sp, 14); }
  }
  // --- autopilot (driving test): BFS route, steer node to node ---
  if (G.pilot) {
    const ap = G.pilot;
    if (!ap.path || ap.idx >= ap.path.length) {
      G.pilot = null;
      if (G.testMode && G.testMode !== 'ch4') { G.testResult = 'DRIVE OK arrived ' + Math.round(G.testClock) + 's'; finishTest(); }
    } else {
      const tgt = pt(ap.path[ap.idx]);
      const c = h.inCar;
      if (!c) G.pilot = null;
      else {
        const d = hyp(c.x, c.y, tgt.x, tgt.y);
        if (d < 90) { ap.idx++; if (ap.idx >= ap.path.length) { G.pilot = null; if (G.testMode !== 'ch4') { G.testResult = 'DRIVE OK arrived ' + Math.round(G.testClock) + 's'; finishTest(); } } }
        else {
          const want = Math.atan2(tgt.y - c.y, tgt.x - c.x), diff = wrapAngle(want, c.angle);
          c.angle += clamp(diff, -4.5 * dt, 4.5 * dt);
          const targetSpeed = Math.abs(diff) > 0.7 ? 110 : (d < 100 ? 170 : 330);
          c.speed += clamp(targetSpeed - c.speed, -300 * dt, 260 * dt);
          const ox = c.x, oy = c.y;
          slideMove(c, Math.cos(c.angle) * c.speed * dt, Math.sin(c.angle) * c.speed * dt, 20);
          G.stats.driven += hyp(ox, oy, c.x, c.y) / 40;
          h.x = c.x; h.y = c.y;
        }
      }
      G.testClock += dt;
      if (G.testClock > 60 && G.testMode !== 'ch4' && ap.path) { G.testResult = 'DRIVE FAIL timeout'; G.pilot = null; finishTest(); }
    }
  }
  // --- traffic: drive segment by segment, pick a random road at each junction ---
  for (const c of G.cars) {
    if (!c.traffic || c.dead) continue;
    const [a, b] = ROADS[c.edge]; const A = pt(a), B = pt(b);
    const len = hyp(A.x, A.y, B.x, B.y) || 1, step = 55 * dt / len;
    c.t += step * c.dir;
    if (c.t >= 1 || c.t <= 0) {
      const atNode = c.t >= 1 ? b : a;
      const opts = ROADS.map((e, i) => ({ e, i })).filter(o => o.e[0] === atNode || o.e[1] === atNode);
      const o = choice(opts); c.edge = o.i; const [na, nb] = o.e; c.dir = na === atNode ? 1 : -1; c.t = c.dir > 0 ? 0 : 1;
    }
    const [na, nb] = ROADS[c.edge]; const NA = pt(na), NB = pt(nb);
    c.x = NA.x + (NB.x - NA.x) * c.t; c.y = NA.y + (NB.y - NA.y) * c.t;
    c.angle = Math.atan2(NB.y - NA.y, NB.x - NA.x) + (c.dir < 0 ? Math.PI : 0);
  }
  if (G.truck && !G.truck.dead && G.truckHp > 0) G.truck.traffic = true; // armoured truck keeps looping
  // --- pedestrians wander ---
  for (const w of G.walkers) {
    if (w.wait > 0) { w.wait -= dt; continue; }
    if (hyp(w.x, w.y, w.tx, w.ty) < 8) { w.tx = clamp(w.x + between(-160, 160), 80, MAP_W - 80); w.ty = clamp(w.y + between(-160, 160), 80, 2000); w.wait = between(0, 1.5); continue; }
    w.angle = Math.atan2(w.ty - w.y, w.tx - w.x);
    slideMove(w, Math.cos(w.angle) * w.speed * dt, Math.sin(w.angle) * w.speed * dt, 12);
  }
  // --- bullets (foe bullets never hit their own shooter) ---
  for (const b of G.shots) {
    if (b.mark) continue;
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.foe) continue;
    if (hitsHouse(b.x, b.y, 2)) { b.life = 0; continue; }
    for (const e of G.foes) if (e.hp > 0 && hyp(b.x, b.y, e.x, e.y) < 20) { e.hp -= b.dmg; G.stats.landed++; b.life = 0; sfx.hit(); if (e.hp <= 0) { G.money += 80; G.gangLeft = Math.max(0, G.gangLeft - 1); refreshObjective(); if (G.chapter === 3 && G.gangLeft <= 0) finishChapter(3); } }
    if (G.truck && G.chapter === 5 && !G.bagOut && hyp(b.x, b.y, G.truck.x, G.truck.y) < 30) { G.truckHp -= b.dmg; G.stats.landed++; b.life = 0; if (G.truckHp <= 0) dropBag(); }
    for (const pc of G.cops) if (pc.hp > 0 && hyp(b.x, b.y, pc.x, pc.y) < 20) { pc.hp -= b.dmg; G.stats.landed++; b.life = 0; addWanted(1); if (pc.hp <= 0) pc.dead = true; }
    for (const w of G.walkers) if (w.hp > 0 && hyp(b.x, b.y, w.x, w.y) < 16) { w.hp -= b.dmg; G.stats.landed++; b.life = 0; addWanted(1); if (w.hp <= 0) { w.hp = 0; w.wait = 999; } }
  }
  G.shots = G.shots.filter(b => b.life > 0);
  // --- gang / foe behaviour ---
  for (const e of G.foes) {
    if (e.hp <= 0) continue;
    const d = hyp(e.x, e.y, h.x, h.y);
    if (d > 320) { const a = Math.atan2(h.y - e.y, h.x - e.x); slideMove(e, Math.cos(a) * 70 * dt, Math.sin(a) * 70 * dt, 14); }
    else if (d < 26) hurtHero(8 * dt * 3);
    else if (rnd() < dt * 0.35) { const a = Math.atan2(h.y - e.y, h.x - e.x); G.shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, dmg: 5, life: 1.2, foe: true }); }
  }
  for (const b of G.shots) if (b.foe && hyp(b.x, b.y, h.x, h.y) < 16) { hurtHero(b.dmg); b.life = 0; }
  // --- hidden packages ---
  for (const pk of G.packs) if (!pk.got && hyp(h.x, h.y, pk.x, pk.y) < 28) { pk.got = true; G.money += 100; G.rep += 2; sfx.pickup(); toast('隐藏包裹！+$100（' + G.packs.filter(q => q.got).length + '/20）'); }
  updateMissions(dt);
  updatePolice(dt);
  if (radioOn) { radioTick -= dt; if (radioTick <= 0) { radioTick = 0.22; tone(choice([262, 330, 392, 523, 440]), 0.18, 'triangle', 0.03); } }
  G.camX = clamp(h.x, 640, MAP_W - 640); G.camY = clamp(h.y, 360, MAP_H - 360);
}
function dropBag() {
  const c = G.truck; c.dead = true; c.traffic = false; G.bagOut = true; G.bagAt = { x: c.x + 40, y: c.y };
  addWanted(2); showBanner('运钞车停下了！捡绿色钱袋'); sfx.coin();
}
function updateMissions(dt) {
  const h = G.hero;
  if (G.chapter === 3 && G.gangLeft === 0 && G.stage === 0) {
    G.stage = 1; G.foes = [];
    for (let i = 0; i < 7; i++) G.foes.push({ x: MARKET.x + 20 + rnd() * (MARKET.w - 40), y: MARKET.y + 20 + rnd() * (MARKET.h - 40), hp: 60 });
    G.gangLeft = 7; refreshObjective(); showBanner('鲨鱼帮来了！击败 7 人');
    showDlg('龙叔：“鲨鱼帮在夜市闹事，去教训他们 7 个。”<br><button class="btn" onclick="document.getElementById(\'dlg\').classList.add(\'hidden\')">开打</button>');
  }
  if (G.chapter === 4) {
    const q = G.cars.find(c => c.quest);
    if (G.stage === 0) { if (h.inCar === q) { G.stage = 1; G.shipTimer = 150; refreshObjective(); showBanner('送货开始！150 秒，4 个点'); } }
    else {
      G.shipTimer -= dt;
      const p = DELIVERY_POINTS[G.shipIdx];
      if (h.inCar === q && hyp(h.x, h.y, p[0], p[1]) < 100) {
        G.shipIdx++; G.money += 150; sfx.coin();
        if (G.shipIdx >= 4) finishChapter(4); else { refreshObjective(); showBanner('已送 ' + G.shipIdx + '/4'); }
      }
      if (G.shipTimer <= 0) { G.shipTimer = 150; G.shipIdx = 0; G.stage = 0; refreshObjective(); showBanner('超时！回货车重新开始'); toast('送货超时，已重置'); }
      refreshObjective();
    }
  }
  if (G.chapter === 5) {
    if (G.bagOut && !G.bagTaken && hyp(h.x, h.y, G.bagAt.x, G.bagAt.y) < 30) { G.bagTaken = true; G.money += 2000; G.gold += 2; sfx.coin(); showBanner('钱袋到手！甩掉警察'); refreshObjective(); }
    if (G.bagTaken && G.wanted === 0) finishChapter(5);
  }
  if (G.chapter === 6) {
    const inZone = hyp(h.x, h.y, BANK.x + 65, BANK.y + 45) < 130;
    if (G.vault < 45 && inZone && !h.inCar) {
      G.vault += dt;
      const tier = Math.floor(G.vault / 15); // wanted rises at most once per 15s tier
      if (tier > G.vaultTier) { G.vaultTier = tier; addWanted(1); }
      refreshObjective();
    }
    if (G.vault >= 45 && hyp(h.x, h.y, DOCK.x, DOCK.y) < 90 && G.wanted === 0) finishChapter(6);
    if (G.vault >= 45) refreshObjective();
  }
  if (G.chapter === 2 && G.stage === 1 && hyp(h.x, h.y, BAR.x + 60, BAR.y + 40) < 110 && h.inCar && h.inCar.pink) {
    G.stage = 2; h.inCar = null; finishChapter(2);
  }
}
function updatePolice(dt) {
  const h = G.hero;
  const wantN = G.wanted === 0 ? 0 : G.wanted <= 2 ? 2 : G.wanted <= 3 ? 3 : 4;
  while (G.cops.length < wantN) G.cops.push({ x: h.x + between(-500, 500), y: h.y + between(-500, 500), hp: 80, dead: false });
  if (G.cops.length > wantN) G.cops.length = wantN;
  if (G.wanted >= 5 && !G.heli) G.heli = { x: h.x, y: h.y };
  if (G.wanted < 5) G.heli = null;
  let anyNear = false;
  for (const pc of G.cops) {
    if (pc.dead) continue;
    const d = hyp(pc.x, pc.y, h.x, h.y); if (d < 420) anyNear = true;
    const a = Math.atan2(h.y - pc.y, h.x - pc.x);
    slideMove(pc, Math.cos(a) * 95 * dt, Math.sin(a) * 95 * dt, 14);
    if (d < 24 && !h.inCar) { hurtHero(5 * dt * 3); G.bustedTimer += dt; if (G.bustedTimer > 2.2) { G.bustedTimer = 0; busted(); } }
    else if (d > 60) G.bustedTimer = Math.max(0, G.bustedTimer - dt);
  }
  if (G.heli) { G.heli.x += (h.x - G.heli.x) * dt * 0.8; G.heli.y += (h.y - G.heli.y) * dt * 0.8; }
  if (G.wanted > 0) {
    if (!anyNear) { G.outOfSight += dt; if (G.outOfSight > 7) { G.wanted--; G.outOfSight = 0; refreshObjective(); toast('通缉 -1★，现在 ' + G.wanted + '★'); } }
    else G.outOfSight = 0;
  }
}

// ---------------- Render ----------------
function districtAt(x, y) {
  if (y > BEACH_Y) return '南海滩';
  if (x > PORT.x - 40 && y > PORT.y - 40) return '港口工业区';
  if (x > PARK.x && x < PARK.x + PARK.w && y > PARK.y && y < PARK.y + PARK.h) return '中央公园';
  if (x > MARKET.x && x < MARKET.x + MARKET.w && y > MARKET.y && y < MARKET.y + MARKET.h) return '夜市广场';
  if (x > 1300 && x < 2300 && y < 900) return '市中心';
  if (x < 800 && y > 1400) return '住宅区';
  return '罪恶都市';
}
function drawCarShape(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  ctx.fillStyle = c.colour; ctx.fillRect(-22, -11, 44, 22);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-4, -10, 12, 20);
  if (c.quest) { ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3; ctx.strokeRect(-24, -13, 48, 26); ctx.fillStyle = '#ffd400'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('送货货车', 0, -16); }
  if (c.owned) { ctx.fillStyle = '#00d0d0'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('你的车', 0, -16); }
  if (c.pink) { ctx.fillStyle = '#ff69b4'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('粉色跑车', 0, -16); }
  ctx.restore();
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (G.mode === 'menu') return;
  const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  const ox = cv.width / 2 - G.camX + sx, oy = cv.height / 2 - G.camY + sy;
  ctx.save(); ctx.translate(ox, oy);
  ctx.fillStyle = '#3f7a44'; ctx.fillRect(0, 0, MAP_W, BEACH_Y);
  ctx.fillStyle = '#e8d8a0'; ctx.fillRect(0, BEACH_Y, MAP_W, SEA_Y - BEACH_Y);
  ctx.fillStyle = '#1a6fb0'; ctx.fillRect(0, SEA_Y, MAP_W, MAP_H - SEA_Y);
  ctx.fillStyle = '#2f6b33'; ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
  ctx.fillStyle = '#2a9fd8'; ctx.beginPath(); ctx.ellipse(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a7a5a'; ctx.fillRect(MARKET.x, MARKET.y, MARKET.w, MARKET.h);
  ctx.fillStyle = '#6a6a72'; ctx.fillRect(PORT.x, PORT.y, PORT.w, PORT.h);
  ctx.fillStyle = '#8a6a42'; ctx.fillRect(DOCK.x - 14, DOCK.y, 28, 150);
  ctx.fillStyle = '#555'; for (const l of LOTS) ctx.fillRect(l.x, l.y, l.w, l.h);
  ctx.strokeStyle = '#2b2b33'; ctx.lineCap = 'round';
  for (const [a, b] of ROADS) { const A = pt(a), B = pt(b); ctx.lineWidth = 64; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
  ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 2; ctx.setLineDash([18, 18]);
  for (const [a, b] of ROADS) { const A = pt(a), B = pt(b); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
  ctx.setLineDash([]);
  for (const t of TREES) { ctx.fillStyle = t.palm ? '#2a8a3a' : '#1f6b2a'; ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#6a4a22'; ctx.fillRect(t.x - 2, t.y - 2, 4, 4); }
  for (const c of CRATES) { ctx.fillStyle = c.colour; ctx.fillRect(c.x, c.y, c.w, c.h); }
  for (const b of HOUSES) {
    ctx.fillStyle = '#222'; ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = b.colour; ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.roof === 1) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10); }
    if (b.roof === 2) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w / 2, b.y); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.fill(); }
    if (b.roof === 3) { ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) ctx.fillRect(b.x + 8 + i * 14, b.y + 8, 8, b.h - 16); }
    if (b.label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 4); }
  }
  for (const pk of G.packs) { if (pk.got) continue; ctx.fillStyle = '#ffd700'; ctx.fillRect(pk.x - 7, pk.y - 7, 14, 14); ctx.fillStyle = '#000'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', pk.x, pk.y + 4); }
  const mk = missionSpot();
  if (mk && G.chapter <= 6) {
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 26 + Math.sin(performance.now() / 300) * 5, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,46,136,.18)'; ctx.fillRect(mk.x - 8, mk.y - 400, 16, 400);
    ctx.fillStyle = '#ff2e88'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▼', mk.x, mk.y - 34);
  }
  for (const c of G.cars) { if (c.dead && c.armoured) continue; drawCarShape(c); }
  for (const w of G.walkers) { if (w.hp <= 0) continue; ctx.fillStyle = '#f0d0a0'; ctx.beginPath(); ctx.arc(w.x, w.y, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#ddd'; ctx.fillRect(w.x - 8, w.y - 6, 16, 10); }
  for (const e of G.foes) {
    if (e.hp <= 0) continue;
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(e.x - 14, e.y - 22, 28, 5);
    ctx.fillStyle = '#f00'; ctx.fillRect(e.x - 14, e.y - 22, 28 * e.hp / 60, 5);
  }
  for (const pc of G.cops) { if (pc.dead) continue; ctx.fillStyle = '#2244aa'; ctx.beginPath(); ctx.arc(pc.x, pc.y, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('警', pc.x, pc.y + 3); }
  if (G.heli) { ctx.fillStyle = 'rgba(255,255,180,.25)'; ctx.beginPath(); ctx.arc(G.hero.x, G.hero.y, 90, 0, 7); ctx.fill(); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(G.heli.x, G.heli.y, 14, 0, 7); ctx.fill(); }
  if (G.bagOut && !G.bagTaken) { ctx.fillStyle = '#00c853'; ctx.beginPath(); ctx.arc(G.bagAt.x, G.bagAt.y, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', G.bagAt.x, G.bagAt.y + 4); }
  const h = G.hero;
  if (!h.inCar) { ctx.fillStyle = '#ff5da2'; ctx.beginPath(); ctx.arc(h.x, h.y, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(h.angle) * 22, h.y + Math.sin(h.angle) * 22); ctx.stroke(); }
  for (const b of G.shots) { if (b.mark) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(b.x - 6, b.y - 2, 12, 4); } else { ctx.fillStyle = '#ffe14d'; ctx.fillRect(b.x - 3, b.y - 3, 6, 6); } }
  ctx.restore();
  if (G.flash > 0 || h.hp < 30) { ctx.fillStyle = `rgba(255,0,0,${h.hp < 30 ? 0.14 + 0.08 * Math.sin(performance.now() / 200) : G.flash * 0.4})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  drawHud(); drawMinimap();
  if (G.bannerT > 0) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 90, cv.width, 44); ctx.fillStyle = '#ffd166'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(G.banner, cv.width / 2, 120); }
  const car = nearestCar(h.x, h.y, 88);
  if (G.mode === 'play' && !h.inCar && car && hyp(h.x, h.y, car.x, car.y) <= 52) { ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('按 E 上车', cv.width / 2, cv.height - 90); }
  else if (G.mode === 'play' && !h.inCar && hyp(h.x, h.y, BAR.x + 60, BAR.y + 40) < 120) { ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('按 E 对话 / 接任务', cv.width / 2, cv.height - 90); }
}
function drawHud() {
  const h = G.hero;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 10, 330, 118);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  const hh = Math.floor(G.clock / 60) % 24, mm = Math.floor(G.clock) % 60;
  ctx.fillText(`❤ ${Math.ceil(h.hp)}  🛡 ${Math.ceil(h.armor)}  💰 $${G.money}  ★ ${'★'.repeat(G.wanted)}${'☆'.repeat(5 - G.wanted)}`, 20, 32);
  ctx.fillText(`声望 ${G.rep}  金块 ${G.gold}  时间 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 20, 56);
  const w = GUNS[h.weapon];
  ctx.fillText(`武器 ${w.name}  弹药 ${G.ammo[h.weapon] === Infinity ? '∞' : G.ammo[h.weapon]}  [1-4切换]`, 20, 80);
  ctx.fillStyle = '#ffd166'; ctx.fillText('目标：' + G.objective, 20, 104);
  ctx.fillStyle = '#9fd8ff'; ctx.font = '13px sans-serif'; ctx.fillText('📍 ' + districtAt(h.x, h.y) + '   第 ' + Math.min(G.chapter, 6) + ' 章 / 6', 20, 122);
  if (h.inCar) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cv.width - 190, cv.height - 70, 180, 56); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(Math.round(Math.abs(h.inCar.speed) * 0.9) + ' km/h', cv.width - 175, cv.height - 36); ctx.font = '13px sans-serif'; ctx.fillText('空格手刹 · E 下车', cv.width - 175, cv.height - 18); }
}
function drawMinimap() {
  const s = 150 / MAP_W, mx = cv.width - 170, my = 14;
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(mx - 4, my - 4, 158, 118);
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
  for (const [a, b] of ROADS) { const A = pt(a), B = pt(b); ctx.beginPath(); ctx.moveTo(mx + A.x * s, my + A.y * s); ctx.lineTo(mx + B.x * s, my + B.y * s); ctx.stroke(); }
  const mk = missionSpot();
  if (mk) { ctx.fillStyle = '#ff2e88'; ctx.fillRect(mx + mk.x * s - 3, my + mk.y * s - 3, 6, 6); }
  ctx.fillStyle = '#00d0d0'; ctx.fillRect(mx + G.hero.x * s - 3, my + G.hero.y * s - 3, 6, 6);
  for (const pc of G.cops) if (!pc.dead) { ctx.fillStyle = '#4488ff'; ctx.fillRect(mx + pc.x * s - 2, my + pc.y * s - 2, 4, 4); }
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('N ↑', mx + 4, my + 112);
}
// ---------------- Loop, menus, shots & tests ----------------
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  try { update(dt); } catch (e) { console.error(e); } // one bad frame must never freeze the game
  render();
  requestAnimationFrame(frame);
}
function resize() { cv.width = innerWidth; cv.height = innerHeight; }
addEventListener('resize', resize); resize();
function startGame(slot) {
  if (slot !== undefined && SLOTS[slot]) { loadSlot(slot); return; }
  G = newGame(); buildWorld(); G.mode = 'play'; hideMenus(); refreshObjective();
  toast('新游戏开始：去酒吧见龙叔');
}
el('btnNew').onclick = () => startGame();
el('btnContinue').onclick = () => { if (SLOTS[0]) loadSlot(0); else startGame(); };
el('btnSlot2').onclick = () => startGame(1);
el('btnSlot3').onclick = () => startGame(2);
el('btnExport').onclick = exportSave;
el('btnImport').onclick = () => el('fileImport').click();
el('fileImport').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); SLOTS[0] = JSON.stringify(d); loadSlot(0); } catch (err) { toast('导入失败'); } }; r.readAsText(f); };
el('btnResume').onclick = () => { G.mode = 'play'; el('pauseMenu').classList.add('hidden'); };
el('btnSave1').onclick = () => saveSlot(0);
el('btnQuit').onclick = () => { G.mode = 'menu'; el('pauseMenu').classList.add('hidden'); el('menu').classList.remove('hidden'); };
el('btnEndContinue').onclick = () => { G.mode = 'play'; el('endMenu').classList.add('hidden'); if (G.chapter > 6) { G.chapter = 7; refreshObjective(); } };
el('btnEndMenu').onclick = () => { G.mode = 'menu'; el('endMenu').classList.add('hidden'); el('menu').classList.remove('hidden'); };
function finishTest() { const t = el('test-result'); t.textContent = 'TEST: ' + (G.testResult || 'done'); document.title = 'TEST: ' + (G.testResult || 'done'); }
window.__VH = {
  get state() { return G; },
  start: startGame,
  teleport(x, y) { G.hero.x = x; G.hero.y = y; if (G.hero.inCar) { G.hero.inCar.x = x; G.hero.inCar.y = y; } },
  setChapter(n) { G.chapter = n; G.stage = 0; G.gangLeft = 0; refreshObjective(); },
  enterNearestCar() { const c = nearestCar(G.hero.x, G.hero.y, 200); if (c) boardCar(c); },
  driveTo(gx, gy) {
    const a = closestPoint(G.hero.x, G.hero.y), b = closestPoint(gx, gy);
    const path = findRoute(a, b);
    if (!path || path.length <= 1 || !G.hero.inCar) return false;
    G.pilot = { path, idx: 1 }; G.testClock = 0; return true;
  },
  roadClearance() {
    let worst = { d: 1e9, b: null };
    for (const b of HOUSES) { const d = rectClearance(b.x, b.y, b.w, b.h); if (d < worst.d) worst = { d: Math.round(d), b: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), label: b.label || '' } }; }
    return worst;
  },
};
// Screenshot modes (?shot=...) and headless playtests (?test=...)
const params = new URLSearchParams(location.search);
const shot = params.get('shot'), test = params.get('test');
if (shot === 'play' || shot === 'action' || shot === 'city') {
  startGame();
  if (shot === 'play') { G.hero.x = 770; G.hero.y = 985; const c = nearestCar(770, 985, 120); if (c) boardCar(c); }
  if (shot === 'action') {
    G.chapter = 3; G.stage = 1; G.gangLeft = 7; G.foes = [];
    for (let i = 0; i < 7; i++) G.foes.push({ x: MARKET.x + 60 + i * 30, y: MARKET.y + 80, hp: 60 });
    G.hero.x = MARKET.x + 100; G.hero.y = MARKET.y + 180; G.hero.hp = 500; G.hero.armor = 100;
    G.owned[1] = true; G.ammo[1] = 120; G.hero.weapon = 1; G.wanted = 2; refreshObjective();
  }
  if (shot === 'city') { G.hero.x = 1500; G.hero.y = 1000; G.camX = 1600; G.camY = 1100; }
  hideMenus();
} else if (shot === 'start') { G.mode = 'menu'; }
else if (test) {
  startGame(); hideMenus();
  if (test === 'move') { G.hero.x = 800; G.hero.y = 1000; G.testResult = 'MOVE OK player at ' + G.hero.x + ',' + G.hero.y; setTimeout(finishTest, 600); }
  if (test === 'drive') {
    G.testMode = 'drive';
    G.hero.x = 770; G.hero.y = 985; const c = nearestCar(770, 985, 120);
    if (c) { boardCar(c); const ok = window.__VH.driveTo(GUN.x + 60, GUN.y + 140); if (!ok) G.testResult = 'DRIVE FAIL no path/car'; }
    else G.testResult = 'DRIVE FAIL no car';
  }
  if (test === 'ch4') {
    G.testMode = 'ch4'; G.chapter = 4; G.stage = 0; refreshObjective();
    const q = G.cars.find(c => c.quest); G.hero.x = q.x; G.hero.y = q.y; boardCar(q);
    let idx = 0;
    const go = () => {
      if (idx >= 4) { G.testResult = 'CH4 ' + (G.chapter === 5 ? 'OK completed' : 'FAIL chapter=' + G.chapter + ' idx=' + G.shipIdx); finishTest(); return; }
      const p = DELIVERY_POINTS[idx];
      const path = findRoute(closestPoint(q.x, q.y), closestPoint(p[0], p[1]));
      if (!path || path.length <= 1) { G.testClock = 0; return; }
      G.pilot = { path, idx: 1 }; G.testClock = 0;
    };
    const poll = setInterval(() => { if (!G.pilot) { clearInterval(poll); go(); } }, 400);
    const poll2 = setInterval(() => {
      if (G.shipIdx > idx) { idx = G.shipIdx; if (idx >= 4) { clearInterval(poll2); G.testResult = 'CH4 OK completed chapter=' + G.chapter; finishTest(); } else go(); }
      if (G.testClock > 140) { clearInterval(poll2); G.testResult = 'CH4 FAIL timeout idx=' + G.shipIdx + ' chapter=' + G.chapter; finishTest(); }
    }, 500);
    go();
  }
  if (test === 'ch5') {
    G.chapter = 5; refreshObjective(); G.owned[2] = true; G.ammo[2] = 500; G.hero.weapon = 2;
    G.hero.x = G.truck.x + 80; G.hero.y = G.truck.y;
    let shots = 0;
    const iv = setInterval(() => {
      if (G.bagOut) {
        clearInterval(iv);
        G.hero.x = G.bagAt.x; G.hero.y = G.bagAt.y;
        setTimeout(() => {
          G.wanted = 0; G.cops = [];
          setTimeout(() => { G.testResult = 'CH5 ' + (G.chapter === 6 ? 'OK completed money=$' + G.money : 'FAIL chapter=' + G.chapter + ' bagTaken=' + G.bagTaken); finishTest(); }, 800);
        }, 800);
        return;
      }
      G.truckHp -= 25; G.stats.landed++; if (G.truckHp <= 0) dropBag();
      shots++; if (shots > 40) { clearInterval(iv); G.testResult = 'CH5 FAIL hp=' + G.truckHp; finishTest(); }
    }, 200);
  }
  if (test === 'ch6') {
    G.testMode = 'ch6'; G.chapter = 6; G.vault = 0; refreshObjective();
    G.hero.x = BANK.x + 65; G.hero.y = BANK.y + 45; G.hero.hp = 1000;
    const iv = setInterval(() => {
      G.cops.forEach(pc => { pc.dead = true; pc.hp = 0; }); G.bustedTimer = 0;
      if (G.vault >= 45) {
        clearInterval(iv);
        G.wanted = 0; G.cops = []; G.hero.x = DOCK.x; G.hero.y = DOCK.y;
        setTimeout(() => { G.testResult = 'CH6 ' + (G.chapter === 7 ? 'OK completed' : 'FAIL chapter=' + G.chapter + ' vault=' + Math.round(G.vault)); finishTest(); }, 600);
        return;
      }
    }, 400);
  }
}
// NOTE: no buildWorld() call here — startGame() spawns the world, and a second
// spawn here would wipe shot/test setups (foes, quest truck, chapter state).
requestAnimationFrame(frame);
