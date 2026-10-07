/*
 * 마을 엔진 — 탑다운 이동, 클릭 이동(A*), NPC, 건물 상호작용.
 * 에셋이 없으면 코드로 그린 도트 그래픽을 사용한다.
 */
(() => {
  'use strict';
  const V = window.VILLAGE;
  const A = window.ASSET_CONFIG || {};
  const TS = 16;
  const W = V.map.w, H = V.map.h;
  const DEBUG = /[?&]debug\b/.test(location.search);

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);

  // ---------- 유틸 ----------
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(V.seed || 1);
  const rint = (n) => Math.floor(rand() * n);
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const tileCenter = (tx, ty) => ({ x: tx * TS + 8, y: ty * TS + 12 });
  const tileOf = (e) => ({ tx: Math.floor(e.x / TS), ty: Math.floor((e.y - 3) / TS) });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---------- 이미지 로딩 ----------
  const IMG = {};
  const missing = [];
  function loadImages() {
    if (!A.useAssets) return Promise.resolve();
    return Promise.all(Object.entries(A.images || {}).map(([key, p]) => new Promise((res) => {
      if (!p) return res();
      const im = new Image();
      im.onload = () => { IMG[key] = im; res(); };
      im.onerror = () => { missing.push(A.basePath + p); res(); };
      im.src = A.basePath + p;
    })));
  }
  const spriteDef = (group, key) => {
    const d = A[group] && A[group][key];
    return d && IMG[d.image] ? d : null;
  };

  // ---------- 지도 생성 ----------
  const GR = 0, PATH = 1, WATER = 2;
  const ground = new Uint8Array(W * H);
  const solid = new Uint8Array(W * H);
  const reserved = new Uint8Array(W * H); // 나무가 못 들어가는 칸
  const flowers = [];
  const objects = []; // 깊이 정렬되는 정적 오브젝트
  const reserve = (x, y, m) => {
    for (let yy = y - m; yy <= y + m; yy++) for (let xx = x - m; xx <= x + m; xx++) if (inb(xx, yy)) reserved[idx(xx, yy)] = 1;
  };

  for (const [x, y, w, h] of V.paths) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!inb(xx, yy)) continue;
      ground[idx(xx, yy)] = PATH; reserve(xx, yy, 1);
    }
  }
  for (const p of V.ponds || []) {
    for (let y = p.cy - p.ry; y <= p.cy + p.ry; y++) for (let x = p.cx - p.rx; x <= p.cx + p.rx; x++) {
      const nx = (x - p.cx) / (p.rx + 0.5), ny = (y - p.cy) / (p.ry + 0.5);
      if (nx * nx + ny * ny <= 1 && inb(x, y)) { ground[idx(x, y)] = WATER; solid[idx(x, y)] = 1; reserve(x, y, 1); }
    }
  }
  const buildings = V.buildings.map((b) => {
    for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) solid[idx(x, y)] = 1;
    for (let y = b.ty - 2; y < b.ty + b.h + 1; y++) for (let x = b.tx - 1; x <= b.tx + b.w; x++) if (inb(x, y)) reserved[idx(x, y)] = 1;
    const o = { ...b, kind: 'building', entry: { tx: b.tx + b.door, ty: b.ty + b.h }, sortY: (b.ty + b.h) * TS };
    objects.push(o);
    return o;
  });
  if (V.fountain) {
    const f = V.fountain;
    for (let y = f.ty; y < f.ty + 2; y++) for (let x = f.tx; x < f.tx + 2; x++) solid[idx(x, y)] = 1;
    objects.push({ kind: 'fountain', tx: f.tx, ty: f.ty, sortY: (f.ty + 2) * TS });
  }
  const signs = (V.signs || []).map((s) => {
    solid[idx(s.tx, s.ty)] = 1; reserve(s.tx, s.ty, 1);
    const o = { ...s, kind: 'sign', sortY: (s.ty + 1) * TS - 2 };
    objects.push(o);
    return o;
  });
  for (const n of V.npcs) reserve(n.tx, n.ty, 1);
  reserve(V.spawn.tx, V.spawn.ty, 1);

  function addTree(x, y) {
    solid[idx(x, y)] = 1;
    objects.push({ kind: 'tree', tx: x, ty: y, v: rint(3), ox: rint(5) - 2, sortY: (y + 1) * TS - 2 });
  }
  // 테두리 숲
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const border = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
    if (!border) continue;
    if (ground[idx(x, y)] !== GR) { solid[idx(x, y)] = 1; continue; }
    if ((x + y) % 2 === 0 || rand() < 0.4) addTree(x, y); else solid[idx(x, y)] = 1;
  }
  // 랜덤 나무
  for (let n = 0, tries = 0; n < (V.randomTrees || 0) && tries < 3000; tries++) {
    const x = 2 + rint(W - 4), y = 2 + rint(H - 4);
    let ok = true;
    for (let yy = y - 1; yy <= y + 1 && ok; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (reserved[idx(xx, yy)] || solid[idx(xx, yy)]) { ok = false; break; }
    if (!ok) continue;
    addTree(x, y); reserved[idx(x, y)] = 1; n++;
  }
  // 꽃
  const FLOWER_COLORS = ['#ffffff', '#ffd84a', '#ff7aa8', '#b48cff', '#ff8a4a'];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (ground[idx(x, y)] === GR && !solid[idx(x, y)] && rand() < 0.08) flowers.push({ x, y, c: FLOWER_COLORS[rint(FLOWER_COLORS.length)], n: 1 + rint(3) });
  }

  const walkable = (x, y) => inb(x, y) && !solid[idx(x, y)];

  // ---------- 도트 스프라이트 생성 (에셋 대체용) ----------
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function disc(g, cx, cy, r, c) {
    g.fillStyle = c;
    for (let y = -r; y <= r; y++) { const hw = Math.floor(Math.sqrt(r * r - y * y + r * 0.6)); g.fillRect(cx - hw, cy + y, hw * 2 + 1, 1); }
  }
  function outline(cv, col) {
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height);
    const a = d.data, w = cv.width, h = cv.height, src = new Uint8ClampedArray(a);
    const [r, gg, b] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 200) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const xx = x + dx, yy = y + dy;
        return xx >= 0 && yy >= 0 && xx < w && yy < h && src[(yy * w + xx) * 4 + 3] > 200;
      });
      if (near && src[i + 3] < 50) { a[i] = r; a[i + 1] = gg; a[i + 2] = b; a[i + 3] = 255; }
    }
    g.putImageData(d, 0, 0);
    return cv;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  const TREE_SPR = [['#2f6b34', '#3f8a3f', '#5aa84a'], ['#2c6440', '#3c8250', '#56a066'], ['#4a7a2c', '#619a38', '#7fbb4a']].map(([d, m, l]) => {
    const c = makeCanvas(32, 40), g = c.getContext('2d');
    rect(g, 13, 24, 6, 14, '#7a4b2a'); rect(g, 13, 24, 2, 14, '#94603a');
    disc(g, 16, 15, 12, d); disc(g, 15, 13, 10, m); disc(g, 12, 10, 5, l);
    for (let i = 0; i < 6; i++) rect(g, 8 + ((i * 7) % 16), 8 + ((i * 5) % 12), 2, 2, l);
    return outline(c, '#1e2e1a');
  });

  const SIGN_SPR = (() => {
    const c = makeCanvas(16, 20), g = c.getContext('2d');
    rect(g, 7, 10, 2, 9, '#6b4423');
    rect(g, 1, 3, 14, 9, '#b07a45'); rect(g, 1, 3, 14, 2, '#c99159');
    rect(g, 3, 6, 10, 1, '#6b4423'); rect(g, 3, 8, 7, 1, '#6b4423');
    return outline(c, '#2a1a0c');
  })();

  const FOUNTAIN_SPR = [0, 1].map((f) => {
    const c = makeCanvas(32, 36), g = c.getContext('2d');
    disc(g, 16, 22, 13, '#8c8f99'); disc(g, 16, 21, 12, '#a9adb8'); disc(g, 16, 22, 10, '#3b8fd0'); disc(g, 16, 23, 8, '#4aa3e0');
    rect(g, 14, 8, 4, 14, '#a9adb8'); rect(g, 14, 8, 1, 14, '#c4c8d2');
    rect(g, 11, 6, 10, 3, '#a9adb8');
    const spray = f ? [[12, 2], [20, 3], [16, 0], [9, 10], [23, 9]] : [[13, 3], [19, 2], [16, 1], [10, 9], [22, 10]];
    for (const [x, y] of spray) rect(g, x, y, 2, 2, '#bfe6ff');
    rect(g, 10 + f * 6, 22, 3, 1, '#bfe6ff'); rect(g, 18 - f * 4, 25, 3, 1, '#bfe6ff');
    return outline(c, '#3a3d48');
  });

  function makeBuildingSprite(b) {
    const w = b.w * TS, h = b.h * TS + 10;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    const wallH = Math.round(b.h * TS * 0.42), roofBottom = h - wallH;
    // 벽
    rect(g, 2, roofBottom, w - 4, wallH, '#e8d1a8');
    for (let y = roofBottom + 3; y < h; y += 4) rect(g, 2, y, w - 4, 1, '#cdb184');
    rect(g, 2, h - 3, w - 4, 3, '#9c8462');
    // 창문
    const doorX = b.door * TS + 2;
    const winY = roofBottom + 6;
    for (const wx of [8, w - 20]) {
      if (Math.abs(wx - doorX) < 16) continue;
      rect(g, wx, winY, 12, 10, '#6b4423'); rect(g, wx + 1, winY + 1, 10, 8, '#9fd3ef');
      rect(g, wx + 1, winY + 1, 4, 3, '#d9f1ff'); rect(g, wx + 6, winY, 1, 10, '#6b4423'); rect(g, wx, winY + 5, 12, 1, '#6b4423');
      rect(g, wx - 1, winY + 10, 14, 2, '#8a5a30');
    }
    // 문
    const dh = Math.min(22, wallH - 3);
    rect(g, doorX, h - dh, 12, dh, '#6b4423'); rect(g, doorX + 1, h - dh + 1, 10, dh - 1, '#8a5a30');
    rect(g, doorX + 5, h - dh + 1, 1, dh - 1, '#6b4423'); rect(g, doorX + 8, h - dh / 2, 2, 2, '#e8c050');
    // 지붕
    const roof = b.roof || '#c8553d';
    for (let y = 2; y < roofBottom + 2; y++) {
      const t = (y - 2) / roofBottom;
      const inset = Math.round((1 - t) * 6);
      const col = (y % 6 === 0) ? shade(roof, -40) : (t < 0.15 ? shade(roof, 25) : roof);
      rect(g, inset, y, w - inset * 2, 1, col);
    }
    rect(g, 0, roofBottom, w, 2, shade(roof, -60));
    for (let x = 6; x < w - 6; x += 8) for (let y = 8; y < roofBottom - 2; y += 12) rect(g, x + ((y / 12) % 2) * 4, y, 1, 5, shade(roof, -25));
    // 굴뚝
    rect(g, w - 22, 0, 8, 12, '#8a6a5a'); rect(g, w - 23, 0, 10, 3, '#6a4a3a');
    return outline(c, '#2a1a0c');
  }

  // 캐릭터: 16x20, 발 위치 = (8, 19)
  const charCache = {};
  function charSprite(colors, dir, frame) {
    const key = JSON.stringify(colors) + dir + frame;
    if (charCache[key]) return charCache[key];
    const c = makeCanvas(16, 20), g = c.getContext('2d');
    const skin = colors.skin || '#f2c49b', hair = colors.hair, shirt = colors.shirt, pants = colors.pants;
    const stepL = frame === 1 ? -1 : 0, stepR = frame === 3 ? -1 : 0;
    const bob = frame % 2 ? -1 : 0;
    if (dir === 'left' || dir === 'right') {
      rect(g, 6, 14 + bob, 2, 4 + stepL, pants); rect(g, 8, 14 + bob, 2, 4 + stepR, shade(pants, -20));
      rect(g, 6, 18 + stepL, 2, 1, '#2a1a10'); rect(g, 8, 18 + stepR, 2, 1, '#2a1a10');
    } else {
      rect(g, 5, 14 + bob, 2, 4 + stepL, pants); rect(g, 9, 14 + bob, 2, 4 + stepR, pants);
      rect(g, 5, 18 + stepL, 2, 1, '#2a1a10'); rect(g, 9, 18 + stepR, 2, 1, '#2a1a10');
    }
    rect(g, 4, 9 + bob, 8, 6, shirt); rect(g, 4, 13 + bob, 8, 1, shade(shirt, -30));
    if (dir === 'down' || dir === 'up') { rect(g, 3, 10 + bob, 1, 4, skin); rect(g, 12, 10 + bob, 1, 4, skin); }
    else rect(g, dir === 'left' ? 8 : 7, 10 + bob, 1, 4, skin);
    rect(g, 4, 2 + bob, 8, 7, skin);
    rect(g, 4, 1 + bob, 8, 3, hair);
    if (dir === 'up') rect(g, 4, 1 + bob, 8, 7, hair);
    else if (dir === 'left') { rect(g, 9, 1 + bob, 3, 7, hair); rect(g, 5, 5 + bob, 1, 2, '#2a1a10'); }
    else if (dir === 'right') { rect(g, 4, 1 + bob, 3, 7, hair); rect(g, 10, 5 + bob, 1, 2, '#2a1a10'); }
    else { rect(g, 4, 1 + bob, 1, 5, hair); rect(g, 11, 1 + bob, 1, 5, hair); rect(g, 6, 5 + bob, 1, 2, '#2a1a10'); rect(g, 9, 5 + bob, 1, 2, '#2a1a10'); rect(g, 5, 7 + bob, 1, 1, '#f0a090'); rect(g, 10, 7 + bob, 1, 1, '#f0a090'); }
    return (charCache[key] = outline(c, '#24160c'));
  }

  // ---------- 바닥 레이어 미리 그리기 ----------
  const groundCanvas = makeCanvas(W * TS, H * TS);
  function buildGround() {
    const g = groundCanvas.getContext('2d');
    const r = mulberry32((V.seed || 1) + 7);
    const tileDefs = (type) => {
      const list = A.tiles && A.tiles[type];
      return list ? list.filter((d) => IMG[d.image]) : [];
    };
    const defs = { [GR]: tileDefs('grass'), [PATH]: tileDefs('path'), [WATER]: tileDefs('water') };
    const at = (x, y) => (inb(x, y) ? ground[idx(x, y)] : GR);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ground[idx(x, y)], px = x * TS, py = y * TS;
      const list = defs[t];
      if (list.length) {
        const d = list[Math.floor(r() * list.length)];
        g.drawImage(IMG[d.image], d.sx, d.sy, TS, TS, px, py, TS, TS);
        continue;
      }
      if (t === GR) {
        rect(g, px, py, TS, TS, '#6fb34a');
        for (let i = 0; i < 5; i++) rect(g, px + Math.floor(r() * 15), py + Math.floor(r() * 15), 1, 2, r() < 0.5 ? '#5e9f3e' : '#86c95a');
      } else if (t === PATH) {
        rect(g, px, py, TS, TS, '#dcb983');
        for (let i = 0; i < 3; i++) rect(g, px + Math.floor(r() * 14), py + Math.floor(r() * 14), 2, 1, '#c9a066');
        if (at(x, y - 1) !== PATH) rect(g, px, py, TS, 2, '#b88d55');
        if (at(x, y + 1) !== PATH) rect(g, px, py + TS - 1, TS, 1, '#c9a066');
        if (at(x - 1, y) !== PATH) rect(g, px, py, 1, TS, '#c9a066');
        if (at(x + 1, y) !== PATH) rect(g, px + TS - 1, py, 1, TS, '#c9a066');
      } else if (t === WATER) {
        rect(g, px, py, TS, TS, '#4aa3d8');
        if (r() < 0.5) rect(g, px + Math.floor(r() * 10), py + Math.floor(r() * 14), 5, 1, '#6cc1ec');
        if (at(x, y - 1) !== WATER) { rect(g, px, py, TS, 3, '#e6d49a'); rect(g, px, py + 3, TS, 2, '#3a86b8'); }
        if (at(x, y + 1) !== WATER) rect(g, px, py + TS - 2, TS, 2, '#e6d49a');
        if (at(x - 1, y) !== WATER) rect(g, px, py, 2, TS, '#e6d49a');
        if (at(x + 1, y) !== WATER) rect(g, px + TS - 2, py, 2, TS, '#e6d49a');
      }
    }
    for (const f of flowers) {
      for (let i = 0; i < f.n; i++) {
        const fx = f.x * TS + 2 + Math.floor(r() * 11), fy = f.y * TS + 2 + Math.floor(r() * 11);
        rect(g, fx, fy + 1, 1, 2, '#3f8a3f'); rect(g, fx - 1, fy, 3, 1, f.c); rect(g, fx, fy - 1, 1, 3, f.c); rect(g, fx, fy, 1, 1, '#ffe27a');
      }
    }
    // 건물/나무 그림자
    g.fillStyle = 'rgba(20,40,10,.25)';
    for (const b of buildings) g.fillRect(b.tx * TS + 4, (b.ty + b.h) * TS - 2, b.w * TS, 5);
    for (const o of objects) if (o.kind === 'tree') { g.beginPath(); g.ellipse(o.tx * TS + 8 + o.ox, (o.ty + 1) * TS - 2, 9, 3, 0, 0, Math.PI * 2); g.fill(); }
  }

  // ---------- 엔티티 ----------
  function makeEntity(opts) {
    const c = tileCenter(opts.tx, opts.ty);
    return { x: c.x, y: c.y, dir: 'down', moving: false, anim: 0, path: null, onArrive: null, ...opts };
  }
  const player = makeEntity({ tx: V.spawn.tx, ty: V.spawn.ty, sprite: 'visitor', name: '방문객', colors: { hair: '#c8742a', shirt: '#4a90d9', pants: '#5a4030' }, speed: 78 });
  const npcs = V.npcs.map((n) => makeEntity({ ...n, home: { tx: n.tx, ty: n.ty }, speed: 30, wait: 1 + rand() * 3, talking: false }));

  // ---------- A* 길찾기 ----------
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  function findPath(sx, sy, gx, gy, maxNodes = 4000) {
    if (!walkable(gx, gy)) return null;
    const goal = idx(gx, gy), N = W * H;
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const hfn = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return dx + dy - 0.586 * Math.min(dx, dy); };
    const open = [{ i: idx(sx, sy), f: hfn(sx, sy) }];
    gs[idx(sx, sy)] = 0;
    let n = 0;
    while (open.length && n++ < maxNodes) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
      const cur = open[bi].i; open[bi] = open[open.length - 1]; open.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) {
        const out = [];
        for (let i = cur; i !== -1; i = came[i]) out.push([i % W, (i / W) | 0]);
        return out.reverse();
      }
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!walkable(nx, ny)) continue;
        if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
        const ni = idx(nx, ny);
        if (closed[ni]) continue;
        const ng = gs[cur] + cost;
        if (ng < gs[ni]) { gs[ni] = ng; came[ni] = cur; open.push({ i: ni, f: ng + hfn(nx, ny) }); }
      }
    }
    return null;
  }
  function nearestWalkable(tx, ty, from) {
    let best = null, bd = Infinity;
    for (let r = 0; r <= 4 && !best; r++) {
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (!walkable(x, y)) continue;
        const d = Math.hypot(x - from.tx, y - from.ty);
        if (d < bd) { bd = d; best = { tx: x, ty: y }; }
      }
    }
    return best;
  }
  function walkTo(e, tx, ty, onArrive) {
    const s = tileOf(e);
    const p = findPath(s.tx, s.ty, tx, ty);
    if (!p) return false;
    e.path = p; e.onArrive = onArrive || null; e.stuck = 0;
    return true;
  }

  // ---------- 충돌 ----------
  function blockedAt(x, y) {
    const l = Math.floor((x - 5) / TS), r = Math.floor((x + 4.99) / TS);
    const t = Math.floor((y - 6) / TS), b = Math.floor((y - 0.01) / TS);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++) if (!walkable(tx, ty)) return true;
    return false;
  }
  function moveWithCollision(e, dx, dy) {
    let moved = false;
    if (dx) {
      if (!blockedAt(e.x + dx, e.y)) { e.x += dx; moved = true; }
      else if (!dy) moved = nudge(e, 'y', dx) || moved;
    }
    if (dy) {
      if (!blockedAt(e.x, e.y + dy)) { e.y += dy; moved = true; }
      else if (!dx) moved = nudge(e, 'x', dy) || moved;
    }
    return moved;
  }
  // 모서리에 걸렸을 때 살짝 옆으로 밀어주기
  function nudge(e, axis, d) {
    const step = Math.abs(d);
    for (let k = 1; k <= 7; k++) {
      for (const s of [-1, 1]) {
        const ox = axis === 'x' ? s * k : 0, oy = axis === 'y' ? s * k : 0;
        const fx = axis === 'x' ? 0 : d, fy = axis === 'y' ? 0 : d;
        if (!blockedAt(e.x + ox + fx, e.y + oy + fy)) {
          const mx = axis === 'x' ? s * Math.min(step, k) : 0, my = axis === 'y' ? s * Math.min(step, k) : 0;
          if (!blockedAt(e.x + mx, e.y + my)) { e.x += mx; e.y += my; return true; }
        }
      }
    }
    return false;
  }

  function followPath(e, dt) {
    if (!e.path || !e.path.length) return false;
    const [tx, ty] = e.path[0];
    const c = tileCenter(tx, ty);
    const dx = c.x - e.x, dy = c.y - e.y, d = Math.hypot(dx, dy), step = e.speed * dt;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (d <= step) {
      e.x = c.x; e.y = c.y; e.path.shift();
      if (!e.path.length) {
        e.path = null;
        const cb = e.onArrive; e.onArrive = null;
        if (cb) cb();
      }
    } else { e.x += (dx / d) * step; e.y += (dy / d) * step; }
    return true;
  }

  // ---------- 입력 ----------
  const keys = new Set();
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  let lastInputTime = 0;
  addEventListener('keydown', (ev) => {
    if (ev.code === 'F3') { toggleDebug(); ev.preventDefault(); return; }
    if (menu.open) { if (ev.code === 'Escape') closeMenu(); return; }
    if (panel.open) {
      if (ev.code === 'Escape' || ev.code === 'KeyE') { closePanel(); ev.preventDefault(); }
      return;
    }
    if (dialog.open) {
      if (['KeyE', 'Space', 'Enter'].includes(ev.code)) { advanceDialog(); ev.preventDefault(); }
      if (ev.code === 'Escape') endDialog(true);
      return;
    }
    if (KEYMAP[ev.code]) {
      keys.add(KEYMAP[ev.code]); player.path = null; player.onArrive = null; clickMarker = null;
      ev.preventDefault(); markInput();
    } else if (['KeyE', 'Space', 'Enter'].includes(ev.code)) {
      ev.preventDefault();
      const t = nearestInteractable();
      if (t) interact(t);
    } else if (ev.code === 'KeyM' || ev.code === 'Tab') { ev.preventDefault(); openMenu(); }
  });
  addEventListener('keyup', (ev) => { if (KEYMAP[ev.code]) keys.delete(KEYMAP[ev.code]); });
  addEventListener('blur', () => keys.clear());

  function markInput() {
    lastInputTime = performance.now();
    $('#hint').classList.add('fade');
  }

  let clickMarker = null, hoverTarget = null;
  function screenToWorld(ev) {
    const r = canvas.getBoundingClientRect();
    const sx = (ev.clientX - r.left) * dpr, sy = (ev.clientY - r.top) * dpr;
    return { x: sx / scale + cam.x, y: sy / scale + cam.y };
  }
  function targetAt(w) {
    for (const n of npcs) if (Math.abs(w.x - n.x) < 9 && w.y > n.y - 20 && w.y < n.y + 2) return n;
    const tx = Math.floor(w.x / TS), ty = Math.floor(w.y / TS);
    for (const b of buildings) {
      if (tx >= b.tx && tx < b.tx + b.w && w.y >= b.ty * TS - 10 && ty < b.ty + b.h) return b;
      if (tx === b.entry.tx && ty === b.entry.ty) return b;
    }
    for (const s of signs) if (tx === s.tx && (ty === s.ty || ty === s.ty - 1)) return s;
    return null;
  }
  canvas.addEventListener('pointerdown', (ev) => {
    if (dialog.open) { advanceDialog(); return; }
    if (panel.open || menu.open) return;
    markInput();
    const w = screenToWorld(ev);
    const t = targetAt(w);
    if (t) { approach(t); return; }
    const tx = Math.floor(w.x / TS), ty = Math.floor(w.y / TS);
    const dest = walkable(tx, ty) ? { tx, ty } : nearestWalkable(tx, ty, tileOf(player));
    if (dest && walkTo(player, dest.tx, dest.ty)) clickMarker = { ...tileCenter(dest.tx, dest.ty), t: 0 };
  });
  canvas.addEventListener('pointermove', (ev) => {
    hoverTarget = targetAt(screenToWorld(ev));
    canvas.style.cursor = hoverTarget ? 'pointer' : 'default';
  });

  // 대상 근처까지 걸어가서 상호작용
  function approach(t) {
    let dest;
    if (t.kind === 'building') dest = t.entry;
    else {
      const base = t.kind === 'sign' ? { tx: t.tx, ty: t.ty } : tileOf(t);
      const cand = [[0, 1], [-1, 0], [1, 0], [0, -1]].map(([dx, dy]) => ({ tx: base.tx + dx, ty: base.ty + dy })).filter((c) => walkable(c.tx, c.ty));
      const me = tileOf(player);
      cand.sort((a, b) => Math.hypot(a.tx - me.tx, a.ty - me.ty) - Math.hypot(b.tx - me.tx, b.ty - me.ty));
      dest = cand[0];
      if (t.kind !== 'sign' && dist(player, t) < 22) { interact(t); return; }
    }
    if (!dest) return;
    const me = tileOf(player);
    if (me.tx === dest.tx && me.ty === dest.ty) { interact(t); return; }
    if (walkTo(player, dest.tx, dest.ty, () => interact(t))) clickMarker = { ...tileCenter(dest.tx, dest.ty), t: 0 };
  }

  // ---------- 상호작용 ----------
  function nearestInteractable() {
    const off = { up: [0, -8], down: [0, 8], left: [-8, 0], right: [8, 0] }[player.dir];
    const front = { x: player.x + off[0], y: player.y + off[1] };
    let best = null, bd = Infinity;
    const consider = (o, p, r) => { const d = dist(front, p); if (d < r && d < bd) { bd = d; best = o; } };
    for (const n of npcs) consider(n, { x: n.x, y: n.y - 4 }, 22);
    for (const b of buildings) consider(b, { x: b.entry.tx * TS + 8, y: b.entry.ty * TS + 2 }, 16);
    for (const s of signs) consider(s, { x: s.tx * TS + 8, y: s.ty * TS + 10 }, 20);
    return best;
  }
  function face(e, t) {
    const dx = t.x - e.x, dy = t.y - e.y;
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  function interact(t) {
    keys.clear(); player.path = null; clickMarker = null;
    if (t.kind === 'building') { player.dir = 'up'; openPanel(t); }
    else if (t.kind === 'sign') {
      face(player, { x: t.tx * TS + 8, y: t.ty * TS + 8 });
      openDialog(t.title || '표지판', t.lines);
    } else {
      face(player, t); face(t, player); t.talking = true; t.path = null;
      openDialog(t.name, t.lines, () => {
        t.talking = false;
        if (t.after) { const b = buildings.find((x) => x.id === t.after); if (b) openPanel(b); }
      });
    }
  }

  // 대화창
  const dialog = { open: false, lines: [], i: 0, shown: 0, onEnd: null };
  const dlgEl = $('#dialog');
  function openDialog(name, lines, onEnd) {
    Object.assign(dialog, { open: true, lines, i: 0, shown: 0, onEnd: onEnd || null });
    dlgEl.querySelector('.dlg-name').textContent = name;
    dlgEl.classList.remove('hidden');
  }
  function advanceDialog() {
    const line = dialog.lines[dialog.i] || '';
    if (dialog.shown < line.length) { dialog.shown = line.length; return; }
    dialog.i++; dialog.shown = 0;
    if (dialog.i >= dialog.lines.length) endDialog(false);
  }
  function endDialog(cancel) {
    dialog.open = false; dlgEl.classList.add('hidden');
    const cb = dialog.onEnd; dialog.onEnd = null;
    if (cb) { if (cancel) npcs.forEach((n) => (n.talking = false)); else cb(); }
  }
  dlgEl.addEventListener('pointerdown', advanceDialog);

  // 건물 패널
  const panel = { open: false, building: null };
  const overlay = $('#overlay');
  function openPanel(b) {
    panel.open = true; panel.building = b;
    overlay.querySelector('.panel-title').textContent = `${b.icon || ''} ${b.name}`;
    overlay.querySelector('.panel-body').innerHTML = b.content || '';
    overlay.classList.remove('hidden');
    overlay.querySelector('.panel-body').scrollTop = 0;
    if (location.hash !== '#' + b.id) history.replaceState(null, '', '#' + b.id);
  }
  function closePanel() {
    panel.open = false; overlay.classList.add('hidden');
    blockAutoEnter = panel.building;
    history.replaceState(null, '', location.pathname + location.search);
  }
  overlay.querySelector('.panel-close').addEventListener('click', closePanel);
  overlay.addEventListener('pointerdown', (ev) => { if (ev.target === overlay) closePanel(); });

  // 안내도 메뉴
  const menu = { open: false };
  const menuEl = $('#menu');
  const list = menuEl.querySelector('.menu-list');
  for (const b of buildings) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.innerHTML = `<span>${b.icon || '🏠'}</span><span>${b.name}</span>`;
    btn.addEventListener('click', () => { closeMenu(); const c = tileCenter(b.entry.tx, b.entry.ty); player.x = c.x; player.y = c.y; player.dir = 'up'; player.path = null; openPanel(b); });
    li.appendChild(btn); list.appendChild(li);
  }
  function openMenu() { menu.open = true; keys.clear(); menuEl.classList.remove('hidden'); const f = list.querySelector('button'); if (f) f.focus(); }
  function closeMenu() { menu.open = false; menuEl.classList.add('hidden'); canvas.focus && canvas.focus(); }
  $('#menuBtn').addEventListener('click', () => (menu.open ? closeMenu() : openMenu()));
  menuEl.querySelector('.panel-close').addEventListener('click', closeMenu);
  menuEl.addEventListener('pointerdown', (ev) => { if (ev.target === menuEl) closeMenu(); });

  const uiOpen = () => dialog.open || panel.open || menu.open;
  let blockAutoEnter = null;

  // ---------- 업데이트 ----------
  function update(dt) {
    // 방문객
    let mx = 0, my = 0;
    if (!uiOpen()) {
      if (keys.has('left')) mx -= 1;
      if (keys.has('right')) mx += 1;
      if (keys.has('up')) my -= 1;
      if (keys.has('down')) my += 1;
    }
    player.moving = false;
    if (mx || my) {
      const len = Math.hypot(mx, my), step = player.speed * dt;
      player.dir = my < 0 ? 'up' : my > 0 ? 'down' : mx < 0 ? 'left' : 'right';
      if (mx && !my) player.dir = mx < 0 ? 'left' : 'right';
      moveWithCollision(player, (mx / len) * step, (my / len) * step);
      player.moving = true;
      // 문 앞에서 위로 걸으면 바로 입장
      const pt = tileOf(player);
      const b = buildings.find((bb) => bb.entry.tx === pt.tx && bb.entry.ty === pt.ty);
      if (b && my < 0 && !mx && b !== blockAutoEnter && blockedAt(player.x, player.y - 1)) openPanel(b);
    } else if (!uiOpen() && player.path) {
      const before = { x: player.x, y: player.y, n: player.path.length };
      player.moving = followPath(player, dt);
      if (player.path && player.path.length === before.n && before.x === player.x && before.y === player.y) player.path = null;
    }
    if (blockAutoEnter) {
      const pt = tileOf(player);
      if (pt.tx !== blockAutoEnter.entry.tx || pt.ty !== blockAutoEnter.entry.ty) blockAutoEnter = null;
    }
    player.anim = player.moving ? player.anim + dt : 0;

    // NPC
    for (const n of npcs) {
      n.moving = false;
      if (n.talking) { n.anim = 0; continue; }
      if (dist(n, player) < 22) { n.anim = 0; continue; } // 방문객이 가까우면 멈춤
      if (n.path) { n.moving = followPath(n, dt); }
      else {
        n.wait -= dt;
        if (n.wait <= 0) {
          n.wait = 2 + rand() * 4;
          const r = n.wander || 0;
          for (let k = 0; k < 8 && r; k++) {
            const tx = n.home.tx + rint(r * 2 + 1) - r, ty = n.home.ty + rint(r * 2 + 1) - r;
            if (walkable(tx, ty)) { const p = findPath(tileOf(n).tx, tileOf(n).ty, tx, ty, 300); if (p && p.length < 10) { n.path = p; break; } }
          }
          if (!n.path && rand() < 0.5) n.dir = ['down', 'left', 'right', 'up'][rint(4)];
        }
      }
      n.anim = n.moving ? n.anim + dt : 0;
    }
    if (clickMarker) { clickMarker.t += dt; if (!player.path) clickMarker = null; }
  }

  // ---------- 렌더링 ----------
  let dpr = 1, scale = 3;
  const cam = { x: 0, y: 0 };
  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    const byH = canvas.height / (TS * 13), byW = canvas.width / (TS * 18);
    scale = Math.max(1, Math.floor(Math.min(byH, byW) * 2) / 2);
    if (scale > 2) scale = Math.floor(scale);
  }
  addEventListener('resize', resize);

  function updateCamera() {
    const vw = canvas.width / scale, vh = canvas.height / scale;
    const mw = W * TS, mh = H * TS;
    cam.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, player.x - vw / 2));
    cam.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, player.y - 8 - vh / 2));
    cam.x = Math.round(cam.x * scale) / scale;
    cam.y = Math.round(cam.y * scale) / scale;
  }

  const buildingSprites = new Map();
  function drawBuilding(b) {
    const def = spriteDef('buildings', b.sprite);
    const bottom = (b.ty + b.h) * TS, cx = (b.tx + b.w / 2) * TS;
    if (def) { ctx.drawImage(IMG[def.image], def.sx, def.sy, def.sw, def.sh, Math.round(cx - def.sw / 2), bottom - def.sh, def.sw, def.sh); return; }
    if (!buildingSprites.has(b)) buildingSprites.set(b, makeBuildingSprite(b));
    const s = buildingSprites.get(b);
    ctx.drawImage(s, b.tx * TS, bottom - s.height);
  }
  function drawTree(o) {
    const def = spriteDef('objects', 'tree');
    const cx = o.tx * TS + 8 + o.ox, bottom = (o.ty + 1) * TS;
    if (def) { ctx.drawImage(IMG[def.image], def.sx, def.sy, def.sw, def.sh, Math.round(cx - def.sw / 2), bottom - def.sh, def.sw, def.sh); return; }
    ctx.drawImage(TREE_SPR[o.v], cx - 16, bottom - 40);
  }
  function drawCharacter(e) {
    const base = (A.characters && A.characters._default) || {};
    const own = A.characters && A.characters[e.sprite];
    const def = own && IMG[own.image] ? { ...base, ...own } : null;
    const frame = e.moving ? Math.floor(e.anim * 8) % 4 : 0;
    ctx.fillStyle = 'rgba(20,40,10,.3)';
    ctx.fillRect(Math.round(e.x) - 5, Math.round(e.y) - 1, 10, 2);
    if (def) {
      const di = Math.max(0, def.dirs.indexOf(e.dir));
      const f = frame % def.frames;
      const col = def.layout === 'rowsDir' ? f : di, row = def.layout === 'rowsDir' ? di : f;
      ctx.drawImage(IMG[def.image], def.originX + col * def.frameW, def.originY + row * def.frameH, def.frameW, def.frameH,
        Math.round(e.x - def.frameW / 2), Math.round(e.y - def.frameH + def.footOffset), def.frameW, def.frameH);
    } else {
      ctx.drawImage(charSprite(e.colors, e.dir, frame), Math.round(e.x) - 8, Math.round(e.y) - 19);
    }
  }

  function render(time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1f3a24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -cam.x * scale, -cam.y * scale);
    ctx.drawImage(groundCanvas, 0, 0);

    const vw = canvas.width / scale, vh = canvas.height / scale;
    const visible = (y, x) => x > cam.x - 64 && x < cam.x + vw + 64 && y > cam.y - 16 && y < cam.y + vh + 96;

    if (clickMarker) {
      const r = 3 + Math.sin(clickMarker.t * 10) * 1;
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(clickMarker.x - r), Math.round(clickMarker.y - 4 - r / 2), r * 2, r);
    }

    const drawables = [];
    for (const o of objects) {
      const x = o.kind === 'building' ? (o.tx + o.w / 2) * TS : o.tx * TS;
      if (visible(o.sortY, x)) drawables.push(o);
    }
    for (const n of npcs) drawables.push({ kind: 'char', e: n, sortY: n.y });
    drawables.push({ kind: 'char', e: player, sortY: player.y + 0.1 });
    drawables.sort((a, b) => a.sortY - b.sortY);

    const fFrame = Math.floor(time / 300) % 2;
    for (const d of drawables) {
      if (d.kind === 'building') drawBuilding(d);
      else if (d.kind === 'tree') drawTree(d);
      else if (d.kind === 'sign') ctx.drawImage(SIGN_SPR, d.tx * TS, (d.ty + 1) * TS - 20);
      else if (d.kind === 'fountain') ctx.drawImage(FOUNTAIN_SPR[fFrame], d.tx * TS, (d.ty + 2) * TS - 36);
      else if (d.kind === 'char') drawCharacter(d.e);
    }

    if (debugOn) {
      ctx.fillStyle = 'rgba(255,0,0,.25)';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid[idx(x, y)]) ctx.fillRect(x * TS, y * TS, TS, TS);
    }

    // ---- 화면 좌표 UI (라벨, 말풍선) ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const toScreen = (x, y) => ({ x: (x - cam.x) * scale, y: (y - cam.y) * scale });
    const near = !uiOpen() ? nearestInteractable() : null;
    const fs = Math.round(12 * dpr);
    ctx.font = `${fs}px Galmuri11, 'Malgun Gothic', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    for (const b of buildings) {
      const hl = near === b || hoverTarget === b;
      const p = toScreen((b.tx + b.w / 2) * TS, b.ty * TS - 16);
      label(`${b.icon || ''} ${b.name}`, p.x, p.y, hl ? 1 : 0.8, hl ? '#ffe9a8' : '#fbeed2');
    }
    for (const n of npcs) {
      if (near === n || hoverTarget === n || n.owner) {
        const p = toScreen(n.x, n.y - 26);
        label(n.owner ? `★ ${n.name}` : n.name, p.x, p.y, near === n || hoverTarget === n ? 1 : 0.7, n.owner ? '#ffd84a' : '#fbeed2');
      }
    }
    if (near) {
      let p, txt;
      if (near.kind === 'building') { p = toScreen(near.entry.tx * TS + 8, near.entry.ty * TS - 22); txt = 'E  들어가기'; }
      else if (near.kind === 'sign') { p = toScreen(near.tx * TS + 8, near.ty * TS - 10); txt = 'E  읽기'; }
      else { p = toScreen(near.x, near.y - 38); txt = 'E  대화하기'; }
      const bob = Math.sin(time / 200) * 2 * dpr;
      label(txt, p.x, p.y + bob, 1, '#3b2614', '#fbeed2', '#6b4423');
    }
  }
  function label(text, x, y, alpha, color, bg = 'rgba(40,26,14,.85)', border = '#c99a5b') {
    const padX = 6 * dpr, h = 20 * dpr;
    const w = ctx.measureText(text).width + padX * 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = border; ctx.fillRect(Math.round(x - w / 2) - dpr, Math.round(y - h / 2) - dpr, Math.round(w) + 2 * dpr, h + 2 * dpr);
    ctx.fillStyle = bg; ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), h);
    ctx.fillStyle = color; ctx.fillText(text, x, y + dpr);
    ctx.globalAlpha = 1;
  }

  function updateDialogText(dt) {
    if (!dialog.open) return;
    const line = dialog.lines[dialog.i] || '';
    dialog.shown = Math.min(line.length, dialog.shown + dt * 40);
    dlgEl.querySelector('.dlg-text').textContent = line.slice(0, Math.floor(dialog.shown));
    dlgEl.querySelector('.dlg-next').style.visibility = dialog.shown >= line.length ? 'visible' : 'hidden';
  }

  // ---------- 디버그 ----------
  let debugOn = DEBUG;
  function toggleDebug() {
    debugOn = !debugOn;
    showDebug();
  }
  function showDebug() {
    const el = $('#debug');
    const loaded = Object.keys(IMG);
    el.textContent = `[에셋 확인]  F3로 숨기기\n불러온 이미지 (${loaded.length}): ${loaded.join(', ') || '없음'}\n\n못 찾은 파일 (${missing.length}):\n${missing.join('\n') || '없음'}`;
    el.classList.toggle('hidden', !debugOn);
  }

  // ---------- 9-slice UI 스킨 ----------
  function applyUiSkin() {
    const def = A.ui && A.ui.panel;
    if (!def || !IMG[def.image]) return;
    const src = IMG[def.image].src;
    document.querySelectorAll('.box').forEach((el) => {
      el.classList.add('skinned');
      el.style.borderWidth = `${def.width || def.slice * 3}px`;
      el.style.borderImage = `url("${src}") ${def.slice} fill / ${def.width || def.slice * 3}px stretch`;
    });
  }

  // ---------- 시작 ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    updateDialogText(dt);
    updateCamera();
    render(now);
    requestAnimationFrame(loop);
  }

  async function start() {
    document.title = V.title;
    $('#title').textContent = `🍅 ${V.title}`;
    await loadImages();
    if (missing.length) console.warn('[village] 못 찾은 에셋 (기본 그래픽으로 대체):', missing);
    try { await Promise.race([document.fonts && document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 폰트 없이 진행 */ }
    buildGround();
    applyUiSkin();
    resize();
    showDebug();
    $('#loading').classList.add('hidden');
    setTimeout(() => { if (!lastInputTime) $('#hint').classList.add('fade'); }, 12000);

    // #about 같은 주소로 들어오면 해당 건물 바로 열기
    const b = buildings.find((x) => '#' + x.id === location.hash);
    if (b) { const c = tileCenter(b.entry.tx, b.entry.ty); player.x = c.x; player.y = c.y; player.dir = 'up'; openPanel(b); }
    requestAnimationFrame(loop);
  }
  start();

  // 콘솔에서 확인용
  window.village = { player, npcs, buildings, findPath };
})();
