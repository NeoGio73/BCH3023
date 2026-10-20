/* The ubiquitin lab's model: how the measured shifts and rates (ubiquitin_data.js) become what the
 * page draws. Pure functions, loadable in Node for tests (Tools/ubiq_model_test.js).
 *
 * What is measured and what is modelled:
 *  - Every peak's place comes from a deposited shift (see ubiquitin_data.js).
 *  - Line widths are modelled from the tumbling time, tau_c (ns) ~ 0.6 x mass (kDa), a rule of thumb
 *    (ubiquitin's measured tau_c is 4.12 ns at 27 C). Larger proteins are drawn as ubiquitin's own
 *    protons, copied and spread a little, as many times as the mass asks: a picture of crowding, not
 *    any real protein's spectrum.
 *  - Unfolding is slow on the NMR time scale, so the folded and unfolded peaks are two sets whose
 *    heights follow the share of molecules unfolded (ubiquitin unfolds only in acid with 8 M urea:
 *    BMRB 16626 is at pH 2.5).
 *  - Binding is drawn in fast exchange: each peak moves in a straight line from free to bound in
 *    proportion to the share of ubiquitin bound, worked out from the Kd.
 *  - Exchange in D2O: each amide's peak fades as exp(-k t), k = k(OH-) [OD-], from the rates measured
 *    in H2O (exchange-in); isotope effects are left out.
 */
