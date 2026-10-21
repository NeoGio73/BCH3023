/* The Enzyme's Handshake, Part 2 on the page: the lipase's kinetic resolution of a racemic secondary
 * alcohol (window.HandModel2; loadable in Node for tests, Tools/handshake_model_test.js).
 *
 * What lives here is not secret: the bench routine and its warnings, the TLC of the alcohol and its
 * acetate, what the column and the rotary evaporator give back, the GC's integration report, and the
 * checks of the student's own numbers (ee from their own peak areas, the conversion and E from their
 * own ee values: Chen, Fujimoto, Girdaukas & Sih, JACS 1982). What is secret stays in Unity
 * (Alcohols.cs, Resolution.cs): which alcohol a code gives, which enantiomer CAL-B prefers, how
 * selectively, and the order of the peaks on the chiral column. The page is told the alcohol's name and
 * molar masses, and gets each chromatogram as a list of peaks. Which enantiomer reacted faster, and
 * whether the Kazlauskas rule held, are never checked: he marks them from the private key.
 *
 * Modelled (no source gives a number for this bench): the TLC Rf values, how much of each compound
 * the column and the evaporation give back, and the integrator's rule for peaks too close to tell apart.
 */
(function (root) {
  'use strict';

  var VINYL_ACETATE = { mw: 86.09, density: 0.934 };     // g/mol, g/mL (PubChem)
  var HEXANE_ML = 5;

  function blankBench() {
    return {
      weighed: false, hexane: null, vinyl: 0, tempC: 0, enzymeMg: 0, started: false, hours: 0,
      samples: [], stopped: null, tlc: [], eluent: null, column: false, evaporated: false, cold: false, weighedFractions: false, warnings: []
    };
  }

  function copy(s) { return JSON.parse(JSON.stringify(s)); }
  function warn(s, code) { if (s.warnings.indexOf(code) < 0) s.warnings.push(code); }

  /**
   * One step at the bench: { ok, state, warning } or { ok: false, reason }. `handoutMg` is the
   * enzyme the student's handout gives (from Unity, per code).
   */
  function step(bench, what, handoutMg) {
    var s = copy(bench), parts = String(what).split(' '), verb = parts[0], arg = parts[1];
    var w = null;
    function yes() { return { ok: true, state: s, warning: w }; }
    function no(reason) { return { ok: false, reason: reason }; }
    function warning(code) { w = code; warn(s, code); }
    switch (verb) {
      case 'weigh':
        if (s.weighed) return no('weighed');
        s.weighed = true; return yes();
      case 'hexane':
        if (!s.weighed) return no('weigh-first');
        if (s.hexane) return no('hexane-in');
        s.hexane = arg === 'wet' ? 'wet' : 'dry';
        if (s.hexane === 'wet') warning('wet-hexane');
        return yes();
      case 'vinyl':
        if (!s.hexane) return no('hexane-first');
        var eq = Number(arg);
        if (!(eq > 0 && eq <= 10)) return no('vinyl-range');
        s.vinyl = eq;
        if (eq < 1.5) warning('little-donor');
        return yes();
      case 'shaker':
        var t = Number(arg);
        if (!(t >= 15 && t <= 80)) return no('shaker-range');
        s.tempC = t;
        if (t > 50) warning('too-warm');
        else if (t < 30) warning('cool');
        return yes();
      case 'enzyme':
        if (!s.vinyl) return no('vinyl-first');
        if (!s.tempC) return no('shaker-first');
        if (s.started) return no('enzyme-in');
        var mg = Number(arg);
        if (!(mg > 0 && mg <= 500)) return no('enzyme-range');
        s.enzymeMg = mg; s.started = true; s.hours = 0;
        if (handoutMg && mg > handoutMg * 1.5) warning('too-much-enzyme');
        return yes();
      case 'wait':
        if (!s.started) return no('enzyme-first');
        if (s.stopped !== null) return no('stopped');
        var h = Number(arg);
        if (!(h > 0 && h <= 48)) return no('wait-range');
        s.hours = Math.round((s.hours + h) * 100) / 100;
        return yes();
      case 'sample':
        if (!s.started) return no('enzyme-first');
        var sample = { hours: s.stopped !== null ? s.stopped : s.hours, filtered: arg !== 'unfiltered', diluted: arg !== 'neat' };
        s.samples.push(sample);
        if (!sample.filtered) warning('beads-in-vial');
        if (!sample.diluted) warning('overload');
        return yes();
      case 'stop':
        if (!s.started) return no('enzyme-first');
        if (s.stopped !== null) return no('stopped');
        s.stopped = s.hours; return yes();
      case 'tlc':
        if (!s.started) return no('enzyme-first');
        if (!RF[arg]) return no('eluent');
        s.tlc.push(arg); return yes();
      case 'column':
        if (s.stopped === null) return no('stop-first');
        if (s.column) return no('column-done');
        if (!RF[arg]) return no('eluent');
        s.eluent = arg; s.column = true;
        if (arg === '1:1') warning('eluent-strong');
        if (arg === 'hexane') warning('eluent-weak');
        if (s.tlc.indexOf(arg) < 0) warning('no-tlc');
        return yes();
      case 'evaporate':
        if (!s.column) return no('column-first');
        if (s.evaporated) return no('evaporated');
        s.evaporated = true; s.cold = arg === 'cold'; return yes();
      case 'weighfractions':
        if (!s.evaporated) return no('evaporate-first');
        s.weighedFractions = true; return yes();
    }
    return no('unknown');
  }

  /** TLC on silica (hexanes : ethyl acetate): the acetate runs well ahead of the alcohol. Modelled. */
  var RF = {
    'hexane': { acetate: 0.22, alcohol: 0.02 },
    '9:1': { acetate: 0.55, alcohol: 0.18 },
    '4:1': { acetate: 0.70, alcohol: 0.36 },
    '1:1': { acetate: 0.86, alcohol: 0.74 }
  };

  /**
   * The two fractions' masses (g) after the column and the rotary evaporator, from the amounts at the
   * stop (mmol, from Unity's GC reply). Recovery 85-90% (modelled); a volatile alcohol loses more on a
   * warm bath; in hexane alone the alcohol never comes off.
   */
  function fractions(info, bench, alcMmol, acMmol) {
    var e = bench.eluent, overlap = e === '1:1' ? 0.35 : e === '4:1' ? 0.05 : 0;
    var lossAlc = info.volatile && !bench.cold ? 0.55 : 0.88, lossAc = info.volatile && !bench.cold ? 0.75 : 0.90;
    var acetate = (acMmol * info.acetateMw + overlap * alcMmol * info.mw) / 1000 * lossAc;
    var alcohol = e === 'hexane' ? 0 : (alcMmol * info.mw) / 1000 * lossAlc;
    return { acetate: Math.round(acetate * 1000) / 1000, alcohol: Math.round(alcohol * 1000) / 1000 };
  }

  /**
   * The integrator's report from Unity's peaks: retention time, area, area %. Peaks closer than about
   * two and a half widths are not told apart and are reported as one (an overloaded sample does that).
   */
  function integrate(peaks) {
    var list = (peaks || []).slice().sort(function (a, b) { return a.t - b.t; }), out = [];
    list.forEach(function (p) {
      var last = out[out.length - 1];
      if (last && p.t - last.t < 2.5 * (p.w + last.w)) {
        if (p.area > last.area) last.t = p.t;
        last.area += p.area; last.kinds.push(p.kind); last.merged = true; last.w = Math.max(last.w, p.w);
      } else out.push({ t: p.t, w: p.w, area: p.area, kinds: [p.kind], merged: false });
    });
    var total = out.reduce(function (a, p) { return a + p.area; }, 0) || 1;
    return out.map(function (p, i) {
      return { n: i + 1, t: Math.round(p.t * 100) / 100, area: Math.round(p.area), percent: Math.round(p.area / total * 1000) / 10, kind: p.kinds[0], merged: p.merged };
    });
  }

  /** The ee (%) the report gives for one kind (alcohol or acetate): its two largest peaks of that kind. */
  function eeFrom(report, kind) {
    var mine = report.filter(function (p) { return p.kind === kind && !p.merged; }).sort(function (a, b) { return b.area - a.area; }).slice(0, 2);
    if (!mine.length) return NaN;
    if (mine.length === 1) return 100;
    return Math.abs(mine[0].area - mine[1].area) / (mine[0].area + mine[1].area) * 100;
  }

  /** E from the conversion and the alcohol's ee (both as fractions): Chen et al. 1982. */
  function selectivity(c, ees) {
    if (!(c > 0 && c < 1 && ees >= 0 && ees < 1)) return NaN;
    return Math.log((1 - c) * (1 - ees)) / Math.log((1 - c) * (1 + ees));
  }

  // ---- The checks: the student's own numbers ------------------------------------------------------

  function num(text) {
    if (text === null || text === undefined) return NaN;
    var t = String(text).trim().replace(',', '.').replace(/\s+/g, '');
    return t ? Number(t) : NaN;
  }
  function verdict(ok, off) { return ok ? { ok: true, kind: 'good', text: 'Accepted.' } : { ok: false, kind: 'off', text: off }; }
  function empty() { return { ok: false, kind: 'empty', text: '' }; }

  function checkEe(report, kind, text) {
    var v = num(text); if (isNaN(v)) return empty();
    var want = eeFrom(report, kind);
    if (isNaN(want)) return verdict(false, 'This chromatogram shows no ' + kind + ' peaks to read.');
    return verdict(Math.abs(v - want) <= 0.3, 'Not quite: the difference of the two ' + kind + ' peaks’ areas over their sum, times 100.');
  }
  function checkConversion(ees, eep, text) {
    var v = num(text); if (isNaN(v) || isNaN(ees) || isNaN(eep) || ees + eep <= 0) return empty();
    var want = ees / (ees + eep) * 100;
    return verdict(Math.abs(v - want) <= 0.3, 'Not quite: c = ee(alcohol) / (ee(alcohol) + ee(acetate)), as a percent.');
  }
  function checkE(c, ees, text) {
    var v = num(text); if (isNaN(v) || isNaN(c) || isNaN(ees)) return empty();
    var want = selectivity(c / 100, ees / 100);
    if (isNaN(want)) return verdict(false, 'E cannot be worked out from these numbers: check your c and ee.');
    // a large E swings with the last digit of c and ee: accept anything the rounding of those allows, and 5% more
    var lo = want, hi = want;
    [-0.05, 0.05].forEach(function (dc) { [-0.05, 0.05].forEach(function (de) {
      var e = selectivity((c + dc) / 100, Math.min(99.999, ees + de) / 100);
      if (!isNaN(e)) { lo = Math.min(lo, e); hi = Math.max(hi, e); }
    }); });
    return verdict(v >= lo * 0.95 && v <= hi * 1.05, 'Not quite: E = ln[(1 − c)(1 − ee(alcohol))] / ln[(1 − c)(1 + ee(alcohol))], with c and ee as fractions.');
  }
  function checkPercent(grams, mmolStart, mw, text) {
    var v = num(text); if (isNaN(v)) return empty();
    var want = grams / (mmolStart * mw / 1000) * 100;
    return verdict(Math.abs(v - want) <= Math.max(0.5, 0.02 * want), 'Not quite: the moles you got over the moles of alcohol you started with, times 100.');
  }

  /** The words for a refusal or a warning (the page shows them). */
  var TEXT = {
    'weighed': 'The alcohol is already weighed into the vial.',
    'weigh-first': 'Weigh the alcohol into the vial first.',
    'hexane-in': 'The hexane is already in.',
    'hexane-first': 'Add the hexane first.',
    'vinyl-range': 'Between 1 and 10 equivalents of vinyl acetate.',
    'shaker-range': 'Set the shaker between 15 and 80 °C.',
    'vinyl-first': 'Add the vinyl acetate first.',
    'shaker-first': 'Set the shaker’s temperature first.',
    'enzyme-in': 'The enzyme is already in.',
    'enzyme-range': 'Weigh out a sensible amount of the beads.',
    'enzyme-first': 'Add the enzyme first: nothing happens without it.',
    'stopped': 'The reaction is stopped: the beads are filtered off.',
    'wait-range': 'Wait a number of hours.',
    'stop-first': 'Stop the reaction first: filter off the beads.',
    'column-done': 'The column is already run.',
    'eluent': 'Choose an eluent: hexane, 9:1, 4:1 or 1:1 hexanes : ethyl acetate.',
    'column-first': 'Run the column first.',
    'evaporated': 'The fractions are already evaporated.',
    'evaporate-first': 'Take the solvent off the fractions first.',
    'unknown': 'That is not a step of Part 2.',
    // warnings: the step goes ahead
    'wet-hexane': 'That hexane was not dried: with water about, the lipase hydrolyses the acetate as well as making it.',
    'little-donor': 'Little vinyl acetate: the reaction slows as the acyl donor runs out.',
    'too-warm': 'Warm: the lipase works faster, but it tells the enantiomers apart less well.',
    'cool': 'Cool: the lipase is slow at this temperature.',
    'too-much-enzyme': 'More beads than the handout gives: faster, but for some alcohols less selective.',
    'beads-in-vial': 'Beads went into the GC vial: the reaction goes on in it, and the reading is not of the time you sampled.',
    'overload': 'An undiluted sample: the peaks overload and broaden, and close ones run together.',
    'eluent-strong': 'Too polar: the acetate and the alcohol come off close together, and each fraction has some of the other.',
    'eluent-weak': 'Hexane alone: the alcohol stays on the column.',
    'no-tlc': 'You ran the column without trying that eluent on a TLC plate first.'
  };

  var api = {
    VINYL_ACETATE: VINYL_ACETATE, HEXANE_ML: HEXANE_ML, RF: RF, TEXT: TEXT,
    blankBench: blankBench, step: step, fractions: fractions, integrate: integrate, eeFrom: eeFrom, selectivity: selectivity, num: num,
    checkEe: checkEe, checkConversion: checkConversion, checkE: checkE, checkPercent: checkPercent
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HandModel2 = api;
})(this);
