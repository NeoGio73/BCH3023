/*
 * Introduction to Molecular Modeling: the lab page. The code at the top picks the student's unknown
 * (model.js, pool.js); its file is loaded into the viewer, and every answer is checked against
 * that same file as it is typed. Work is saved in this browser under 'molmod-lab:v1'.
 */
(function () {
  'use strict';
  var M = window.MolModModel, el = window.MolModUi.el;
  var KEY = 'molmod-lab:v1';
  function $(id) { return document.getElementById(id); }

  // ---- Saved work ----

  function blank(code) { return { v: 1, code: code, answers: {}, picture: null, name: '' }; }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.v === 1 && M.isCode(s.code)) return s;
    } catch (e) { /* storage may be blocked */ }
    return null;
  }
  var state = load();
  var params = new URLSearchParams(location.search);
  var requested = M.normalizeCode(params.get('code') || '');
  if (requested && M.isCode(requested) && (!state || state.code !== requested)) state = blank(requested);
  if (!state) state = blank(M.randomCode());
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  save();
  if (params.has('code') && history.replaceState) {
    params.delete('code');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  }

  var pool = window.MolModPool;
  var label = pool[M.unknownIndex(state.code, pool.length)];
  $('unknown-code').textContent = state.code;
  $('file-name').textContent = 'unknown-' + label + '.pdb';

  var pdb = null, facts = null, viewer = null, controls = null;

  // ---- The questions ----

  var AXIS_OPTIONS = M.AXIS_ENDS.map(function (a) { return [a, a.replace('-', '−')]; });
  var RESIDUE_OPTIONS = M.THREE_LETTER.map(function (r) { return [r, M.titleCase(r) + ' (' + M.AMINO[r][1] + ')']; });
  var YES_NO = [['yes', 'Yes'], ['no', 'No']];
  var AROMATIC_OPTIONS = [['TRP', 'Trp (tryptophan)'], ['TYR', 'Tyr (tyrosine)'], ['PHE', 'Phe (phenylalanine)'], ['none', 'None present']];

  // [id, label, kind ('select' with options, or 'text'), check(value) -> verdict]
  var QUESTIONS = {
    'axes-questions': M.VIEWS.filter(function (v) { return ['front', 'top', 'right'].indexOf(v.key) >= 0; }).map(function (v) {
      return ['view-' + v.key, v.name + ' view', AXIS_OPTIONS, function (a) { return M.check.view(v.key, a); }];
    }),
    'ends-questions': [
      ['nterm-resn', 'N-terminal residue', RESIDUE_OPTIONS, function (a) { return M.check.residue(facts.first, a, 'first'); }],
      ['nterm-num', 'Its number in the file', 'text', function (a) { return M.check.number(facts.first.resi, a, 'Point at an atom of the N-terminal residue: its number follows its name below the viewer.'); }],
      ['cterm-resn', 'C-terminal residue', RESIDUE_OPTIONS, function (a) { return M.check.residue(facts.last, a, 'last'); }],
      ['cterm-num', 'Its number in the file', 'text', function (a) { return M.check.number(facts.last.resi, a, 'Point at an atom of the C-terminal residue: its number follows its name below the viewer.'); }],
      ['first-1', 'First three residues: 1st', RESIDUE_OPTIONS, function (a) { return M.check.residue(facts.firstThree[0], a, 'first'); }],
      ['first-2', '2nd', RESIDUE_OPTIONS, function (a) { return M.check.residue(facts.firstThree[1], a, 'second'); }],
      ['first-3', '3rd', RESIDUE_OPTIONS, function (a) { return M.check.residue(facts.firstThree[2], a, 'third'); }],
      ['last-3', 'Last three residues (N to C): third from last', RESIDUE_OPTIONS, function (a) { return M.check.residue(facts.lastThree[0], a, 'third-from-last'); }],
      ['last-2', 'second from last', RESIDUE_OPTIONS, function (a) { return M.check.residue(facts.lastThree[1], a, 'second-from-last'); }],
      ['last-1', 'last', RESIDUE_OPTIONS, function (a) { return M.check.residue(facts.lastThree[2], a, 'last'); }]
    ],
    'sequence-questions': [
      ['seq-length', 'How many residues are in the chain?', 'text', function (a) { return M.check.number(facts.seqLength, a, 'Count the residue names in the SEQRES lines (the number just before the first name on each SEQRES line is the total).'); }]
    ],
    'shape-questions': [
      ['helix-count', 'How many helices do the HELIX lines list?', 'text', function (a) { return M.check.number(facts.helixCount, a, 'Count the lines of the file that begin with HELIX.'); }],
      ['helix-start', 'The longest helix starts at residue', 'text', function () { return M.check.longestHelix(facts, state.answers['helix-start'], state.answers['helix-end']); }],
      ['helix-end', 'and ends at residue', 'text', function () { return M.check.longestHelix(facts, state.answers['helix-start'], state.answers['helix-end']); }],
      ['strands', 'Does it have any β-strands?', YES_NO, function (a) { return M.check.yesNo(facts.hasStrands, a, 'Draw it as a Cartoon and look for flat arrows, or look for SHEET lines in the file.'); }],
      ['disulfides', 'How many disulfide bonds does the file list?', 'text', function (a) { return M.check.number(facts.disulfides, a, 'Count the SSBOND lines, or press Show: Cysteines and look for two sulfurs (yellow) bonded together.'); }]
    ],
    'sides-questions': [
      ['acidic', 'Acidic residues (Asp, Glu)', 'text', function (a) { return M.check.number(facts.acidic, a, 'Press Show: Acidic and count, or count ASP and GLU in the SEQRES lines.'); }],
      ['basic', 'Basic residues (Arg, His, Lys)', 'text', function (a) { return M.check.number(facts.basic, a, 'Press Show: Basic and count, or count ARG, HIS and LYS in the SEQRES lines.'); }],
      ['aromatic', 'Aromatic residues (Phe, Tyr, Trp)', 'text', function (a) { return M.check.number(facts.aromatic, a, 'Press Show: Aromatic and count, or count PHE, TYR and TRP in the SEQRES lines.'); }],
      ['largest-aromatic', 'The aromatic residue with the largest side chain', AROMATIC_OPTIONS, function (a) { return M.check.largestAromatic(facts, a); }]
    ],
    'angle-questions': [
      ['angle', 'N–Cα–C angle (degrees)', 'text', function (a) { return M.check.angle(facts, a); }]
    ]
  };

  var verdicts = {};

  function build() {
    Object.keys(QUESTIONS).forEach(function (boxId) {
      var box = $(boxId);
      QUESTIONS[boxId].forEach(function (q) {
        var field = el('label', { class: 'field' });
        field.appendChild(el('span', { class: 'field-name' }, q[1]));
        var input;
        if (q[2] === 'text') {
          input = el('input', { type: 'text', id: 'answer-' + q[0], autocomplete: 'off' });
          input.setAttribute('inputmode', q[0] === 'angle' ? 'decimal' : 'numeric');
        } else {
          input = el('select', { id: 'answer-' + q[0] });
          input.appendChild(el('option', { value: '' }, 'Choose'));
          q[2].forEach(function (o) { input.appendChild(el('option', { value: o[0] }, o[1])); });
        }
        input.value = state.answers[q[0]] || '';
        input.addEventListener(q[2] === 'text' ? 'input' : 'change', function () {
          state.answers[q[0]] = input.value;
          save();
          judgeAll();
        });
        field.appendChild(input);
        field.appendChild(el('span', { class: 'msg', id: 'msg-' + q[0] }));
        box.appendChild(field);
      });
    });
    ['sequence', 'angle-why', 'others', 'protein', 'organism', 'accession', 'identity', 'role'].forEach(function (k) {
      var input = $('answer-' + k);
      input.value = state.answers[k] || '';
      input.addEventListener('input', function () { state.answers[k] = input.value; save(); if (k === 'sequence') judgeAll(); });
    });
    $('student-name').value = state.name || '';
    $('student-name').addEventListener('input', function () { state.name = $('student-name').value; save(); });
  }

  function show(id, verdict) {
    var input = $('answer-' + id), msg = $('msg-' + id);
    verdicts[id] = verdict;
    if (!verdict) { input.removeAttribute('data-state'); msg.textContent = ''; return; }
    input.setAttribute('data-state', verdict.ok ? 'ok' : 'bad');
    msg.textContent = verdict.ok ? '' : verdict.tip || '';
  }

  function judgeAll() {
    if (!facts) return;
    Object.keys(QUESTIONS).forEach(function (boxId) {
      QUESTIONS[boxId].forEach(function (q) { show(q[0], q[3](state.answers[q[0]])); });
    });
    show('sequence', M.check.sequence(facts.sequence, state.answers.sequence));
    var ends = ['nterm-resn', 'nterm-num', 'cterm-resn', 'cterm-num'].every(function (k) { return verdicts[k] && verdicts[k].ok; });
    $('ends-confirm').hidden = !ends;
    $('helix-take').hidden = !(verdicts['helix-start'] && verdicts['helix-start'].ok);
    var seqOk = verdicts.sequence && verdicts.sequence.ok;
    $('blast-ncbi').href = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi?PROGRAM=blastp&PAGE_TYPE=BlastSearch' +
      (seqOk ? '&QUERY=' + facts.sequence : '');
    $('copy-sequence').disabled = !seqOk;
    $('copy-status').textContent = seqOk ? '' : 'Finish the sequence in part 4 first.';
  }

  // ---- Take me there ----

  function wire() {
    $('take-ends').addEventListener('click', function () {
      viewer.focus([facts.first.resi, facts.last.resi]);
      controls.pressShow(null);
    });
    $('take-nterm').addEventListener('click', function () { viewer.focus(facts.firstThree.map(function (r) { return r.resi; }), { labels: true }); });
    $('take-cterm').addEventListener('click', function () { viewer.focus(facts.lastThree.map(function (r) { return r.resi; }), { labels: true }); });
    $('take-helix').addEventListener('click', function () {
      var h = facts.longestHelices[0];
      controls.pressStyle('cartoonsticks');
      controls.pressView('');
      viewer.downHelix(h.start, h.end);
    });
    $('take-angle').addEventListener('click', function () {
      viewer.focus([facts.angleResidue.resi], { labels: true });
      controls.pressMeasure('angle');
      $('readout-measure').textContent = 'Click three atoms: N, then CA, then C.';
    });
    $('copy-sequence').addEventListener('click', function () {
      var text = facts.sequence;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
        $('copy-status').textContent = 'Copied. Paste it into BLAST.';
      }, function () { $('copy-status').textContent = text; });
    });
    $('take-picture').addEventListener('click', function () {
      // The viewer's picture, made smaller as a JPEG so that it keeps in the browser's storage.
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1000 / img.width);
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        var g = c.getContext('2d');
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        state.picture = c.toDataURL('image/jpeg', 0.85);
        save();
        showPicture();
        $('picture-status').textContent = 'Saved for your report.';
      };
      img.onerror = function () { $('picture-status').textContent = 'The picture could not be taken in this browser.'; };
      try { img.src = viewer.viewer.pngURI(); }
      catch (e) { $('picture-status').textContent = 'The picture could not be taken in this browser.'; }
    });
    window.addEventListener('beforeprint', function () {
      [].forEach.call(document.querySelectorAll('textarea'), function (t) {
        var copy = t.nextElementSibling && t.nextElementSibling.classList.contains('print-copy') ? t.nextElementSibling : null;
        if (!copy) { copy = el('div', { class: 'print-copy' }); t.parentNode.insertBefore(copy, t.nextSibling); }
        copy.textContent = t.value || ' ';
      });
    });
    $('print-report').addEventListener('click', function () {
      $('print-name').textContent = state.name ? 'Name: ' + state.name : '';
      $('print-date').textContent = new Date().toLocaleDateString();
      $('print-checks').textContent = summary();
      window.print();
    });
    $('start-over').addEventListener('click', function () { $('start-confirm').hidden = false; });
    $('start-no').addEventListener('click', function () { $('start-confirm').hidden = true; });
    $('start-yes').addEventListener('click', function () {
      state = blank(state.code); save(); location.reload();
    });
  }

  function showPicture() {
    $('report-picture').hidden = !state.picture;
    if (state.picture) $('report-img').src = state.picture;
  }

  function summary() {
    var ids = Object.keys(verdicts).filter(function (k) { return verdicts[k]; });
    var ok = ids.filter(function (k) { return verdicts[k].ok; }).length;
    var all = Object.keys(QUESTIONS).reduce(function (n, b) { return n + QUESTIONS[b].length; }, 0) + 1;
    return 'Unknown ' + state.code + ' (file ' + label + '). Checked by the lab page: ' + ok + ' of ' + all +
      ' answers accepted. Parts 7 (the comparison), 8 and 9 are not checked by the page.';
  }

  // ---- Start ----

  build();
  wire();
  showPicture();

  if (!window.$3Dmol) {
    $('stage-status').textContent = 'The 3D viewer needs an internet connection. Connect and reload the page.';
    $('stage-cover').setAttribute('data-state', 'failed');
    return;
  }
  viewer = window.MolModViewer($('stage'), {
    onPoint: function (d) { controls && controls.point(d); },
    onMeasure: function (m) { controls && controls.measured(m); }
  });
  controls = window.MolModControls(viewer, { controls: $('tools'), readout: $('readout'), fullscreen: $('bench') });

  fetch('unknowns/' + label + '.pdb').then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.text();
  }).then(function (text) {
    pdb = M.parsePdb(text);
    facts = M.facts(pdb, state.code);
    $('pdb-text').textContent = text;
    $('angle-residue').textContent = M.residueName(facts.angleResidue);
    viewer.load(text);
    $('stage-cover').hidden = true;
    judgeAll();
    window.MolModLab = { state: state, facts: facts, viewer: viewer, label: label };
  }).catch(function () {
    $('stage-status').textContent = 'Your protein\'s file did not load. Check your connection and reload the page.';
    $('stage-cover').setAttribute('data-state', 'failed');
  });
})();
