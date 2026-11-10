/* STARFORGE-7 · 主推进组 — 尾部 Z∈[-8.5,-3.5]（+Z 为舰艏）
   三元离子引擎（钟形喷管·涡轮泵·万向环）/ 聚变核心 / 推力桁架裙 / 尾部RCS / 勤务设施
   契约：build({ THREE, MAT, M, mod }) → Group；
   每个逻辑零件登记 group.userData.parts = [{ node, label(中文), dir:Vector3(爆炸向量) }]；
   内焰盘 userData.flame=true，辉光环 userData.glowRing=true（总装器脉动/挂喷焰）；
   group.userData.thrusterZ / thrusterX / thrusterY / thrusterExitZ / thrusterR 供外部喷焰锥。
   确定性：全部随机经 mod.rnd(seed)。 */
export function build({ THREE, MAT, M, mod }) {
  const group = mod.N('engines');
  const parts = group.userData.parts = [];
  const rng = mod.rnd(0x5f7a3);
  const flat = (k) => { try { return mod.flat(k); } catch (e) { return MAT[k]; } };

  const DEG = Math.PI / 180;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const box = (w, h, d) => mod.box(w, h, d);
  const cyl = (rt, rb, h, s) => mod.cyl(rt, rb, h, s);
  const sph = (r, s) => mod.sph(r, s);
  const tor = (R, t, rs, ts) => new THREE.TorusGeometry(R, t, rs, ts);
  const mesh = (geo, mat) => M(new THREE.Mesh(geo), mat);
  const unlit = (m) => { m.castShadow = false; m.receiveShadow = false; return m; };

  /* 登记逻辑零件（单网格或焊接微组），dir 为爆炸方向（总装器归一化） */
  const P = (label, dir, node) => { node.name = label; group.add(node); parts.push({ node, label, dir }); return node; };
  /* 两点连杆（自动定向） */
  const strut = (parent, p1, p2, r0, mat) => {
    const d = new THREE.Vector3().subVectors(p2, p1);
    const s = mesh(cyl(r0, r0, d.length(), 8), mat);
    s.position.copy(p1).addScaledVector(d, 0.5);
    s.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    parent.add(s); return s;
  };

  /* 爆炸方向表（按任务规范给矢量；总装器自行归一化） */
  const D_TRUSS = V(0, 0, -0.3);
  const D_REACTOR = V(0, 0, -0.6);

  /* ============================================================ *
   * 1. 推力框架 / 尾部桁架裙（Z -3.5 → -6.2）                      *
   * ============================================================ */
  {
    /* 对接隔框领圈（船体龙骨尾端由此穿入） */
    P('尾部对接隔框', D_TRUSS, mesh(tor(1.24, 0.115, 14, 44), MAT.hullPlating))
      .position.set(0, -0.10, -3.58);
    /* 三道环梁：前环 / 中环 / 发动机机架环 */
    P('前承力环梁', D_TRUSS, mesh(tor(1.42, 0.10, 12, 52), MAT.hullDark)).position.set(0, -0.10, -3.74);
    P('中承力环梁', D_TRUSS, mesh(tor(1.35, 0.07, 10, 48), MAT.metal)).position.set(0, -0.10, -4.85);
    P('发动机机架环', D_TRUSS, mesh(tor(1.30, 0.12, 12, 52), MAT.hullDark)).position.set(0, -0.10, -6.10);

    /* 主纵梁 ×8（错开 90°/270° 以让开顶部散热鳍片） */
    for (let k = 0; k < 8; k++) {
      const a = (22.5 + k * 45) * DEG;
      P('主纵梁', D_TRUSS, strut(group, V(Math.cos(a) * 1.44, Math.sin(a) * 1.44 - 0.10, -3.72),
        V(Math.cos(a) * 1.32, Math.sin(a) * 1.32 - 0.10, -6.08), 0.055, MAT.metal));
    }
    /* 交叉斜撑 ×4 */
    for (const deg of [0, 90, 180, 270]) {
      const a = deg * DEG, b = (deg + 45) * DEG;
      P('桁架交叉斜撑', D_TRUSS, strut(group, V(Math.cos(a) * 1.40, Math.sin(a) * 1.40 - 0.10, -3.74),
        V(Math.cos(b) * 1.32, Math.sin(b) * 1.32 - 0.10, -6.06), 0.03, MAT.metal));
    }

    /* 龙骨尾端抱箍（衔接船体核心段的龙骨尾伸入桁架） */
    P('龙骨尾端环', D_TRUSS, mesh(tor(1.02, 0.06, 10, 32), MAT.metal)).position.set(0, -0.10, -4.58);
    {
      const clamp = mod.N('keelClamp');
      for (const deg of [45, 135, 225, 315]) {
        const a = deg * DEG;
        strut(clamp, V(Math.cos(a) * 1.04, Math.sin(a) * 1.04 - 0.10, -4.35),
          V(Math.cos(a) * 1.30, Math.sin(a) * 1.30 - 0.10, -4.32), 0.04, MAT.hullDark);
      }
      P('龙骨固定架', D_TRUSS, clamp);
    }

    /* 机架中心毂 + 辐条 */
    const hubG = P('机架中心毂', D_TRUSS, mesh(cyl(0.55, 0.55, 0.16, 20), MAT.engineHousing));
    hubG.position.set(0, -0.05, -6.16); hubG.rotation.x = Math.PI / 2;
    for (const deg of [75, 165, 255, 345]) {
      const a = deg * DEG;
      P('毂部辐条', D_TRUSS, strut(group, V(Math.cos(a) * 0.56, Math.sin(a) * 0.56 - 0.05, -6.16),
        V(Math.cos(a) * 1.22, Math.sin(a) * 1.22 - 0.05, -6.16), 0.04, MAT.metal));
    }

    /* 机架环尾面警示带（黄黑相间） */
    for (let k = 0; k < 5; k++) {
      const a = (k * 72) * DEG;
      const seg = mesh(box(1.30, 0.15, 0.045), k % 2 ? MAT.hullDark : MAT.warning);
      seg.position.set(Math.cos(a) * 1.30, Math.sin(a) * 1.30 - 0.10, -6.24);
      seg.rotation.z = a + Math.PI / 2;
      P('机架警示环带', D_TRUSS, seg);
    }

    /* 散热鳍片：上下主鳍 + 左右副鳍（带警示条与航行灯） */
    const FINS = [
      { x: 0, y: 1.70, w: 0.05, h: 0.70, dir: V(0, 1, 0), lbl: '主散热鳍片(上)' },
      { x: 0, y: -1.70, w: 0.05, h: 0.70, dir: V(0, -1, 0), lbl: '主散热鳍片(下)' },
      { x: 1.70, y: 0, w: 0.70, h: 0.05, dir: V(1, 0, 0), lbl: '副散热鳍片(右)' },
      { x: -1.70, y: 0, w: 0.70, h: 0.05, dir: V(-1, 0, 0), lbl: '副散热鳍片(左)' },
    ];
    for (const f of FINS) {
      const fin = mod.N('fin');
      const plate = mesh(box(f.w, f.h, 1.55), flat('hullDark'));
      plate.position.set(f.x, f.y, -5.00); fin.add(plate);
      const rx = f.x === 0 ? 0 : Math.sign(f.x), ry = f.y === 0 ? 0 : Math.sign(f.y);
      const tip = mesh(box(ry === 0 ? 0.16 : 0.06, rx === 0 ? 0.16 : 0.06, 0.30), MAT.warning);
      tip.position.set(rx * 2.02, ry * 2.02, -4.34); fin.add(tip);
      P(f.lbl, f.dir, fin);
      if (f.y !== 0) { /* 上下鳍尖航行灯 */
        const led = unlit(mesh(sph(0.035, 10), MAT.redLight));
        led.position.set(0, ry * 2.10, -5.68);
        P('航行警示灯', f.dir, led);
      }
    }

    /* 金箔电力导管 ×3（粗管 + 卡箍 + 汇流箱 + 尾部法兰）
       上方两根全长的避开龙骨尾端（龙骨半径≈1.05 至 Z-4.6），下方短管让位 */
    const CONDUITS = [
      { a: 70, r: 1.16, zF: -3.80, zB: -6.02, cl: [-4.35, -5.55] },
      { a: 140, r: 1.16, zF: -3.80, zB: -6.02, cl: [-4.42, -5.62] },
      { a: 285, r: 1.16, zF: -4.72, zB: -6.02, cl: [-5.30] },
    ];
    for (const c of CONDUITS) {
      const a = c.a * DEG, cx = Math.cos(a) * c.r, cy = Math.sin(a) * c.r - 0.10;
      const cd = mod.N('conduit');
      const pipe = mesh(cyl(0.13, 0.13, c.zB - c.zF, 14), MAT.goldFoil);
      pipe.rotation.x = Math.PI / 2; pipe.position.set(cx, cy, (c.zF + c.zB) / 2); cd.add(pipe);
      const fl = mesh(cyl(0.165, 0.165, 0.06, 14), MAT.bronze);
      fl.rotation.x = Math.PI / 2; fl.position.set(cx, cy, c.zB - 0.02); cd.add(fl);
      const jb = mesh(box(0.30, 0.28, 0.22), MAT.blueAccent);
      jb.position.set(cx, cy, c.zF + 0.06); jb.rotation.z = a; cd.add(jb);
      for (const z of c.cl) {
        const cm = mesh(tor(0.150, 0.034, 8, 22), MAT.metal);
        cm.position.set(cx, cy, z + (rng() - 0.5) * 0.12); cd.add(cm);
      }
      P('聚变电力导管', V(Math.cos(a) * 0.8, Math.sin(a) * 0.8, -0.3), cd);
    }

    /* 尾部监视器镜头 */
    const cam = P('尾部监视器', D_TRUSS, unlit(mesh(cyl(0.05, 0.05, 0.05, 12), MAT.glassDark)));
    cam.position.set(0.62, 0.98, -3.68); cam.rotation.x = Math.PI / 2;
  }

  /* ============================================================ *
   * 2. 三元主离子引擎（三角布局：中央略后，两舷略前）              *
   * ============================================================ */
  const flameMeshes = [];
  const ENGINES = [
    { x: 0.00, y: 0.44, rh: 0.27, zF: -6.60, zB: -7.15, zG: -7.25, zCF: -7.35, zT: -8.05, zE: -8.50,
      rT: 0.14, rE: 0.46, rC: 0.34, az: 90 * DEG,
      dPump: V(0, -1, -0.15), dNoz: V(0, 0, -1), tag: '中央' },
    { x: -0.92, y: -0.34, rh: 0.24, zF: -6.15, zB: -6.70, zG: -6.80, zCF: -6.90, zT: -7.72, zE: -8.20,
      rT: 0.115, rE: 0.36, rC: 0.30, az: Math.atan2(-0.34, -0.92),
      dPump: V(-1, -0.1, -0.15), dNoz: V(-0.2, -0.06, -1).normalize(), tag: '左舷' },
    { x: 0.92, y: -0.34, rh: 0.24, zF: -6.15, zB: -6.70, zG: -6.80, zCF: -6.90, zT: -7.72, zE: -8.20,
      rT: 0.115, rE: 0.36, rC: 0.30, az: Math.atan2(-0.34, 0.92),
      dPump: V(1, -0.1, -0.15), dNoz: V(0.2, -0.06, -1).normalize(), tag: '右舷' },
  ];

  for (const E of ENGINES) {
    const cx = E.x, cy = E.y, hc = (E.zF + E.zB) / 2, hl = E.zB - E.zF;
    const lb = E.zT - E.zE, lc = E.zCF - E.zT;               // 扩张段长 / 收敛段长
    const bellR = (t) => E.rT + (E.rE - E.rT) * Math.pow(t, 0.6); // 钟形母线

    /* --- 涡轮泵模块（铆接蒙皮 + 增压泵 + 点火器 + 状态灯） --- */
    {
      const pump = mod.N('turbopump');
      const body = mesh(cyl(E.rh, E.rh, hl, 22), flat('engineHousing'));
      body.rotation.x = Math.PI / 2; body.position.set(cx, cy, hc); pump.add(body);
      const cap = mesh(cyl(E.rh * 0.72, E.rh, 0.16, 20), MAT.metal);
      cap.rotation.x = Math.PI / 2; cap.position.set(cx, cy, E.zF + 0.08); pump.add(cap);
      const strip = mesh(box(0.20, 0.02, 0.07), MAT.warning);    // 检修警示条
      const aw = E.az - 1.2;
      strip.position.set(cx + Math.cos(aw) * (E.rh + 0.012), cy + Math.sin(aw) * (E.rh + 0.012), hc + 0.10);
      strip.rotation.z = aw; pump.add(strip);
      for (const s of [0.9, -0.9]) {                            // 铆接面板 ×2
        const a = E.az + s;
        const pn = mesh(box(0.30, 0.026, 0.42), flat('hullPlating'));
        pn.position.set(cx + Math.cos(a) * (E.rh + 0.012), cy + Math.sin(a) * (E.rh + 0.012), hc - 0.05);
        pn.rotation.z = a; pump.add(pn);
      }
      for (const s of [2.1, -2.1]) {                            // 增压泵 ×2
        const a = E.az + s;
        const pp = mesh(cyl(0.085, 0.085, hl * 0.8, 12), MAT.bronze);
        pp.rotation.x = Math.PI / 2;
        pp.position.set(cx + Math.cos(a) * (E.rh + 0.035), cy + Math.sin(a) * (E.rh + 0.035), hc + 0.02);
        pump.add(pp);
      }
      const igA = E.az + 2.6 + (rng() - 0.5) * 0.12;            // 点火器盒 + 注入管
      const ig = mesh(box(0.10, 0.085, 0.13), MAT.metal);
      ig.position.set(cx + Math.cos(igA) * (E.rC + 0.07), cy + Math.sin(igA) * (E.rC + 0.07), E.zCF - 0.20);
      ig.rotation.z = igA; pump.add(ig);
      const it = mesh(cyl(0.018, 0.018, 0.14, 8), MAT.copper);
      it.position.set(cx + Math.cos(igA) * (E.rC + 0.0), cy + Math.sin(igA) * (E.rC + 0.0), E.zCF - 0.20);
      it.rotation.z = igA - Math.PI / 2; pump.add(it);
      const led = unlit(mesh(sph(0.024, 10), MAT.redLight));    // 状态指示灯
      const la = E.az + 0.5;
      led.position.set(cx + Math.cos(la) * (E.rh + 0.015), cy + Math.sin(la) * (E.rh + 0.015), E.zF + 0.10);
      pump.add(led);
      P(`涡轮泵组·${E.tag}`, E.dPump, pump);
    }

    /* --- 同轴推进剂管路（铜管 + 箍环） --- */
    {
      const lines = mod.N('lines');
      const lz = [];
      for (const s of [1.55, -1.55]) {
        const a = E.az + s;
        const lx = cx + Math.cos(a) * (E.rh + 0.16), ly = cy + Math.sin(a) * (E.rh + 0.16);
        const pipe = mesh(cyl(0.04, 0.04, 0.85, 10), MAT.copper);
        pipe.rotation.x = Math.PI / 2; pipe.position.set(lx, ly, E.zF + 0.45); lines.add(pipe);
        lz.push([lx, ly]);
      }
      for (let k = 0; k < 2; k++) {
        const [lx, ly] = lz[k];
        const cm = mesh(tor(0.058, 0.016, 8, 18), MAT.metal);
        cm.position.set(lx, ly, E.zF + 0.28 + k * 0.36); lines.add(cm);
      }
      P(`推进剂管路·${E.tag}`, E.dPump, lines);
    }

    /* --- 万向节环 + 作动筒 --- */
    {
      const gim = mod.N('gimbal');
      const ring = mesh(tor(E.rh + 0.06, 0.045, 10, 36), MAT.metal);
      ring.position.set(cx, cy, E.zG); gim.add(ring);
      for (const s of [0.5, -0.5]) {
        const a = E.az + s;
        strut(gim, V(cx + Math.cos(a) * 0.31, cy + Math.sin(a) * 0.31, E.zG),
          V(cx + Math.cos(a) * (E.rh + 0.03), cy + Math.sin(a) * (E.rh + 0.03), E.zB + 0.25),
          0.042, MAT.hullDark);
      }
      P(`万向节环·${E.tag}`, E.dPump, gim);
    }

    /* --- 发动机安装支臂（机架环 → 泵体） --- */
    {
      const mnt = mod.N('mount');
      for (const s of [0.7, -0.7]) {
        const a = E.az + s;
        strut(mnt, V(Math.cos(a) * 1.26, Math.sin(a) * 1.26 - 0.05, -6.12),
          V(cx + Math.cos(a) * (E.rh + 0.04), cy + Math.sin(a) * (E.rh + 0.04), E.zF + 0.10),
          0.038, MAT.metal);
      }
      P(`发动机安装支臂·${E.tag}`, D_TRUSS, mnt);
    }

    /* --- 收敛-扩张钟形喷管（双层车削曲面） --- */
    {
      const noz = mod.N('nozzle');
      const wall = 0.028;
      const outer = [], inner = [];
      const NB = 13;
      for (let i = 0; i <= NB; i++) {                       // 出口(y=0) → 喉部(y=lb)
        const t = i / NB;
        outer.push(new THREE.Vector2(bellR(t), t * lb));
        inner.push(new THREE.Vector2(Math.max(bellR(t) - wall, 0.02), t * lb));
      }
      inner.push(new THREE.Vector2(Math.max(E.rT - 0.02, 0.02), lb + 0.10 * lc)); // 内衬伸入收敛段
      const NC = 6;
      for (let i = 1; i <= NC; i++) {                       // 收敛段外壁 → 泵体接口
        const t = i / NC;
        outer.push(new THREE.Vector2(E.rT + (E.rC - E.rT) * Math.sin(t * Math.PI / 2), lb + t * lc));
      }
      const lathe = (pts, seg) => {
        const g = new THREE.LatheGeometry(pts, seg);
        const m = mesh(g, MAT.engineNozzle);
        m.rotation.x = Math.PI / 2;                          // 母线 +Y → 舰轴 +Z
        m.position.set(cx, cy, E.zE);                        // y=0 即出口平面
        return m;
      };
      noz.add(lathe(outer, 44));
      noz.add(lathe(inner.slice().reverse(), 36));           // 反序 → 法线朝内

      const lip = unlit(mesh(tor(E.rE - 0.012, 0.024, 8, 40), MAT.engineGlow)); // 出口辉光环
      lip.position.set(cx, cy, E.zE); lip.userData.glowRing = true; noz.add(lip);

      for (const t of [0.45, 0.72]) {                        // 再生冷却环（铜）
        const rib = mesh(tor(bellR(t) + 0.012, 0.02, 8, 36), MAT.copper);
        rib.position.set(cx, cy, E.zT - t * lb); noz.add(rib);
      }
      const cs = 0.30;                                       // 收敛段导流环
      const cr = mesh(tor(E.rC + (E.rT - E.rC) * Math.sin(cs * Math.PI / 2) + 0.008, 0.018, 8, 32), MAT.metal);
      cr.position.set(cx, cy, E.zT + cs * lc); noz.add(cr);

      /* 喉部内焰盘（总装器喷焰锚点）：置于喉部稍后，直径随当地内径 */
      const fdR = bellR(0.35) - wall - 0.02;
      const fd = unlit(mesh(cyl(fdR, fdR, 0.02, 24), MAT.flame));
      fd.rotation.x = Math.PI / 2;
      fd.position.set(cx, cy, E.zT - 0.35 * lb);
      fd.userData.flame = true;
      flameMeshes.push(fd); noz.add(fd);

      P(`离子喷管·${E.tag}`, E.dNoz, noz);
    }
  }

  /* ============================================================ *
   * 3. 聚变核心（三引擎之间的后方，Z≈-7.7）                        *
   * ============================================================ */
  {
    const RC = V(0, -0.42, -7.70);
    /* 核心白光球 + 保持笼 */
    const core = mod.N('reactorCore');
    const hub = mesh(cyl(0.20, 0.20, 0.34, 18), MAT.metal);
    hub.rotation.x = Math.PI / 2; hub.position.copy(RC); core.add(hub);
    const gl = unlit(mesh(sph(0.15, 16), MAT.whiteGlow));
    gl.position.copy(RC); core.add(gl);
    P('反应堆核心', D_REACTOR, core);

    /* 环形反应腔辉光（脉动） */
    const glow = unlit(mesh(tor(0.45, 0.10, 12, 44), MAT.engineGlow));
    glow.position.copy(RC); glow.userData.glowRing = true;
    P('反应堆辉光环', D_REACTOR, glow);

    /* 镀金护壳分段 ×5（错开引擎方位） */
    for (let k = 0; k < 5; k++) {
      const a = k * 72 * DEG;
      const seg = mesh(box(0.30, 0.09, 0.24), MAT.goldFoil);
      seg.position.set(RC.x + Math.cos(a) * 0.62, RC.y + Math.sin(a) * 0.62, RC.z + (rng() - 0.5) * 0.05);
      seg.rotation.z = a;
      P('反应堆镀金护壳', D_REACTOR, seg);
    }
    /* 铜线圈 ×3 */
    for (const dz of [-0.09, 0, 0.09]) {
      const coil = mesh(tor(0.54, 0.030, 8, 42), MAT.copper);
      coil.position.set(RC.x, RC.y, RC.z + dz);
      P('磁体线圈环', D_REACTOR, coil);
    }
    /* 磁约束支柱 ×4（反应堆 → 机架环） */
    for (const deg of [30, 150, 210, 330]) {
      const a = deg * DEG;
      P('磁约束支柱', D_REACTOR, strut(group, V(RC.x + Math.cos(a) * 0.60, RC.y + Math.sin(a) * 0.60, RC.z),
        V(Math.cos(a) * 1.26, Math.sin(a) * 1.26 - 0.05, -6.14), 0.034, MAT.metal));
    }
    /* 径向散热板 ×4（对角方位让开三台引擎）+ 警示条 */
    for (const deg of [45, 135, 225, 315]) {
      const a = deg * DEG;
      const dir = V(Math.cos(a) * 0.8, Math.sin(a) * 0.8, -0.25).normalize();
      const pn = mod.N('rpanel');
      const pl = mesh(box(0.05, 0.50, 0.55), flat('hullDark'));
      pl.position.set(RC.x + Math.cos(a) * 0.93, RC.y + Math.sin(a) * 0.93, RC.z);
      pl.rotation.z = a; pn.add(pl);
      if (deg === 45 || deg === 135) {
        const wp = mesh(box(0.06, 0.10, 0.30), MAT.warning);
        wp.position.set(RC.x + Math.cos(a) * 1.16, RC.y + Math.sin(a) * 1.16, RC.z + 0.08);
        wp.rotation.z = a; pn.add(wp);
      }
      P('反应堆散热板', dir, pn);
    }
  }

  /* ============================================================ *
   * 4. 尾部四角 RCS 姿态推进器簇（每簇 4 微喷口）                   *
   * ============================================================ */
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const cl = mod.N('rcsCluster');
    const bx = sx * 1.26, by = sy * 1.02, bz = -8.30;
    strut(cl, V(sx * 0.90, sy * 0.90 - 0.05, -6.10), V(bx, by, bz + 0.05), 0.045, MAT.metal);
    const base = mesh(box(0.28, 0.28, 0.08), MAT.hullDark);
    base.position.set(bx, by, bz); cl.add(base);
    for (const d of [V(sx, 0, 0), V(0, sy, 0), V(-sx, 0, 0), V(0, -sy, 0)]) {
      const n = mesh(cyl(0.026, 0.062, 0.09, 10), MAT.engineHousing);   // 喉在内，口朝外
      n.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().negate());
      n.position.set(bx + d.x * 0.115, by + d.y * 0.115, bz + d.z * 0.115);
      cl.add(n);
      const g = unlit(mesh(cyl(0.03, 0.03, 0.012, 10), MAT.engineGlow));
      g.quaternion.setFromUnitVectors(V(0, 1, 0), d);
      g.position.set(bx + d.x * 0.165, by + d.y * 0.165, bz + d.z * 0.165);
      g.userData.glowRing = true; cl.add(g);
    }
    P('RCS姿态推进器簇', V(sx * 0.7, sy * 0.7, -0.3), cl);
  }

  /* ============================================================ *
   * 5. 勤务设施：检修梯 / 扶手 / 脐带口 / 铭牌                     *
   * ============================================================ */
  {
    /* 左舷检修梯（双轨 + 踏杆 + 平台） */
    const lad = mod.N('ladder');
    for (const yy of [-0.58, -0.86]) {
      const rail = mesh(cyl(0.024, 0.024, 2.05, 8), MAT.metal);
      rail.rotation.x = Math.PI / 2; rail.position.set(-1.02, yy, -4.98); lad.add(rail);
    }
    for (let k = 0; k < 4; k++) {
      const rung = mesh(cyl(0.018, 0.018, 0.34, 8), MAT.metal);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(-1.02, -0.72, -4.30 - k * 0.44 + (rng() - 0.5) * 0.02); lad.add(rung);
    }
    const plat = mesh(box(0.40, 0.05, 0.36), MAT.hullDark);
    plat.position.set(-0.98, -0.72, -4.02); lad.add(plat);
    P('尾部检修梯', V(-1, 0, 0), lad);

    /* 前环顶部甲板扶手 */
    const hr = mod.N('handrail');
    const rail = mesh(cyl(0.022, 0.022, 0.70, 8), MAT.metal);
    rail.rotation.x = Math.PI / 2; rail.position.set(0, 1.68, -3.92); hr.add(rail);
    for (const px of [-0.26, 0.26]) {
      const post = mesh(cyl(0.02, 0.02, 0.30, 8), MAT.metal);
      post.position.set(px, 1.52, -3.90); hr.add(post);
    }
    P('甲板扶手', V(0, 1, 0), hr);

    /* 右舷脐带加注口（板 + 橡胶口 + 铜管 + 镜头） */
    const um = mod.N('umbilical');
    const up = mesh(box(0.36, 0.30, 0.06), flat('hullPlating'));
    up.position.set(0.88, 0.62, -3.72); up.rotation.z = 45 * DEG; um.add(up);
    const port = mesh(cyl(0.11, 0.11, 0.12, 16), MAT.rubber);
    port.rotation.x = Math.PI / 2; port.position.set(0.88, 0.62, -3.76); um.add(port);
    const stub = mesh(cyl(0.035, 0.035, 0.16, 8), MAT.copper);
    stub.rotation.x = Math.PI / 2; stub.position.set(0.98, 0.74, -3.74); um.add(stub);
    const eye = unlit(mesh(cyl(0.035, 0.035, 0.04, 10), MAT.glassDark));
    eye.rotation.x = Math.PI / 2; eye.position.set(0.78, 0.74, -3.74); um.add(eye);
    P('脐带加注接口', V(1, 0.3, 0), um);

    /* 左舷铭牌（刻线 + 照明条 + 绿色指示灯） */
    const np = mod.N('nameplate');
    const pl = mesh(box(0.52, 0.18, 0.03), MAT.hullPlating);
    pl.position.set(-0.86, -0.90, -3.73); pl.rotation.z = 200 * DEG; np.add(pl);
    for (const dy of [0.028, -0.028]) {
      const ln = mesh(box(0.34, 0.02, 0.012), MAT.hullDark);
      ln.position.set(-0.86, -0.90 + dy, -3.742); ln.rotation.z = 200 * DEG; np.add(ln);
    }
    const gl2 = unlit(mesh(box(0.44, 0.024, 0.012), MAT.whiteGlow));
    gl2.position.set(-0.86, -0.83, -3.742); gl2.rotation.z = 200 * DEG; np.add(gl2);
    const led2 = unlit(mesh(sph(0.028, 10), MAT.greenLight));
    led2.position.set(-0.62, -1.00, -3.75); np.add(led2);
    P('主推进阵列铭牌', V(-1, -0.3, 0), np);
  }

  /* ---- 供总装器/外部喷焰挂载的锚点 ---- */
  group.userData.thrusterZ = -8.2;                       // 名义喉部平面
  group.userData.thrusterX = [0, -0.92, 0.92];           // 中央 / 左舷 / 右舷
  group.userData.thrusterY = [0.44, -0.34, -0.34];
  group.userData.thrusterExitZ = [-8.50, -8.20, -8.20];
  group.userData.thrusterR = [0.46, 0.36, 0.36];
  group.userData.engineCount = 3;
  group.userData.throats = flameMeshes.map(m => ({
    node: m, radius: m.geometry.parameters.radiusTop, z: m.position.z,
  }));

  return group;
}
