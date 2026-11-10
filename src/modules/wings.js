/* 差动翼组 — 后掠主翼 / 翼尖炮舱 / 姿态喷口 / 挂载武器 */
export function build({ THREE, MAT, M, mod }) {
  const group = mod.N('wings');
  const parts = group.userData.parts = [];
  const rnd = mod.rnd(770231);
  const flat = mod.flat;

  const P = (label, dir, node) => { group.add(node); parts.push({ node, label, dir: new THREE.Vector3(...dir) }); return node; };

  /* ---- 翼型平面轮廓（俯视 XZ 平面）：后掠 ~30°，根弦 2.9，梢弦 0.85 ---- */
  const ROOT_X = 1.15, TIP_X = 7.4;
  const rootLE = 4.9, rootTE = 2.0;      // 根前缘/后缘 Z
  const tipLE = 1.0, tipTE = 0.15;       // 梢前缘/后缘 Z

  function makeWingShape(inset) {
    const s = new THREE.Shape();
    s.moveTo(ROOT_X + inset, rootLE - inset * 1.2);
    s.lineTo(TIP_X - inset, tipLE + inset * 0.7);
    s.lineTo(TIP_X - inset, tipTE - inset * 0.5);
    s.lineTo(ROOT_X + inset, rootTE + inset);
    s.closePath();
    return s;
  }

  /* ============ 单侧机翼构建 ============ */
  function buildWing(g, side) {
    const wingGrp = mod.N('wingPanel');

    /* --- 翼根整流罩（与机身融合） --- */
    const fairing = (() => {
      const geo = new THREE.CylinderGeometry(0.62, 0.78, 2.6, 10, 1);
      geo.rotateX(Math.PI / 2);
      const m = M(new THREE.Mesh(geo), flat('hullPlating'));
      m.position.set(side * 1.32, -0.06, 3.3);
      m.scale.set(1.0, 0.62, 1);
      return m;
    })();
    wingGrp.add(fairing);
    // 整流罩过渡板
    const blend = M(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 2.2)), flat('hullPlating'));
    blend.position.set(side * 1.9, -0.02, 3.3); wingGrp.add(blend);
    // 整流罩面板缝
    for (let i = 0; i < 4; i++) {
      const s = M(new THREE.Mesh(mod.box(0.86, 0.03, 0.035), MAT.hullDark));
      s.position.set(side * 1.9, 0.24, 2.45 + i * 0.58); wingGrp.add(s);
    }

    /* --- 主翼面（Extrude 带倒角，厚度 0.26） --- */
    const shape = makeWingShape(0);
    const wingGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.26, bevelEnabled: true, bevelSize: 0.055, bevelThickness: 0.05, bevelSegments: 1, steps: 1,
    });
    wingGeo.rotateX(Math.PI / 2);   // shape 平面 -> XZ（y -> +Z，前缘朝舰首）
    wingGeo.translate(0, 0.17, 0);  // 厚度映射到 -Y，整体上移回准
    const wingMesh = M(new THREE.Mesh(wingGeo), flat('hullPlating'));
    wingMesh.position.set(0, 0, 0);
    wingGrp.add(wingMesh);

    /* --- 翼面上表面细节 --- */
    // 长向能量导管（沿翼展，随后掠倾斜）
    const span = TIP_X - ROOT_X, sweep = (rootLE - tipLE);
    const ang = Math.atan2(sweep, span);
    for (const off of [-0.55, -0.2, 0.25]) {
      const len = Math.hypot(span, sweep) * 0.9;
      const pipe = M(new THREE.Mesh(mod.cyl(0.05, 0.05, len, 8), MAT.goldFoil));
      pipe.rotation.z = -Math.PI / 2;
      pipe.rotation.y = -ang;
      pipe.position.set(side * (ROOT_X + span * 0.47), 0.19, (rootLE + tipLE) / 2 + off * 0.9 + 0.5);
      wingGrp.add(pipe);
      // 管夹
      for (let i = 0; i < 4; i++) {
        const t = 0.18 + i * 0.22;
        const cx = ROOT_X + span * t, cz = rootLE + (tipLE - rootLE) * t;
        const cl = M(new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.017, 5, 8), MAT.copper));
        cl.position.set(side * cx, 0.2, cz + off * 0.9 + 0.5);
        cl.rotation.y = Math.PI / 2; cl.rotation.x = ang;
        wingGrp.add(cl);
      }
    }
    // 蒙皮分块缝线（弦向 + 展向）
    for (let i = 0; i < 5; i++) {
      const t = 0.12 + i * 0.18;
      const cx = ROOT_X + span * t;
      const le = rootLE + (tipLE - rootLE) * t, te = rootTE + (tipTE - rootTE) * t;
      const chord = Math.abs(te - le);
      const s = M(new THREE.Mesh(mod.box(0.028, 0.035, chord * 0.94), MAT.hullDark));
      s.position.set(side * cx, 0.155, (le + te) / 2); wingGrp.add(s);
    }
    for (const t of [0.34, 0.68]) {
      const cx = ROOT_X + span * t;
      const le = rootLE + (tipLE - rootLE) * t, te = rootTE + (tipTE - rootTE) * t;
      const s = M(new THREE.Mesh(mod.box(0.03, 0.032, 0.06), MAT.metal));
      s.position.set(side * cx, 0.16, le - 0.3); wingGrp.add(s);
      const s2 = M(new THREE.Mesh(mod.box(0.03, 0.032, 0.06), MAT.metal));
      s2.position.set(side * cx, 0.16, te + 0.2); wingGrp.add(s2);
    }
    // 翼面微 greeble（检修口盖、小型天线）
    for (let i = 0; i < 10; i++) {
      const t = 0.16 + rnd() * 0.72;
      const cx = ROOT_X + span * t;
      const cz = rootLE + (tipLE - rootLE) * t - 0.45 - rnd() * 1.2;
      const w = 0.1 + rnd() * 0.16;
      const gg = M(new THREE.Mesh(mod.box(w, 0.035, w * (1.1 + rnd())), rnd() > 0.72 ? MAT.metal : MAT.hullDark));
      gg.position.set(side * cx, 0.16, cz);
      gg.rotation.y = ang; wingGrp.add(gg);
    }

    /* --- 后缘操纵面（3 段，微凹 + 铰链） --- */
    const ctrl = mod.N('controlSurfaces');
    for (let i = 0; i < 3; i++) {
      const t0 = 0.06 + i * 0.3, t1 = t0 + 0.28;
      const x0 = ROOT_X + span * t0, x1 = ROOT_X + span * t1;
      const z0 = rootTE + (tipTE - rootTE) * t0, z1 = rootTE + (tipTE - rootTE) * t1;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, 0.42); s.lineTo(0, 0.46); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.11, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.025, bevelSegments: 1, steps: 1 });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0.05, 0);
      const m = M(new THREE.Mesh(geo), flat('hullPlating'));
      m.position.set(side * x0, 0, z0);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      ctrl.add(m);
      // 铰链
      for (let h = 0; h < 2; h++) {
        const hg = M(new THREE.Mesh(mod.cyl(0.045, 0.045, 0.14, 8), MAT.metal));
        hg.rotation.z = Math.PI / 2;
        hg.position.set(side * (x0 + (x1 - x0) * (0.25 + h * 0.5)), 0.05, z0 + (z1 - z0) * (0.25 + h * 0.5));
        ctrl.add(hg);
      }
    }
    wingGrp.add(ctrl);

    /* --- 姿态喷口簇：翼根上下各一组 --- */
    const thrusters = mod.N('rcsCluster');
    const mkNozzle = (x, y, z, tilt) => {
      const n = mod.N('nozzle');
      const body = M(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.2, 10, 1, true), MAT.engineHousing));
      n.add(body);
      const gl = M(new THREE.Mesh(mod.cyl(0.068, 0.068, 0.022, 10), MAT.engineGlow));
      gl.position.y = 0.09; n.add(gl);
      const ring = M(new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.014, 5, 10), MAT.metal));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; n.add(ring);
      n.position.set(x, y, z); n.rotation.x = tilt;
      return n;
    };
    // 上表面
    for (let i = 0; i < 3; i++) thrusters.add(mkNozzle(side * (1.55 + i * 0.34), 0.34, 3.9 - i * 0.34, 0));
    // 下表面
    for (let i = 0; i < 2; i++) thrusters.add(mkNozzle(side * (1.6 + i * 0.36), -0.34, 3.7 - i * 0.3, Math.PI));
    // 喷口簇基座
    const tbase = M(new THREE.Mesh(mod.box(1.1, 0.16, 0.9), MAT.hullDark));
    tbase.position.set(side * 1.9, 0.26, 3.6); thrusters.add(tbase);
    wingGrp.add(thrusters);

    /* --- 翼下挂架 + 弹药 --- */
    const pylons = mod.N('pylons');
    for (const [px, pz] of [[2.9, 2.6], [4.6, 1.7]]) {
      const pyl = M(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.34, 1.1), flat('hullDark')));
      pyl.position.set(side * px, -0.3, pz); pylons.add(pyl);
      const pylTip = M(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.9), MAT.metal));
      pylTip.position.set(side * px, -0.48, pz); pylons.add(pylTip);
      // 弹药：流线弹体 + 4 尾翼 + 警示环
      const ord = mod.N('ordnance');
      const bodyGeo = new THREE.CapsuleGeometry(0.11, 1.15, 6, 12);
      bodyGeo.rotateX(Math.PI / 2);
      const body = M(new THREE.Mesh(bodyGeo), flat('hullPlating'));
      ord.add(body);
      const nose = M(new THREE.Mesh(new THREE.ConeGeometry(0.112, 0.34, 12), MAT.metal));
      nose.rotation.x = -Math.PI / 2; nose.position.z = 0.72; ord.add(nose);
      const band = M(new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.022, 5, 12), MAT.warning));
      band.position.z = 0.42; ord.add(band);
      for (let f = 0; f < 4; f++) {
        const fin = M(new THREE.Mesh(mod.box(0.02, 0.17, 0.22), MAT.metal));
        const a = f * Math.PI / 2;
        fin.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, -0.5);
        fin.rotation.z = a; ord.add(fin);
      }
      const motor = M(new THREE.Mesh(mod.cyl(0.09, 0.09, 0.14, 10), MAT.hullDark));
      motor.rotation.x = Math.PI / 2; motor.position.z = -0.62; ord.add(motor);
      ord.position.set(side * px, -0.72, pz);
      pylons.add(ord);
    }
    wingGrp.add(pylons);

    /* --- 翼尖炮舱 --- */
    const pod = mod.N('tipPod');
    const podGrp = mod.N('podShell');
    // 舱体：两段圆柱 + 头锥 + 尾锥
    const main = M(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 2.0, 12, 1), flat('hullPlating')));
    main.rotation.x = Math.PI / 2; podGrp.add(main);
    const cap = M(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 12), flat('hullPlating')));
    cap.rotation.x = -Math.PI / 2; cap.position.z = 1.28; podGrp.add(cap);
    const tail = M(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.22, 0.42, 12, 1), MAT.engineHousing));
    tail.rotation.x = Math.PI / 2; tail.position.z = -1.2; podGrp.add(tail);
    // 环箍
    for (const z of [-0.7, 0.1, 0.75]) {
      const r = M(new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.03, 6, 14), MAT.metal));
      r.position.z = z; podGrp.add(r);
    }
    // 前部传感器窗
    const win = M(new THREE.Mesh(mod.box(0.2, 0.13, 0.06), MAT.glassDark));
    win.position.set(0, 0.22, 1.05); podGrp.add(win);
    // 警示环
    const wz = M(new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.026, 5, 14), MAT.warning));
    wz.position.z = -0.35; podGrp.add(wz);
    pod.add(podGrp);

    // 炮管（可伸出感：多层圆柱堆叠）
    const barrel = mod.N('barrel');
    const b1 = M(new THREE.Mesh(mod.cyl(0.055, 0.062, 0.9, 10), MAT.engineNozzle));
    b1.rotation.x = Math.PI / 2; b1.position.z = 1.72; barrel.add(b1);
    const b2 = M(new THREE.Mesh(mod.cyl(0.038, 0.045, 0.7, 10), MAT.metal));
    b2.rotation.x = Math.PI / 2; b2.position.z = 2.3; barrel.add(b2);
    const muzzle = M(new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.018, 5, 10), MAT.copper));
    muzzle.position.z = 2.65; barrel.add(muzzle);
    const tipGlow = M(new THREE.Mesh(mod.cyl(0.03, 0.03, 0.04, 8), MAT.blueAccent));
    tipGlow.rotation.x = Math.PI / 2; tipGlow.position.z = 2.62; barrel.add(tipGlow);
    for (let i = 0; i < 3; i++) {
      const vent = M(new THREE.Mesh(mod.box(0.09, 0.05, 0.05), MAT.hullDark));
      vent.position.set(0, 0.065, 1.5 + i * 0.28); barrel.add(vent);
    }
    pod.add(barrel);

    // 下方小鳍
    const finlet = M(new THREE.Mesh(mod.box(0.035, 0.26, 0.7), flat('hullDark')));
    finlet.position.set(0, -0.34, -0.35); pod.add(finlet);

    pod.position.set(side * (TIP_X + 0.1), 0.06, 0.55);
    pod.rotation.y = side > 0 ? 0 : 0;
    wingGrp.add(pod);

    /* --- 翼尖航行灯 + 静电放电针 --- */
    const strobe = M(new THREE.Mesh(mod.sph(0.062, 8), side > 0 ? MAT.greenLight : MAT.redLight));
    strobe.position.set(side * (TIP_X + 0.12), 0.28, 0.2); wingGrp.add(strobe);
    const strobe2 = M(new THREE.Mesh(mod.sph(0.05, 8), side > 0 ? MAT.greenLight : MAT.redLight));
    strobe2.position.set(side * (TIP_X + 0.12), -0.1, 0.05); wingGrp.add(strobe2);
    for (let i = 0; i < 3; i++) {
      const t = 0.55 + i * 0.14;
      const cx = ROOT_X + span * t;
      const te = rootTE + (tipTE - rootTE) * t;
      const needle = M(new THREE.Mesh(mod.cyl(0.004, 0.018, 0.3, 5), MAT.metal));
      needle.rotation.x = Math.PI / 2; needle.position.set(side * cx, 0.06, te + 0.14);
      wingGrp.add(needle);
    }

    g.add(wingGrp);
    return wingGrp;
  }

  /* 左右各建一次（分别记录爆炸方向） */
  const pair = mod.pair((g, side) => { buildWing(g, side); });
  // mirror 返回两个子组：children[0] = side +1, children[1] = side -1
  const leftG = pair.children[0], rightG = pair.children[1];

  P('左主翼 · 后掠翼面', [1, 0.12, 0], leftG);
  P('右主翼 · 后掠翼面', [-1, 0.12, 0], rightG);

  // 分离翼尖炮舱为独立爆炸件
  [leftG, rightG].forEach((wg, i) => {
    const sign = i === 0 ? 1 : -1;
    const pod = wg.getObjectByName('tipPod');
    if (pod) {
      parts.push({ node: pod, label: (sign > 0 ? '左' : '右') + '翼尖炮舱', dir: new THREE.Vector3(sign * 1.3, 0.15, 0) });
    }
    const ctrl = wg.getObjectByName('controlSurfaces');
    if (ctrl) parts.push({ node: ctrl, label: (sign > 0 ? '左' : '右') + '翼后缘操纵面', dir: new THREE.Vector3(sign * 0.4, 0.7, 0) });
    const pyl = wg.getObjectByName('pylons');
    if (pyl) parts.push({ node: pyl, label: (sign > 0 ? '左' : '右') + '翼挂架 · 弹药', dir: new THREE.Vector3(sign * 0.6, -1, 0) });
    const rcs = wg.getObjectByName('rcsCluster');
    if (rcs) parts.push({ node: rcs, label: (sign > 0 ? '左' : '右') + '翼姿态喷口簇', dir: new THREE.Vector3(sign * 0.8, 0.9, 0) });
  });

  return group;
}