(function (root) {
  'use strict';

  var PKW_D2O = 14.87;     // pK of D2O at 25 C (pD + pOD)

  function tauFromMass(kDa) { return 0.6 * kDa; }

  /** Modelled 1H line width (Hz, full width at half height) of a protein's amide proton for a tumbling time (ns). */
  function protonLinewidthHz(tauNs) { return 1.5 + 1.2 * tauNs; }
  /** Modelled 15N line width (Hz). */
  function nitrogenLinewidthHz(tauNs) { return 1.0 + 0.55 * tauNs; }

  /** Every assigned proton shift of folded ubiquitin, with the residue it belongs to. */
  function protonShifts(data) {
    var out = [];
    data.residues.forEach(function (r) {
      Object.keys(r.shifts).forEach(function (atom) {
        if (atom.charAt(0) === 'H') out.push({ ppm: r.shifts[atom], n: r.n, atom: atom });
      });
    });
    return out;
  }

  /** A small seeded random generator, so the same picture is drawn every time. */
  function seeded(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /**
   * A 1D 1H spectrum: intensities on `points` evenly spaced ppm from `hi` down to `lo`, for a protein
   * of `kDa` drawn from ubiquitin's protons (see above), at `mhz`.
   */
  function oneD(data, kDa, mhz, lo, hi, points) {
    var protons = protonShifts(data);
    var copies = Math.max(1, Math.round(kDa / (data.massDa / 1000)));
    var rnd = seeded(76);
    var lines = [];
    for (var c = 0; c < copies; c++)
      protons.forEach(function (p) {
        var spread = c === 0 ? 0 : (rnd() - 0.5) * 0.5;
        lines.push(p.ppm + spread);
      });
    var widthPpm = protonLinewidthHz(tauFromMass(kDa)) / mhz;
    var g = widthPpm / 2, y = new Array(points);
    for (var i = 0; i < points; i++) {
      var ppm = hi - (hi - lo) * i / (points - 1), sum = 0;
      for (var k = 0; k < lines.length; k++) {
        var d = ppm - lines[k];
        if (d > 40 * g || d < -40 * g) continue;
        sum += g * g / (d * d + g * g);
      }
      y[i] = sum / copies;
    }
    return { y: y, linewidthHz: protonLinewidthHz(tauFromMass(kDa)), protons: lines.length };
  }

  /** The backbone amide peaks of folded ubiquitin: [{n, aa, H, N}] (all residues but Met1 and the prolines). */
  function amidePeaks(data) {
    var out = [];
    data.residues.forEach(function (r) {
      if (r.shifts.H !== undefined && r.shifts.N !== undefined) out.push({ n: r.n, aa: r.aa, H: r.shifts.H, N: r.shifts.N, kind: 'backbone' });
    });
    return out;
  }

  /** The side-chain NH2 peaks: two protons on one nitrogen for each Asn and Gln. */
  function sideChainPeaks(data) {
    var out = [];
    data.residues.forEach(function (r) {
      var s = r.shifts, pairs = r.aa === 'N' ? ['HD21', 'HD22', 'ND2'] : r.aa === 'Q' ? ['HE21', 'HE22', 'NE2'] : null;
      if (!pairs || s[pairs[0]] === undefined || s[pairs[1]] === undefined || s[pairs[2]] === undefined) return;
      out.push({ n: r.n, aa: r.aa, H: s[pairs[0]], N: s[pairs[2]], kind: 'sidechain' });
      out.push({ n: r.n, aa: r.aa, H: s[pairs[1]], N: s[pairs[2]], kind: 'sidechain' });
    });
    return out;
  }

  /** All the peaks of the folded HSQC. */
  function hsqcPeaks(data) { return amidePeaks(data).concat(sideChainPeaks(data)); }

  /** The unfolded protein's backbone amide peaks (BMRB 16626). */
  function unfoldedPeaks(data) {
    var out = [];
    data.residues.forEach(function (r) { if (r.unfolded) out.push({ n: r.n, aa: r.aa, H: r.unfolded.H, N: r.unfolded.N, kind: 'unfolded' }); });
    return out;
  }

  /** How many backbone amide peaks a sequence should give: every residue but the first and the prolines. */
  function expectedBackbonePeaks(sequence) {
    var n = 0;
    for (var i = 1; i < sequence.length; i++) if (sequence.charAt(i) !== 'P') n++;
    return n;
  }

  /** The share of ubiquitin bound for total protein and partner (same units) and a Kd (same units). */
  function fractionBound(protein, partner, kd) {
    var b = protein + partner + kd;
    var complex = (b - Math.sqrt(b * b - 4 * protein * partner)) / 2;
    return protein > 0 ? complex / protein : 0;
  }

  /** The amide peaks part way to bound with `partner` ('sh3a' or 'sh3c'): fast exchange, a straight line. */
  function titratedPeaks(data, partner, fraction) {
    return amidePeaks(data).map(function (p) {
      var r = data.residues[p.n - 1], d = r[partner];
      if (!d) return p;
      return { n: p.n, aa: p.aa, H: p.H + fraction * d.dH, N: p.N + fraction * d.dN, kind: 'backbone' };
    });
  }

  /** The combined shift change of a residue on binding (ppm): sqrt(dH^2 + (0.14 dN)^2). */
  function combinedShift(data, partner, n) {
    var d = data.residues[n - 1][partner];
    return d ? Math.sqrt(d.dH * d.dH + 0.14 * 0.14 * d.dN * d.dN) : null;
  }

  /** The exchange rate (per second) of a residue's amide in D2O at pD (modelled from k(OH-), see above). */
  function exchangeRate(data, n, pD) {
    var r = data.residues[n - 1];
    if (r.logkOH === undefined) return null;
    return Math.pow(10, r.logkOH) * Math.pow(10, pD - PKW_D2O);
  }

  /** How much of a residue's peak is left after `seconds` in D2O at pD (1 = all of it). */
  function remaining(data, n, pD, seconds) {
    var k = exchangeRate(data, n, pD);
    return k === null ? null : Math.exp(-k * seconds);
  }

  /** The half-life (seconds) of a residue's amide in D2O at pD. */
  function halfLife(data, n, pD) {
    var k = exchangeRate(data, n, pD);
    return k === null ? null : Math.LN2 / k;
  }

  // ---- Codes and each student's own part --------------------------------------------------------

  var CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function normalizeCode(text) { return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); }
  function validCode(code) {
    if (!code || code.length !== 5) return false;
    for (var i = 0; i < 5; i++) if (CODE_LETTERS.indexOf(code.charAt(i)) < 0) return false;
    return true;
  }
  function newCode(random) {
    var r = random || Math.random, s = '';
    for (var i = 0; i < 5; i++) s += CODE_LETTERS.charAt(Math.floor(r() * CODE_LETTERS.length));
    return s;
  }
  function codeSeed(code) {
    var h = 2166136261;
    for (var i = 0; i < code.length; i++) { h ^= code.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  var MASSES = [12, 14, 15, 18, 21, 24, 27, 30, 33, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 90];
  /** The kinds of residue a TOCSY strip can be named from (ubiquitin has none of Cys or Trp). */
  var TOCSY_KINDS = 'GAVLITSKEQDNFYRHM';
  /** Times at which the D2O spectra are taken (seconds), from ten minutes to four weeks. */
  var HX_TIMES = [600, 1800, 3600, 3 * 3600, 6 * 3600, 12 * 3600, 86400, 2 * 86400, 4 * 86400, 7 * 86400, 14 * 86400, 28 * 86400];
  var HX_PD = 7.0;

  /**
   * The protons a TOCSY from a residue's amide reaches: every assigned proton of the residue but the
   * amide itself, and but Asn's and Gln's NH2, which lie beyond the side chain's carbonyl, out of
   * the spin system.
   */
  function sideProtons(r) {
    return Object.keys(r.shifts).filter(function (a) {
      if (a.charAt(0) !== 'H' || a === 'H') return false;
      if (r.aa === 'N' && /^HD2[12]$/.test(a)) return false;
      if (r.aa === 'Q' && /^HE2[12]$/.test(a)) return false;
      // an aromatic ring's protons are a spin system of their own: their couplings to the H-beta, across
      // the ring's first carbon, are too small for the TOCSY to carry the amide's magnetization that far
      if ('FYWH'.indexOf(r.aa) >= 0 && /^H[DEZH]/.test(a)) return false;
      return true;
    }).reduce(function (out, a) {
      // a methyl's three protons share one shift (HB1, HB2, HB3 of Ala): one peak, 'HB (methyl)'
      var stem = a.replace(/\d$/, ''), ppm = r.shifts[a];
      var same = out.filter(function (p) { return p.stem === stem && p.ppm === ppm; })[0];
      if (same) { same.count++; if (same.count === 3) same.atom = stem + ' (methyl)'; }
      else out.push({ atom: a, ppm: ppm, stem: stem, count: 1 });
      return out;
    }, []);
  }

  /** Each student's own part of every question, from the code (always the same for the same code). */
  function picks(data, code) {
    var rnd = seeded(codeSeed(code || 'AAAAA'));
    function pick(list) { return list[Math.floor(rnd() * list.length)]; }
    var tocsy = data.residues.filter(function (r) {
      return r.n > 1 && r.shifts.H !== undefined && TOCSY_KINDS.indexOf(r.aa) >= 0 && sideProtons(r).length >= (r.aa === 'G' ? 2 : 2);
    }).map(function (r) { return r.n; });
    var hx = function (lo, hi) {
      return data.residues.filter(function (r) { return r.logkOH !== undefined && r.logkOH >= lo && r.logkOH < hi; }).map(function (r) { return r.n; });
    };
    var walkStarts = [];
    for (var s = 2; s + 6 <= 76; s++) {
      var ok = true;
      for (var k = s - 1; k <= s + 6; k++) {
        var r = data.residues[k - 1];
        if (!r || r.aa === 'P' || r.shifts.CA === undefined || (k >= s && r.shifts.H === undefined)) ok = false;
      }
      if (ok) walkStarts.push(s);
    }
    var three = [pick(hx(4.2, 5.0)), pick(hx(2.8, 3.8)), pick(hx(1.5, 2.6))];
    return {
      mass: pick(MASSES),
      tocsy: pick(tocsy),
      sequence: madeUpSequence(rnd),
      unfoldedShare: 10 * Math.floor(rnd() * 11),
      hx: three,
      walkStart: pick(walkStarts),
      walkOrder: shuffled(7, rnd)
    };
  }

  function shuffled(n, rnd) {
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
    // never left in order
    var inOrder = a.every(function (v, i) { return v === i; });
    if (inOrder) { var t2 = a[0]; a[0] = a[1]; a[1] = t2; }
    return a;
  }

  /** A made-up protein sequence (no real protein's) of 45 to 70 residues, with prolines, Asn, Gln and Trp in it. */
  function madeUpSequence(rnd) {
    var common = 'AAAAGGGGLLLLLVVVVEEEEKKKKSSSSTTTIIIDDDRRRNNQQPPPFFYYHMW';
    var len = 45 + Math.floor(rnd() * 26), s = ['M'];
    while (s.length < len) s.push(common.charAt(Math.floor(rnd() * common.length)));
    // each of P, N, Q and W at least once, put where none of the four already stands
    ['P', 'N', 'Q', 'W'].forEach(function (aa) {
      if (s.indexOf(aa) >= 0) return;
      var at;
      do { at = 1 + Math.floor(rnd() * (len - 1)); } while ('PNQW'.indexOf(s[at]) >= 0);
      s[at] = aa;
    });
    return s.join('');
  }

  /** The peaks an HSQC of a sequence shows: backbone amides, side-chain NH2 (two per Asn or Gln), Trp indoles. */
  function peakCount(sequence) {
    var backbone = expectedBackbonePeaks(sequence), side = 0;
    for (var i = 0; i < sequence.length; i++) {
      var c = sequence.charAt(i);
      if (c === 'N' || c === 'Q') side += 2;
      if (c === 'W') side += 1;
    }
    return { backbone: backbone, side: side, total: backbone + side };
  }

  // ---- What each part draws ----------------------------------------------------------------------

  /** A TOCSY strip: the residue's amide proton (f2) and the protons of its spin system (f1). */
  function tocsyStrip(data, n) {
    var r = data.residues[n - 1];
    return { n: n, aa: r.aa, H: r.shifts.H, N: r.shifts.N, peaks: [{ atom: 'H', ppm: r.shifts.H, diagonal: true }].concat(sideProtons(r)) };
  }

  /** The NOESY strip at an amide: every proton within 5 A, its height as r^-6 (modelled), scaled to the strongest. */
  function noesyStrip(data, n) {
    var r = data.residues[n - 1], list = (r.noe || []).map(function (x) { return { ppm: x[0], r: x[1], from: x[2], height: Math.pow(x[1], -6) }; });
    var top = list.reduce(function (m, x) { return Math.max(m, x.height); }, 0) || 1;
    list.forEach(function (x) { x.height /= top; });
    return { n: n, H: r.shifts.H, peaks: list };
  }

  /** How many other amide protons lie within `ppm` of a residue's own (the crowding that slowed the homonuclear walk). */
  function crowding(data, n, ppm) {
    var h = data.residues[n - 1].shifts.H, count = 0;
    data.residues.forEach(function (r) { if (r.n !== n && r.shifts.H !== undefined && Math.abs(r.shifts.H - h) <= (ppm || 0.03) + 1e-9) count++; });
    return count;
  }

  /** An HNCACB strip at residue i: its own Ca (up) and Cb (down), strong; residue i-1's, weak. */
  function hncacbStrip(data, n) {
    var r = data.residues[n - 1], p = data.residues[n - 2], peaks = [];
    if (r.shifts.CA !== undefined) peaks.push({ ppm: r.shifts.CA, sign: 1, strong: true, atom: 'CA' });
    if (r.shifts.CB !== undefined) peaks.push({ ppm: r.shifts.CB, sign: -1, strong: true, atom: 'CB' });
    if (p && p.shifts.CA !== undefined) peaks.push({ ppm: p.shifts.CA, sign: 1, strong: false, atom: 'CA' });
    if (p && p.shifts.CB !== undefined) peaks.push({ ppm: p.shifts.CB, sign: -1, strong: false, atom: 'CB' });
    return { n: n, H: r.shifts.H, N: r.shifts.N, peaks: peaks };
  }

  /** A peak's height in the D2O spectrum taken `seconds` after the protein went in (1 = all of it). */
  function hxHeight(data, n, seconds) { var v = remaining(data, n, HX_PD, seconds); return v === null ? 1 : v; }

  // ---- The checks -----------------------------------------------------------------------------------

  function num(text) {
    if (text === null || text === undefined) return NaN;
    var t = String(text).trim().replace(',', '.').replace(/\s+/g, '');
    if (!t) return NaN;
    return Number(t);
  }

  /** Each check returns {ok, kind, text}: kind 'good', 'off' (try again) or 'empty'. */
  function verdict(ok, offText) { return ok ? { ok: true, kind: 'good', text: 'Accepted.' } : { ok: false, kind: 'off', text: offText }; }

  function checkTau(mass, text) {
    var v = num(text), want = tauFromMass(mass);
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    return verdict(Math.abs(v - want) <= 0.1 * want, 'Not quite: use the rule of thumb, about 0.6 ns per kDa.');
  }
  function linewidthRatio(mass) { return protonLinewidthHz(tauFromMass(mass)) / protonLinewidthHz(4.12); }
  function checkRatio(mass, text) {
    var v = num(text), want = linewidthRatio(mass);
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    return verdict(Math.abs(v - want) <= 0.25 * want, 'Not quite: compare the line widths the slider shows for that mass and for ubiquitin.');
  }
  function checkAminoAcid(data, n, letter) {
    if (!letter) return { ok: false, kind: 'empty', text: '' };
    return verdict(letter === data.residues[n - 1].aa, 'Not this one: compare the strip’s shifts with the table, side chain by side chain.');
  }
  function checkCrowding(data, n, text) {
    var v = num(text);
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    return verdict(v === crowding(data, n, 0.03), 'Not quite: count every other amide proton whose shift is within 0.03 ppm of this one.');
  }
  function checkCount(sequence, which, text) {
    var v = num(text);
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    var want = peakCount(sequence)[which];
    var hint = which === 'backbone' ? 'Every residue has an amide N–H but the first one and the prolines.'
      : which === 'side' ? 'Asn and Gln each have an NH₂ (two protons on one nitrogen, two peaks); Trp has its ring N–H.'
      : 'Add the two together.';
    return verdict(v === want, 'Not quite. ' + hint);
  }
  function checkShare(share, text) {
    var v = num(text);
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    return verdict(Math.abs(v - share) <= 10, 'Not quite: compare the folded peaks’ heights with the unfolded ones’.');
  }
  function checkHalfLife(data, n, hoursText) {
    var v = num(hoursText), want = halfLife(data, n, HX_PD) / 3600;
    if (isNaN(v) || v <= 0) return { ok: false, kind: 'empty', text: '' };
    return verdict(v / want <= 1.5 && want / v <= 1.5, 'Not quite: find the time at which the peak is down to half its first height.');
  }
  function checkHbond(data, n, answer) {
    if (answer !== 'yes' && answer !== 'no') return { ok: false, kind: 'empty', text: '' };
    var want = data.residues[n - 1].hbonded ? 'yes' : 'no';
    return verdict(answer === want, 'Look at the structure: does this amide’s N–H point at a C=O within hydrogen-bonding reach?');
  }
  function checkWalk(start, order) {
    if (!order || order.length !== 7 || order.some(function (x) { return x === null || x === undefined || x === ''; })) return { ok: false, kind: 'empty', text: '' };
    var ok = order.every(function (n, i) { return +n === start + i; });
    return verdict(ok, 'Not yet: each strip’s weak peaks must match the strong peaks of the strip before it.');
  }

  // ---- The routine at the magnet (the page keeps it; Unity shows it) --------------------------------
  //
  // Three tubes wait in the rack on the sample bench. A tube is taken in hand, carried up the
  // platform's stair, and lowered into the bore on the lift air; then the spectrometer is locked on
  // the solvent's deuterium, shimmed, the probe tuned and matched, and the temperature set, before
  // any experiment. Nothing here is secret (ubiquitin's data are public), so the rules live in the
  // page, where Node can test them, and Unity draws what the state says.

  var TUBES = {
    A: { name: 'Sample A', what: '1 mM ubiquitin, ¹⁵N and ¹³C labelled, in 90% H₂O and 10% D₂O, pH 6.5' },
    B: { name: 'Sample B', what: 'the mystery sample: ¹⁵N-labelled ubiquitin in 8 M urea, acidified' },
    C: { name: 'Sample C', what: '¹⁵N-labelled ubiquitin just dissolved in D₂O, pD 7.0' }
  };

  /** The experiments, what each needs, and how long each takes on a real 1.2 GHz magnet with a cryoprobe (typical, for a 1 mM sample). */
  var EXPERIMENTS = [
    { id: '1d', name: '1D ¹H', tubes: 'A', real: 'about 1 minute' },
    { id: 'tocsy', name: '2D TOCSY', tubes: 'A', real: 'about 2 hours' },
    { id: 'noesy', name: '2D NOESY', tubes: 'A', real: 'about 6 hours' },
    { id: 'hsqc', name: '¹H–¹⁵N HSQC', tubes: 'AB', real: 'about 10 minutes' },
    { id: 'hncacb', name: '3D HNCACB', tubes: 'A', real: 'about 4 hours with non-uniform sampling (about 2 days without)' },
    { id: 'hx', name: 'HSQCs in D₂O, over four weeks', tubes: 'C', real: '10 minutes each, the first as soon as the sample is in, the last after four weeks' }
  ];

  var SETUP = ['lock', 'shim', 'tune', 'temp'];

  function blankRoutine() {
    return { tube: '', where: '', top: false, lock: false, shim: false, tune: false, temp: false, running: '' };
  }

  /** What an experiment on the tube in the magnet records under ('hsqc' on sample B is the mystery spectrum). */
  function recordName(exp, tube) { return exp === 'hsqc' && tube === 'B' ? 'mystery' : exp; }

  /**
   * One step of the routine: returns {ok, state, reason}. The state is a new object; a refusal keeps
   * the old one and gives a reason (a code the page turns into words, routineText).
   */
  function step(r, what) {
    var s = JSON.parse(JSON.stringify(r)), parts = String(what).split(' '), verb = parts[0], arg = parts[1] || '';
    function no(reason) { return { ok: false, state: r, reason: reason }; }
    if (s.running && verb !== 'finish') return no('running');
    switch (verb) {
      case 'take':
        if (!TUBES[arg]) return no('which');
        if (s.tube) return no(s.where === 'magnet' ? 'tube-in-magnet' : 'hands-full');
        if (s.top) return no('come-down');
        s.tube = arg; s.where = 'hand'; return { ok: true, state: s };
      case 'putback':
        if (s.where !== 'hand') return no('nothing-in-hand');
        if (s.top) return no('come-down');
        s.tube = ''; s.where = ''; return { ok: true, state: s };
      case 'climb':
        if (s.top) return no('already-up');
        s.top = true; return { ok: true, state: s };
      case 'down':
        if (!s.top) return no('already-down');
        s.top = false; return { ok: true, state: s };
      case 'insert':
        if (s.where !== 'hand') return no('nothing-in-hand');
        if (!s.top) return no('climb-first');
        s.where = 'magnet'; SETUP.forEach(function (k) { s[k] = false; }); return { ok: true, state: s };
      case 'eject':
        if (s.where !== 'magnet') return no('magnet-empty');
        if (!s.top) return no('climb-first');
        s.where = 'hand'; SETUP.forEach(function (k) { s[k] = false; }); return { ok: true, state: s };
      case 'lock':
        if (s.where !== 'magnet') return no('magnet-empty');
        s.lock = true; return { ok: true, state: s };
      case 'shim':
        if (s.where !== 'magnet') return no('magnet-empty');
        if (!s.lock) return no('lock-first');
        s.shim = true; return { ok: true, state: s };
      case 'tune':
        if (s.where !== 'magnet') return no('magnet-empty');
        s.tune = true; return { ok: true, state: s };
      case 'temp':
        if (s.where !== 'magnet') return no('magnet-empty');
        s.temp = true; return { ok: true, state: s };
      case 'run':
        var e = EXPERIMENTS.filter(function (x) { return x.id === arg; })[0];
        if (!e) return no('which');
        if (s.where !== 'magnet') return no('magnet-empty');
        for (var i = 0; i < SETUP.length; i++) if (!s[SETUP[i]]) return no('setup-' + SETUP[i]);
        if (e.tubes.indexOf(s.tube) < 0) return no('wrong-tube');
        s.running = arg; return { ok: true, state: s };
      case 'finish':
        if (!s.running) return no('not-running');
        s.running = ''; return { ok: true, state: s };
    }
    return no('which');
  }

  var ROUTINE_TEXT = {
    'running': 'An experiment is running: wait for it to finish.',
    'which': 'That is not something the room can do.',
    'tube-in-magnet': 'A tube is still in the magnet: climb up and take it out first.',
    'hands-full': 'You already have a tube in hand: put it back first.',
    'come-down': 'The rack is on the sample bench: come down from the platform first.',
    'nothing-in-hand': 'You have no tube in hand.',
    'already-up': 'You are already on the platform.',
    'already-down': 'You are already on the floor.',
    'climb-first': 'The top of the magnet is reached from the platform: climb the stair first.',
    'magnet-empty': 'There is no tube in the magnet.',
    'lock-first': 'Lock on the deuterium signal first: shimming follows the lock.',
    'setup-lock': 'Lock on the deuterium signal first.',
    'setup-shim': 'Shim the field first.',
    'setup-tune': 'Tune and match the probe first.',
    'setup-temp': 'Set the temperature to 25 °C first.',
    'wrong-tube': 'That experiment is not for the tube in the magnet: see what each sample is for.',
    'not-running': 'Nothing is running.'
  };
  function routineText(code) { return ROUTINE_TEXT[code] || code; }

  // ---- Session 2 --------------------------------------------------------------------------------

  // the two titration tubes, and the experiment that records each one's series of HSQCs
  TUBES.D = { name: 'Sample D', what: '¹⁵N-labelled ubiquitin, 0.2 mM, with the SH3-A domain of CD2AP added step by step, pH 6.0' };
  TUBES.E = { name: 'Sample E', what: '¹⁵N-labelled ubiquitin, 0.2 mM, with the SH3-C domain of CD2AP added step by step, pH 6.0' };
  EXPERIMENTS.push({ id: 'titration', name: 'HSQC titration', tubes: 'DE', real: 'about 10 minutes for each of eight HSQCs, the partner added between them', part: 2 });
  EXPERIMENTS.forEach(function (e) { if (!e.part) e.part = 1; });
  var baseRecordName = recordName;
  recordName = function (exp, tube) { if (exp === 'titration') return tube === 'D' ? 'sh3a' : 'sh3c'; return baseRecordName(exp, tube); };

  /** The wavelength of the home diffractometer's source: gallium K-alpha (A). */
  var LAMBDA = 1.34;
  var DROP_KINDS = ['clear', 'precipitate', 'micro', 'skin', 'cluster', 'crystal'];
  var DROP_TEXT = {
    clear: 'Clear: the protein stayed in solution.',
    precipitate: 'Precipitate: brown grains, the protein came out of solution too fast.',
    micro: 'A shower of microcrystals: too small to pick one up.',
    skin: 'A skin on the drop’s surface, and nothing under it.',
    cluster: 'Crystals grown into one another: a single one cannot be picked out.',
    crystal: 'A single crystal with sharp edges, about a fifth of a millimetre across.'
  };

  /** Each student's own part of Session 2, from the code. */
  function picks2(data, code) {
    var rnd = seeded(codeSeed('2' + (code || 'AAAAA')));
    function pick(list) { return list[Math.floor(rnd() * list.length)]; }
    var withNoe = data.residues.filter(function (r) { return r.noe && longRange(data, r.n) >= 2; }).map(function (r) { return r.n; });
    var tight = data.residues.filter(function (r) { return r.spread !== undefined && r.n <= 70 && r.spread < 0.075; }).map(function (r) { return r.n; });
    var loose = data.residues.filter(function (r) { return r.spread !== undefined && r.spread > 0.13; }).map(function (r) { return r.n; });
    var lowB = data.residues.filter(function (r) { return r.bfactor !== undefined && r.bfactor < 6; }).map(function (r) { return r.n; });
    var highB = data.residues.filter(function (r) { return r.bfactor !== undefined && r.bfactor > 15; }).map(function (r) { return r.n; });
    var partner = rnd() < 0.5 ? 'sh3a' : 'sh3c';
    var movers = data.residues.filter(function (r) { var c = combinedShift(data, partner, r.n); return c !== null && c > 0.12; }).map(function (r) { return r.n; });
    var spreadPair = [pick(tight), pick(loose)], bPair = [pick(lowB), pick(highB)];
    if (rnd() < 0.5) spreadPair.reverse();
    if (rnd() < 0.5) bPair.reverse();
    // a made-up crystallisation plate of 24 drops: one or two single crystals among the rest
    var plate = [];
    for (var i = 0; i < 24; i++) plate.push(DROP_KINDS[Math.floor(rnd() * 5)]);
    var good = 1 + Math.floor(rnd() * 2);
    for (var g = 0; g < good; g++) plate[Math.floor(rnd() * 24)] = 'crystal';
    if (plate.indexOf('crystal') < 0) plate[Math.floor(rnd() * 24)] = 'crystal';
    var distances = [40, 50, 60, 75], limits = [];
    for (var d = 1.6; d <= 3.21; d += 0.1) limits.push(Math.round(d * 10) / 10);
    // a distance and a resolution whose furthest spots land well inside the detector (18 to 56 mm from its centre)
    var pairs = [];
    distances.forEach(function (dd) { limits.forEach(function (ll) { var r = spotRadius(ll, dd); if (r >= 18 && r <= 56) pairs.push([dd, ll]); }); });
    var pr = pick(pairs), dist = pr[0], lim = pr[1];
    return {
      noe: pick(withNoe), spreadPair: spreadPair, partner: partner, mover: pick(movers), bPair: bPair, plate: plate,
      detectorMm: dist, limit: lim, spotMm: spotRadius(lim, dist),
      mapResidue: pick([4, 45, 59, 68]), mapOrder: shuffled(3, rnd)
    };
  }

  /** How many of a residue's amide NOEs reach a residue 5 or more along the chain. */
  function longRange(data, n) {
    var r = data.residues[n - 1];
    return (r.noe || []).filter(function (x) { return Math.abs(x[2] - n) >= 5; }).length;
  }

  /** Bragg: where on a flat detector, D mm from the crystal, spots of spacing d (A) land: r = D tan 2theta. */
  function spotRadius(d, detectorMm) { var th = Math.asin(LAMBDA / (2 * d)); return Math.round(detectorMm * Math.tan(2 * th) * 10) / 10; }
  /** And back: the spacing of a spot r mm out. */
  function resolutionAt(r, detectorMm) { var th = Math.atan(r / detectorMm) / 2; return LAMBDA / (2 * Math.sin(th)); }

  function checkLongRange(data, n, text) {
    var v = num(text);
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    return verdict(v === longRange(data, n), 'Not quite: count the NOEs to residues five or more along the chain from this one, either way.');
  }
  function checkSpread(data, pair, choice) {
    if (!choice) return { ok: false, kind: 'empty', text: '' };
    var a = data.residues[pair[0] - 1].spread, b = data.residues[pair[1] - 1].spread;
    return verdict(+choice === (a > b ? pair[0] : pair[1]), 'Look again at the bundle: where do the ten models part company?');
  }
  function checkShift(data, partner, n, text) {
    var v = num(text), want = combinedShift(data, partner, n);
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    return verdict(Math.abs(v - want) <= 0.2 * want + 0.005, 'Not quite: read the peak’s free and bound places, then √(ΔH² + (0.14 ΔN)²).');
  }
  function topMover(data, partner) {
    var best = 0, at = 0;
    data.residues.forEach(function (r) { var c = combinedShift(data, partner, r.n); if (c !== null && c > best) { best = c; at = r.n; } });
    return at;
  }
  function checkTopMover(data, partner, text) {
    var v = num(String(text).replace(/[^0-9.]/g, ''));
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    return verdict(v === topMover(data, partner), 'Not this one: which peak travels furthest from its free place?');
  }
  function checkDrop(plate, index) {
    if (index === '' || index === null || index === undefined) return { ok: false, kind: 'empty', text: '' };
    return verdict(plate[+index] === 'crystal', 'That drop holds no single crystal to fish.');
  }
  function checkResolution(p, text) {
    var v = num(text);
    if (isNaN(v)) return { ok: false, kind: 'empty', text: '' };
    var want = resolutionAt(p.spotMm, p.detectorMm);
    return verdict(Math.abs(v - want) <= 0.03 * want, 'Not quite: tan 2θ = r / D, then d = λ / (2 sin θ), with λ = 1.34 Å.');
  }
  function checkMapOrder(order, answers) {
    // order[i] is which resolution (index into 3.5, 2.5, 1.5) map i shows; answers[i] the student's resolution for map i
    if (!answers || answers.some(function (a) { return !a; })) return { ok: false, kind: 'empty', text: '' };
    var res = [3.5, 2.5, 1.5];
    return verdict(answers.every(function (a, i) { return +a === res[order[i]]; }), 'Not yet: the finer the map, the more a ring shows its hole and a side chain its shape.');
  }
  function checkOrdered(data, pair, choice) {
    if (!choice) return { ok: false, kind: 'empty', text: '' };
    var a = data.residues[pair[0] - 1].bfactor, b = data.residues[pair[1] - 1].bfactor;
    return verdict(+choice === (a < b ? pair[0] : pair[1]), 'Look at the colours: the lower the B-factor, the better ordered.');
  }

  // ---- The routine in the X-ray room --------------------------------------------------------------
  //
  // Fish a single crystal from a drop into a loop, plunge it into liquid nitrogen, open the cabinet,
  // mount it on the goniometer in the cold stream, centre it in the beam, close the doors, switch the
  // X-rays on, collect. The doors cannot open while the X-rays are on (the cabinet's interlock).

  function blankXray() { return { drop: -1, crystal: '', doors: false, xrays: false, centred: false, collected: false }; }

  function xstep(r, plate, what) {
    var s = JSON.parse(JSON.stringify(r)), parts = String(what).split(' '), verb = parts[0], arg = parts[1];
    function no(reason) { return { ok: false, state: r, reason: reason }; }
    switch (verb) {
      case 'fish':
        if (s.crystal) return no('x-have-one');
        var k = plate[+arg];
        if (k === undefined) return no('which');
        if (k !== 'crystal') return no('x-drop-' + k);
        s.drop = +arg; s.crystal = 'loop'; return { ok: true, state: s };
      case 'freeze':
        if (s.crystal !== 'loop') return no(s.crystal ? 'x-frozen' : 'x-no-crystal');
        s.crystal = 'frozen'; return { ok: true, state: s };
      case 'open':
        if (s.xrays) return no('x-interlock');
        s.doors = true; return { ok: true, state: s };
      case 'close':
        s.doors = false; return { ok: true, state: s };
      case 'mount':
        if (s.crystal === 'loop') return no('x-freeze-first');
        if (s.crystal !== 'frozen') return no('x-no-crystal');
        if (!s.doors) return no('x-open-first');
        s.crystal = 'mounted'; return { ok: true, state: s };
      case 'centre':
        if (s.crystal !== 'mounted') return no('x-mount-first');
        if (!s.doors) return no('x-open-first');
        s.centred = true; return { ok: true, state: s };
      case 'xrays':
        if (s.doors) return no('x-close-first');
        if (s.crystal !== 'mounted' || !s.centred) return no('x-centre-first');
        s.xrays = true; return { ok: true, state: s };
      case 'xraysoff':
        s.xrays = false; return { ok: true, state: s };
      case 'collect':
        if (!s.xrays) return no('x-xrays-first');
        s.collected = true; return { ok: true, state: s };
    }
    return no('which');
  }

  ROUTINE_TEXT['x-have-one'] = 'You already have a crystal: one is enough.';
  ROUTINE_TEXT['x-drop-clear'] = DROP_TEXT.clear + ' Nothing to fish.';
  ROUTINE_TEXT['x-drop-precipitate'] = DROP_TEXT.precipitate + ' Nothing to fish.';
  ROUTINE_TEXT['x-drop-micro'] = DROP_TEXT.micro;
  ROUTINE_TEXT['x-drop-skin'] = DROP_TEXT.skin + ' Nothing to fish.';
  ROUTINE_TEXT['x-drop-cluster'] = DROP_TEXT.cluster;
  ROUTINE_TEXT['x-frozen'] = 'The crystal is already frozen.';
  ROUTINE_TEXT['x-no-crystal'] = 'You have no crystal yet: fish one from a drop.';
  ROUTINE_TEXT['x-interlock'] = 'The doors are locked while the X-rays are on: switch them off first.';
  ROUTINE_TEXT['x-freeze-first'] = 'Freeze the crystal first: at room temperature the beam would destroy it within minutes.';
  ROUTINE_TEXT['x-open-first'] = 'Open the cabinet’s doors first.';
  ROUTINE_TEXT['x-mount-first'] = 'Mount the crystal on the goniometer first.';
  ROUTINE_TEXT['x-close-first'] = 'Close the doors first: the X-rays only switch on with the doors shut.';
  ROUTINE_TEXT['x-centre-first'] = 'Mount the crystal and centre it in the beam first.';
  ROUTINE_TEXT['x-xrays-first'] = 'Switch the X-rays on first.';

  var api = {
    picks2: picks2, longRange: longRange, spotRadius: spotRadius, resolutionAt: resolutionAt, LAMBDA: LAMBDA, DROP_TEXT: DROP_TEXT, topMover: topMover,
    checkLongRange: checkLongRange, checkSpread: checkSpread, checkShift: checkShift, checkTopMover: checkTopMover, checkDrop: checkDrop,
    checkResolution: checkResolution, checkMapOrder: checkMapOrder, checkOrdered: checkOrdered, blankXray: blankXray, xstep: xstep,
    TUBES: TUBES, EXPERIMENTS: EXPERIMENTS, SETUP: SETUP, blankRoutine: blankRoutine, step: step, recordName: recordName, routineText: routineText,
    normalizeCode: normalizeCode, validCode: validCode, newCode: newCode, picks: picks, peakCount: peakCount,
    tocsyStrip: tocsyStrip, noesyStrip: noesyStrip, crowding: crowding, hncacbStrip: hncacbStrip, hxHeight: hxHeight,
    HX_TIMES: HX_TIMES, HX_PD: HX_PD, MASSES: MASSES, TOCSY_KINDS: TOCSY_KINDS, linewidthRatio: linewidthRatio, num: num,
    checkTau: checkTau, checkRatio: checkRatio, checkAminoAcid: checkAminoAcid, checkCrowding: checkCrowding,
    checkCount: checkCount, checkShare: checkShare, checkHalfLife: checkHalfLife, checkHbond: checkHbond, checkWalk: checkWalk,
    tauFromMass: tauFromMass, protonLinewidthHz: protonLinewidthHz, nitrogenLinewidthHz: nitrogenLinewidthHz,
    protonShifts: protonShifts, oneD: oneD, amidePeaks: amidePeaks, sideChainPeaks: sideChainPeaks,
    hsqcPeaks: hsqcPeaks, unfoldedPeaks: unfoldedPeaks, expectedBackbonePeaks: expectedBackbonePeaks,
    fractionBound: fractionBound, titratedPeaks: titratedPeaks, combinedShift: combinedShift,
    exchangeRate: exchangeRate, remaining: remaining, halfLife: halfLife, PKW_D2O: PKW_D2O
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UbiqModel = api;
})(this);
