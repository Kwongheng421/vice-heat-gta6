// Vice Heat — open-world crime game, written fresh in the recorded session.
// Top-down 2D canvas game. All systems in this file: movement/driving,
// traffic + pedestrians, wanted/police, 6-chapter story, combat, shops,
// collectibles, HUD + minimap, in-memory saves + export/import (no localStorage).
import { buildCity, WORLD_W, WORLD_H, SEA_Y, BEACH_Y } from './world.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = (parseInt(params.get('seed') || '', 10) || 20261122) >>> 0;
const city = buildCity(seed);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mm = document.getElementById('minimap');
const mmc = mm.getContext('2d');
const $ = id => document.getElementById(id);
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

let AC = null, muted = false;
function beep(freq, dur, type, vol) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.06, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch (e) { /* audio is optional */ }
}
const sShoot = () => beep(220 + Math.random() * 120, 0.08, 'square', 0.05);
const sHit = () => beep(140, 0.12, 'sawtooth', 0.07);
const sPick = () => { beep(660, 0.1, 'sine', 0.07); setTimeout(() => beep(880, 0.12, 'sine', 0.07), 90); };
const sHorn = () => beep(330, 0.25, 'square', 0.08);
let radioOn = false, radioTimer = null;
function toggleRadio() {
  radioOn = !radioOn;
  if (radioOn) { let n = 0; radioTimer = setInterval(() => { if (!radioOn) return; beep([262, 330, 392, 523][n++ % 4], 0.18, 'triangle', 0.04); }, 220); }
  else if (radioTimer) clearInterval(radioTimer);
}

const WEAPONS = [
  { name: '拳头', dmg: 12, rate: 0.32, range: 46, auto: false, ammo: Infinity },
  { name: '手枪', dmg: 22, rate: 0.28, range: 380, auto: false, ammo: 0 },
  { name: '冲锋枪', dmg: 13, rate: 0.09, range: 320, auto: true, ammo: 0 },
  { name: '霰弹枪', dmg: 11, rate: 0.75, range: 240, auto: false, ammo: 0 },
];
const CHAPTERS = [
  '第一章：去东边枪店取手枪',
  '第二章：偷一辆粉色跑车',
  '第三章：夜市火并鲨鱼帮',
  '第四章：150秒送货四站',
  '第五章：劫运钞车夺钱袋',
  '第六章：银行金库坚守45秒',
];
const G = {
  screen: 'title', chapter: 1, step: 0, missionActive: false, missionText: '去龙叔酒吧按 E 接任务',
  target: null, time: 8 * 3600, clock: 0, money: 200, rep: 0,
  hp: 100, armour: 0, wanted: 0, maxWanted: 0, starsTimer: 0, bustedTimer: 0,
  shots: 0, hits: 0, stolen: 0, driveDist: 0, pkgsGot: 0, kills: 0,
  deliveryIdx: 0, deliveryTimer: 0, vaultTimer: 0, gangLeft: 0, moneyBag: null,
  shake: 0, vignette: 0, bannerTimer: 0, ended: false, freeRoam: false,
  camX: 0, camY: 0, zoom: 1,
};
const P = { x: city.bar.x, y: city.bar.y, ang: -Math.PI / 2, vx: 0, vy: 0, speed: 0, car: null, weapon: 0, owned: [true, false, false, false], ammo: [Infinity, 0, 0, 0], fireCd: 0, sprint: false };
const saves = [null, null, null];
const CAR_COLORS = ['#e74c3c', '#f2b134', '#4db2ff', '#9b59b6', '#e67e22', '#2ecc71', '#ecf0f1', '#34495e'];
let cars = [], peds = [], enemies = [], police = [], bullets = [], effects = [], heli = null;
let armoured = null, questTruck = null, pinkCar = null;

