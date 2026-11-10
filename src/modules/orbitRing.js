/*
 * STARFORGE-7 · ENVIRONMENT MODULE — ORBITAL CONTEXT SET
 * 轨道空间站环 (orbital station ring) + 远处行星 (distant planet) + 星野锚点 (star anchors)
 * ---------------------------------------------------------------------------
 * Contract:
 *   export function build({ THREE, MAT, M, mod }) → THREE.Group
 *   · plain ES module, no three import — the assembler injects THREE / MAT / M / mod
 *   · pure environment: every solid stays > 15 units from world origin
 *     (the 18-unit ship floats there); the ring sits at x ≈ -28 facing the ship
 *   · group.userData.spinRing → ring group built in torus frame (ring in local
 *     XY, axis = local +Z ≈ world X). Assembler spins it via rotation.z;
 *     spin.userData.spinRing = true is the flag it traverses for.
 *   · no userData.parts — environment never explodes
 *   · ~210 draw objects (budget ≤ 220); all scatter deterministic via mod.rnd
 *   · shared MAT instances are read-only — never cloned or mutated here
 */
export function build({ THREE, MAT, M, mod }) {
  /* ---------- geometry helpers (mod-first, THREE fallback) ---------- */
  const G = {
    box: (w, h, d) => (mod.box ? mod.box(w, h, d) : new THREE.BoxGeometry(w, h, d)),
    cyl: (rt, rb, h, s) => (mod.cyl ? mod.cyl(rt, rb, h, s) : new THREE.CylinderGeometry(rt, rb, h, s)),
    sph: (r, s) => (mod.sph ? mod.sph(r, s) : new THREE.SphereGeometry(r, s, s)),
    tor: (r, t, rs, ts) => new THREE.TorusGeometry(r, t, rs, ts),
    oct: (r) => new THREE.OctahedronGeometry(r, 0),
    ico: (r) => new THREE.IcosahedronGeometry(r, 0),
  };

  /* ---------- deterministic RNG (uses mod.rnd when it yields a sequence) ---------- */
  let seq = null;
  try { seq = mod.rnd(0x57a2f1); } catch (e) { seq = null; }
  let _s = 0x61c88647;
  const frnd = typeof seq === 'function' ? seq : function () {
    _s |= 0; _s = (_s + 0x6d2b79f5) | 0; // mulberry32 fallback keeps runs reproducible
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rr = (a, b) => a + (b - a) * frnd();

  /* ---------- mesh helper: real M takes a constructed Mesh; tolerate M(geo, mat) ---------- */
  let meshOf = null;
  const mkMesh = (g, m) => {
    if (meshOf) return meshOf(g, m);
    let t = null;
    try { t = M(new THREE.Mesh(g, m), m); } catch (e) { t = null; }
    if (t && t.isMesh) { meshOf = (a, b) => M(new THREE.Mesh(a, b), b); return t; }
    try { t = M(g, m); } catch (e) { t = null; }
    if (t && t.isMesh && t.geometry === g) { meshOf = (a, b) => M(a, b); return t; }
    meshOf = (a, b) => new THREE.Mesh(a, b);
    return meshOf(g, m);
  };
  const noPick = (o) => { o.raycast = function () {}; return o; }; // env never intercepts picking
  const mk = (g, m, x, y, z) => {
    const o = noPick(mkMesh(g, m));
    o.position.set(x || 0, y || 0, z || 0);
    return o;
  };

  /* ---------- named group factory: honors mod.N if it returns an Object3D ---------- */
  const grp = (t) => {
    let o = null;
    try { o = mod.N(t); } catch (e) { o = null; }
    if (!o || !o.isObject3D) o = new THREE.Group();
    else if (!o.name && typeof t === 'string') o.name = t;
    return o;
  };

  const group = grp('orbitRing.env');

  /* =======================================================================
   * 1 · TORUS STATION RING — center x = -28, ring plane ⟂ world X
   *     anchor (static cinematic tilt) → spin (assembler rotates .z) →
   *     core built directly in torus frame (ring in local XY, axis = +Z),
   *     so rotation.z spins the wheel about its own axle.
   * ===================================================================== */
  const anchor = grp('orbitRing.anchor');
  anchor.position.set(-110, 26, -60);
  anchor.rotation.set(0.07, Math.PI / 2 + 0.09, 0.04); // ring axis (+Z) → ≈ world X
  anchor.scale.setScalar(0.5); // whole station pulled back & scaled for hero framing
  group.add(anchor);

  const spin = grp('orbitRing.spinRing');
  anchor.add(spin);
  group.userData.spinRing = spin; // contract reference…
  spin.userData.spinRing = true;  // …and the flag the assembler traverses for

  const core = grp('orbitRing.core'); // already in spin's frame — no extra rotation
  spin.add(core);

  // ring hull + inner cargo rail
  core.add(mk(G.tor(40, 3, 18, 110), MAT.metal, 0, 0, 0));
  core.add(mk(G.tor(34.6, 0.8, 8, 90), MAT.hullDark, 0, 0, 0));

  // central habitat hub along the ring axis (local Z)
  const hub = mk(G.cyl(6.5, 6.5, 16, 24), MAT.hullPlating, 0, 0, 0);
  hub.rotation.x = Math.PI / 2;
  core.add(hub);
  for (let e = -1; e <= 1; e += 2) {
    const cap = mk(G.cyl(7.1, 7.1, 1.4, 24), MAT.hullDark, 0, 0, e * 8.6);
    cap.rotation.x = Math.PI / 2;
    core.add(cap);
    core.add(mk(G.tor(6.62, 0.22, 6, 40), MAT.whiteGlow, 0, 0, e * 2.6)); // window strips
    const trim = mk(G.cyl(6.9, 6.9, 0.9, 24), MAT.bronze, 0, 0, e * 6.1);
    trim.rotation.x = Math.PI / 2;
    core.add(trim);
  }
  // individual hub windows
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + 0.26;
    const w = mk(G.box(0.35, 1.1, 2.2), MAT.whiteGlow, Math.cos(a) * 6.62, Math.sin(a) * 6.62, 0);
    w.rotation.z = a;
    core.add(w);
  }
  // spokes hub → ring
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    const sp = mk(G.box(28, 1.1, 2.0), k % 2 ? MAT.hullDark : MAT.hullPlating, Math.cos(a) * 20.5, Math.sin(a) * 20.5, 0);
    sp.rotation.z = a;
    core.add(sp);
  }

  // twin solar wings inside the ring — model one +X wing, mod.mirror adds the −X twin
  const wingCount = { n: 0 };
  const buildWingInto = (g) => {
    const strut = mk(G.cyl(0.35, 0.35, 27, 6), MAT.metal, 20.0, 0, 0);
    strut.rotation.z = Math.PI / 2;
    g.add(strut);
    g.add(mk(G.box(23, 3.6, 0.5), MAT.blueAccent, 20.5, 0, 0));
    wingCount.n++;
  };
  let wingsPlaced = false;
  if (typeof mod.mirror === 'function') {
    try {
      const wrap = mod.mirror((g) => buildWingInto(g)); // assembler semantics: fn(group, side)
      if (wingCount.n >= 2 && wrap && wrap.isObject3D) { core.add(wrap); wingsPlaced = true; }
    } catch (e) { /* fall through to manual pair */ }
  }
  if (!wingsPlaced) {
    const wA = grp('orbitRing.wingP'); buildWingInto(wA); core.add(wA);
    const wB = grp('orbitRing.wingN'); buildWingInto(wB); wB.scale.x = -1; core.add(wB);
  }

  // 48 radial greeble stations around the torus
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + rr(-0.02, 0.02);
    const r = 41.3 + rr(-0.5, 0.9);
    const mat = i % 11 === 0 ? MAT.goldFoil : i % 3 === 0 ? MAT.hullDark : MAT.hullPlating;
    const p = mk(G.box(rr(1.9, 2.6), rr(1.1, 1.7), rr(3.6, 5.2)), mat, Math.cos(a) * r, Math.sin(a) * r, rr(-1.1, 1.1));
    p.rotation.z = a;
    core.add(p);
    if (i % 6 === 1) { // nav lights (8)
      core.add(mk(G.sph(0.42, 6), MAT.greenLight, Math.cos(a) * 43.3, Math.sin(a) * 43.3, 1.7));
    }
    if (i % 12 === 5) { // antenna masts + beacon lights at 4 near-quarter points
      const ant = mk(G.cyl(0.1, 0.1, 5.5, 6), MAT.metal, Math.cos(a) * 40.6, Math.sin(a) * 40.6, 5.9);
      ant.rotation.x = Math.PI / 2;
      core.add(ant);
      core.add(mk(G.sph(0.5, 6), MAT.redLight, Math.cos(a) * 40.6, Math.sin(a) * 40.6, 9.2));
    }
  }

  // three radial docking arms with lit pads
  const armAngles = [0.5, 2.6, 4.6];
  for (let j = 0; j < armAngles.length; j++) {
    const a = armAngles[j];
    const arm = mk(G.box(8, 1.4, 1.4), MAT.engineHousing, Math.cos(a) * 46, Math.sin(a) * 46, 0);
    arm.rotation.z = a;
    core.add(arm);
    const pad = mk(G.box(1.1, 3.8, 3.8), MAT.hullPlating, Math.cos(a) * 50.6, Math.sin(a) * 50.6, 0);
    pad.rotation.z = a;
    core.add(pad);
    core.add(mk(G.sph(0.34, 5), j === 1 ? MAT.redLight : MAT.greenLight, Math.cos(a) * 51.4, Math.sin(a) * 51.4, 0));
  }

  // glass observatory dome riding the ring
  const dome = mk(G.sph(2.1, 12), MAT.glassDark, Math.cos(1.31) * 42.4, Math.sin(1.31) * 42.4, 2.5);
  dome.scale.set(1, 1, 0.62);
  core.add(dome);

  // hub docking bay on the far (-axis) side — protrudes AWAY from the ship
  core.add(mk(G.box(5, 5, 6.5), MAT.engineHousing, 0, 0, -13));
  const bayCollar = mk(G.cyl(3.1, 3.1, 1.6, 12), MAT.warning, 0, 0, -9.7);
  bayCollar.rotation.x = Math.PI / 2;
  core.add(bayCollar);
  core.add(mk(G.tor(2.3, 0.5, 8, 24), MAT.whiteGlow, 0, 0, -16.5)); // bay entry glow ring
  core.add(mk(G.sph(1.7, 10), MAT.engineGlow, 0, 0, -17.6)); // station-keeping thruster glow

  /* =======================================================================
   * 2 · DISTANT PLANET — (55, -25, -110), r ≈ 90, MAT-only terminator build:
   *     opaque blueAccent globe + hullDark globe offset anti-sunward (⟂ to
   *     the sightline) occludes half of it (terminator illusion), whiteGlow
   *     city lights on the sun-lit swath, whiteGlow + blueAccent rims as
   *     atmosphere. The night-side globe swallows the far arc of the rim
   *     rings, so the atmosphere reads as an open glow on the lit limb.
   * ===================================================================== */
  const planet = grp('orbitRing.planet');
  planet.position.set(46, -20, -155);
  group.add(planet);

  const vTo = new THREE.Vector3(46, -20, -155).normalize(); // origin → planet
  const vHome = vTo.clone().negate();                       // planet → origin (ship side)
  // Key light of the assembled scene (main.js sun at (34,30,22) aimed at origin).
  // Terminator geometry: offset the night-side globe ANTI-sunward in the plane
  // perpendicular to the sightline, so the surviving blue swath is the sun-lit,
  // ship-facing side — not the planet's own shadow side.
  const vSun = new THREE.Vector3(34 - 46, 30 + 20, 22 + 155).normalize();
  const vSunPerp = vSun.clone().addScaledVector(vTo, -vSun.dot(vTo)).normalize();

  const PR = 30; // planet radius — deep background scale
  planet.add(mk(G.sph(PR, 48), MAT.blueAccent, 0, 0, 0)); // lit ocean globe
  const night = mk(G.sph(PR + 0.3, 48), MAT.hullDark, -vSunPerp.x * 6, -vSunPerp.y * 6, -vSunPerp.z * 6); // night occluder
  planet.add(night);

  const rimQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vTo);
  const rim1 = mk(G.tor(PR + 0.6, 0.35, 8, 120), MAT.whiteGlow, 0, 0, 0);
  rim1.quaternion.copy(rimQ);
  planet.add(rim1);
  const rim2 = mk(G.tor(PR + 1.2, 0.22, 6, 120), MAT.blueAccent, 0, 0, 0);
  rim2.quaternion.copy(rimQ);
  planet.add(rim2);

  // ~60 city-light dots on the visible, sun-lit blue swath
  let dots = 0;
  for (let tries = 0; tries < 700 && dots < 60; tries++) {
    const th = rr(0, Math.PI * 2);
    const zc = rr(-1, 1);
    const rc = Math.sqrt(Math.max(0.02, 1 - zc * zc));
    const nx = rc * Math.cos(th), ny = rc * Math.sin(th), nz = zc;
    if (nx * vHome.x + ny * vHome.y + nz * vHome.z < 0.25) continue; // must face the ship
    if (nx * vSun.x + ny * vSun.y + nz * vSun.z < 0.1) continue;     // must be day side
    if (nx * vSunPerp.x + ny * vSunPerp.y + nz * vSunPerp.z < 0.05) continue; // lit blue swath
    planet.add(mk(G.sph(rr(0.12, 0.3), 5), MAT.whiteGlow, nx * (PR + 0.25), ny * (PR + 0.25), nz * (PR + 0.25)));
    dots++;
  }

  /* =======================================================================
   * 3 · DEBRIS FIELD — 14 tumbling rocks + 2 derelict panel slabs,
   *     22–58 units out, kept clear of the station torus circle.
   * ===================================================================== */
  const debris = grp('orbitRing.debris');
  group.add(debris);

  anchor.updateMatrixWorld(true); // refresh matrices for the clearance test below
  const probe = new THREE.Vector3();
  const ringClear = (p) => { // ≥ 9 from the torus circle (anchor frame: ring in XY, axis = Z)
    probe.copy(p);
    anchor.worldToLocal(probe);
    return Math.hypot(Math.hypot(probe.x, probe.y) - 40, probe.z) >= 9;
  };
  const scatter = (dMin, dMax) => {
    const p = new THREE.Vector3();
    for (let t = 0; t < 24; t++) {
      const th = rr(0, Math.PI * 2);
      const yc = rr(-0.85, 0.85);
      const rc = Math.sqrt(Math.max(0.05, 1 - yc * yc));
      const d = rr(dMin, dMax);
      p.set(rc * Math.cos(th) * d, yc * d, rc * Math.sin(th) * d);
      if (t === 23 || ringClear(p)) break;
    }
    return p;
  };

  for (let i = 0; i < 14; i++) {
    const base = rr(0.35, 1.15); // spec: overall rock scale 0.3–1.2, non-uniform per axis
    const rock = noPick(mkMesh(G.ico(1), i % 7 === 3 ? MAT.goldFoil : i % 2 ? MAT.hullDark : MAT.metal));
    rock.scale.set(base * rr(0.7, 1.35), base * rr(0.7, 1.35), base * rr(0.7, 1.35));
    rock.rotation.set(rr(0, Math.PI), rr(0, Math.PI), rr(0, Math.PI));
    rock.position.copy(scatter(22, 58));
    debris.add(rock);
  }
  for (let i = 0; i < 2; i++) {
    const slab = noPick(mkMesh(G.box(rr(4, 5.5), 0.4, rr(2, 2.8)), MAT.hullPlating));
    slab.add(mk(G.box(2, 0.14, 1.5), MAT.goldFoil, rr(-1.2, 1.2), 0.28, rr(-0.6, 0.6)));
    slab.position.copy(scatter(26, 46));
    slab.rotation.set(rr(0, Math.PI), rr(0, Math.PI), rr(0, Math.PI));
    debris.add(slab);
  }

  /* =======================================================================
   * 4 · NAVIGATION BEACON CHAIN — 3 octahedron buoys (engineHousing body,
   *     hazard collar, whiteGlow tip) arcing from the ship toward the
   *     planet, 24–33 units out.
   * ===================================================================== */
  const chain = grp('orbitRing.beacons');
  group.add(chain);
  for (let k = 0; k < 3; k++) {
    const az = 0.55 + k * 0.5;
    const rad = 24 + k * 4.5;
    const buoy = grp('orbitRing.buoy' + (k + 1));
    buoy.position.set(Math.sin(az) * rad, rr(-2.5, 5.5), -Math.cos(az) * rad);
    buoy.rotation.z = rr(-0.16, 0.16);
    const body = noPick(mkMesh(G.oct(1.15), MAT.engineHousing));
    body.scale.set(0.78, 1.35, 0.78);
    buoy.add(body);
    buoy.add(mk(G.cyl(0.98, 0.98, 0.5, 8), MAT.warning, 0, 0, 0));
    buoy.add(mk(G.oct(0.5), MAT.whiteGlow, 0, 1.9, 0));
    chain.add(buoy);
  }

  /* =======================================================================
   * 5 · STARFIELD ANCHORS — 16 bright additive anchors on a 150–240 shell
   *     (星野锚点). Uses THREE.Sprite only when MAT.starSprite is a true
   *     SpriteMaterial; otherwise the shared additive basic material rides
   *     tiny octahedra, which glow from any viewing angle.
   * ===================================================================== */
  const starField = grp('orbitRing.starAnchors');
  group.add(starField);
  const asSprite = !!(MAT.starSprite && MAT.starSprite.isSpriteMaterial);
  for (let i = 0; i < 16; i++) {
    const th = rr(0, Math.PI * 2);
    const yc = rr(-0.75, 0.85);
    const rc = Math.sqrt(Math.max(0.05, 1 - yc * yc));
    const d = rr(150, 240);
    const x = rc * Math.cos(th) * d, y = yc * d, z = rc * Math.sin(th) * d;
    if (asSprite) {
      const s = new THREE.Sprite(MAT.starSprite);
      const sz = rr(1.6, 4.6);
      s.scale.set(sz, sz, 1);
      s.position.set(x, y, z);
      noPick(s);
      starField.add(s);
    } else {
      starField.add(mk(G.oct(rr(0.9, 2.4)), MAT.starSprite, x, y, z));
    }
  }

  return group;
}
