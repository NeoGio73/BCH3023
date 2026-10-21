/* The Enzyme's Handshake, Part 1 on the page: every step of the yeast reduction has a button, so the
 * routine (model.js step) can be tried before the bench in the room is built for it. The student's
 * fermentation recipe comes from their code. Work is kept in localStorage under 'handshake-lab:v1:part1'.
 */
(function () {
  'use strict';
  var M = window.HandModel;
  var params = new URLSearchParams(window.location.search);
  var STORE_KEY = 'handshake-lab:v1:part1';

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function blank(code) {
    return { code: code, bench: M.blankBench(), entries: {}, sample: null, filled: false, blanked: false, bubble: false, reading: null, polarimeterUsed: false,
      nmr: { made: false, run: false, range: 'main' } };
  }
  var state = null;
  try { state = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { state = null; }
  var wanted = M.normalizeCode(params.get('code') || '');
  if (!state || !state.bench || (wanted && M.validCode(wanted) && state.code !== wanted)) state = blank(M.validCode(wanted) ? wanted : M.newCode());
  if (!state.nmr) state.nmr = { made: false, run: false, range: 'main' };
  function save() { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* not kept */ } }

  var pick = M.picks(state.code), recipe = M.RECIPES[pick.recipe];
  // the round-bottomed flask's weight empty, and the sample's, from the code (as a real one would differ)
  var seedNumber = parseInt(state.code.replace(/[^0-9]/g, '') || '7', 10);
  var TARE = 48.0 + (seedNumber % 37) * 0.073;

  function note(code, kind) {
    var n = $('p1-note');
    n.textContent = code ? M.BENCH_TEXT[code] || code : '';
    n.setAttribute('data-kind', kind || '');
  }

  function act(what) {
    var r = M.step(pick.recipe, state.bench, what);
    if (!r.ok) { note(r.reason, 'blocked'); return; }
    state.bench = r.state;
    note(r.warning, r.warning ? 'warn' : '');
    save(); show(); tellRoom();
  }

  // ---- the room: what it shows, and what a click on a thing in it does ---------------------------

  /** The bench as the room draws it (HandManager.BenchView): plain flags and numbers. */
  function roomView() {
    var b = state.bench, h = since(), planned = M.plannedHours(pick.recipe);
    var volume = (b.water || 0) + (b.yeast ? 23 : 0) + (b.fed ? recipe.feedWater : 0);
    // a fermenting culture foams; starved yeast (no sugar) hardly does, and the foam falls once the sugar is used up
    var foam = !b.yeast || !b.alive ? 0 : recipe.sugar === 0 ? 0.25 : h > planned + 12 ? 0.35 : Math.min(1, 0.3 + h / 2);
    return {
      water: b.water > 0, yeast: b.yeast > 0, alive: b.alive === true, filtered: b.filtered, bed: b.bed,
      filtrate: b.filtered && b.extractions === 0, layers: b.extractions > 0 && !b.gravity, emulsion: b.emulsion,
      level: volume > 0 ? volume / 225 : 1, foam: foam,
      // the polarimeter: the solution made up, where the tube is and what is in it, what the display reads
      solution: state.sample !== null, cell: state.filled ? 2 : state.blanked ? 1 : 0, bubble: !!state.bubble, screen: screenText()
    };
  }
  /** What the polarimeter's display reads: dashes until it is zeroed, then 0.000, then the last angle read. */
  function screenText() {
    if (state.reading !== null) return (state.reading < 0 ? '-' : '+') + Math.abs(state.reading).toFixed(3);
    return state.blanked ? '0.000' : '-----';
  }
  function say(text, kind) { $('p1-note').textContent = text; $('p1-note').setAttribute('data-kind', kind || ''); }
  function tellRoom() { if (window.HandLab && window.HandLab.show) window.HandLab.show(roomView()); }

  /** A click on a thing in the room: the step that thing is for, at this point of the work. */
  function click(item) {
    var b = state.bench, next = recipe.portions[b.added.length];
    switch (item) {
      case 'bath': return act('bath 30');
      case 'flask': return act(b.water ? 'tlc' : 'water');
      case 'sugar':
        if (b.yeast && recipe.feedSugar && !b.fed && b.added.length >= 1) return act('feed');
        return act('sugar ' + recipe.sugar);
      case 'yeast': return act('yeast ' + recipe.yeast);
      case 'substrate': return next ? act('substrate ' + next[1]) : note('', '') || ($('p1-note').textContent = 'All of your ethyl acetoacetate is in.');
      case 'timer': return act('wait 6');
      case 'tlc': return act('tlc');
      case 'celite': return act(b.bed ? 'celite' : 'bed');
      case 'buchner': return act(b.bed ? 'filter' : 'bed');
      case 'salt': return act('salt');
      case 'funnel': return act(b.emulsion ? 'clear wait' : 'extract gentle');
      case 'brine': return act(b.emulsion ? 'clear brine' : 'brine');
      case 'mgso4': return act('mgso4');
      case 'rotavap': return act(!b.gravity ? 'gravity' : b.wet ? 'redry' : 'evaporate');
      case 'balance': return act('weigh');
      // the polarimeter's three things: the flask makes up the solution; the tube is filled for the blank, then with the solution; the instrument zeroes, then reads
      case 'volflask': return b.weighed ? polarimeter('sample') : say(WEIGH_FIRST, 'blocked');
      case 'tube': return !b.weighed ? say(WEIGH_FIRST, 'blocked') : polarimeter(state.blanked ? 'fill' : 'blank');
      case 'polarimeter': return !b.weighed ? say(WEIGH_FIRST, 'blocked') : polarimeter(state.blanked ? 'read' : 'blank');
      // the NMR: the sample is made at the sample table, the spectrum run at the magnet
      case 'nmrsample': return nmrStep('sample');
      case 'magnet': return nmrStep('run');
    }
  }
  var WEIGH_FIRST = 'Weigh your product first: the balance, once the solvent is off on the rotary evaporator.';

  /** What each thing in the room is, for the line under the room while the pointer is over it. */
  var THINGS = {
    bath: 'The water bath: a click sets it to 30 °C.', flask: 'The 1 L flask on the stirrer: a click pours in the warm water, or later runs a TLC of the broth.',
    sugar: 'Sucrose: a click weighs out and adds it.', yeast: 'Baker’s yeast: a click weighs out and adds it.',
    substrate: 'Ethyl acetoacetate: a click weighs out and adds the next portion.', timer: 'The bench timer: a click runs the clock on 6 hours.',
    tlc: 'The TLC jar: a click runs a TLC of the broth.', celite: 'Celite 545: a click builds the bed, then stirs Celite into the broth.',
    buchner: 'The Büchner funnel on its filter flask: a click filters the broth by suction.', salt: 'Sodium chloride: a click saturates the filtrate.',
    funnel: 'The separatory funnel: a click runs one gentle extraction with ethyl acetate.', brine: 'Brine: a click washes the ethyl acetate (or breaks an emulsion).',
    mgso4: 'Magnesium sulfate: a click adds a portion to dry the ethyl acetate.', rotavap: 'The rotary evaporator: a click filters off the drying agent, then takes off the solvent.',
    balance: 'The balance: a click weighs the flask with the product.',
    volflask: 'The 25 mL volumetric flask: a click weighs about 0.25 g of your product into it and fills it to the mark with chloroform (in the hood).',
    tube: 'The 100 mm polarimeter tube: a click fills it with chloroform for the blank, or, once the zero is set, rinses it and fills it carefully with your solution.',
    polarimeter: 'The digital polarimeter: a click zeroes it on the blank, or, with your solution in the tube, reads the angle.',
    nmrsample: 'The NMR sample table: a click dissolves about 20 mg of your product in 0.6 mL of CDCl₃ in an NMR tube.',
    magnet: 'The 400 MHz NMR: a click puts your sample in and runs its ¹H spectrum.'
  };
  function hover(item) { if (window.HandLab && window.HandLab.hint) window.HandLab.hint(item ? THINGS[item] || '' : ''); }

  // ---- what each step is, and when it is done ------------------------------------------------------

  function since() { var b = state.bench; return b.yeastAt === null ? 0 : b.hours - b.yeastAt; }
  function clockText() {
    var b = state.bench;
    if (b.yeastAt === null) return 'Bench clock: the yeast is not in yet.';
    var h = since(), d = Math.floor(h / 24);
    return 'Bench clock: ' + (d ? d + (d === 1 ? ' day ' : ' days ') : '') + Math.round(h - 24 * d) + ' h since the yeast went in.' +
      ' Your recipe runs about ' + Math.round(M.plannedHours(pick.recipe)) + ' h in all.';
  }

  function groups() {
    var b = state.bench, out = [];
    var wake = [
      ['Set the water bath', 'Warm water wakes the yeast; water too hot kills it.', b.bath > 0, [['30 °C', 'bath 30'], ['40 °C', 'bath 40'], ['60 °C', 'bath 60']]],
      ['Pour in ' + recipe.water + ' mL of warm ' + (recipe.ethanol ? '5% ethanol' : 'tap water'), 'Into the 1 L flask on the stirrer.', b.water > 0, [['Pour', 'water']]]
    ];
    if (recipe.sugar) wake.push(['Weigh and add ' + recipe.sugar + ' g of sucrose', 'The yeast’s food: fermenting it makes the NADPH that reduces the ketone.', b.sugar > 0, [['Add', 'sugar ' + recipe.sugar]]]);
    wake.push(['Weigh and add ' + recipe.yeast + ' g of baker’s yeast', recipe.ethanol ? 'Starved for 4 days in the 5% ethanol, shaken, in air.' : 'Then stir for an hour at about 30 °C: it foams.', b.yeast > 0, [['Add', 'yeast ' + recipe.yeast]]]);
    out.push(['Waking the yeast', wake]);

    var feed = [];
    recipe.portions.forEach(function (p, i) {
      feed.push([(recipe.portions.length > 1 ? 'Portion ' + (i + 1) + ': ' : '') + p[1].toFixed(p[1] < 1 ? 3 : 2) + ' g of ethyl acetoacetate, ' + p[0] + ' h after the yeast',
        i === 0 ? 'Weighed on the balance and stirred in.' : 'Let the clock run until it is time.', b.added.length > i, [['Add', 'substrate ' + p[1]]]]);
      if (i === 1 && recipe.feedSugar) feed.splice(feed.length - 1, 0, ['Second feed: ' + recipe.feedSugar + ' g of sucrose in ' + recipe.feedWater + ' mL of warm water', 'An hour before the second portion, as in Org. Synth.', b.fed, [['Add', 'feed']]]);
    });
    feed.push(['Let the time pass', 'Stirred (or shaken), open to the air. The bench clock runs fast.', since() >= M.plannedHours(pick.recipe), [['1 hour', 'wait 1'], ['6 hours', 'wait 6'], ['A day', 'wait 24']]]);
    feed.push(['Run a TLC of the broth', 'Vanillin stain: ethyl acetoacetate is an intense blue spot (Rf 0.45 in 1:1 ether : hexane). Go on when it is gone.',
      b.tlc.length > 0 && !b.tlc[b.tlc.length - 1].ketone, [['Run it', 'tlc']]]);
    out.push(['The substrate, and the days', feed]);

    out.push(['The work-up', [
      ['Build a Celite bed in the Büchner funnel', 'A slurry suctioned onto the paper, 2 to 3 mm; then empty the flask. Celite dust harms the lungs: keep it wet.', b.bed, [['Build it', 'bed']]],
      ['Stir Celite into the broth', 'It keeps the yeast from clogging the bed.', b.celite, [['Stir in', 'celite']]],
      ['Filter by suction', 'The flask clamped, a trap before the pump. The product is in the filtrate.', b.filtered, [['Filter', 'filter']]],
      ['Saturate the filtrate with NaCl', 'Salting out: the alcohol likes water, and salt pushes it out.', b.salted, [['Add salt', 'salt']]],
      ['Extract with 50 mL of ethyl acetate (three times)', 'Invert gently and vent. Ethyl acetate floats: drain the water layer below, keep every layer.', b.extractions >= 3,
        [['Gently', 'extract gentle'], ['Shake hard', 'extract hard']]],
      ['If there is an emulsion, clear it', 'No sharp line between the layers: brine, waiting, or the centrifuge.', b.extractions > 0 && !b.emulsion, [['Brine', 'clear brine'], ['Wait', 'clear wait'], ['Centrifuge', 'clear centrifuge']]],
      ['Wash the ethyl acetate with brine', 'It takes out most of the dissolved water before the drying agent.', b.brine, [['Wash', 'brine']]],
      ['Dry over magnesium sulfate', 'In portions, swirled, until it no longer clumps.', b.freeFlowing, [['Add a portion', 'mgso4']]],
      ['Gravity filter into the weighed round-bottomed flask', 'Rinse the solid with a little ethyl acetate.', b.gravity, [['Filter', 'gravity']]],
      ['Take off the ethyl acetate on the rotary evaporator', 'Droplets left mean it was not dry.', b.evaporated && !b.wet, [['Evaporate', 'evaporate'], ['Redissolve and dry again', 'redry']]],
      ['Weigh the flask', 'The product is a colourless oil.', b.weighed, [['Weigh', 'weigh']]]
    ]]);
    return out;
  }

  function showSteps() {
    var box = $('p1-steps'); box.textContent = '';
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
          btn.addEventListener('click', function () { act(x[1]); });
          bs.appendChild(btn);
        });
        li.appendChild(bs);
        ol.appendChild(li);
      });
      box.appendChild(ol);
    });
    var tlc = state.bench.tlc;
    $('p1-tlc').textContent = tlc.length ? 'Last TLC, ' + Math.round(tlc[tlc.length - 1].hours) + ' h after the yeast: ' +
      (tlc[tlc.length - 1].ketone ? 'the blue spot of ethyl acetoacetate is still there.' : 'no blue spot: the ethyl acetoacetate is gone.') : '';
  }

  // ---- the results: the yield, and the rotation -------------------------------------------------

  function productNow() { return M.product(state.code, state.bench); }

  function showResults() {
    var b = state.bench, box = $('p1-results');
    box.hidden = !b.weighed;
    if (!b.weighed) return;
    var prod = productNow(), full = TARE + prod.mass;
    $('p1-masses').textContent = 'The balance: the round-bottomed flask weighed ' + TARE.toFixed(2) + ' g empty and weighs ' + full.toFixed(2) +
      ' g with the product. Ethyl acetoacetate used: ' + prod.substrate.toFixed(2) + ' g.';
    var sample = state.sample;
    $('p1-sample').textContent = sample === null ? '' : 'Sample weighed into the 25 mL volumetric flask: ' + (sample / 1000).toFixed(2) + ' g.';
    $('p1-reading').textContent = state.reading === null ? '' : 'The polarimeter reads α = ' + (state.reading >= 0 ? '+' : '') + state.reading.toFixed(3) + '° (1 dm tube, 25 °C, sodium D line).';
    ['yield', 'specific', 'ee'].forEach(function (k) { var i = $('p1-' + k); if (document.activeElement !== i) i.value = state.entries[k] || ''; });
    showChecks();
  }

  function showChecks() {
    var prod = productNow(), roundedMass = Math.round((TARE + prod.mass) * 100) / 100 - Math.round(TARE * 100) / 100;
    var c = state.sample === null ? null : state.sample / 1000 / 25 * 100;
    var checks = {
      yield: M.checkYield(roundedMass, prod.substrate, state.entries.yield),
      specific: state.reading === null ? { kind: 'empty', text: '' } : M.checkSpecificRotation(state.reading, 1, Math.round(c * 1000) / 1000, state.entries.specific),
      ee: M.checkEe(M.num(state.entries.specific), state.entries.ee)
    };
    Object.keys(checks).forEach(function (k) {
      var m = $('p1-' + k + '-msg'), v = checks[k];
      m.textContent = v.kind === 'empty' ? '' : v.text; m.setAttribute('data-kind', v.kind);
    });
  }

  function polarimeter(what) {
    var b = state.bench;
    if (!b.weighed) return;
    var r = M.picks(state.code).scatter;
    switch (what) {
      case 'sample': state.sample = Math.round((240 + 30 * r) / 10) * 10; state.filled = false; state.reading = null; break;     // the balance reads 0.01 g
      case 'blank': state.blanked = true; state.filled = false; state.bubble = false; state.reading = null; break;     // the tube now holds chloroform: zero
      case 'fill': if (state.sample === null) { note('', ''); $('p1-note').textContent = 'Weigh a sample and make up the solution first.'; $('p1-note').setAttribute('data-kind', 'blocked'); return; } state.filled = true; state.bubble = false; break;
      case 'fill-fast': if (state.sample === null) return; state.filled = true; state.bubble = true; break;
      case 'read':
        if (!state.filled) { $('p1-note').textContent = 'Fill the tube with your solution first.'; $('p1-note').setAttribute('data-kind', 'blocked'); return; }
        state.reading = M.polarimeterReading(productNow(), state.sample, 25, 1, { bubble: state.bubble, noBlank: !state.blanked });
        $('p1-note').textContent = state.bubble ? 'An air bubble sits in the light path: the reading is off. Refill the tube carefully.' :
          !state.blanked ? 'No blank was read first: the instrument’s zero is not checked, so the reading may be off.' : '';
        $('p1-note').setAttribute('data-kind', state.bubble || !state.blanked ? 'warn' : '');
        break;
    }
    save(); showResults(); tellRoom();
  }

  // ---- the product's 1H NMR (nmr.js draws it from what the product is made of) ---------------------

  var N = window.HandNmr;
  var RANGES = { full: [13.0, -0.5, 1], main: [5.4, 0.8, 0.5], ch2: [2.62, 2.18, 0.05] };

  function nmrStep(what) {
    if (!state.bench.weighed) return say(WEIGH_FIRST, 'blocked');
    if (what === 'sample') { state.nmr.made = true; say('Your NMR sample is made: about 20 mg in 0.6 mL of CDCl₃, with TMS. Now run it on the spectrometer.', ''); }
    if (what === 'run') {
      if (!state.nmr.made) return say('Make the NMR sample first (the NMR sample table).', 'blocked');
      state.nmr.run = true; say('', '');
    }
    save(); showNmr();
  }

  function showNmr() {
    var box = $('p1-nmr');
    box.hidden = !state.nmr.run;
    if (!state.nmr.run) return;
    document.querySelectorAll('[data-nmr-range]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-nmr-range') === state.nmr.range ? 'true' : 'false'); });
    drawNmr($('p1-nmr-canvas'), state.nmr.range);
    var ints = N.integrals(productNow());
    var tbox = $('p1-nmr-integrals'); tbox.textContent = '';
    tbox.appendChild(el('caption', {}, 'The integrals, scaled so that region D (the CH₂ next to the C=O, 2 H) reads 2.00'));
    var head = el('tr'); ['Region', 'From (ppm)', 'To (ppm)', 'Integral'].forEach(function (h) { head.appendChild(el('th', { scope: 'col' }, h)); }); tbox.appendChild(head);
    N.REGIONS.forEach(function (r) {
      var tr = el('tr'); [r.id, r.from.toFixed(2), r.to.toFixed(2), ints[r.id].toFixed(2)].forEach(function (v) { tr.appendChild(el('td', {}, v)); }); tbox.appendChild(tr);
    });
    var grid = $('p1-nmr-signals');
    if (!grid.childNodes.length) {
      grid.appendChild(el('p', { 'class': 'q-text' }, 'Assign each signal of ethyl 3-hydroxybutanoate to its protons:'));
      grid.appendChild(el('p', {}, ''));
      N.SIGNALS.forEach(function (sig) {
        grid.appendChild(el('p', { 'class': 'q-text' }, sig.text));
        var p = el('p', {}), sel = el('select', { id: 'p1-' + sig.id, 'aria-label': 'Protons for the signal at ' + sig.text });
        sel.appendChild(el('option', { value: '' }, 'choose…'));
        N.PROTONS.forEach(function (pr) { sel.appendChild(el('option', { value: pr.id }, pr.text)); });
        sel.addEventListener('change', function () { state.entries['nmr-' + sig.id] = sel.value; save(); showNmrChecks(); });
        p.appendChild(sel); p.appendChild(document.createTextNode(' '));
        p.appendChild(el('span', { 'class': 'msg', id: 'p1-' + sig.id + '-msg' }));
        grid.appendChild(p);
      });
    }
    N.SIGNALS.forEach(function (sig) { $('p1-' + sig.id).value = state.entries['nmr-' + sig.id] || ''; });
    ['ketone', 'eecorr'].forEach(function (k) { var i = $('p1-' + k); if (document.activeElement !== i) i.value = state.entries[k] || ''; });
    showNmrChecks();
  }

  function showNmrChecks() {
    if (!state.nmr.run) return;
    var ints = N.integrals(productNow());
    function put(id, v) { var m = $(id); m.textContent = v.kind === 'empty' ? '' : v.text; m.setAttribute('data-kind', v.kind); }
    N.SIGNALS.forEach(function (sig) { put('p1-' + sig.id + '-msg', N.checkSignal(sig.id, state.entries['nmr-' + sig.id])); });
    put('p1-ketone-msg', N.checkKetonePercent(ints, state.entries.ketone));
    put('p1-eecorr-msg', N.checkCorrectedEe(M.num(state.entries.ee), M.num(state.entries.ketone), state.entries.eecorr));
  }

  /** Draws the spectrum over a range (ppm falling from left to right, as printed), with the integral regions under it. */
  function drawNmr(canvas, rangeId) {
    var r = RANGES[rangeId] || RANGES.main, hi = r[0], lo = r[1], tick = r[2];
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, base = H - 86, top = 16;
    var all = N.lines(productNow());
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    var xs = [], peak = 0, px;
    for (px = 0; px < W; px++) {
      var y = 0;
      for (var k = 0; k < 4; k++) y = Math.max(y, N.heightAt(all, hi - (px + k / 4) / W * (hi - lo)));
      xs.push(y);
    }
    // scale to the tallest peak in view other than TMS and the solvent's CHCl3
    for (px = 0; px < W; px++) {
      var ppm = hi - px / W * (hi - lo);
      if (Math.abs(ppm) < 0.05 || Math.abs(ppm - 7.26) < 0.03) continue;
      peak = Math.max(peak, xs[px]);
    }
    var scale = peak > 0 ? (base - top) * 0.88 / peak : 1;
    ctx.strokeStyle = '#1b2a3a'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (px = 0; px < W; px++) { var yy = Math.max(top, base - xs[px] * scale); if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy); }
    ctx.stroke();
    // the axis, its ticks and numbers
    ctx.strokeStyle = '#55606b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(W, base + 0.5); ctx.stroke();
    ctx.fillStyle = '#33404c'; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (var t = Math.ceil(lo / tick - 1e-9) * tick; t <= hi + 1e-9; t += tick) {
      var x = (hi - t) / (hi - lo) * W;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base + 6); ctx.stroke();
      ctx.fillText(t.toFixed(tick < 0.1 ? 2 : 1), x, base + 20);
    }
    ctx.fillText('ppm', W - 22, base + 38);
    // the integral regions: the integral climbing across each one (left to right, as printed), a bracket, its letter and value
    var ints = N.integrals(productNow()), most = 0;
    N.REGIONS.forEach(function (g) { most = Math.max(most, ints[g.id]); });
    ctx.strokeStyle = '#2f6f9f'; ctx.fillStyle = '#2f6f9f';
    N.REGIONS.forEach(function (g, gi) {
      if (g.to > hi || g.from < lo) return;
      var x0 = Math.round((hi - g.from) / (hi - lo) * W), x1 = Math.round((hi - g.to) / (hi - lo) * W);
      var sum = 0, total = 0, q;
      for (q = Math.max(0, x0); q < Math.min(W, x1); q++) total += xs[q];
      var rise = most > 0 ? (base - top) * 0.45 * ints[g.id] / most : 0, start = base - 24;
      if (total > 0 && rise > 1) {
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, start);
        for (q = Math.max(0, x0); q < Math.min(W, x1); q++) { sum += xs[q]; ctx.lineTo(q, start - rise * sum / total); }
        ctx.stroke(); ctx.lineWidth = 1;
      }
      ctx.beginPath(); ctx.moveTo(x0, base + 44); ctx.lineTo(x0, base + 48); ctx.lineTo(x1, base + 48); ctx.lineTo(x1, base + 44); ctx.stroke();
      ctx.fillText(g.id + '  ' + ints[g.id].toFixed(2), (x0 + x1) / 2, base + (gi % 2 ? 80 : 63));     // neighbours alternate rows
    });
  }

  function show() {
    $('p1-code').textContent = state.code;
    $('p1-recipe-name').textContent = recipe.name;
    $('p1-recipe-text').textContent = pick.recipe === 'starved'
      ? 'Your yeast was starved for 4 days in 5% ethanol, shaken in air, with no sugar; then it gets 1.00 g of ethyl acetoacetate (yeast to substrate 25 : 1).'
      : pick.recipe === 'slow' ? 'Your ethyl acetoacetate goes in little by little, eight portions six hours apart, while the flask is shaken open to the air.'
        : pick.recipe === 'one' ? 'All 5.00 g of your ethyl acetoacetate goes in at once.'
          : 'Your ethyl acetoacetate goes in two portions of 2.50 g a day apart, with fresh sugar before the second, as in Org. Synth.';
    $('p1-clock').textContent = clockText();
    showSteps();
    showResults();
    showNmr();
  }

  ['yield', 'specific', 'ee'].forEach(function (k) {
    $('p1-' + k).addEventListener('input', function () { state.entries[k] = $('p1-' + k).value; save(); showChecks(); });
  });
  document.querySelectorAll('[data-nmr]').forEach(function (b) { b.addEventListener('click', function () { nmrStep(b.getAttribute('data-nmr')); }); });
  document.querySelectorAll('[data-nmr-range]').forEach(function (b) { b.addEventListener('click', function () { state.nmr.range = b.getAttribute('data-nmr-range'); save(); showNmr(); }); });
  ['ketone', 'eecorr'].forEach(function (k) { $('p1-' + k).addEventListener('input', function () { state.entries[k] = $('p1-' + k).value; save(); showNmrChecks(); }); });
  $('p1-nmr-canvas').addEventListener('mousemove', function (e) {
    var r = RANGES[state.nmr.range] || RANGES.main, box = $('p1-nmr-canvas').getBoundingClientRect();
    var ppm = r[0] - (e.clientX - box.left) / box.width * (r[0] - r[1]);
    $('p1-nmr-at').textContent = 'At the pointer: ' + ppm.toFixed(3) + ' ppm.';
  });
  document.querySelectorAll('[data-polar]').forEach(function (b) { b.addEventListener('click', function () { polarimeter(b.getAttribute('data-polar')); }); });
  $('p1-reset').addEventListener('click', function () { $('p1-reset-confirm').hidden = false; });
  $('p1-reset-no').addEventListener('click', function () { $('p1-reset-confirm').hidden = true; });
  $('p1-reset-yes').addEventListener('click', function () {
    state = blank(state.code); save(); $('p1-reset-confirm').hidden = true; note('', ''); show(); tellRoom();
  });

  window.HandPart1 = { state: function () { return state; }, act: act, polarimeter: polarimeter, picks: function () { return pick; },
    roomView: roomView, click: click, hover: hover, nmr: nmrStep };
  show();
})();
