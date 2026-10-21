/* The Enzyme's Handshake, Part 2 on the page (index.html?part=2): the lipase resolution of the
 * student's racemic alcohol, a button for every step (model2.js step), chromatograms from the chiral
 * GC (Unity works them out: Resolution.cs; this page draws them and prints the integrator's report),
 * and the checks of the student's own numbers. Work is kept in localStorage under
 * 'handshake-lab:v1:part2'; the code is the one Part 1 used.
 */
(function () {
  'use strict';
  var M = window.HandModel2, M1 = window.HandModel;
  var params = new URLSearchParams(window.location.search);
  var PART2 = params.get('part') === '2';
  var STORE_KEY = 'handshake-lab:v1:part2';

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }
  if (!$('part-lipase')) return;
  $('part-lipase').hidden = !PART2;
  if ($('part-yeast')) $('part-yeast').hidden = PART2;
  if (!PART2) { window.HandPart2 = { active: false }; return; }
  var lead = document.querySelector('.prelab-note');
  if (lead) lead.innerHTML = 'Session 2: a lipase sorts the two enantiomers of your racemic alcohol (session 1, the yeast, is <a href="index.html">this page without ?part=2</a>). Read the <a href="prelab/index.html">prelab review</a> first, topics 3, 5, 6 and 7 above all, and keep the <a href="guide/guide-to-the-lab.pdf">guide to the lab</a> (PDF) open beside it. Each step can be done in the room, with a click on the thing it uses, or with its button below.';

  // the student's code: the URL's, else Part 1's, else a new one
  function part1Code() { try { var p = JSON.parse(window.localStorage.getItem('handshake-lab:v1:part1') || 'null'); return p && p.code; } catch (e) { return null; } }
  function blank(code) { return { code: code, bench: M.blankBench(), info: null, gcs: {}, order: [], entries: {}, stopMmol: null, n: 0 }; }
  var state = null;
  try { state = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { state = null; }
  var wanted = M1.normalizeCode(params.get('code') || '');
  var code = M1.validCode(wanted) ? wanted : (state && state.code) || part1Code() || M1.newCode();
  if (!state || state.code !== code) state = blank(code);
  function save() { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not kept */ } }

  function note(text, kind) { var n = $('p2-note'); n.textContent = text || ''; n.setAttribute('data-kind', kind || ''); }

  function act(what) {
    if (!state.info) { note('The room is still loading: your alcohol comes from it.', 'blocked'); return; }
    var r = M.step(state.bench, what, state.info.enzymeMg);
    if (!r.ok) { note(M.TEXT[r.reason] || r.reason, 'blocked'); return; }
    var before = state.bench;
    state.bench = r.state;
    note(r.warning ? M.TEXT[r.warning] : '', r.warning ? 'warn' : '');
    var verb = what.split(' ')[0];
    if (verb === 'sample') {
      var smp = state.bench.samples[state.bench.samples.length - 1];
      gc('reaction', 'Sample at ' + fmtHours(smp.hours) + (smp.filtered ? '' : ', beads in the vial') + (smp.diluted ? '' : ', undiluted'), smp.hours + (smp.filtered ? 0 : 0.5), smp.diluted);
    }
    if (verb === 'stop') gc('reaction', 'The mixture at the stop, ' + fmtHours(state.bench.stopped), state.bench.stopped, true, true);
    save(); show(); tellRoom();
  }

  // ---- the GC: requests go to Unity, the replies are kept with the work -------------------------

  function run(hours) {
    var b = state.bench;
    return { hours: hours, tempC: b.tempC || 40, mg: b.enzymeMg || 0, equivalents: b.vinyl || 2.5, wet: b.hexane === 'wet' };
  }
  function gc(sample, label, hours, diluted, hidden) {
    var id = 'g' + (++state.n);
    state.gcs[id] = { id: id, label: label, sample: sample, hours: hours, diluted: diluted !== false, eluent: state.bench.eluent || '9:1', hidden: !!hidden, peaks: null };
    if (!hidden) state.order.push(id);
    ask(state.gcs[id]);
    return id;
  }
  function ask(g) {
    if (!window.HandLab || !window.HandLab.call) return;
    window.HandLab.call('Gc', JSON.stringify({ id: g.id, code: state.code, sample: g.sample, eluent: g.eluent, diluted: g.diluted, run: run(g.hours) }));
  }
  function onUnity(e) {
    if (e.type === 'part2') { state.info = e; save(); show(); return; }
    if (e.type === 'gc' && state.gcs[e.id]) {
      var g = state.gcs[e.id];
      g.peaks = e.peaks; g.alcohol = e.alcohol; g.acetate = e.acetate;
      if (g.hidden) state.stopMmol = { alcohol: e.alcohol, acetate: e.acetate };
      save(); show();
    }
  }
  function onConfigured() {
    window.HandLab.call('Part2', state.code);
    Object.keys(state.gcs).forEach(function (id) { if (!state.gcs[id].peaks) ask(state.gcs[id]); });
  }

  // ---- what is shown ------------------------------------------------------------------------------

  function fmtHours(h) { return h < 1 ? Math.round(h * 60) + ' min' : (Math.round(h * 10) / 10) + ' h'; }

  function groups() {
    var b = state.bench, i = state.info, mg = i ? (i.mw).toFixed(0) : '…', handout = i ? i.enzymeMg : 20;
    var vinylMl = (2.5 * M.VINYL_ACETATE.mw / 1000 / M.VINYL_ACETATE.density).toFixed(2);
    var haveGc = function (sample) { return state.order.some(function (id) { return state.gcs[id].sample === sample; }); };
    return [
      ['Setting up the resolution', [
        ['Weigh 1.00 mmol of your racemic alcohol (' + mg + ' mg) into a 20 mL vial', 'On the balance, by difference.', b.weighed, [['Weigh', 'weigh']]],
        ['Add ' + M.HEXANE_ML + ' mL of hexane', 'From the bottle kept dry over molecular sieves; water lets the lipase hydrolyse.', !!b.hexane, [['Dry hexane', 'hexane dry'], ['Hexane from the wash bottle', 'hexane wet']]],
        ['Add vinyl acetate, 2.5 equivalents (' + vinylMl + ' mL)', 'The acyl donor. The vinyl alcohol it frees turns into acetaldehyde, so the reaction cannot run back.', b.vinyl > 0, [['2.5 equiv', 'vinyl 2.5'], ['1 equiv', 'vinyl 1'], ['5 equiv', 'vinyl 5']]],
        ['Set the shaker incubator', 'About 40 °C, shaken.', b.tempC > 0, [['25 °C', 'shaker 25'], ['40 °C', 'shaker 40'], ['60 °C', 'shaker 60']]],
        ['Add ' + handout + ' mg of Novozym 435 beads (CAL-B) and start the clock', 'From the fridge; the beads are a respiratory sensitizer: no dust.', b.started, [['Add ' + handout + ' mg', 'enzyme ' + handout], ['Add ' + handout * 3 + ' mg', 'enzyme ' + handout * 3]]]
      ]],
      ['Following it on the chiral GC', [
        ['Run the racemic alcohol and the (R) standard', 'The racemic alcohol shows where both enantiomers come off; the pure (R) standard says which is which.', haveGc('racemic') && haveGc('standard'),
          [['Racemic alcohol', 'gc racemic'], ['(R) standard', 'gc standard']]],
        ['Let it shake', 'The bench clock: ' + (b.started ? fmtHours(b.stopped !== null ? b.stopped : b.hours) + ' with the enzyme.' : 'not started.'), b.stopped !== null,
          [['15 min', 'wait 0.25'], ['1 h', 'wait 1'], ['4 h', 'wait 4']]],
        ['Take a sample for the GC', 'A drop through a pipette filter (cotton) to hold back the beads, diluted in hexane.', b.samples.length > 0,
          [['Sample', 'sample'], ['Without the filter', 'sample unfiltered'], ['Undiluted', 'sample neat']]],
        ['Stop it near 50% conversion', 'Filter off the beads (they can be washed and used again).', b.stopped !== null, [['Stop', 'stop']]]
      ]],
      ['Separating the acetate from the alcohol', [
        ['Choose the eluent by TLC', 'Silica, hexanes : ethyl acetate; ' + (i && !i.uv ? 'no UV: stain with vanillin.' : 'under UV.'), b.tlc.length > 0,
          [['Hexane', 'tlc hexane'], ['9:1', 'tlc 9:1'], ['4:1', 'tlc 4:1'], ['1:1', 'tlc 1:1']]],
        ['Run the flash column', 'The acetate comes off first; combine fractions by TLC.', b.column,
          [['Hexane', 'column hexane'], ['9:1', 'column 9:1'], ['4:1', 'column 4:1'], ['1:1', 'column 1:1']]],
        ['Take off the solvent', i && i.volatile ? 'Your alcohol is volatile: a cold bath and gentle vacuum.' : 'On the rotary evaporator.', b.evaporated,
          [['Warm bath (40 °C)', 'evaporate warm'], ['Cold bath, gentle', 'evaporate cold']]],
        ['Weigh both fractions', 'In weighed flasks.', b.weighedFractions, [['Weigh', 'weighfractions']]],
        ['Run each fraction on the chiral GC', 'Diluted in hexane.', haveGc('acetate') && haveGc('alcohol'), [['Acetate fraction', 'gc acetate'], ['Alcohol fraction', 'gc alcohol']]]
      ]]
    ];
  }

  function press(what) {
    var parts = what.split(' ');
    if (parts[0] !== 'gc') return act(what);
    if (!state.info) return note('The room is still loading: your alcohol comes from it.', 'blocked');
    var kind = parts[1], b = state.bench;
    if ((kind === 'acetate' || kind === 'alcohol') && !b.weighedFractions) return note('Collect, evaporate and weigh the fractions first.', 'blocked');
    var label = kind === 'racemic' ? 'The racemic alcohol' : kind === 'standard' ? 'The (R) standard' : kind === 'acetate' ? 'The acetate fraction' : 'The alcohol fraction';
    gc(kind, label, kind === 'racemic' || kind === 'standard' ? 0 : b.stopped, true);
    note('', ''); save(); show();
  }

  function showSteps() {
    var box = $('p2-steps'); box.textContent = '';
    var nextFound = false;
    groups().forEach(function (g) {
      box.appendChild(el('h3', { 'class': 'routine-title' }, g[0]));
      var ol = el('ol', { 'class': 'routine' });
      g[1].forEach(function (s) {
        var next = !s[2] && !nextFound;
        if (next) nextFound = true;
        var li = el('li', { 'class': 'routine-step', 'data-state': s[2] ? 'done' : next ? 'next' : '' });
        li.appendChild(el('span', { 'class': 'routine-name' }, s[0]));
        li.appendChild(el('span', { 'class': 'routine-why' }, s[1]));
        var bs = el('span', { 'class': 'routine-buttons' });
        s[3].forEach(function (x) {
          var btn = el('button', { type: 'button', 'class': 'quiet-button' }, x[0]);
          btn.addEventListener('click', function () { press(x[1]); });
          bs.appendChild(btn);
        });
        li.appendChild(bs);
        ol.appendChild(li);
      });
      box.appendChild(ol);
    });
    var t = state.bench.tlc;
    $('p2-tlc').textContent = t.length ? 'TLC (silica): ' + t.map(function (e) {
      var rf = M.RF[e];
      return (e === 'hexane' ? 'hexane' : e + ' hexanes : ethyl acetate') + ', a spot at Rf ' + rf.acetate.toFixed(2) + ' (the acetate, from the reaction) and one at ' + rf.alcohol.toFixed(2) + ' (the alcohol)';
    }).join('; ') + '.' : '';
  }

  function showGcs() {
    var box = $('p2-gcs'); box.textContent = '';
    state.order.slice().reverse().forEach(function (id) {
      var g = state.gcs[id], wrap = el('figure', { 'class': 'gc-run' });
      wrap.appendChild(el('figcaption', {}, g.label + (g.sample === 'acetate' || g.sample === 'alcohol' ? ' (column run in ' + g.eluent + ')' : '')));
      if (!g.peaks) { wrap.appendChild(el('p', { 'class': 'soft small' }, 'Waiting for the GC…')); box.appendChild(wrap); return; }
      var cv = el('canvas', { width: 1200, height: 240, 'aria-label': 'Chromatogram: ' + g.label });
      wrap.appendChild(cv);
      drawGc(cv, g.peaks);
      var report = M.integrate(g.peaks), table = el('table', { 'class': 'data-table gc-report' });
      table.appendChild(el('caption', {}, 'Integrator report'));
      var head = el('tr'); ['Peak', 'Time (min)', 'Area', 'Area %'].forEach(function (h) { head.appendChild(el('th', { scope: 'col' }, h)); }); table.appendChild(head);
      report.forEach(function (p) {
        var tr = el('tr'); [String(p.n), p.t.toFixed(2), String(p.area), p.percent.toFixed(1)].forEach(function (v) { tr.appendChild(el('td', {}, v)); }); table.appendChild(tr);
      });
      if (!report.length) wrap.appendChild(el('p', { 'class': 'soft small' }, 'No peaks: nothing of your compounds in this vial.'));
      else wrap.appendChild(table);
      box.appendChild(wrap);
    });
  }

  /** A chromatogram: time across (0 to past the last peak), the detector's signal up; Gaussian peaks. */
  function drawGc(canvas, peaks) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, base = H - 34, top = 12;
    var end = Math.max(6, Math.ceil((peaks.length ? peaks[peaks.length - 1].t : 5) + 1));
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    var ys = [], most = 0;
    for (var px = 0; px < W; px++) {
      var t = px / W * end, y = 0;
      peaks.forEach(function (p) { var d = (t - p.t) / p.w; if (Math.abs(d) < 8) y += p.area / (p.w * 2.5066) * Math.exp(-0.5 * d * d); });
      ys.push(y); most = Math.max(most, y);
    }
    var scale = most > 0 ? (base - top) / most : 1;
    ctx.strokeStyle = '#1b2a3a'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (px = 0; px < W; px++) { var yy = base - ys[px] * scale; if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy); }
    ctx.stroke();
    ctx.strokeStyle = '#55606b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(W, base + 0.5); ctx.stroke();
    ctx.fillStyle = '#33404c'; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (var m = 0; m <= end; m++) { var x = m / end * W; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base + 5); ctx.stroke(); if (m > 0 && m < end) ctx.fillText(String(m), x, base + 19); }
    ctx.textAlign = 'right'; ctx.fillText('min', W - 4, base + 19);
    // the integrator's peak numbers over each peak it reports
    ctx.textAlign = 'center'; ctx.fillStyle = '#2f6f9f';
    M.integrate(peaks).forEach(function (p) {
      var x = p.t / end * W, i = Math.max(0, Math.min(W - 1, Math.round(x)));
      ctx.fillText(String(p.n), x, Math.max(top + 10, base - ys[i] * scale - 6));
    });
  }

  function latest(sample) {
    var ids = state.order.filter(function (id) { return state.gcs[id].sample === sample && state.gcs[id].peaks; });
    return ids.length ? state.gcs[ids[ids.length - 1]] : null;
  }

  function showResults() {
    var b = state.bench, box = $('p2-results'), i = state.info;
    box.hidden = !(b.weighedFractions && i && state.stopMmol);
    if (box.hidden) return;
    var f = M.fractions(i, b, state.stopMmol.alcohol, state.stopMmol.acetate);
    $('p2-masses').textContent = 'The balance: the acetate fraction weighs ' + f.acetate.toFixed(3) + ' g; the alcohol fraction ' + f.alcohol.toFixed(3) + ' g. You started with 1.00 mmol of the racemic alcohol (' + i.mw.toFixed(2) + ' g/mol); the acetate is ' + i.acetate + ' (' + i.acetateMw.toFixed(2) + ' g/mol).';
    ['ees', 'eep', 'conv', 'e', 'acyield', 'alcyield', 'faster', 'rule'].forEach(function (k) { var x = $('p2-' + k); if (x && document.activeElement !== x && x.type !== 'radio') x.value = state.entries[k] || ''; });
    document.querySelectorAll('input[name="p2-faster"]').forEach(function (r) { r.checked = state.entries.faster === r.value; });
    showChecks();
  }

  function showChecks() {
    var b = state.bench, i = state.info;
    if (!i || !state.stopMmol) return;
    var f = M.fractions(i, b, state.stopMmol.alcohol, state.stopMmol.acetate);
    var alc = latest('alcohol'), ac = latest('acetate');
    var checks = {
      ees: alc ? M.checkEe(M.integrate(alc.peaks), 'alcohol', state.entries.ees) : { kind: 'off', text: state.entries.ees ? 'Run the alcohol fraction on the GC first.' : '' },
      eep: ac ? M.checkEe(M.integrate(ac.peaks), 'acetate', state.entries.eep) : { kind: 'off', text: state.entries.eep ? 'Run the acetate fraction on the GC first.' : '' },
      conv: M.checkConversion(M.num(state.entries.ees), M.num(state.entries.eep), state.entries.conv),
      e: M.checkE(M.num(state.entries.conv), M.num(state.entries.ees), state.entries.e),
      acyield: M.checkPercent(f.acetate, 1.0, i.acetateMw, state.entries.acyield),
      alcyield: M.checkPercent(f.alcohol, 1.0, i.mw, state.entries.alcyield)
    };
    Object.keys(checks).forEach(function (k) {
      var m = $('p2-' + k + '-msg'), v = checks[k];
      m.textContent = v.kind === 'empty' ? '' : v.text; m.setAttribute('data-kind', v.kind || '');
    });
  }

  function show() {
    $('p2-code').textContent = state.code;
    var i = state.info;
    $('p2-alcohol').textContent = i ? i.name + ' (' + i.formula.replace(/(\d+)/g, function (d) { return d.split('').map(function (c) { return '₀₁₂₃₄₅₆₇₈₉'.charAt(+c); }).join(''); }) + ', ' + i.mw.toFixed(2) + ' g/mol)' : 'arriving from the room…';
    $('p2-handout').textContent = i ? 'Your handout gives ' + i.enzymeMg + ' mg of Novozym 435 for the 1.00 mmol.' : '';
    showSteps(); showGcs(); showResults();
  }

  ['ees', 'eep', 'conv', 'e', 'acyield', 'alcyield', 'rule'].forEach(function (k) {
    var x = $('p2-' + k); if (x) x.addEventListener('input', function () { state.entries[k] = x.value; save(); showChecks(); });
  });
  document.querySelectorAll('input[name="p2-faster"]').forEach(function (r) { r.addEventListener('change', function () { state.entries.faster = r.value; save(); }); });
  $('p2-reset').addEventListener('click', function () { $('p2-reset-confirm').hidden = false; });
  $('p2-reset-no').addEventListener('click', function () { $('p2-reset-confirm').hidden = true; });
  $('p2-reset-yes').addEventListener('click', function () {
    var info = state.info; state = blank(state.code); state.info = info; save(); $('p2-reset-confirm').hidden = true; note('', ''); show(); tellRoom();
  });

  // ---- the room's things: a click does the step that thing is for, at this point of the work ----

  function click(item) {
    var b = state.bench, i = state.info;
    switch (item) {
      case 'balance': return press(!b.weighed ? 'weigh' : 'weighfractions');
      case 'fridge': return press('enzyme ' + (i ? i.enzymeMg : 20));
      case 'shaker': return press(!b.tempC ? 'shaker 40' : 'wait 0.25');
      case 'gcport': return press(!b.started ? 'gc racemic' : b.stopped === null ? 'sample' : b.weighedFractions ? 'gc acetate' : 'sample');
      case 'tlc': return press('tlc 9:1');
      case 'column': return press('column 9:1');
      case 'rotavap': return press(i && i.volatile ? 'evaporate cold' : 'evaporate warm');
    }
  }
  var THINGS = {
    balance: 'The balance: a click weighs out your alcohol, or later the two fractions.',
    fridge: 'The fridge: a click takes out the Novozym 435 beads your handout gives and adds them.',
    shaker: 'The shaker incubator: a click sets it to 40 °C, then lets it shake for 15 minutes.',
    gcport: 'The GC with its chiral column: a click injects a sample (the racemic alcohol before the enzyme is in).',
    tlc: 'The TLC jar: a click runs a plate in 9:1 hexanes : ethyl acetate.',
    column: 'The flash column: a click runs it in 9:1 hexanes : ethyl acetate.',
    rotavap: 'The rotary evaporator: a click takes the solvent off the fractions.'
  };
  function hover(item) { if (window.HandLab && window.HandLab.hint) window.HandLab.hint(item ? THINGS[item] || '' : ''); }

  /** The room's picture of Part 2 (HandManager.BenchView): the vial in the shaker, the hexane, the beads until they are filtered off. */
  function roomView() {
    var b = state.bench;
    return { vial: b.weighed, vialLiquid: !!b.hexane, vialBeads: b.started && b.stopped === null, screen: '-----' };
  }
  function tellRoom() { if (window.HandLab && window.HandLab.show) window.HandLab.show(roomView()); }

  window.HandPart2 = { active: true, roomView: roomView, state: function () { return state; }, act: act, press: press, onUnity: onUnity, onConfigured: onConfigured, click: click, hover: hover };
  show();
})();