function rand(a, b) { return a + Math.random() * (b - a); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function nearCar() {
  let best = null, bd = 88;
  for (const c of cars) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd) { bd = d; best = c; } }
  return best;
}
function spawnCars() {
  cars = [];
  // starter car: cyan, owned, by the bar — driving it is not stealing.
  cars.push({ x: city.bar.x + 52, y: city.bar.y + 26, ang: 0, speed: 0, color: '#2fd6d6', kind: 'car', wasPlayersCar: true, isStarter: true, hp: 100, ai: null });
  questTruck = { x: 0, y: 0, ang: 0, speed: 0, color: '#f2b134', kind: 'truck', isQuestTruck: true, wasPlayersCar: false, hp: 100, ai: null };
  const qt = city.freeSpot(city.bar.x + 108, city.bar.y - 82); questTruck.x = qt.x; questTruck.y = qt.y;
  cars.push(questTruck);
  pinkCar = { x: city.pinkCarSpot.x, y: city.pinkCarSpot.y, ang: 0.4, speed: 0, color: '#ff7ad9', kind: 'sport', isPink: true, wasPlayersCar: false, hp: 100, ai: null };
  cars.push(pinkCar);
  // parked cars along roads
  for (let i = 0; i < 16; i++) {
    const s = city.segs[Math.floor(Math.random() * city.segs.length)];
    const a = city.nodes[s.a], b = city.nodes[s.b], t = Math.random();
    const x = a.x + (b.x - a.x) * t + rand(-14, 14), y = a.y + (b.y - a.y) * t + rand(-14, 14);
    if (Math.hypot(x - city.bar.x, y - city.bar.y) < 90) continue;
    cars.push({ x, y, ang: Math.atan2(b.y - a.y, b.x - a.x), speed: 0, color: CAR_COLORS[i % CAR_COLORS.length], kind: 'car', wasPlayersCar: false, hp: 100, ai: null });
  }
  // traffic cars driving the network
  for (let i = 0; i < 12; i++) {
    const s = city.segs[Math.floor(Math.random() * city.segs.length)];
    cars.push({ x: city.nodes[s.a].x, y: city.nodes[s.a].y, ang: 0, speed: rand(55, 85), color: CAR_COLORS[(i + 2) % CAR_COLORS.length], kind: 'car', wasPlayersCar: false, hp: 100, ai: { seg: s, from: s.a, to: s.b, t: 0 } });
  }
  peds = [];
  for (let i = 0; i < 24; i++) {
    const s = city.segs[Math.floor(Math.random() * city.segs.length)];
    const a = city.nodes[s.a];
    peds.push({ x: a.x + rand(-30, 30), y: a.y + rand(-30, 30), ang: rand(0, 6.28), speed: rand(18, 34), hp: 30, color: ['#ffd23d', '#ff8fa3', '#7fd0ff', '#b5e48c'][i % 4], wander: rand(2, 6) });
  }
  enemies = []; police = []; bullets = []; effects = []; heli = null; armoured = null;
  G.moneyBag = null;
}
function resetGame() {
  Object.assign(G, { screen: 'play', chapter: 1, step: 0, missionActive: false, missionText: '去龙叔酒吧按 E 接任务', target: { x: city.bar.x, y: city.bar.y, label: '龙叔酒吧' }, time: 8 * 3600, money: 200, rep: 0, hp: 100, armour: 0, wanted: 0, maxWanted: 0, starsTimer: 0, bustedTimer: 0, shots: 0, hits: 0, stolen: 0, driveDist: 0, pkgsGot: 0, kills: 0, deliveryIdx: 0, deliveryTimer: 0, vaultTimer: 0, gangLeft: 0, ended: false, freeRoam: false, vignette: 0 });
  P.x = city.bar.x; P.y = city.bar.y; P.ang = -Math.PI / 2; P.vx = 0; P.vy = 0; P.speed = 0; P.car = null;
  P.weapon = 0; P.owned = [true, false, false, false]; P.ammo = [Infinity, 0, 0, 0]; P.fireCd = 0;
  city.packages.forEach(p => p.got = false);
  spawnCars();
  showScreen('play');
}
function completion() { return Math.round(((G.chapter - 1) / 6) * 70 + (G.pkgsGot / 20) * 30); }
function addWanted(n, why) {
  G.wanted = Math.min(5, G.wanted + n); G.maxWanted = Math.max(G.maxWanted, G.wanted); G.starsTimer = 0;
  if (G.wanted >= 3) spawnPolice();
}
function spawnPolice() {
  const want = G.wanted >= 4 ? 3 : G.wanted >= 2 ? 2 : 1;
  while (police.filter(p => p.kind === 'car').length < want) {
    const s = city.segs[Math.floor(Math.random() * city.segs.length)];
    police.push({ kind: 'car', x: city.nodes[s.a].x + rand(-40, 40), y: city.nodes[s.a].y + rand(-40, 40), ang: 0, speed: 0, hp: 60, color: '#2233ff', isPolice: true });
  }
  if (G.wanted >= 3) while (police.filter(p => p.kind === 'foot').length < 2)
    police.push({ kind: 'foot', x: P.x + rand(-260, 260), y: P.y + rand(-260, 260), ang: 0, speed: 62, hp: 40, color: '#2233ff', isPolice: true });
  if (G.wanted >= 5 && !heli) heli = { x: P.x, y: P.y - 200, ang: 0 };
  if (G.wanted >= 4) spawnRoadblocks();
}
let roadblocks = [];
function spawnRoadblocks() {
  roadblocks = [];
  for (let i = 0; i < 3; i++) {
    const n = city.nodes[Math.floor(Math.random() * city.nodes.length)];
    roadblocks.push({ x: n.x, y: n.y });
  }
}
// ---- input ----
const keys = {};
let mouse = { x: 0, y: 0, down: false };
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyM') toggleRadio();
  if (e.code === 'KeyH') { sHorn(); addEffect(P.x, P.y, '♪'); }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.screen === 'play') showScreen('pause'); else if (G.screen === 'pause') showScreen('play'); }
  if (e.code === 'KeyE') doInteract();
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
    const w = Number(e.code.slice(-1)) - 1;
    if (P.owned[w]) { P.weapon = w; }
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
if ('ontouchstart' in window) $('touch').style.display = 'flex';
$('tFire').addEventListener('touchstart', e => { e.preventDefault(); mouse.down = true; }, { passive: false });
$('tFire').addEventListener('touchend', () => { mouse.down = false; });
$('tEnter').addEventListener('touchstart', e => { e.preventDefault(); doInteract(); }, { passive: false });
$('tSprint').addEventListener('touchstart', e => { e.preventDefault(); keys.ShiftLeft = true; }, { passive: false });
$('tSprint').addEventListener('touchend', () => { keys.ShiftLeft = false; });
$('tAim').addEventListener('touchstart', e => { e.preventDefault(); mouse.x = innerWidth / 2; mouse.y = 0; }, { passive: false });

function showDialog(html, ms) {
  const d = $('dialog'); d.innerHTML = html; d.style.display = 'block';
  if (ms) setTimeout(() => { if (d.innerHTML === html) d.style.display = 'none'; }, ms);
}
function hideDialog() { $('dialog').style.display = 'none'; }
function banner(text) {
  const b = $('banner'); b.textContent = text; b.style.display = 'block'; G.bannerTimer = 2.2;
}
function addEffect(x, y, text, color) { effects.push({ x, y, text, color: color || '#fff', t: 0 }); }
function showScreen(name) {
  G.screen = name;
  $('startScreen').style.display = name === 'title' ? 'flex' : 'none';
  $('pauseScreen').style.display = name === 'pause' ? 'flex' : 'none';
  $('endScreen').style.display = (name === 'busted' || name === 'wasted' || name === 'win') ? 'flex' : 'none';
  $('hud').style.display = name === 'play' || name === 'pause' ? 'block' : 'none';
  $('objective').style.display = name === 'play' ? 'block' : 'none';
  if (name === 'pause') $('pauseStats').textContent = statsText();
}
function statsText() {
  const acc = G.shots ? Math.round(G.hits / G.shots * 100) : 0;
  return `章节 ${G.chapter}/6 · 金钱 $${G.money} · 偷车 ${G.stolen} · 命中率 ${acc}% · 驾驶 ${Math.round(G.driveDist)}m · 最高通缉 ${G.maxWanted}★ · 包裹 ${G.pkgsGot}/20 · 完成度 ${completion()}%`;
}
function endGame(kind, title, text) {
  G.screen = kind; $('endTitle').textContent = title; $('endText').textContent = text;
  $('endStats').textContent = statsText(); showScreen(kind);
  if (kind === 'win') { sPick(); }
}

