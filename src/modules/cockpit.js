/* 机头座舱段 — 前段过渡 / 座舱玻璃罩 / 棱面机鼻 / 航电机背 / 机腹灯组
   高程基准：船体上缘 y≈1.0，下缘 y≈-1.15 */
export function build({ THREE, MAT, M, mod }) {
  const group = mod.N('cockpit');
  const parts = group.userData.parts = [];
  const rnd = mod.rnd(20250917);
  const flat = mod.flat;

  const add = (node, parent) => { (parent || group).add(node); return node; };
  const P = (label, dir, node, parent) => { add(node, parent); parts.push({ node, label, dir: new THREE.Vector3(...dir) }); return node; };

  /* ============ 0. 前段过渡舱（Z 6.5 → 8.0，八棱递缩） ============ */
  const neck = mod.N('neck');
  {
    const rings = [
      { z: 6.85, rTop: 1.22, rBot: 1.30, h: 0.7, seg: 8 },
      { z: 7.55, rTop: 1.02, rBot: 1.20, h: 0.7, seg: 8 },
    ];
    for (const r of rings) {
      const g = new THREE.CylinderGeometry(r.rTop, r.rBot, r.h, r.seg, 1);
      g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / r.seg);
      const m = M(new THREE.Mesh(g), flat('hullPlating'));
      m.position.set(0, -0.05, r.z); m.scale.set(1, 0.82, 1);
      add(m, neck);
      const g2 = new THREE.CylinderGeometry(r.rTop * 0.96, r.rBot * 0.96, r.h * 0.99, r.seg, 1, true);
      g2.rotateX(Math.PI / 2);
      const m2 = M(new THREE.Mesh(g2), MAT.hullDark);
      m2.material.side = THREE.DoubleSide;
      m2.position.set(0, -0.05, r.z); m2.scale.set(1, 0.82, 1);
      add(m2, neck);
    }
    const g3 = new THREE.CylinderGeometry(1.1, 1.1, 0.07, 10, 1, true);
    g3.rotateX(Math.PI / 2);
    const sealBand = M(new THREE.Mesh(g3), MAT.hullDark);
    sealBand.position.set(0, -0.05, 7.22); sealBand.scale.set(1, 0.84, 1);
    add(sealBand, neck);
    // 前密封舱壁
    const bulk = M(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 8, 1), MAT.hullDark));
    bulk.rotation.x = Math.PI / 2; bulk.rotation.y = Math.PI / 8;
    bulk.position.set(0, -0.05, 7.92); bulk.scale.set(1, 0.82, 1);
    add(bulk, neck);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      const rib = M(new THREE.Mesh(mod.box(0.1, 1.7, 0.14), MAT.metal));
      rib.position.set(Math.cos(a) * 0.72, -0.05 + Math.sin(a) * 0.6, 7.9);
      rib.rotation.set(Math.PI / 2, 0, a);
      add(rib, neck);
    }
  }
  P('前段过渡舱 · 密封舱壁', [0, 0, 0.35], neck);

  /* ============ 1. 座舱玻璃罩（Z 6.7 → 8.0，顶部 y 0.95→1.68） ============ */
  const canopy = mod.N('canopy');
  {
    const BY = 0.92;
    const seatGeo = () => {
      const s = mod.N('seat');
      const base = M(new THREE.Mesh(mod.box(0.32, 0.1, 0.38), MAT.rubber)); s.add(base);
      const back = M(new THREE.Mesh(mod.box(0.32, 0.4, 0.1), MAT.rubber)); back.position.set(0, 0.24, -0.15); back.rotation.x = -0.14; s.add(back);
      const head = M(new THREE.Mesh(mod.box(0.2, 0.12, 0.09), MAT.hullDark)); head.position.set(0, 0.5, -0.18); s.add(head);
      return s;
    };
    const s1 = seatGeo(); s1.position.set(-0.3, 1.08, 7.0); add(s1, canopy);
    const s2 = seatGeo(); s2.position.set(0.3, 1.08, 7.0); add(s2, canopy);
    const cons = M(new THREE.Mesh(mod.box(0.52, 0.1, 0.2), MAT.hullDark));
    cons.position.set(0, 1.02, 7.5); cons.rotation.x = -0.3; add(cons, canopy);
    for (let i = 0; i < 5; i++) {
      const l = M(new THREE.Mesh(mod.box(0.05, 0.012, 0.03), i % 2 ? MAT.blueAccent : MAT.whiteGlow));
      l.position.set(-0.18 + i * 0.09, 1.08, 7.44); l.rotation.x = -0.3; add(l, canopy);
    }

    mod.pair((g, side) => {
      const sill = M(new THREE.Mesh(mod.box(0.12, 0.14, 1.45), MAT.hullDark));
      sill.position.set(side * 0.6, BY, 7.32); g.add(sill);
      const rail = M(new THREE.Mesh(mod.box(0.08, 0.07, 1.4), MAT.metal));
      rail.position.set(side * 0.58, BY + 0.12, 7.32); g.add(rail);
      const post = M(new THREE.Mesh(mod.box(0.09, 0.62, 0.09), MAT.hullDark));
      post.position.set(side * 0.56, BY + 0.28, 7.92); post.rotation.x = 0.32; g.add(post);
      const post2 = M(new THREE.Mesh(mod.box(0.09, 0.5, 0.09), MAT.hullDark));
      post2.position.set(side * 0.52, BY + 0.22, 6.78); post2.rotation.x = -0.18; g.add(post2);
    }).children.slice().forEach(c => canopy.add(c));
    const spine = M(new THREE.Mesh(mod.box(0.1, 0.07, 1.35), MAT.hullDark));
    spine.position.set(0, BY + 0.6, 7.35); spine.rotation.x = -0.04; add(spine, canopy);
    const cross = M(new THREE.Mesh(mod.box(1.1, 0.06, 0.08), MAT.hullDark));
    cross.position.set(0, BY + 0.52, 7.3); add(cross, canopy);

    // 顶部半圆筒玻璃
    {
      const g = new THREE.CylinderGeometry(0.56, 0.56, 1.24, 18, 1, true, 0, Math.PI);
      g.rotateX(Math.PI / 2);
      g.rotateY(Math.PI / 2);
      const m = M(new THREE.Mesh(g), MAT.glassCyan);
      m.position.set(0, BY + 0.06, 7.35);
      m.scale.set(1.02, 0.9, 1);
      m.castShadow = false;
      add(m, canopy);
    }
    // 前风挡
    {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0.4, 0.56); s.lineTo(-0.4, 0.56); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
      const m = M(new THREE.Mesh(g), MAT.glassCyan);
      m.position.set(0, BY + 0.08, 7.98); m.rotation.x = -0.55;
      m.castShadow = false;
      add(m, canopy);
    }
    // 侧玻璃
    mod.pair((g, side) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(1.1, 0.06); s.lineTo(1.02, 0.42); s.lineTo(0.05, 0.44); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false });
      geo.rotateY(-Math.PI / 2);
      const m = M(new THREE.Mesh(geo), MAT.glassCyan);
      m.position.set(side * 0.6, BY + 0.1, 7.85);
      m.rotation.z = side * -0.28;
      m.castShadow = false;
      g.add(m);
    }).children.slice().forEach(c => canopy.add(c));
    // 后斜玻璃
    {
      const m = M(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.035), MAT.glassCyan));
      m.position.set(0, BY + 0.3, 6.76); m.rotation.x = 0.42;
      m.castShadow = false; add(m, canopy);
    }
  }
  P('座舱玻璃罩 · 指挥舱', [0, 1, 0], canopy);

  /* ============ 2. 棱面机鼻（Z 8.0 → 11.4） ============ */
  const noseGrp = mod.N('nose');
  {
    const rings = [
      { z: 8.45, rTop: 0.98, rBot: 1.04, h: 0.9, seg: 8 },
      { z: 9.35, rTop: 0.72, rBot: 0.96, h: 0.9, seg: 8 },
      { z: 10.1, rTop: 0.44, rBot: 0.7, h: 0.75, seg: 7 },
      { z: 10.7, rTop: 0.18, rBot: 0.42, h: 0.55, seg: 6 },
    ];
    for (const r of rings) {
      const g = new THREE.CylinderGeometry(r.rTop, r.rBot, r.h, r.seg, 1);
      g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / r.seg);
      const m = M(new THREE.Mesh(g), flat('hullPlating'));
      m.position.set(0, -0.02, r.z); m.scale.set(1, 0.84, 1);
      add(m, noseGrp);
    }
    for (const z of [8.92, 9.76, 10.42]) {
      const g = new THREE.CylinderGeometry(0.8, 0.8, 0.06, 10, 1, true);
      g.rotateX(Math.PI / 2);
      const m = M(new THREE.Mesh(g), MAT.hullDark);
      m.position.set(0, -0.02, z); m.scale.set(1, 0.86, 1);
      add(m, noseGrp);
    }
    mod.pair((g, side) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(0.3, 0.05); shape.lineTo(0.26, -0.44); shape.lineTo(0, -0.55);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.1, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.035, bevelSegments: 1, steps: 1 });
      geo.rotateY(-Math.PI / 2);
      const m = M(new THREE.Mesh(geo), flat('hullPlating'));
      m.position.set(side * 0.62, 0, 8.35);
      g.add(m);
    }).children.slice().forEach(c => noseGrp.add(c));

    const tipBase = M(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.16, 10), MAT.hullDark));
    tipBase.rotation.x = Math.PI / 2; tipBase.position.set(0, 0.04, 10.98); add(tipBase, noseGrp);
    const tip = M(new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.85, 8), MAT.metal));
    tip.rotation.x = Math.PI / 2; tip.position.set(0, 0.04, 11.42); add(tip, noseGrp);
    for (const [y, s] of [[0.2, 0.11], [-0.16, 0.09]]) {
      const d = M(new THREE.Mesh(new THREE.CylinderGeometry(s, s, 0.05, 10), MAT.copper));
      d.rotation.x = Math.PI / 2; d.position.set(0, y, 10.85); add(d, noseGrp);
    }
    for (let i = 0; i < 14; i++) {
      const b = M(new THREE.Mesh(mod.box(0.05, 0.05, 0.03), i % 4 === 0 ? MAT.copper : MAT.hullDark));
      b.position.set((rnd() - 0.5) * 0.44, -0.12 + (rnd() - 0.5) * 0.2, 9.5 + rnd() * 0.3);
      add(b, noseGrp);
    }
  }
  P('机鼻锥 · 相控阵组件', [0.2, 0, 1], noseGrp);

  /* ============ 3. 座舱环箍（Z 5.9 → 6.5） ============ */
  const collar = mod.N('collar');
  {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(1.3 - i * 0.02, 1.32 - i * 0.02, 0.13, 14, 1);
      g.rotateX(Math.PI / 2);
      const m = M(new THREE.Mesh(g), i === 1 ? MAT.metal : MAT.hullDark);
      m.position.set(0, -0.05, 5.95 + i * 0.19); m.scale.set(1, 0.84, 1);
      add(m, collar);
    }
    const seal = M(new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.05, 6, 22), MAT.rubber));
    seal.position.set(0, -0.05, 5.8); seal.scale.set(1, 0.86, 1); add(seal, collar);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const l = M(new THREE.Mesh(mod.box(0.1, 0.15, 0.2), MAT.metal));
      l.position.set(Math.cos(a) * 1.26, -0.05 + Math.sin(a) * 1.06, 6.35);
      l.rotation.z = a; add(l, collar);
    }
    const wg = new THREE.CylinderGeometry(1.29, 1.29, 0.09, 14, 1, true);
    wg.rotateX(Math.PI / 2);
    const wm = M(new THREE.Mesh(wg), MAT.warning);
    wm.position.set(0, -0.05, 6.6); wm.scale.set(1, 0.84, 1); add(wm, collar);
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2;
      const b = M(new THREE.Mesh(mod.box(0.06 + rnd() * 0.05, 0.05, 0.09), MAT.hullDark));
      b.position.set(Math.cos(a) * 1.28, -0.05 + Math.sin(a) * 1.08, 6.15 + rnd() * 0.25);
      b.rotation.z = a; add(b, collar);
    }
  }
  P('座舱环箍 · 密封结构', [0, 0, 0.4], collar);

  /* ============ 4. 航电机背（Z 4.0 → 5.9） ============ */
  const avionics = mod.N('avionics');
  {
    const hump = M(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.34, 1.7), flat('hullPlating')));
    hump.position.set(0, 1.06, 4.9); add(hump, avionics);
    const lid = M(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 1.5), MAT.metal));
    lid.position.set(0, 1.25, 4.9); add(lid, avionics);
    for (let i = 0; i < 6; i++) {
      const f = M(new THREE.Mesh(mod.box(0.86, 0.18, 0.035), MAT.hullDark));
      f.position.set(0, 1.2, 4.25 + i * 0.22); f.rotation.x = 0.05; add(f, avionics);
    }
    for (const x of [-0.36, 0.36]) {
      const pipe = M(new THREE.Mesh(mod.cyl(0.04, 0.04, 1.55, 8), MAT.goldFoil));
      pipe.rotation.x = Math.PI / 2; pipe.position.set(x, 1.3, 4.9); add(pipe, avionics);
      for (let i = 0; i < 3; i++) {
        const cl = M(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 5, 8), MAT.copper));
        cl.position.set(x, 1.3, 4.35 + i * 0.55); add(cl, avionics);
      }
    }
    const gb = M(new THREE.Mesh(mod.sph(0.1, 12), MAT.metal)); gb.position.set(0.3, 1.34, 5.75); add(gb, avionics);
    const mast = M(new THREE.Mesh(mod.cyl(0.032, 0.042, 0.3, 8), MAT.metal)); mast.position.set(0.3, 1.48, 5.75); add(mast, avionics);
    const dish = M(new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), flat('hullPlating')));
    dish.material.side = THREE.DoubleSide;
    dish.position.set(0.3, 1.6, 5.75); dish.rotation.x = Math.PI * 0.7; dish.rotation.y = 0.4;
    add(dish, avionics);
    const feed = M(new THREE.Mesh(mod.cyl(0.011, 0.011, 0.22, 6), MAT.copper));
    feed.position.set(0.3, 1.71, 5.82); add(feed, avionics);
    const st = M(new THREE.Mesh(mod.sph(0.035, 8), MAT.redLight));
    st.position.set(-0.4, 1.26, 5.7); add(st, avionics);
  }
  P('航电机背 · 散热阵列', [0, 1, 0], avionics);

  /* ============ 5. 机腹：着陆灯 + 反推喷口 ============ */
  const belly = mod.N('belly');
  {
    const hs = M(new THREE.Mesh(mod.box(0.42, 0.14, 0.3), MAT.hullDark));
    hs.position.set(0, -1.14, 7.0); add(hs, belly);
    const lens = M(new THREE.Mesh(mod.box(0.34, 0.045, 0.24), MAT.whiteGlow));
    lens.position.set(0, -1.22, 7.0); add(lens, belly);
    for (const [x, z] of [[-0.46, 6.0], [0.46, 6.0], [-0.46, 5.4], [0.46, 5.4]]) {
      const noz = M(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.24, 12, 1, true), MAT.engineHousing));
      noz.rotation.x = Math.PI / 2; noz.position.set(x, -1.1, z); add(noz, belly);
      const glow = M(new THREE.Mesh(mod.cyl(0.1, 0.1, 0.03, 12), MAT.engineGlow));
      glow.rotation.x = Math.PI / 2; glow.position.set(x, -1.1, z - 0.1); add(glow, belly);
      const rim = M(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 5, 12), MAT.metal));
      rim.position.set(x, -1.1, z - 0.09); add(rim, belly);
    }
    const bay = M(new THREE.Mesh(mod.box(0.7, 0.08, 1.5), MAT.hullDark));
    bay.position.set(0, -1.13, 6.6); add(bay, belly);
  }
  P('机腹着陆灯 · 反推喷口', [0, -1, 0], belly);

  return group;
}
