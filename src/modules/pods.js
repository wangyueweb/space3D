/* 功能短舱 — 双燃料短舱 / 腹部货舱段 / 工程机械臂 / 通信补给机架
   布局避开兄弟模块占用区（实测对位）：
   · 燃料短舱吊挂于翼根整流罩之下：x≈±2.05, y=-0.66（罩底 y≥-0.33，翼面 y≥-0.13，均不侵）
   · 货舱段 y≈-1.72, z -1.30 → 2.50（起落架垫 y≥-0.94 之下，留 4 个龙骨垫块接壳）
   · 机械臂背鳍后侧 (0.55, 0.80, -3.30)（天线桅最尾 z-1.4，聚变核心 z-6.4，之间净空）
   · 机架 z -3.78 → -4.85（尾桁架 z≤-4.9 之前） */
export function build({ THREE, MAT, M, mod }) {
  const group = mod.N('pods');
  const parts = group.userData.parts = [];
  const rnd = mod.rnd(5150);
  const flat = mod.flat;

  const P = (label, dir, node) => { group.add(node); parts.push({ node, label, dir: new THREE.Vector3(...dir) }); return node; };

  /* ---- 自驱动闪烁灯（克隆 Basic 材质，按挂钟节拍调制 color） ---- */
  const nowSec = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : Date.now() / 1000;
  const addBlink = (mesh, period, phase, fn) => {
    mesh.material = mesh.material.clone();
    const base = mesh.material.color.clone();
    mesh.onBeforeRender = () => {
      const u = ((((nowSec() + phase) % period) + period) % period) / period;
      mesh.material.color.copy(base).multiplyScalar(fn(u));
    };
  };
  const strobeGreen = (u) => (u < 0.06 || (u > 0.13 && u < 0.19)) ? 1 : 0.06;      // 双闪导航灯
  const beaconRed = (u) => 0.06 + 0.94 * Math.pow(Math.sin(u * Math.PI * 2) * 0.5 + 0.5, 3); // 呼吸信标

  /* ---- 倒角箱体（圆角截面 + 挤出倒角） ---- */
  const roundedRect = (w, h, r) => {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  /* 沿 +Y 伸出的倒角臂梁：截面 w×len，厚度 t（Z 向） */
  const beamGeo = (len, w, t) => {
    const g = new THREE.ExtrudeGeometry(roundedRect(w, len, Math.min(0.035, w * 0.24)), {
      depth: t, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.016, bevelSegments: 1, steps: 1, curveSegments: 3,
    });
    g.translate(0, len / 2, -t / 2);
    return g;
  };
  /* C 形弯曲夹指（弧带挤出，mirror=1 外凸 +X / -1 外凸 -X，两指相向合拢） */
  const fingerGeo = (mirror) => {
    const dir = mirror >= 0 ? 1 : -1, n = 13;
    const s = new THREE.Shape();
    const R = 0.088, r = 0.046, cy = 0.092;
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = -Math.PI * 0.58 + Math.PI * 1.10 * (i / n); pts.push([Math.cos(a) * R * dir, cy + Math.sin(a) * R]); }
    for (let i = 0; i <= n; i++) { const a = Math.PI * 0.54 - Math.PI * 1.12 * (i / n); pts.push([Math.cos(a) * r * dir, cy + Math.sin(a) * r]); }
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.009, bevelSegments: 1, steps: 1, curveSegments: 4 });
    g.translate(0, 0, -0.025);
    return g;
  };
  /* 抛物面天线（Lathe 母线为抛物线，开口朝 +Y，再以四元数定向） */
  const dishGeo = (R, depth) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector2(Math.max(R * t, 0.001), depth * t * t - depth * 0.42));
    }
    return new THREE.LatheGeometry(pts, 14);
  };

  /* ============ 1. 双燃料短舱（mod.mirror 镜像出左右舷，吊挂翼下） ============ */
  const POD_X = 2.05, POD_Y = -0.66, POD_Z = 1.75;
  const podRefs = [];
  const mirrorWrap = mod.mirror((g) => {
    const pod = mod.N('fuelPod');
    const add = (mesh) => { pod.add(mesh); return mesh; };
    const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return add(mesh); };

    /* 流线胶囊壳体（Lathe 棱面化，径向 12 段），local z -2.75 → +2.75 */
    const prof = [
      [0.02, -2.75], [0.16, -2.62], [0.30, -2.38], [0.385, -2.05], [0.405, -1.60],
      [0.408, 0.60], [0.405, 1.55], [0.375, 1.95], [0.31, 2.28], [0.21, 2.50], [0.09, 2.62], [0.015, 2.68],
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const shellGeo = new THREE.LatheGeometry(prof, 12);
    shellGeo.rotateX(Math.PI / 2);
    at(M(new THREE.Mesh(shellGeo), flat('hullPlating')), 0, 0, 0);

    /* 头部圆顶 + 空速管 / 尾部整流锥 + 燃料耦合器 */
    const nose = M(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.5)), flat('hullPlating'));
    nose.rotation.x = -Math.PI / 2; nose.scale.set(1, 0.62, 1); at(nose, 0, 0, 2.52);
    const probe = M(new THREE.Mesh(mod.cyl(0.012, 0.012, 0.34, 6)), MAT.metal);
    probe.rotation.x = Math.PI / 2; at(probe, 0, 0, 2.80);
    const tailCone = M(new THREE.Mesh(mod.cyl(0.045, 0.31, 0.30, 12)), flat('hullDark'));
    tailCone.rotation.x = Math.PI / 2; at(tailCone, 0, 0, -2.60);
    const coup = M(new THREE.Mesh(mod.cyl(0.052, 0.072, 0.12, 10)), MAT.copper);
    coup.rotation.x = Math.PI / 2; at(coup, 0, 0, -2.80);

    /* 警示条纹环带 + 压边环 ×2 + 前部细警示环 */
    const haz = M(new THREE.Mesh(new THREE.CylinderGeometry(0.414, 0.414, 0.16, 12, 1, true)), MAT.warning);
    haz.rotation.x = Math.PI / 2; at(haz, 0, 0, -2.02);
    for (const zz of [-1.92, -2.12]) {
      const ring = M(new THREE.Mesh(new THREE.TorusGeometry(0.407, 0.015, 5, 14)), MAT.hullDark);
      ring.rotation.x = Math.PI / 2; at(ring, 0, 0, zz);
    }
    const warn2 = M(new THREE.Mesh(new THREE.TorusGeometry(0.375, 0.018, 5, 14)), MAT.warning);
    warn2.rotation.x = Math.PI / 2; at(warn2, 0, 0, 2.16);

    /* 压力表 ×2（外侧 +X：金属表体 + glassDark 表盘窗） */
    for (const [yy, zz, tilt] of [[0.11, 0.32, 0.1], [-0.09, 1.12, -0.14]]) {
      const gb = M(new THREE.Mesh(mod.cyl(0.062, 0.070, 0.06, 10)), MAT.metal);
      gb.rotation.z = Math.PI / 2; gb.rotation.y = tilt; at(gb, 0.40, yy, zz);
      const gf = M(new THREE.Mesh(mod.cyl(0.050, 0.050, 0.016, 10)), MAT.glassDark);
      gf.rotation.z = Math.PI / 2; gf.rotation.y = tilt; at(gf, 0.437, yy, zz);
    }

    /* 内侧歧管块 + 金箔包覆段 + 检修导轨 */
    at(M(new THREE.Mesh(mod.box(0.18, 0.30, 1.60)), flat('engineHousing')), -0.44, 0.02, -0.10);
    at(M(new THREE.Mesh(mod.box(0.195, 0.245, 0.52)), MAT.goldFoil), -0.44, 0.02, -0.72);
    at(M(new THREE.Mesh(mod.box(0.035, 0.34, 1.30)), MAT.metal), -0.545, 0.02, -0.10);

    /* 铜管 ×3 纵贯前后（Tube 曲线绕歧管侧） + 管箍 + 青铜阀轮 ×2 */
    const pipeY = [0.115, 0.0, -0.115];
    for (let i = 0; i < 3; i++) {
      const yi = pipeY[i] + (rnd() - 0.5) * 0.012;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.35, yi, 1.35), new THREE.Vector3(-0.505, yi, 0.80),
        new THREE.Vector3(-0.505, yi, -1.20), new THREE.Vector3(-0.36, yi, -2.00),
      ]);
      add(M(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.030, 7)), MAT.copper));
    }
    for (const zz of [0.28]) {
      at(M(new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.011, 5, 10)), MAT.copper), -0.505, 0, zz);
    }
    for (const [yy, zz] of [[0.115, 0.02], [-0.115, -0.58]]) {
      const vw = M(new THREE.Mesh(new THREE.TorusGeometry(0.060, 0.013, 5, 12)), MAT.bronze);
      vw.rotation.y = Math.PI / 2; at(vw, -0.575, yy, zz);
    }
    const stem = M(new THREE.Mesh(mod.cyl(0.011, 0.011, 0.10, 6)), MAT.metal);
    stem.rotation.z = Math.PI / 2; at(stem, -0.52, 0.115, 0.02);

    /* 顶部排气塔（基座/塔身/百叶环/顶盖）+ 绿色双闪灯 */
    at(M(new THREE.Mesh(mod.cyl(0.10, 0.125, 0.055, 10)), flat('engineHousing')), 0, 0.42, -0.85);
    at(M(new THREE.Mesh(mod.cyl(0.052, 0.066, 0.30, 10)), flat('engineHousing')), 0, 0.585, -0.85);
    const louv = M(new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.017, 5, 12)), MAT.hullDark);
    louv.rotation.x = Math.PI / 2; at(louv, 0, 0.55, -0.85);
    at(M(new THREE.Mesh(mod.cyl(0.076, 0.052, 0.036, 10)), MAT.hullDark), 0, 0.752, -0.85);
    const led = M(new THREE.Mesh(mod.sph(0.034, 8)), MAT.greenLight);
    at(led, 0.095, 0.705, -0.85);
    addBlink(led, 1.6, rnd() * 1.6, strobeGreen);

    /* 蚀刻面板缝：环缝 ×2 + 纵缝 ×2（45° 两侧） */
    for (const zz of [-0.85, 1.72]) {
      const seam = M(new THREE.Mesh(new THREE.TorusGeometry(0.406, 0.010, 4, 14)), MAT.hullDark);
      seam.rotation.x = Math.PI / 2; at(seam, 0, 0, zz);
    }
    for (const sx of [1, -1]) {
      const st = M(new THREE.Mesh(mod.box(0.018, 0.018, 3.30)), MAT.hullDark);
      st.rotation.z = -sx * Math.PI / 4; at(st, sx * 0.291, 0.291, -0.05);
    }

    /* 舷侧识别条（blueAccent）+ 编号铭牌（whiteGlow） */
    at(M(new THREE.Mesh(mod.box(0.016, 0.062, 0.60)), MAT.blueAccent), 0.404, 0.06, 2.02);
    at(M(new THREE.Mesh(mod.box(0.015, 0.11, 0.34)), MAT.whiteGlow), 0.406, -0.075, 1.28);

    /* 吊架：后部双支柱接翼下整流，前部横撑接机身 */
    for (const zz of [0.95, 2.05]) {
      at(M(new THREE.Mesh(mod.box(0.18, 0.32, 0.20)), flat('engineHousing')), -0.16, 0.44, zz);
    }
    at(M(new THREE.Mesh(mod.box(0.56, 0.15, 0.20)), flat('engineHousing')), -0.56, 0.05, -1.42);

    pod.position.set(POD_X, POD_Y, POD_Z);
    g.add(pod);
    podRefs.push(pod);
  });
  group.add(mirrorWrap);
  /* mirrorWrap.children[1] 带 scale.x=-1：其局部 +X 爆炸矢量在世界系即 -X（向外），故两 pod 同写 +1.2 */
  parts.push({ node: podRefs[0], label: '左舷燃料短舱 · 增压燃料舱', dir: new THREE.Vector3(1.2, 0, 0) });
  parts.push({ node: podRefs[1], label: '右舷燃料短舱 · 增压燃料舱', dir: new THREE.Vector3(1.2, 0, 0) });

  /* ============ 2. 腹部货舱段（y≈-1.72，z -1.30 → 2.50） ============ */
  const cargo = mod.N('cargoBay');
  {
    const add = (mesh) => { cargo.add(mesh); return mesh; };
    const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return add(mesh); };

    /* 主箱体：圆角截面 + 挤出倒角 */
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(2.30, 0.95, 0.10), {
      depth: 3.70, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, steps: 1, curveSegments: 4,
    });
    bodyGeo.translate(0, 0, -1.85);
    at(M(new THREE.Mesh(bodyGeo), flat('hullPlating')), 0, 0, 0);
    /* 四棱倒角护轨 */
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const rail = M(new THREE.Mesh(mod.box(0.09, 0.09, 3.72)), MAT.hullDark);
      rail.rotation.z = Math.PI / 4; at(rail, sx * 1.10, sy * 0.42, 0);
    }
    /* 侧部纵筋 ×2 */
    for (const sx of [1, -1]) at(M(new THREE.Mesh(mod.box(0.026, 0.07, 3.50)), MAT.hullDark), sx * 1.148, -0.16, 0);

    /* 卷帘门（尾面）：帘板 ×6 + 竖轨 ×2 + 底槛 */
    for (let i = 0; i < 6; i++) {
      const sl = M(new THREE.Mesh(mod.box(2.02, 0.095, 0.045)), i % 2 ? MAT.metal : flat('hullDark'));
      at(sl, 0, -0.255 + i * 0.102, -1.925);
    }
    for (const sx of [1, -1]) at(M(new THREE.Mesh(mod.box(0.07, 0.80, 0.07)), MAT.metal), sx * 1.06, 0.01, -1.93);
    at(M(new THREE.Mesh(mod.box(2.18, 0.06, 0.12)), MAT.metal), 0, -0.365, -1.93);

    /* 货网示意：交叉细杆（rubber）×2 */
    for (const s of [1, -1]) {
      const bar = M(new THREE.Mesh(mod.box(2.02, 0.024, 0.024)), MAT.rubber);
      bar.rotation.z = s * 0.30; at(bar, 0, 0.01, -1.958);
    }

    /* 系留耳 ×4（基座 + 锚环） */
    for (const [sx, sz] of [[1, 1.15], [1, -1.15], [-1, 1.15], [-1, -1.15]]) {
      at(M(new THREE.Mesh(mod.box(0.06, 0.06, 0.20)), MAT.metal), sx * 1.16, 0.30, sz);
      const ring = M(new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.014, 5, 10)), MAT.metal);
      ring.rotation.y = Math.PI / 2; at(ring, sx * 1.205, 0.30, sz);
    }

    /* 叉车硬点（底部叉槽 ×2 + 黄色磨损板 ×2） */
    for (const sx of [1, -1]) {
      at(M(new THREE.Mesh(mod.box(0.20, 0.14, 0.55)), flat('hullDark')), sx * 0.72, -0.545, 0.15);
      at(M(new THREE.Mesh(mod.box(0.16, 0.014, 0.45)), MAT.warning), sx * 0.72, -0.622, 0.15);
    }

    /* 黄色吊钩座（右舷：挂板 + 滑轮组 + 弯钩） */
    at(M(new THREE.Mesh(mod.box(0.20, 0.20, 0.035)), MAT.warning), 1.16, 0.05, 1.45);
    at(M(new THREE.Mesh(mod.box(0.09, 0.11, 0.07)), MAT.metal), 1.205, 0.05, 1.45);
    const hook = M(new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 6, 14, Math.PI * 1.35)), MAT.metal);
    hook.rotation.y = Math.PI / 2; hook.rotation.z = 2.1; at(hook, 1.205, -0.075, 1.45);

    /* 侧标签板（右舷）：暗框 + 白光铭板 + 字条 ×2 */
    at(M(new THREE.Mesh(mod.box(0.035, 0.40, 0.68)), MAT.hullDark), 1.152, -0.05, -0.55);
    at(M(new THREE.Mesh(mod.box(0.035, 0.32, 0.58)), MAT.whiteGlow), 1.170, -0.05, -0.55);
    for (const oy of [-0.045, 0.045]) {
      at(M(new THREE.Mesh(mod.box(0.014, 0.028, 0.42)), MAT.hullDark), 1.192, -0.05 + oy, -0.55);
    }

    /* 左舷通风格栅 */
    at(M(new THREE.Mesh(mod.box(0.03, 0.18, 0.34)), MAT.hullDark), -1.152, 0.18, 0.85);
    at(M(new THREE.Mesh(mod.box(0.052, 0.026, 0.26)), MAT.rubber), -1.163, 0.18, 0.85);

    /* 龙骨垫块 ×4：货舱顶面接船底（local y0.62 → 世界 -1.10，衔接船底 -1.00） */
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const keel = M(new THREE.Mesh(mod.box(0.22, 0.24, 0.34)), flat('hullDark'));
      keel.rotation.y = sz * 0.12; at(keel, sx * 0.72, 0.62, sz * 1.30);
    }

    cargo.position.set(0, -1.72, 0.60);
  }
  P('腹部货舱段 · 卷帘舱门', [0, -1.2, 0], cargo);

  /* ============ 3. 工程机械臂（背鳍后侧，三段折叠） ============ */
  const arm = mod.N('manipulator');
  {
    const add = (mesh) => { arm.add(mesh); return mesh; };
    const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return add(mesh); };

    at(M(new THREE.Mesh(mod.box(0.42, 0.06, 0.44)), flat('hullDark')), 0, 0.03, 0);   // 基板
    at(M(new THREE.Mesh(mod.cyl(0.13, 0.16, 0.14, 12)), MAT.metal), 0, 0.12, 0);      // 偏航关节
    const yawRing = M(new THREE.Mesh(new THREE.TorusGeometry(0.150, 0.020, 6, 14)), MAT.bronze);
    yawRing.rotation.x = Math.PI / 2; at(yawRing, 0, 0.172, 0);

    /* 段A（上仰向后） */
    const jA = mod.N('segA'); jA.position.set(0, 0.18, 0); jA.rotation.x = -0.62; add(jA);
    jA.add(M(new THREE.Mesh(beamGeo(0.82, 0.17, 0.21)), flat('hullPlating')));
    const elbow = M(new THREE.Mesh(mod.sph(0.094, 12)), MAT.bronze); elbow.position.set(0, 0.86, 0); jA.add(elbow);
    const eCol = M(new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.016, 6, 14)), MAT.metal);
    eCol.rotation.y = Math.PI / 2; eCol.position.set(0, 0.86, 0); jA.add(eCol);

    /* 段B（前折贴身）+ 绿色状态灯 */
    const jB = mod.N('segB'); jB.position.set(0, 0.86, 0); jB.rotation.x = 2.35; jA.add(jB);
    jB.add(M(new THREE.Mesh(beamGeo(0.60, 0.14, 0.17)), flat('hullPlating')));
    const aled = M(new THREE.Mesh(mod.sph(0.024, 8)), MAT.greenLight);
    aled.position.set(0.078, 0.30, 0.055); jB.add(aled);
    addBlink(aled, 2.2, rnd() * 2.2, strobeGreen);
    const wrist = M(new THREE.Mesh(mod.sph(0.068, 10)), MAT.bronze); wrist.position.set(0, 0.64, 0); jB.add(wrist);
    const wCol = M(new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.014, 6, 12)), MAT.metal);
    wCol.rotation.y = Math.PI / 2; wCol.position.set(0, 0.64, 0); jB.add(wCol);

    /* 段C（腕梁 + 掌 + 双弯曲夹指） */
    const jC = mod.N('segC'); jC.position.set(0, 0.64, 0); jC.rotation.x = -0.95; jB.add(jC);
    jC.add(M(new THREE.Mesh(beamGeo(0.26, 0.09, 0.11)), MAT.metal));
    const palm = M(new THREE.Mesh(mod.box(0.15, 0.09, 0.16)), MAT.hullDark);
    palm.position.set(0, 0.29, 0); jC.add(palm);
    const claw = mod.N('claw'); claw.position.set(0, 0.335, 0); claw.rotation.x = 0.45; jC.add(claw);
    for (const s of [1, -1]) {
      const f = M(new THREE.Mesh(fingerGeo(s)), flat('metal'));
      f.position.x = -s * 0.054; claw.add(f);
    }

    /* 液压活塞 + 橡胶防尘套 */
    const pDir = new THREE.Vector3(-0.10, 0.716, -0.52).normalize();
    const piston = M(new THREE.Mesh(mod.cyl(0.015, 0.015, 0.89, 8)), MAT.metal);
    piston.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pDir);
    at(piston, 0.05, 0.518, -0.25);
    const gaiter = M(new THREE.Mesh(mod.cyl(0.048, 0.064, 0.13, 8)), MAT.rubber);
    gaiter.quaternion.copy(piston.quaternion); at(gaiter, 0.088, 0.22, -0.015);

    arm.position.set(0.55, 0.80, -3.30);
    arm.rotation.z = -0.50;   // 贴合背脊曲面法向
  }
  P('工程机械臂 · 三关节折叠臂', [0, 1, 0], arm);

  /* ============ 4. 通信/补给机架（腹后部，z -3.78 → -4.85） ============ */
  const rack = mod.N('commsRack');
  {
    const add = (mesh) => { rack.add(mesh); return mesh; };
    const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return add(mesh); };

    /* 顶板贴船底 y=-1.00：框架高 0.46，四角立柱 */
    at(M(new THREE.Mesh(mod.box(1.05, 0.05, 0.95)), flat('hullDark')), 0, 0.30, 0);
    at(M(new THREE.Mesh(mod.box(1.15, 0.06, 1.05)), flat('hullDark')), 0, -0.14, 0);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      at(M(new THREE.Mesh(mod.cyl(0.026, 0.026, 0.44, 8)), MAT.metal), sx * 0.47, 0.08, sz * 0.40);
    }

    /* 抛物面碟 ×3（Lathe 抛物面，朝后方展开）+ 馈源杆/馈源头 */
    const dishes = [
      [-0.30, 0.02, -0.50, 0.17, 0.092, [-0.28, 0.34, -1]],
      [0.02, -0.07, -0.54, 0.14, 0.075, [0.05, -0.18, -1]],
      [0.33, 0.05, -0.48, 0.14, 0.075, [0.48, 0.42, -1]],
    ];
    for (const [x, y, z, R, dp, aimA] of dishes) {
      const aim = new THREE.Vector3(...aimA).normalize();
      const mount = M(new THREE.Mesh(mod.cyl(0.030, 0.048, 0.12, 8)), MAT.metal);
      mount.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim); at(mount, x, y, z);
      const d = M(new THREE.Mesh(dishGeo(R, dp)), flat('hullPlating'));
      d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim);
      d.position.set(x, y, z).addScaledVector(aim, 0.09); add(d);
      const feed = M(new THREE.Mesh(mod.cyl(0.010, 0.010, 0.12, 6)), MAT.metal);
      feed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim);
      feed.position.set(x, y, z).addScaledVector(aim, 0.16); add(feed);
      const tip = M(new THREE.Mesh(mod.sph(0.018, 8)), MAT.whiteGlow);
      tip.position.set(x, y, z).addScaledVector(aim, 0.225); add(tip);
    }

    /* 鞭状天线（向后下方伸出，避开船底）+ 红色呼吸信标 */
    const antG = mod.N('antenna'); antG.position.set(0.44, 0.18, -0.28);
    antG.rotation.x = -1.15; antG.rotation.z = -0.30; add(antG);
    const rod = M(new THREE.Mesh(mod.cyl(0.007, 0.013, 0.50, 6)), MAT.metal);
    rod.position.y = 0.25; antG.add(rod);
    const rled = M(new THREE.Mesh(mod.sph(0.026, 8)), MAT.redLight);
    rled.position.y = 0.53; antG.add(rled);
    addBlink(rled, 1.1, rnd() * 1.1, beaconRed);

    /* 线束 ×2（Tube 曲线前弯没入腹部） */
    const cables = [
      [new THREE.Vector3(-0.30, 0.28, 0.28), new THREE.Vector3(-0.36, 0.40, 0.72), new THREE.Vector3(-0.18, 0.46, 1.30)],
      [new THREE.Vector3(0.26, 0.28, 0.30), new THREE.Vector3(0.44, 0.38, 0.70), new THREE.Vector3(0.30, 0.44, 1.15)],
    ];
    for (const pts of cables) {
      add(M(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.018, 6)), MAT.rubber));
    }

    /* 载荷箱：金箔包裹 ×2 + 蓝色控制模块 */
    at(M(new THREE.Mesh(mod.box(0.30, 0.15, 0.42)), MAT.goldFoil), -0.22, 0.06, 0.05);
    at(M(new THREE.Mesh(mod.box(0.24, 0.13, 0.30)), MAT.goldFoil), 0.26, 0.08, -0.10);
    at(M(new THREE.Mesh(mod.box(0.14, 0.10, 0.24)), MAT.blueAccent), 0.02, 0.05, 0.26);

    rack.position.set(0, -1.33, -3.95);   // 碟组最后缘 -4.75，让开尾桁架（z≤-4.9）
  }
  P('通信补给机架 · 抛物面天线阵', [0, -1, 0], rack);

  return group;
}
