/* Ubiquitous, Yet Hard to See: the lab page (Session 1).
 * The page keeps the routine at the magnet (model.js step) and the student's work; Unity draws the
 * hall and passes its clicks here. Every step also has a button, so the lab can be done without the
 * 3D room. Work is kept in localStorage under 'ubiq-lab:v1'.
 */
(function () {
  'use strict';
  var D = window.UbiqData, M = window.UbiqModel;
  var params = new URLSearchParams(window.location.search);
  var STORE_KEY = 'ubiq-lab:v1';
  var PART = params.get('part') === '2' ? 2 : 1;
  var RUN_SECONDS = 4;

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---- The student's work ---------------------------------------------------------------------

  function blankState(code) {
    return {
      code: code || M.newCode(), routine: M.blankRoutine(), recorded: {}, view: 'hall',
      answers: {}, hxReadings: [], hxTime: 0, walk: ['', '', '', '', '', '', ''], name: '', mass: 8.6,
      // Session 2: its own routine at the magnet, the X-ray room's, and its views
      routine2: M.blankRoutine(), xray: M.blankXray(), view2: 'hall', bindPartner: 'sh3a', bindRatio: 0
    };
  }
  function loadState() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (saved && M.validCode(saved.code)) {
        var fresh = blankState(saved.code);
        Object.keys(fresh).forEach(function (k) { if (saved[k] === undefined) saved[k] = fresh[k]; });
        saved.routine.running = '';          // a reload ends a run in progress
        if (saved.routine2) saved.routine2.running = '';
        return saved;
      }
    } catch (e) { /* nothing kept */ }
    return null;
  }
  var saveTimer = null;
  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private window: not kept */ }
    }, 200);
  }
  window.addEventListener('pagehide', function () {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not kept */ }
  });

  var state = loadState();
  var requested = M.normalizeCode(params.get('code') || '');
  if (!state || (M.validCode(requested) && requested !== state.code)) state = blankState(M.validCode(requested) ? requested : null);
  var P = M.picks(D, state.code);
  // each session has its own routine at the magnet (its own tubes); r() is the one shown
  function R() { return PART === 2 ? state.routine2 : state.routine; }
  function setR(v) { if (PART === 2) state.routine2 = v; else state.routine = v; }
  function currentView() { return PART === 2 ? state.view2 : state.view; }
  saveState();

  // ---- The room (Unity) ---------------------------------------------------------------------------

  var unity = null, unityAwake = false, configured = false;
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function sendRoom(method, value) {
    if (!unity || !unityAwake) return;
    try { unity.SendMessage('Lab', method, value == null ? '' : String(value)); } catch (e) { console.error(e); }
  }
  function configureRoom() {
    if (!unity || !unityAwake) return;
    sendRoom('Configure', JSON.stringify({ calm: calm, intro: params.get('intro') !== '0' && !R().tube && PART === 1, view: currentView(), routine: R(), part: PART, xray: state.xray }));
  }
  function showRoom() { sendRoom('Show', JSON.stringify(R())); if (PART === 2) sendRoom('ShowX', JSON.stringify(state.xray)); }

  function onUnityEvent(json) {
    var msg;
    try { msg = JSON.parse(json); } catch (e) { return; }
    switch (msg.type) {
      case 'ready': unityAwake = true; configureRoom(); break;
      case 'configured': configured = true; $('stage-cover').hidden = true; showRoom(); break;
      case 'click': if (!onRoomClick(msg.item, msg.n) && window.UbiqLab2) window.UbiqLab2.click(msg.item, msg.n); break;
      case 'hover':
        if (msg.item && HOVER[msg.item]) note(HOVER[msg.item](msg.n), 'hover');
        else if (msg.item && window.UbiqLab2 && window.UbiqLab2.hover(msg.item, msg.n)) note(window.UbiqLab2.hover(msg.item, msg.n), 'hover');
        else if ($('stage-note').getAttribute('data-kind') === 'hover') note('');
        break;
      case 'view': if (PART === 2) state.view2 = msg.view; else state.view = msg.view; showViews(); saveState(); break;
    }
  }

  var TUBE_IDS = PART === 2 ? ['D', 'E'] : ['A', 'B', 'C'];
  var HOVER = {
    tube: function (n) { var t = TUBE_IDS[n]; return 'Click ' + M.TUBES[t].name + ': ' + M.TUBES[t].what; },
    stair: function () { return R().top ? 'Click the stair to come down' : 'Click the stair to climb to the platform'; },
    bore: function () { return R().where === 'magnet' ? 'Click the top of the magnet to take the tube out on the lift air' : 'Click the top of the magnet to lower the tube in'; },
    desk: function () { return 'Click the desk to sit at the spectrometer’s computer'; }
  };

  /** A click in the NMR hall; false when it is not the hall's (the X-ray room's go to app2.js). */
  function onRoomClick(item, n) {
    var r = R();
    if (item === 'tube') {
      var t = TUBE_IDS[n];
      if (!t) return true;
      if (r.where === 'hand' && r.tube === t) act('putback'); else act('take ' + t);
    } else if (item === 'stair') act(r.top ? 'down' : 'climb');
    else if (item === 'bore') act(r.where === 'magnet' ? 'eject' : 'insert');
    else if (item === 'desk') setView('desk');
    else return false;
    return true;
  }

  function setView(v) {
    if (PART === 2) state.view2 = v; else state.view = v;
    showViews();
    sendRoom('SetView', v);
    saveState();
  }

  function note(text, kind) {
    var n = $('stage-note');
    n.textContent = text || '';
    n.setAttribute('data-kind', kind || '');
  }

  // ---- The routine --------------------------------------------------------------------------------

  var runTimer = null;

  function act(what) {
    var res = M.step(R(), what);
    if (!res.ok) { note(M.routineText(res.reason), 'blocked'); showRoutine(); return false; }
    note('');
    setR(res.state);
    var verb = what.split(' ')[0];
    if (verb === 'climb') setView('top');
    if (verb === 'down') setView('bench');
    if (verb === 'take') setView('bench');
    if (verb === 'run') startRun(what.split(' ')[1]);
    showRoom();
    showRoutine();
    saveState();
    return true;
  }

  function startRun(exp) {
    var e = M.EXPERIMENTS.filter(function (x) { return x.id === exp; })[0];
    var t0 = Date.now();
    $('run-bar').hidden = false;
    $('run-label').textContent = e.name + ' running (' + e.real + ' on a real magnet)';
    sendRoom('Run', JSON.stringify({ exp: exp, seconds: RUN_SECONDS }));
    clearInterval(runTimer);
    runTimer = setInterval(function () {
      var f = Math.min(1, (Date.now() - t0) / (RUN_SECONDS * 1000));
      $('run-fill').style.width = Math.round(f * 100) + '%';
      if (f >= 1) { clearInterval(runTimer); finishRun(exp); }
    }, 100);
  }

  function finishRun(exp) {
    var name = M.recordName(exp, R().tube);
    state.recorded[name] = true;
    var res = M.step(R(), 'finish');
    if (res.ok) setR(res.state);
    $('run-bar').hidden = true;
    note(M.EXPERIMENTS.filter(function (x) { return x.id === exp; })[0].name + ' recorded. Its spectrum is in the part below.', 'info');
    showRoom();
    showRoutine();
    showFigures();
    saveState();
  }

  function stepItem(list, label, why, done, next, buttons) {
    var li = el('li', { 'class': 'routine-step', 'data-state': done ? 'done' : next ? 'next' : '' });
    li.appendChild(el('span', { 'class': 'routine-name' }, label));
    li.appendChild(el('span', { 'class': 'routine-why' }, why));
    var b = el('span', { 'class': 'routine-buttons' });
    buttons.forEach(function (x) {
      var btn = el('button', { type: 'button', 'class': 'quiet-button' }, x[0]);
      btn.addEventListener('click', function () { act(x[1]); });
      b.appendChild(btn);
    });
    li.appendChild(b);
    list.appendChild(li);
  }

  function showRoutine() {
    var r = R();
    var tl = $('tube-list'); tl.textContent = '';
    TUBE_IDS.forEach(function (t) {
      var li = el('li', { 'class': 'tube-item' });
      var where = r.tube === t ? (r.where === 'magnet' ? 'in the magnet' : 'in your hand') : 'in the rack';
      li.appendChild(el('span', { 'class': 'tube-name' }, M.TUBES[t].name));
      li.appendChild(el('span', { 'class': 'tube-what' }, M.TUBES[t].what + ' (' + where + ')'));
      var btn = el('button', { type: 'button', 'class': 'quiet-button' }, r.tube === t && r.where === 'hand' ? 'Put it back' : 'Take it');
      btn.disabled = !!r.tube && r.tube !== t || r.where === 'magnet';
      btn.addEventListener('click', function () { act(r.tube === t && r.where === 'hand' ? 'putback' : 'take ' + t); });
      li.appendChild(btn);
      tl.appendChild(li);
    });

    var inList = $('routine-in'); inList.textContent = '';
    var held = r.where === 'hand', inMag = r.where === 'magnet';
    stepItem(inList, 'Climb to the platform', 'The top of the magnet, where the tube goes in, is 5 m up: the stair leads to the platform round it.', r.top, held && !r.top, [[r.top ? 'Come down' : 'Climb the stair', r.top ? 'down' : 'climb']]);
    stepItem(inList, 'Lower the tube into the magnet', 'The tube rides down the bore on a cushion of air to the probe at the magnet’s centre.', inMag, held && r.top, inMag ? [['Take it out', 'eject']] : [['Lower it in', 'insert']]);

    var setup = $('routine-setup'); setup.textContent = '';
    var labels = {
      lock: ['Lock on the deuterium signal', 'The spectrometer follows the solvent’s deuterium to hold the field steady for hours.'],
      shim: ['Shim', 'Small coils even out the field over the sample, so that every line is sharp.'],
      tune: ['Tune and match the probe', 'The probe’s coils are tuned to ¹H, ¹³C and ¹⁵N for this sample (salt changes them).'],
      temp: ['Set 25 °C', 'Shifts move with temperature: every spectrum here is at 25 °C.']
    };
    var firstUndone = M.SETUP.filter(function (k) { return !r[k]; })[0];
    M.SETUP.forEach(function (k) {
      stepItem(setup, labels[k][0], labels[k][1], r[k], inMag && k === firstUndone && !r.running, [[r[k] ? 'Done' : labels[k][0].split(' ')[0], k]]);
    });

    var ex = $('exp-list'); ex.textContent = '';
    M.EXPERIMENTS.filter(function (e) { return e.part === PART; }).forEach(function (e) {
      var li = el('li', { 'class': 'exp-item' });
      var rec = e.id === 'titration' ? (state.recorded.sh3a ? 'D' : '') + (state.recorded.sh3c ? (state.recorded.sh3a ? ', ' : '') + 'E' : '') : e.id === 'hsqc' ? (state.recorded.hsqc ? 'A' : '') + (state.recorded.mystery ? (state.recorded.hsqc ? ', ' : '') + 'B' : '') : (state.recorded[e.id] ? e.tubes : '');
      li.appendChild(el('span', { 'class': 'exp-name' }, e.name));
      li.appendChild(el('span', { 'class': 'exp-what' }, 'Sample ' + e.tubes.split('').join(' or ') + '; ' + e.real + (rec ? '. Recorded: ' + rec : '')));
      var btn = el('button', { type: 'button', 'class': 'quiet-button' }, r.running === e.id ? 'Running' : 'Run');
      btn.disabled = !!r.running;
      btn.addEventListener('click', function () { act('run ' + e.id); });
      li.appendChild(btn);
      if (rec) li.setAttribute('data-done', 'true');
      ex.appendChild(li);
    });
    if (window.UbiqLab2) window.UbiqLab2.showRoutine();
  }

  function showViews() {
    document.querySelectorAll('.view-button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === currentView() ? 'true' : 'false'); });
  }

  // ---- Drawing helpers ----------------------------------------------------------------------------

  var INK = '#17211e', SOFT = '#74807c', RULE = '#c7d1cc', BLUE = '#1c4c9a', RED = '#ab2a1c', ORANGE = '#d9822b';

  /** A 2D frame: x is 1H (high on the left), y another axis; returns mapping functions. */
  function frame2d(canvas, xHi, xLo, yLo, yHi, xLabel, yLabel, yDown) {
    var g = canvas.getContext('2d'), L = 96, R = canvas.width - 24, T = 18, B = canvas.height - 78;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = RULE; g.lineWidth = 1; g.strokeRect(L, T, R - L, B - T);
    g.fillStyle = SOFT; g.font = '22px system-ui, Segoe UI, sans-serif';
    var sx = function (v) { return L + (R - L) * (xHi - v) / (xHi - xLo); };
    var sy = function (v) { return yDown ? T + (B - T) * (v - yLo) / (yHi - yLo) : B - (B - T) * (v - yLo) / (yHi - yLo); };
    g.textAlign = 'center';
    var xs = niceStep(xHi - xLo), ys = niceStep(yHi - yLo);
    for (var v = Math.ceil(xLo / xs) * xs; v <= xHi + 1e-9; v += xs) { var x = sx(v); g.beginPath(); g.moveTo(x, B); g.lineTo(x, B + 8); g.stroke(); g.fillText(fmt(v, xs), x, B + 32); }
    g.fillText(xLabel, (L + R) / 2, B + 64);
    g.textAlign = 'right';
    for (var w = Math.ceil(yLo / ys) * ys; w <= yHi + 1e-9; w += ys) { var y = sy(w); g.beginPath(); g.moveTo(L - 8, y); g.lineTo(L, y); g.stroke(); g.fillText(fmt(w, ys), L - 12, y + 7); }
    g.save(); g.translate(26, (T + B) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(yLabel, 0, 0); g.restore();
    var f = { g: g, x: sx, y: sy, L: L, R: R, T: T, B: B };
    canvas._frame = f;
    clearLayer(canvas);
    return f;
  }
  function niceStep(span) { var s = span / 8, p = Math.pow(10, Math.floor(Math.log10(s))), m = s / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function fmt(v, step) { return step < 1 ? v.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(v)); }

  function blob(f, x, y, r, colour, alpha) {
    f.g.globalAlpha = Math.max(0, Math.min(1, alpha));
    f.g.fillStyle = colour;
    f.g.beginPath(); f.g.ellipse(x, y, r, r * 1.25, 0, 0, 2 * Math.PI); f.g.fill();
    f.g.globalAlpha = 1;
  }

  /** Remember where peaks were drawn, so a pointer can find them (a peak may give its own reach, rx and ry). */
  function hitList(canvas, list) { canvas._hits = list; }
  function hitAt(canvas, ev) {
    var rect = canvas.getBoundingClientRect(), sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    var x = (ev.clientX - rect.left) * sx, y = (ev.clientY - rect.top) * sy, best = null, bd = 1;
    (canvas._hits || []).forEach(function (h) {
      var rx = h.rx || 18, ry = h.ry || 18, d = (h.x - x) * (h.x - x) / (rx * rx) + (h.y - y) * (h.y - y) / (ry * ry);
      if (d < bd) { bd = d; best = h; }
    });
    return best;
  }

  // ---- Pointing at a peak: dotted lines run to what it is linked to ----------------------------------
  // The lines are drawn on a see-through canvas laid over the spectrum, so the spectrum is not redrawn
  // as the pointer moves. On a touch screen a tap does the same as pointing.

  var LINK = '#c2410c';      // the pointing lines: deep orange, apart from the data's blue, black and red

  function layer(canvas) {
    if (canvas._layer) return canvas._layer;
    var wrap = el('div', { 'class': 'plot-wrap' });
    canvas.parentNode.insertBefore(wrap, canvas);
    wrap.appendChild(canvas);
    var top = el('canvas', { 'class': 'point-layer', width: String(canvas.width), height: String(canvas.height), 'aria-hidden': 'true' });
    wrap.appendChild(top);
    canvas._layer = top;
    return top;
  }
  function clearLayer(canvas) { if (canvas._layer) canvas._layer.getContext('2d').clearRect(0, 0, canvas._layer.width, canvas._layer.height); }

  function dots(g, x0, y0, x1, y1) {
    g.save(); g.strokeStyle = LINK; g.lineWidth = 3; g.setLineDash([2, 7]); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
  }
  function ringAt(g, x, y, r, faint) {
    g.save(); g.strokeStyle = LINK; g.lineWidth = faint ? 2.5 : 3.5;
    if (faint) g.setLineDash([6, 4]);
    g.beginPath(); g.ellipse(x, y, r, r * 1.2, 0, 0, 2 * Math.PI); g.stroke(); g.restore();
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  /** A value written on an axis in a small filled box: 'bottom' (centred under x) or 'left' (ending at x). */
  function axisTag(g, x, y, text, side) {
    g.save(); g.font = 'bold 21px system-ui, Segoe UI, sans-serif';
    var w = g.measureText(text).width + 16, h = 32, x0 = side === 'left' ? x - w : x - w / 2, y0 = side === 'left' ? y - h / 2 : y;
    x0 = Math.max(2, Math.min(g.canvas.width - w - 2, x0));
    g.fillStyle = LINK; roundRect(g, x0, y0, w, h, 6); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, x0 + 8, y0 + h / 2 + 1);
    g.restore();
  }
  /** Dotted lines from a peak down to the ¹H axis and across to the other axis, with both values. */
  function toAxes(g, f, x, y, xText, yText) {
    dots(g, x, y, x, f.B); axisTag(g, x, f.B + 10, xText, 'bottom');
    dots(g, x, y, f.L, y); axisTag(g, f.L - 6, y, yText, 'left');
  }
  /** Point at a peak, or tap it: draw(g, frame, hit, hits) draws its links; say(hit) puts them in words (null: none). */
  function pointable(canvas, draw, say) {
    var top = layer(canvas), g = top.getContext('2d');
    function show(ev) {
      g.clearRect(0, 0, top.width, top.height);
      var h = hitAt(canvas, ev);
      if (h && canvas._frame) draw(g, canvas._frame, h, canvas._hits || []);
      if (say) say(h, canvas._hits || []);
    }
    canvas.addEventListener('pointermove', show);
    canvas.addEventListener('pointerdown', show);
    canvas.addEventListener('pointerleave', function (ev) {
      if (ev.pointerType === 'touch') return;
      g.clearRect(0, 0, top.width, top.height);
      if (say) say(null, canvas._hits || []);
    });
    if (say) say(null, []);
  }

  // ---- 1: the 1D spectrum ---------------------------------------------------------------------------

  function drawOneD() {
    var kDa = +$('mass-slider').value, c = $('oned-canvas'), g = c.getContext('2d');
    var lo = -1, hi = 11, n = 1600, s = M.oneD(D, kDa, 1200, lo, hi, n);
    var max = s.y.reduce(function (m, v) { return Math.max(m, v); }, 0) || 1;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    var x0 = 30, x1 = c.width - 30, y0 = c.height - 56, y1 = 20;
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath();
    s.y.forEach(function (v, i) { var x = x0 + (x1 - x0) * i / (n - 1), y = y0 - (y0 - y1) * v / max; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    g.fillStyle = SOFT; g.strokeStyle = RULE; g.lineWidth = 1; g.font = '22px system-ui, sans-serif'; g.textAlign = 'center';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.stroke();
    for (var p = 0; p <= 10; p++) { var x = x0 + (x1 - x0) * (hi - p) / (hi - lo); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + 8); g.stroke(); g.fillText(String(p), x, y0 + 32); }
    g.textAlign = 'right'; g.fillText('¹H (ppm), 1.2 GHz', x1, y0 - 12);
    var own = kDa < 8.7;
    $('mass-out').textContent = kDa.toFixed(1) + ' kDa · τc ' + (own ? '4.1 ns (measured, ubiquitin)' : '≈ ' + M.tauFromMass(kDa).toFixed(1) + ' ns') + ' · amide lines ≈ ' + s.linewidthHz.toFixed(0) + ' Hz wide';
  }

  // ---- 2: TOCSY -------------------------------------------------------------------------------------

  function drawTocsy() {
    var c = $('tocsy-canvas'), f = frame2d(c, 10.0, 6.0, 0, 10, '¹H, amide (ppm)', '¹H (ppm)', true), hits = [];
    D.residues.forEach(function (r) {
      if (r.shifts.H === undefined || r.n === 1) return;
      var s = M.tocsyStrip(D, r.n), own = r.n === P.tocsy;
      s.peaks.forEach(function (p) {
        blob(f, f.x(s.H), f.y(p.ppm), own ? 6 : 4, own ? BLUE : '#7d8894', own ? 1 : 0.55);
        hits.push({ x: f.x(s.H), y: f.y(p.ppm), n: r.n, H: s.H, ppm: p.ppm, diagonal: !!p.diagonal, count: p.count || 1 });
      });
    });
    hitList(c, hits);
    var strip = M.tocsyStrip(D, P.tocsy);
    var c = $('tocsy-strip'), g = c.getContext('2d'), T = 18, B = c.height - 78;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = RULE; g.strokeRect(60, T, c.width - 80, B - T);
    g.fillStyle = SOFT; g.font = '22px system-ui, sans-serif'; g.textAlign = 'right';
    for (var v = 0; v <= 10; v++) { var y = T + (B - T) * v / 10; g.fillText(String(v), 52, y + 7); }
    var mid = (60 + c.width - 20) / 2;
    strip.peaks.forEach(function (p) { var y = T + (B - T) * p.ppm / 10, big = p.count === 3 ? 1.6 : 1; g.fillStyle = p.diagonal ? SOFT : BLUE; g.beginPath(); g.ellipse(mid, y, 26 * big, 7 * big, 0, 0, 2 * Math.PI); g.fill(); });
    g.textAlign = 'center'; g.fillStyle = SOFT; g.fillText(strip.H.toFixed(2) + ' ppm', mid, B + 32);
    $('tocsy-hn').textContent = strip.H.toFixed(2);
    var tb = $('tocsy-peaks').querySelector('tbody'); tb.textContent = '';
    strip.peaks.slice().sort(function (a, b) { return b.ppm - a.ppm; }).forEach(function (p) {
      var tr = el('tr'); tr.appendChild(el('td', null, p.ppm.toFixed(2) + (p.diagonal ? ' (the amide itself, on the diagonal)' : p.count === 3 ? ' (a tall peak: three protons)' : ''))); tb.appendChild(tr);
    });
  }

  function buildTypical() {
    var t = $('typical-table'); t.textContent = '';
    var head = el('thead'), hr = el('tr');
    ['Amino acid', 'Hα', 'Hβ', 'Further side chain (average, ppm)'].forEach(function (h) { hr.appendChild(el('th', { scope: 'col' }, h)); });
    head.appendChild(hr); t.appendChild(head);
    var body = el('tbody');
    var NAMES = { G: 'Glycine', A: 'Alanine', V: 'Valine', L: 'Leucine', I: 'Isoleucine', T: 'Threonine', S: 'Serine', K: 'Lysine', E: 'Glutamate', Q: 'Glutamine', D: 'Aspartate', N: 'Asparagine', F: 'Phenylalanine', Y: 'Tyrosine', R: 'Arginine', H: 'Histidine', M: 'Methionine', P: 'Proline', W: 'Tryptophan', C: 'Cysteine' };
    Object.keys(NAMES).forEach(function (k) {
      var s = D.typical[k] || {}, tr = el('tr');
      var ha = ['HA', 'HA2', 'HA3'].filter(function (a) { return s[a]; }).map(function (a) { return s[a][0].toFixed(2); });
      var hb = ['HB', 'HB2', 'HB3', 'MB'].filter(function (a) { return s[a]; }).map(function (a) { return s[a][0].toFixed(2) + (a === 'MB' ? ' (methyl)' : ''); });
      // the further side chain: carbon-bound protons only (the OH, SH, carboxyl and ring NH protons
      // trade with water and rarely show), a methyl (M in the BMRB's names) marked as one
      var EXCHANGE = { T: ['HG1'], S: ['HG'], C: ['HG'], E: ['HE2'], D: ['HD2'], Y: ['HH'], H: ['HD1', 'HE2'], W: ['HE1'],
        K: ['HZ', 'QZ', 'HZ1', 'HZ2', 'HZ3'], R: ['HH11', 'HH12', 'HH21', 'HH22'], N: ['HD21', 'HD22'], Q: ['HE21', 'HE22'] };
      var rest = Object.keys(s).filter(function (a) {
        if (/^(H|HA|HA2|HA3|HB|HB2|HB3|MB)$/.test(a)) return false;
        return !(EXCHANGE[k] && EXCHANGE[k].indexOf(a) >= 0);
      }).filter(function (a) { return !(k === 'F' && /^H[DE]2$/.test(a)) && !(k === 'Y' && /^H[DE]2$/.test(a)); });
      // an aromatic ring's protons are a spin system of their own, seen apart from the amide's strip
      var ring = function (a) { return 'FYWH'.indexOf(k) >= 0 && /^H[DEZH]/.test(a); };
      var label = function (a) { return (a.charAt(0) === 'M' ? a.replace(/^M/, 'H') + ' (methyl)' : a) + ' ' + s[a][0].toFixed(2); };
      var further = rest.filter(function (a) { return !ring(a); }).map(label).join('; ');
      var rings = rest.filter(ring).map(label).join(', ');
      if (rings) further += (further ? '; ' : '') + 'the ring, not in the amide’s TOCSY strip: ' + rings;
      tr.appendChild(el('th', { scope: 'row' }, NAMES[k]));
      tr.appendChild(el('td', null, ha.join(', ') || '–'));
      tr.appendChild(el('td', null, hb.join(', ') || '–'));
      tr.appendChild(el('td', null, further || '–'));
      body.appendChild(tr);
    });
    t.appendChild(body);
    var sel = $('q-aa'); sel.textContent = '';
    sel.appendChild(el('option', { value: '' }, 'Choose'));
    Object.keys(NAMES).sort(function (a, b) { return NAMES[a] < NAMES[b] ? -1 : 1; }).forEach(function (k) { sel.appendChild(el('option', { value: k }, NAMES[k])); });
  }

  // ---- 3: NOESY -------------------------------------------------------------------------------------

  function drawNoesy() {
    var c = $('noesy-canvas'), f = frame2d(c, 10.0, 6.0, 0, 10, '¹H, amide (ppm)', '¹H (ppm)', true), hits = [];
    var own = D.residues[P.tocsy - 1].shifts.H;
    f.g.fillStyle = 'rgba(28,76,154,0.10)';
    f.g.fillRect(f.x(own + 0.03), f.T, f.x(own - 0.03) - f.x(own + 0.03), f.B - f.T);
    D.residues.forEach(function (r) {
      if (!r.noe || r.shifts.H === undefined) return;
      var s = M.noesyStrip(D, r.n), mine = r.n === P.tocsy;
      blob(f, f.x(s.H), f.y(s.H), 3, SOFT, 0.6);
      hits.push({ x: f.x(s.H), y: f.y(s.H), n: r.n, H: s.H, ppm: s.H, diagonal: true });
      s.peaks.forEach(function (p) {
        blob(f, f.x(s.H), f.y(p.ppm), 2 + 4 * Math.sqrt(p.height), mine ? BLUE : '#7d8894', mine ? 0.95 : 0.25 + 0.5 * p.height);
        hits.push({ x: f.x(s.H), y: f.y(p.ppm), n: r.n, H: s.H, ppm: p.ppm, r: p.r, diagonal: false });
      });
    });
    hitList(c, hits);
    $('noesy-hn').textContent = own.toFixed(2);
  }

  // What the pointer shows on the TOCSY and the NOESY. Both give shifts only: which proton is which is
  // for the student to work out.
  function columnOf(h, hits) { return hits.filter(function (k) { return k.n === h.n; }); }

  function drawTocsyLinks(g, f, h, hits) {
    var col = columnOf(h, hits), top = Math.min.apply(null, col.map(function (k) { return k.y; }));
    dots(g, h.x, top, h.x, f.B);
    col.forEach(function (k) { if (k !== h) ringAt(g, k.x, k.y, 11, true); });
    ringAt(g, h.x, h.y, 13);
    axisTag(g, h.x, f.B + 10, h.H.toFixed(2), 'bottom');
    dots(g, h.x, h.y, f.L, h.y); axisTag(g, f.L - 6, h.y, h.ppm.toFixed(2), 'left');
  }
  function sayTocsy(h, hits) {
    var out = $('tocsy-point'); if (!out) return;
    if (!h) { out.textContent = 'Point at a peak, or tap it: dotted lines link it to its column and to the axes.'; return; }
    var n = columnOf(h, hits).length;
    if (h.diagonal) { out.textContent = 'A diagonal peak: an amide proton, at ' + h.H.toFixed(2) + ' ppm on both axes. The ' + (n - 1) + ' peaks ringed in its column are the other protons of the same amino acid: its spin system.'; return; }
    out.textContent = 'A cross-peak: the amide proton at ' + h.H.toFixed(2) + ' ppm (its column, read at the bottom) and a proton at ' + h.ppm.toFixed(2) +
      ' ppm (its row, read at the side' + (h.count === 3 ? '; a tall peak, the three protons of a methyl' : '') + ') are in the same amino acid: the TOCSY passed magnetization between them along a chain of couplings.' +
      (h.ppm < 6 ? ' That proton’s own diagonal peak, at ' + h.ppm.toFixed(2) + ' ppm on both axes, lies off this amide region.' : '');
  }

  /** An NOE whose partner resonates among the amides has its partner's diagonal peak and a mirror peak on the plot. */
  function noesyPartner(h, hits) {
    if (h.diagonal || h.ppm < 6 || h.ppm > 10) return null;
    var mirror = hits.filter(function (k) { return !k.diagonal && Math.abs(k.H - h.ppm) < 0.006 && Math.abs(k.ppm - h.H) < 0.006; })[0] || null;
    return { mirror: mirror };
  }
  function drawNoesyLinks(g, f, h, hits) {
    var diag = columnOf(h, hits).filter(function (k) { return k.diagonal; })[0];
    dots(g, h.x, Math.min(h.y, diag ? diag.y : h.y), h.x, f.B);
    if (diag && diag !== h) ringAt(g, diag.x, diag.y, 10, true);
    ringAt(g, h.x, h.y, 12);
    axisTag(g, h.x, f.B + 10, h.H.toFixed(2), 'bottom');
    dots(g, h.x, h.y, f.L, h.y); axisTag(g, f.L - 6, h.y, h.ppm.toFixed(2), 'left');
    var other = noesyPartner(h, hits);
    if (!other) return;
    var dx = f.x(h.ppm), dy = f.y(h.ppm);
    dots(g, h.x, h.y, dx, dy); ringAt(g, dx, dy, 10, true);
    if (other.mirror && diag) { dots(g, dx, dy, other.mirror.x, other.mirror.y); dots(g, other.mirror.x, other.mirror.y, diag.x, diag.y); ringAt(g, other.mirror.x, other.mirror.y, 12, true); }
  }
  function sayNoesy(h, hits) {
    var out = $('noesy-point'); if (!out) return;
    if (!h) { out.textContent = 'Point at a peak, or tap it: dotted lines run to the two protons’ shifts and to the diagonal.'; return; }
    if (h.diagonal) { out.textContent = 'A diagonal peak: an amide proton, at ' + h.H.toFixed(2) + ' ppm on both axes. Every peak in its column is a proton near it in space (under about 5 Å), in its own residue or in another.'; return; }
    var how = h.r < 3 ? 'A strong peak: they are close, under about 3 Å apart.' : h.r < 4 ? 'A medium peak: about 3 to 4 Å apart.' : 'A weak peak: about 4 to 5 Å apart.';
    var other = noesyPartner(h, hits);
    out.textContent = 'An NOE: the amide proton at ' + h.H.toFixed(2) + ' ppm (its column) is near in space to a proton at ' + h.ppm.toFixed(2) + ' ppm (its row). ' + how +
      ' The spectrum gives only the two shifts; which proton is at ' + h.ppm.toFixed(2) + ' ppm has to be worked out, and in a protein many protons share a shift.' +
      (other ? ' This one resonates among the amide protons, so its own diagonal peak is on the plot too (ringed)' + (other.mirror ? ', and so is the mirror peak across the diagonal: the four corners of a square.' : '.') : '');
  }

  // ---- 4: the HSQC; 5: the mystery sample -----------------------------------------------------------

  var H_HI = 10.0, H_LO = 5.8, N_LO = 101, N_HI = 135;

  function drawHsqc() {
    var c = $('hsqc-canvas'), f = frame2d(c, H_HI, H_LO, N_LO, N_HI, '¹H (ppm)', '¹⁵N (ppm)', true), hits = [];
    M.hsqcPeaks(D).forEach(function (p) {
      var x = f.x(p.H), y = f.y(p.N);
      blob(f, x, y, 7, p.kind === 'sidechain' ? '#8d9994' : BLUE, 1);
      hits.push({ x: x, y: y, p: p });
    });
    hitList(c, hits);
  }

  function drawMystery() {
    var c = $('mystery-canvas'), f = frame2d(c, H_HI, H_LO, N_LO, N_HI, '¹H (ppm)', '¹⁵N (ppm)', true), hits = [];
    var s = P.unfoldedShare / 100;
    M.unfoldedPeaks(D).forEach(function (p) { var x = f.x(p.H), y = f.y(p.N); blob(f, x, y, 7, INK, Math.max(0.03, s)); hits.push({ x: x, y: y, h: s, p: p }); });
    M.amidePeaks(D).forEach(function (p) { var x = f.x(p.H), y = f.y(p.N); blob(f, x, y, 7, INK, Math.max(0.03, 1 - s)); hits.push({ x: x, y: y, h: 1 - s, p: p }); });
    hitList(c, hits);
  }

  // What the pointer shows on the HSQCs: the two shifts a peak stands for, and its twin where it has one.
  function drawPeakLinks(g, f, h) { ringAt(g, h.x, h.y, 13); toAxes(g, f, h.x, h.y, h.p.H.toFixed(2), h.p.N.toFixed(1)); }
  function drawHsqcLinks(g, f, h, hits) {
    drawPeakLinks(g, f, h);
    if (h.p.kind !== 'sidechain') return;
    var twin = hits.filter(function (k) { return k !== h && k.p.kind === 'sidechain' && k.p.n === h.p.n; })[0];
    if (twin) { dots(g, h.x, h.y, twin.x, twin.y); ringAt(g, twin.x, twin.y, 13, true); }
  }
  function sayHsqc(h) {
    var out = $('hsqc-hover');
    if (!h) { out.textContent = 'Point at a peak, or tap it, to see whose it is.'; return; }
    var name = h.p.aa + h.p.n, shifts = '¹H ' + h.p.H.toFixed(2) + ' ppm, ¹⁵N ' + h.p.N.toFixed(1) + ' ppm';
    out.textContent = h.p.kind === 'sidechain'
      ? name + ' side chain NH₂: ' + shifts + '. Two protons on one nitrogen: two peaks at the same ¹⁵N shift, joined by the dotted line.'
      : name + ': ' + shifts + '. One peak, one N–H bond: the dotted lines run to the proton’s shift (at the bottom) and to the shift of the nitrogen it is bonded to (at the side).';
  }
  /** On the mystery sample the same N–H's peak in the other form, folded or unfolded, is linked too. */
  function drawMysteryLinks(g, f, h, hits) {
    drawPeakLinks(g, f, h);
    var other = hits.filter(function (k) { return k !== h && k.p.n === h.p.n && k.p.kind !== h.p.kind; })[0];
    if (other) { dots(g, h.x, h.y, other.x, other.y); ringAt(g, other.x, other.y, 13, true); }
  }

  // ---- 6: the D2O shake -----------------------------------------------------------------------------

  function timeLabel(sec) {
    if (sec < 3600) return Math.round(sec / 60) + ' minutes';
    if (sec < 86400) return Math.round(sec / 3600) + (sec === 3600 ? ' hour' : ' hours');
    var d = Math.round(sec / 86400); return d === 7 ? '1 week' : d === 14 ? '2 weeks' : d === 28 ? '4 weeks' : d + (d === 1 ? ' day' : ' days');
  }
  var HX_COLOURS = [RED, ORANGE, BLUE];

  function drawHx() {
    var c = $('hx-canvas'), f = frame2d(c, H_HI, H_LO, N_LO, N_HI, '¹H (ppm)', '¹⁵N (ppm)', true), hits = [];
    var t = M.HX_TIMES[state.hxTime], left = 0;
    M.amidePeaks(D).forEach(function (p) {
      var h = M.hxHeight(D, p.n, t), x = f.x(p.H), y = f.y(p.N);
      if (h > 0.2) left++;
      blob(f, x, y, 7, INK, Math.max(0.02, h));
      var k = P.hx.indexOf(p.n);
      if (k >= 0) { f.g.strokeStyle = HX_COLOURS[k]; f.g.lineWidth = 3; f.g.beginPath(); f.g.ellipse(x, y, 14, 16, 0, 0, 2 * Math.PI); f.g.stroke(); }
      hits.push({ x: x, y: y, h: h, p: p });
    });
    hitList(c, hits);
    $('hx-left').textContent = left + ' of 72 peaks are still above a fifth of their first height.';
    drawHxPlot();
  }

  function drawHxPlot() {
    var c = $('hx-plot'), g = c.getContext('2d'), L = 80, R = c.width - 20, T = 16, B = c.height - 60;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = RULE; g.strokeRect(L, T, R - L, B - T);
    var t0 = Math.log10(300), t1 = Math.log10(30 * 86400);
    var sx = function (s) { return L + (R - L) * (Math.log10(s) - t0) / (t1 - t0); }, sy = function (h) { return B - (B - T) * h; };
    g.fillStyle = SOFT; g.font = '20px system-ui, sans-serif'; g.textAlign = 'center';
    [[600, '10 min'], [3600, '1 h'], [6 * 3600, '6 h'], [86400, '1 day'], [7 * 86400, '1 week'], [28 * 86400, '4 weeks']].forEach(function (m) { var x = sx(m[0]); g.beginPath(); g.moveTo(x, B); g.lineTo(x, B + 6); g.stroke(); g.fillText(m[1], x, B + 28); });
    g.textAlign = 'right';
    [0, 0.5, 1].forEach(function (h) { g.fillText(h.toFixed(1), L - 10, sy(h) + 6); });
    g.strokeStyle = '#e3e8e5'; g.beginPath(); g.moveTo(L, sy(0.5)); g.lineTo(R, sy(0.5)); g.stroke();
    state.hxReadings.forEach(function (r) {
      var k = P.hx.indexOf(r.n); if (k < 0) return;
      g.fillStyle = HX_COLOURS[k]; g.beginPath(); g.arc(sx(r.t), sy(r.h), 7, 0, 2 * Math.PI); g.fill();
    });
  }

  function buildHxTable() {
    var sel = $('hx-time'); sel.textContent = '';
    M.HX_TIMES.forEach(function (t, i) { sel.appendChild(el('option', { value: String(i) }, timeLabel(t) + ' after it went in')); });
    sel.value = String(state.hxTime);
    var tb = $('hx-table').querySelector('tbody'); tb.textContent = '';
    P.hx.forEach(function (n, k) {
      var r = D.residues[n - 1], tr = el('tr');
      var th = el('th', { scope: 'row' }); var dot = el('span', { 'class': 'hx-dot', style: 'background:' + HX_COLOURS[k] }); th.appendChild(dot); th.appendChild(document.createTextNode(' ' + r.aa + n + ' (¹H ' + r.shifts.H.toFixed(2) + ', ¹⁵N ' + r.shifts.N.toFixed(1) + ')'));
      tr.appendChild(th);
      var td = el('td'), inp = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input', id: 'q-hl-' + k }); td.appendChild(inp); td.appendChild(el('span', { 'class': 'msg', id: 'q-hl-' + k + '-msg' }));
      tr.appendChild(td);
      var td2 = el('td'), s2 = el('select', { id: 'q-hb-' + k });
      [['', 'Choose'], ['yes', 'Yes'], ['no', 'No']].forEach(function (o) { s2.appendChild(el('option', { value: o[0] }, o[1])); });
      td2.appendChild(s2); td2.appendChild(el('span', { 'class': 'msg', id: 'q-hb-' + k + '-msg' }));
      tr.appendChild(td2);
      tb.appendChild(tr);
    });
  }

  // ---- 7: the sequential walk -----------------------------------------------------------------------

  var LETTERS = 'ABCDEFG';
  function walkStrips() { return P.walkOrder.map(function (k) { return M.hncacbStrip(D, P.walkStart + k); }); }

  function drawWalk() {
    var c = $('walk-canvas'), g = c.getContext('2d'), strips = walkStrips(), solved = M.checkWalk(P.walkStart, walkNumbers()).ok, hits = [];
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    var L = 90, T = 40, B = c.height - 70, w = (c.width - L - 20) / 7, lo = 10, hi = 72;
    var sy = function (ppm) { return T + (B - T) * (ppm - lo) / (hi - lo); };
    c._frame = { g: g, y: sy, L: L, R: c.width - 20, T: T, B: B };
    clearLayer(c);
    g.fillStyle = SOFT; g.font = '20px system-ui, sans-serif'; g.textAlign = 'right';
    for (var v = 10; v <= 70; v += 10) { g.fillText(String(v), L - 12, sy(v) + 6); g.strokeStyle = '#eef1ef'; g.beginPath(); g.moveTo(L, sy(v)); g.lineTo(c.width - 20, sy(v)); g.stroke(); }
    g.save(); g.translate(24, (T + B) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('¹³C (ppm)', 0, 0); g.restore();
    strips.forEach(function (s, i) {
      var x0 = L + i * w + 8, x1 = L + (i + 1) * w - 8, mid = (x0 + x1) / 2;
      g.strokeStyle = RULE; g.strokeRect(x0, T, x1 - x0, B - T);
      g.fillStyle = INK; g.textAlign = 'center'; g.font = 'bold 24px system-ui, sans-serif';
      g.fillText('Strip ' + LETTERS[i], mid, T - 12);
      g.font = '18px system-ui, sans-serif'; g.fillStyle = SOFT;
      g.fillText('¹H ' + s.H.toFixed(2) + ' · ¹⁵N ' + s.N.toFixed(1), mid, B + 26);
      if (solved) { g.fillStyle = BLUE; g.font = 'bold 20px system-ui, sans-serif'; g.fillText(D.residues[s.n - 1].aa + s.n, mid, B + 52); }
      s.peaks.forEach(function (p) {
        var y = sy(p.ppm), wd = (x1 - x0) * 0.32;
        g.globalAlpha = p.strong ? 1 : 0.35;
        g.fillStyle = p.sign > 0 ? INK : RED;
        g.beginPath(); g.ellipse(mid, y, wd, 6, 0, 0, 2 * Math.PI); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = SOFT; g.font = '16px system-ui, sans-serif'; g.textAlign = 'left';
        g.fillText(p.ppm.toFixed(1), mid + wd + 4, y + 5); g.textAlign = 'center';
        hits.push({ x: mid, y: y, rx: wd + 8, ry: 12, wd: wd, strip: LETTERS[i], p: p });
      });
    });
    hitList(c, hits);
  }

  /** A dotted line across every strip at the shift pointed at: a ruler for matching, which marks no match. */
  function drawWalkLinks(g, f, h) {
    dots(g, f.L, h.y, f.R, h.y);
    axisTag(g, f.L - 6, h.y, h.p.ppm.toFixed(1), 'left');
    g.save(); g.strokeStyle = LINK; g.lineWidth = 3.5; g.beginPath(); g.ellipse(h.x, h.y, h.wd + 6, 12, 0, 0, 2 * Math.PI); g.stroke(); g.restore();
  }
  function sayWalk(h) {
    var out = $('walk-point'); if (!out) return;
    if (!h) { out.textContent = 'Point at a peak, or tap it: a dotted line runs across every strip at its shift.'; return; }
    var atom = h.p.atom === 'CA' ? 'Cα (up)' : 'Cβ (down)', at = h.p.ppm.toFixed(1) + ' ppm';
    var c = atom.split(' ')[0];
    out.textContent = h.p.strong
      ? 'Strip ' + h.strip + ', its own ' + atom + ', strong: ' + at + '. The strip that comes just after ' + h.strip + ', if it is one of the seven, has a weak ' + c + ' on the dotted line.'
      : 'Strip ' + h.strip + ', a weak ' + atom + ': ' + at + ', a carbon of the residue before. The strip that comes just before ' + h.strip + ', if it is one of the seven, has its strong ' + c + ' on the dotted line.';
  }

  function walkNumbers() { return state.walk.map(function (letter) { var i = LETTERS.indexOf(letter); return i < 0 ? '' : P.walkStart + P.walkOrder[i]; }); }

  function buildWalk() {
    var box = $('walk-order'); box.textContent = '';
    box.appendChild(el('span', { 'class': 'soft' }, 'In order, first to last:'));
    for (var i = 0; i < 7; i++) {
      (function (i) {
        var s = el('select', { 'aria-label': 'Strip number ' + (i + 1) + ' in order' });
        s.appendChild(el('option', { value: '' }, '–'));
        LETTERS.split('').forEach(function (L) { s.appendChild(el('option', { value: L }, L)); });
        s.value = state.walk[i] || '';
        s.addEventListener('change', function () { state.walk[i] = s.value; saveState(); showWalkCheck(); drawWalk(); });
        box.appendChild(s);
      })(i);
    }
  }

  function showWalkCheck() {
    var v = M.checkWalk(P.walkStart, walkNumbers());
    var m = $('walk-msg'); m.textContent = v.text; m.setAttribute('data-kind', v.kind);
    $('walk-count').textContent = v.ok ? 'Seven residues assigned: residues ' + P.walkStart + ' to ' + (P.walkStart + 6) + '. Sixty-nine to go, for the backbone alone; the side chains come after.' : '';
  }

  // ---- The structure (3Dmol.js) -----------------------------------------------------------------------

  var viewer = null;
  function showStructure() {
    if (!window.$3Dmol || viewer) return;
    viewer = window.$3Dmol.createViewer($('viewer'), { backgroundColor: 'white' });
    fetch('https://files.rcsb.org/download/1D3Z.pdb').then(function (r) { return r.text(); }).then(function (text) {
      viewer.addModel(text, 'pdb', { frames: false });
      viewer.setStyle({ model: 0 }, {});
      viewer.setStyle({ model: 0, }, { cartoon: { color: '#c9d6d1' } });
      P.hx.forEach(function (n, k) {
        viewer.setStyle({ model: 0, resi: n }, { cartoon: { color: HX_COLOURS[k] }, stick: { color: HX_COLOURS[k], radius: 0.2 } });
      });
      viewer.zoomTo(); viewer.render();
    }).catch(function () { $('viewer-msg').textContent = 'The structure did not load (it needs an internet connection).'; });
  }

  // ---- Questions -----------------------------------------------------------------------------------

  var WHY = [
    ['', 'Choose'],
    ['nh', 'They have no amide N–H: the first residue’s nitrogen is an NH₃⁺ that exchanges too fast to see, and proline’s nitrogen carries no hydrogen'],
    ['flex', 'They move too much, so their peaks broaden away'],
    ['overlap', 'Their peaks hide under other peaks'],
    ['label', 'They were not labelled with ¹⁵N']
  ];

  var QUESTIONS = [
    { id: 'q-tau', check: function (v) { return M.checkTau(P.mass, v); } },
    { id: 'q-ratio', check: function (v) { return M.checkRatio(P.mass, v); } },
    { id: 'q-aa', check: function (v) { return M.checkAminoAcid(D, P.tocsy, v); } },
    { id: 'q-crowd', check: function (v) { return M.checkCrowding(D, P.tocsy, v); } },
    { id: 'q-why', check: function (v) { return v ? (v === 'nh' ? { ok: true, kind: 'good', text: 'Accepted.' } : { ok: false, kind: 'off', text: 'Not this: look at what an HSQC peak stands for.' }) : { ok: false, kind: 'empty', text: '' }; } },
    { id: 'q-bb', check: function (v) { return M.checkCount(P.sequence, 'backbone', v); } },
    { id: 'q-sc', check: function (v) { return M.checkCount(P.sequence, 'side', v); } },
    { id: 'q-total', check: function (v) { return M.checkCount(P.sequence, 'total', v); } },
    { id: 'q-share', check: function (v) { return M.checkShare(P.unfoldedShare, v); } }
  ];
  [0, 1, 2].forEach(function (k) {
    QUESTIONS.push({ id: 'q-hl-' + k, check: function (v) { return M.checkHalfLife(D, P.hx[k], v); } });
    QUESTIONS.push({ id: 'q-hb-' + k, check: function (v) { return M.checkHbond(D, P.hx[k], v); } });
  });

  function showCheck(q) {
    var input = $(q.id), v = q.check(input.value), m = $(q.id + '-msg');
    if (!m) return v;
    m.textContent = v.kind === 'empty' ? '' : v.text;
    m.setAttribute('data-kind', v.kind);
    input.setAttribute('aria-invalid', v.kind === 'off' ? 'true' : 'false');
    return v;
  }

  function bindQuestions() {
    var why = $('q-why'); why.textContent = '';
    WHY.forEach(function (o) { why.appendChild(el('option', { value: o[0] }, o[1])); });
    QUESTIONS.forEach(function (q) {
      var input = $(q.id);
      if (!input) return;
      if (state.answers[q.id] !== undefined) input.value = state.answers[q.id];
      var ev = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(ev, function () { state.answers[q.id] = input.value; saveState(); showCheck(q); showFooter(); });
      showCheck(q);
    });
    ['r-hard', 'r-labels', 'r-hx', 'r-face', 'r-agree', 'r-why', 'student-name'].forEach(function (id) {
      var t = $(id);
      if (state.answers[id] !== undefined) t.value = state.answers[id];
      t.addEventListener('input', function () { state.answers[id] = t.value; saveState(); });
    });
  }

  function showFooter() {
    var good = QUESTIONS.filter(function (q) { return q.check($(q.id) ? $(q.id).value : '').ok; }).length + (M.checkWalk(P.walkStart, walkNumbers()).ok ? 1 : 0);
    var recs = Object.keys(state.recorded).length;
    if (PART === 2 && window.UbiqLab2) { $('print-checks').textContent = window.UbiqLab2.footer(); return; }
    $('print-checks').textContent = 'Code ' + state.code + '. The page accepted ' + good + ' of ' + (QUESTIONS.length + 1) + ' answers; spectra recorded: ' + ['1d', 'tocsy', 'noesy', 'hsqc', 'mystery', 'hx', 'hncacb'].filter(function (k) { return state.recorded[k]; }).length + ' of 7.';
  }

  // ---- Showing the parts ---------------------------------------------------------------------------

  function showFigures() {
    document.querySelectorAll('[data-needs]').forEach(function (w) { w.hidden = !!state.recorded[w.getAttribute('data-needs')]; });
    document.querySelectorAll('[data-shows]').forEach(function (f) { f.hidden = !state.recorded[f.getAttribute('data-shows')]; });
    if (state.recorded['1d']) drawOneD();
    if (state.recorded.tocsy) drawTocsy();
    if (state.recorded.noesy) drawNoesy();
    if (state.recorded.hsqc) drawHsqc();
    if (state.recorded.mystery) drawMystery();
    if (state.recorded.hx) { drawHx(); showStructure(); }
    if (state.recorded.hncacb) drawWalk();
    if (window.UbiqLab2) window.UbiqLab2.showFigures();
    showFooter();
  }

  function bind() {
    $('unknown-code').textContent = state.code;
    $('own-mass').textContent = String(P.mass);
    $('own-seq').textContent = P.sequence.replace(/(.{10})/g, '$1 ').trim();
    $('mass-slider').value = String(state.mass || 8.6);
    $('mass-slider').addEventListener('input', function () { state.mass = +$('mass-slider').value; saveState(); drawOneD(); });
    document.querySelectorAll('.view-button').forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
    pointable($('tocsy-canvas'), drawTocsyLinks, sayTocsy);
    pointable($('noesy-canvas'), drawNoesyLinks, sayNoesy);
    pointable($('hsqc-canvas'), drawHsqcLinks, sayHsqc);
    pointable($('mystery-canvas'), drawMysteryLinks);
    pointable($('hx-canvas'), drawPeakLinks);
    pointable($('walk-canvas'), drawWalkLinks, sayWalk);
    $('mystery-canvas').addEventListener('click', function (ev) {
      var h = hitAt($('mystery-canvas'), ev);
      $('mystery-read').textContent = h ? 'This peak’s height: ' + h.h.toFixed(2) + ' (¹H ' + h.p.H.toFixed(2) + ', ¹⁵N ' + h.p.N.toFixed(1) + ')' : 'Click a peak to read its height.';
    });
    $('hx-time').addEventListener('change', function () { state.hxTime = +$('hx-time').value; saveState(); drawHx(); });
    $('hx-canvas').addEventListener('click', function (ev) {
      var h = hitAt($('hx-canvas'), ev);
      if (!h) { $('hx-read').textContent = 'Click a peak to read its height.'; return; }
      $('hx-read').textContent = h.p.aa + h.p.n + ': height ' + h.h.toFixed(2) + ' at ' + timeLabel(M.HX_TIMES[state.hxTime]) + '.';
      if (P.hx.indexOf(h.p.n) >= 0) {
        var t = M.HX_TIMES[state.hxTime];
        state.hxReadings = state.hxReadings.filter(function (r) { return !(r.n === h.p.n && r.t === t); });
        state.hxReadings.push({ n: h.p.n, t: t, h: Math.round(h.h * 100) / 100 });
        saveState(); drawHxPlot();
      }
    });
    $('print-report').addEventListener('click', function () {
      $('print-name').textContent = $('student-name').value || '';
      $('print-date').textContent = new Date().toLocaleDateString();
      showFooter();
      window.print();
    });
    $('reset').addEventListener('click', function () { $('reset-confirm').hidden = false; });
    $('reset-no').addEventListener('click', function () { $('reset-confirm').hidden = true; });
    $('reset-yes').addEventListener('click', function () {
      var code = state.code;
      state = blankState(code);
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not kept */ }
      window.location.reload();
    });
  }

  window.UbiqLab = {
    onUnityEvent: onUnityEvent,
    isMock: params.has('mock'),
    attachUnity: function (instance) { unity = instance; configureRoom(); },
    unityProgress: function (p) { $('progress-fill').style.width = Math.round(p * 100) + '%'; },
    unityBanner: function (message, type) { if (type === 'error') note(message, 'blocked'); },
    unityFailed: function (error) { $('stage-status').textContent = 'The hall did not load (' + error + '). Every step can be done with the buttons beside it.'; },
    state: function () { return state; },
    picks: function () { return P; },
    act: act,
    part: PART,
    // for app2.js (Session 2): the page's own helpers
    core: { D: D, M: M, $: $, el: el, note: note, saveState: saveState, sendRoom: sendRoom, showRoom: showRoom, setView: setView, frame2d: frame2d, blob: blob,
      hitList: hitList, hitAt: hitAt, pointable: pointable, dots: dots, ringAt: ringAt, toAxes: toAxes,
      showRoutine: function () { showRoutine(); }, showFigures: function () { showFigures(); }, stepItem: stepItem, showFooter: function () { showFooter(); } }
  };

  if (window.UbiqLab.isMock) $('stage-status').textContent = 'The 3D hall is not loaded on this page; use the buttons beside it.';

  // the page shows one session: number its parts in order
  document.body.setAttribute('data-part', String(PART));
  var partNo = 0;
  document.querySelectorAll('.part').forEach(function (sec) {
    var part = sec.getAttribute('data-part');
    if (part && Number(part) !== PART) return;
    partNo += 1;
    var stepNo = sec.querySelector('h2 .step');
    if (stepNo) stepNo.textContent = String(partNo);
  });

  bind();
  buildTypical();
  buildHxTable();
  buildWalk();
  bindQuestions();
  showWalkCheck();
  showRoutine();
  showViews();
  showFigures();
})();
