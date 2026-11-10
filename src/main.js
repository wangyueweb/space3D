/* STARFORGE-7 · 星锻七号 — 总装与运行时
   装配六个子Agent产出的零件模块，负责：场景/光照/后期、爆炸剖析、
   推进喷焰 shader、部件点选/标注/信息卡、UI 交互。 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { build as buildHull } from './modules/hullCore.js';
import { build as buildCockpit } from './modules/cockpit.js';
import { build as buildWings } from './modules/wings.js';
import { build as buildEngines } from './modules/engines.js';
import { build as buildPods } from './modules/pods.js';
import { build as buildOrbit } from './modules/orbitRing.js';

/* ---------------- URL 调试参数（供无头截图 QA） ---------------- */
const QS = new URLSearchParams(location.search);
const qPose = QS.get('pose') || 'assembled';   // assembled | explode
const qView = QS.get('view') || '';            // front | side | top | back | hero
const qUI = QS.get('ui') !== '0';
const qStill = QS.get('still') === '1';
const qFlame = QS.get('flame') !== '0';

/* ui=0：隐藏全部 HUD/面板（noui 类由 main.js 注入） */
if (qUI === false || QS.get('ui') === '0') {
  const st = document.createElement('style');
  st.textContent = '#brand,#hud,#side,#infoCard,#dock,#hint,#labels,#vignette,#scan{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
}

