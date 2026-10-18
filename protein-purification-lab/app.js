/*
 * Purifying a Glowing Protein: page logic for Part 1.
 * Talks to the 3D bench (a Unity build in the canvas), keeps the student's work, shows the steps
 * with a light for each, the bench's warnings (before a step that would go wrong) and its notes
 * on mistakes (after one has happened), the tubes' glow table and the questions.
 *
 * The page does not know what the unknown is: the bench sends what is in each tube and judges
 * what the student says they see. Which protein it is, is never checked here.
 */
(function () {
  'use strict';

  var M = window.ProteinLabModel;
  var STORE_KEY = 'protein-lab:v1';
  var params = new URLSearchParams(window.location.search);

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
      view: 'cells'
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
  var extra = { heat: 0, rcf: 0, slurryMixed: false };

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
      intro: !b && params.get('intro') !== '0',
      view: state.view || 'cells',
      warnings: warningsFirst
    }));
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
    lamp: 'the lamp (click: UV, blue, off)', sonicator: 'the sonicator (click: one burst)'
  };
  var HELD_NAMES = {
    lysis: 'a pipetful of lysis buffer', wash: 'a pipetful of wash buffer', elution: 'a pipetful of elution buffer',
    water: 'the wash bottle', lysozyme: 'a pipetful of lysozyme', cells: 'the tube of lysate', spin: 'the spin tube',
    balance: 'the balance tube', cleared: 'the cleared lysate', slurry: 'the resin bottle'
  };

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
        extra.heat = msg.heat; extra.rcf = msg.rcf; extra.slurryMixed = msg.slurryMixed;
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
        state.view = msg.view;
        showViews();
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
    p.sonicated = { done: b.bursts >= 6, text: b.bursts > 0 ? b.bursts + (b.bursts === 1 ? ' burst' : ' bursts') + '; the sample is at about ' + Math.round(heat) + ' °C' : '' };
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
    var p = progress(state.bench);
    var nextGiven = false;
    document.querySelectorAll('.routine-step').forEach(function (li) {
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
    $('held-note').textContent = b && b.held ? 'In your hand: ' + (HELD_NAMES[b.held] || b.held) + (/lysis|wash|elution|lysozyme/.test(b.held) ? ' (' + state.pipette + ' µL)' : '') + '. Click where it goes, or on an empty spot to put it back.' : '';
    showFractions();
    showSamples();
    showMistakes();
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
      btn.setAttribute('aria-pressed', btn.getAttribute('data-view') === state.view ? 'true' : 'false');
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
      if (v) sel.setAttribute('data-state', v === 'ok' ? 'ok' : 'wrong'); else sel.removeAttribute('data-state');
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
    M.QUESTIONS.forEach(function (q, i) {
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
    if (b.redone && b.redone.length) box.appendChild(el('p', { 'class': 'soft' }, 'Parts started again: ' + b.redone.map(function (r) { return { cells: 'from fresh cells', spin: 'the spin', column: 'a fresh column' }[r] || r; }).join(', ') + '.'));
  }

  // ---- Controls ----------------------------------------------------------------------------------------

  function bind() {
    $('unknown-code').textContent = state.code;
    // a step's button also brings its part of the bench into view
    var VIEW_OF = { 'routine-a': 'cells', 'routine-b': 'spin', 'routine-c': 'column' };
    document.querySelectorAll('[data-steps]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var list = btn.closest('.routine');
        var v = list ? VIEW_OF[list.id] : null;
        if (v && state.view !== v && !(v === 'column' && state.view === 'column close')) { state.view = v; showViews(); sendBench('SetView', v); }
        act(btn.getAttribute('data-steps'));
      });
    });
    document.querySelectorAll('.view-button, [data-view-go]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-view') || btn.getAttribute('data-view-go');
        state.view = v; showViews(); sendBench('SetView', v); saveState();
      });
    });
    var pip = $('pipette');
    pip.value = state.pipette;
    pip.addEventListener('change', function () {
      var v = Math.round(Number(pip.value));
      if (!(v >= 10 && v <= 1000)) { pip.setAttribute('data-state', 'wrong'); note('The micropipette takes 10 to 1000 µL.', 'blocked'); return; }
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
      $('print-checks').textContent = 'Unknown ' + state.code + '. Table 1 checked against the bench: ' +
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

  bind();
  buildFractions();
  buildQuestions();
  showViews();
  showBench();
})();
