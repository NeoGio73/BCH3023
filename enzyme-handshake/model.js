/* The Enzyme's Handshake: the page's model of Part 1 (baker's yeast reduces ethyl acetoacetate to
 * (S)-ethyl 3-hydroxybutanoate). Pure functions, loadable in Node for tests
 * (Tools/handshake_model_test.js). Nothing in Part 1 is secret (the yeast's preference for (S) is
 * textbook chemistry), so its rules live here, as in the ubiquitin lab, and Unity will draw them.
 *
 * Sources (the lab's checked facts, kept with the instructor's files: yeast_reduction_facts.md):
 *  - The procedure is Org. Synth. (Seebach, Sutter, Weber, Zuger 1985, 63, 1) at one eighth.
 *  - The recipes' ee and yield ranges: Org. Synth. (two portions, 82-87%, 59-76%), Fow et al. 2008
 *    (batch 75%; feeding up to 98%), Wipf et al. 1983 via Org. Synth. Note 10 (slow feeding with air,
 *    >95%), Seebach et al., Chimia 1986 (starved yeast, 25:1, 94%, 70%).
 *  - Pure (S) reads [alpha] +43.5 (25 C, CHCl3, c 1.0): Org. Synth. Note 10.
 * Modelled (no source gives a number): the one-portion and slow-feeding yields, how fast each
 * portion is reduced (first order, 99% done at the times the procedures give), what each
 * slip at the bench costs, and the polarimeter's errors.
 */
