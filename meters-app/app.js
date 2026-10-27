// Прототип экрана показаний счётчиков.
// Ленты света: затихают по шагам во время ввода, после «Сохранить» холодная вода
// перетекает в горячую (перекраска), поток ненадолго ускоряется.

(() => {
  // ---------- Настройки ----------
  const CONFIG = {
    glow: 0.5,          // яркость лент, 0…1
    calm: 0.5,          // во сколько раз медленнее поток к концу ввода (0.5 = вдвое)
    stepDigits: 5,      // за сколько цифр поток доходит до минимальной скорости
    boost: 1.4,         // ускорение после сохранения
    boostTime: 1.2,     // сколько секунд длится ускорение
    recolorTime: 0.6,   // перекраска холодная → горячая, секунды
    toInput: [220, 300],  // список растворяется, затем экран ввода проявляется (мс)
    toList: [180, 240],   // экран ввода гаснет, затем проявляется список (мс)
  };

  const METERS = {
    cold: { title: 'Холодная вода', numA: '1015019434', numB: '800', prev: 67.68, accent: '#c4e9fb' },
    hot:  { title: 'Горячая вода',  numA: '1015015959', numB: '600', prev: 29,    accent: '#ffc9a8' },
  };

  // Три ленты: [deep, bright] цвета для холодной и горячей воды
  const COLD = [['#0b3a5c', '#2f8fc8'], ['#0e1240', '#3a3fb0'], ['#0f4f9a', '#57c6f5']];
  const HOT  = [['#5a1206', '#c2381a'], ['#3a0605', '#c0170f'], ['#a8180a', '#ff5226']];
  const RIBBONS = [
    { A: [-300, 520],  B: [520, 1340], amp: 70,  k: 1.7, v: -0.55, p: 4.0, side: 1,  wb: 60, wd: 160, drift: 35, ds: 0.17, op: 0.5,  cv: 0.4,  span: 0.5 },
    { A: [-250, -260], B: [660, 720],  amp: 85,  k: 1.3, v: 0.42,  p: 2.1, side: -1, wb: 70, wd: 190, drift: 40, ds: 0.25, op: 0.6,  cv: 0.3,  span: 0.5 },
    { A: [-250, 40],   B: [660, 1030], amp: 100, k: 1.5, v: 0.5,   p: 0,   side: 1,  wb: 90, wd: 220, drift: 45, ds: 0.2,  op: 0.95, cv: 0.35, span: 0.55 },
  ];

  // ---------- Состояние ----------
  const state = {
    screen: 'list',      // 'list' | 'input'
    stage: 'cold',       // 'cold' | 'hot'
    value: '',
    saveAt: -99,
    trans: null,         // { to: 'input' | 'list', t0 }
    saved: { cold: '', hot: '', day: '862', night: '254' },
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    phone: $('phone'), inputBg: $('inputBg'), cover: $('cover'),
    list: $('listScreen'), input: $('inputScreen'),
    valCold: $('valCold'), valHot: $('valHot'), valDay: $('valDay'), valNight: $('valNight'),
    sendBtn: $('sendBtn'), saveBtn: $('saveBtn'), backBtn: $('backBtn'),
    inTitle: $('inTitle'), numA: $('numA'), numB: $('numB'),
    shown: $('shown'), caret: $('caret'), support: $('support'), keyboard: $('keyboard'),
  };
  const rib = [0, 1, 2].map((i) => ({
    clip: $('clip' + i), deep: $('deep' + i), bright: $('bright' + i), grp: $('grp' + i),
  }));

  // ---------- Утилиты ----------
  const now = () => performance.now() / 1000;
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, f) => {
    const x = rgb(a), y = rgb(b);
    return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * f)).join(',') + ')';
  };
  const fmt = (x) => x.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
  const parseValue = (v) => (v ? parseFloat(v.replace(',', '.')) : NaN);

  // ---------- Геометрия лент ----------
  function ribbonPaths(r, t, ampMul) {
    const N = 48;
    const dx = r.B[0] - r.A[0], dy = r.B[1] - r.A[1], L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    const shift = r.drift * ampMul * Math.sin(t * r.ds + r.p);
    const ph = t * r.v + r.p;
    const c = 0.5 + 0.22 * Math.sin(t * r.cv + r.p * 1.3);
    const env = (s, span) => {
      const u = (s - c) / span + 0.5;
      return u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 1.4);
    };
    const line = (off) => {
      const a = [];
      for (let i = 0; i <= N; i++) {
        const s = i / N;
        const w = ampMul * (r.amp * Math.sin(Math.PI * r.k * s + ph) +
          r.amp * 0.35 * Math.sin(Math.PI * r.k * 2.3 * s - ph * 0.7 + r.p));
        const o = w + shift + off(s);
        a.push([r.A[0] + dx * s + nx * o, r.A[1] + dy * s + ny * o]);
      }
      return a;
    };
    const band = (f1, f2) => {
      const pts = line(f1).concat(line(f2).reverse());
      return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + ' Z';
    };
    const sd = r.side;
    return {
      clip: band(() => 0, () => sd * 1400),
      bright: band(() => -sd * 30, (s) => sd * r.wb * env(s, r.span)),
      deep: band(() => -sd * 30, (s) => sd * r.wd * env(s, r.span * 1.5)),
    };
  }

  // ---------- Клавиатура ----------
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'].forEach((k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key';
    b.textContent = k;
    b.addEventListener('click', () => press(k));
    el.keyboard.appendChild(b);
  });
  const erase = document.createElement('button');
  erase.type = 'button';
  erase.className = 'key';
  erase.setAttribute('aria-label', 'Стереть');
  erase.innerHTML = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M11.2081 6.93311C10.5011 6.93299 9.80328 7.09351 9.1674 7.40256C8.53151 7.71162 7.97416 8.16111 7.53743 8.71711L2.78942 14.7638C2.51271 15.1161 2.3623 15.5511 2.3623 15.9991C2.3623 16.4471 2.51271 16.8821 2.78942 17.2344L7.53743 23.2824C7.97416 23.8384 8.53151 24.2879 9.1674 24.597C9.80328 24.906 10.5011 25.0666 11.2081 25.0664H25.4041C26.2881 25.0664 27.136 24.7153 27.7611 24.0901C28.3862 23.465 28.7374 22.6172 28.7374 21.7331V10.2664C28.7374 9.38238 28.3862 8.53454 27.7611 7.90942C27.136 7.2843 26.2881 6.93311 25.4041 6.93311H11.2081ZM13.9601 11.2931C14.1476 11.1058 14.4018 11.0007 14.6668 11.0007C14.9318 11.0007 15.1859 11.1058 15.3734 11.2931L18.6668 14.5864L21.9601 11.2931C22.0516 11.1949 22.162 11.1161 22.2847 11.0614C22.4074 11.0067 22.5398 10.9774 22.6741 10.975C22.8083 10.9726 22.9417 10.9973 23.0662 11.0476C23.1907 11.0979 23.3039 11.1728 23.3988 11.2677C23.4938 11.3627 23.5686 11.4758 23.6189 11.6003C23.6692 11.7248 23.6939 11.8582 23.6915 11.9925C23.6892 12.1267 23.6598 12.2592 23.6051 12.3818C23.5505 12.5045 23.4717 12.6149 23.3734 12.7064L20.0801 15.9998L23.3734 19.2931C23.5501 19.4827 23.6462 19.7334 23.6417 19.9925C23.6371 20.2515 23.5321 20.4987 23.3489 20.6819C23.1657 20.8652 22.9185 20.9701 22.6595 20.9747C22.4004 20.9792 22.1497 20.8831 21.9601 20.7064L18.6668 17.4131L15.3734 20.7064C15.2819 20.8047 15.1715 20.8835 15.0488 20.9381C14.9261 20.9928 14.7937 21.0222 14.6595 21.0246C14.5252 21.0269 14.3918 21.0022 14.2673 20.9519C14.1428 20.9016 14.0297 20.8268 13.9347 20.7318C13.8397 20.6369 13.7649 20.5238 13.7146 20.3992C13.6643 20.2747 13.6396 20.1413 13.642 20.0071C13.6443 19.8728 13.6737 19.7404 13.7284 19.6177C13.783 19.4951 13.8618 19.3847 13.9601 19.2931L17.2534 15.9998L13.9601 12.7064C13.7728 12.5189 13.6676 12.2648 13.6676 11.9998C13.6676 11.7348 13.7728 11.4806 13.9601 11.2931Z" fill-rule="evenodd" clip-rule="evenodd" fill="#F5F5F5"/></svg>';
  erase.addEventListener('click', () => { state.value = state.value.slice(0, -1); render(); });
  el.keyboard.appendChild(erase);

  // ---------- Действия ----------
  function press(k) {
    const v = state.value;
    if (k === ',' && (v.includes(',') || v === '')) return;
    if (v.replace(',', '').length >= 7) return;
    state.value = v + k;
    render();
  }

  function canSave() {
    const num = parseValue(state.value);
    return !isNaN(num) && num >= METERS[state.stage].prev;
  }

  function open(stage) {
    state.screen = 'input';
    state.stage = stage;
    state.value = '';
    state.saveAt = stage === 'hot' ? now() - 10 : -99;
    state.trans = { to: 'input', t0: now() };
    render();
  }

  function back() {
    state.screen = 'list';
    state.value = '';
    state.trans = { to: 'list', t0: now() };
    render();
  }

  function save() {
    if (!canSave()) return;
    state.saved[state.stage] = state.value;
    if (state.stage === 'cold') {
      state.stage = 'hot';
      state.value = '';
      state.saveAt = now();
    } else {
      back();
      return;
    }
    render();
  }

  $('rowCold').addEventListener('click', () => open('cold'));
  $('rowHot').addEventListener('click', () => open('hot'));
  el.backBtn.addEventListener('click', back);
  el.saveBtn.addEventListener('click', save);

  // Ввод с физической клавиатуры (удобно на компьютере)
  window.addEventListener('keydown', (e) => {
    if (state.screen !== 'input') return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === ',' || e.key === '.') press(',');
    else if (e.key === 'Backspace') { state.value = state.value.slice(0, -1); render(); }
    else if (e.key === 'Enter') save();
    else if (e.key === 'Escape') back();
  });

  // ---------- Отрисовка текста и состояний ----------
  function render() {
    const s = state.saved;
    el.valCold.textContent = s.cold ? s.cold + ' м³' : '';
    el.valHot.textContent = s.hot ? s.hot + ' м³' : '';
    el.valDay.textContent = s.day ? s.day + ' кВт·ч' : '';
    el.valNight.textContent = s.night ? s.night + ' кВт·ч' : '';
    el.sendBtn.disabled = !(s.cold || s.hot || s.day || s.night);

    const m = METERS[state.stage];
    el.inTitle.textContent = m.title;
    el.numA.textContent = m.numA;
    el.numB.textContent = m.numB;
    el.shown.textContent = state.value || '0';
    el.shown.classList.toggle('empty', !state.value);

    const ok = canSave();
    const num = parseValue(state.value);
    if (ok) {
      el.support.textContent = 'Текущий расход — ' + (num - m.prev).toFixed(2).replace('.', ',') + ' м³';
      el.support.style.color = m.accent;
    } else if (!isNaN(num)) {
      el.support.textContent = 'Новые показания должны быть не ниже предыдущих';
      el.support.style.color = '';
    } else {
      el.support.textContent = 'Предыдущие показания — ' + fmt(m.prev) + ' м³';
      el.support.style.color = '';
    }
    el.saveBtn.disabled = !ok;
  }

  // ---------- Анимация ----------
  let tau = 0, speed = 1, amp = 1, last = performance.now(), lastRib = 0;

  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    const sec = t / 1000;

    // Скорость потока: по шагам замедляется с каждой цифрой, после сохранения ускоряется
    const n = state.value.replace(',', '').length;
    const slow = Math.max(CONFIG.calm, 1 - n * (1 - CONFIG.calm) / CONFIG.stepDigits);
    const boosting = sec - state.saveAt < CONFIG.boostTime;
    const targetSpeed = boosting ? CONFIG.boost : slow;
    const targetAmp = 1 - (1 - slow) * 0.35;
    const k = Math.min(1, dt * 2);
    speed += (targetSpeed - speed) * k;
    amp += (targetAmp - amp) * k;
    tau += dt * speed;

    // Переходы между экранами
    let showList = state.screen === 'list', showInput = state.screen === 'input';
    let listOp = 1, listBlur = 0, coverOp = 0, uiOp = 1;
    const tr = state.trans;
    if (tr) {
      const e = (sec - tr.t0) * 1000;
      const toList = tr.to === 'list';
      const [A, B] = toList ? CONFIG.toList : CONFIG.toInput;
      if (e > A + B) {
        state.trans = null;
      } else {
        const p1 = ease(e / A), p2 = ease((e - A) / B);
        if (!toList) {
          showList = e < A; showInput = true;
          listOp = 1 - p1; listBlur = 12 * p1;
          coverOp = 1 - p2; uiOp = p2;
        } else {
          showInput = e < A; showList = e >= A;
          coverOp = p1; uiOp = 1 - p1;
          listOp = p2; listBlur = 8 * (1 - p2);
        }
      }
    }

    el.list.classList.toggle('visible', showList);
    el.list.style.opacity = listOp;
    el.list.style.filter = listBlur > 0.05 ? 'blur(' + listBlur.toFixed(2) + 'px)' : 'none';
    el.input.classList.toggle('visible', showInput);
    el.input.style.opacity = uiOp;
    el.inputBg.style.display = showInput ? 'block' : 'none';
    el.cover.style.opacity = coverOp;

    // Ленты — примерно 30 кадров в секунду, только когда виден экран ввода
    if (showInput && t - lastRib > 33) {
      lastRib = t;
      const hot = state.stage === 'hot';
      const f = hot ? ease((sec - state.saveAt) / CONFIG.recolorTime) : 0;
      el.phone.style.background = mix('#141414', '#140e0d', f);
      RIBBONS.forEach((r, i) => {
        const g = ribbonPaths(r, tau, amp);
        rib[i].clip.setAttribute('d', g.clip);
        rib[i].deep.setAttribute('d', g.deep);
        rib[i].bright.setAttribute('d', g.bright);
        rib[i].deep.setAttribute('fill', mix(COLD[i][0], HOT[i][0], f));
        rib[i].bright.setAttribute('fill', mix(COLD[i][1], HOT[i][1], f));
        rib[i].grp.setAttribute('opacity', Math.min(1, r.op * CONFIG.glow * 2).toFixed(3));
      });
    }
    if (!showInput) el.phone.style.background = '#141414';

    // Мигающий курсор
    el.caret.style.opacity = Math.floor(sec * 1.8) % 2 === 0 ? 1 : 0;

    requestAnimationFrame(frame);
  }

  // ---------- Масштаб под окно ----------
  function fit() {
    const k = Math.min(1, (window.innerHeight - 32) / 874, (window.innerWidth - 32) / 402);
    el.phone.style.transform = 'scale(' + Math.max(0.3, k) + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  render();
  requestAnimationFrame(frame);
})();