// ---- interaction (E): vehicle <=52px wins over dialogue (56px) ----
function doInteract() {
  if (G.screen !== 'play') return;
  if (P.car) { exitCar(); return; }
  const car = nearCar();
  if (car && Math.hypot(car.x - P.x, car.y - P.y) <= 52) { enterCar(car); return; }
  const dBar = Math.hypot(P.x - city.bar.x, P.y - city.bar.y);
  if (dBar <= 56) { talkBar(); return; }
  if (Math.hypot(P.x - city.gunShop.x, P.y - city.gunShop.y) <= 56) { shopGun(); return; }
  if (Math.hypot(P.x - city.hospital.x, P.y - city.hospital.y) <= 56) {
    if (G.money >= 50 && G.hp < 100) { G.money -= 50; G.hp = 100; showDialog('医院：治疗完成，生命回满。(-$50)', 2500); } else showDialog('医院：治疗 $50，满血不用治。', 2500); return;
  }
  if (Math.hypot(P.x - city.carShop.x, P.y - city.carShop.y) <= 56) {
    if (G.wanted > 0) { G.wanted = 0; police = []; heli = null; roadblocks = []; G.money = Math.max(0, G.money - 80); showDialog('车店：喷漆完成，通缉清零。(-$80)', 2500); }
    else showDialog('车店：喷漆 / 修车。当前没有通缉。', 2500); return;
  }
  if (car) enterCar(car);
}
function enterCar(car) {
  if (P.car) return;
  if (car.ai) car.ai = null;
  P.car = car; P.x = car.x; P.y = car.y;
  if (!car.wasPlayersCar && !car.isStarter) {
    G.stolen++; addWanted(1, 'steal');
    showDialog(car.isPink ? '偷到了粉色跑车！通缉 +1★' : '偷车成功！通缉 +1★', 2200);
  } else {
    showDialog(car.isQuestTruck ? '上了送货货车，按任务点送货。' : '上了你的车。', 1800);
  }
  if (car.isQuestTruck && G.chapter === 4 && G.missionActive && (G.step === 0 || G.step === 1)) { G.step = 2; G.deliveryIdx = 0; G.deliveryTimer = 150; setObjective('开货车去 4 个送货点', deliveryPoint()); }
  if (car.isPink && G.chapter === 2 && G.missionActive) { G.step = 1; setObjective('把粉色跑车开回龙叔酒吧', { x: city.bar.x, y: city.bar.y, label: '龙叔酒吧' }); }
}
function exitCar() {
  if (!P.car) return;
  const c = P.car; P.car = null;
  P.x = c.x + Math.cos(c.ang + Math.PI / 2) * 26; P.y = c.y + Math.sin(c.ang + Math.PI / 2) * 26;
}
function talkBar() {
  if (!G.missionActive) {
    G.missionActive = true; G.step = 0;
    if (G.chapter === 1) { setObjective('去东边枪店取手枪', { x: city.gunShop.x, y: city.gunShop.y, label: '铁锤枪店' }); showDialog('龙叔：去东边枪店，老板有把手枪给你。拿了回来找我。', 4000); }
    else if (G.chapter === 2) { setObjective('去偷粉色跑车', { x: city.pinkCarSpot.x, y: city.pinkCarSpot.y, label: '粉色跑车' }); showDialog('龙叔：北边停着辆粉色跑车，偷回来，开回酒吧。', 4000); }
    else if (G.chapter === 3) { setObjective('去夜市打倒 7 名鲨鱼帮', { x: city.nightMarket.x, y: city.nightMarket.y, label: '夜市广场' }); spawnGang(); showDialog('龙叔：鲨鱼帮在夜市闹事，去教训他们，7 个人一个别放过。', 4000); }
    else if (G.chapter === 4) { setObjective('先上黄色送货货车', { x: questTruck.x, y: questTruck.y, label: '送货货车' }); G.deliveryIdx = 0; G.deliveryTimer = 150; showDialog('龙叔：上那辆黄色货车，150 秒内送完 4 个点，超时算失败。', 4000); }
    else if (G.chapter === 5) { setObjective('截停运钞车', null); spawnArmoured(); showDialog('龙叔：运钞车在城里绕圈，撞停或者打停它，抢钱袋。', 4000); }
    else if (G.chapter === 6) { setObjective('去银行金库坚守 45 秒', { x: city.bank.x, y: city.bank.y, label: '银行' }); G.vaultTimer = 45; showDialog('龙叔：最后一票，银行金库门口守 45 秒，然后甩掉警察去南边码头。', 4000); }
  } else if (G.chapter === 1 && G.step === 2) { completeChapter('第一章完成！龙叔给了你 $200。'); }
  else showDialog('龙叔：按左上角的目标去做，粉色标记就是方向。', 2500);
}
function shopGun() {
  if (G.chapter === 1 && G.missionActive && G.step === 0) {
    P.owned[1] = true; P.ammo[1] = 60; P.weapon = 1; G.step = 2;
    setObjective('拿着手枪回龙叔酒吧', { x: city.bar.x, y: city.bar.y, label: '龙叔酒吧' });
    showDialog('枪店老板：手枪给你了，子弹 60 发。回酒吧找龙叔交差。', 3500); return;
  }
  const menu = [];
  if (!P.owned[2] && G.money >= 300) menu.push('冲锋枪 $300');
  if (!P.owned[3] && G.money >= 400) menu.push('霰弹枪 $400');
  if (P.owned[1] && G.money >= 40) menu.push('手枪子弹 $40');
  if (menu.length === 0) { showDialog('枪店：你已经买齐了，或者钱不够。手枪 $40 子弹，冲锋枪 $300，霰弹枪 $400。', 3000); return; }
  // Buy the first affordable item in the list, one per visit, to keep E simple.
  if (!P.owned[2] && G.money >= 300) { G.money -= 300; P.owned[2] = true; P.ammo[2] = 120; P.weapon = 2; showDialog('买到冲锋枪！子弹 120 发。', 2500); }
  else if (!P.owned[3] && G.money >= 400) { G.money -= 400; P.owned[3] = true; P.ammo[3] = 24; P.weapon = 3; showDialog('买到霰弹枪！子弹 24 发。', 2500); }
  else if (P.owned[1] && G.money >= 40) { G.money -= 40; P.ammo[1] += 60; showDialog('手枪子弹 +60。', 2000); }
}
function spawnGang() {
  enemies = [];
  for (let i = 0; i < 7; i++) {
    const s = city.freeSpot(city.nightMarket.x + (i - 3) * 46, city.nightMarket.y + (i % 2 ? 40 : -40));
    enemies.push({ x: s.x, y: s.y, hp: 50, speed: 58, color: '#8e44ad', isGang: true, fireCd: rand(0.5, 1.5) });
  }
  G.gangLeft = 7;
}
function deliveryPoint() {
  const pts = [{ x: 300, y: 300, label: '送货点 1' }, { x: 1950, y: 900, label: '送货点 2' }, { x: 1250, y: 1450, label: '送货点 3' }, { x: 700, y: 250, label: '送货点 4' }];
  return pts[G.deliveryIdx] || null;
}
function spawnArmoured() {
  armoured = { x: 1200, y: 400, ang: 0, speed: 70, hp: 120, color: '#5d6d7e', kind: 'armoured', ai: { seg: city.segs[0], from: 0, to: 1, t: 0 }, stopped: false };
  cars.push(armoured);
}
function setObjective(text, target) { G.missionText = text; G.target = target; $('objective').textContent = (G.missionActive ? `第 ${G.chapter} 章 · ` : '') + text; }
function completeChapter(msg) {
  G.money += 200; G.rep += 10; banner('MISSION PASSED'); sPick();
  showDialog(msg + ' (+$200)', 4000);
  G.missionActive = false; G.chapter++;
  if (G.chapter > 6) { G.freeRoam = true; endGame('win', '🎉 通关！罪恶都市是你的了', '六章主线全部完成。你现在是这座城市的传奇。继续自由漫游，或回主菜单。'); return; }
  G.step = 0; setObjective('去龙叔酒吧按 E 接下一章', { x: city.bar.x, y: city.bar.y, label: '龙叔酒吧' });
}
// ---- update ----
function fireBullet() {
  if (P.car || P.fireCd > 0) return;
  const w = WEAPONS[P.weapon];
  if (P.weapon > 0 && P.ammo[P.weapon] <= 0) { showDialog('没子弹了，去枪店买。', 1500); return; }
  P.fireCd = w.rate; G.shots++;
  if (P.weapon > 0) P.ammo[P.weapon]--;
  sShoot();
  const ang = P.ang;
  const n = P.weapon === 3 ? 5 : 1;
  for (let i = 0; i < n; i++) {
    const spread = P.weapon === 3 ? (i - 2) * 0.09 : (Math.random() - 0.5) * 0.04;
    bullets.push({ x: P.x + Math.cos(ang) * 20, y: P.y + Math.sin(ang) * 20, vx: Math.cos(ang + spread) * 620, vy: Math.sin(ang + spread) * 620, dmg: w.dmg, life: w.range / 620, fromPlayer: true });
  }
  G.shake = Math.max(G.shake, 3);
}
function stepUpdate(dt) {
  G.time += dt * 12; G.clock += dt;
  if (G.bannerTimer > 0) { G.bannerTimer -= dt; if (G.bannerTimer <= 0) $('banner').style.display = 'none'; }
  // aim
  const rect = canvas.getBoundingClientRect();
  const wx = G.camX + (mouse.x - rect.left), wy = G.camY + (mouse.y - rect.top);
  if (!P.car) P.ang = Math.atan2(wy - P.y, wx - P.x);
  // movement
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  if (P.car) {
    const c = P.car;
    const accel = 150, top = 260;
    if (iy < 0) c.speed = Math.min(top, c.speed + accel * dt);
    else if (iy > 0) c.speed = Math.max(-90, c.speed - accel * dt);
    else c.speed *= (1 - 0.8 * dt);
    if (keys.Space) c.speed *= (1 - 3 * dt);
    if (ix !== 0 && Math.abs(c.speed) > 8) c.ang += ix * 2.1 * dt * Math.sign(c.speed);
    const nx = c.x + Math.cos(c.ang) * c.speed * dt, ny = c.y + Math.sin(c.ang) * c.speed * dt;
    if (!city.blocked(nx, ny, 16) && !city.inSea(nx, ny)) { c.x = nx; c.y = ny; G.driveDist += Math.abs(c.speed) * dt; }
    else { c.speed *= -0.3; }
    P.x = c.x; P.y = c.y; P.ang = c.ang;
    if (Math.abs(c.speed) > 40 && Math.random() < dt * 4) effects.push({ x: c.x, y: c.y, text: '', color: '', t: 0, brake: true });
  } else {
    const sp = sprint ? 235 : 150;
    const len = Math.hypot(ix, iy) || 1;
    const nx = P.x + (ix / len) * sp * dt * (ix || iy ? 1 : 0), ny = P.y + (iy / len) * sp * dt * (ix || iy ? 1 : 0);
    if (!city.blocked(nx, P.y, 13)) P.x = nx;
    if (!city.blocked(P.x, ny, 13)) P.y = ny;
  }
  P.fireCd = Math.max(0, P.fireCd - dt);
  if (mouse.down) fireBullet();
  // traffic
  for (const c of cars) {
    if (c === P.car || !c.ai) continue;
    const a = city.nodes[c.ai.from], b = city.nodes[c.ai.to];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    c.ai.t += c.speed * dt / segLen;
    if (c.ai.t >= 1) {
      c.ai.from = c.ai.to;
      const next = city.adj[c.ai.to];
      c.ai.to = next[Math.floor(Math.random() * next.length)];
      c.ai.t = 0;
    }
    const na = city.nodes[c.ai.from], nb = city.nodes[c.ai.to];
    c.x = na.x + (nb.x - na.x) * c.ai.t; c.y = na.y + (nb.y - na.y) * c.ai.t;
    c.ang = Math.atan2(nb.y - na.y, nb.x - na.x);
  }
  if (armoured && !armoured.stopped && armoured.ai) {
    const a = city.nodes[armoured.ai.from], b = city.nodes[armoured.ai.to];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    armoured.ai.t += armoured.speed * dt / segLen;
    if (armoured.ai.t >= 1) { armoured.ai.from = armoured.ai.to; const nx = city.adj[armoured.ai.to]; armoured.ai.to = nx[Math.floor(Math.random() * nx.length)]; armoured.ai.t = 0; }
    const na = city.nodes[armoured.ai.from], nb = city.nodes[armoured.ai.to];
    armoured.x = na.x + (nb.x - na.x) * armoured.ai.t; armoured.y = na.y + (nb.y - na.y) * armoured.ai.t;
    armoured.ang = Math.atan2(nb.y - na.y, nb.x - na.x);
    if (P.car && Math.hypot(P.car.x - armoured.x, P.car.y - armoured.y) < 40 && Math.abs(P.car.speed) > 120) { armoured.hp -= 40; addEffect(armoured.x, armoured.y, '砰！'); }
  }
  // pedestrians wander, avoid buildings
  for (const pd of peds) {
    pd.wander -= dt;
    if (pd.wander <= 0) { pd.ang = rand(0, 6.28); pd.wander = rand(2, 6); }
    const nx = pd.x + Math.cos(pd.ang) * pd.speed * dt, ny = pd.y + Math.sin(pd.ang) * pd.speed * dt;
    if (!city.blocked(nx, ny, 10) && !city.inLake(nx, ny)) { pd.x = nx; pd.y = ny; }
    else pd.ang += Math.PI / 2;
    if (P.car && Math.hypot(P.x - pd.x, P.y - pd.y) < 26 && Math.abs(P.car.speed) > 60) {
      pd.hp = 0; addWanted(2, 'ped'); addEffect(pd.x, pd.y, '啊！', '#ff8fa3');
      pd.x = rand(200, 2200); pd.y = rand(200, 1300); pd.hp = 30;
    }
  }
  // enemies chase / shoot
  for (const e of enemies) {
    const d = Math.hypot(P.x - e.x, P.y - e.y);
    if (d > 26) { const a = Math.atan2(P.y - e.y, P.x - e.x); e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt; }
    e.fireCd -= dt;
    if (d < 320 && e.fireCd <= 0) {
      e.fireCd = 1.4;
      const a = Math.atan2(P.y - e.y, P.x - e.x);
      bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: 8, life: 1, fromPlayer: false });
    }
  }
  // police
  if (G.wanted > 0) {
    let seen = false;
    for (const po of police) {
      const d = Math.hypot(P.x - po.x, P.y - po.y);
      if (d < 520) seen = true;
      const a = Math.atan2(P.y - po.y, P.x - po.x);
      const sp = po.kind === 'car' ? 150 + G.wanted * 18 : 62;
      po.ang = a;
      const nx = po.x + Math.cos(a) * sp * dt, ny = po.y + Math.sin(a) * sp * dt;
      if (!city.blocked(nx, ny, 14)) { po.x = nx; po.y = ny; }
      if (po.kind === 'foot' && d < 30) { G.bustedTimer += dt; if (G.bustedTimer > 2.2) { endGame('busted', '🚨 被捕了', '警察把你按住了。通缉会清零，重新开始本章。'); return; } }
      else if (po.kind === 'foot') G.bustedTimer = Math.max(0, G.bustedTimer - dt);
      if (po.kind === 'car' && d < 34 && P.car) { P.car.speed *= 0.94; if (Math.random() < dt) { G.hp -= 2; G.vignette = 0.6; } }
    }
    if (!seen) { G.starsTimer += dt; if (G.starsTimer > 7) { G.wanted--; G.starsTimer = 0; if (G.wanted === 0) { police = []; heli = null; } } }
    else G.starsTimer = 0;
    if (G.wanted >= 5 && heli) { heli.x += (P.x - heli.x) * dt * 0.5; heli.y += (P.y - heli.y) * dt * 0.5; }
  }
  // bullets
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (city.blocked(b.x, b.y, 4)) b.life = 0;
    if (b.fromPlayer) {
      for (const e of enemies) if (e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < 18) { e.hp -= b.dmg; b.life = 0; G.hits++; sHit(); addEffect(e.x, e.y, '✖', '#ffd23d'); if (e.hp <= 0) { G.kills++; addEffect(e.x, e.y, '☠', '#ff5b5b'); if (e.isGang) G.gangLeft--; } break; }
      if (b.life > 0) for (const po of police) if (po.hp > 0 && Math.hypot(b.x - po.x, b.y - po.y) < 18) { po.hp -= b.dmg; b.life = 0; G.hits++; addWanted(1, 'police'); if (po.hp <= 0) { po.hp = 0; addEffect(po.x, po.y, '☠'); } break; }
      if (b.life > 0 && armoured && !armoured.stopped && Math.hypot(b.x - armoured.x, b.y - armoured.y) < 26) { armoured.hp -= b.dmg; b.life = 0; G.hits++; if (armoured.hp <= 0) { armoured.stopped = true; armoured.speed = 0; G.moneyBag = { x: armoured.x + 40, y: armoured.y + 20 }; setObjective('下车捡绿色钱袋', { x: G.moneyBag.x, y: G.moneyBag.y, label: '钱袋' }); } }
    } else {
      if (Math.hypot(b.x - P.x, b.y - P.y) < 16) {
        b.life = 0;
        if (G.armour > 0) G.armour = Math.max(0, G.armour - b.dmg); else G.hp -= b.dmg;
        G.vignette = 0.7; G.shake = Math.max(G.shake, 5);
        if (G.hp <= 0) { G.hp = 0; endGame('wasted', '💀 你被打倒了', '生命耗尽。重新开始本章，通缉清零。'); return; }
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0);
  enemies = enemies.filter(e => e.hp > 0);
  police = police.filter(p => p.hp > 0 || p.kind === 'car');
  // packages
  for (const pk of city.packages) if (!pk.got && Math.hypot(P.x - pk.x, P.y - pk.y) < 24) { pk.got = true; G.pkgsGot++; G.money += 50; sPick(); addEffect(pk.x, pk.y, '+$50', '#ffd23d'); }
  // missions progress
  if (G.missionActive) {
    if (G.chapter === 2 && G.step === 1 && !P.car) { /* need car */ }
    if (G.chapter === 2 && G.step === 1 && P.car && P.car.isPink && Math.hypot(P.x - city.bar.x, P.y - city.bar.y) < 130) completeChapter('第二章完成！粉色跑车交货了。');
    if (G.chapter === 3 && G.gangLeft <= 0 && enemies.length === 0) completeChapter('第三章完成！夜市清净了。');
    if (G.chapter === 4) {
      G.deliveryTimer -= dt;
      if (G.deliveryTimer <= 0) { showDialog('送货超时，任务失败，回酒吧重接。', 3500); G.missionActive = false; G.step = 0; setObjective('去龙叔酒吧按 E 重接任务', { x: city.bar.x, y: city.bar.y, label: '龙叔酒吧' }); }
      else if (G.step === 2 && P.car && P.car.isQuestTruck) {
        const pt = deliveryPoint();
        if (pt && Math.hypot(P.x - pt.x, P.y - pt.y) < 85) {
          G.deliveryIdx++; sPick();
          if (G.deliveryIdx >= 4) completeChapter('第四章完成！四站都送到了。');
          else setObjective(`开货车去送货点 ${G.deliveryIdx + 1}（剩 ${Math.ceil(G.deliveryTimer)} 秒）`, deliveryPoint());
        }
      } else if (G.step === 2 && (!P.car || !P.car.isQuestTruck)) {
        showDialog('送货必须开那辆黄色货车！按 E 上车。', 2000);
      }
    }
    if (G.chapter === 5 && G.moneyBag && !P.car && Math.hypot(P.x - G.moneyBag.x, P.y - G.moneyBag.y) < 26) {
      G.moneyBag = null; G.money += 1000; setObjective('甩掉警察（通缉清零）', null);
      showDialog('抢到 $1000！现在甩掉警察：躲开视线 7 秒消一星，或去车店喷漆。', 4000);
    }
    if (G.chapter === 5 && !G.moneyBag && armoured && armoured.stopped && G.wanted === 0 && G.missionActive) completeChapter('第五章完成！运钞车得手了。');
    if (G.chapter === 6) {
      if (G.step === 0 && Math.hypot(P.x - city.bank.x, P.y - city.bank.y) < 110) {
        G.step = 1; if (G.wanted < 2) addWanted(2, 'bank');
        setObjective(`坚守金库门口：剩 ${Math.ceil(G.vaultTimer)} 秒`, { x: city.bank.x, y: city.bank.y, label: '银行' });
      } else if (G.step === 1) {
        if (Math.hypot(P.x - city.bank.x, P.y - city.bank.y) < 110) G.vaultTimer -= dt;
        setObjective(`坚守金库门口：剩 ${Math.ceil(Math.max(0, G.vaultTimer))} 秒`, { x: city.bank.x, y: city.bank.y, label: '银行' });
        if (G.vaultTimer <= 0) { G.step = 2; setObjective('甩掉警察，去南边码头', { x: city.dock.x, y: city.dock.y, label: '南码头' }); }
      } else if (G.step === 2 && G.wanted === 0 && Math.hypot(P.x - city.dock.x, P.y - city.dock.y) < 110) completeChapter('第六章完成！你从码头全身而退。');
    }
  }
  // camera + fx decay
  G.camX = Math.max(0, Math.min(WORLD_W - canvas.width, P.x - canvas.width / 2));
  G.camY = Math.max(0, Math.min(WORLD_H - canvas.height, P.y - canvas.height / 2));
  G.shake = Math.max(0, G.shake - dt * 14);
  G.vignette = Math.max(0, G.vignette - dt * 0.5);
  for (const e of effects) e.t += dt;
  effects = effects.filter(e => e.t < 1.2);
  updateHUD();
}

