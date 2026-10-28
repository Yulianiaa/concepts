// Живой фон экрана ввода: ленты (вода) и лучи (электричество).
// Рисуется на двух маленьких <canvas> и растягивается на весь экран — так размытие
// получается почти бесплатно и анимация не тормозит на телефоне.
//   soft  — 1/8 разрешения + CSS blur: ленты, широкие веера, ядро
//   sharp — 1/4 разрешения без фильтров: тонкие штрихи и блики
// Этот же код вставлен в FigmaFlow на холсте.

const BG = (() => {
  const W = 402, H = 874, SOFT = 1 / 8, SHARP = 1 / 4;

  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixArr = (a, b, f) => { const x = rgb(a), y = rgb(b); return x.map((v, i) => Math.round(v + (y[i] - v) * f)); };
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  // ---------- Вода: три ленты ----------
  const COLD = [['#0b3a5c', '#2f8fc8'], ['#0e1240', '#3a3fb0'], ['#0f4f9a', '#57c6f5']];
  const HOT  = [['#5a1206', '#c2381a'], ['#3a0605', '#c0170f'], ['#a8180a', '#ff5226']];
  const RIBBONS = [
    { A: [-300, 520],  B: [520, 1340], amp: 70,  k: 1.7, v: -0.55, p: 4.0, side: 1,  wb: 60, wd: 160, drift: 35, ds: 0.17, op: 0.5,  cv: 0.4,  span: 0.5 },
    { A: [-250, -260], B: [660, 720],  amp: 85,  k: 1.3, v: 0.42,  p: 2.1, side: -1, wb: 70, wd: 190, drift: 40, ds: 0.25, op: 0.6,  cv: 0.3,  span: 0.5 },
    { A: [-250, 40],   B: [660, 1030], amp: 100, k: 1.5, v: 0.5,   p: 0,   side: 1,  wb: 90, wd: 220, drift: 45, ds: 0.2,  op: 0.95, cv: 0.35, span: 0.55 },
  ];
  function ribbon(r, t, ampMul) {
    const N = 32;
    const dx = r.B[0] - r.A[0], dy = r.B[1] - r.A[1], L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    const shift = r.drift * ampMul * Math.sin(t * r.ds + r.p);
    const ph = t * r.v + r.p;
    const c = 0.5 + 0.22 * Math.sin(t * r.cv + r.p * 1.3);
    const env = (s, span) => { const u = (s - c) / span + 0.5; return u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 1.4); };
    const line = (off) => {
      const a = [];
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const w = ampMul * (r.amp * Math.sin(Math.PI * r.k * s + ph) + r.amp * 0.35 * Math.sin(Math.PI * r.k * 2.3 * s - ph * 0.7 + r.p));
        const o = w + shift + off(s);
        a.push([r.A[0] + dx * s + nx * o, r.A[1] + dy * s + ny * o]);
      }
      return a;
    };
    const band = (f1, f2) => line(f1).concat(line(f2).reverse());
    const sd = r.side;
    return {
      clip: band(() => 0, () => sd * 1400),
      bright: band(() => -sd * 30, (s) => sd * r.wb * env(s, r.span)),
      deep: band(() => -sd * 30, (s) => sd * r.wd * env(s, r.span * 1.5)),
    };
  }

  // ---------- Электричество: лучи ----------
  const DAY   = { fan: '#ffd49a', fan2: '#ffdcc8', streak: '#fff1de', core: '#fffaf2' };  // светлый тёплый, как солнечный свет
  const NIGHT = { fan: '#8d87c6', fan2: '#666b9c', streak: '#e6e1fb', core: '#f3f0ff' };
  // a — направление, w — полуширина (рад), amp — яркость, s/p — темп и фаза, sway — размах, bend — изгиб
  const BEAMS = [
    { a: -1.15, w: 0.26, amp: 0.65, col: 'fan',  s: 0.21, p: 0.0, sway: 0.16, bend: 0.25, soft: true },
    { a: -1.8,  w: 0.26, amp: 0.3,  col: 'fan2', s: 0.17, p: 2.1, sway: 0.18, bend: -0.2, soft: true },
    { a: -0.45, w: 0.18, amp: 0.14, col: 'fan2', s: 0.26, p: 4.0, sway: 0.14, bend: 0.3,  soft: true },
    { a: -1.25, host: 0, off: -0.07, w: 0.06, amp: 0.55, col: 'streak', s: 0.23, p: 0.6, sway: 0.12, bend: 0.3 },
    { a: -0.62, host: 0, off: 0.12, w: 0.045, amp: 0.42, col: 'streak', s: 0.29, p: 3.3, sway: 0.1,  bend: 0.35 },
    { a: -1.6, host: 1, off: 0.02, w: 0.035, amp: 0.3,  col: 'streak', s: 0.18, p: 5.1, sway: 0.13, bend: -0.2 },
  ];
  // Половинки лучей: идут только в одну сторону от центра и чуть заметнее остальных (максимум 3)
  const HALVES = [
    { host: 0, off: 0.16,  side: 0,       w: 0.07, amp: 0.55, s: 0.21, p: 0.4 },
    { host: 1, off: -0.12, side: Math.PI, w: 0.06, amp: 0.5,  s: 0.17, p: 2.6 },
    { host: 2, off: 0.06,  side: 0,       w: 0.05, amp: 0.45, s: 0.25, p: 4.4 },
  ];
  function beamPoly(fx, fy, a, w, bend, only) {
    const R = 1100, N = 10, out = [];
    for (const d of (only == null ? [0, Math.PI] : [only])) {
      const pts = [[fx, fy]], back = [];
      for (let k = 1; k <= N; k++) {
        const r = R * k / N, q = r / R, th = a + d + bend * q * q;
        pts.push([fx + r * Math.cos(th - w), fy + r * Math.sin(th - w)]);
        back.push([fx + r * Math.cos(th + w), fy + r * Math.sin(th + w)]);
      }
      out.push(pts.concat(back.reverse()));
    }
    return out;
  }

  // Раздвигает лучи одной группы по кругу (направления через фокус, период π), если они ближе minGap
  function spread(ang, beams, inGroup, minGap) {
    const idx = beams.map((b, i) => i).filter((i) => inGroup(beams[i]));
    for (let pass = 0; pass < 4; pass++) {
      idx.sort((i, j) => (((ang[i] % Math.PI) + Math.PI) % Math.PI) - (((ang[j] % Math.PI) + Math.PI) % Math.PI));
      for (let n = 0; n < idx.length; n++) {
        const i = idx[n], j = idx[(n + 1) % idx.length];
        let d = (((ang[j] - ang[i]) % Math.PI) + Math.PI) % Math.PI;
        const need = minGap(beams[i], beams[j]);
        if (d < need) { const push = (need - d) / 2; ang[i] -= push; ang[j] += push; }
      }
    }
  }

  function path(ctx, polys, k) {
    ctx.beginPath();
    polys.forEach((pts) => {
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
      ctx.closePath();
    });
  }

  // opts: { mode: 'water' | 'light', t, amp, f (0 — холодная/день, 1 — горячая/ночь), sec, glow, speed, glints }
  function draw(soft, sharp, o) {
    const cs = soft.getContext('2d'), ch = sharp.getContext('2d');
    if (soft.width !== Math.round(W * SOFT)) { soft.width = Math.round(W * SOFT); soft.height = Math.round(H * SOFT); }
    if (sharp.width !== Math.round(W * SHARP)) { sharp.width = Math.round(W * SHARP); sharp.height = Math.round(H * SHARP); }
    cs.globalCompositeOperation = 'source-over'; cs.globalAlpha = 1;
    cs.clearRect(0, 0, soft.width, soft.height);
    ch.globalCompositeOperation = 'source-over'; ch.globalAlpha = 1;
    ch.clearRect(0, 0, sharp.width, sharp.height);
    // День светлее и ярче ночи
    const gain = (o.glow ?? 0.5) * 2 * (o.mode === 'light' ? 1.35 - 0.35 * o.f : 1);

    if (o.mode === 'water') {
      RIBBONS.forEach((r, j) => {
        const g = ribbon(r, o.t, o.amp);
        cs.save();
        path(cs, [g.clip], SOFT); cs.clip();
        cs.globalAlpha = Math.min(1, r.op * gain) * 0.8;
        cs.fillStyle = rgba(mixArr(COLD[j][0], HOT[j][0], o.f), 1); path(cs, [g.deep], SOFT); cs.fill();
        cs.fillStyle = rgba(mixArr(COLD[j][1], HOT[j][1], o.f), 1); path(cs, [g.bright], SOFT); cs.fill();
        cs.restore();
      });
      return;
    }

    // Лучи двигаются сами, по реальному времени — не зависят от ввода
    const t = o.sec * (o.speed ?? 1);
    const P = {};
    Object.keys(DAY).forEach((k) => (P[k] = mixArr(DAY[k], NIGHT[k], o.f)));
    const fx = 201 + 50 * Math.sin(t * 0.5), fy = 455 + 35 * Math.sin(t * 0.37 + 1);
    // Поворот ограничен: главный луч не ложится по диагонали в одну сплошную полосу
    const rot = 0.25 * Math.sin(t * 0.23) + 0.08 * Math.sin(t * 0.61 + 2);
    const live = [];
    cs.globalCompositeOperation = 'lighter';
    ch.globalCompositeOperation = 'lighter';
    // Углы лучей: общий поворот + своё покачивание, затем раздвигаем, чтобы лучи не сливались
    const ang = BEAMS.map((b) => b.a + rot + b.sway * 1.5 * Math.sin(t * b.s * 2 + b.p));
    spread(ang, BEAMS, (b) => b.soft, (x, y) => (x.w + y.w) * 0.85);
    // Тонкие штрихи живут внутри веера — как яркая жилка в луче (как на референсе), а не отдельные спицы
    BEAMS.forEach((b, i) => { if (b.host != null) ang[i] = ang[b.host] + b.off + 0.04 * Math.sin(t * b.s * 2 + b.p); });
    // Изгиб в основном общий — лучи изгибаются вместе, как поток, и не пересекаются
    const common = 0.15 * Math.sin(t * 0.31 + 0.7);
    BEAMS.forEach((b, i) => {
      const a = ang[i];
      const bend = b.host != null ? live[b.host].bend : common + b.bend * 0.3 * Math.sin(t * b.s * 1.3 + b.p);
      const al = b.amp * (0.75 + 0.25 * Math.sin(t * b.s * 2.4 + b.p * 2.1)) * gain * (b.soft ? 0.85 : 0.6);
      live.push({ a, bend });
      const ctx = b.soft ? cs : ch, k = b.soft ? SOFT : SHARP;
      const g = ctx.createRadialGradient(fx * k, fy * k, 0, fx * k, fy * k, 1000 * k);
      const c = P[b.col];
      if (b.soft) {
        g.addColorStop(0, rgba(c, al * 0.35)); g.addColorStop(0.06, rgba(c, al * 0.8)); g.addColorStop(0.18, rgba(c, al * 0.7));
        g.addColorStop(0.5, rgba(c, al * 0.25)); g.addColorStop(1, rgba(c, 0));
      } else {
        // Штрихи — мягкие световые полосы: ярче у ядра и быстро растворяются, без чётких «палочек»
        g.addColorStop(0, rgba(c, al * 0.4)); g.addColorStop(0.05, rgba(c, al * 0.75)); g.addColorStop(0.1, rgba(c, al * 0.5));
        g.addColorStop(0.3, rgba(c, al * 0.1)); g.addColorStop(0.5, rgba(c, 0));
      }
      ctx.fillStyle = g;
      path(ctx, beamPoly(fx, fy, a, b.w, bend), k);
      ctx.fill();
    });
    HALVES.forEach((h) => {
      const base = live[h.host];
      const a = base.a + h.off + 0.05 * Math.sin(t * h.s * 2 + h.p);
      // медленно проявляются и гаснут, поэтому одновременно видно 1–3 половинки
      const al = h.amp * gain * 0.6 * (0.5 + 0.5 * Math.sin(t * h.s * 1.1 + h.p));
      const c = P.streak;
      const g = ch.createRadialGradient(fx * SHARP, fy * SHARP, 0, fx * SHARP, fy * SHARP, 1000 * SHARP);
      g.addColorStop(0, rgba(c, al * 0.3)); g.addColorStop(0.06, rgba(c, al * 0.9)); g.addColorStop(0.25, rgba(c, al * 0.5));
      g.addColorStop(0.6, rgba(c, al * 0.15)); g.addColorStop(0.85, rgba(c, 0));
      ch.fillStyle = g;
      path(ch, beamPoly(fx, fy, a, h.w, base.bend, h.side), SHARP);
      ch.fill();
    });
    // Ядро
    const cg = cs.createRadialGradient(fx * SOFT, fy * SOFT, 0, fx * SOFT, fy * SOFT, 30 * SOFT);
    cg.addColorStop(0, rgba(P.core, 0.12 * gain)); cg.addColorStop(1, rgba(P.core, 0));
    cs.fillStyle = cg; cs.fillRect(0, 0, soft.width, soft.height);
    // Блики от нажатий: светлый штрих мягко проезжает и гаснет
    (o.glints || []).forEach((gl) => {
      const e = o.sec - gl.t0;
      if (e < 0 || e >= 1) return;
      const env = e < 0.18 ? ease(e / 0.18) : 1 - ease((e - 0.18) / 0.82);
      const base = live[gl.beam];
      const g = ch.createRadialGradient(fx * SHARP, fy * SHARP, 0, fx * SHARP, fy * SHARP, 700 * SHARP);
      g.addColorStop(0, rgba(P.core, 0.4 * env)); g.addColorStop(1, rgba(P.core, 0));
      ch.fillStyle = g;
      path(ch, beamPoly(fx, fy, base.a + gl.dir * 0.12 * ease(e), 0.025, base.bend), SHARP);
      ch.fill();
    });
  }

  return { draw, ease };
})();
