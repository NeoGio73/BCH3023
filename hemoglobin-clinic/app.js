/*
 * The Hemoglobin Clinic: page logic for both sessions (Session 2, the gel, when opened with
 * ?part=2). Talks to the 3D bench (a Unity build in the canvas), keeps the student's work, shows
 * the bench's warnings (before a step that would go wrong) and its notes on mistakes (after one
 * has happened), the recipes with a check of each box, the predictions of what DdeI will show
 * (worked out here from the public reference sequence and the student's own primers), what is in
 * each tube and well, the thermocycler and the gel's live numbers, and the gel's picture with the
 * ladder's line and the size of every band, each checked against the student's own picture.
 *
 * The page does not know the patient: the bench holds the patient's DNA and works out what each
 * tube makes, and the page is never told until the gel shows it.
 */
(function () {
  'use strict';

  var M = window.DnaLabModel;
  var LOCUS = window.DnaLabLocus;
  var STORE_KEY = 'dna-lab:v1';
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
    var program = {};
    M.PROGRAM_FIELDS.forEach(function (f) { program[f.id] = f.def; });
    return {
      v: 1,
      code: code || M.randomCode(),
      name: '',
      bench: null,          // the bench as the 3D room last reported it
      fwd: '', rev: '',     // the primers as typed
      recipe: {},           // "tube/row" -> the volume typed
      pipette: 'p20',
      volumes: { p2: '1', p20: '10', p200: '100' },
      program: program,     // the program's boxes as typed
      view: 'setup',
      digest: {},           // row -> the volume typed
      predA: '', predS: '', // the predicted fragments
      // Session 2
      view2: 'agarose',
      gelPercent: '2', gelGrams: '',
      inputs: { agarose: '', tae: '50', microwave: '30', volts: '100' },
      picture: null,        // the latest picture of the gel, as the bench sent it
      ladder: {},           // ladder band (bp) -> the distance typed
      bands: [],            // { lane, mm, size } as typed
      // Session 1's BLAST, primer notes and sequencing recipe
      blast: {}, pbLength: '', pbOther: '', seqprep: {},
      // Session 2's trace, protein and diagnosis
      traces: {},           // tube -> { primer, heights } as the core sent them
      mixedText: {},        // tube -> the double peaks the student lists
      placeText: {},        // "tube/position" -> where in HBB the student says it is
      prot10: '',
      dx: { a1: '', a2: '', name: '', gel: '', trace: '', why: '' },
      tries: {}             // field -> how many times it was marked wrong
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
  var tick = { clock: 0, fast: false, running: false, phase: 'idle', tempC: 25, cycle: 0, secondsLeft: 0 };
  var extra = { tmFwd: null, tmRev: null, runTotal: 0 };

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

  function currentView() { return PART === 2 ? (state.view2 || 'agarose') : (state.view || 'setup'); }
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

  /** The bench's warning or note, with its buttons: [{ text, primary, onClick }]. */
  function alertBox(kind, text, buttons) {
    var box = $('alert-box');
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
    pipette: function (n) { return 'the ' + M.PIPETTES[n].name + ' (click to pick it up, or to put it back)'; },
    tips: function (n) { return n === 0 ? 'the 10 µL tips (for the P2)' : 'the 200 µL tips (for the P20 and the P200)'; },
    stock: function (n) { return M.STOCKS[n].name + ': click to draw'; },
    tube: function (n) { return 'the ' + M.TUBES[n].name + ' tube'; },
    bin: function () { return 'the bin for used tips'; },
    fuge: function () { return 'the microcentrifuge (click: a quick spin)'; },
    cycler: function () { return 'the thermocycler (click: put the capped tubes in, then close the lid)'; },
    digest: function (n) { return 'the digest of the ' + (n === 0 ? 'patient' : 'control') + '\u2019s product (with nothing in hand: into or out of the heat block)'; },
    heat: function () { return 'the heat block at 37 °C (click: both digests in, or out)'; },
    flask: function () { return 'the flask (click: swirl it)'; },
    microwave: function () { return 'the microwave (click: 30 s)'; },
    comb: function () { return 'the comb'; },
    tray: function () { return 'the casting tray (click: pour, take out the comb, then into the gel box)'; },
    gelbox: function () { return 'the gel box'; },
    well: function (n) { return 'well ' + n; },
    power: function () { return 'the power supply'; },
    bluebox: function () { return 'the blue-light box'; }
  };

  function heldText(b) {
    if (!b || !b.held) return 'Nothing in hand.';
    var p = M.PIPETTES.filter(function (x) { return x.id === b.held; })[0];
    if (!p) return '';
    var t = 'In hand: the ' + p.name + ', set to ' + M.ul(b.setUl[M.PIPETTES.indexOf(p)]) + ' µL';
    if (!b.tip) return t + ', no tip.';
    t += ', with a ' + b.tip + ' µL tip';
    if (b.tipLoaded) return t + ' holding ' + M.ul(b.tipUl) + ' µL of ' + M.stockName(b.tipLoaded).replace(/ \(.*\)$/, '').toLowerCase() + '.';
    return t + (b.tipUsed ? ' (used).' : ' (fresh).');
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
          // the primers already typed go into their tubes, if the bench does not have them yet
          if (msg.state && !msg.state.fwd && M.cleanSequence(state.fwd).length >= 15 && M.cleanSequence(state.rev).length >= 15)
            sendBench('Act', 'primers ' + M.cleanSequence(state.fwd) + ' ' + M.cleanSequence(state.rev));
        }
        state.bench = msg.state;
        extra.tmFwd = msg.tmFwd; extra.tmRev = msg.tmRev; extra.runTotal = msg.runTotal;
        extra.flaskC = msg.flaskC; extra.meltS = msg.meltS; extra.gelSet = msg.gelSet; extra.setIn = msg.setIn;
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
        note(M.blockedText(msg.reason), 'blocked');
        break;
      case 'mistake':
        alertBox('mistake', M.mistakeText(msg.code), [
          { text: 'Carry on', primary: true },
          { text: 'Start the set-up again', onClick: function () { act('redo'); } }
        ]);
        break;
      case 'notice':
        if (M.noticeText(msg.code)) note(M.noticeText(msg.code), 'info');
        break;
      case 'view':
        if (PART === 2) state.view2 = msg.view; else state.view = msg.view;
        showViews();
        saveState();
        break;
      case 'trace':
        state.traces[msg.tube] = { primer: msg.primer, heights: msg.heights };
        showTraces();
        showDiagnosis();
        saveState();
        break;
      case 'gel':
        state.picture = msg;
        showPicture();
        showSizes();
        saveState();
        break;
      case 'hover':
        if (msg.item && ITEM_NAMES[msg.item]) note('Click ' + ITEM_NAMES[msg.item](msg.n), 'hover');
        else if ($('stage-note').getAttribute('data-kind') === 'hover') note('');
        break;
    }
  }

  // ---- What the page shows ------------------------------------------------------------------------

  function showBench() {
    var b = state.bench;
    showSeqState();
    $('held-note').textContent = heldText(b);
    showPipette();
    showTubes();
    showPrimers();
    showWells();
    showClock();
  }

  // ---- Session 1: BLAST and the primers --------------------------------------------------------

  var BLAST_FIELDS = [
    ['gene', 'Gene (name or symbol)'], ['organism', 'Organism'], ['accession', 'Accession of the top hit'],
    ['identity', 'Per. Ident. (%)'], ['cover', 'Query Cover (%)'], ['evalue', 'E value']
  ];

  function readSeq() { return LOCUS ? LOCUS.reference.substring(LOCUS.readFrom, LOCUS.readTo) : ''; }

  function buildBlast() {
    var seq = readSeq();
    var lines = ['>patient read, 500 bases'];
    for (var i = 0; i < seq.length; i += 60) lines.push(seq.substr(i, 60));
    $('read-box').textContent = lines.join('\n');
    $('read-blast').href = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi?PROGRAM=blastn&PAGE_TYPE=BlastSearch&LINK_LOC=blasthome&QUERY=' + seq;
    var body = $('blast-body');
    body.textContent = '';
    BLAST_FIELDS.forEach(function (f) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, f[1]));
      var td = el('td');
      var input = el('input', { type: 'text', 'class': 'seq-input', 'aria-label': f[1] });
      input.value = state.blast[f[0]] || '';
      var msg = el('span', { 'class': 'msg' });
      function check() {
        var c = M.checkBlast(f[0], input.value);
        verdictOn(input, c.verdict === 'unsure' ? 'empty' : c.verdict, 'blast ' + f[0]);
        msg.textContent = c.hint && (c.verdict === 'no' || c.verdict === 'unsure') ? c.hint : c.verdict === 'bad' ? 'A number.' : '';
      }
      input.addEventListener('input', function () { state.blast[f[0]] = input.value; check(); saveState(); });
      check();
      td.appendChild(input); td.appendChild(msg); tr.appendChild(td);
      body.appendChild(tr);
    });
  }

  function showPrimerChecks() {
    var list = $('primer-checks');
    if (!list || !LOCUS) return;
    list.textContent = '';
    var f = M.cleanSequence(state.fwd), r = M.cleanSequence(state.rev);
    if (!f && !r) return;
    M.primerChecks(LOCUS, f, r).forEach(function (line) {
      list.appendChild(el('li', { 'data-ok': line.ok === null ? 'note' : line.ok ? 'yes' : 'no' }, line.text));
    });
    var pb = $('pb-length'), msg = $('pb-length-msg');
    var prod = f && r ? M.productOn(LOCUS.reference, f, r) : { error: 'short' };
    if (String(state.pbLength || '').trim() === '' || prod.error) { pb.removeAttribute('data-state'); msg.textContent = ''; }
    else {
      var ok = Math.round(M.num(state.pbLength)) === prod.length;
      verdictOn(pb, ok ? 'ok' : 'no', 'Primer-BLAST product length');
      msg.textContent = ok ? '' : 'That is not the length this pair gives on the reference: was it the pair you entered here?';
    }
  }

  // ---- Session 1: the tube for sequencing -----------------------------------------------------------

  var SEQ_NAMES = { product: '1. PCR product', cleanup: '2. Clean-up enzymes (then 15 min at 37 °C and 15 at 80 °C)', primer: '3. One primer, forward or reverse (10 µM)', water: '4. Water' };

  function buildSeqPrep() {
    var body = $('seqprep-body');
    body.textContent = '';
    M.SEQ_ROWS.forEach(function (row) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, SEQ_NAMES[row]));
      var td = el('td');
      var input = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input', 'aria-label': SEQ_NAMES[row] + ', µL' });
      input.value = state.seqprep[row] || '';
      var msg = el('span', { 'class': 'msg' });
      function check() {
        var c = M.checkSeq(row, input.value);
        verdictOn(input, c.verdict, 'sequencing ' + row);
        msg.textContent = c.verdict === 'no' ? c.hint : c.verdict === 'bad' ? 'A number, in µL.' : '';
      }
      input.addEventListener('input', function () { state.seqprep[row] = input.value; check(); saveState(); });
      check();
      td.appendChild(input); td.appendChild(msg); tr.appendChild(td);
      body.appendChild(tr);
    });
  }

  function showSeqState() {
    var b = state.bench, box = $('seq-state');
    if (!b || !b.seqs || !box) return;
    var t = tick.seqMin || [b.seqs[0].at37, b.seqs[0].at80, b.seqs[1].at37, b.seqs[1].at80];
    var bits = ['heat block at ' + (tick.heatC != null ? tick.heatC : b.heatC) + ' °C'];
    ['patient', 'control'].forEach(function (name, i) {
      var q = b.seqs[i];
      if (q.sent) { bits.push(name + ': sent'); return; }
      if (q.productUl + q.cleanupUl + q.primerUl + q.waterUl <= 0) return;
      bits.push(name + ': ' + M.ul(q.productUl + q.cleanupUl + q.primerUl + q.waterUl + q.otherUl) + ' µL, ' + Math.round(t[i * 2]) + ' min at 37 °C, ' + Math.round(t[i * 2 + 1]) + ' at 80' + (q.place === 'heat' ? ' (in the block)' : ''));
    });
    box.textContent = bits.join('; ');
  }

  // ---- Session 2: the traces ------------------------------------------------------------------------

  var TRACE_COLOURS = ['#1f9d3a', '#1f4fd1', '#17211e', '#d43c2c'];

  function showTraces() {
    var box = $('traces');
    if (!box) return;
    box.textContent = '';
    ['patient', 'control'].forEach(function (tube) {
      var t = state.traces[tube];
      if (!t) return;
      var rows = M.traceRows(t.heights);
      var calls = M.callBases(rows);
      var wrap = el('div', { 'class': 'trace-block' });
      wrap.appendChild(el('h3', { 'class': 'routine-title' }, (tube === 'patient' ? 'The patient' : 'The control (a known HbA/HbS carrier)') + ', read from the ' + (t.primer === 'rev' ? 'reverse' : t.primer === 'fwd' ? 'forward' : 'two') + ' primer' + (t.primer === 'both' ? 's' : '')));
      // the trace: 12 px a base, peaks drawn as smooth humps
      var px = 12, H = 150, top = 22, W = rows.length * px + 20;
      var scroll = el('div', { 'class': 'trace-scroll' });
      var g = svg('svg', { width: W, height: H + top + 18, 'class': 'trace-svg', role: 'img', 'aria-label': 'Sequencing trace, ' + rows.length + ' bases' });
      for (var c = 0; c < 4; c++) {
        var pts = [];
        for (var i = 0; i < rows.length; i++) {
          var x0 = 10 + i * px;
          [-0.5, -0.25, 0, 0.25, 0.5].forEach(function (d) {
            var hgt = rows[i][c] * Math.exp(-Math.pow(d / 0.22, 2));
            pts.push((x0 + d * px).toFixed(1) + ',' + (top + H - hgt / 1000 * H).toFixed(1));
          });
        }
        g.appendChild(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: TRACE_COLOURS[c], 'stroke-width': 1.1 }));
      }
      for (var k = 0; k < rows.length; k++) {
        var mixedHere = /[RYWSKM]/.test(calls[k]);
        g.appendChild(svg('text', { x: 10 + k * px, y: 14, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'monospace', fill: mixedHere ? '#d64545' : calls[k] === 'N' ? '#9aa5a1' : '#17211e', 'font-weight': mixedHere ? 700 : 400 }, calls[k]));
        if ((k + 1) % 10 === 0) g.appendChild(svg('text', { x: 10 + k * px, y: top + H + 14, 'text-anchor': 'middle', 'font-size': 9, fill: '#4b5854' }, String(k + 1)));
      }
      scroll.appendChild(g);
      wrap.appendChild(scroll);
      // the called sequence, for BLAST or translation
      var fasta = el('textarea', { rows: 3, readonly: 'readonly', 'class': 'called', 'aria-label': 'The called sequence' });
      fasta.value = calls;
      wrap.appendChild(el('p', { 'class': 'soft' }, 'The bases called (copy them to compare with the reference, or to translate):'));
      wrap.appendChild(fasta);
      wrap.appendChild(el('div', { 'class': 'print-only' }, calls));
      // the double peaks, read by the student
      var lab = el('label', { 'for': 'mixed-' + tube }, 'Where does this trace show two peaks? List each as its position and its two bases (e.g. "188 A/T"), or write "none"; if it becomes a mixture almost throughout, say from where.');
      var input = el('input', { type: 'text', id: 'mixed-' + tube, 'class': 'seq-input', autocomplete: 'off' });
      input.value = state.mixedText[tube] || '';
      var msg = el('span', { 'class': 'msg' });
      var places = el('div', { 'class': 'place-fields' });
      function check() {
        var cm = M.checkMixed(input.value, rows);
        verdictOn(input, cm.verdict, 'double peaks ' + tube);
        msg.textContent = cm.verdict === 'no' ? cm.hint : cm.verdict === 'bad' ? 'Write each as a position and two bases, e.g. 188 A/T.' : '';
        showPlaces(tube, t, rows, cm.verdict === 'ok', places);
      }
      input.addEventListener('input', function () { state.mixedText[tube] = input.value; saveState(); check(); showDiagnosis(); });
      wrap.appendChild(lab); wrap.appendChild(input); wrap.appendChild(msg); wrap.appendChild(places);
      box.appendChild(wrap);
      check();
    });
    $('results-msg').textContent = Object.keys(state.traces).length ? '' : '';
  }

  /** For each double peak, once they are listed right: where it is in HBB (codon and base, or intron and base). */
  function showPlaces(tube, t, rows, listed, box) {
    box.textContent = '';
    if (!listed || !LOCUS) return;
    var mixed = M.mixedPositions(rows);
    if (mixed.length === 0 || mixed.length > 15) return;
    mixed.forEach(function (m) {
      var key = tube + '/' + m.at;
      var i = M.traceToReference(LOCUS, state.bench.fwd, state.bench.rev, t.primer, m.at);
      var want = M.placeInGene(LOCUS, i);
      var line = el('p', { 'class': 'place-line' });
      var label = el('label', { 'for': 'place-' + key }, 'Position ' + m.at + ' (' + m.bases + ') is in HBB at ');
      var input = el('input', { type: 'text', id: 'place-' + key, 'class': 'seq-input short-seq', autocomplete: 'off', placeholder: 'codon 6, base 2' });
      input.value = state.placeText[key] || '';
      var msg = el('span', { 'class': 'msg' });
      function check() {
        var c = M.checkPlace(want, input.value);
        verdictOn(input, c.verdict, 'place ' + key);
        msg.textContent = c.verdict === 'no' ? c.hint : '';
      }
      input.addEventListener('input', function () { state.placeText[key] = input.value; saveState(); check(); });
      line.appendChild(label); line.appendChild(input); line.appendChild(msg);
      box.appendChild(line);
      check();
    });
  }

  // ---- Session 2: the protein --------------------------------------------------------------------------

  var viewer = null, viewerPdb = '';
  function showStructure(pdb) {
    var box = $('viewer');
    if (!box || !window.$3Dmol) { if (box) box.textContent = 'The 3D viewer needs an internet connection.'; return; }
    if (viewerPdb === pdb) return;
    viewerPdb = pdb;
    document.querySelectorAll('[data-pdb]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pdb') === pdb ? 'true' : 'false'); });
    if (!viewer) viewer = window.$3Dmol.createViewer(box, { backgroundColor: 'white' });
    viewer.clear();
    $('viewer-msg').textContent = 'Loading ' + pdb + ' from the Protein Data Bank...';
    fetch('https://files.rcsb.org/download/' + pdb + '.pdb').then(function (r) { return r.text(); }).then(function (text) {
      viewer.addModel(text, 'pdb');
      viewer.setStyle({}, { cartoon: { colorscheme: 'chain' } });
      viewer.setStyle({ hetflag: true }, { stick: { radius: 0.15 } });
      viewer.setStyle({ resn: 'HOH' }, {});
      // residue 6 of the beta chains (B and D; in 2HBS also F and H), as sticks with a label
      ['B', 'D', 'F', 'H'].forEach(function (ch) {
        viewer.addStyle({ chain: ch, resi: 6 }, { stick: { colorscheme: 'orangeCarbon', radius: 0.3 } });
      });
      viewer.addResLabels({ chain: 'B', resi: 6 }, { font: 'sans-serif', fontSize: 12, backgroundColor: '#17211e', backgroundOpacity: 0.7 });
      // the whole entry: in 2HBS that is two HbS molecules, the second where the first's Val6 sticks
      viewer.zoomTo();
      viewer.render();
      $('viewer-msg').textContent = pdb === '2HBS' ? 'Deoxy-HbS: residue 6 of each β chain (orange sticks) is valine.' : 'Deoxy-HbA: residue 6 of each β chain (orange sticks) is glutamate.';
    }).catch(function () { $('viewer-msg').textContent = 'The structure did not load (it needs an internet connection).'; });
  }

  // ---- Session 2: the diagnosis --------------------------------------------------------------------------

  /** The sizes the student listed for the lane where the patient's (or the control's) digest was loaded. */
  function digestSizes(which) {
    var b = state.bench;
    if (!b || !b.gel) return [];
    var lanes = [];
    b.gel.wells.forEach(function (w, i) { if (w.source === 'digest-' + which && w.ul > 0) lanes.push(String(i + 1)); });
    return state.bands.filter(function (r) { return lanes.indexOf(String(r.lane)) >= 0 && M.num(r.size) > 0; }).map(function (r) { return M.num(r.size); });
  }

  function showDiagnosis() {
    var list = $('dx-checks');
    if (!list) return;
    list.textContent = '';
    var d = state.dx;
    // the control: a known HbA/HbS carrier, checked in full (check 4)
    var pred = LOCUS && state.bench ? M.predictions(LOCUS, state.bench.fwd, state.bench.rev) : { error: 'short' };
    var cs = digestSizes('control');
    if (!pred.error && pred.hbS && cs.length) {
      var want = pred.hbA.concat(pred.hbS).filter(function (x, i, a) { return a.indexOf(x) === i; });
      var missing = want.filter(function (x) { return !cs.some(function (y) { return Math.abs(y - x) / x <= 0.06; }); });
      list.appendChild(el('li', { 'data-ok': missing.length ? 'no' : 'yes' }, missing.length ? 'The control\u2019s digest: a carrier of HbA and HbS should also show bands near ' + missing.join(', ') + ' bp.' : 'The control\u2019s digest shows what an HbA/HbS carrier gives.'));
    }
    var ct = state.traces.control;
    if (ct) {
      var cm = M.mixedPositions(M.traceRows(ct.heights));
      list.appendChild(el('li', { 'data-ok': cm.length === 1 ? 'yes' : 'no' }, cm.length === 1 ? 'The control\u2019s trace shows the one double peak of an HbA/HbS carrier.' : 'The control\u2019s trace does not look like a clean HbA/HbS carrier\u2019s: look at how its tube was prepared.'));
    }
    // the patient: only whether the conclusions agree with the student's own readings (check 3)
    if (String(d.a1 || '').trim() && String(d.a2 || '').trim()) {
      var pt = state.traces.patient;
      var mixed = pt ? M.mixedPositions(M.traceRows(pt.heights)).length : null;
      var dis = M.disagreements(d.a1, d.a2, digestSizes('patient'), mixed);
      if (dis.length === 0) list.appendChild(el('li', { 'data-ok': 'yes' }, 'Your two alleles agree with your own gel and trace. (Whether they are the patient\u2019s is for your instructor.)'));
      dis.forEach(function (t) { list.appendChild(el('li', { 'data-ok': 'no' }, t)); });
    }
  }

  // ---- The digests and the gel on the bench ------------------------------------------------------

  function showWells() {
    var b = state.bench;
    var body = $('well-body');
    if (!body) return;
    body.textContent = '';
    var wells = b && b.gel ? b.gel.wells : [];
    for (var i = 0; i < 10; i++) {
      var w = wells[i] || { ul: 0 };
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, String(i + 1)));
      var what = w.ul > 0 ? M.ul(w.ul) + ' µL of ' + (sourceName(w.source)) + (w.floated ? ' (floated out: no dye)' : '') : '';
      tr.appendChild(el('td', null, what));
      body.appendChild(tr);
    }
  }

  function sourceName(id) {
    var s = M.STOCKS.filter(function (x) { return x.id === id; })[0];
    return s ? s.name.replace(/ \(.*\)$/, '') : id;
  }

  function showGelState() {
    var b = state.bench, g = b ? b.gel : null;
    if (!g || PART !== 2) return;
    var flask = [];
    if (g.agaroseG > 0 || g.taeMl > 0) flask.push(M.ul(g.agaroseG) + ' g agarose in ' + Math.round(g.taeMl) + ' mL');
    var c = tick.flaskC != null ? tick.flaskC : extra.flaskC;
    if (g.heatS > 0) flask.push((g.heatS >= (extra.meltS || 1e9) ? 'melted' : 'not all melted') + ', ' + Math.round(c) + ' °C');
    if (g.stainUl > 0) flask.push(M.ul(g.stainUl) + ' µL stain');
    $('flask-state').textContent = g.poured ? 'Poured.' : flask.join('; ');
    var set = tick.setIn != null ? tick.setIn : extra.setIn;
    $('set-state').textContent = !g.poured ? (g.combIn ? 'The comb is in the tray.' : '') : set > 0 ? 'Setting: ' + M.clockText(set) + ' to go.' : g.combOut ? 'Set; the comb is out.' : 'Set.';
    var run = [];
    if (g.inBox) run.push('wells at the ' + (g.wellsAtBlack ? 'black (−)' : 'red (+)') + ' end');
    if (g.bufferIn) run.push('under TAE');
    if (g.lidOn) run.push('lid on');
    if (g.leads) run.push(g.leads === 'right' ? 'leads red to red' : 'leads crossed');
    if (g.volts) run.push(g.volts + ' V');
    var minutes = tick.gelRunMin != null ? tick.gelRunMin : g.runMin;
    if (minutes > 0) run.push('run ' + M.clockText(minutes));
    if (tick.powerOn || g.powerOn) run.push('power ON');
    $('run-state').textContent = run.join(', ');
  }

  // ---- The digest's recipe and the predictions -----------------------------------------------------

  var DIGEST_NAMES = { product: 'PCR product', dbuffer: 'Digest buffer (10x)', ddei: 'DdeI (10 units/µL)', water: 'Water' };

  function buildDigest() {
    var body = $('digest-body');
    body.textContent = '';
    M.DIGEST_ROWS.forEach(function (row) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, DIGEST_NAMES[row]));
      var td = el('td');
      var input = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input', 'aria-label': DIGEST_NAMES[row] + ' into each digest, µL' });
      input.value = state.digest[row] || '';
      var msg = el('span', { 'class': 'msg' });
      function check() {
        var c = M.checkDigest(row, input.value);
        input.setAttribute('data-state', c.verdict === 'empty' ? '' : c.verdict);
        msg.textContent = c.verdict === 'no' ? c.hint : c.verdict === 'bad' ? 'A number, in µL.' : '';
      }
      input.addEventListener('input', function () { state.digest[row] = input.value; check(); saveState(); });
      check();
      td.appendChild(input); td.appendChild(msg); tr.appendChild(td);
      body.appendChild(tr);
    });
  }

  var PRODUCT_ERRORS = {
    short: 'Enter both primers in part 1 first.',
    none: 'One of your primers is not in the reference sequence as written. Check it against Primer-BLAST.',
    facing: 'Your primers are both in the reference, but they do not face each other: write each one 5\u2032 to 3\u2032 on its own strand.',
    several: 'Your primers make more than one product from the reference.'
  };

  function showPredictions() {
    var f = M.cleanSequence(state.fwd), r = M.cleanSequence(state.rev);
    var p = LOCUS && f.length >= 15 && r.length >= 15 ? M.predictions(LOCUS, f, r) : { error: 'short' };
    $('pred-product').textContent = p.error ? PRODUCT_ERRORS[p.error] : 'On the reference, your primers make a product of ' + p.length + ' bp' + (p.covers ? '.' : ' that does not reach from the first codon to past codon 42.');
    [['a', 'hbA', 'predA'], ['s', 'hbS', 'predS']].forEach(function (k) {
      var input = $('pred-' + k[0]), msg = $('pred-' + k[0] + '-msg');
      if (document.activeElement !== input) input.value = state[k[2]] || '';
      var want = p.error ? null : p[k[1]];
      if (!want) { input.removeAttribute('data-state'); msg.textContent = p.error ? '' : k[0] === 's' ? 'Your primers give no product from an HbS allele: one of them sits on the sickle base.' : ''; return; }
      var c = M.checkSizes(input.value, want);
      input.setAttribute('data-state', c.verdict === 'empty' ? '' : c.verdict);
      msg.textContent = c.verdict === 'no' ? c.hint : '';
    });
  }

  // ---- The picture --------------------------------------------------------------------------------

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  /** The gel as the camera saw it: dark through the amber cover (bands orange-gold), blue without it. */
  function showPicture() {
    var box = $('gel-picture');
    if (!box) return;
    var pic = state.picture;
    if (!pic) return;
    box.textContent = '';
    var mmPx = 4, top = 30, left = 46, laneW = 34, lanes = pic.lanes.length;
    var W = left + lanes * laneW + 16, H = top + pic.length * mmPx + 20;
    var g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'gel-svg', role: 'img', 'aria-label': 'The gel under blue light, ' + lanes + ' lanes' });
    g.appendChild(svg('rect', { x: left - 6, y: top - 14, width: lanes * laneW + 12, height: pic.length * mmPx + 22, fill: pic.cover ? '#141008' : '#16285e', rx: 3 }));
    // the ruler
    for (var mm = 0; mm <= pic.length; mm += 5) {
      var y = top + mm * mmPx;
      g.appendChild(svg('line', { x1: left - 16, x2: left - (mm % 10 === 0 ? 8 : 12), y1: y, y2: y, stroke: '#4b5854', 'stroke-width': 1 }));
      if (mm % 10 === 0) g.appendChild(svg('text', { x: left - 19, y: y + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: '#4b5854' }, String(mm)));
    }
    g.appendChild(svg('text', { x: left - 19, y: top - 18, 'text-anchor': 'end', 'font-size': 9, fill: '#4b5854' }, 'mm'));
    for (var i = 0; i < lanes; i++) {
      var x = left + i * laneW + laneW / 2;
      g.appendChild(svg('text', { x: x, y: 12, 'text-anchor': 'middle', 'font-size': 11, fill: '#17211e' }, String(i + 1)));
      g.appendChild(svg('rect', { x: x - 11, y: top - 7, width: 22, height: 5, fill: pic.cover ? '#3a3020' : '#2c3f7a' }));
      pic.lanes[i].forEach(function (b) {
        var glow = pic.cover ? 'rgba(255,190,70,' + (0.35 + 0.65 * b.i).toFixed(2) + ')' : 'rgba(150,255,170,' + (0.15 + 0.4 * b.i).toFixed(2) + ')';
        g.appendChild(svg('rect', { x: x - 11, y: top + b.mm * mmPx - 1.6, width: 22, height: 3.2, rx: 1, fill: glow }));
      });
    }
    box.appendChild(g);
    box.appendChild(el('p', { 'class': 'soft' }, 'Picture ' + pic.photo + (pic.cover ? ', through the amber cover.' : ', without the amber cover: the blue light drowns the bands.') + (pic.lumpy ? ' The gel has lumps in it.' : '')));
  }

  // ---- The ladder's line and the bands' sizes -------------------------------------------------------

  function ladderLane() {
    var b = state.bench;
    if (!b || !b.gel) return -1;
    for (var i = 0; i < b.gel.wells.length; i++) if (b.gel.wells[i].source === 'ladder' && b.gel.wells[i].ul > 0) return i;
    return -1;
  }

  function laneBands(i) { return state.picture && state.picture.lanes[i] ? state.picture.lanes[i] : []; }

  function currentLine() {
    var lane = ladderLane();
    var rows = M.LADDER.map(function (bp) {
      var t = state.ladder[bp];
      var ok = lane >= 0 && M.checkMm(laneBands(lane), t).verdict === 'ok';
      return { bp: bp, mm: ok ? M.num(t) : 0 };
    });
    return M.ladderLine(rows);
  }

  function buildSizes() {
    var body = $('ladder-body');
    if (!body) return;
    body.textContent = '';
    M.LADDER.forEach(function (bp) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, String(bp)));
      var td = el('td');
      var input = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input short', 'aria-label': 'Distance of the ' + bp + ' bp band, mm' });
      input.value = state.ladder[bp] || '';
      var msg = el('span', { 'class': 'msg' });
      input.addEventListener('input', function () { state.ladder[bp] = input.value; saveState(); showSizes(); });
      td.appendChild(input); td.appendChild(msg); tr.appendChild(td);
      body.appendChild(tr);
    });
    buildBands();
  }

  function buildBands() {
    var body = $('band-body');
    body.textContent = '';
    state.bands.forEach(function (row, k) {
      var tr = el('tr');
      var lane = el('select', { 'aria-label': 'Lane' });
      for (var i = 1; i <= 10; i++) lane.appendChild(el('option', { value: String(i) }, String(i)));
      lane.value = row.lane || '2';
      var mm = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input short', 'aria-label': 'Distance, mm' });
      mm.value = row.mm || '';
      var size = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input', 'aria-label': 'Size, bp' });
      size.value = row.size || '';
      var del = el('button', { type: 'button', 'class': 'quiet-button' }, 'Remove');
      [lane, mm, size].forEach(function (inp) {
        inp.addEventListener('input', function () { row.lane = lane.value; row.mm = mm.value; row.size = size.value; saveState(); showSizes(); });
      });
      lane.addEventListener('change', function () { row.lane = lane.value; saveState(); showSizes(); });
      del.addEventListener('click', function () { state.bands.splice(k, 1); saveState(); buildBands(); showSizes(); });
      var c1 = el('td'), c2 = el('td'), c3 = el('td'), c4 = el('td');
      c1.appendChild(lane); c2.appendChild(mm); c2.appendChild(el('span', { 'class': 'msg' })); c3.appendChild(size); c3.appendChild(el('span', { 'class': 'msg' })); c4.appendChild(del);
      [c1, c2, c3, c4].forEach(function (c) { tr.appendChild(c); });
      body.appendChild(tr);
    });
    showSizes();
  }

  /** Marks a box with its verdict, and counts each time it turns wrong (the report lists the tries). */
  function verdictOn(input, verdict, key) {
    var was = input.getAttribute('data-state');
    input.setAttribute('data-state', verdict === 'empty' ? '' : verdict);
    if (key && verdict === 'no' && was !== 'no' && input === document.activeElement) {
      state.tries[key] = (state.tries[key] || 0) + 1;
      saveState();
    }
  }

  function mark(input, c, words) {
    verdictOn(input, c.verdict, input.getAttribute('aria-label'));
    var msg = input.parentNode.querySelector('.msg');
    if (msg) msg.textContent = c.verdict === 'no' ? c.hint : c.verdict === 'bad' ? words : '';
  }

  function showSizes() {
    var body = $('ladder-body');
    if (!body || PART !== 2) return;
    var lane = ladderLane();
    var inputs = body.querySelectorAll('input');
    M.LADDER.forEach(function (bp, k) {
      var c = lane < 0 ? { verdict: String(state.ladder[bp] || '') === '' ? 'empty' : 'no', hint: 'There is no ladder on your gel.' } : state.picture ? M.checkMm(laneBands(lane), state.ladder[bp]) : { verdict: 'empty' };
      mark(inputs[k], c, 'A number, in mm.');
    });
    var line = currentLine();
    $('ladder-msg').textContent = !line ? 'Measure at least three ladder bands for a line.' :
      'Your line: log10(size) = ' + line.intercept.toFixed(3) + ' ' + (line.slope < 0 ? '−' : '+') + ' ' + Math.abs(line.slope).toFixed(4) + ' × distance (from ' + line.n + ' bands; r² = ' + line.r2.toFixed(3) + ').';
    drawLadder(line);
    $('band-body').querySelectorAll('tr').forEach(function (tr, k) {
      var row = state.bands[k];
      if (!row) return;
      var ins = tr.querySelectorAll('input');
      var cm = M.checkMm(laneBands(Number(row.lane) - 1), row.mm);
      mark(ins[0], cm, 'A number, in mm.');
      mark(ins[1], cm.verdict === 'ok' ? M.checkSize(line, M.num(row.mm), row.size) : { verdict: String(row.size || '') === '' ? 'empty' : 'no', hint: 'Measure the band first.' }, 'A number, in bp.');
    });
  }

  function drawLadder(line) {
    var box = $('ladder-plot');
    box.textContent = '';
    var lane = ladderLane();
    var pts = M.LADDER.map(function (bp) { return { bp: bp, mm: M.num(state.ladder[bp]), ok: lane >= 0 && M.checkMm(laneBands(lane), state.ladder[bp]).verdict === 'ok' }; }).filter(function (p) { return p.ok; });
    var W = 300, H = 220, L = 46, B = 30, T = 10, R = 10;
    var g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'ladder-svg', role: 'img', 'aria-label': 'log of size against distance' });
    var xMax = 110, yMin = 1.8, yMax = 3.4;
    var X = function (mm) { return L + mm / xMax * (W - L - R); }, Y = function (lg) { return T + (yMax - lg) / (yMax - yMin) * (H - T - B); };
    g.appendChild(svg('line', { x1: L, y1: H - B, x2: W - R, y2: H - B, stroke: '#4b5854' }));
    g.appendChild(svg('line', { x1: L, y1: T, x2: L, y2: H - B, stroke: '#4b5854' }));
    [0, 20, 40, 60, 80, 100].forEach(function (mm) { g.appendChild(svg('text', { x: X(mm), y: H - B + 13, 'text-anchor': 'middle', 'font-size': 9, fill: '#4b5854' }, String(mm))); });
    [100, 200, 500, 1000, 2000].forEach(function (bp) { var lg = Math.log(bp) / Math.LN10; g.appendChild(svg('text', { x: L - 4, y: Y(lg) + 3, 'text-anchor': 'end', 'font-size': 9, fill: '#4b5854' }, String(bp))); });
    g.appendChild(svg('text', { x: (L + W) / 2, y: H - 3, 'text-anchor': 'middle', 'font-size': 9, fill: '#4b5854' }, 'distance (mm)'));
    pts.forEach(function (p) { g.appendChild(svg('circle', { cx: X(p.mm), cy: Y(Math.log(p.bp) / Math.LN10), r: 3, fill: '#1c4c9a' })); });
    // the line, kept inside the plot
    var clip = svg('clipPath', { id: 'ladder-clip' });
    clip.appendChild(svg('rect', { x: L, y: T, width: W - L - R, height: H - T - B }));
    g.appendChild(clip);
    if (line) g.appendChild(svg('line', { x1: X(0), y1: Y(line.intercept), x2: X(xMax), y2: Y(line.intercept + line.slope * xMax), stroke: '#d64545', 'stroke-width': 1.2, 'clip-path': 'url(#ladder-clip)' }));
    box.appendChild(g);
  }

  function showPipette() {
    var b = state.bench;
    var held = b ? b.held : '';
    document.querySelectorAll('#pipette-choice button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-pipette') === held ? 'true' : 'false');
    });
    var p = M.PIPETTES.filter(function (x) { return x.id === (held || state.pipette); })[0] || M.PIPETTES[1];
    $('pipette-range').textContent = p.name + ': ' + p.min + ' to ' + p.max + ' µL, ' + p.tips + ' tips';
    var box = $('pipette-ul');
    if (document.activeElement !== box) box.value = b ? M.ul(b.setUl[M.PIPETTES.indexOf(p)]) : state.volumes[p.id];
  }

  function showTubes() {
    var b = state.bench;
    var body = $('tube-body');
    body.textContent = '';
    var rows = [
      ['Water', function (r) { return r.water; }],
      ['Master mix', function (r) { return r.masterMix; }],
      ['Forward primer', function (r) { return r.fwd; }],
      ['Reverse primer', function (r) { return r.rev; }],
      ['DNA', function (r) { return (r.patientNg + r.controlNg) / 20; }],
      ['Total', function (r) { return r.masterMix + r.fwd + r.rev + r.water + r.other + (r.patientNg + r.controlNg) / 20; }]
    ];
    rows.forEach(function (row) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, row[0]));
      for (var t = 0; t < 3; t++) {
        var r = b && b.tubes && b.tubes[t] ? b.tubes[t].r : null;
        tr.appendChild(el('td', { 'class': 'col-num' }, r ? M.ul(row[1](r)) : '0'));
      }
      body.appendChild(tr);
    });
    var tr = el('tr');
    tr.appendChild(el('th', { scope: 'row' }, 'Now'));
    for (var t = 0; t < 3; t++) {
      var tb = b && b.tubes ? b.tubes[t] : null;
      var bits = [];
      if (tb) {
        bits.push(tb.capped ? 'capped' : 'open');
        if (tb.mixed) bits.push('mixed');
        if (tb.spun) bits.push('spun');
        bits.push(tb.place === 'cycler' ? 'in the thermocycler' : 'on ice');
        if (tb.cycled) bits.push('run done');
      }
      tr.appendChild(el('td', { 'class': 'tube-now' }, bits.join(', ')));
    }
    body.appendChild(tr);
  }

  function showPrimers() {
    var b = state.bench;
    var fwd = $('primer-fwd'), rev = $('primer-rev');
    if (document.activeElement !== fwd && !fwd.value) fwd.value = state.fwd;
    if (document.activeElement !== rev && !rev.value) rev.value = state.rev;
    var inTubes = b && b.fwd;
    $('tm-fwd').textContent = inTubes && extra.tmFwd != null ? M.cleanSequence(b.fwd).length + ' bases, Tm ' + extra.tmFwd.toFixed(1) + ' °C' : '';
    $('tm-rev').textContent = inTubes && extra.tmRev != null ? M.cleanSequence(b.rev).length + ' bases, Tm ' + extra.tmRev.toFixed(1) + ' °C' : '';
    $('primers-msg').textContent = inTubes ? 'Your primers are in their tubes on the ice.' : '';
  }

  var PHASES = { idle: 'Idle', heating: 'Heating', initial: 'Initial denaturation', denature: 'Denaturing', anneal: 'Annealing', extend: 'Extending', ramp: 'Changing temperature', final: 'Final extension', hold: 'Done: holding' };

  function showClock() {
    showGelState();
    showSeqState();
    var b = state.bench;
    var clock = tick.clock || (b ? b.clock : 0);
    $('clock').textContent = M.clockText(clock);
    var status = [];
    if (tick.running) status.push('thermocycler: ' + M.clockText(tick.secondsLeft / 60) + ' left');
    if (tick.digestMin && b && b.digests) b.digests.forEach(function (d, i) { if (d.place === 'heat') status.push('digest ' + (i === 0 ? 'patient' : 'control') + ': ' + M.clockText(tick.digestMin[i]) + ' at 37 °C'); });
    $('clock-status').textContent = status.join(' · ');
    $('speed-toggle').setAttribute('aria-pressed', tick.fast ? 'true' : 'false');
    var running = tick.running || (b && b.running);
    var done = b && b.runDone && !tick.running;
    // a finished run, before any tick has come (after a reload, say), is read from the saved bench
    $('cy-phase').textContent = running ? (PHASES[tick.phase] || 'Running') : done ? PHASES.hold : 'Idle';
    $('cy-temp').textContent = (done ? Number(b.program.holdC) : tick.tempC != null ? Number(tick.tempC) : 25).toFixed(1) + ' °C';
    $('cy-cycle').textContent = running ? (tick.cycle || 0) + ' of ' + b.program.cycles : done ? b.program.cycles + ' of ' + b.program.cycles : '–';
    $('cy-left').textContent = running ? M.clockText(tick.secondsLeft / 60) : '–';
  }

  function showViews() {
    document.querySelectorAll('.view-button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-view') === currentView() ? 'true' : 'false');
    });
  }

  // ---- The recipe --------------------------------------------------------------------------------

  var ROW_NAMES = { water: 'Water', mastermix: 'Master mix (2x)', fwd: 'Forward primer (10 µM)', rev: 'Reverse primer (10 µM)', dna: 'DNA (20 ng/µL)' };

  function buildRecipe() {
    var body = $('recipe-body');
    body.textContent = '';
    M.ROWS.forEach(function (row) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, ROW_NAMES[row]));
      M.TUBES.forEach(function (tube) {
        var td = el('td');
        var key = tube.id + '/' + row;
        var input = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input', 'aria-label': ROW_NAMES[row] + ' into the ' + tube.name + ' tube, µL' });
        input.value = state.recipe[key] || '';
        var msg = el('span', { 'class': 'msg' });
        function check() {
          var c = M.checkRecipe(tube.id, row, input.value);
          input.setAttribute('data-state', c.verdict === 'empty' ? '' : c.verdict);
          msg.textContent = c.verdict === 'no' ? c.hint : c.verdict === 'bad' ? 'A number, in µL.' : '';
        }
        input.addEventListener('input', function () { state.recipe[key] = input.value; check(); saveState(); showRecipeTotal(); });
        check();
        td.appendChild(input);
        td.appendChild(msg);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    showRecipeTotal();
  }

  function showRecipeTotal() {
    var ok = 0, all = 0;
    M.TUBES.forEach(function (t) { M.ROWS.forEach(function (r) { all++; if (M.checkRecipe(t.id, r, state.recipe[t.id + '/' + r]).verdict === 'ok') ok++; }); });
    $('recipe-msg').textContent = ok === all ? 'Every volume is right. Set each pipette to these as you fill the tubes.' : ok + ' of ' + all + ' volumes right.';
  }

  // ---- Controls ----------------------------------------------------------------------------------

  function bind() {
    $('unknown-code').textContent = state.code;
    document.querySelectorAll('[data-steps]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var steps = btn.getAttribute('data-steps');
        var v = PART === 1 ? (/^(un)?load|^lid|^run/.test(steps) ? 'cycler' : /heat/.test(steps) ? 'digest' : null)
          : (/^(comb|pour|swirl|redogel)/.test(steps) ? 'agarose' : /^(gelbox|buffer|boxlid|leads|power)/.test(steps) ? 'gel' : /^(image|blue|cover|photo)/.test(steps) ? 'imager' : null);
        if (v && currentView() !== v && currentView() !== 'room') setView(v);
        act(steps);
      });
    });
    document.querySelectorAll('.view-button').forEach(function (btn) {
      btn.addEventListener('click', function () { setView(btn.getAttribute('data-view')); });
    });
    $('speed-toggle').addEventListener('click', function () {
      var on = $('speed-toggle').getAttribute('aria-pressed') !== 'true';
      $('speed-toggle').setAttribute('aria-pressed', on ? 'true' : 'false');
      sendBench('SetSpeed', on ? '1' : '0');
    });

    // the primers
    ['fwd', 'rev'].forEach(function (k) {
      var box = $('primer-' + k);
      box.value = state[k];
      box.addEventListener('input', function () { state[k] = box.value; saveState(); });
    });
    $('primers-use').addEventListener('click', function () {
      var f = M.cleanSequence(state.fwd), r = M.cleanSequence(state.rev);
      if (f.length < 15 || r.length < 15) { $('primers-msg').textContent = 'Each primer needs 15 to 40 bases, written as A, C, G and T.'; return; }
      act('primers ' + f + ' ' + r);
    });

    // the pipette in hand and its volume
    var choice = $('pipette-choice');
    M.PIPETTES.forEach(function (p) {
      var btn = el('button', { type: 'button', 'class': 'quiet-button', 'data-pipette': p.id, 'aria-pressed': 'false' }, p.name);
      btn.addEventListener('click', function () {
        state.pipette = p.id;
        saveState();
        act('pipette ' + p.id);
      });
      choice.appendChild(btn);
    });
    function setVolume() {
      var b = state.bench;
      var p = b && b.held ? b.held : state.pipette;
      var v = M.num($('pipette-ul').value);
      if (isNaN(v)) { note('Type the volume in µL.', 'blocked'); return; }
      state.volumes[p] = String(v);
      saveState();
      act('set ' + p + ' ' + v);
    }
    $('pipette-set').addEventListener('click', setVolume);
    $('pipette-ul').addEventListener('keydown', function (e) { if (e.key === 'Enter') setVolume(); });

    // drawing and dispensing
    var drawSel = $('draw-stock'), tubeSel = $('dispense-tube');
    M.STOCKS.forEach(function (s) { if (!s.part || s.part === PART) drawSel.appendChild(el('option', { value: s.id }, s.name)); });
    M.TARGETS.forEach(function (t) { if (!t.part || t.part === PART) tubeSel.appendChild(el('option', { value: t.id }, t.name)); });

    // Session 1: the digest's recipe and the predictions
    ['a', 's'].forEach(function (k) {
      var input = $('pred-' + k);
      input.addEventListener('input', function () { state[k === 'a' ? 'predA' : 'predS'] = input.value; saveState(); showPredictions(); });
    });
    ['primer-fwd', 'primer-rev'].forEach(function (id) { $(id).addEventListener('input', function () { showPredictions(); showPrimerChecks(); }); });
    $('read-copy').addEventListener('click', function () {
      var text = readSeq();
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { $('read-msg').textContent = 'Copied.'; }, function () { $('read-msg').textContent = 'Select the read above and copy it.'; });
    });
    var pb = $('pb-length'), pbo = $('pb-other');
    pb.value = state.pbLength; pbo.value = state.pbOther;
    pb.addEventListener('input', function () { state.pbLength = pb.value; saveState(); showPrimerChecks(); });
    pbo.addEventListener('input', function () { state.pbOther = pbo.value; saveState(); });
    // Session 2: the results, the translation tool, the protein, the diagnosis, the report
    $('results-go').addEventListener('click', function () { if (currentView() !== 'computer') setView('computer'); act('results'); });
    $('tr-in').addEventListener('input', function () {
      var p = M.translate($('tr-in').value);
      $('tr-out').textContent = p ? p.split('').map(function (a) { return M.THREE[a] || a; }).join('-') + '   (' + p + ')' : '';
    });
    var p10 = $('prot-10');
    p10.value = state.prot10;
    function checkP10() {
      var c = LOCUS ? M.checkProtein(LOCUS, p10.value) : { verdict: 'empty' };
      verdictOn(p10, c.verdict, 'protein');
      $('prot-10-msg').textContent = c.verdict === 'no' ? c.hint : '';
    }
    p10.addEventListener('input', function () { state.prot10 = p10.value; saveState(); checkP10(); });
    checkP10();
    document.querySelectorAll('[data-pdb]').forEach(function (b) { b.addEventListener('click', function () { showStructure(b.getAttribute('data-pdb')); }); });
    ['a1', 'a2', 'name', 'gel', 'trace', 'why'].forEach(function (k) {
      var input = $('dx-' + k);
      input.value = state.dx[k] || '';
      // a printed copy of each box of writing (the print hides text boxes)
      var copy = null;
      if (input.tagName === 'TEXTAREA') { copy = el('div', { 'class': 'print-copy' }, input.value); input.parentNode.insertBefore(copy, input.nextSibling); }
      input.addEventListener('input', function () { state.dx[k] = input.value; if (copy) copy.textContent = input.value; saveState(); showDiagnosis(); });
    });
    var nm = $('student-name');
    nm.value = state.name || '';
    nm.addEventListener('input', function () { state.name = nm.value; saveState(); });
    $('print-report').addEventListener('click', function () {
      $('print-name').textContent = state.name || '';
      $('print-date').textContent = new Date().toLocaleDateString();
      var accepted = document.querySelectorAll('input[data-state="ok"]').length;
      var tries = Object.keys(state.tries).map(function (k) { return k + ': ' + state.tries[k]; });
      $('print-checks').textContent = 'Patient ' + state.code + '. Entries accepted by the page: ' + accepted + '. Entries marked wrong before they were right: ' +
        (tries.length ? tries.join('; ') : 'none') + '. The alleles and the diagnosis are not checked by the page.';
      window.print();
    });

    // Session 2: the gel's strength and its agarose
    var pct = $('gel-percent'), grams = $('gel-grams');
    pct.value = state.gelPercent; grams.value = state.gelGrams;
    function checkGrams() {
      var c = M.checkGrams(Number(pct.value), grams.value);
      grams.setAttribute('data-state', c.verdict === 'empty' ? '' : c.verdict);
      $('gel-grams-msg').textContent = c.verdict === 'no' ? c.hint : c.verdict === 'bad' ? 'A number, in g.' : '';
    }
    pct.addEventListener('change', function () { state.gelPercent = pct.value; saveState(); checkGrams(); });
    grams.addEventListener('input', function () { state.gelGrams = grams.value; saveState(); checkGrams(); });
    checkGrams();
    [['agarose', 'agarose'], ['tae', 'tae'], ['microwave', 'microwave'], ['volts', 'volts']].forEach(function (pair) {
      var input = $('in-' + pair[0]);
      if (state.inputs[pair[0]] != null) input.value = state.inputs[pair[0]];
      input.addEventListener('input', function () { state.inputs[pair[0]] = input.value; saveState(); });
      $('go-' + pair[0]).addEventListener('click', function () {
        var v = M.num(input.value);
        if (isNaN(v)) { note('Type a number first.', 'blocked'); return; }
        if (pair[0] !== 'volts' && currentView() !== 'agarose') setView('agarose');
        act(pair[1] + ' ' + v);
      });
    });
    $('band-add').addEventListener('click', function () { state.bands.push({ lane: '2', mm: '', size: '' }); saveState(); buildBands(); });
    $('draw-go').addEventListener('click', function () { act('draw ' + drawSel.value); });
    $('dispense-go').addEventListener('click', function () { act('dispense ' + tubeSel.value); });

    // caps and flicks, per tube
    var tb = $('tube-buttons');
    M.TUBES.forEach(function (t) {
      var line = el('span', { 'class': 'tube-line' }, t.name + ': ');
      [['cap', 'Cap'], ['uncap', 'Uncap'], ['flick', 'Flick']].forEach(function (pair) {
        var b = el('button', { type: 'button', 'class': 'quiet-button' }, pair[1]);
        b.addEventListener('click', function () { act(pair[0] + ' ' + t.id); });
        line.appendChild(b);
      });
      tb.appendChild(line);
    });

    // the thermocycler's program
    // one row for each step of the program: its name, its temperature, its time
    var grid = $('program-grid');
    var ROWS = [['Initial denaturation', 'initialC', 'initialS'], ['Cycles', 'cycles', null], ['Denature', 'denatureC', 'denatureS'],
      ['Anneal', 'annealC', 'annealS'], ['Extend', 'extendC', 'extendS'], ['Final extension', 'finalC', 'finalS']];
    function field(id, label) {
      var f = M.PROGRAM_FIELDS.filter(function (x) { return x.id === id; })[0];
      var lab = el('label', { 'class': 'program-field' });
      var input = el('input', { type: 'text', inputmode: 'decimal', 'class': 'num-input short', id: 'prog-' + f.id,
        'aria-label': label + (f.unit === 's' ? ', time in seconds' : f.unit ? ', temperature in °C' : ', how many') });
      input.value = state.program[f.id] != null ? state.program[f.id] : f.def;
      input.addEventListener('input', function () { state.program[f.id] = input.value; saveState(); });
      lab.appendChild(input);
      if (f.unit) lab.appendChild(el('span', { 'class': 'program-unit' }, f.unit));
      return lab;
    }
    ROWS.forEach(function (row) {
      grid.appendChild(el('span', { 'class': 'program-label' }, row[0]));
      grid.appendChild(field(row[1], row[0]));
      grid.appendChild(row[2] ? field(row[2], row[0]) : el('span'));
    });
    $('program-send').addEventListener('click', function () {
      var p = M.programStep(state.program);
      if (p.error) {
        var f = M.PROGRAM_FIELDS.filter(function (x) { return x.id === p.error; })[0];
        var row = ROWS.filter(function (r) { return r.indexOf(p.error) > 0; })[0];
        $('program-msg').textContent = 'Fill in every box of the program (' + (row ? row[0].toLowerCase() : f.id) + ').';
        $('prog-' + p.error).focus();
        return;
      }
      $('program-msg').textContent = '';
      act(p.step);
    });

    $('redo').addEventListener('click', function () { act('redo'); });
    $('start-over').addEventListener('click', function () { $('erase-confirm').hidden = false; $('erase-confirm').scrollIntoView({ block: 'center' }); });
    $('erase-no').addEventListener('click', function () { $('erase-confirm').hidden = true; });
    $('erase-yes').addEventListener('click', function () {
      $('erase-confirm').hidden = true;
      var code = state.code, name = state.name;
      state = blankState(code);
      state.name = name;
      saveState();
      closeAlert();
      $('primer-fwd').value = ''; $('primer-rev').value = '';
      M.PROGRAM_FIELDS.forEach(function (f) { $('prog-' + f.id).value = f.def; });
      buildRecipe();
      buildDigest();
      buildSizes();
      buildBlast();
      buildSeqPrep();
      showPredictions();
      showPrimerChecks();
      showTraces();
      $('gel-picture').innerHTML = '<p class="soft">No picture yet: put the gel on the blue-light box and take one.</p>';
      configureBench();
      showBench();
    });
  }

  // ---- Unity's loader --------------------------------------------------------------------------------

  window.DnaLab = {
    isMock: params.has('mock'),
    onUnityEvent: onUnityEvent,
    attachUnity: function (instance) { unity = instance; configureBench(); },
    unityProgress: function (p) { $('progress-fill').style.width = Math.round(p * 100) + '%'; },
    unityBanner: function (message, type) { if (type === 'error') note(message, 'blocked'); },
    unityFailed: function (error) { $('stage-status').textContent = 'The bench did not load: ' + error; },
    state: function () { return state; },
    // for tests: a message straight to the bench (e.g. bench('Advance', '80') moves its clock on)
    bench: function (method, value) { sendBench(method, value); }
  };

  // the page shows one session: number its sections in order
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
  buildRecipe();
  buildDigest();
  buildSizes();
  buildBlast();
  buildSeqPrep();
  showPredictions();
  showPrimerChecks();
  showTraces();
  showDiagnosis();
  if (PART === 2) showStructure('2HHB');
  showPicture();
  showViews();
  showBench();
})();