// ---- render ----
function drawCar(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
  const w = c.kind === 'truck' || c.kind === 'armoured' ? 52 : 42, h = 22;
  ctx.fillStyle = '#0008'; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.fillStyle = '#bfe8ff'; ctx.fillRect(-4, -h / 2 + 3, 14, h - 6);
  if (c.isQuestTruck) { ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 3; ctx.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4); }
  if (c.isPolice || c.color === '#2233ff') { ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2 + 4, -4, 10, 8); }
  ctx.restore();
  if (c.isStarter) { ctx.fillStyle = '#2fd6d6'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('你的车·按 E 上车', c.x, c.y - 20); }
  if (c.isQuestTruck) { ctx.fillStyle = '#ffd23d'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🚚 送货货车', c.x, c.y - 24); }
  if (c.isPink) { ctx.fillStyle = '#ff7ad9'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('粉色跑车', c.x, c.y - 20); }
}
function render() {
  const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  ctx.save(); ctx.translate(-G.camX + sx, -G.camY + sy);
  // ground
  ctx.fillStyle = '#3f7a44'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // sea + beach
  ctx.fillStyle = '#1b6fa8'; ctx.fillRect(0, SEA_Y, WORLD_W, WORLD_H - SEA_Y);
  ctx.fillStyle = '#e8d9a0'; ctx.fillRect(0, BEACH_Y, WORLD_W, SEA_Y - BEACH_Y);
  // pier
  ctx.fillStyle = '#8a6a45'; ctx.fillRect(2160, 1480, 36, 110);
  ctx.fillStyle = '#6b4f2a'; for (let i = 0; i < 5; i++) ctx.fillRect(2160, 1485 + i * 22, 36, 4);
  // park + lake + circular paths
  ctx.fillStyle = '#2f8f3a'; ctx.beginPath(); ctx.arc(city.park.x, city.park.y, city.park.r, 0, 6.29); ctx.fill();
  ctx.strokeStyle = '#e8d9a0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(city.park.x, city.park.y, 130, 0, 6.29); ctx.stroke();
  ctx.fillStyle = '#2a9fd8'; ctx.beginPath(); ctx.arc(city.park.x, city.park.y, city.park.lakeR, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('中央公园', city.park.x, city.park.y - 150);
  // night market square
  ctx.fillStyle = '#c9a86a'; ctx.fillRect(city.nightMarket.x - 90, city.nightMarket.y - 70, 180, 140);
  ctx.fillStyle = '#2a9fd8'; ctx.beginPath(); ctx.arc(city.nightMarket.x, city.nightMarket.y, 18, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#ff5b5b';
  for (let i = 0; i < 4; i++) ctx.fillRect(city.nightMarket.x - 70 + i * 38, city.nightMarket.y - 58, 26, 18);
  ctx.fillStyle = '#222'; ctx.fillText('夜市广场', city.nightMarket.x, city.nightMarket.y + 62);
  // port containers
  ctx.fillStyle = '#c0392b'; ctx.fillRect(180, 1240, 70, 26); ctx.fillStyle = '#2980b9'; ctx.fillRect(180, 1280, 70, 26); ctx.fillStyle = '#f39c12'; ctx.fillRect(260, 1260, 70, 26);
  ctx.fillStyle = '#222'; ctx.fillText('港口', 240, 1230);
  // parking lots
  ctx.fillStyle = '#444'; for (const [x, y] of [[600, 500], [1500, 1000], [1000, 1450]]) ctx.fillRect(x, y, 110, 60);
  // roads
  ctx.strokeStyle = '#2c2f36'; ctx.lineCap = 'round';
  for (const s of city.segs) {
    const a = city.nodes[s.a], b = city.nodes[s.b];
    ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 2; ctx.setLineDash([14, 14]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#2c2f36';
  }
  // zebra crossings at a few nodes
  ctx.fillStyle = '#eee';
  for (const n of city.nodes.slice(0, 12)) for (let i = -2; i <= 2; i++) ctx.fillRect(n.x + i * 8 - 3, n.y - 18, 5, 10);
  // buildings
  for (const b of city.buildings) {
    ctx.fillStyle = b.type === 'highrise' ? '#5a7a9a' : b.type === 'warehouse' ? '#8a7a5a' : b.type === 'house' ? '#c98a6a' : '#7a8a9a';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.type === 'highrise' ? '#9fc4e8' : '#fff8';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = '#2228';
    for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 16) for (let wy = b.y + 12; wy < b.y + b.h - 10; wy += 16) ctx.fillRect(wx, wy, 7, 9);
  }
  // shops / landmarks
  function marker(x, y, label, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 16, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 24);
  }
  marker(city.bar.x, city.bar.y, '🍺 龙叔酒吧', '#ff5b9a');
  marker(city.gunShop.x, city.gunShop.y, '🔫 枪店', '#e67e22');
  marker(city.hospital.x, city.hospital.y, '🏥 医院', '#2ecc71');
  marker(city.carShop.x, city.carShop.y, '🚗 车店', '#4db2ff');
  marker(city.bank.x, city.bank.y, '🏦 银行', '#ffd23d');
  marker(city.dock.x, city.dock.y, '⚓ 南码头', '#7fd0ff');
  // palm trees on beach
  ctx.fillStyle = '#2f8f3a';
  for (let x = 200; x < 2300; x += 260) { ctx.beginPath(); ctx.arc(x, 1530, 14, 0, 6.29); ctx.fill(); ctx.fillStyle = '#8a6a45'; ctx.fillRect(x - 2, 1530, 4, 16); ctx.fillStyle = '#2f8f3a'; }
  // packages
  for (const pk of city.packages) if (!pk.got) {
    ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(pk.x, pk.y, 9, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('?', pk.x, pk.y + 4);
  }
  if (G.moneyBag) { ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(G.moneyBag.x, G.moneyBag.y, 12, 0, 6.29); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('$', G.moneyBag.x, G.moneyBag.y + 5); }
  // roadblocks
  ctx.fillStyle = '#ff5b5b';
  for (const rb of roadblocks) { ctx.fillRect(rb.x - 22, rb.y - 8, 44, 16); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('路障', rb.x, rb.y + 4); ctx.fillStyle = '#ff5b5b'; }
  // objective sky beam + marker
  if (G.target) {
    ctx.strokeStyle = '#ff5b9a88'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(G.target.x, G.target.y - 300); ctx.lineTo(G.target.x, G.target.y); ctx.stroke();
    ctx.fillStyle = '#ff5b9a'; ctx.beginPath(); ctx.arc(G.target.x, G.target.y, 12, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(G.target.label || '目标', G.target.x, G.target.y - 20);
  }
  // pedestrians
  for (const pd of peds) { ctx.fillStyle = pd.color; ctx.beginPath(); ctx.arc(pd.x, pd.y, 9, 0, 6.29); ctx.fill(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(pd.x, pd.y - 3, 4, 0, 6.29); ctx.fill(); }
  // cars
  for (const c of cars) drawCar(c);
  // enemies
  for (const e of enemies) {
    ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, 13, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.fillRect(e.x - 14, e.y - 24, 28, 5); ctx.fillStyle = '#2ecc71'; ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / 50), 5);
  }
  // police
  for (const po of police) {
    if (po.kind === 'car') drawCar(po);
    else { ctx.fillStyle = '#2233ff'; ctx.beginPath(); ctx.arc(po.x, po.y, 11, 0, 6.29); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('警', po.x, po.y + 4); }
  }
  if (heli) {
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(heli.x, heli.y + 30, 60, 18, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffd23d55'; ctx.beginPath(); ctx.moveTo(heli.x, heli.y); ctx.lineTo(P.x - 30, P.y); ctx.lineTo(P.x + 30, P.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(heli.x, heli.y, 14, 0, 6.29); ctx.fill();
  }
  // bullets
  ctx.fillStyle = '#ffd23d';
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 6.29); ctx.fill(); }
  // player
  if (!P.car) {
    ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(P.x, P.y, 13, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x + Math.cos(P.ang) * 22, P.y + Math.sin(P.ang) * 22); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(P.x + Math.cos(P.ang) * 6, P.y + Math.sin(P.ang) * 6, 5, 0, 6.29); ctx.fill();
  }
  // effects
  ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
  for (const e of effects) { ctx.globalAlpha = Math.max(0, 1 - e.t); ctx.fillStyle = e.color || '#fff'; if (e.text) ctx.fillText(e.text, e.x, e.y - e.t * 30); ctx.globalAlpha = 1; }
  ctx.restore();
  // vignette
  $('vignette').style.boxShadow = G.vignette > 0 ? `inset 0 0 120px rgba(255,0,0,${G.vignette})` : 'inset 0 0 120px rgba(255,0,0,0)';
  drawMinimap();
}
function drawMinimap() {
  const sx = mm.width / WORLD_W, sy = mm.height / WORLD_H;
  mmc.fillStyle = '#123'; mmc.fillRect(0, 0, mm.width, mm.height);
  mmc.strokeStyle = '#888'; mmc.lineWidth = 2;
  for (const s of city.segs) { const a = city.nodes[s.a], b = city.nodes[s.b]; mmc.beginPath(); mmc.moveTo(a.x * sx, a.y * sy); mmc.lineTo(b.x * sx, b.y * sy); mmc.stroke(); }
  mmc.fillStyle = '#2a9fd8'; mmc.fillRect(0, SEA_Y * sy, mm.width, mm.height - SEA_Y * sy);
  const dot = (x, y, c, r) => { mmc.fillStyle = c; mmc.beginPath(); mmc.arc(x * sx, y * sy, r || 3, 0, 6.29); mmc.fill(); };
  dot(city.bar.x, city.bar.y, '#ff5b9a', 4); dot(city.gunShop.x, city.gunShop.y, '#e67e22'); dot(city.hospital.x, city.hospital.y, '#2ecc71'); dot(city.carShop.x, city.carShop.y, '#4db2ff'); dot(city.bank.x, city.bank.y, '#ffd23d');
  if (G.target) dot(G.target.x, G.target.y, '#ff5b9a', 5);
  for (const po of police) dot(po.x, po.y, '#2233ff', 3);
  dot(P.x, P.y, '#fff', 4);
  mmc.fillStyle = '#fff'; mmc.font = 'bold 11px sans-serif'; mmc.fillText('N ↑', 6, 12);
  // view frame
  mmc.strokeStyle = '#fff'; mmc.strokeRect(G.camX * sx, G.camY * sy, canvas.width * sx, canvas.height * sy);
}
function updateHUD() {
  $('hp').textContent = Math.ceil(G.hp); $('armour').textContent = Math.ceil(G.armour);
  $('hpfill').style.width = Math.max(0, G.hp) + '%'; $('armfill').style.width = Math.min(100, G.armour) + '%';
  $('money').textContent = G.money; $('rep').textContent = G.rep;
  const h = Math.floor(G.time / 3600) % 24, m = Math.floor(G.time / 60) % 60;
  $('clock').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  $('weapon').textContent = WEAPONS[P.weapon].name;
  $('ammo').textContent = P.weapon === 0 ? '' : '弹药 ' + P.ammo[P.weapon];
  $('pkgs').textContent = G.pkgsGot + '/20'; $('comp').textContent = completion() + '%';
  $('stars').textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  $('district').textContent = city.district(P.x, P.y);
  $('speedo').textContent = P.car ? Math.round(Math.abs(P.car.speed) * 1.2) + ' km/h' : '';
  const car = nearCar();
  let hint = '';
  if (P.car) hint = 'W/S 加速/倒车 · A/D 转向 · 空格手刹 · E 下车 · H 喇叭';
  else if (car && Math.hypot(car.x - P.x, car.y - P.y) <= 52) hint = car.isQuestTruck ? '按 E 上送货货车' : car.isStarter ? '按 E 上你的车' : '按 E 上车 / 偷车';
  else if (Math.hypot(P.x - city.bar.x, P.y - city.bar.y) <= 56) hint = '按 E 和龙叔说话 / 接任务';
  else if (Math.hypot(P.x - city.gunShop.x, P.y - city.gunShop.y) <= 56) hint = '按 E 进枪店';
  else if (Math.hypot(P.x - city.hospital.x, P.y - city.hospital.y) <= 56) hint = '按 E 医院治疗 $50';
  else if (Math.hypot(P.x - city.carShop.x, P.y - city.carShop.y) <= 56) hint = '按 E 车店喷漆清通缉';
  else hint = 'WASD 移动 · 鼠标瞄准 · 左键开火 · E 互动';
  const hEl = $('hint'); hEl.textContent = hint; hEl.style.display = G.screen === 'play' ? 'block' : 'none';
}
// ---- UI wiring ----
$('btnNew').addEventListener('click', () => { resetGame(); });
$('btnContinue').addEventListener('click', () => {
  const s = saves.find(v => v);
  if (s) loadSave(s); else { resetGame(); }
});
$('btnHow').addEventListener('click', () => { const b = $('howBox'); b.style.display = b.style.display === 'none' ? 'block' : 'none'; });
$('btnResume').addEventListener('click', () => showScreen('play'));
$('btnQuit').addEventListener('click', () => { showScreen('title'); });
$('btnRetry').addEventListener('click', () => {
  G.hp = 100; G.wanted = 0; police = []; heli = null; roadblocks = [];
  G.missionActive = false; G.step = 0;
  P.x = city.bar.x; P.y = city.bar.y; if (P.car) { P.car = null; }
  setObjective('去龙叔酒吧按 E 重接本章', { x: city.bar.x, y: city.bar.y, label: '龙叔酒吧' });
  showScreen('play');
});
$('btnEndMenu').addEventListener('click', () => showScreen('title'));
function snapshot() {
  return JSON.stringify({ chapter: G.chapter, money: G.money, rep: G.rep, hp: G.hp, pkgs: city.packages.map(p => p.got), owned: P.owned, ammo: P.ammo, x: P.x, y: P.y });
}
function loadSave(json) {
  try {
    const s = JSON.parse(json);
    resetGame();
    G.chapter = s.chapter; G.money = s.money; G.rep = s.rep; G.hp = s.hp;
    P.owned = s.owned; P.ammo = s.ammo; P.x = s.x; P.y = s.y;
    s.pkgs.forEach((g, i) => { if (g) { city.packages[i].got = true; G.pkgsGot++; } });
    setObjective('去龙叔酒吧按 E 接任务', { x: city.bar.x, y: city.bar.y, label: '龙叔酒吧' });
    showScreen('play');
  } catch (e) { showDialog('存档读取失败。', 2500); }
}
[1, 2, 3].forEach(i => {
  $('btnSave' + i).addEventListener('click', () => { saves[i - 1] = snapshot(); showDialog('已存到槽 ' + i + '（本页会话内有效）。', 2000); });
});
$('btnExport').addEventListener('click', () => {
  const blob = new Blob([snapshot()], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vice-heat-save.json'; a.click();
});
$('btnImport').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader(); r.onload = () => loadSave(r.result); r.readAsText(f);
});
// ---- screenshot staging ----
function stageShot(name) {
  resetGame();
  if (name === 'start') { G.screen = 'title'; showScreen('title'); }
  else if (name === 'city') {
    G.screen = 'play'; showScreen('play');
    P.x = 1200; P.y = 700; G.camX = 0; G.camY = 0;
    // zoomed-out feel: draw from a wide camera by shrinking the canvas view
    G.camX = Math.max(0, 1200 - canvas.width / 2); G.camY = Math.max(0, 700 - canvas.height / 2);
  } else if (name === 'action') {
    G.screen = 'play'; showScreen('play');
    P.x = city.nightMarket.x; P.y = city.nightMarket.y; P.owned[1] = true; P.ammo[1] = 60; P.weapon = 1;
    spawnGang(); addWanted(2, 'shot'); G.missionText = '第三章：夜市火并鲨鱼帮'; G.target = { x: city.nightMarket.x, y: city.nightMarket.y, label: '夜市广场' };
  } else { // play
    G.screen = 'play'; showScreen('play');
    const c = cars[0]; P.car = c; P.x = c.x; P.y = c.y; c.speed = 60;
    G.missionText = '第一章：去东边枪店取手枪'; G.target = { x: city.gunShop.x, y: city.gunShop.y, label: '铁锤枪店' };
  }
  setObjective(G.missionText, G.target);
  updateHUD();
  let painted = 0;
  const paint = () => {
    if (shot === 'city') { G.camX = 0; G.camY = 0; }
    stepUpdate(1 / 60); render(); painted++;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}
// ---- main loop ----
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (G.screen === 'play') { acc += dt; while (acc >= 1 / 60) { stepUpdate(1 / 60); acc -= 1 / 60; } }
  if (G.screen === 'play' || G.screen === 'pause') render();
}
if (shot) {
  resetGame();
  stageShot(shot);
} else {
  showScreen('title');
  // title backdrop: a slow pan over the city
  G.camX = 400; G.camY = 400;
  render();
}
requestAnimationFrame(frame);
window.__viceHeat = { G, P, city, resetGame };