/* ---------------- 材质库 ---------------- */
function createMaterials(THREE) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const MAT = {
    hullPlating: std({ name: 'hullPlating', color: 0xb8bcc4, metalness: 0.42, roughness: 0.5, envMapIntensity: 0.55 }),
    hullDark:    std({ name: 'hullDark', color: 0x22262e, metalness: 0.55, roughness: 0.62, envMapIntensity: 0.5 }),
    metal:       std({ name: 'metal', color: 0x7d838c, metalness: 0.92, roughness: 0.34, envMapIntensity: 0.7 }),
    bronze:      std({ name: 'bronze', color: 0x8a6a3e, metalness: 0.85, roughness: 0.45, envMapIntensity: 0.6 }),
    rubber:      std({ name: 'rubber', color: 0x121316, metalness: 0.1, roughness: 0.95 }),
    glassDark:   std({ name: 'glassDark', color: 0x0a0f16, metalness: 0.4, roughness: 0.12, transparent: true, opacity: 0.85, envMapIntensity: 1.2 }),
    glassCyan:   std({ name: 'glassCyan', color: 0x9fd8e8, metalness: 0.2, roughness: 0.06, transparent: true, opacity: 0.42, envMapIntensity: 1.5, side: THREE.DoubleSide }),
    engineHousing: std({ name: 'engineHousing', color: 0x33383f, metalness: 0.8, roughness: 0.42, envMapIntensity: 0.6 }),
    engineNozzle:  std({ name: 'engineNozzle', color: 0x1b1e24, metalness: 0.95, roughness: 0.3, envMapIntensity: 0.9, side: THREE.DoubleSide }),
    warning:     std({ name: 'warning', color: 0xd8961e, metalness: 0.3, roughness: 0.6 }),
    goldFoil:    std({ name: 'goldFoil', color: 0xd8a940, metalness: 1.0, roughness: 0.24, envMapIntensity: 1.1 }),
    copper:      std({ name: 'copper', color: 0xa4653a, metalness: 0.95, roughness: 0.35, envMapIntensity: 0.8 }),
    blueAccent:  std({ name: 'blueAccent', color: 0x2f6fb8, metalness: 0.5, roughness: 0.4, envMapIntensity: 0.7 }),
    engineGlow:  new THREE.MeshBasicMaterial({ name: 'engineGlow', color: new THREE.Color(1.5, 2.4, 2.8) }),
    flame:       new THREE.MeshBasicMaterial({ name: 'flame', color: new THREE.Color(0.55, 0.95, 1.35), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    whiteGlow:   new THREE.MeshBasicMaterial({ name: 'whiteGlow', color: new THREE.Color(2.0, 2.1, 2.2) }),
    redLight:    new THREE.MeshBasicMaterial({ name: 'redLight', color: new THREE.Color(2.6, 0.35, 0.3) }),
    greenLight:  new THREE.MeshBasicMaterial({ name: 'greenLight', color: new THREE.Color(0.3, 2.4, 0.9) }),
    starSprite:  new THREE.MeshBasicMaterial({ name: 'starSprite', color: new THREE.Color(2.0, 2.0, 2.0), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  return MAT;
}

/* ---------------- 共享辅助 ---------------- */
function createHelpers(THREE, MAT) {
  const M = (mesh, mat) => {
    mesh.castShadow = true; mesh.receiveShadow = true;
    if (mat) mesh.material = mat;
    return mesh;
  };
  const mod = {
    N(tag) { const g = new THREE.Group(); g.name = tag; g.userData.isAssembly = true; return g; },
    box(w, h, d) { return new THREE.BoxGeometry(w, h, d); },
    cyl(rt, rb, h, seg = 24) { return new THREE.CylinderGeometry(rt, rb, h, seg, 1); },
    sph(r, seg = 20) { return new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg / 2))); },
    rnd(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; },
    mirror(fn) {
      // 经典镜像：fn 只按 side=1 建模，第二份整体 scale.x=-1
      const wrap = new THREE.Group();
      const g1 = new THREE.Group(); fn(g1, 1);
      const g2 = new THREE.Group(); fn(g2, 1); g2.scale.x = -1;
      wrap.add(g1, g2); wrap.name = 'mirrorPair';
      return wrap;
    },
    pair(fn) {
      // 感知侧向：fn(g, side) 自行处理 ±X，不做整体翻转
      const wrap = new THREE.Group();
      const g1 = new THREE.Group(); fn(g1, 1);
      const g2 = new THREE.Group(); fn(g2, -1);
      wrap.add(g1, g2); wrap.name = 'sidePair';
      return wrap;
    },
    // 棱面（flat-shaded）材质克隆，保持共享库不被污染
    flat(key) {
      if (!mod._flatCache) mod._flatCache = new Map();
      if (!mod._flatCache.has(key)) {
        const c = MAT[key].clone();
        c.flatShading = true;
        if (c.emissive) c.emissiveIntensity = 1;
        mod._flatCache.set(key, c);
      }
      return mod._flatCache.get(key);
    },
  };
  return { M, mod };
}

/* ---------------- 喷焰 Plume Shader ---------------- */
function createPlumeMaterial(THREE, core) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 }, uCore: { value: core } },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uCore;
      varying vec2 vUv; varying float vShake;
      void main(){
        vUv = uv;
        vec3 p = position;
        float t = uTime * 9.0;
        // 沿羽轴(y) 的湍流抖动：越靠尾部(uv.y->1)抖得越多
        float w1 = sin(p.y * 4.0 - t + p.x * 5.0) * 0.10;
        float w2 = sin(p.y * 11.0 - t * 1.7 + p.z * 7.0) * 0.05;
        float sway = (w1 + w2) * smoothstep(0.05, 1.0, uv.y);
        p.x += sway; p.z += sway * 0.7;
        // 尾部轻微收缩收缩脉动
        float pulse = 1.0 + 0.06 * sin(t * 2.3 + p.y);
        p.x *= pulse; p.z *= pulse;
        vShake = sway;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uPower; uniform float uCore;
      varying vec2 vUv; varying float vShake;
      void main(){
        float t = clamp(vUv.y, 0.0, 1.0);
        float body = pow(1.0 - t, 1.35);
        // 温度分层：核心白青 -> 中层青蓝 -> 尾端深蓝
        vec3 hot  = vec3(0.92, 0.98, 1.05);
        vec3 mid  = vec3(0.45, 0.85, 1.10);
        vec3 cool = vec3(0.12, 0.30, 0.85);
        vec3 col = mix(hot, mid, smoothstep(0.0, 0.45, t));
        col = mix(col, cool, smoothstep(0.45, 1.0, t));
        // 激波菱形（马赫环）
        float diamonds = pow(max(sin(t * 24.0 - 1.2), 0.0), 6.0);
        col += vec3(0.55, 0.75, 1.0) * diamonds * body * 0.9 * uCore;
        // 边缘柔软衰减（uv.x 为锥面圆周方向，无意义；用径向近似）
        float a = body * uPower;
        // 闪烁
        a *= 0.86 + 0.14 * sin(uTime * 21.0 + t * 30.0);
        col += hot * pow(body, 3.0) * 0.9 * uCore;
        gl_FragColor = vec4(col * a * 0.9, a * 0.34);
      }`,
  });
}

function createPlume(THREE, mat, radius, length) {
  const g = new THREE.ConeGeometry(radius, length, 28, 22, true);
  g.translate(0, length / 2, 0); // 底在原点，锥尖朝 +Y
  const mesh = new THREE.Mesh(g, mat);
  mesh.rotation.x = -Math.PI / 2; // 锥尖指向 -Z（舰尾喷射方向）
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.raycast = function () {}; // 不参与点选
  mesh.frustumCulled = true;
  return mesh;
}

/* ---------------- 主程序 ---------------- */
const app = {
  parts: [], meshToRec: new Map(), selected: null, explodeTarget: 0,
  flameOn: qFlame, autoRotate: !qStill && !QS.get('pose'),
};

function boot() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 3000);
  camera.position.set(46, 26, 62);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.minDistance = 7; controls.maxDistance = 220;
  controls.maxPolarAngle = Math.PI * 0.97;
  controls.autoRotate = app.autoRotate; controls.autoRotateSpeed = 0.55;
  controls.target.set(0, 0.3, 0);

  /* 环境反射 */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  /* 光照：主阳光 + 冷色轮缘光 + 半球补光 */
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
  sun.position.set(34, 30, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 4; sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x5aa8ff, 1.1);
  rim.position.set(-26, -8, -24); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9db8d8, 0.75);
  fill.position.set(10, 8, 30); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0x445577, 0x05060a, 0.35));

  /* 星野 */
  {
    const n = 3200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const r = 320 + rnd() * 520, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const t = rnd();
      c.setHSL(t < 0.75 ? 0.58 : t < 0.9 ? 0.09 : 0.0, 0.5, 0.65 + rnd() * 0.3);
      const b = 0.4 + rnd() * 0.9; col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad; cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    const m = new THREE.PointsMaterial({ size: 2.4, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const stars = new THREE.Points(g, m); stars.raycast = function () {}; scene.add(stars);
  }

  /* 远景星云光斑 */
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const cx = cv.getContext('2d');
    const grad = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(120,160,255,.85)'); grad.addColorStop(0.4, 'rgba(80,60,200,.32)'); grad.addColorStop(1, 'rgba(0,0,40,0)');
    cx.fillStyle = grad; cx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(cv);
    const nebs = [
      [520, 190, -620, 230, 0.42], [-460, -170, -460, 190, 0.32], [-120, -280, 420, 150, 0.26],
    ];
    for (const [x, y, z, s, o] of nebs) {
      const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
      const sp = new THREE.Sprite(sm); sp.position.set(x, y, z); sp.scale.setScalar(s);
      sp.raycast = function () {}; scene.add(sp);
    }
  }

  /* ---- 装配零件模块 ---- */
  const MAT = createMaterials(THREE);
  const { M, mod } = createHelpers(THREE, MAT);
  const shipRoot = new THREE.Group(); shipRoot.name = 'STARFORGE-7';
  scene.add(shipRoot);
  const envRoot = new THREE.Group(); envRoot.name = 'ENV'; scene.add(envRoot);

  const qEnv = QS.get('env') !== '0';
  const MODS = [
    { key: 'hull', name: '船体核心段', fn: buildHull, root: shipRoot },
    { key: 'cockpit', name: '机头座舱', fn: buildCockpit, root: shipRoot },
    { key: 'wings', name: '差动翼组', fn: buildWings, root: shipRoot },
    { key: 'engines', name: '主推进组', fn: buildEngines, root: shipRoot },
    { key: 'pods', name: '功能短舱', fn: buildPods, root: shipRoot },
    { key: 'orbit', name: '轨道环境', fn: buildOrbit, root: envRoot, env: true },
  ].filter(m => qEnv || !m.env);
  const status = {};
  for (const md of MODS) {
    try {
      const g = md.fn({ THREE, MAT, M, mod });
      g.name = md.name;
      md.root.add(g);
      md.group = g;
      md.meshCount = 0;
      g.traverse(o => { if (o.isMesh) md.meshCount++; });
      status[md.key] = { ok: true, meshes: md.meshCount };
    } catch (e) {
      console.error('[module fail]', md.name, e);
      status[md.key] = { ok: false, err: String(e && e.message || e) };
    }
  }

  /* ---- 收集爆炸零件记录 ---- */
  let idx = 0;
  const collect = (rootObj, moduleName) => {
    const found = [];
    rootObj.traverse(o => {
      const list = o.userData && o.userData.parts;
      if (Array.isArray(list)) for (const rec of list) {
        if (!rec || !rec.node) continue;
        rec.module = moduleName;
        rec.home = rec.node.position.clone();
        rec.dir = rec.dir && rec.dir.isVector3 ? rec.dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
        rec.dist = 1.6 + ((idx * 37) % 23) / 23 * 2.6;
        rec.cur = 0; rec.idx = idx++;
        rec.meshes = 0; rec.node.traverse(x => { if (x.isMesh) rec.meshes++; });
        rec.node.traverse(x => app.meshToRec.set(x, rec));
        found.push(rec);
      }
    });
    return found;
  };
  for (const md of MODS) {
    if (!md.group || md.env) continue;
    app.parts.push(...collect(md.group, md.name));
  }
  // 环境动画锚点
  let spinRing = null;
  if (MODS[5].group) {
    MODS[5].group.traverse(o => { if (o.userData && o.userData.spinRing) spinRing = o; });
  }

  /* ---- 推进喷焰：定位到引擎内焰盘 ---- */
  const plumeMats = []; const plumes = []; const engineLights = [];
  let flamePulseMeshes = [];
  if (MODS[3].group) {
    MODS[3].group.updateMatrixWorld(true);
    const throats = [];
    MODS[3].group.traverse(o => {
      if (o.isMesh && o.userData && o.userData.flame) {
        o.material = o.material.clone(); // 可独立脉动
        flamePulseMeshes.push(o);
        const p = new THREE.Vector3(); o.getWorldPosition(p);
        const r = (o.geometry && o.geometry.boundingSphere) ? o.geometry.boundingSphere.radius : 0.3;
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        throats.push({ pos: p, r: Math.max(0.22, o.geometry.boundingSphere.radius * 1.05) });
      }
      if (o.isMesh && o.userData && o.userData.glowRing) { o.material = o.material.clone(); flamePulseMeshes.push(o); }
    });
    shipRoot.updateMatrixWorld(true);
    for (const th of throats) {
      const core = th.r > 0.42 ? 1.15 : 0.85;
      const mat = createPlumeMaterial(THREE, core);
      plumeMats.push(mat);
      const inner = createPlume(THREE, mat, th.r * 0.75, th.r * 12);
      const outer = createPlume(THREE, mat, th.r * 1.4, th.r * 16);
      inner.position.copy(th.pos); outer.position.copy(th.pos);
      outer.renderOrder = 5; inner.renderOrder = 6;
      shipRoot.add(inner, outer);
      plumes.push(inner, outer);
      const li = new THREE.PointLight(0x66ccff, 26, 22, 1.9);
      li.position.copy(th.pos).add(new THREE.Vector3(0, 0, -2.2));
      shipRoot.add(li); engineLights.push(li);
    }
    // 舰尾体积光晕
    if (throats.length) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      const cx = cv.getContext('2d');
      const grad = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(160,220,255,1)'); grad.addColorStop(0.3, 'rgba(80,160,255,.4)'); grad.addColorStop(1, 'rgba(0,20,80,0)');
      cx.fillStyle = grad; cx.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(cv);
      const zc = throats.reduce((a, t) => a + t.pos.z, 0) / throats.length;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.position.set(0, 0, zc - 4); halo.scale.set(5.5, 5.5, 1);
      halo.raycast = function () {}; shipRoot.add(halo);
      plumes.push(halo);
    }
  }
  const setFlame = (on) => {
    app.flameOn = on;
    for (const p of plumes) p.visible = on;
    for (const l of engineLights) l.visible = on;
    document.getElementById('btnFlame').classList.toggle('on', on);
  };

  /* ---- 爆炸剖析 ---- */
  const setExplode = (f, instant) => {
    app.explodeTarget = f;
    for (const r of app.parts) {
      if (instant) {
        r.cur = f;
        r.node.position.copy(r.home).addScaledVector(r.dir, f * r.dist);
      }
    }
    document.getElementById('btnExplode').classList.toggle('on', f > 0.5);
    document.getElementById('btnExplode').textContent = f > 0.5 ? '⟲ 重新组装' : '⚡ 一键剖析';
    document.getElementById('explodeRange').value = f;
  };

  /* ---- 相机 ---- */
  const VIEWS = {
    hero: [19, 9.5, 27], front: [0.5, 2.5, 30], side: [30, 3, 2], top: [0.1, 34, 4], back: [-4, 6, -28],
  };
  let camTween = null;
  const flyTo = (pos, target, dur = 1100) => {
    camTween = { t0: performance.now(), dur, p0: camera.position.clone(), p1: new THREE.Vector3(...pos), c0: controls.target.clone(), c1: new THREE.Vector3(...(target || [0, 0.3, 0])) };
  };
  const resetView = () => { flyTo(VIEWS.hero); clearSelect(); };
  if (qView && VIEWS[qView]) camera.position.set(...VIEWS[qView]);
  else flyTo(VIEWS.hero, null, 2400);

  /* ---- 点选 ---- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const hlMats = new Map();
  const clearSelect = () => {
    if (app.selected) {
      for (const [m, orig] of hlMats) m.material = orig;
      hlMats.clear();
    }
    app.selected = null;
    document.getElementById('infoCard').classList.remove('show');
  };
  const selectRec = (rec) => {
    clearSelect();
    app.selected = rec;
    rec.node.traverse(o => {
      if (o.isMesh && o.material && o.material.isMeshStandardMaterial) {
        hlMats.set(o, o.material);
        const c = o.material.clone();
        c.emissive = new THREE.Color(0x1899b8); c.emissiveIntensity = 0.55;
        o.material = c;
      }
    });
    // 信息卡
    const box = new THREE.Box3().setFromObject(rec.node);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.6, size.length() / 2);
    const dir = camera.position.clone().sub(controls.target).normalize().multiplyScalar(radius * 3.4 + 3);
    flyTo(center.clone().add(dir).toArray(), center.toArray(), 900);
    const el = document.getElementById('infoCard');
    el.innerHTML = `
      <div class="ic-title">${rec.label || '零件'}</div>
      <div class="ic-sub">${rec.module} · 编号 P-${String(rec.idx + 1).padStart(3, '0')}</div>
      <div class="ic-grid">
        <div><i>网格</i><b>${rec.meshes}</b></div>
        <div><i>尺寸</i><b>${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} m</b></div>
        <div><i>分离矢量</i><b>[${rec.dir.x.toFixed(2)}, ${rec.dir.y.toFixed(2)}, ${rec.dir.z.toFixed(2)}]</b></div>
        <div><i>状态</i><b class="ok">在役 · 结构完整</b></div>
      </div>
      <button class="ic-btn" id="icClose">✕ 关闭</button>`;
    el.classList.add('show');
    document.getElementById('icClose').onclick = clearSelect;
  };
  let downXY = null;
  canvas.addEventListener('pointerdown', e => { downXY = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => {
    if (!downXY) return;
    const dx = e.clientX - downXY[0], dy = e.clientY - downXY[1];
    downXY = null;
    if (dx * dx + dy * dy > 36) return; // 拖拽不算点选
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(shipRoot.children, true);
    for (const h of hits) {
      const rec = app.meshToRec.get(h.object);
      if (rec) { selectRec(rec); return; }
    }
    clearSelect();
  });
  canvas.addEventListener('pointermove', e => {
    if (downXY) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(shipRoot.children, true);
    canvas.style.cursor = hits.some(h => app.meshToRec.get(h.object)) ? 'pointer' : 'grab';
  });

  /* ---- 零件清单面板 ---- */
  {
    const byMod = new Map();
    for (const r of app.parts) { if (!byMod.has(r.module)) byMod.set(r.module, []); byMod.get(r.module).push(r); }
    const list = document.getElementById('partList');
    let html = '';
    for (const [mn, recs] of byMod) {
      html += `<div class="pl-mod"><div class="pl-mod-name">${mn} <span>${recs.length} 件</span></div>`;
      recs.slice(0, 14).forEach(r => { html += `<button class="pl-item" data-i="${r.idx}">${r.label || '零件'}<i>P-${String(r.idx + 1).padStart(3, '0')}</i></button>`; });
      if (recs.length > 14) html += `<div class="pl-more">…等 ${recs.length - 14} 件</div>`;
      html += '</div>';
    }
    list.innerHTML = html;
    list.querySelectorAll('.pl-item').forEach(b => b.onclick = () => selectRec(app.parts[+b.dataset.i]));
  }
  const totalMeshes = (() => { let n = 0; shipRoot.traverse(o => { if (o.isMesh) n++; }); return n; })();
  document.getElementById('statParts').textContent = app.parts.length;
  document.getElementById('statMeshes').textContent = totalMeshes;

  /* ---- 标注（爆炸时浮现） ---- */
  const labelLayer = document.getElementById('labels');
  const labeled = app.parts.filter(r => {
    const box = new THREE.Box3().setFromObject(r.node);
    return box.getSize(new THREE.Vector3()).length() > 1.6;
  }).slice(0, 26);
  const labelEls = labeled.map(r => {
    const d = document.createElement('div');
    d.className = 'lbl'; d.textContent = r.label || '零件';
    d.onclick = () => selectRec(r);
    labelLayer.appendChild(d);
    return { el: d, rec: r, v: new THREE.Vector3() };
  });
  const proj = new THREE.Vector3();
  const updateLabels = () => {
    const show = app.explodeTarget > 0.4 && qUI;
    for (const L of labelEls) {
      if (!show) { L.el.style.opacity = 0; continue; }
      L.rec.node.getWorldPosition(L.v);
      L.v.project(camera);
      const vis = L.v.z < 1;
      L.el.style.opacity = vis ? Math.min(1, (app.explodeTarget - 0.4) * 4) : 0;
      if (vis) {
        L.el.style.transform = `translate(${((L.v.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((-L.v.y + 1) / 2 * innerHeight).toFixed(1)}px)`;
      }
    }
  };

  /* ---- 后期 ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.45, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  /* ---- UI 绑定 ---- */
  document.getElementById('btnExplode').onclick = () => setExplode(app.explodeTarget > 0.5 ? 0 : 1);
  document.getElementById('explodeRange').oninput = e => setExplode(+e.target.value);
  document.getElementById('btnFlame').onclick = () => setFlame(!app.flameOn);
  document.getElementById('btnSpin').onclick = () => {
    controls.autoRotate = !controls.autoRotate;
    document.getElementById('btnSpin').classList.toggle('on', controls.autoRotate);
  };
  document.getElementById('btnWire').onclick = () => {
    const on = document.getElementById('btnWire').classList.toggle('on');
    for (const k of ['hullPlating', 'hullDark', 'metal', 'bronze', 'engineHousing', 'engineNozzle', 'warning', 'copper', 'blueAccent']) MAT[k].wireframe = on;
  };
  document.getElementById('btnReset').onclick = resetView;
  addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); setExplode(app.explodeTarget > 0.5 ? 0 : 1); } });
  setFlame(app.flameOn);
  document.getElementById('btnSpin').classList.toggle('on', controls.autoRotate);
  if (qPose === 'explode') setExplode(1, true);
  if (!qUI) document.body.classList.add('noui');

  /* ---- 主循环 ---- */
  const clock = new THREE.Clock();
  let frames = 0, fpsT = performance.now();
  const tmpV = new THREE.Vector3();
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;

    // 相机补间
    if (camTween) {
      const k = Math.min(1, (performance.now() - camTween.t0) / camTween.dur);
      const e = easeIO(k);
      camera.position.lerpVectors(camTween.p0, camTween.p1, e);
      controls.target.lerpVectors(camTween.c0, camTween.c1, e);
      if (k >= 1) camTween = null;
    }
    controls.update();

    // 爆炸缓动（带节奏差）
    const anyMoving = false;
    for (const r of app.parts) {
      const sp = 2.2 + ((r.idx * 13) % 9) * 0.28;
      r.cur += (app.explodeTarget - r.cur) * (1 - Math.exp(-dt * sp));
      if (Math.abs(app.explodeTarget - r.cur) > 0.001) {
        r.node.position.copy(r.home).addScaledVector(r.dir, r.cur * r.dist);
      }
    }

    // 舰体呼吸浮动
    if (!qStill) {
      shipRoot.position.y = Math.sin(t * 0.5) * 0.14;
      shipRoot.rotation.z = Math.sin(t * 0.21) * 0.018;
      shipRoot.rotation.x = Math.sin(t * 0.17 + 1) * 0.012;
    }

    // 喷焰
    for (const m of plumeMats) m.uniforms.uTime.value = t;
    flamePulseMeshes.forEach((o, i) => {
      if (o.material.transparent) o.material.opacity = 0.4 + 0.18 * (0.5 + 0.5 * Math.sin(t * 11 + i * 2.1));
    });
    engineLights.forEach((l, i) => { l.intensity = app.flameOn ? 22 + 9 * (0.5 + 0.5 * Math.sin(t * 13 + i * 1.7)) : 0; });

    // 空间站缓旋
    if (spinRing) spinRing.rotation.z += dt * 0.05;

    // 标注
    updateLabels();

    composer.render();

    frames++;
    const now = performance.now();
    if (now - fpsT > 1000) {
      document.getElementById('statFps').textContent = Math.round(frames * 1000 / (now - fpsT));
      frames = 0; fpsT = now;
    }
  }
  loop();

  // 隐藏加载层
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const lo = document.getElementById('loading');
    lo.classList.add('done');
    setTimeout(() => lo.remove(), 900);
    document.getElementById('modStatus').textContent = Object.entries(status).map(([k, v]) => `${k}${v.ok ? '✓' : '✗'}`).join(' ');
  }));
}

boot();
