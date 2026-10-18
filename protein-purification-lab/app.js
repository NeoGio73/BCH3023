/*
 * Purifying a Glowing Protein: page logic for both parts (Part 2 when opened with ?part=2).
 * Talks to the 3D bench (a Unity build in the canvas), keeps the student's work, shows the steps
 * with a light for each, the bench's warnings (before a step that would go wrong) and its notes
 * on mistakes (after one has happened), and the tables: Part 1's tubes under the lamp; Part 2's
 * Bradford readings with the standard curve, the scans and the fluorescence readings, each number
 * checked as it is typed (readings against what the instruments showed, sums against the
 * student's own line and readings).
 *
 * The page does not know what the unknown is: the bench sends what is in each tube and judges
 * what the student says they see. Which protein it is, is never checked here.
 */
(function () {
  'use strict';

  var M = window.ProteinLabModel;
  var STORE_KEY = 'protein-lab:v1';
  var params = new URLSearchParams(window.location.search);
  var PART = params.get('part') === '2' ? 2 : 1;

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  // ---- Saved work ----------------------------------------------------------------------------

  function blankState(code) {
    return {
      v: 1,
      code: code || M.randomCode(),
      name: '',
      bench: null,          // the bench as the 3D room last reported it
      pipette: 1000,
      rpm: '', minutes: '',
      glow: {},             // tube -> what the student says they see
      verdict: {},          // tube -> 'ok' | 'no', from the bench
      pool: {},             // tube -> true
      answers: {},
      view: 'cells',
      // Part 2
      view2: 'meters',
      dilSel: {},           // sample -> the dilution chosen in its box
      cuvette: 'b', quartzSample: 'pool', ex: '370', em: '',
      readA: {},            // cuvette -> the A595 typed
      conc: {},             // sample -> mg/mL from the curve, typed
      own: {},              // sample -> mg/mL in the sample, typed
      flRead: {},           // sample -> the fluorimeter's reading, typed
      fu: {},               // sample -> fluorescence per mL, typed
      peaks: { ex: '', em: '' },
      scans: [],            // the scans the fluorimeter sent, the latest last
      // the gel
      wellPlan: {},         // well -> what the student chose to load
      volts: '200',
      gel: null,            // the imager's latest picture
      ladderMm: {}, ladderLog: {},
      proteinBand: { lane: '', mm: '', log: '', kda: '' },
      purif: {},            // sample -> { mg, fu, spec, yield, fold } as typed
      ident: { protein: '', tag: '', why: '' }
    };
  }

  function loadState() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (saved && saved.v === 1 && M.validCode(saved.code)) {
        var fresh = blankState(saved.code);
        Object.keys(fresh).forEach(function (k) { if (saved[k] === undefined) saved[k] = fresh[k]; });
        return saved;
      }
    } catch (e) { /* nothing saved, or saved by an older page */ }
    return null;
  }

  var saveTimer = null;
  function saveState() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private window: work is not kept */ }
    }, 250);
  }
  window.addEventListener('pagehide', function () {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not kept */ }
  });

  var state = loadState();
  var requested = M.normalizeCode(params.get('code') || '');
  if (!state || (M.validCode(requested) && requested !== state.code)) state = blankState(M.validCode(requested) ? requested : null);
  saveState();

  var unity = null, configured = false, unityAwake = false;
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var warningsFirst = params.get('warnings') !== 'after';      // the instructor's switch: ?warnings=after
  var tick = { clock: 0, fast: false, spinning: false, spinLeft: 0, columnMl: 0, running: false, heat: 0 };
  var extra = { heat: 0, rcf: 0, slurryMixed: false, part1Done: null };

  function sendBench(method, value) {
    if (!unity || !unityAwake) return;
    try { unity.SendMessage('Lab', method, value == null ? '' : String(value)); } catch (e) { console.error(e); }
  }
  function act(steps) {
    clearNote();
    if (!configured) { note('The bench is still setting up.', 'blocked'); return; }
    sendBench('Act', steps);
  }

  function configureBench() {
    if (!unity || !unityAwake) return;
    var b = state.bench;
    configured = false;
    sendBench('Configure', JSON.stringify({
      code: state.code,
      hasState: !!b,
      state: b || undefined,
      calm: calm,
      intro: !b && params.get('intro') !== '0' && PART === 1,
      view: currentView(),
      warnings: warningsFirst,
      part: PART
    }));
  }

  function currentView() { return PART === 2 ? (state.view2 || 'meters') : (state.view || 'cells'); }
  function setView(v) {
    if (currentView() === v) return;
    if (PART === 2) state.view2 = v; else state.view = v;
    showViews();
    sendBench('SetView', v);
    saveState();
  }

  // ---- Notes beside the room -------------------------------------------------------------------

  function note(text, kind) {
    var n = $('stage-note');
    n.textContent = text || '';
    n.setAttribute('data-kind', kind || '');
  }
  function clearNote() { if ($('stage-note').getAttribute('data-kind') !== 'hold') note(''); }

  /**
   * The bench's warning or note, with its buttons: [{ text, primary, onClick }]. A warning holds
   * the step back until the student chooses; a note on a mistake says what it did.
   */
  function alertBox(kind, text, buttons) {
    var box = $('alert-box');
    // a note on a mistake stays until it is answered: a notice arriving after it does not hide it
    if (kind === 'notice' && !box.hidden && box.getAttribute('data-kind') === 'mistake') return;
    box.hidden = false;
    box.setAttribute('data-kind', kind);
    $('alert-text').textContent = text;
    var row = $('alert-buttons');
    row.textContent = '';
    buttons.forEach(function (b) {
      var btn = el('button', { type: 'button', 'class': b.primary ? 'primary-button' : 'quiet-button' }, b.text);
      btn.addEventListener('click', function () { box.hidden = true; if (b.onClick) b.onClick(); });
      row.appendChild(btn);
    });
    box.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  }
  function closeAlert() { $('alert-box').hidden = true; }

  // ---- From the bench ----------------------------------------------------------------------------

  var ITEM_NAMES = {
    lysis: 'the lysis buffer', wash: 'the wash buffer', elution: 'the elution buffer', water: 'the wash bottle of water',
    lysozyme: 'the lysozyme', cells: 'the cells (50 mL tube)', spintube: 'the spin tube', balance: 'the balance tube',
    cleared: 'the tube for the cleared lysate', centrifuge: 'the centrifuge (click: lid)', start: 'the centrifuge’s start key',
    bucket: 'a bucket of the rotor', column: 'the column', outlet: 'the column’s outlet (click: open or close)',
    tube: 'a collection tube (click: put it under the column)', slurry: 'the Ni-NTA resin (click once to take, again to swirl)',
    lamp: 'the lamp (click: UV, blue, off)', sonicator: 'the sonicator (click: one burst)',
    bradford: 'the Bradford dye (click, then click each cuvette for 1 mL)', dilbuffer: 'the dilution buffer (1 mL a press)',
    bsa: 'a BSA standard (click, then click its cuvette)', sample: 'one of your samples (click, then click where it goes)',
    dilution: 'a sample\u2019s dilution (click, then click where it goes)', etube: 'an elution fraction (click, then click the pool tube)',
    cuvette: 'a Bradford cuvette', spec: 'the spectrophotometer (click with a cuvette in hand to read it)', zero: 'the Zero key',
    quartz: 'the quartz cuvette', fluor: 'the fluorimeter (click with the quartz cuvette in hand)', fluorread: 'the Read key'
  };
  var HELD_NAMES = {
    lysis: 'a pipetful of lysis buffer', wash: 'a pipetful of wash buffer', elution: 'a pipetful of elution buffer',
    water: 'the wash bottle', lysozyme: 'a pipetful of lysozyme', cells: 'the tube of lysate', spin: 'the spin tube',
    balance: 'the balance tube', cleared: 'the cleared lysate', slurry: 'the resin bottle',
    dye: 'the Bradford dye dispenser', buffer: 'the dilution buffer', quartz: 'the quartz cuvette'
  };
  function heldName(h) {
    if (HELD_NAMES[h]) return HELD_NAMES[h];
    if (/^s[1-7]$/.test(h)) return 'a pipetful of standard S' + h[1];
    if (/^e[1-4]$/.test(h)) return 'a pipetful of elution ' + h[1];
    if (/^cuvette \d+$/.test(h)) return 'cuvette ' + M.CUVETTES[Number(h.slice(8))].name;
    if (/-n$/.test(h)) return 'a pipetful of the ' + sourceName(h, 1);
    if (/-d$/.test(h)) return 'a pipetful of the ' + sourceName(h, 1) + '\u2019s dilution';
    return h;
  }

  function onUnityEvent(json) {
    var msg;
    try { msg = JSON.parse(json); } catch (e) { return; }
    switch (msg.type) {
      case 'ready':
        unityAwake = true;
        configureBench();
        break;
      case 'state':
        if (msg.why === 'configured' && !configured) {
          configured = true;
          $('stage-cover').hidden = true;
          sendBench('Act', 'pipette ' + state.pipette);
        }
        state.bench = msg.state;
        extra.heat = msg.heat; extra.rcf = msg.rcf; extra.slurryMixed = msg.slurryMixed; extra.part1Done = msg.part1Done; extra.gelInfo = msg.gelInfo;
        showBench();
        saveState();
        break;
      case 'tick':
        tick = msg;
        showClock();
        break;
      case 'warn':
        alertBox('warn', M.warnText(msg.code, msg.detail), [
          { text: 'Go back', primary: true },
          { text: 'Do it anyway', onClick: function () { sendBench('Act', '!' + msg.step); } }
        ]);
        break;
      case 'blocked':
        note(M.blockText(msg.reason), 'blocked');
        break;
      case 'mistake':
        var m = M.mistake(msg.code);
        var buttons = [{ text: 'Carry on', primary: true }];
        if (m.redo) buttons.push({ text: M.REDO_TEXT[m.redo], onClick: function () { act('redo ' + m.redo); } });
        alertBox('mistake', m.text, buttons);
        break;
      case 'notice':
        if (msg.code === 'running-dry')
          alertBox('notice', M.NOTICES['running-dry'], [{ text: 'Close the outlet', primary: true, onClick: function () { act('outlet close'); } }, { text: 'Leave it running' }]);
        else note(M.NOTICES[msg.code] || '', 'info');
        break;
      case 'checked':
        receiveChecked(msg);
        break;
      case 'view':
        if (PART === 2) state.view2 = msg.view; else state.view = msg.view;
        showViews();
        saveState();
        break;
      case 'gel':
        state.gel = msg;
        showBench();
        saveState();
        break;
      case 'scan':
        state.scans.push({ kind: msg.kind, fixed: msg.fixed, from: msg.from, step: msg.step, over: msg.over, source: msg.source, factor: msg.factor, values: msg.values });
        if (state.scans.length > 8) state.scans.shift();
        showBench();
        saveState();
        break;
      case 'hover':
        if (msg.item) note(ITEM_NAMES[msg.item] ? 'Click ' + ITEM_NAMES[msg.item] : '', 'hover');
        else if ($('stage-note').getAttribute('data-kind') === 'hover') note('');
        break;
    }
  }

  // ---- The steps' lights ------------------------------------------------------------------------

  function tubeMl(b, key) { var i = M.TUBES.map(function (t) { return t.key; }).indexOf(key); return b && b.tubes && b.tubes[i] ? b.tubes[i].ml : 0; }
  function sampled(b, key) { var i = M.SAMPLES.map(function (t) { return t.key; }).indexOf(key); return !!(b && b.sampled && b.sampled[i]); }
  function inRotor(b, what) { return b && b.rotor ? b.rotor.indexOf(what) : -1; }

  /** For each step: done or not, and a line saying where it stands. */
  function progress(b) {
    var p = {};
    if (!b) return p;
    var buffer = Math.max(0, b.cells.ml - 0.5 - (b.lysozymeMg > 0 ? 0.1 : 0));
    var resus = b.resuspended || b.spin.ml > 0 || b.decanted;
    var moved = b.spin.ml > 0 || b.decanted;
    p.buffer = { done: resus || b.cells.ml >= 4.3, text: moved ? 'Done' : b.cells.ml > 0.55 || resus ? 'About ' + M.ml(Math.max(buffer, 0)) + ' of buffer in the tube' : '' };
    p.resuspended = { done: resus, text: resus ? 'No lumps left' : '' };
    p['sample-cells'] = { done: sampled(b, 'cells'), text: sampled(b, 'cells') ? 'Kept' : '' };
    var conc = b.lysozymeMg / Math.max(0.1, b.cells.ml || 4.5);
    p.lysozyme = { done: b.lysozymeMg > 0, text: b.lysozymeMg > 0 ? (Math.round(b.lysozymeMg * 100) / 100) + ' mg added' : '' };
    var since = b.lysozymeAt >= 0 ? b.clock - b.lysozymeAt : -1;
    p.waited = { done: since >= 30 || b.bursts > 0, text: since < 0 ? '' : since >= 30 ? '30 minutes done' : M.clockText(30 - since) + ' to go' };
    var heat = Math.max(0, tick.heat || extra.heat || 0);
    // as the sonicator's screen reads it: about 4 degrees on ice, plus what the bursts have added
    p.sonicated = { done: b.bursts >= 6, text: b.bursts > 0 ? b.bursts + (b.bursts === 1 ? ' burst' : ' bursts') + '; the sample is at about ' + (4 + heat).toFixed(1) + ' °C' : '' };
    p['sample-lysate'] = { done: sampled(b, 'lysate'), text: sampled(b, 'lysate') ? 'Kept' : '' };
    p.transferred = { done: b.spin.ml > 0 || b.decanted, text: b.spin.ml > 0 && !b.decanted ? 'The spin tube holds ' + M.ml(b.spin.ml) : '' };
    var balanced = b.spin.ml > 0 && Math.abs(b.balanceMl - b.spin.ml) <= 0.3;
    p.balanced = { done: balanced || b.spun, text: b.balanceMl > 0 ? 'Balance tube ' + M.ml(b.balanceMl) + (b.spin.ml > 0 && !b.decanted ? ', lysate ' + M.ml(b.spin.ml) : '') : '' };
    var a = inRotor(b, 'spin'), c = inRotor(b, 'balance');
    p['loaded-rotor'] = { done: (a >= 0 && c >= 0) || b.spun, text: a >= 0 || c >= 0 ? 'Lysate in bucket ' + (a >= 0 ? a + 1 : '–') + ', balance in bucket ' + (c >= 0 ? c + 1 : '–') : '' };
    p.spun = { done: b.spun, text: b.spinning ? 'Spinning: ' + M.clockText(tick.spinLeft || 0) + ' left' : b.spun ? 'Spun' : '' };
    p.unloaded = { done: b.spun && a < 0 && c < 0, text: '' };
    p.decanted = { done: b.decanted, text: b.decanted ? M.ml(b.cleared.ml + (b.loadedFp > 0 ? 4 : 0) * 0) + ' of cleared lysate' : '' };
    p['sample-cleared'] = { done: sampled(b, 'cleared') && sampled(b, 'pellet'), text: [sampled(b, 'cleared') ? 'cleared lysate kept' : '', sampled(b, 'pellet') ? 'pellet kept' : ''].filter(Boolean).join(', ') };
    p.resin = { done: b.resinMl > 0, text: b.resinMl > 0 ? 'Resin in the column' : extra.slurryMixed ? 'Swirled: pour it in before it settles again' : '' };
    var waste = tubeMl(b, 'waste');
    p.equilibrated = { done: b.loadedFp > 0 || waste >= 2.3, text: b.resinMl > 0 ? (waste > 0 ? M.ml(waste) + ' run through to waste; ' : '') + 'outlet ' + (b.outletOpen ? 'open' : 'closed') : '' };
    p.loaded = { done: b.loadedFp > 0, text: b.loadedFp > 0 ? 'Lysate on the column' : '' };
    p.washed = { done: b.washMl >= 7.9, text: b.washMl > 0 ? M.ml(b.washMl) + ' of wash buffer added' : '' };
    var eluted = ['e1', 'e2', 'e3', 'e4'].filter(function (k) { return tubeMl(b, k) >= 0.4; }).length;
    p.eluted = { done: eluted === 4, text: eluted > 0 ? eluted + ' of 4 fractions collected' : '' };
    return p;
  }

  function showSteps() {
    var p = PART === 2 ? progress2(state.bench) : progress(state.bench);
    var nextGiven = false;
    document.querySelectorAll('[data-part="' + PART + '"] .routine-step').forEach(function (li) {
      var key = li.getAttribute('data-done');
      var info = p[key] || { done: false, text: '' };
      var st = $('state-' + key);
      if (st) st.textContent = info.text || '';
      if (info.done) li.setAttribute('data-state', 'done');
      else if (!nextGiven) { li.setAttribute('data-state', 'next'); nextGiven = true; }
      else li.removeAttribute('data-state');
    });
  }

  function showBench() {
    var b = state.bench;
    showSteps();
    showClock();
    $('held-note').textContent = b && b.held ? 'In your hand: ' + heldName(b.held) + (/lysis|wash|elution|lysozyme|^s[1-7]$|^e[1-4]$|-[nd]$/.test(b.held) ? ' (' + state.pipette + ' µL)' : '') + '. Click where it goes, or on an empty spot to put it back.' : '';
    showFractions();
    showSamples();
    showMistakes();
    showPart2();
    showGel();
    showPurif();
  }

  function showClock() {
    var b = state.bench;
    var clock = tick.clock || (b ? b.clock : 0);
    $('clock').textContent = M.clockText(clock);
    var bits = [];
    if (tick.spinning) bits.push('centrifuge: ' + M.clockText(tick.spinLeft) + ' left');
    if (tick.running) bits.push('column running');
    if (b && b.lysozymeAt >= 0 && b.bursts === 0 && clock - b.lysozymeAt < 30) bits.push('lysozyme: ' + M.clockText(30 - (clock - b.lysozymeAt)) + ' to go');
    $('clock-status').textContent = bits.join(' · ');
    $('speed-toggle').setAttribute('aria-pressed', tick.fast ? 'true' : 'false');
  }

  function showViews() {
    document.querySelectorAll('.view-button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-view') === currentView() ? 'true' : 'false');
    });
  }

  // ---- Table 1: the tubes under the column ---------------------------------------------------------

  function buildFractions() {
    var body = $('fraction-rows');
    body.textContent = '';
    M.TUBES.forEach(function (t) {
      var tr = el('tr', { 'data-tube': t.key });
      tr.appendChild(el('th', { scope: 'row' }, t.name));
      tr.appendChild(el('td', { 'class': 'vol' }, ''));
      var td = el('td');
      var sel = el('select', { 'aria-label': 'What you see in ' + t.name });
      M.GLOWS.forEach(function (g) { var o = el('option', { value: g.key }, g.name || 'Choose'); sel.appendChild(o); });
      sel.value = state.glow[t.key] || '';
      sel.addEventListener('change', function () {
        state.glow[t.key] = sel.value;
        delete state.verdict[t.key];
        showFractions();
        saveState();
      });
      td.appendChild(sel);
      tr.appendChild(td);
      var poolTd = el('td');
      if (t.key !== 'waste') {
        var box = el('input', { type: 'checkbox', 'aria-label': 'Pool ' + t.name });
        box.checked = !!state.pool[t.key];
        box.addEventListener('change', function () { state.pool[t.key] = box.checked; saveState(); });
        poolTd.appendChild(box);
      }
      tr.appendChild(poolTd);
      var sampleTd = el('td', { 'class': 'sample-cell' });
      tr.appendChild(sampleTd);
      body.appendChild(tr);
    });
  }

  function showFractions() {
    var b = state.bench;
    document.querySelectorAll('#fraction-rows tr').forEach(function (tr) {
      var key = tr.getAttribute('data-tube');
      tr.querySelector('.vol').textContent = b ? M.ml(tubeMl(b, key)) : '';
      var sel = tr.querySelector('select');
      var v = state.verdict[key];
      if (v) sel.setAttribute('data-state', v === 'ok' ? 'ok' : 'bad'); else sel.removeAttribute('data-state');
      var cell = tr.querySelector('.sample-cell');
      cell.textContent = '';
      if (key === 'waste') return;
      if (sampled(b, key)) cell.appendChild(el('span', { 'class': 'kept' }, 'Kept'));
      else {
        var btn = el('button', { type: 'button', 'class': 'quiet-button' }, 'Keep 20 µL');
        btn.disabled = !(b && tubeMl(b, key) >= 0.02);
        btn.addEventListener('click', function () { act('sample ' + key); });
        cell.appendChild(btn);
      }
    });
  }

  var checkId = 0;
  function checkGlow() {
    var rows = [];
    M.TUBES.forEach(function (t) { if (state.glow[t.key] && tubeMl(state.bench, t.key) > 0) rows.push({ tube: t.key, glow: state.glow[t.key] }); });
    if (!rows.length) { $('glow-status').textContent = 'Record what you see in at least one tube that has something in it.'; return; }
    checkId += 1;
    sendBench('Check', JSON.stringify({ id: checkId, rows: rows }));
  }

  function receiveChecked(msg) {
    var right = 0;
    (msg.rows || []).forEach(function (r) { state.verdict[r.tube] = r.verdict; if (r.verdict === 'ok') right += 1; });
    var n = (msg.rows || []).length;
    $('glow-status').textContent = right === n ? 'All ' + n + ' agree with the bench.' : (n - right) + ' of ' + n + ' do not agree with what is in the tube: look again under both lamps.';
    showFractions();
    saveState();
  }

  // ---- Table 2: samples for the gel ------------------------------------------------------------------

  function showSamples() {
    var b = state.bench;
    var body = $('sample-rows');
    body.textContent = '';
    M.SAMPLES.forEach(function (s) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, s.name));
      tr.appendChild(el('td', null, sampled(b, s.key) ? 'Kept' : '–'));
      body.appendChild(tr);
    });
  }

  // ---- Questions, and the mistakes made ---------------------------------------------------------------

  function buildQuestions() {
    var box = $('questions');
    box.textContent = '';
    (PART === 2 ? M.QUESTIONS_2 : M.QUESTIONS).forEach(function (q, i) {
      var wrap = el('div', { 'class': 'question' });
      var id = 'answer-' + q.key;
      wrap.appendChild(el('label', { 'for': id }, (i + 1) + '. ' + q.text));
      var ta = el('textarea', { id: id, rows: '3' });
      ta.value = state.answers[q.key] || '';
      ta.addEventListener('input', function () { state.answers[q.key] = ta.value; copy.textContent = ta.value; saveState(); });
      wrap.appendChild(ta);
      var copy = el('div', { 'class': 'print-copy' }, ta.value);
      wrap.appendChild(copy);
      box.appendChild(wrap);
    });
  }

  function showMistakes() {
    var b = state.bench;
    var box = $('mistake-list');
    box.textContent = '';
    if (!b || !b.mistakes || !b.mistakes.length) return;
    box.appendChild(el('p', { 'class': 'sub-title' }, 'What the bench recorded going wrong'));
    var ul = el('ul');
    b.mistakes.forEach(function (code) { ul.appendChild(el('li', null, M.mistake(code).text)); });
    box.appendChild(ul);
    if (b.redone && b.redone.length) box.appendChild(el('p', { 'class': 'soft' }, 'Parts started again: ' + b.redone.map(function (r) { return { cells: 'from fresh cells', spin: 'the spin', column: 'a fresh column', gel: 'a fresh gel' }[r] || r; }).join(', ') + '.'));
  }


  // ---- Part 2: the samples, the Bradford assay, the fluorimeter --------------------------------------

  function cuvetteOf(b, key) { var i = M.CUVETTES.map(function (c) { return c.key; }).indexOf(key); return b && b.cuvettes ? b.cuvettes[i] : null; }
  function measuredIndex(key) { return M.MEASURED.map(function (m) { return m.key; }).indexOf(key); }
  function hasRead(c) { return !!c && c.read > -999; }
  function sampleMl(b, key) {
    if (!b) return 0;
    if (key === 'lysate') return b.spare ? b.spare.ml : 0;
    if (key === 'pool') return b.pool ? b.pool.ml : 0;
    return tubeMl(b, key);
  }
  function factorText(f) { return f > 1 ? '1:' + f : 'none'; }

  function progress2(b) {
    var p = {};
    if (!b) return p;
    var chosen = b.pooledFrom ? b.pooledFrom.split(' ').map(function (e) { return e.toUpperCase(); }).join(', ') : '';
    p.pooled = { done: b.pool && b.pool.ml > 0.01, text: b.pool && b.pool.ml > 0.01 ? M.ml(b.pool.ml) + ' pooled, from ' + chosen : (extra.part1Done === false ? 'Part 1 is not finished yet.' : '') };
    var dil = M.MEASURED.filter(function (m, i) { return b.dilution && b.dilution[i] > 1; }).map(function (m) { return m.short + ' ' + factorText(b.dilution[measuredIndex(m.key)]); });
    p.diluted = { done: dil.length > 0, text: dil.length ? 'Made: ' + dil.join(', ') : '' };
    var cs = b.cuvettes || [];
    var dyed = cs.filter(function (c) { return c.dyeMl > 0; }).length, filled = cs.filter(function (c) { return c.sampleUl > 0; }).length;
    p.dyed = { done: dyed === cs.length && cs.length > 0, text: dyed ? 'Dye in ' + dyed + ' of ' + cs.length : '' };
    p.pipetted = { done: filled === cs.length && cs.length > 0, text: filled ? 'Samples in ' + filled + ' of ' + cs.length : '' };
    var mixed = cs.filter(function (c) { return c.dyeMl > 0 && c.sampleUl > 0 && c.mixedAt >= 0; });
    var latest = mixed.reduce(function (a, c) { return Math.max(a, c.mixedAt); }, -1);
    var clock = tick.clock || b.clock;
    p.developed = { done: mixed.length > 0 && clock - latest >= 5, text: mixed.length ? (clock - latest >= 5 ? 'The last one mixed ' + M.clockText(clock - latest) + ' ago' : 'The last one needs ' + M.clockText(5 - (clock - latest)) + ' more') : '' };
    p.zeroed = { done: !!b.zeroed, text: b.zeroed ? 'Zeroed' : '' };
    var read = cs.filter(hasRead).length;
    p.read = { done: read === cs.length && cs.length > 0, text: read ? read + ' of ' + cs.length + ' read' + (b.specHolds >= 0 ? '; in it now: ' + M.CUVETTES[b.specHolds].name : '') : '' };
    var q = b.quartz || {};
    p.quartz = { done: q.bufferMl > 0 && q.sampleUl > 0, text: q.bufferMl > 0 || q.sampleUl > 0 ? (q.bufferMl > 0 ? 'Buffer' : 'No buffer') + (q.sampleUl > 0 ? ' and ' + sourceName(q.source, q.factor) : '') : '' };
    p['quartz-in'] = { done: !!b.quartzIn, text: b.quartzIn ? 'In the fluorimeter' : '' };
    var ex = lastScan('ex'), em = lastScan('em');
    p.scanned = { done: !!ex && !!em, text: 'Set to ' + b.ex + ' and ' + b.em + ' nm' + (ex || em ? '; scans: ' + state.scans.length : '') };
    var reads = (b.fluor || []).filter(function (r) { return r.counts >= 0 && !r.over; }).length;
    progressGel(b, p);
    p['fluor-read'] = { done: reads === M.MEASURED.length, text: b.fluorOver ? 'OVER: dilute more' : b.fluorShown >= 0 ? 'Reading ' + Math.round(b.fluorShown) + ' counts; ' + reads + ' of ' + M.MEASURED.length + ' samples read' : '' };
    return p;
  }

  function sourceName(source, factor) {
    var key = String(source || '').replace(/-[dn]$/, '');
    var m = M.MEASURED[measuredIndex(key)];
    return (m ? m.short : key) + (factor > 1 ? ' (' + factorText(factor) + ')' : '');
  }

  function lastScan(kind) {
    for (var i = state.scans.length - 1; i >= 0; i--) if (state.scans[i].kind === kind) return state.scans[i];
    return null;
  }


  // ---- The gel -------------------------------------------------------------------------------------------

  var CAST = ['water', 'acrylamide', 'tris88', 'tris68', 'sds', 'aps', 'temed'];
  var CAST_NAMES = { water: 'water', acrylamide: 'acrylamide', tris88: 'Tris pH 8.8', tris68: 'Tris pH 6.8', sds: 'SDS', aps: 'APS', temed: 'TEMED' };
  var FULL_RUN_VMIN = 200 * 40;

  function mixed(m) { return CAST.filter(function (k, i) { return m && m[i] > 0; }); }
  function sampleName(key) { if (key === 'ladder') return 'Ladder'; var s = M.SAMPLES.filter(function (x) { return x.key === key; })[0]; return s ? s.name : key; }

  function progressGel(b, p) {
    var g = b.gel || {}, info = extra.gelInfo || {};
    var res = mixed(g.resolving), stack = mixed(g.stacking);
    var full = function (list, tris) { return ['water', 'acrylamide', tris, 'sds', 'aps', 'temed'].every(function (k) { return list.indexOf(k) >= 0; }); };
    p['res-mixed'] = { done: g.resolvingPoured || full(res, 'tris88'), text: res.length ? 'In: ' + res.map(function (k) { return CAST_NAMES[k]; }).join(', ') : '' };
    p['res-poured'] = { done: g.resolvingPoured && (g.overlaid || g.stackingPoured), text: g.resolvingPoured ? 'Poured' + (g.overlaid ? ' and covered with water' : '') : g.setInTube ? 'It set in the tube' : '' };
    p['res-set'] = { done: !!info.resolvingSet, text: info.resolvingSet ? 'Set' : g.resolvingPoured ? (info.resolvingSetsIn < 0 ? 'It will not set' : M.clockText(info.resolvingSetsIn) + ' to go') : '' };
    p['stack-mixed'] = { done: g.stackingPoured || full(stack, 'tris68'), text: stack.length ? 'In: ' + stack.map(function (k) { return CAST_NAMES[k]; }).join(', ') : '' };
    p['stack-poured'] = { done: g.stackingPoured && (g.combIn || g.combOut), text: g.stackingPoured ? 'Poured' + (g.combIn ? ', comb in' : '') : '' };
    p['stack-set'] = { done: !!g.combOut, text: g.combOut ? 'Comb out: ten wells' : g.stackingPoured ? (info.stackingSetsIn < 0 ? 'It will not set' : info.stackingSet ? 'Set' : M.clockText(info.stackingSetsIn) + ' to go') : '' };
    p['in-tank'] = { done: g.inTank && g.bufferIn, text: g.inTank ? 'In the tank' + (g.bufferIn ? ', in buffer' : '') : '' };
    p.laemmli = { done: !!g.laemmli, text: g.laemmli ? 'Added' : '' };
    var heated = info.heated || 0;
    p.heated = { done: heated >= 4, text: g.heatStart >= 0 ? M.clockText(heated) + ' at 95 °C' + (g.heatedOut ? ', out' : ', in the block') : '' };
    var loaded = (g.wells || []).map(function (w, i) { return w ? (i + 1) + ': ' + sampleName(w) : ''; }).filter(Boolean);
    p['loaded-wells'] = { done: loaded.length >= 2 && (g.wells || []).indexOf('ladder') >= 0, text: loaded.join('; ') };
    var share = (g.runVMin || 0) / FULL_RUN_VMIN;
    p.ran = { done: share >= 0.85 && !g.powerOn, text: (g.leadsOn ? (g.reversed ? 'Leads: red to black. ' : 'Leads: red to red. ') : '') + (g.runMin > 0 || g.powerOn ? (g.powerOn ? 'Running, ' : 'Stopped, ') + M.clockText(g.runMin) + ' at ' + g.volts + ' V; dye front ' + Math.round(info.frontMm || 0) + ' mm' : (g.lidOn ? 'Lid on' : '')) };
    p.stained = { done: g.stainMin >= 30 && g.destainMin >= 60, text: g.inTray ? 'Coomassie ' + M.clockText(g.stainMin) + ', destain ' + M.clockText(g.destainMin) : '' };
    p.photo = { done: !!(state.gel && state.gel.light === 'white' && state.gel.stained > 0.5), text: g.inImager ? 'In the imager, light ' + g.light + (state.gel ? '; pictures taken: ' + g.photos : '') : '' };
  }

  function buildGel() {
    var grid = $('well-grid');
    grid.textContent = '';
    for (var w = 1; w <= 10; w++) (function (w) {
      var line = el('span', { 'class': 'well-line' });
      line.appendChild(el('span', { 'class': 'well-name' }, 'Well ' + w));
      var sel = el('select', { 'aria-label': 'What goes into well ' + w });
      sel.appendChild(el('option', { value: '' }, '–'));
      sel.appendChild(el('option', { value: 'ladder' }, 'Ladder'));
      M.SAMPLES.forEach(function (x) { sel.appendChild(el('option', { value: x.key }, x.name)); });
      sel.value = state.wellPlan[w] || '';
      sel.onchange = function () { state.wellPlan[w] = sel.value; saveState(); };
      line.appendChild(sel);
      var btn = el('button', { type: 'button', 'class': 'quiet-button', 'data-well': String(w) }, 'Load');
      btn.addEventListener('click', function () {
        if (!sel.value) { note('Choose what goes into well ' + w + ' first.', 'blocked'); return; }
        act('well ' + w + ' ' + sel.value);
      });
      line.appendChild(btn);
      grid.appendChild(line);
    })(w);
    var body = $('ladder-rows');
    body.textContent = '';
    M.LADDER.forEach(function (kDa) {
      var tr = el('tr', { 'data-kda': String(kDa) });
      tr.appendChild(el('th', { scope: 'row' }, String(kDa)));
      tr.appendChild(inputCell(state.ladderMm, kDa, 'Distance of the ' + kDa + ' kDa band', 'mm'));
      tr.appendChild(inputCell(state.ladderLog, kDa, 'log of ' + kDa, 'log'));
      body.appendChild(tr);
    });
    body = $('protein-rows');
    body.textContent = '';
    var tr = el('tr');
    var td = el('td');
    var lane = el('select', { id: 'protein-lane', 'aria-label': 'The lane you measured' });
    lane.onchange = function () { state.proteinBand.lane = lane.value; showGel(); saveState(); };
    td.appendChild(lane);
    tr.appendChild(td);
    tr.appendChild(inputCell(state.proteinBand, 'mm', 'Distance of your protein\u2019s band', 'mm'));
    tr.appendChild(inputCell(state.proteinBand, 'log', 'log of its mass, from the line', 'log'));
    tr.appendChild(inputCell(state.proteinBand, 'kda', 'Its mass', 'kda'));
    body.appendChild(tr);
    $('volts').value = state.volts || '200';
    if (gelBound) return;
    gelBound = true;
    $('volts').addEventListener('input', function () { state.volts = $('volts').value; saveState(); });
    $('power-on').addEventListener('click', function () {
      var v = Math.round(M.num($('volts').value));
      if (!(v > 0)) { note('Set the volts first.', 'blocked'); return; }
      act('volts ' + v + '|power on');
    });
    var pic = $('gel-picture');
    pic.addEventListener('mousemove', function (e) { var r = pic.getBoundingClientRect(); gelHover = (e.clientY - r.top) / r.height * 400; drawGel(); });
    pic.addEventListener('mouseleave', function () { gelHover = null; drawGel(); });
  }
  var gelBound = false, gelHover = null;

  /** The ladder lane's bands in the latest picture, by mass. */
  function ladderBands() {
    var g = state.gel, out = {};
    if (!g) return out;
    g.lanes.forEach(function (lane) {
      if (lane.what !== 'ladder' || out.done) return;
      var bands = lane.bands.filter(function (b) { return b.ladder; });
      // the ladder's bands are sent in the ladder's order; any run off the bottom are missing at the end
      bands.forEach(function (b, i) { out[M.LADDER[i]] = b; });
      out.done = true;
    });
    delete out.done;
    return out;
  }

  function visibleBands(lane) {
    var g = state.gel;
    if (!g) return [];
    return lane.bands.filter(function (b) { return b.ladder || (g.light === 'blue' ? b.glows : b.ug * g.stained >= M.VISIBLE_UG); });
  }

  function showGel() {
    var b = state.bench;
    if (!b || PART !== 2) return;
    // which wells can be loaded
    var g = b.gel || {};
    document.querySelectorAll('#well-grid button[data-well]').forEach(function (btn) {
      var w = Number(btn.getAttribute('data-well'));
      var inWell = g.wells ? g.wells[w - 1] : '';
      btn.textContent = inWell ? 'Loaded' : 'Load';
      btn.disabled = !!inWell;
    });
    var ladder = ladderBands(), pts = [];
    M.LADDER.forEach(function (kDa) {
      var tr = document.querySelector('#ladder-rows tr[data-kda="' + kDa + '"]');
      var cells = tr.querySelectorAll('td.entry');
      var t = M.num(state.ladderMm[kDa]), band = ladder[kDa];
      var v1 = { verdict: '', hint: '' };
      if (String(state.ladderMm[kDa] || '').trim()) {
        if (!state.gel) v1 = { verdict: 'no', hint: 'Take a picture of the gel first.' };
        else if (!band) v1 = { verdict: 'no', hint: 'That band is not on your gel.' };
        else if (!isFinite(t)) v1 = { verdict: 'no', hint: 'Type a number.' };
        else v1 = Math.abs(t - band.mm) <= 0.8 ? { verdict: 'ok', hint: '' } : { verdict: 'no', hint: 'Measure again: from the bottom of the well to the middle of the band.' };
      }
      mark(cells[0], v1.verdict, v1.hint);
      var l = M.num(state.ladderLog[kDa]);
      var v2 = { verdict: '', hint: '' };
      if (String(state.ladderLog[kDa] || '').trim()) v2 = M.close(l, Math.log10(kDa), 0, 0.006) ? { verdict: 'ok', hint: '' } : { verdict: 'no', hint: isFinite(l) && M.close(l, Math.log(kDa), 0, 0.01) ? 'That is the natural log: use log base 10.' : 'log10 of the mass in kDa.' };
      mark(cells[1], v2.verdict, v2.hint);
      if (v1.verdict === 'ok' && v2.verdict === 'ok' && kDa >= M.LADDER_FIT[0] && kDa <= M.LADDER_FIT[1]) pts.push([t, l]);
    });
    var line = M.fitLine(pts);
    $('mass-caption').textContent = line
      ? 'Figure 4. log10(mass) against distance. The line through the ladder\u2019s bands from 15 to 100 kDa: log10(mass) = ' + line.m.toFixed(4) + ' × (mm) + ' + line.b.toFixed(3) + '.'
      : 'Figure 4. log10(mass) against distance. Record at least three ladder bands from 15 to 100 kDa to draw the line.';
    drawMass(pts, line);

    // your protein's band
    var laneSel = $('protein-lane');
    var options = state.gel ? state.gel.lanes.filter(function (l) { return l.what && l.what !== 'ladder'; }) : [];
    var want = options.map(function (l) { return String(l.well); }).join(',');
    if (laneSel.getAttribute('data-options') !== want) {
      laneSel.textContent = '';
      laneSel.appendChild(el('option', { value: '' }, 'Choose a lane'));
      options.forEach(function (l) { laneSel.appendChild(el('option', { value: String(l.well) }, 'Lane ' + l.well + ': ' + sampleName(l.what))); });
      laneSel.setAttribute('data-options', want);
    }
    laneSel.value = state.proteinBand.lane || '';
    var cells = document.querySelectorAll('#protein-rows td.entry');
    var lane = state.gel ? state.gel.lanes.filter(function (l) { return String(l.well) === String(state.proteinBand.lane); })[0] : null;
    var mm = M.num(state.proteinBand.mm);
    var v = { verdict: '', hint: '' };
    if (String(state.proteinBand.mm || '').trim()) {
      if (!lane) v = { verdict: 'no', hint: 'Choose the lane first.' };
      else if (!isFinite(mm)) v = { verdict: 'no', hint: 'Type a number.' };
      else v = visibleBands(lane).some(function (b) { return !b.ladder && Math.abs(b.mm - mm) <= 0.8; }) ? { verdict: 'ok', hint: '' } : { verdict: 'no', hint: 'There is no band at that distance in this lane: measure again.' };
    }
    mark(cells[0], v.verdict, v.hint);
    var lg = M.num(state.proteinBand.log), v2 = { verdict: '', hint: '' };
    if (String(state.proteinBand.log || '').trim()) {
      if (!line) v2 = { verdict: 'no', hint: 'Draw the line first (Table 6).' };
      else if (v.verdict !== 'ok') v2 = { verdict: '', hint: '' };
      else v2 = M.close(lg, line.m * mm + line.b, 0, 0.01) ? { verdict: 'ok', hint: '' } : { verdict: 'no', hint: 'Read it off the line: log10(mass) = slope × distance + intercept.' };
    }
    mark(cells[1], v2.verdict, v2.hint);
    var kda = M.num(state.proteinBand.kda), v3 = { verdict: '', hint: '' };
    if (String(state.proteinBand.kda || '').trim() && v2.verdict === 'ok') {
      v3 = M.close(kda, Math.pow(10, lg), 0.02, 0.1) ? { verdict: 'ok', hint: '' } : { verdict: 'no', hint: isFinite(kda) && M.close(kda, lg, 0.02, 0.01) ? 'That is still the logarithm: the mass is 10 to that power.' : 'The mass is 10 to the power of the log.' };
    }
    mark(cells[2], v3.verdict, v3.hint);
    $('gel-status').textContent = state.gel && state.gel.light === 'blue' ? 'This picture was taken in blue light: only what still glows shows. Take one in white light to read the stained bands.' : '';
    drawGel();
  }

  function drawGel() {
    var box = $('gel-picture');
    if (!box) return;
    box.textContent = '';
    var g = state.gel;
    var L = 70, T = 40, laneW = 46, mmPx = 5;
    if (!g) {
      box.appendChild(svg('text', { x: 280, y: 180, 'class': 'axis-label', 'text-anchor': 'middle' }, 'No picture yet: put the stained gel in the imager and take one.'));
      $('gel-caption').textContent = 'Figure 3. The gel.';
      return;
    }
    var blue = g.light === 'blue';
    var bg = blue ? '#0c1020' : mixColour([236, 240, 244], [90, 110, 200], g.background);
    var height = (g.runLengthMm + 2) * mmPx;
    box.appendChild(svg('rect', { x: L - 6, y: T - 14, width: laneW * 10 + 12, height: height + 20, fill: bg, stroke: '#8d9994' }));
    // the ruler, in mm from the bottom of the wells
    for (var mm = 0; mm <= g.runLengthMm; mm += 5) {
      box.appendChild(svg('line', { x1: L - 18, x2: L - 8, y1: T + mm * mmPx, y2: T + mm * mmPx, 'class': 'grid', stroke: '#4b5854' }));
      box.appendChild(svg('text', { x: L - 22, y: T + mm * mmPx + 4, 'class': 'tick', 'text-anchor': 'end' }, String(mm)));
      for (var k = 1; k < 5 && mm + k <= g.runLengthMm; k++) box.appendChild(svg('line', { x1: L - 13, x2: L - 8, y1: T + (mm + k) * mmPx, y2: T + (mm + k) * mmPx, stroke: '#8d9994' }));
    }
    box.appendChild(svg('text', { x: 14, y: T + height / 2, 'class': 'axis-label', 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (T + height / 2) + ')' }, 'Distance from the well (mm)'));
    g.lanes.forEach(function (lane, i) {
      var x = L + i * laneW;
      box.appendChild(svg('rect', { x: x + 6, y: T - 10, width: laneW - 12, height: 8, fill: blue ? '#1a2038' : '#c9d1d8' }));
      box.appendChild(svg('text', { x: x + laneW / 2, y: T - 18, 'class': 'tick', 'text-anchor': 'middle' }, String(lane.well)));
      lane.bands.forEach(function (b) {
        var alpha, colour;
        if (blue) { if (!b.glows) { if (!b.ladder) return; alpha = 0.25; colour = '#6070a0'; } else { alpha = Math.min(1, 0.3 + b.ug / 3); colour = g.glowColour; } }
        else if (b.ladder) { alpha = Math.min(1, 0.4 + b.ug); colour = b.pink ? '#c8407e' : '#1c2f8a'; }
        else { alpha = g.stained * (1 - Math.exp(-b.ug / 0.6)); colour = '#1c2f8a'; if (alpha < 0.05) return; }
        var th = 2 + Math.min(6, Math.log(1 + b.ug) * 2.2);
        box.appendChild(svg('rect', { x: x + 7, y: T + b.mm * mmPx - th / 2, width: laneW - 14, height: th, rx: 2, fill: colour, 'fill-opacity': alpha.toFixed(3) }));
      });
    });
    // the lanes' names, under the gel
    g.lanes.forEach(function (lane, i) {
      if (!lane.what) return;
      var x = L + i * laneW + laneW / 2, y = T + height + 18;
      box.appendChild(svg('text', { x: x, y: y, 'class': 'tick', 'text-anchor': 'end', transform: 'rotate(-40 ' + x + ' ' + y + ')' }, shortName(lane.what) + (lane.what !== 'ladder' && !lane.heated ? '*' : '')));
    });
    if (gelHover != null && gelHover >= T && gelHover <= T + height) {
      var d = (gelHover - T) / mmPx;
      box.appendChild(svg('line', { x1: L - 8, x2: L + laneW * 10 + 6, y1: gelHover, y2: gelHover, 'class': 'cursor' }));
      box.appendChild(svg('text', { x: L + laneW * 10 + 10, y: gelHover + 4, 'class': 'cursor-label' }, d.toFixed(1) + ' mm'));
    }
    $('gel-caption').textContent = 'Figure 3. The gel in ' + (blue ? 'blue light, unstained bands that glow' : 'white light') + ' (picture ' + g.photo + '). ' +
      (g.lanes.some(function (l) { return l.what && l.what !== 'ladder' && !l.heated; }) ? '* not heated. ' : '') + 'Point at the gel to read a distance.';
  }

  function shortName(key) {
    return { ladder: 'Ladder', cells: 'Cells', lysate: 'Lysate', cleared: 'Cleared', pellet: 'Pellet', ft: 'FT', w1: 'W1', w2: 'W2', e1: 'E1', e2: 'E2', e3: 'E3', e4: 'E4' }[key] || key;
  }

  function mixColour(a, b, f) {
    f = Math.max(0, Math.min(1, f || 0));
    return 'rgb(' + a.map(function (x, i) { return Math.round(x + (b[i] - x) * f); }).join(',') + ')';
  }

  function drawMass(pts, line) {
    var box = $('mass-curve');
    box.textContent = '';
    var a = axes(box, 0, 60, 0.8, 2.6, range(0, 60, 10), range(0.8, 2.6, 0.2), 'Distance from the well (mm)', 'log10(mass in kDa)', String, function (t) { return t.toFixed(1); });
    if (line) box.appendChild(svg('line', { x1: a.X(0), y1: a.Y(line.b), x2: a.X(60), y2: a.Y(line.m * 60 + line.b), 'class': 'fit' }));
    pts.forEach(function (p) { box.appendChild(svg('circle', { cx: a.X(p[0]), cy: a.Y(p[1]), r: 5, 'class': 'point' })); });
  }


  // ---- The purification table, and which protein it is ---------------------------------------------------

  var PURIF_COLS = [
    { key: 'mg', label: 'Total protein' },
    { key: 'fu', label: 'Total fluorescence' },
    { key: 'spec', label: 'Fluorescence per mg' },
    { key: 'yield', label: 'Yield' },
    { key: 'fold', label: 'Purification' }
  ];

  function buildPurif() {
    var body = $('purif-rows');
    body.textContent = '';
    M.MEASURED.forEach(function (m) {
      if (!state.purif[m.key]) state.purif[m.key] = {};
      var tr = el('tr', { 'data-sample': m.key });
      tr.appendChild(el('th', { scope: 'row' }, m.name));
      tr.appendChild(el('td', { 'class': 'vol' }, ''));
      PURIF_COLS.forEach(function (c) { tr.appendChild(inputCell(state.purif[m.key], c.key, c.label + ', ' + m.name, c.key)); });
      body.appendChild(tr);
    });
    ['protein', 'tag'].forEach(function (k) {
      var sel = $('ident-' + k);
      sel.value = state.ident[k] || '';
      sel.onchange = function () { state.ident[k] = sel.value; saveState(); };
    });
    var why = $('ident-why');
    why.value = state.ident.why || '';
    $('ident-why-copy').textContent = why.value;
    why.oninput = function () { state.ident.why = why.value; $('ident-why-copy').textContent = why.value; saveState(); };
  }

  /** The numbers a row of the purification table is worked from: its volume as shown, and the student's own accepted entries. */
  function purifInputs(b, key) {
    var k = measuredIndex(key);
    var vol = Math.round(sampleMl(b, key) * 100) / 100;
    var ownBox = document.querySelector('#bradford-rows tr[data-sample="' + key + '"] td.entry:last-child input');
    var fuBox = document.querySelector('#fluor-rows tr[data-sample="' + key + '"] td.entry:last-child input');
    var own = ownBox && ownBox.getAttribute('data-state') === 'ok' ? M.num(state.own[key]) : NaN;
    var fu = fuBox && fuBox.getAttribute('data-state') === 'ok' ? M.num(state.fu[key]) : NaN;
    return { vol: vol, own: own, fu: fu, k: k };
  }

  function showPurif() {
    var b = state.bench;
    if (!b || PART !== 2) return;
    var base = purifInputs(b, 'lysate');
    var baseMg = M.num(state.purif.lysate && state.purif.lysate.mg), baseFu = M.num(state.purif.lysate && state.purif.lysate.fu);
    var accepted = 0;
    M.MEASURED.forEach(function (m) {
      var tr = document.querySelector('#purif-rows tr[data-sample="' + m.key + '"]');
      var row = state.purif[m.key] || {};
      var x = purifInputs(b, m.key);
      tr.querySelector('.vol').textContent = M.ml(x.vol);
      var cells = tr.querySelectorAll('td.entry');
      var ok = {};
      function judge(i, key, want, missing, slips) {
        var text = row[key];
        if (!String(text || '').trim()) { mark(cells[i], '', ''); return; }
        if (!isFinite(want)) { mark(cells[i], 'no', missing); return; }
        var t = M.num(text);
        if (!isFinite(t)) { mark(cells[i], 'no', 'Type a number.'); return; }
        if (M.close(t, want, 0.03, 0.005)) { ok[key] = true; accepted += 1; mark(cells[i], 'ok', ''); return; }
        var hint = '';
        (slips || []).some(function (s) { if (isFinite(s[0]) && M.close(t, s[0], 0.03, 0.005)) { hint = s[1]; return true; } return false; });
        mark(cells[i], 'no', hint || 'Check the arithmetic.');
      }
      judge(0, 'mg', x.own * x.vol, 'Finish this sample\u2019s row of Table 4 first.', [[x.own, 'That is mg per mL: multiply by the volume.']]);
      judge(1, 'fu', x.fu * x.vol, 'Finish this sample\u2019s row of Table 5 first.', [[x.fu, 'That is per mL: multiply by the volume.']]);
      var mg = M.num(row.mg), fu = M.num(row.fu);
      judge(2, 'spec', ok.mg && ok.fu ? fu / mg : NaN, 'Work out the two totals first.', [[mg / fu, 'The other way up: fluorescence divided by protein.']]);
      var yieldWant = m.key === 'lysate' ? 100 : (ok.fu && isFinite(baseFu) && baseFu > 0 ? fu / baseFu * 100 : NaN);
      judge(3, 'yield', yieldWant, m.key === 'lysate' ? '' : 'Work out the totals of this row and of the cleared lysate first.', [[yieldWant / 100, 'As a percentage: times 100.']]);
      var spec = M.num(row.spec), baseSpec = M.num(state.purif.lysate && state.purif.lysate.spec);
      var foldWant = m.key === 'lysate' ? 1 : (isFinite(spec) && isFinite(baseSpec) && baseSpec > 0 ? spec / baseSpec : NaN);
      judge(4, 'fold', foldWant, 'Work out the fluorescence per mg of this row and of the cleared lysate first.', [[baseSpec / spec, 'The other way up: this row\u2019s fluorescence per mg divided by the cleared lysate\u2019s.']]);
    });
    $('purif-status').textContent = accepted ? accepted + ' of ' + M.MEASURED.length * PURIF_COLS.length + ' entries agree with your own numbers.' : '';
  }

  var part2Bound = false;

  function buildPart2() {
    var grid = $('dilution-grid');
    grid.textContent = '';
    M.MEASURED.forEach(function (m) {
      var line = el('span', { 'class': 'dilution-line' });
      line.appendChild(el('span', { 'class': 'dilution-name' }, m.short));
      var sel = el('select', { 'aria-label': 'Dilution of the ' + m.name });
      M.FACTORS.forEach(function (f) { sel.appendChild(el('option', { value: String(f) }, factorText(f))); });
      sel.value = String(state.dilSel[m.key] || 1);
      sel.addEventListener('change', function () { state.dilSel[m.key] = Number(sel.value); saveState(); });
      line.appendChild(sel);
      var btn = el('button', { type: 'button', 'class': 'quiet-button' }, 'Make it');
      btn.addEventListener('click', function () { setView('meters'); act('dilute ' + m.key + ' ' + sel.value); });
      line.appendChild(btn);
      grid.appendChild(line);
    });
    var cuv = $('cuvette');
    cuv.textContent = '';
    M.CUVETTES.forEach(function (c) { cuv.appendChild(el('option', { value: c.key }, c.name)); });
    cuv.value = state.cuvette || 'b';
    cuv.onchange = function () { state.cuvette = cuv.value; saveState(); };
    var qs = $('quartz-sample');
    qs.textContent = '';
    M.MEASURED.forEach(function (m) { qs.appendChild(el('option', { value: m.key }, m.name)); });
    qs.value = state.quartzSample || 'pool';
    qs.onchange = function () { state.quartzSample = qs.value; saveState(); };

    // Table 3: the blank and the standards
    var body = $('standard-rows');
    body.textContent = '';
    M.CUVETTES.slice(0, 8).forEach(function (c, i) {
      var tr = el('tr', { 'data-cuvette': c.key });
      tr.appendChild(el('th', { scope: 'row' }, i === 0 ? 'Blank' : 'S' + i));
      tr.appendChild(el('td', null, i === 0 ? '0' : String(M.STANDARDS[i - 1])));
      tr.appendChild(inputCell(state.readA, c.key, 'A595 of ' + c.name, 'reading'));
      body.appendChild(tr);
    });
    // Table 4: the samples
    body = $('bradford-rows');
    body.textContent = '';
    M.MEASURED.forEach(function (m) {
      var tr = el('tr', { 'data-sample': m.key });
      tr.appendChild(el('th', { scope: 'row' }, m.name));
      tr.appendChild(el('td', { 'class': 'vol' }, ''));
      tr.appendChild(el('td', { 'class': 'factor' }, ''));
      tr.appendChild(inputCell(state.readA, m.key, 'A595 of the ' + m.name, 'reading'));
      tr.appendChild(inputCell(state.conc, m.key, 'Protein from the curve, ' + m.name, 'conc'));
      tr.appendChild(inputCell(state.own, m.key, 'Protein in the ' + m.name, 'own'));
      body.appendChild(tr);
    });
    // Table 5: fluorescence
    body = $('fluor-rows');
    body.textContent = '';
    M.MEASURED.forEach(function (m) {
      var tr = el('tr', { 'data-sample': m.key });
      tr.appendChild(el('th', { scope: 'row' }, m.name));
      tr.appendChild(el('td', { 'class': 'factor' }, ''));
      tr.appendChild(el('td', { 'class': 'at' }, ''));
      tr.appendChild(inputCell(state.flRead, m.key, 'Fluorimeter reading of the ' + m.name, 'reading'));
      tr.appendChild(inputCell(state.fu, m.key, 'Fluorescence per mL of the ' + m.name, 'fu'));
      body.appendChild(tr);
    });
    $('peak-ex').value = state.peaks.ex || '';
    $('peak-em').value = state.peaks.em || '';
    $('ex').value = state.ex || ''; $('em').value = state.em || '';
    if (part2Bound) return;
    part2Bound = true;
    ['ex', 'em'].forEach(function (k) {
      var box = $('peak-' + k);
      box.addEventListener('input', function () { state.peaks[k] = box.value; showPart2(); saveState(); });
    });
    var ex = $('ex'), em = $('em');
    ex.addEventListener('input', function () { state.ex = ex.value; saveState(); });
    em.addEventListener('input', function () { state.em = em.value; saveState(); });
    $('set-wavelengths').addEventListener('click', function () {
      var steps = [];
      if (ex.value.trim()) steps.push('ex ' + Math.round(M.num(ex.value)));
      if (em.value.trim()) steps.push('em ' + Math.round(M.num(em.value)));
      if (!steps.length) { note('Type the wavelengths first.', 'blocked'); return; }
      act(steps.join('|'));
    });
    $('pool-button').addEventListener('click', function () {
      var chosen = ['e1', 'e2', 'e3', 'e4'].filter(function (k) { return state.pool[k]; });
      setView('meters');
      act('pool ' + chosen.join(' '));
    });
    $('quartz-add').addEventListener('click', function () { act('quartz ' + $('quartz-sample').value); });
    document.querySelectorAll('[data-cuvette-step]').forEach(function (btn) {
      btn.addEventListener('click', function () { act(btn.getAttribute('data-cuvette-step') + ' ' + $('cuvette').value); });
    });
    var spectra = $('spectra');
    spectra.addEventListener('mousemove', function (e) { hoverSpectra(e); });
    spectra.addEventListener('mouseleave', function () { hoverAt = null; drawSpectra(); });
  }

  /** A table cell with a text box whose value is kept in `store[key]`. */
  function inputCell(store, key, label, kind) {
    var td = el('td', { 'class': 'entry' });
    var box = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input', 'aria-label': label, 'data-kind': kind });
    box.value = store[key] || '';
    box.addEventListener("input", function () { store[key] = box.value; showPart2(); showGel(); showPurif(); saveState(); });
    td.appendChild(box);
    td.appendChild(el('span', { 'class': 'cell-hint' }, ''));
    var copy = el('span', { 'class': 'print-value' }, box.value);
    td.appendChild(copy);
    return td;
  }

  function mark(td, verdict, hint) {
    var box = td.querySelector('input');
    if (verdict) box.setAttribute('data-state', verdict === 'ok' ? 'ok' : 'bad'); else box.removeAttribute('data-state');
    td.querySelector('.cell-hint').textContent = hint || '';
    td.querySelector('.print-value').textContent = box.value;
  }

  /** The straight line through the accepted blank and standards up to 1 mg/mL. */
  function standardLine(b) {
    var pts = [];
    M.CUVETTES.slice(0, 8).forEach(function (c, i) {
      var conc = i === 0 ? 0 : M.STANDARDS[i - 1];
      var cv = cuvetteOf(b, c.key), t = M.num(state.readA[c.key]);
      if (conc <= M.LINEAR_TOP && hasRead(cv) && M.close(t, cv.read, 0, 0.0015)) pts.push([conc, t]);
    });
    return { line: M.fitLine(pts), points: pts };
  }

  function readingVerdict(b, key) {
    var cv = cuvetteOf(b, key), text = state.readA[key];
    if (!String(text || '').trim()) return { verdict: '', hint: '' };
    var t = M.num(text);
    if (!isFinite(t)) return { verdict: 'no', hint: 'Type a number.' };
    if (!hasRead(cv)) return { verdict: 'no', hint: 'This cuvette has not been read yet.' };
    if (M.close(t, cv.read, 0, 0.0015)) return { verdict: 'ok', hint: '' };
    return { verdict: 'no', hint: 'Not what the screen showed: put the cuvette in again and read it.' };
  }

  function showPart2() {
    var b = state.bench;
    if (!b || PART !== 2) return;
    var fit = standardLine(b), line = fit.line;
    var topA = null;
    M.CUVETTES.slice(0, 8).forEach(function (c, i) {
      var v = readingVerdict(b, c.key);
      mark(document.querySelector('#standard-rows tr[data-cuvette="' + c.key + '"] td.entry'), v.verdict, v.hint);
      if (v.verdict === 'ok' && i > 0 && M.STANDARDS[i - 1] === M.LINEAR_TOP) topA = M.num(state.readA[c.key]);
    });
    $('curve-caption').textContent = line
      ? 'Figure 1. Standard curve. The line through the blank and the standards up to 1 mg/mL: A595 = ' + line.m.toFixed(4) + ' × (mg/mL) ' + (line.b < 0 ? '− ' : '+ ') + Math.abs(line.b).toFixed(4) + '.'
      : 'Figure 1. Standard curve. Record the blank and at least two standards up to 1 mg/mL to draw the line.';
    drawCurve(b, fit);

    var notes = [];
    M.MEASURED.forEach(function (m, k) {
      var tr = document.querySelector('#bradford-rows tr[data-sample="' + m.key + '"]');
      var cv = cuvetteOf(b, m.key);
      var factor = cv && cv.sampleUl > 0 ? cv.factor : 0;
      tr.querySelector('.vol').textContent = M.ml(sampleMl(b, m.key));
      tr.querySelector('.factor').textContent = factor ? factorText(factor) : '–';
      var cells = tr.querySelectorAll('td.entry');
      var v = readingVerdict(b, m.key);
      mark(cells[0], v.verdict, v.hint);
      var a = M.num(state.readA[m.key]);
      var want = v.verdict === 'ok' && line ? M.concFrom(line, a) : NaN;
      if (v.verdict === 'ok' && topA != null && a > topA + 0.01) notes.push(m.short + ' reads above the straight part of the curve: dilute it more and read it again.');
      var c1 = isFinite(want) ? M.checkConc(state.conc[m.key], want, factor || 1, 'cuvette') : { verdict: '', hint: String(state.conc[m.key] || '').trim() ? (line ? 'Record its A595 first.' : 'The standard curve is not drawn yet.') : '' };
      mark(cells[1], c1.verdict, c1.hint);
      var c2 = c1.verdict === 'ok' ? M.checkConc(state.own[m.key], M.num(state.conc[m.key]) * (factor || 1), factor || 1, 'sample') : { verdict: '', hint: '' };
      mark(cells[2], c2.verdict, c2.hint);
    });
    var done = M.MEASURED.filter(function (m) { return document.querySelector('#bradford-rows tr[data-sample="' + m.key + '"] td.entry:last-child input').getAttribute('data-state') === 'ok'; }).length;
    $('bradford-status').textContent = (done ? done + ' of ' + M.MEASURED.length + ' samples worked out. ' : '') + notes.join(' ');

    // the peaks, against the student's own latest scans
    var peakNotes = [];
    ['ex', 'em'].forEach(function (kind) {
      var box = $('peak-' + kind), scan = lastScan(kind), t = M.num(state.peaks[kind]);
      var name = kind === 'ex' ? 'excitation' : 'emission';
      if (!String(state.peaks[kind] || '').trim()) { box.removeAttribute('data-state'); return; }
      if (!scan) { box.setAttribute('data-state', 'bad'); peakNotes.push('Make an ' + name + ' scan first.'); return; }
      var at = M.peakOf(scan);
      if (scan.over) peakNotes.push('The ' + name + ' scan reached the top of the detector, so its peak is cut off: dilute more and scan again.');
      var ok = isFinite(t) && Math.abs(t - at) <= 2 && !scan.over;
      box.setAttribute('data-state', ok ? 'ok' : 'bad');
      if (!ok && !scan.over) peakNotes.push('The ' + name + ' peak: look again where your latest ' + name + ' scan is highest.');
    });
    $('peak-status').textContent = peakNotes.join(' ');

    var settings = {};
    M.MEASURED.forEach(function (m, k) {
      var tr = document.querySelector('#fluor-rows tr[data-sample="' + m.key + '"]');
      var r = b.fluor ? b.fluor[k] : null;
      var read = r && r.counts >= 0;
      tr.querySelector('.factor').textContent = read ? factorText(r.factor) : '–';
      tr.querySelector('.at').textContent = read ? r.ex + ' / ' + r.em : '–';
      if (read && !r.over) settings[r.ex + '/' + r.em] = true;
      var cells = tr.querySelectorAll('td.entry');
      var text = state.flRead[m.key], t = M.num(text);
      var v1 = { verdict: '', hint: '' };
      if (String(text || '').trim()) {
        if (!read) v1 = { verdict: 'no', hint: 'This sample has not been read yet.' };
        else if (r.over) v1 = { verdict: 'no', hint: 'It read OVER: dilute it more and read it again.' };
        else if (!isFinite(t)) v1 = { verdict: 'no', hint: 'Type a number.' };
        else v1 = M.close(t, r.counts, 0, 1.5) ? { verdict: 'ok', hint: '' } : { verdict: 'no', hint: 'Not what the screen showed: read it again.' };
      }
      mark(cells[0], v1.verdict, v1.hint);
      var v2 = { verdict: '', hint: '' };
      if (v1.verdict === 'ok' && String(state.fu[m.key] || '').trim()) {
        var u = M.num(state.fu[m.key]), want = r.counts * r.factor;
        if (M.close(u, want, 0.01, 1)) v2 = { verdict: 'ok', hint: '' };
        else if (r.factor > 1 && M.close(u, r.counts, 0.01, 1)) v2 = { verdict: 'no', hint: 'Multiply by the dilution factor.' };
        else v2 = { verdict: 'no', hint: 'The reading times the dilution.' };
      }
      mark(cells[1], v2.verdict, v2.hint);
    });
    var n = Object.keys(settings).length;
    $('fluor-status').textContent = n > 1 ? 'Your samples were read at ' + n + ' different settings: read them all at the same two wavelengths, or they cannot be compared.' : '';
    drawSpectra();
  }

  // ---- Figures: the standard curve and the scans -----------------------------------------------------

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, text) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  /** Axes in a 560 by 330 picture: returns functions from data to picture. */
  function axes(g, x0, x1, y0, y1, xTicks, yTicks, xLabel, yLabel, xFmt, yFmt) {
    var L = 62, R = 540, T = 16, B = 280;
    var X = function (x) { return L + (x - x0) / (x1 - x0) * (R - L); };
    var Y = function (y) { return B - (y - y0) / (y1 - y0) * (B - T); };
    g.appendChild(svg('rect', { x: L, y: T, width: R - L, height: B - T, 'class': 'plot-area' }));
    xTicks.forEach(function (t) {
      g.appendChild(svg('line', { x1: X(t), x2: X(t), y1: T, y2: B, 'class': 'grid' }));
      g.appendChild(svg('text', { x: X(t), y: B + 18, 'class': 'tick', 'text-anchor': 'middle' }, xFmt(t)));
    });
    yTicks.forEach(function (t) {
      g.appendChild(svg('line', { x1: L, x2: R, y1: Y(t), y2: Y(t), 'class': 'grid' }));
      g.appendChild(svg('text', { x: L - 8, y: Y(t) + 4, 'class': 'tick', 'text-anchor': 'end' }, yFmt(t)));
    });
    g.appendChild(svg('text', { x: (L + R) / 2, y: 318, 'class': 'axis-label', 'text-anchor': 'middle' }, xLabel));
    g.appendChild(svg('text', { x: 16, y: (T + B) / 2, 'class': 'axis-label', 'text-anchor': 'middle', transform: 'rotate(-90 16 ' + ((T + B) / 2) + ')' }, yLabel));
    return { X: X, Y: Y, L: L, R: R, T: T, B: B };
  }

  function drawCurve(b, fit) {
    var box = $('curve');
    box.textContent = '';
    var top = 1.1;
    M.CUVETTES.slice(1, 8).forEach(function (c) { var t = M.num(state.readA[c.key]); if (isFinite(t)) top = Math.max(top, Math.ceil(t * 5 + 0.5) / 5); });
    var a = axes(box, 0, 2.1, 0, top, [0, 0.5, 1, 1.5, 2], range(0, top, 0.2), 'BSA (mg/mL)', 'Absorbance at 595 nm', String, function (t) { return t.toFixed(1); });
    if (fit.line) box.appendChild(svg('line', { x1: a.X(0), y1: a.Y(fit.line.b), x2: a.X(M.LINEAR_TOP), y2: a.Y(fit.line.m * M.LINEAR_TOP + fit.line.b), 'class': 'fit' }));
    M.CUVETTES.slice(0, 8).forEach(function (c, i) {
      var v = readingVerdict(b, c.key);
      if (v.verdict !== 'ok') return;
      var conc = i === 0 ? 0 : M.STANDARDS[i - 1];
      box.appendChild(svg('circle', { cx: a.X(conc), cy: a.Y(M.num(state.readA[c.key])), r: 5, 'class': conc <= M.LINEAR_TOP ? 'point' : 'point outside' }));
    });
  }

  function range(a, b, step) { var out = []; for (var x = a; x <= b + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000); return out; }

  var hoverAt = null;
  var spectraScale = null;

  function drawSpectra() {
    var box = $('spectra');
    if (!box) return;
    box.textContent = '';
    var ex = lastScan('ex'), em = lastScan('em');
    var top = 100;
    [ex, em].forEach(function (s) { if (s) s.values.forEach(function (v) { top = Math.max(top, v); }); });
    top = niceTop(top * 1.08);
    var a = axes(box, 300, 750, 0, top, range(300, 750, 50), range(0, top, top / 5), 'Wavelength (nm)', 'Counts', String, function (t) { return Math.round(t).toLocaleString('en-US'); });
    spectraScale = a;
    var caption = [];
    [[ex, 'scan-ex', 'excitation scan, watching at ' + (ex ? ex.fixed : '') + ' nm'], [em, 'scan-em', 'emission scan, excited at ' + (em ? em.fixed : '') + ' nm']].forEach(function (pair) {
      var sc = pair[0];
      if (!sc) return;
      var d = sc.values.map(function (v, i) { return (i ? 'L' : 'M') + a.X(sc.from + i * sc.step).toFixed(1) + ' ' + a.Y(v).toFixed(1); }).join(' ');
      box.appendChild(svg('path', { d: d, 'class': pair[1] }));
      caption.push((pair[1] === 'scan-ex' ? 'Dashed: ' : 'Solid: ') + pair[2] + ' (' + sourceName(sc.source, sc.factor) + ')' + (sc.over ? ', over the detector\u2019s top' : ''));
    });
    $('spectra-caption').textContent = 'Figure 2. ' + (caption.length ? caption.join('. ') + '.' : 'No scans yet.');
    if (hoverAt != null) {
      var near = [];
      [ex, em].forEach(function (sc) {
        if (!sc) return;
        var i = Math.round((hoverAt - sc.from) / sc.step);
        if (i >= 0 && i < sc.values.length) near.push({ nm: sc.from + i * sc.step, v: sc.values[i], kind: sc.kind });
      });
      box.appendChild(svg('line', { x1: a.X(hoverAt), x2: a.X(hoverAt), y1: a.T, y2: a.B, 'class': 'cursor' }));
      var label = near.map(function (n) { return (n.kind === 'ex' ? 'ex ' : 'em ') + n.nm + ' nm: ' + n.v.toLocaleString('en-US'); }).join('   ');
      if (label) box.appendChild(svg('text', { x: Math.min(a.X(hoverAt) + 8, 360), y: a.T + 16, 'class': 'cursor-label' }, label));
    }
  }

  function niceTop(v) {
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  function hoverSpectra(e) {
    var box = $('spectra'), a = spectraScale;
    if (!a) return;
    var r = box.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width * 560;
    if (x < a.L || x > a.R) { hoverAt = null; drawSpectra(); return; }
    hoverAt = Math.round((300 + (x - a.L) / (a.R - a.L) * 450) / 2) * 2;
    drawSpectra();
  }

  // ---- Controls ----------------------------------------------------------------------------------------

  function bind() {
    $('unknown-code').textContent = state.code;
    // a step's button also brings its part of the bench into view
    var VIEW_OF = { 'routine-a': 'cells', 'routine-b': 'spin', 'routine-c': 'column', 'routine-d': 'meters', 'routine-e': 'meters', 'routine-f': 'meters',
      'routine-g': 'cast', 'routine-h': 'gel', 'routine-i': 'gel close', 'routine-j': 'gel' };
    var GEL_VIEWS = ['gel', 'cast', 'gel close', 'imager'];
    document.querySelectorAll('[data-steps]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var list = btn.closest('.routine');
        var v = list ? VIEW_OF[list.id] : null;
        // (a close-up of the same part of the bench is kept)
        var now = currentView();
        var closeUp = (v === 'column' && now === 'column close') || (v === 'cells' && now === 'sonicator') || (v === 'meters' && (now === 'spec' || now === 'fluor')) || (GEL_VIEWS.indexOf(v) >= 0 && GEL_VIEWS.indexOf(now) >= 0 && v !== 'gel close' && v !== 'cast');
        if (v && now !== v && !closeUp) setView(v);
        act(btn.getAttribute('data-steps'));
      });
    });
    document.querySelectorAll('.view-button, [data-view-go]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-view') || btn.getAttribute('data-view-go'));
      });
    });
    var pip = $('pipette');
    pip.value = state.pipette;
    pip.addEventListener('change', function () {
      var v = Math.round(Number(pip.value));
      if (!(v >= 10 && v <= 1000)) { pip.setAttribute('data-state', 'bad'); note('The micropipette takes 10 to 1000 µL.', 'blocked'); return; }
      pip.removeAttribute('data-state');
      state.pipette = v;
      sendBench('Act', 'pipette ' + v);
      saveState();
    });
    $('speed-toggle').addEventListener('click', function () {
      var on = $('speed-toggle').getAttribute('aria-pressed') !== 'true';
      $('speed-toggle').setAttribute('aria-pressed', on ? 'true' : 'false');
      sendBench('SetSpeed', on ? '1' : '0');
    });
    // the rotor's buckets, for each tube
    var rb = $('rotor-buttons');
    [['spin', 'Lysate'], ['balance', 'Balance']].forEach(function (pair) {
      var line = el('span', { 'class': 'bucket-line' }, pair[1] + ' tube into bucket ');
      for (var k = 0; k < 6; k++) {
        var b = el('button', { type: 'button', 'class': 'quiet-button bucket', 'data-steps': 'rotor ' + pair[0] + ' ' + k }, String(k + 1));
        b.addEventListener('click', function (e) { act(e.currentTarget.getAttribute('data-steps')); });
        line.appendChild(b);
      }
      rb.appendChild(line);
    });
    rb.appendChild(el('span', { 'class': 'soft bucket-note' }, 'The buckets are numbered round the rotor: 1 is opposite 4, 2 opposite 5, 3 opposite 6.'));
    var rpm = $('rpm'), min = $('minutes');
    rpm.value = state.rpm; min.value = state.minutes;
    function showRcf() {
      var r = Number(rpm.value);
      rpm.title = r > 0 ? 'About ' + Math.round(M.rcf(r)).toLocaleString('en-US') + ' x g' : '';
    }
    rpm.addEventListener('input', function () { state.rpm = rpm.value; showRcf(); saveState(); });
    min.addEventListener('input', function () { state.minutes = min.value; saveState(); });
    showRcf();
    $('spin-start').addEventListener('click', function () {
      var r = Math.round(Number(rpm.value)), m = Math.round(Number(min.value));
      if (!(r > 0) || !(m > 0)) { note('Set the speed (rpm) and the time (minutes) first.', 'blocked'); return; }
      act('rpm ' + r + '|minutes ' + m + '|start');
    });
    $('check-glow').addEventListener('click', checkGlow);
    var name = $('student-name');
    name.value = state.name || '';
    name.addEventListener('input', function () { state.name = name.value; saveState(); });
    $('print-report').addEventListener('click', function () {
      $('print-name').textContent = state.name || '';
      $('print-date').textContent = new Date().toLocaleDateString();
      $('print-checks').textContent = PART === 2
        ? 'Unknown ' + state.code + ', Part 2. Accepted by the page: ' +
          ['bradford', 'fluor', 'gel', 'table'].map(function (k) {
            var all = document.querySelectorAll('#part-' + k + ' td input, #part-' + k + ' .peak-fields input');
            return document.querySelectorAll('#part-' + k + ' td input[data-state="ok"], #part-' + k + ' .peak-fields input[data-state="ok"]').length + ' of ' + all.length + ' ' + { bradford: 'Bradford', fluor: 'fluorescence', gel: 'gel', table: 'purification table' }[k] + ' entries';
          }).join(', ') + '. Identified as: ' + (state.ident.protein || '(none)') + ', ' + (state.ident.tag || '(none)') + ' tag (not checked by the page).'
        : 'Unknown ' + state.code + '. Table 1 checked against the bench: ' +
          M.TUBES.filter(function (t) { return state.verdict[t.key] === 'ok'; }).length + ' of ' + M.TUBES.length + ' rows.';
      window.print();
    });
    $('start-over').addEventListener('click', function () { $('erase-confirm').hidden = false; $('erase-confirm').scrollIntoView({ block: 'center' }); });
    $('erase-no').addEventListener('click', function () { $('erase-confirm').hidden = true; });
    $('erase-yes').addEventListener('click', function () {
      $('erase-confirm').hidden = true;
      var code = state.code, name = state.name;
      state = blankState(code);
      state.name = name;
      saveState();
      closeAlert();
      buildFractions();
      buildQuestions();
      buildPart2();
      buildGel();
      buildPurif();
      configureBench();
      sendBench('Act', 'pipette ' + state.pipette);
      $('pipette').value = state.pipette;
      showBench();
    });
  }

  // ---- Unity's loader --------------------------------------------------------------------------------

  window.ProteinLab = {
    isMock: params.has('mock'),
    onUnityEvent: onUnityEvent,
    attachUnity: function (instance) { unity = instance; configureBench(); },
    unityProgress: function (p) { $('progress-fill').style.width = Math.round(p * 100) + '%'; },
    unityBanner: function (message, type) { if (type === 'error') note(message, 'blocked'); },
    unityFailed: function (error) { $('stage-status').textContent = 'The bench did not load: ' + error; },
    state: function () { return state; },
    // for tests: a message straight to the bench (e.g. bench('Advance', '30') moves its clock on)
    bench: function (method, value) { sendBench(method, value); }
  };

  // the page shows one part: number its sections in order
  document.body.setAttribute('data-part', String(PART));
  var n = 0;
  document.querySelectorAll('.part').forEach(function (sec) {
    var part = sec.getAttribute('data-part');
    if (part && Number(part) !== PART) return;
    n += 1;
    var step = sec.querySelector('h2 .step');
    if (step) step.textContent = String(n);
  });

  bind();
  buildFractions();
  buildQuestions();
  buildPart2();
  buildGel();
  buildPurif();
  showViews();
  showBench();
})();