(function (root) {
  'use strict';

  var MW_KETONE = 130.14, MW_PRODUCT = 132.16;      // g/mol, PubChem
  var ALPHA_PURE_S = 43.5;                          // degrees, (S), CHCl3, c 1.0 g/100 mL, 25 C
  var DENSITY_KETONE = 1.028;                       // g/mL at 20 C (HSDB)
  /** Yeast "rapidly dies" at 54-60 C (America's Test Kitchen); it is best woken at 35-40 C (Fleischmann's, AWRI). */
  var YEAST_DIES_C = 55, YEAST_STRESSED_C = 45;

  // ---- Codes and each student's own fermentation -------------------------------------------------

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
  function seeded(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /**
   * How the fermentation is run: the four recipes with published effects (see the header). Amounts
   * are Org. Synth.'s at one eighth. `portions` lists the substrate's additions: [hours after the
   * yeast went in, grams]. `doneBy` is how long after each addition it is 99% reduced.
   */
  var RECIPES = {
    one: {
      name: 'One portion', water: 200, sugar: 37.5, yeast: 25, feedSugar: 25, feedWater: 125, ethanol: false, shaken: false,
      portions: [[1, 5.00]], doneBy: 72, ee: [73, 77], yield: [50, 65], source: 'Fow et al. 2008 (batch, 75%); yield modelled'
    },
    two: {
      name: 'Two portions, fresh sugar', water: 200, sugar: 37.5, yeast: 25, feedSugar: 25, feedWater: 125, ethanol: false, shaken: false,
      portions: [[1, 2.50], [26, 2.50]], doneBy: 55, ee: [82, 87], yield: [59, 76], source: 'Org. Synth. 1985'
    },
    slow: {
      name: 'Slow feeding, with air', water: 200, sugar: 37.5, yeast: 25, feedSugar: 25, feedWater: 125, ethanol: false, shaken: true,
      portions: [[1, 0.625], [7, 0.625], [13, 0.625], [19, 0.625], [25, 0.625], [31, 0.625], [37, 0.625], [43, 0.625]], doneBy: 24,
      ee: [95, 98], yield: [65, 78], source: 'Wipf et al. 1983 (via Org. Synth. Note 10), Fow et al. 2008; yield modelled'
    },
    starved: {
      name: 'Starved yeast', water: 200, sugar: 0, yeast: 25, feedSugar: 0, feedWater: 0, ethanol: true, shaken: true,
      portions: [[1, 1.00]], doneBy: 60, ee: [92, 96], yield: [66, 74], source: 'Seebach et al., Chimia 1986 (Org. Synth. Note 11)'
    }
  };
  var RECIPE_IDS = ['one', 'two', 'slow', 'starved'];

  /** Each student's own fermentation, from the code: the recipe, and where in its ranges their ee and yield fall. */
  function picks(code) {
    var rnd = seeded(codeSeed('1' + normalizeCode(code || 'AAAAA')));
    var id = RECIPE_IDS[Math.floor(rnd() * RECIPE_IDS.length)], r = RECIPES[id];
    var ee = r.ee[0] + (r.ee[1] - r.ee[0]) * rnd(), yld = r.yield[0] + (r.yield[1] - r.yield[0]) * rnd();
    return { recipe: id, ee: Math.round(ee * 10) / 10, yield: Math.round(yld * 10) / 10, scatter: rnd() };
  }

  function substrateGrams(recipeId) { return RECIPES[recipeId].portions.reduce(function (s, p) { return s + p[1]; }, 0); }
  /** The most product the substrate can give, in grams. */
  function theoreticalGrams(recipeId) { return substrateGrams(recipeId) / MW_KETONE * MW_PRODUCT; }

  // ---- The fermentation --------------------------------------------------------------------------

  /**
   * Grams of substrate in the flask, reduced and still unreduced, `hours` after the yeast went in.
   * `additions` is what went in ([hours after the yeast, grams]); without it, the recipe's own plan.
   * Each addition is reduced first-order, 99% done `doneBy` hours after it went in (modelled).
   */
  function flaskContents(recipeId, hours, alive, additions) {
    var r = RECIPES[recipeId], k = -Math.log(0.01) / r.doneBy, added = 0, reduced = 0;
    (additions || r.portions).forEach(function (p) {
      if (hours < p[0]) return;
      added += p[1];
      if (alive) reduced += p[1] * (1 - Math.exp(-k * (hours - p[0])));
    });
    return { added: added, left: added - reduced, reduced: reduced };
  }
  /** How much of the substrate added so far is reduced (0 to 1). */
  function conversion(recipeId, hours, alive, additions) {
    var f = flaskContents(recipeId, hours, alive, additions);
    return f.added > 0 ? f.reduced / f.added : 0;
  }
  /** Whether a TLC of the broth (vanillin stain) still shows the ketone's intense blue spot: more than 3% of it left. */
  function tlcShowsKetone(recipeId, hours, alive, additions) {
    var f = flaskContents(recipeId, hours, alive, additions);
    return f.added > 0 && f.left / f.added > 0.03;
  }
  /** When the recipe's last portion is in and reduced (hours after the yeast went in): its planned length. */
  function plannedHours(recipeId) {
    var r = RECIPES[recipeId], last = r.portions[r.portions.length - 1][0];
    return last + r.doneBy;
  }

  // ---- The routine at the bench ------------------------------------------------------------------
  // The state of the bench, and one step of it. A step never refuses for a slip: it warns, and the
  // slip has its effect (as in the protein and oil labs). It refuses only what cannot be done at all
  // (filtering before there is anything to filter), with a reason code.

  function blankBench() {
    return {
      bath: 0, water: 0, waterC: 0, sugar: 0, yeast: 0, alive: null, yeastAt: null, hours: 0, added: [],
      fed: false, tlc: [], bed: false, celite: false, filtered: false, crawled: false,
      salted: false, extractions: 0, hard: 0, emulsion: false, cleared: 0, brine: false, mgso4: 0, freeFlowing: false,
      gravity: false, evaporated: false, wet: false, weighed: false, warnings: []
    };
  }

  function warn(s, code) { if (s.warnings.indexOf(code) < 0) s.warnings.push(code); }

  /**
   * One step: returns {ok, state, reason, warning}. The state is a new object; a refusal keeps the
   * old one. `what` is a verb and its argument: "bath 30", "water", "sugar 37.5", "yeast 25",
   * "substrate 2.5", "wait 24", "feed", "tlc", "bed", "celite", "filter", "salt", "extract gentle"
   * or "extract hard", "clear brine" (or wait, centrifuge), "brine", "mgso4", "gravity", "evaporate",
   * "redry", "weigh".
   */
  function step(recipeId, bench, what) {
    var s = JSON.parse(JSON.stringify(bench)), parts = String(what).split(' '), verb = parts[0], arg = parts[1] || '';
    var r = RECIPES[recipeId], before = s.warnings.length;
    function no(reason) { return { ok: false, state: bench, reason: reason }; }
    function yes() { return { ok: true, state: s, warning: s.warnings.length > before ? s.warnings[s.warnings.length - 1] : '' }; }
    switch (verb) {
      case 'bath':
        var t = Number(arg);
        if (!(t > 0 && t < 100)) return no('bath-range');
        s.bath = t; return yes();
      case 'water':
        if (!s.bath) return no('bath-first');
        if (s.water) return no('water-in');
        s.water = r.water; s.waterC = s.bath;
        if (s.bath >= YEAST_DIES_C) warn(s, 'too-hot');
        else if (s.bath > YEAST_STRESSED_C) warn(s, 'warm');
        return yes();
      case 'sugar':
        if (!s.water) return no('water-first');
        s.sugar += Number(arg) || 0;
        if (r.sugar === 0) warn(s, 'no-sugar-in-recipe');
        return yes();
      case 'yeast':
        if (!s.water) return no('water-first');
        if (s.yeast) return no('yeast-in');
        s.yeast = Number(arg) || 0; s.yeastAt = s.hours;
        s.alive = s.waterC < YEAST_DIES_C;
        if (!s.alive) warn(s, 'yeast-killed');
        return yes();
      case 'substrate':
        if (!s.yeast) return no('yeast-first');
        if (s.filtered) return no('broth-gone');
        s.added.push([s.hours - s.yeastAt, Number(arg) || 0]);
        return yes();
      case 'wait':
        var h = Number(arg);
        if (!(h > 0)) return no('wait-range');
        s.hours += h; return yes();
      case 'feed':
        if (!s.yeast) return no('yeast-first');
        if (s.fed) return no('fed');
        s.fed = true; return yes();
      case 'tlc':
        if (!s.yeast) return no('yeast-first');
        s.tlc.push({ hours: s.hours - s.yeastAt, ketone: tlcShowsKetone(recipeId, s.hours - s.yeastAt, s.alive, s.added) });
        return yes();
      case 'bed':
        if (s.bed) return no('bed-made');
        s.bed = true; return yes();
      case 'celite':
        if (!s.yeast) return no('yeast-first');
        s.celite = true; return yes();
      case 'filter':
        if (!s.yeast) return no('nothing-to-filter');
        if (s.filtered) return no('filtered');
        s.filtered = true;
        if (!s.bed) { s.crawled = true; warn(s, 'no-bed'); }
        if (s.alive && tlcShowsKetone(recipeId, s.hours - s.yeastAt, true, s.added)) warn(s, 'stopped-early');
        return yes();
      case 'salt':
        if (!s.filtered) return no('filter-first');
        s.salted = true; return yes();
      case 'extract':
        if (!s.filtered) return no('filter-first');
        if (s.emulsion) return no('emulsion');
        s.extractions++;
        if (!s.salted) warn(s, 'not-salted');
        if (arg === 'hard') { s.hard++; s.emulsion = true; warn(s, 'emulsion'); }
        return yes();
      case 'clear':
        if (!s.emulsion) return no('no-emulsion');
        if (['brine', 'wait', 'centrifuge'].indexOf(arg) < 0) return no('which-remedy');
        s.emulsion = false; s.cleared++; return yes();
      case 'brine':
        if (!s.extractions) return no('extract-first');
        s.brine = true; return yes();
      case 'mgso4':
        if (!s.extractions) return no('extract-first');
        s.mgso4++;
        s.freeFlowing = s.mgso4 >= (s.brine ? 2 : 4);
        if (!s.brine) warn(s, 'no-brine');
        return yes();
      case 'gravity':
        if (!s.mgso4) return no('dry-first');
        if (!s.freeFlowing) warn(s, 'still-wet');
        s.gravity = true; return yes();
      case 'evaporate':
        if (!s.gravity) return no('gravity-first');
        s.evaporated = true; s.wet = !s.freeFlowing;
        if (s.wet) warn(s, 'droplets');
        return yes();
      case 'redry':
        if (!s.evaporated) return no('evaporate-first');
        s.mgso4 = Math.max(s.mgso4, s.brine ? 2 : 4); s.freeFlowing = true; s.wet = false; return yes();
      case 'weigh':
        if (!s.evaporated) return no('evaporate-first');
        s.weighed = true; return yes();
    }
    return no('unknown');
  }

  // ---- What the student gets ---------------------------------------------------------------------

  /**
   * The product: its mass (g), how much of it is the alcohol (the rest is unreduced ketone, and water
   * if it was not dried), and the ee of the alcohol. From the student's picks and what they did.
   */
  function product(code, bench) {
    var p = picks(code), r = RECIPES[p.recipe];
    var since = bench.yeastAt === null ? 0 : bench.hours - bench.yeastAt;
    var f = flaskContents(p.recipe, since, bench.alive, bench.added);
    // the recipe's isolated yield already includes the losses of a good work-up (three extractions,
    // salted), and is reached when the fermentation runs its planned length
    var recovery = (p.yield / 100) / conversion(p.recipe, plannedHours(p.recipe), true);
    var extract = [0, 0.62, 0.86, 1.0][Math.min(3, bench.extractions)] || 1.0;      // modelled
    if (!bench.salted) extract *= 0.75;                                                // modelled: less salted out
    if (bench.emulsion) extract *= 0.75;                                               // modelled: lost in an uncleared emulsion
    if (!bench.brine) extract *= 0.96;                                                 // modelled: held on the extra MgSO4
    var alcohol = f.reduced / MW_KETONE * MW_PRODUCT * recovery * extract;
    var ketone = f.left * recovery * extract;
    var water = bench.wet ? 0.08 * (alcohol + ketone) : 0;
    var mass = alcohol + ketone + water;
    return { recipe: p.recipe, mass: mass, alcohol: alcohol, ketone: ketone, water: water, alcoholFraction: mass > 0 ? alcohol / mass : 0, ee: p.ee, theoretical: f.added / MW_KETONE * MW_PRODUCT, substrate: f.added };
  }

  /**
   * What the polarimeter reads (degrees) for `sampleMg` of the product made up to `volumeMl` in
   * chloroform, in a tube `lengthDm` long. The rotation comes only from the (S) alcohol in excess; the
   * ketone and water add none. A bubble in the tube, or no blank, puts the reading out (modelled).
   */
  function polarimeterReading(prod, sampleMg, volumeMl, lengthDm, options) {
    var o = options || {};
    var c = sampleMg / 1000 / volumeMl * 100;                 // g per 100 mL, as specific rotations are quoted
    // [alpha] = alpha / (l c) with c in g per mL, so alpha = [alpha] l c
    var alpha = ALPHA_PURE_S * (prod.ee / 100) * prod.alcoholFraction * lengthDm * (c / 100);
    if (o.bubble) alpha *= 0.7;
    if (o.noBlank) alpha += 0.06;
    return Math.round(alpha * 1000) / 1000;
  }

  // ---- The checks ----------------------------------------------------------------------------------

  function num(text) {
    if (text === null || text === undefined) return NaN;
    var t = String(text).trim().replace(',', '.').replace(/\s+/g, '');
    if (!t) return NaN;
    return Number(t);
  }
  function verdict(ok, offText) { return ok ? { ok: true, kind: 'good', text: 'Accepted.' } : { ok: false, kind: 'off', text: offText }; }
  function empty() { return { ok: false, kind: 'empty', text: '' }; }

  /** The percent yield, from the student's own mass of product and the substrate's mass. */
  function checkYield(productGrams, substrateG, text) {
    var v = num(text); if (isNaN(v)) return empty();
    var want = productGrams / (substrateG / MW_KETONE * MW_PRODUCT) * 100;
    return verdict(Math.abs(v - want) <= Math.max(0.6, 0.02 * want), 'Not quite: moles of product over moles of ethyl acetoacetate, times 100.');
  }
  /** The specific rotation from the student's own reading: [alpha] = alpha / (l c), c in g per mL. */
  function checkSpecificRotation(alpha, lengthDm, gPer100mL, text) {
    var v = num(text); if (isNaN(v)) return empty();
    var want = alpha / (lengthDm * gPer100mL / 100);
    return verdict(Math.abs(v - want) <= Math.max(0.3, 0.015 * Math.abs(want)), 'Not quite: divide the angle by the tube length (dm) and the concentration in g per mL.');
  }
  /** The ee from the student's own [alpha]: ee = [alpha] / +43.5 x 100. */
  function checkEe(specific, text) {
    var v = num(text); if (isNaN(v)) return empty();
    var want = specific / ALPHA_PURE_S * 100;
    return verdict(Math.abs(v - want) <= 1, 'Not quite: your [α] as a share of pure (S)-ethyl 3-hydroxybutanoate’s +43.5°.');
  }

  /** The words for a refusal or a warning (the page shows them). */
  var BENCH_TEXT = {
    'bath-range': 'Set the water bath between 1 and 99 °C.',
    'bath-first': 'Set the water bath first: the water goes in warm.',
    'water-in': 'The water is already in the flask.',
    'water-first': 'Put the warm water in the flask first.',
    'yeast-in': 'The yeast is already in.',
    'yeast-first': 'The yeast has to be in the flask first.',
    'broth-gone': 'The broth has been filtered: start again for a new fermentation.',
    'wait-range': 'Wait a number of hours.',
    'fed': 'The second feed of sugar is already in.',
    'bed-made': 'The Celite bed is already made.',
    'nothing-to-filter': 'There is no broth to filter yet.',
    'filtered': 'The broth is already filtered.',
    'filter-first': 'Filter the broth first: the product is in the filtrate.',
    'emulsion': 'There is an emulsion in the funnel: clear it first (brine, waiting or the centrifuge).',
    'no-emulsion': 'There is no emulsion to clear.',
    'which-remedy': 'Brine, waiting, or the centrifuge.',
    'extract-first': 'Extract the filtrate first.',
    'dry-first': 'Dry the ethyl acetate first (magnesium sulfate).',
    'gravity-first': 'Filter off the drying agent first.',
    'evaporate-first': 'Take off the solvent first.',
    'unknown': 'That is not a step of Part 1.',
    // warnings: the step goes ahead
    'too-hot': 'That water is hot enough to kill yeast: let it cool to about 30 °C before the yeast goes in.',
    'warm': 'That is warmer than yeast likes (35 to 40 °C is best): it will survive, but let the water cool a little.',
    'yeast-killed': 'The yeast went into water too hot for it: it will not foam, and it will not reduce anything.',
    'no-sugar-in-recipe': 'Your recipe uses starved yeast: no sugar, only 5% ethanol.',
    'no-bed': 'Without a Celite bed the yeast clogs the paper: the filtration crawls.',
    'stopped-early': 'The TLC still shows ethyl acetoacetate: stopping now leaves it in your product.',
    'not-salted': 'The filtrate is not saturated with salt: ethyl 3-hydroxybutanoate likes water, and less of it comes out.',
    'emulsion': 'Shaken hard, the yeast debris has made an emulsion: no sharp line between the layers.',
    'no-brine': 'No brine wash first: the ethyl acetate holds a lot of water, and needs much more magnesium sulfate.',
    'still-wet': 'The magnesium sulfate is still clumping: the solution is not dry yet.',
    'droplets': 'Droplets in the residue: the solution was not dry. Redissolve, dry again and evaporate.'
  };

  var api = {
    MW_KETONE: MW_KETONE, MW_PRODUCT: MW_PRODUCT, ALPHA_PURE_S: ALPHA_PURE_S, DENSITY_KETONE: DENSITY_KETONE, YEAST_DIES_C: YEAST_DIES_C, YEAST_STRESSED_C: YEAST_STRESSED_C,
    RECIPES: RECIPES, RECIPE_IDS: RECIPE_IDS, BENCH_TEXT: BENCH_TEXT,
    normalizeCode: normalizeCode, validCode: validCode, newCode: newCode, picks: picks,
    substrateGrams: substrateGrams, theoreticalGrams: theoreticalGrams, conversion: conversion, flaskContents: flaskContents,
    tlcShowsKetone: tlcShowsKetone, plannedHours: plannedHours, blankBench: blankBench, step: step,
    product: product, polarimeterReading: polarimeterReading, num: num,
    checkYield: checkYield, checkSpecificRotation: checkSpecificRotation, checkEe: checkEe
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HandModel = api;
})(this);
