/* ============================================================================
 * STARFORGE-7 · 中央船体核心 (hullCore) — 脊背龙骨 + 主段船体
 * 纵向 Z ≈ -4 … +6（含艏/艉结构对接轴延伸），1 unit = 1 m
 * 坐标: +Z 艏(nose) · +Y 背(dorsal) · +X 左舷(port · 红色航行灯) · -X 右舷(绿)
 * 爆炸方向约定: 龙骨≈0 · 船体壳板/装甲板 ±X · 背部 +Y · 腹部 -Y · 舷侧通道 ±X
 * 纯 ES module，无 import；装配器调用 build({ THREE, MAT, M, mod })
 * ==========================================================================*/
export function build({ THREE, MAT, M, mod }) {
  const group = mod.N('hullCore');
  const parts = group.userData.parts = [];

  /* ---------------- 工具与共享件 ---------------- */
  const rand = mod.rnd
    ? mod.rnd(773491)
    : (function () { let s = 773491 >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const F = (k) => (mod.flat ? mod.flat(k) : MAT[k]); // 棱面 flat-shaded 材质
  const box = (w, h, d) => (mod.box ? mod.box(w, h, d) : new THREE.BoxGeometry(w, h, d));
  const cyl = (rt, rb, h, seg) => (mod.cyl ? mod.cyl(rt, rb, h, seg) : new THREE.CylinderGeometry(rt, rb, h, seg, 1));
  const sph = (r, s) => (mod.sph ? mod.sph(r, s) : new THREE.SphereGeometry(r, s || 10, 8));

  // 爆炸方向预设
  const D = {
    keel: new THREE.Vector3(0, 0, 0),
    px: new THREE.Vector3(1, 0, 0),
    nx: new THREE.Vector3(-1, 0, 0),
    py: new THREE.Vector3(0, 1, 0),
    ny: new THREE.Vector3(0, -1, 0),
  };
  const radial = (a) => new THREE.Vector3(Math.cos(a), Math.sin(a), 0);

  // 网格工厂：M 包装 + 阴影 + 挂载 + 爆炸登记
  function mk(geo, mat, label, dir, x, y, z) {
    let p = M(new THREE.Mesh(geo), mat);
    if (!p || !p.isObject3D) p = new THREE.Mesh(geo, mat);
    p.castShadow = true;
    p.receiveShadow = true;
    p.position.set(x || 0, y || 0, z || 0);
    group.add(p);
    parts.push({ node: p, label, dir: dir.clone() });
    return p;
  }

  // 朝向基座：local X=切向, local Y=船轴+Z, local Z=外法线（可叠加坡度扭转）
  const _m4 = new THREE.Matrix4();
  const _qTilt = (t) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), t);
  function mountOut(p, alpha, tilt) {
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    _m4.makeBasis(new THREE.Vector3(-sa, ca, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(ca, sa, 0));
    p.quaternion.setFromRotationMatrix(_m4);
    if (tilt) p.quaternion.multiply(_qTilt(tilt));
  }

  // 倒角八边形板（ExtrudeGeometry + bevel，杜绝裸盒）
  const _plateCache = new Map();
  function chamferRect(w, h, c) {
    const s = new THREE.Shape();
    const cc = Math.max(0.008, Math.min(c, w / 2 - 0.01, h / 2 - 0.01));
    const x = w / 2 - cc, y = h / 2 - cc;
    s.moveTo(-x, -h / 2); s.lineTo(x, -h / 2); s.lineTo(w / 2, -y); s.lineTo(w / 2, y);
    s.lineTo(x, h / 2); s.lineTo(-x, h / 2); s.lineTo(-w / 2, y); s.lineTo(-w / 2, -y);
    s.closePath();
    return s;
  }
  function plate(w, h, depth, bevel) {
    const b = bevel == null ? 0.012 : bevel;
    const key = w.toFixed(3) + '|' + h.toFixed(3) + '|' + depth.toFixed(3) + '|' + b.toFixed(3);
    if (!_plateCache.has(key)) {
      _plateCache.set(key, new THREE.ExtrudeGeometry(
        chamferRect(Math.max(w - 2 * b, 0.03), Math.max(h - 2 * b, 0.03), Math.min(0.05, w * 0.2, h * 0.2)),
        { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 1, steps: 1 }
      ));
    }
    return _plateCache.get(key);
  }

  // 船体半径剖面（八角剖面外接半径），内切面距离 sigma(z)
  const HULLP = [[-4.12, 0.55], [-3.9, 0.94], [-2.5, 1.11], [0, 1.19], [2.5, 1.12], [4.2, 0.99], [5.4, 0.82], [6.0, 0.6], [6.2, 0.44]];
  function Rhull(z) {
    if (z <= HULLP[0][0]) return HULLP[0][1];
    for (let i = 0; i < HULLP.length - 1; i++) {
      if (z <= HULLP[i + 1][0]) {
        const a = HULLP[i], b = HULLP[i + 1];
        return a[1] + (b[1] - a[1]) * (z - a[0]) / (b[0] - a[0]);
      }
    }
    return HULLP[HULLP.length - 1][1];
  }
  const INR = Math.cos(Math.PI / 8);
  const sigma = (z) => Rhull(z) * INR;
  const slope = (z) => (sigma(z + 0.12) - sigma(z - 0.12)) / 0.24;

  // 装甲板贴装：站位沿外法线抬离壳体，坡度随动
  function addTile(alpha, zc, len, wid, mat, label, dir, tOff) {
    const off = sigma(zc) + 0.012;
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const t = tOff || 0;
    const p = mk(plate(wid, len, 0.055, 0.012), mat, label, dir || (ca >= 0 ? D.px : D.nx),
      ca * off - sa * t, sa * off + ca * t, zc);
    mountOut(p, alpha, Math.atan(slope(zc)));
    return p;
  }
  const yTop = (z) => sigma(z);   // 背部甲板面
  const yBot = (z) => -sigma(z);  // 腹部甲板面

  /* ================= 1. 主承力龙骨（Z -4 … +6，渐缩八棱梁） ================= */
  const rK = (z) => 0.46 - 0.013 * (z + 4); // 龙骨梁半径剖面
  [-3.0, -0.95, 1.1, 3.15, 5.2].forEach((zc, i) => {
    const p = mk(cyl(rK(zc + 0.95), rK(zc - 0.95), 1.9, 8), F('hullDark'),
      '主承力龙骨·第' + (i + 1) + '段', D.keel, 0, 0, zc);
    p.rotation.x = Math.PI / 2;
  });
  // 肋环（约每 1.4 单位一圈）
  [-3.5, -1.9, -0.3, 1.3, 2.9, 4.5, 5.9].forEach((z, i) => {
    const p = mk(cyl(rK(z) + 0.085, rK(z) + 0.085, i % 2 ? 0.22 : 0.15, 8),
      i % 3 === 1 ? F('bronze') : F('metal'), '龙骨肋环', D.keel, 0, 0, z);
    p.rotation.x = Math.PI / 2;
  });
  // 纵向线缆导管 ×3 + 端接头
  const conduits = [
    { a: 0.6, z0: -3.7, z1: 5.5, r: 0.03, m: MAT.rubber },
    { a: 2.3, z0: -2.7, z1: 4.6, r: 0.026, m: F('copper') },
    { a: 4.3, z0: -1.6, z1: 5.8, r: 0.034, m: MAT.rubber },
  ];
  conduits.forEach((c) => {
    const p = mk(cyl(c.r, c.r, c.z1 - c.z0, 6), c.m, '龙骨线缆导管', D.keel,
      Math.cos(c.a) * 0.53, Math.sin(c.a) * 0.53, (c.z0 + c.z1) / 2);
    p.rotation.x = Math.PI / 2;
  });
  [conduits[0].z0 + 0.05, conduits[0].z1 - 0.05].forEach((ze) => {
    const p = mk(cyl(0.055, 0.055, 0.12, 6), F('metal'), '导管端接头', D.keel,
      Math.cos(0.6) * 0.53, Math.sin(0.6) * 0.53, ze);
    p.rotation.x = Math.PI / 2;
  });
  // 接线盒 ×4 + 状态灯 ×4
  [{ a: 0.9, z: -2.6, l: 'g' }, { a: 2.4, z: -0.4, l: 'g' }, { a: 3.8, z: 1.9, l: 'r' }, { a: 5.4, z: 4.1, l: 'w' }].forEach((b) => {
    const rr = rK(b.z) + 0.08;
    const p = mk(plate(0.34, 0.26, 0.16, 0.014), F('hullDark'), '龙骨接线盒', D.keel,
      Math.cos(b.a) * rr, Math.sin(b.a) * rr, b.z);
    mountOut(p, b.a, 0);
    mk(sph(0.022, 6), b.l === 'g' ? MAT.greenLight : b.l === 'r' ? MAT.redLight : MAT.whiteGlow,
      '设备状态灯', D.keel, Math.cos(b.a) * (rr + 0.12), Math.sin(b.a) * (rr + 0.12), b.z);
  });
  // 艏/艉结构对接轴 + 舱端隔框
  const zc1 = mk(cyl(0.5, 0.56, 0.2, 8), F('engineHousing'), '艉部对接轴·锁环', D.keel, 0, 0, -4.22); zc1.rotation.x = Math.PI / 2;
  const zc2 = mk(cyl(0.28, 0.48, 0.22, 8), F('engineHousing'), '艉部对接轴·锥头', D.keel, 0, 0, -4.42); zc2.rotation.x = Math.PI / 2;
  const zc3 = mk(cyl(0.3, 0.36, 0.2, 8), F('hullDark'), '艏部对接轴·锁环', D.keel, 0, 0, 6.32); zc3.rotation.x = Math.PI / 2;
  const zc4 = mk(cyl(0.15, 0.28, 0.2, 8), F('metal'), '艏部对接轴·锥头', D.keel, 0, 0, 6.5); zc4.rotation.x = Math.PI / 2;
  const bh1 = mk(cyl(0.68, 0.68, 0.08, 8), F('hullDark'), '艉部舱端隔框', D.keel, 0, 0, -4.06); bh1.rotation.x = Math.PI / 2;
  const bh2 = mk(cyl(0.48, 0.48, 0.08, 8), F('hullDark'), '艏部舱端隔框', D.keel, 0, 0, 6.16); bh2.rotation.x = Math.PI / 2;

  /* ================= 2. 棱面承力壳（左右蛤壳，±X 分离）+ 接缝环 ================= */
  const prof = HULLP.map((p) => new THREE.Vector2(p[1], p[0]));
  [[3 * Math.PI / 8, '左舷', D.px], [11 * Math.PI / 8, '右舷', D.nx]].forEach((sh) => {
    const p = mk(new THREE.LatheGeometry(prof, 4, sh[0], Math.PI), F('hullDark'),
      '船体承力壳·' + sh[1], sh[2], 0, 0, 0);
    p.rotation.x = Math.PI / 2;
  });
  // 分段接缝环（暗色内嵌 + 金属框，形成主面板缝）
  [[-2.5, 0.16, 'hullDark'], [0, 0.12, 'metal'], [2.5, 0.16, 'hullDark'], [4.2, 0.12, 'metal']].forEach((rg, i) => {
    const r = Rhull(rg[0]) + 0.005;
    const p = mk(new THREE.CylinderGeometry(r, r, rg[1], 8, 1, true, 5 * Math.PI / 8), F(rg[2]),
      '船体分段接缝环·' + (i + 1), D.keel, 0, 0, rg[0]);
    p.rotation.x = Math.PI / 2;
  });

  /* ================= 3. 角面装甲板阵列（棱面贴板，缝隙露暗色壳板成板缝） ================= */
  const ROWS = [[-3.6, 1.5], [-2.02, 0.92], [-1.0, 1.32], [0.42, 0.62], [1.1, 1.44], [2.64, 0.88], [3.6, 1.24], [4.96, 0.64], [5.68, 0.3]];
  [45, 135, 225, 315].forEach((deg, fi) => {
    const alpha = deg * Math.PI / 180;
    ROWS.forEach((row, i) => {
      const z0 = row[0] + (rand() - 0.5) * 0.22;
      const len = row[1] * (0.92 + rand() * 0.16);
      const zc = z0 + len / 2;
      const wid = 0.765 * Rhull(zc) * (0.82 + rand() * 0.1);
      let m = F('hullPlating');
      const mr = rand();
      if (mr > 0.88) m = F('hullDark'); else if (mr > 0.82) m = F('metal');
      if ((fi === 0 && i === 3) || (fi === 2 && i === 5)) m = F('goldFoil'); // 隔热金箔毯
      if (fi === 1 && i === 3) m = F('blueAccent');                          // 数据阵列板
      addTile(alpha, zc, len, wid, m, '主装甲板·' + (Math.cos(alpha) >= 0 ? '左舷' : '右舷') + (i + 1) + '段');
    });
  });
  // 舷侧通道上下窄板 ×8
  const SIDE_TILES = [[-2.5, 0.9, -0.52], [0.85, 0.7, 0.55], [2.6, 0.62, -0.55], [4.35, 0.9, 0.5]];
  [0, 180].forEach((deg) => {
    const alpha = deg * Math.PI / 180;
    SIDE_TILES.forEach((t, i) => {
      addTile(alpha, t[0] + t[1] / 2, t[1], 0.42, i % 2 ? F('hullPlating') : F('hullDark'),
        '舷侧装甲板·' + (deg === 0 ? '左舷' : '右舷'), null, t[2]);
    });
  });
  // 背部甲板板 ×3 / 腹部甲板板 ×2
  [[-3.45, 1.1, 0.18], [4.1, 0.85, -0.15], [5.15, 0.62, 0.1]].forEach((t, i) => {
    addTile(Math.PI / 2, t[0] + t[1] / 2, t[1], 0.6, i === 1 ? F('hullDark') : F('hullPlating'),
      '背部甲板装甲板', i % 2 ? D.px : D.nx, t[2]);
  });
  [[-1.7, 1.2, 0.2], [4.35, 1.0, -0.15]].forEach((t, i) => {
    addTile(-Math.PI / 2, t[0] + t[1] / 2, t[1], 0.66, i ? F('hullDark') : F('hullPlating'),
      '腹部装甲板', i ? D.nx : D.px, t[2]);
  });

  /* ================= 4. 表面微型细节（百叶/舱口/天线/RCS/扶手/端口/数据总线） ================= */
  // 百叶通风格栅 ×2
  [[135, 2.2], [315, -1.2]].forEach((v) => {
    const a = v[0] * Math.PI / 180, z = v[1], s = sigma(z), n = radial(a);
    const h = mk(plate(0.3, 0.42, 0.05, 0.012), F('hullDark'), '通风格栅座板', n, n.x * (s + 0.045), n.y * (s + 0.045), z);
    mountOut(h, a, Math.atan(slope(z)));
    for (let k = -1; k <= 1; k++) {
      const sl = mk(box(0.26, 0.06, 0.018), F('metal'), '百叶散热页片', n, n.x * (s + 0.09), n.y * (s + 0.09), z + k * 0.13);
      mountOut(sl, a, Math.atan(slope(z)) + 0.55);
    }
  });
  // 检修舱口（带孔框架 + 门板 + 把手 + 铰链）
  {
    const a = 225 * Math.PI / 180, z = 0.9, s = sigma(z), n = radial(a);
    const outer = chamferRect(0.6, 0.6, 0.07);
    const hole = new THREE.Path();
    hole.moveTo(-0.21, -0.21); hole.lineTo(0.21, -0.21); hole.lineTo(0.21, 0.21); hole.lineTo(-0.21, 0.21); hole.closePath();
    outer.holes.push(hole);
    const frame = mk(new THREE.ExtrudeGeometry(outer, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, steps: 1 }),
      F('hullPlating'), '检修舱口·框架', n, n.x * (s + 0.015), n.y * (s + 0.015), z);
    mountOut(frame, a, Math.atan(slope(z)));
    const inner = mk(plate(0.46, 0.46, 0.03, 0.008), F('hullDark'), '检修舱口·门板', n, n.x * (s + 0.045), n.y * (s + 0.045), z);
    mountOut(inner, a, Math.atan(slope(z)));
    const hd = mk(box(0.18, 0.05, 0.035), F('metal'), '舱口把手', n, n.x * (s + 0.095), n.y * (s + 0.095), z + 0.1);
    mountOut(hd, a, Math.atan(slope(z)));
    const hinge = mk(cyl(0.022, 0.022, 0.42, 6), F('metal'), '舱口铰链', n, n.x * (s + 0.075), n.y * (s + 0.075), z - 0.22);
    hinge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(a), Math.cos(a), 0));
  }
  // 鞭状天线 ×2
  [[90, 5.55, MAT.redLight], [225, 4.9, MAT.greenLight]].forEach((w) => {
    const a = w[0] * Math.PI / 180, z = w[1], s = sigma(z), n = radial(a);
    const b = mk(cyl(0.055, 0.04, 0.07, 6), F('hullDark'), '鞭状天线·基座', n, n.x * (s + 0.035), n.y * (s + 0.035), z);
    b.rotation.z = a - Math.PI / 2;
    const rod = mk(cyl(0.012, 0.012, 0.55, 5), F('metal'), '鞭状天线·杆体', n, n.x * (s + 0.31), n.y * (s + 0.31), z);
    rod.rotation.z = a - Math.PI / 2;
    mk(sph(0.02, 6), w[2], '天线信号灯', n, n.x * (s + 0.61), n.y * (s + 0.61), z);
  });
  // 姿控推进器组 ×2（壳体 + 3 喷嘴）
  [45, 135].forEach((deg) => {
    const a = deg * Math.PI / 180, s = sigma(4.75), n = radial(a);
    const hs = mk(cyl(0.17, 0.15, 0.14, 8), F('hullDark'), '姿控推进器组·壳体', n, n.x * (s + 0.06), n.y * (s + 0.06), 4.75);
    hs.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    [new THREE.Vector3(-Math.sin(a), Math.cos(a), 0), new THREE.Vector3(Math.sin(a), -Math.cos(a), 0), new THREE.Vector3(0, 0, 1)].forEach((dv) => {
      const nz = mk(cyl(0.05, 0.018, 0.11, 6), F('metal'), '姿控推进器·喷嘴', n,
        n.x * (s + 0.1) + dv.x * 0.1, n.y * (s + 0.1) + dv.y * 0.1, 4.75 + dv.z * 0.1);
      nz.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.clone().normalize());
    });
  });
  // EVA 安全扶手 ×2
  [[225, -1.2], [315, 0.5]].forEach((rr) => {
    const a = rr[0] * Math.PI / 180, z = rr[1], s = sigma(z), n = radial(a);
    const r = mk(cyl(0.014, 0.014, 1.1, 6), F('metal'), 'EVA安全扶手·横杆', n, n.x * (s + 0.15), n.y * (s + 0.15), z);
    r.rotation.x = Math.PI / 2;
    [-0.42, 0.42].forEach((dz) => {
      const st = mk(cyl(0.012, 0.012, 0.15, 5), F('metal'), 'EVA安全扶手·支架', n, n.x * (s + 0.075), n.y * (s + 0.075), z + dz);
      st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    });
  });
  // 燃料加注端口
  {
    const a = 225 * Math.PI / 180, s = sigma(3.9), n = radial(a);
    const fl = mk(cyl(0.17, 0.17, 0.06, 8), F('metal'), '燃料加注端口·法兰', n, n.x * (s + 0.03), n.y * (s + 0.03), 3.9);
    fl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const ic = mk(cyl(0.09, 0.09, 0.1, 8), F('copper'), '燃料加注端口·阀口', n, n.x * (s + 0.08), n.y * (s + 0.08), 3.9);
    ic.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    mk(sph(0.075, 8), MAT.rubber, '加注口防尘罩', n, n.x * (s + 0.13), n.y * (s + 0.13), 3.9);
  }
  // 数据总线（蓝色长条）×2
  [135, 315].forEach((deg) => {
    const a = deg * Math.PI / 180, s = sigma(-0.2), n = radial(a);
    const st = mk(box(0.06, 2.4, 0.024), F('blueAccent'), '数据总线导管', n, n.x * (s + 0.035), n.y * (s + 0.035), -0.2);
    mountOut(st, a, Math.atan(slope(-0.2)));
  });

  /* ================= 5. 背脊（传感器整流罩 + 伸缩天线桅 ×2 + 背部对接环） ================= */
  {
    const y = yTop(1.75);
    mk(cyl(0.27, 0.25, 0.09, 12), F('metal'), '传感器整流罩·基座环', D.py, 0, y + 0.045, 1.75);
    const cap = mk(new THREE.CapsuleGeometry(0.21, 0.42, 4, 12), MAT.glassDark, '背部传感器整流罩', D.py, 0, y + 0.16, 1.75);
    cap.rotation.x = Math.PI / 2;
    [-0.11, 0, 0.11].forEach((wx) => {
      mk(box(0.05, 0.016, 0.34), MAT.glassCyan, '传感器观察窗', D.py, wx, y + 0.355, 1.75);
    });
  }
  [[0.25, '后'], [3.3, '前']].forEach((mt) => {
    const z = mt[0], y = yTop(z);
    const base = mk(plate(0.42, 0.34, 0.1, 0.016), F('hullDark'), '伸缩天线桅·' + mt[1] + '基座', D.py, 0, y + 0.05, z);
    mountOut(base, Math.PI / 2, Math.atan(slope(z)));
    mk(box(0.12, 0.16, 0.12), F('metal'), '伸缩天线桅·' + mt[1] + '铰座', D.py, 0, y + 0.13, z - 0.05);
    const rake = new THREE.Vector3(0, 1, -0.22);
    [[0.05, 0.52, 0.36], [0.037, 0.42, 0.78], [0.023, 0.34, 1.12]].forEach((sg, i) => {
      const m2 = mk(cyl(sg[0], sg[0], sg[1], 6), F('metal'), '伸缩天线桅·' + mt[1] + '第' + (i + 1) + '节', D.py,
        0, y + sg[2], z - 0.05 - sg[2] * 0.21);
      m2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rake.clone().normalize());
    });
    mk(cyl(0.06, 0.06, 0.07, 6), F('metal'), '伸缩天线桅·' + mt[1] + '节箍', D.py, 0, y + 0.6, z - 0.18);
    mk(sph(0.032, 8), MAT.whiteGlow, '桅顶信标灯', D.py, 0, y + 1.32, z - 0.33);
  });
  {
    const y = yTop(-1.55);
    mk(cyl(0.5, 0.47, 0.1, 12), F('hullDark'), '背部对接环·基座', D.py, 0, y + 0.05, -1.55);
    const ring = mk(new THREE.TorusGeometry(0.355, 0.06, 10, 24), F('metal'), '背部对接环·锁定环', D.py, 0, y + 0.17, -1.55);
    ring.rotation.x = Math.PI / 2;
    mk(cyl(0.32, 0.32, 0.08, 12), F('hullPlating'), '背部对接舱门', D.py, 0, y + 0.12, -1.55);
    mk(box(0.22, 0.045, 0.05), F('metal'), '对接舱门·把手', D.py, 0, y + 0.175, -1.55);
    for (let i = 0; i < 4; i++) {
      const ba = i * Math.PI / 2 + Math.PI / 4;
      mk(cyl(0.024, 0.024, 0.07, 5), F('metal'), '对接环·锁栓', D.py, Math.cos(ba) * 0.43, y + 0.1, -1.55 + Math.sin(ba) * 0.43);
    }
    mk(cyl(0.016, 0.016, 0.2, 5), F('metal'), '对接方位灯·立柱', D.py, -0.55, y + 0.1, -1.55);
    mk(sph(0.035, 8), MAT.whiteGlow, '对接方位灯', D.py, -0.55, y + 0.22, -1.55);
    for (let i = 0; i < 4; i++) {
      const sa = i * Math.PI / 2;
      const st = mk(box(0.2, 0.02, 0.06), MAT.warning, '对接区警示条纹', D.py, Math.cos(sa) * 0.56, y + 0.025, -1.55 + Math.sin(sa) * 0.56);
      st.rotation.y = sa + Math.PI / 2;
    }
  }

  /* ================= 6. 腹部（起落架硬点 ×3 + 散热鳍 + 燃料干线） ================= */
  [[3.0, '艏'], [0.2, '中'], [-2.8, '艉']].forEach((sk) => {
    const z = sk[0], y = yBot(z);
    const mo = mk(plate(0.52, 0.5, 0.16, 0.018), F('hullDark'), '起落架硬点·' + sk[1] + '段安装座', D.ny, 0, y - 0.08, z);
    mountOut(mo, -Math.PI / 2, Math.atan(slope(z)));
    mk(box(0.56, 0.1, 0.58), F('hullDark'), '收放着陆垫·' + sk[1], D.ny, 0, y - 0.24, z);
    mk(box(0.5, 0.05, 0.52), MAT.rubber, '着陆垫·橡胶防滑垫', D.ny, 0, y - 0.305, z);
    mk(cyl(0.05, 0.05, 0.14, 8), F('metal'), '着陆垫·缓冲支柱', D.ny, 0, y - 0.16, z);
    mk(box(0.02, 0.07, 0.38), MAT.warning, '硬点警示条', D.ny, 0.295, y - 0.24, z);
  });
  {
    const y = yBot(1.8);
    const finShape = new THREE.Shape();
    finShape.moveTo(-0.72, 0); finShape.lineTo(0.72, 0); finShape.lineTo(0.5, -0.46); finShape.lineTo(-0.58, -0.5); finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, steps: 1 });
    for (let i = -1; i <= 1; i++) {
      const f = mk(finGeo, F('hullDark'), '主散热鳍板·' + (i + 2), D.ny, i * 0.34, y + 0.03, 1.8);
      f.rotation.y = Math.PI / 2;
    }
    const man = mk(plate(0.8, 0.16, 0.1, 0.014), F('hullDark'), '散热器·歧管座', D.ny, 0, y - 0.05, 1.8);
    mountOut(man, -Math.PI / 2, Math.atan(slope(1.8)));
    [-0.17, 0.17].forEach((px) => {
      const pp = mk(cyl(0.02, 0.02, 1.9, 6), F('goldFoil'), '散热器金箔管路', D.ny, px, y - 0.06, 1.8);
      pp.rotation.x = Math.PI / 2;
    });
    [[0.82, 1], [2.78, -1]].forEach((ez) => {
      mk(box(0.05, 0.07, 0.05), F('metal'), '散热管路端盖', D.ny, 0.17 * ez[1], y - 0.06, ez[0]);
    });
  }
  {
    const spans = [[-3.6, -0.9], [-0.9, 1.9], [1.9, 5.0]];
    [[-0.34, '左', F('copper')], [0.34, '右', F('metal')]].forEach((fl) => {
      spans.forEach((sp) => {
        const dv = new THREE.Vector3(0, sigma(sp[0]) - sigma(sp[1]), sp[1] - sp[0]);
        const pipe = mk(cyl(0.045, 0.045, dv.length() + 0.04, 8), fl[2], '燃料干线·' + fl[1] + '舷', D.ny,
          fl[0], -(sigma(sp[0]) + sigma(sp[1])) / 2 - 0.015, (sp[0] + sp[1]) / 2);
        pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize());
      });
    });
    mk(box(0.12, 0.11, 0.1), F('hullDark'), '燃料管路固定座·A', D.ny, -0.34, yBot(1.9) - 0.035, 1.9);
    mk(box(0.12, 0.11, 0.1), F('hullDark'), '燃料管路固定座·B', D.ny, 0.34, yBot(-0.9) - 0.035, -0.9);
    mk(box(0.15, 0.13, 0.15), F('metal'), '燃料阀组·阀体', D.ny, 0.34, yBot(2.7) - 0.045, 2.7);
    mk(cyl(0.012, 0.012, 0.09, 5), F('metal'), '燃料阀组·手轮', D.ny, 0.34, yBot(2.7) - 0.115, 2.7);
  }

  /* ================= 7. 舷侧装甲通道（x≈±1.1，左红右绿航行灯 + 警示条） ================= */
  const SPAN_SEG = [
    { z0: -3.3, z1: -0.75, r0: 0.27, r1: 0.245, m: 'hullDark' },
    { z0: -0.55, z1: 2.05, r0: 0.245, r1: 0.24, m: 'hullDark' },
    { z0: 2.25, z1: 4.45, r0: 0.24, r1: 0.205, m: 'engineHousing' },
  ];
  [1, -1].forEach((sgn) => {
    const nmL = sgn > 0 ? '左舷' : '右舷';
    const sdir = sgn > 0 ? D.px : D.nx;
    SPAN_SEG.forEach((sg, i) => {
      const zm = (sg.z0 + sg.z1) / 2;
      const p = mk(cyl(sg.r1, sg.r0, sg.z1 - sg.z0 + 0.05, 8), F(sg.m),
        '舷侧装甲通道·' + nmL + '第' + (i + 1) + '段', sdir, sgn * (sigma(zm) + 0.17), 0, zm);
      p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sgn * slope(zm), 0, 1).normalize());
    });
    [-0.65, 2.15].forEach((cz) => {
      const c = mk(cyl(0.295, 0.295, 0.18, 8), F('metal'), '装甲通道·接环', sdir, sgn * (sigma(cz) + 0.17), 0, cz);
      c.rotation.x = Math.PI / 2;
    });
    mk(new THREE.TorusGeometry(0.272, 0.022, 6, 16), F('metal'), '装甲通道·固定卡箍', sdir, sgn * (sigma(0.8) + 0.17), 0, 0.8);
    const capF = mk(cyl(0.15, 0.22, 0.3, 8), F('engineHousing'), '装甲通道·艏端帽', sdir, sgn * (sigma(4.6) + 0.17), 0, 4.6);
    capF.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sgn * slope(4.6), 0, 1).normalize());
    const capA = mk(cyl(0.14, 0.27, 0.28, 8), F('metal'), '装甲通道·艉端帽', sdir, sgn * (sigma(-3.44) + 0.17), 0, -3.44);
    capA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sgn * slope(-3.44), 0, 1).normalize());
    const hs = mk(cyl(0.08, 0.08, 0.06, 8), F('hullDark'), '航行灯·灯座', sdir, sgn * (sigma(4.79) + 0.17), 0, 4.79);
    hs.rotation.x = Math.PI / 2;
    mk(sph(0.06, 10), sgn > 0 ? MAT.redLight : MAT.greenLight,
      '航行灯·' + nmL + (sgn > 0 ? '(红)' : '(绿)'), sdir, sgn * (sigma(4.79) + 0.17), 0, 4.9);
    [-2.7, 0.3, 3.5].forEach((wz) => {
      mk(box(0.016, 0.1, 0.34), MAT.warning, '舷侧警示条纹', sdir, sgn * (sigma(wz) + 0.425), 0, wz);
    });
  });

  group.userData.spanZ = [-4.6, 6.6];
  return group;
}
