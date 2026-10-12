/*
 * Biofuel Enzyme Lab, Activities 1 to 5: the page's model.
 * What is on the bench in each activity and what it is called, reading what a student typed, the
 * messages for each verdict, and the checks that use only the student's own entries (amounts read
 * from the standard curve, and the reaction rates). Whether a color match or an absorbance agrees
 * with the cuvette on the bench is worked out inside the 3D lab, which tells the page only the
 * verdict for each entry.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EnzymeLabModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STANDARDS = [
    { id: 'S1', nmol: 0 }, { id: 'S2', nmol: 12.5 }, { id: 'S3', nmol: 25 }, { id: 'S4', nmol: 50 }, { id: 'S5', nmol: 100 }
  ];
  var METER_MAX = 2;

  // Each activity: its sample cuvettes in the order of the manual's tables, with the time each
  // sample is due (minutes after its reaction began) and the tube it is taken from; what the tubes
  // and pipets are called; and, for Activities 2 and 3, the condition each cuvette stands for (x).
  // The short ids are the 3D lab's own names for the things on the bench.
  var ACTIVITIES = {
    1: {
      title: 'Activity 1: reaction rate with and without an enzyme',
      tab: 'Enzyme or no enzyme',
      part: 1, timeColumn: true, tables: { eye: 'Table 2', abs: 'Table 4' }, chart: 'time',
      series: [
        { name: 'with enzyme (E1 to E5)', ids: ['E1', 'E2', 'E3', 'E4', 'E5'], shape: 'circle' },
        { name: 'no enzyme (Start, End)', ids: ['Start', 'End'], shape: 'square' }
      ],
      rates: [
        { key: 'enzyme', kind: 'slope', label: 'Initial rate of product formation with enzyme present' },
        { key: 'control', kind: 'control', label: 'Rate of product formation with no enzyme present' }
      ],
      cuvettes: [
        { id: 'Start', label: 'Start', minutes: 0, enzyme: false, source: 'control', pipet: 'C' },
        { id: 'End', label: 'End', minutes: 8, enzyme: false, source: 'control', pipet: 'C' },
        { id: 'E1', label: 'E1', minutes: 1, enzyme: true, source: 'reaction', pipet: 'E' },
        { id: 'E2', label: 'E2', minutes: 2, enzyme: true, source: 'reaction', pipet: 'E' },
        { id: 'E3', label: 'E3', minutes: 4, enzyme: true, source: 'reaction', pipet: 'E' },
        { id: 'E4', label: 'E4', minutes: 6, enzyme: true, source: 'reaction', pipet: 'E' },
        { id: 'E5', label: 'E5', minutes: 8, enzyme: true, source: 'reaction', pipet: 'E' }
      ],
      vessels: {
        stop: { name: 'the stop solution', liquid: 'stop solution' },
        substrate: { name: 'the 1.5 mM substrate', liquid: '1.5 mM substrate' },
        enzyme: { name: 'the enzyme', liquid: 'enzyme' },
        buffer: { name: 'the buffer', liquid: 'buffer' },
        reaction: { name: 'the Enzyme Reaction tube', liquid: 'the enzyme reaction' },
        control: { name: 'the Control tube', liquid: 'the control mix' }
      },
      pipets: {
        stop: { name: 'the Stop pipet', job: 'Stop pipet: for the stop solution.' },
        sub: { name: 'the Sub pipet', job: 'Sub pipet: for the 1.5 mM substrate.' },
        C: { name: 'pipet C', job: 'Pipet C: for the buffer and the Control tube.' },
        E: { name: 'pipet E', job: 'Pipet E: for the enzyme and the Enzyme Reaction tube.' }
      }
    },
    2: {
      title: 'Activity 2: the effect of temperature',
      tab: 'Temperature',
      part: 1, timeColumn: false, tables: { eye: 'Table 6', abs: 'Table 7' }, chart: 'condition',
      rates: [
        { key: 'T0', kind: 'single', cuvette: 'T0', label: 'Initial rate of product formation at 0 °C' },
        { key: 'T22', kind: 'single', cuvette: 'T22', label: 'Initial rate of product formation at 22 °C (room)' },
        { key: 'T37', kind: 'single', cuvette: 'T37', label: 'Initial rate of product formation at 37 °C' }
      ],
      axis: 'Temperature (°C)', axisMin: 0, axisMax: 40, axisStep: 10, rowHead: 'Temperature',
      cuvettes: [
        { id: 'T0', label: '0 °C', minutes: 2, enzyme: true, source: 'S0', pipet: 'p0', x: 0 },
        { id: 'T22', label: '22 °C (room)', minutes: 2, enzyme: true, source: 'S22', pipet: 'p22', x: 22 },
        { id: 'T37', label: '37 °C', minutes: 2, enzyme: true, source: 'S37', pipet: 'p37', x: 37 }
      ],
      vessels: {
        stop: { name: 'the stop solution', liquid: 'stop solution' },
        substrate: { name: 'the 1.5 mM substrate', liquid: '1.5 mM substrate' },
        enzyme: { name: 'the enzyme', liquid: 'enzyme' },
        E0: { name: 'the Enzyme tube in the ice bath', liquid: 'the ice-cold enzyme' },
        S0: { name: 'the Substrate tube in the ice bath', liquid: 'the 0 °C reaction' },
        E22: { name: 'the Enzyme tube on the bench', liquid: 'the room-temperature enzyme' },
        S22: { name: 'the Substrate tube on the bench', liquid: 'the 22 °C reaction' },
        E37: { name: 'the Enzyme tube in the warm bath', liquid: 'the warm enzyme' },
        S37: { name: 'the Substrate tube in the warm bath', liquid: 'the 37 °C reaction' }
      },
      pipets: {
        stop: { name: 'the Stop pipet', job: 'Stop pipet: for the stop solution.' },
        sub: { name: 'the Sub pipet', job: 'Sub pipet: for the 1.5 mM substrate.' },
        E: { name: 'pipet E', job: 'Pipet E: for the enzyme, and for moving it from each Enzyme tube into the Substrate tube beside it.' },
        p0: { name: 'the 0 °C pipet', job: '0 °C pipet: for moving the ice-bath reaction into the 0 °C cuvette.' },
        p22: { name: 'the 22 °C pipet', job: '22 °C pipet: for moving the bench reaction into the 22 °C cuvette.' },
        p37: { name: 'the 37 °C pipet', job: '37 °C pipet: for moving the warm-bath reaction into the 37 °C cuvette.' }
      }
    },
    3: {
      title: 'Activity 3: the effect of pH',
      tab: 'pH',
      part: 1, timeColumn: false, tables: { eye: 'Table 9', abs: 'Table 10' }, chart: 'condition',
      rates: [
        { key: 'C50', kind: 'single', cuvette: 'C50', label: 'Initial rate of product formation at pH 5.0' },
        { key: 'C63', kind: 'single', cuvette: 'C63', label: 'Initial rate of product formation at pH 6.3' },
        { key: 'C86', kind: 'single', cuvette: 'C86', label: 'Initial rate of product formation at pH 8.6' }
      ],
      axis: 'pH', axisMin: 4, axisMax: 9, axisStep: 1, rowHead: 'pH',
      cuvettes: [
        { id: 'C50', label: 'pH 5.0', minutes: 2, enzyme: true, source: 'P50', pipet: 'p50', x: 5.0 },
        { id: 'C63', label: 'pH 6.3', minutes: 2, enzyme: true, source: 'P63', pipet: 'p63', x: 6.3 },
        { id: 'C86', label: 'pH 8.6', minutes: 2, enzyme: true, source: 'P86', pipet: 'p86', x: 8.6 }
      ],
      vessels: {
        stop: { name: 'the stop solution', liquid: 'stop solution' },
        substrate3: { name: 'the 3.0 mM substrate', liquid: '3.0 mM substrate' },
        enzyme: { name: 'the enzyme', liquid: 'enzyme' },
        P50: { name: 'the pH 5.0 tube', liquid: 'the pH 5.0 reaction' },
        P63: { name: 'the pH 6.3 tube', liquid: 'the pH 6.3 reaction' },
        P86: { name: 'the pH 8.6 tube', liquid: 'the pH 8.6 reaction' }
      },
      pipets: {
        stop: { name: 'the Stop pipet', job: 'Stop pipet: for the stop solution.' },
        sub: { name: 'the Sub pipet', job: 'Sub pipet: for the 3.0 mM substrate.' },
        E: { name: 'pipet E', job: 'Pipet E: for the enzyme.' },
        p50: { name: 'the pH 5.0 pipet', job: 'pH 5.0 pipet: for moving the pH 5.0 reaction into its cuvette.' },
        p63: { name: 'the pH 6.3 pipet', job: 'pH 6.3 pipet: for moving the pH 6.3 reaction into its cuvette.' },
        p86: { name: 'the pH 8.6 pipet', job: 'pH 8.6 pipet: for moving the pH 8.6 reaction into its cuvette.' }
      }
    },
    4: {
      title: 'Activity 4: the effect of enzyme concentration',
      tab: 'Enzyme concentration',
      part: 2, timeColumn: true, tables: { eye: 'Table 12', abs: 'Table 13' }, chart: 'time',
      series: [
        { name: 'high enzyme concentration (H1 to H3)', ids: ['H1', 'H2', 'H3'], shape: 'circle', joined: true },
        { name: 'low enzyme concentration (L1 to L3)', ids: ['L1', 'L2', 'L3'], shape: 'square', joined: true }
      ],
      rates: [
        { key: 'H', kind: 'single', cuvette: 'H1', label: 'Initial rate of reaction for high enzyme concentration' },
        { key: 'L', kind: 'single', cuvette: 'L1', label: 'Initial rate of reaction for low enzyme concentration' }
      ],
      cuvettes: [
        { id: 'H1', label: 'H1', minutes: 1, enzyme: true, source: 'high', pipet: 'H' },
        { id: 'H2', label: 'H2', minutes: 2, enzyme: true, source: 'high', pipet: 'H' },
        { id: 'H3', label: 'H3', minutes: 8, enzyme: true, source: 'high', pipet: 'H' },
        { id: 'L1', label: 'L1', minutes: 1, enzyme: true, source: 'low', pipet: 'L' },
        { id: 'L2', label: 'L2', minutes: 2, enzyme: true, source: 'low', pipet: 'L' },
        { id: 'L3', label: 'L3', minutes: 8, enzyme: true, source: 'low', pipet: 'L' }
      ],
      vessels: {
        stop: { name: 'the stop solution', liquid: 'stop solution' },
        substrate: { name: 'the 1.5 mM substrate', liquid: '1.5 mM substrate' },
        buffer: { name: 'the buffer', liquid: 'buffer' },
        high: { name: 'the High Enzyme tube', liquid: 'high concentration enzyme' },
        low: { name: 'the Low Enzyme tube', liquid: 'low concentration enzyme' }
      },
      pipets: {
        stop: { name: 'the Stop pipet', job: 'Stop pipet: for the stop solution.' },
        mix: { name: 'the Mix pipet', job: 'Mix pipet: for making the low concentration enzyme, with buffer and then high concentration enzyme.' },
        H: { name: 'pipet H', job: 'Pipet H: for the substrate that goes into the High Enzyme tube, and for that tube\'s samples.' },
        L: { name: 'pipet L', job: 'Pipet L: for the substrate that goes into the Low Enzyme tube, and for that tube\'s samples.' }
      }
    },
    5: {
      title: 'Activity 5: the effect of substrate concentration',
      tab: 'Substrate concentration',
      part: 2, timeColumn: true, tables: { eye: 'Table 15', abs: 'Table 16' }, chart: 'time',
      series: [
        { name: 'high substrate concentration (H1 to H3)', ids: ['H1', 'H2', 'H3'], shape: 'circle', joined: true },
        { name: 'low substrate concentration (L1 to L3)', ids: ['L1', 'L2', 'L3'], shape: 'square', joined: true }
      ],
      rates: [
        { key: 'H', kind: 'single', cuvette: 'H1', label: 'Initial rate of reaction for high substrate concentration' },
        { key: 'L', kind: 'single', cuvette: 'L1', label: 'Initial rate of reaction for low substrate concentration' }
      ],
      cuvettes: [
        { id: 'H1', label: 'H1', minutes: 1, enzyme: true, source: 'hs', pipet: 'H' },
        { id: 'H2', label: 'H2', minutes: 2, enzyme: true, source: 'hs', pipet: 'H' },
        { id: 'H3', label: 'H3', minutes: 8, enzyme: true, source: 'hs', pipet: 'H' },
        { id: 'L1', label: 'L1', minutes: 1, enzyme: true, source: 'ls', pipet: 'L' },
        { id: 'L2', label: 'L2', minutes: 2, enzyme: true, source: 'ls', pipet: 'L' },
        { id: 'L3', label: 'L3', minutes: 8, enzyme: true, source: 'ls', pipet: 'L' }
      ],
      vessels: {
        stop: { name: 'the stop solution', liquid: 'stop solution' },
        substrate: { name: 'the 1.5 mM substrate', liquid: '1.5 mM substrate' },
        enzyme: { name: 'the enzyme', liquid: 'enzyme' },
        buffer: { name: 'the buffer', liquid: 'buffer' },
        hs: { name: 'the High Substrate tube', liquid: 'the high substrate reaction' },
        ls: { name: 'the Low Substrate tube', liquid: 'the low substrate reaction' }
      },
      pipets: {
        stop: { name: 'the Stop pipet', job: 'Stop pipet: for the stop solution.' },
        sub: { name: 'the Sub pipet', job: 'Sub pipet: for the 1.5 mM substrate.' },
        buf: { name: 'the Buf pipet', job: 'Buf pipet: for the buffer.' },
        E: { name: 'pipet E', job: 'Pipet E: for the enzyme.' },
        H: { name: 'pipet H', job: 'Pipet H: for samples from the High Substrate tube.' },
        L: { name: 'pipet L', job: 'Pipet L: for samples from the Low Substrate tube.' }
      }
    }
  };
  // The analysis questions Prof. Picione chose from the manual's Student Manual, for each activity.
  // Each keeps the manual's own question number in its id, so saved answers stay with their
  // question if the selection changes. They are answered in words and are not checked by the page.
  var QUESTIONS = {
    1: [
      { id: 'q5', text: 'If you took a time point at 15 minutes, do you think more product would be produced than at 8 minutes? Explain your answer.' },
      { id: 'q6', text: 'How did you estimate the amount of product (in nmol) produced by the enzyme?' },
      { id: 'q7', text: 'Why is the amount of light absorbed by the sample proportional to the amount of product produced?' }
    ],
    2: [
      { id: 'q3', text: 'Why do chemical reactions occur faster at higher temperatures?' },
      { id: 'q4', text: 'Why do chemical reactions occur more slowly at low temperatures?' },
      { id: 'q5', text: 'Why do most enzymatic reactions slow down at extremely high temperatures?' },
      { id: 'q6', text: 'If you were a scientist who wanted to use this enzyme to produce glucose, at what temperature should you run the reaction?' }
    ],
    3: [
      { id: 'q2', text: 'At what pH do you think this enzyme works best? How did you come up with your answer?' }
    ],
    4: [
      { id: 'q2', text: 'Does the amount of enzyme change the final amount of product, assuming that you start with the same amount of substrate and that you let each reaction proceed for a really long time?' }
    ],
    5: [
      { id: 'q1', text: 'How does the amount of substrate present change the initial rate of reaction?' }
    ]
  };
  var ACTIVITY_NUMBERS = [1, 2, 3, 4, 5];
  // The lab is done over two sessions; each has its own page (the same file, with ?part=2 for the second).
  var PARTS = { 1: [1, 2, 3], 2: [4, 5] };

  function isStandard(id) { return /^S[1-5]$/.test(id); }

  // "0.42", ".42"; "0,42" is not accepted; units after the number are ignored. Returns null when there is no number.
  function parseNumber(text) {
    var s = String(text == null ? '' : text).replace(/[−‒–—]/g, '-').trim()
      .replace(/\s*(nmol\s*\/\s*min|nmol per min(ute)?|nmol)\.?$/i, '').trim();
    var m = /^([+-]?(?:\d+\.?\d*|\.\d+))$/.exec(s);
    if (!m) return null;
    var value = parseFloat(m[1]);
    return isFinite(value) ? value : null;
  }

  function isBlank(text) { return !String(text == null ? '' : text).trim(); }

  // Results are { ok, message }, where ok is true, false, or null (nothing to say yet). An entry
  // that passes the page's own screening is marked ready, with its value, and goes to the 3D lab.

  function screenAbsorbance(text) {
    if (isBlank(text)) return { ok: null, message: '' };
    var v = parseNumber(text);
    if (v === null) return { ok: false, message: 'Enter the absorbance as a number, such as 0.42.' };
    if (v < 0 || v > METER_MAX + 1e-9) return { ok: false, message: 'The display reads from 0.00 to 2.00.' };
    return { ok: null, message: '', ready: true, value: v };
  }

  function screenMatch(choice) {
    var n = parseInt(choice, 10);
    if (!(n >= 1 && n <= STANDARDS.length)) return { ok: null, message: '' };
    return { ok: null, message: '', ready: true, value: n };
  }

  // name: what the cuvette is called, such as "cuvette E1" or "standard S2"
  function absorbanceMessage(verdict, name) {
    if (verdict === 'ok') return { ok: true, message: '' };
    var text = {
      nosample: capital(name) + ' has no sample in it yet.',
      unread: 'Put ' + name + ' in the spectrophotometer first, then record what the display shows.',
      off: 'Look again: put ' + name + ' in the spectrophotometer and copy the display.'
    }[verdict];
    return text ? { ok: false, message: text } : { ok: null, message: '' };
  }

  function matchMessage(verdict, name) {
    if (verdict === 'ok') return { ok: true, message: '' };
    var text = {
      nosample: capital(name) + ' has no sample in it yet.',
      off: 'Look again: drag ' + name + ' to the standards and slide it along to find the closest color.'
    }[verdict];
    return text ? { ok: false, message: text } : { ok: null, message: '' };
  }

  // ---- By eye: the amount that goes with the chosen standard -----------------------------------

  function checkAmount(choice, text) {
    if (isBlank(text)) return { ok: null, message: '' };
    var n = parseInt(choice, 10);
    if (!(n >= 1 && n <= STANDARDS.length)) return { ok: null, message: 'Choose the closest standard first.' };
    var v = parseNumber(text);
    if (v === null) return { ok: false, message: 'Enter the amount as a number of nmol.' };
    if (Math.abs(v - STANDARDS[n - 1].nmol) < 0.011) return { ok: true, message: '' };
    return { ok: false, message: 'Use Table 1: how many nmol of p-nitrophenol are in standard ' + STANDARDS[n - 1].id + '?' };
  }

  // ---- The standard curve ------------------------------------------------------------------------
  // points: [{ nmol, absorbance }], the student's accepted readings of the standards (S1 is 0, 0).
  // The best straight line through zero; its slope is absorbance per nmol. Null until there are
  // at least two standards above zero.

  function fitSlope(points) {
    var sxy = 0, sxx = 0, count = 0;
    points.forEach(function (p) {
      if (!(p.nmol > 0) || p.absorbance == null) return;
      sxy += p.nmol * p.absorbance;
      sxx += p.nmol * p.nmol;
      count += 1;
    });
    if (count < 2 || sxy <= 0) return null;
    return sxy / sxx;
  }

  // absorbance: the student's accepted reading for the cuvette; slope: from fitSlope.
  function checkFromCurve(absorbance, slope, text) {
    if (isBlank(text)) return { ok: null, message: '' };
    var v = parseNumber(text);
    if (v === null) return { ok: false, message: 'Enter the amount as a number of nmol.' };
    if (absorbance == null) return { ok: null, message: 'This is checked once the absorbance of this cuvette is accepted.' };
    if (slope == null) return { ok: null, message: 'This is checked once the absorbances of the standards are accepted in Table 3.' };
    var expected = absorbance / slope;
    var allowed = Math.max(2, expected * 0.08);      // reading a graph by eye is not exact
    if (Math.abs(v - expected) <= allowed) return { ok: true, message: '' };
    return {
      ok: false,
      message: 'Read the standard curve again: find ' + absorbance.toFixed(2) + ' on the absorbance axis, go across to the line, then down to the amount.'
    };
  }

  // ---- Reaction rates ----------------------------------------------------------------------------
  // Activity 1. points: [{ minutes, nmol }] for the enzyme cuvettes, using the time each sample was
  // really taken. A student may draw the line through all the points, through the first few, or
  // use two points as the manual's example does; any of those is accepted.

  function rateEstimates(points) {
    var pts = points.filter(function (p) { return p.minutes > 0 && p.nmol != null; })
      .sort(function (a, b) { return a.minutes - b.minutes; });
    if (pts.length < 3) return null;
    var out = [];
    function throughZero(list) {
      var sxy = 0, sxx = 0;
      list.forEach(function (p) { sxy += p.minutes * p.nmol; sxx += p.minutes * p.minutes; });
      return sxy / sxx;
    }
    function bestLine(list) {
      var n = list.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
      list.forEach(function (p) { sx += p.minutes; sy += p.nmol; sxy += p.minutes * p.nmol; sxx += p.minutes * p.minutes; });
      return (n * sxy - sx * sy) / (n * sxx - sx * sx);
    }
    var first = pts[0], last = pts[pts.length - 1];
    out.push(throughZero(pts));
    out.push(bestLine(pts));
    out.push(throughZero(pts.slice(0, 3)));
    out.push(bestLine(pts.slice(0, 3)));
    out.push((last.nmol - first.nmol) / (last.minutes - first.minutes));
    out.push(first.nmol / first.minutes);
    out.push(pts[1].nmol / pts[1].minutes);
    return out.filter(function (v) { return isFinite(v); });
  }

  function checkEnzymeRate(points, text) {
    if (isBlank(text)) return { ok: null, message: '' };
    var v = parseNumber(text);
    if (v === null) return { ok: false, message: 'Enter the rate as a number of nmol per minute.' };
    var estimates = rateEstimates(points);
    if (!estimates || !estimates.length) return { ok: null, message: 'This is checked once the amounts for E1 to E5 are accepted.' };
    var low = Math.min.apply(null, estimates) * 0.9, high = Math.max.apply(null, estimates) * 1.1;
    if (v >= low - 0.05 && v <= high + 0.05) return { ok: true, message: '' };
    return {
      ok: false,
      message: 'Check again: the rate is the slope of the straight part of your graph, the change in nmol divided by the change in minutes.'
    };
  }

  // start, end: nmol in the two control cuvettes; minutes: the time between them.
  function checkControlRate(start, end, minutes, text) {
    if (isBlank(text)) return { ok: null, message: '' };
    var v = parseNumber(text);
    if (v === null) return { ok: false, message: 'Enter the rate as a number of nmol per minute.' };
    if (start == null || end == null) return { ok: null, message: 'This is checked once the amounts for Start and End are accepted.' };
    var expected = (end - start) / Math.max(minutes, 1);
    if (Math.abs(v - expected) <= 0.3) return { ok: true, message: '' };
    return {
      ok: false,
      message: 'Check again: how much did the amount of product change between the Start and End cuvettes, and over how many minutes?'
    };
  }

  // Activities 2 and 3: one sample each, so the rate is the amount divided by the time, taking the
  // amount at 0 minutes as 0. nmol: the student's accepted amount; due: the minutes the sample was
  // due at; taken: the minutes it was really taken at (either is accepted).
  function checkSingleRate(nmol, due, taken, text) {
    if (isBlank(text)) return { ok: null, message: '' };
    var v = parseNumber(text);
    if (v === null) return { ok: false, message: 'Enter the rate as a number of nmol per minute.' };
    if (nmol == null) return { ok: null, message: 'This is checked once the amount of p-nitrophenol for this cuvette is accepted.' };
    var ok = [due, taken].some(function (minutes) {
      if (!(minutes > 0)) return false;
      var expected = nmol / minutes;
      return Math.abs(v - expected) <= Math.max(0.3, expected * 0.08);
    });
    if (ok) return { ok: true, message: '' };
    return {
      ok: false,
      message: 'Check again: divide the amount of p-nitrophenol (' + trim(nmol, 1) + ' nmol) by the ' + trim(due, 1) + (due === 1 ? ' minute' : ' minutes') + ' the reaction ran.'
    };
  }

  // ---- Formatting --------------------------------------------------------------------------------

  // 64.2 seconds -> "1:04"
  function clock(seconds) {
    var whole = Math.max(0, Math.floor(seconds));
    var s = whole % 60;
    return Math.floor(whole / 60) + ':' + (s < 10 ? '0' : '') + s;
  }

  // 500 -> "500 µL", 1000 -> "1 mL", 2500 -> "2.5 mL"
  function volume(ul) {
    if (ul < 1000) return Math.round(ul) + ' µL';
    var ml = Math.round(ul / 100) / 10;
    return ml + ' mL';
  }

  function trim(v, places) {
    return String(parseFloat(v.toFixed(places)));
  }

  function capital(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

  return {
    ACTIVITIES: ACTIVITIES,
    ACTIVITY_NUMBERS: ACTIVITY_NUMBERS,
    PARTS: PARTS,
    QUESTIONS: QUESTIONS,
    STANDARDS: STANDARDS,
    METER_MAX: METER_MAX,
    isStandard: isStandard,
    parseNumber: parseNumber,
    screenAbsorbance: screenAbsorbance,
    screenMatch: screenMatch,
    absorbanceMessage: absorbanceMessage,
    matchMessage: matchMessage,
    checkAmount: checkAmount,
    fitSlope: fitSlope,
    checkFromCurve: checkFromCurve,
    rateEstimates: rateEstimates,
    checkEnzymeRate: checkEnzymeRate,
    checkControlRate: checkControlRate,
    checkSingleRate: checkSingleRate,
    clock: clock,
    volume: volume,
    trim: trim,
    capital: capital
  };
});
