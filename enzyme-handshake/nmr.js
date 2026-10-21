/* The Enzyme's Handshake: the ¹H NMR spectrum of the student's Part 1 product, at 400 MHz in CDCl₃,
 * drawn by the page (window.HandNmr; loadable in Node for tests). Nothing here is secret: the
 * spectrum shows the alcohol, whatever ethyl acetoacetate the yeast left (and its 3% of enol), water
 * if the product was not dried, the residual CHCl₃ and TMS. NMR confirms the structure and shows the
 * leftover ketone; it does not measure the ee (his decision, 2026-10-19).
 *
 * Shifts (the lab's checked facts, kept with the instructor's files: yeast_reduction_facts.md, "¹H NMR"):
 *  - ethyl 3-hydroxybutanoate, CDCl₃: 4.19 and 4.17 (CH-O, O-CH₂), 3.18 (OH), 2.49 and 2.43 (CH₂CO),
 *    1.26 (t) and 1.23 (d) (ChemicalBook's assigned 90 MHz spectrum); J 6.4 (CH₃CH) and 6.9-7.1
 *    (ethyl) from a 400 MHz report. Modelled: the CH₂'s two dd (16.4 geminal, 3.4 and 8.6 to the CH,
 *    as for a related 3-hydroxy ester), the OH's exact place (it moves with concentration).
 *  - ethyl acetoacetate: neat 4.14 (q), 3.48 (CH₂), 2.21 (CH₃), 1.23 (t); enol 12.14 (OH), 5.03 (=CH),
 *    1.94 (CH₃), 3% enol at 0.05 M in CDCl₃ (Cook & Feltman 2007). Modelled: the CDCl₃ values used
 *    here (4.20, 3.44, 2.27, 1.28), within a few hundredths of the neat ones.
 */
(function (root) {
  'use strict';

  var MHZ = 400;
  var MW_ALCOHOL = 132.16, MW_KETONE = 130.14, MW_WATER = 18.02;
  var ENOL = 0.03;

  /** The lines of a first-order multiplet: its middle (ppm), how many H, and its couplings [[J in Hz, to how many H], ...]. */
  function multiplet(ppm, h, couplings, widthHz) {
    var lines = [{ ppm: ppm, i: 1 }];
    (couplings || []).forEach(function (c) {
      var j = c[0] / MHZ, n = c[1], next = [];
      // binomial: n equivalent neighbours split each line into n + 1
      var coeff = [1];
      for (var k = 0; k < n; k++) { var row = [1]; for (var m = 1; m < coeff.length; m++) row.push(coeff[m - 1] + coeff[m]); row.push(1); coeff = row; }
      var total = coeff.reduce(function (a, b) { return a + b; }, 0);
      lines.forEach(function (l) {
        for (var k = 0; k <= n; k++) next.push({ ppm: l.ppm + (k - n / 2) * j, i: l.i * coeff[k] / total });
      });
      lines = next;
    });
    return { ppm: ppm, h: h, width: widthHz || 0.9, lines: lines };
  }

  /** Each compound's signals, per molecule (the H counts weight them). */
  var ALCOHOL = [
    multiplet(1.229, 3, [[6.3, 1]]),                    // CH3-CH
    multiplet(1.268, 3, [[7.1, 2]]),                    // O-CH2-CH3
    multiplet(2.490, 1, [[16.4, 1], [3.4, 1]]),         // CH2-C=O, the two protons apart (modelled J)
    multiplet(2.417, 1, [[16.4, 1], [8.6, 1]]),
    multiplet(2.95, 1, [], 9),                          // O-H, broad
    multiplet(4.170, 2, [[7.1, 3]]),                    // O-CH2
    multiplet(4.212, 1, [[8.6, 1], [6.3, 3], [3.4, 1]]) // CH-O
  ];
  var KETO = [multiplet(1.280, 3, [[7.1, 2]]), multiplet(2.270, 3, []), multiplet(3.440, 2, []), multiplet(4.200, 2, [[7.1, 3]])];
  var ENOLFORM = [multiplet(1.275, 3, [[7.1, 2]]), multiplet(1.940, 3, []), multiplet(4.185, 2, [[7.1, 3]]), multiplet(5.020, 1, []), multiplet(12.12, 1, [], 3)];
  var WATER = [multiplet(1.56, 2, [], 6)];
  var SOLVENT = [multiplet(7.26, 1, []), multiplet(0.00, 12, [])];   // the residual CHCl3 and TMS, in fixed small amounts

  /** The regions the spectrometer's software integrates (ppm, high to low), as printed under the spectrum. */
  var REGIONS = [
    { id: 'A', from: 4.32, to: 4.05 }, { id: 'B', from: 3.50, to: 3.38 }, { id: 'C', from: 3.20, to: 2.70 },
    { id: 'D', from: 2.56, to: 2.33 }, { id: 'E', from: 2.32, to: 2.22 }, { id: 'G', from: 1.35, to: 1.12 }
  ];

  /** Every line in the sample's spectrum, from the product's make-up (model.js product: grams of alcohol, ketone, water). */
  function lines(prod) {
    var nA = (prod.alcohol || 0) / MW_ALCOHOL, nK = (prod.ketone || 0) / MW_KETONE, nW = (prod.water || 0) / MW_WATER;
    var total = nA + nK + nW || 1;
    var out = [];
    function add(set, moles) {
      set.forEach(function (s) { s.lines.forEach(function (l) { out.push({ ppm: l.ppm, a: l.i * s.h * moles / total, w: s.width }); }); });
    }
    add(ALCOHOL, nA); add(KETO, nK * (1 - ENOL)); add(ENOLFORM, nK * ENOL); add(WATER, nW * 0.6);
    add(SOLVENT, 0.004);
    return out;
  }

  /** The spectrum's height at `ppm`: Lorentzian lines, each `w` Hz wide at half height. */
  function heightAt(all, ppm) {
    var y = 0;
    for (var k = 0; k < all.length; k++) {
      var l = all[k], hw = l.w / 2 / MHZ, d = ppm - l.ppm;
      if (Math.abs(d) > 0.5) continue;
      y += l.a * hw / Math.PI / (d * d + hw * hw);
    }
    return y;
  }

  /** The integral of each region, scaled so that region D (the CH2 next to the C=O, 2 H) reads 2.00; two decimals, as printed. */
  function integrals(prod) {
    var all = lines(prod), raw = {};
    REGIONS.forEach(function (r) {
      var sum = 0;
      all.forEach(function (l) {
        var hw = l.w / 2 / MHZ;
        // the share of a Lorentzian line between `to` and `from`
        sum += l.a * (Math.atan((r.from - l.ppm) / hw) - Math.atan((r.to - l.ppm) / hw)) / Math.PI;
      });
      raw[r.id] = sum;
    });
    var scale = raw.D > 1e-9 ? 2 / raw.D : 0, out = {};
    REGIONS.forEach(function (r) { out[r.id] = Math.round(raw[r.id] * scale * 100) / 100; });
    return out;
  }

  /** The six signals of ethyl 3-hydroxybutanoate the student assigns, and the protons to choose from. */
  var SIGNALS = [
    { id: 's1', text: '1.23 ppm, doublet, 3 H', answer: 'ch3ch' },
    { id: 's2', text: '1.27 ppm, triplet, 3 H', answer: 'ch3ethyl' },
    { id: 's3', text: '2.42 and 2.49 ppm, two doublets of doublets, 1 H each', answer: 'ch2co' },
    { id: 's4', text: 'about 2.9 ppm, broad singlet, 1 H', answer: 'oh' },
    { id: 's5', text: '4.17 ppm, quartet, 2 H', answer: 'och2' },
    { id: 's6', text: '4.21 ppm, multiplet, 1 H', answer: 'cho' }
  ];
  var PROTONS = [
    { id: 'ch3ch', text: 'CH₃ on the carbon that carries the OH' },
    { id: 'ch3ethyl', text: 'CH₃ of the ethyl group' },
    { id: 'ch2co', text: 'CH₂ next to the C=O' },
    { id: 'oh', text: 'O–H' },
    { id: 'och2', text: 'O–CH₂ of the ethyl group' },
    { id: 'cho', text: 'CH–O (the new stereocenter)' }
  ];

  function num(text) {
    if (text === null || text === undefined) return NaN;
    var t = String(text).trim().replace(',', '.').replace(/\s+/g, '');
    return t ? Number(t) : NaN;
  }
  function verdict(ok, off) { return ok ? { ok: true, kind: 'good', text: 'Accepted.' } : { ok: false, kind: 'off', text: off }; }
  function empty() { return { ok: false, kind: 'empty', text: '' }; }

  /** One assignment: right or not (nothing here is secret: it is the structure the student made). */
  function checkSignal(id, choice) {
    if (!choice) return empty();
    var s = SIGNALS.filter(function (x) { return x.id === id; })[0];
    return verdict(s && s.answer === choice, 'Not that one: think about the neighbours each set has (the splitting) and what it is bonded to (the shift).');
  }
  /** Mole percent of ethyl acetoacetate left, from the student's own integrals: B (its CH2, 2 H) against D (the alcohol's CH2, 2 H). */
  function checkKetonePercent(ints, text) {
    var v = num(text); if (isNaN(v)) return empty();
    var want = 100 * ints.B / (ints.B + ints.D);
    return verdict(Math.abs(v - want) <= Math.max(0.3, 0.05 * want), 'Not quite: compare region B (the ketone’s CH₂, 2 H) with region D (the alcohol’s CH₂, 2 H). Enter 0 if there is no peak at 3.44.');
  }
  /** The ee corrected for the ketone in the polarimeter sample: ee / (mass fraction of the alcohol), from the student's own numbers. */
  function checkCorrectedEe(ee, ketonePercent, text) {
    var v = num(text); if (isNaN(v) || isNaN(ee) || isNaN(ketonePercent)) return empty();
    var x = ketonePercent / 100, w = (1 - x) * MW_ALCOHOL / ((1 - x) * MW_ALCOHOL + x * MW_KETONE);
    var want = ee / w;
    return verdict(Math.abs(v - want) <= 0.6, 'Not quite: the ketone added weight but no rotation, so divide your ee by the mass fraction of the alcohol in the sample.');
  }

  var api = {
    MHZ: MHZ, REGIONS: REGIONS, SIGNALS: SIGNALS, PROTONS: PROTONS,
    lines: lines, heightAt: heightAt, integrals: integrals,
    checkSignal: checkSignal, checkKetonePercent: checkKetonePercent, checkCorrectedEe: checkCorrectedEe
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HandNmr = api;
})(this);
