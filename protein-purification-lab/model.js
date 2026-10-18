/*
 * Purifying a Glowing Protein: the page's own logic, with nothing about the unknown in it.
 * Codes, the words for every warning, refusal and mistake the bench can send, the lists of
 * Part 2 (samples, cuvettes, dilutions), and its arithmetic: the standard curve's straight line,
 * the checks of each number a student works out, and the peak of a scan. Loads in a browser
 * (window.ProteinLabModel) and in Node, for the tests (node Tools/protein_model_test.js).
 */
(function (root) {
  'use strict';

  // ---- Codes: four characters and a check character, as in the other labs ----

  var ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   // no 0, 1, I, L or O
  var BASE = 31;

  function normalizeCode(text) { return String(text || '').toUpperCase().replace(/[^0-9A-Z]/g, ''); }

  function checkChar(digits) {
    var sum = 7;
    for (var i = 0; i < digits.length; i++) sum += (i + 2) * digits[i];
    return ALPHABET[sum % BASE];
  }

  function validCode(text) {
    var code = normalizeCode(text);
    if (code.length !== 5) return false;
    var digits = [];
    for (var i = 0; i < 4; i++) {
      var d = ALPHABET.indexOf(code[i]);
      if (d < 0) return false;
      digits.push(d);
    }
    return checkChar(digits) === code[4];
  }

  function randomCode(rand) {
    rand = rand || Math.random;
    var digits = [];
    for (var i = 0; i < 4; i++) digits.push(Math.floor(rand() * BASE));
    return digits.map(function (d) { return ALPHABET[d]; }).join('') + checkChar(digits);
  }

  // ---- The bench's numbers, as the page shows them ----

  /** Bench minutes as m:ss (or h:mm:ss past an hour). */
  function clockText(minutes) {
    var s = Math.max(0, Math.round(minutes * 60));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    return h > 0 ? h + ':' + two(m) + ':' + two(sec) : m + ':' + two(sec);
  }

  function ml(x) {
    if (!(x > 0.0005)) return '0 mL';
    if (x < 0.1) return Math.round(x * 1000) + ' µL';
    return (Math.round(x * 100) / 100).toFixed(2) + ' mL';
  }

  /** The relative centrifugal force of a speed in this centrifuge's rotor (6.2 cm to the middle of the tube). */
  var ROTOR_RADIUS_CM = 6.2;
  function rcf(rpm) { return 1.118e-5 * ROTOR_RADIUS_CM * rpm * rpm; }

  /** The tubes under the column, in the order they stand. */
  var TUBES = [
    { key: 'waste', name: 'Waste beaker' },
    { key: 'ft', name: 'Flow-through' },
    { key: 'w1', name: 'Wash 1' },
    { key: 'w2', name: 'Wash 2' },
    { key: 'e1', name: 'Elution 1' },
    { key: 'e2', name: 'Elution 2' },
    { key: 'e3', name: 'Elution 3' },
    { key: 'e4', name: 'Elution 4' }
  ];

  /** The samples kept for the gel, in the order of the rack. */
  var SAMPLES = [
    { key: 'cells', name: 'Whole cells' },
    { key: 'lysate', name: 'Lysate (after sonication)' },
    { key: 'cleared', name: 'Cleared lysate' },
    { key: 'pellet', name: 'Pellet' },
    { key: 'ft', name: 'Flow-through' },
    { key: 'w1', name: 'Wash 1' },
    { key: 'w2', name: 'Wash 2' },
    { key: 'e1', name: 'Elution 1' },
    { key: 'e2', name: 'Elution 2' },
    { key: 'e3', name: 'Elution 3' },
    { key: 'e4', name: 'Elution 4' }
  ];

  // ---- Part 2: the samples measured, the Bradford cuvettes, the dilutions ----

  /** The samples measured in Part 2, in the bench's order (Measure.Keys in Unity). */
  var MEASURED = [
    { key: 'lysate', name: 'Cleared lysate', short: 'Lysate' },
    { key: 'ft', name: 'Flow-through', short: 'FT' },
    { key: 'w1', name: 'Wash 1', short: 'W1' },
    { key: 'w2', name: 'Wash 2', short: 'W2' },
    { key: 'pool', name: 'Pooled fractions', short: 'Pool' }
  ];

  /** The BSA standards (mg/mL), S1 to S7, as Bio-Rad's Quick Start kit gives them. */
  var STANDARDS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2];
  /** The top of the straight part of the curve (mg/mL): the line is fitted up to here. */
  var LINEAR_TOP = 1;

  /** The Bradford cuvettes, in the order of their rack (Measure.Cuvettes in Unity). */
  var CUVETTES = [{ key: 'b', name: 'Blank' }]
    .concat(STANDARDS.map(function (c, i) { return { key: 's' + (i + 1), name: 'S' + (i + 1) + ' (' + c + ' mg/mL BSA)' }; }))
    .concat(MEASURED.map(function (m) { return { key: m.key, name: m.short }; }));

  /** The dilutions the bench can make (1: the sample as it is). */
  var FACTORS = [1, 2, 5, 10, 20, 50, 100];

  /** The straight line through the points [[x, y], ...], by least squares: { m, b, n }, or null with fewer than 3. */
  function fitLine(points) {
    var n = points.length;
    if (n < 3) return null;
    var sx = 0, sy = 0, sxx = 0, sxy = 0;
    points.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
    var d = n * sxx - sx * sx;
    if (Math.abs(d) < 1e-12) return null;
    var m = (n * sxy - sx * sy) / d;
    return { m: m, b: (sy - m * sx) / n, n: n };
  }

  /** The concentration a reading means on the line (the same units as the line's x). */
  function concFrom(line, a) { return line && line.m > 0 ? (a - line.b) / line.m : NaN; }

  /** A number as typed (a comma taken as a decimal point), or NaN. */
  function num(text) {
    var t = String(text == null ? '' : text).trim().replace(',', '.');
    if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return NaN;
    return Number(t);
  }

  /** Whether a typed number agrees with what it should be: within `rel` of it, or within `abs`. */
  function close(typed, want, rel, abs) {
    if (!isFinite(typed) || !isFinite(want)) return false;
    return Math.abs(typed - want) <= Math.max(Math.abs(want) * (rel || 0), abs || 0);
  }

  /**
   * Checks a concentration worked out from the curve, and the sample's own concentration after
   * the dilution. Returns { verdict: 'ok' | 'no' | '', hint }: a hint names the commonest slips.
   */
  function checkConc(typed, want, factor, which) {
    var t = num(typed);
    if (!isFinite(t)) return { verdict: String(typed || '').trim() ? 'no' : '', hint: String(typed || '').trim() ? 'Type a number.' : '' };
    if (close(t, want, 0.03, 0.004)) return { verdict: 'ok', hint: '' };
    if (which === 'sample' && factor > 1 && close(t, want / factor, 0.03, 0.004)) return { verdict: 'no', hint: 'Multiply by the dilution factor: this is the concentration in the diluted sample.' };
    if (which === 'cuvette' && factor > 1 && close(t, want * factor, 0.03, 0.004)) return { verdict: 'no', hint: 'This column is the diluted sample, as it went into the cuvette: do not multiply by the dilution here.' };
    if (which === 'cuvette' && close(t, want * 0.02, 0.05, 0.0005)) return { verdict: 'no', hint: 'The standard curve already counts the 20 µL in the cuvette: read the concentration straight off the line.' };
    return { verdict: 'no', hint: which === 'cuvette' ? 'Check it against the line: concentration = (A595 − intercept) ÷ slope.' : 'Check it: the concentration from the curve times the dilution factor.' };
  }

  // ---- The gel ----

  /** The ladder's bands (kDa), from the top of the gel down (Bio-Rad's Precision Plus Dual Color; 25 and 75 pink). */
  var LADDER = [250, 150, 100, 75, 50, 37, 25, 20, 15, 10];
  /** The part of the ladder where log(mass) against distance is close to a straight line on a 10% gel: the line is fitted here. */
  var LADDER_FIT = [15, 100];
  /** The smallest amount of protein (ug) a Coomassie-stained band can be seen at, roughly. */
  var VISIBLE_UG = 0.12;

  /** The wavelength where a scan is highest, or null for an empty scan. */
  function peakOf(scan) {
    if (!scan || !scan.values || !scan.values.length) return null;
    var best = -1, at = null;
    scan.values.forEach(function (v, i) { if (v > best) { best = v; at = scan.from + i * scan.step; } });
    return at;
  }

  var GLOWS = [
    { key: '', name: '' },
    { key: 'none', name: 'No glow' },
    { key: 'faint', name: 'Faint glow' },
    { key: 'bright', name: 'Bright glow' }
  ];

  // ---- Warnings before a step: it has not happened yet, and can still be stopped ----
  // {d} is the bench's number that goes with it.

  var WARN_TEXT = {
    'cells-buffer': 'The cells are taken up in lysis buffer. The wash and elution buffers have more imidazole and are for the column.',
    'lysozyme-dose': 'That much lysozyme would give about {d} mg/mL in the tube. The protocol uses about 1 mg/mL: work out the volume of the 10 mg/mL stock for the buffer in your tube.',
    'no-lysozyme': 'No lysozyme has gone in yet. Without it the cell walls are tough and sonication breaks far fewer cells.',
    'lysozyme-wait': 'The lysozyme needs 30 minutes on ice to weaken the cell walls before you sonicate.',
    'too-soon': 'The last burst has only just ended. Each 10 s burst warms the sample; wait 10 s on ice between bursts, or the protein starts to unfold.',
    'not-lysed': 'Only about {d}% of the cells are broken open so far. The protein still inside unbroken cells will be lost in the pellet. The protocol uses six bursts.',
    'spin-weak': 'At this speed the centrifuge gives about {d} x g. Clearing a lysate needs about 10,000 x g for 20 to 30 minutes; below that, debris stays in the liquid and clogs the column.',
    'not-spun': 'This tube has not been spun yet: pouring it off now takes the cell debris with it.',
    'settled': 'The resin has settled at the bottom of its bottle. Swirl it first, or the pipet takes up mostly liquid and very little resin.',
    'not-cleared': 'This lysate has not been cleared in the centrifuge. Cell debris will clog the resin and the column will run very slowly.',
    'ft-to-waste': 'The waste beaker is under the column. What runs through while the lysate loads (the flow-through) is a sample you need for the gel: put its tube under the column first.',
    'ft-where': 'The flow-through should go into its own tube (the first 15 mL tube), so the gel can show what did not bind.',
    'not-equilibrated': 'The resin has not been rinsed with lysis buffer yet. Run about 5 column volumes (2.5 mL) of lysis buffer through it first, so it is in the same buffer as the lysate.',
    'not-washed': 'The column has had less than 6 mL of wash buffer since the lysate went on. Elute now and the bacterial proteins that stuck weakly come off with your protein.',
    'elute-where': 'The elution buffer releases your protein. An elution tube should be under the column, not a wash tube, the flow-through tube or the waste.',
    'wash-into-elution': 'An elution tube is under the column. The wash should go into a wash tube.',
    'wash-into-ft': 'The flow-through tube is under the column. Each wash should go into its own wash tube, so the gel can show what each one removed.',
    'nothing-loaded': 'No lysate has gone onto the column yet, so there is nothing to elute.',
    'wash-to-waste': 'The waste beaker is under the column. Collect the washes in the wash tubes: the gel needs them.',
    // Part 2
    'wrong-source': 'That cuvette is labelled {d}, and this is not what it is for. Each cuvette holds the sample its label names, or the readings get mixed up.',
    'sample-volume': 'The micropipette is set to {d} µL. Both assays use 20 µL of each sample: set it to 20 first.',
    'imidazole-high': 'This sample holds about {d} mM imidazole. The Bradford dye tolerates no more than 200 mM: above that the imidazole itself turns the dye blue and the reading comes out too high. Dilute it first.',
    'spec-not-zeroed': 'The spectrophotometer has not been zeroed yet. Put the blank in (dye and buffer, no protein) and press Zero first, so that every reading is of the protein alone.',
    'no-dye': 'This cuvette has no dye in it: there is nothing to read at 595 nm.',
    'bradford-wait': 'This cuvette was mixed less than 5 minutes ago (about {d} min to go). The blue colour is still developing, so the reading would come out low.',
    'bradford-late': 'This cuvette was mixed more than an hour ago. The dye and the protein start to come out of solution and the reading drifts: empty it and make it again.',
    'zero-not-blank': 'The cuvette in the spectrophotometer is not the blank. Zeroing on it would make every reading relative to this cuvette instead of to dye with no protein.',
    'quartz-low': 'The quartz cuvette holds very little. The beam crosses it about 1 cm up, so most of the light would miss the liquid: add the 1 mL of buffer.',
    // the gel
    'wrong-tris': 'Not that Tris. The resolving gel uses the pH 8.8 buffer and the stacking gel the pH 6.8 one: the difference in pH is what squeezes the samples into a thin band before they separate.',
    'not-in-recipe': 'That is not in this gel\u2019s recipe.',
    'catalyst-early': 'APS and TEMED go in last: together they start the gel setting. Add the water and the acrylamide first.',
    'no-catalyst': 'This mixture has no APS or no TEMED. Without both, the acrylamide never sets: it would stay a liquid between the plates.',
    'no-overlay': 'The resolving gel was not covered with water. Air reaches its top and keeps it from setting evenly, so its top edge is soft and uneven and the bands come out wavy.',
    'load-volume': 'The micropipette is set to {d} µL. Load 10 µL into each well: more spills into the next well, less gives faint bands.',
    'no-laemmli': 'This sample has no Laemmli buffer. Without its glycerol the sample does not sink into the well: it floats out into the running buffer.',
    'not-heated': 'The samples have not had their 5 minutes at 95 °C. A protein that is not unfolded does not run by its size alone.',
    'nothing-in-wells': 'Nothing has been loaded yet.',
    'leads-reversed': 'The leads are the wrong way round: red should go to red. With them like this the negatively charged proteins run up, out of the top of the gel, and are lost.',
    'volts-high': 'Above about 250 V the gel warms up: the bands smile and smear. The protocol runs at 200 V.',
    'not-run': 'The dye front has not gone far yet: the proteins have barely separated.',
    'short-stain': 'The gel has had less than half an hour in the Coomassie: faint bands will not show.'
  };

  // ---- Refusals: the bench cannot do this (a real one would not either) ----

  var BLOCK_TEXT = {
    'unknown-step': 'That step is not one the bench knows.',
    'tube-full': 'That tube is full.',
    'no-resin': 'There is no resin in the column yet.',
    'column-full': 'The column’s reservoir would overflow. Let some run through first.',
    'too-little-buffer': 'Add the lysis buffer first: the pellet needs about 4 mL to be taken up.',
    'already': 'That is done already.',
    'not-resuspended': 'Take the pellet up in the buffer first (resuspend it).',
    'spin-tube-used': 'The spin tube has already been used.',
    'in-rotor': 'Take the balance tube out of the centrifuge first.',
    'lid-closed': 'Open the centrifuge’s lid first.',
    'lid-open': 'The centrifuge will not start with its lid open.',
    'spinning': 'The centrifuge is still spinning.',
    'spin-empty': 'The spin tube is empty.',
    'balance-empty': 'The balance tube is empty: fill it with water to the same volume as your lysate.',
    'bucket-taken': 'That bucket already holds the other tube.',
    'spin-not-in': 'Your lysate tube is not in the centrifuge.',
    'unbalanced-missing': 'The centrifuge will not start: it is unbalanced. A tube needs a balance tube of the same weight in the bucket opposite.',
    'unbalanced-place': 'The centrifuge will not start: it is unbalanced. The balance tube must be in the bucket directly opposite your tube.',
    'unbalanced-volume': 'The centrifuge will not start: it is unbalanced. The balance tube must hold the same volume as your lysate tube (within 0.3 mL).',
    'not-set': 'Set the speed and the time first.',
    'still-in-rotor': 'Take the tube out of the centrifuge first.',
    'resin-in': 'The column already has its resin.',
    'outlet-open-empty': 'Close the column’s outlet first, or the slurry runs straight through as it goes in.',
    'nothing-to-load': 'There is no lysate to load.',
    'already-lysed': 'The whole-cell sample is taken before sonication: it is too late for that one now.',
    'not-lysed-yet': 'Sonicate first: this sample is of the broken cells.',
    'no-pellet': 'There is no pellet until the cleared lysate has been poured off.',
    'source-empty': 'There is nothing in that tube to sample yet.',
    // Part 2
    'part1-first': 'Finish Part 1 first: Part 2 measures the cleared lysate and the fractions from your column.',
    'pool-none': 'Choose the fractions to pool first: tick them in the Pool column of Table 1, in Part 1.',
    'not-pooled': 'Pool the fractions first.',
    'has-dye': 'That cuvette already has its dye.',
    'has-sample': 'That cuvette already has its sample. Empty it to make it again.',
    'has-buffer': 'The quartz cuvette already has its buffer.',
    'cuvette-empty': 'That cuvette is empty.',
    'spec-empty': 'Put a cuvette in the spectrophotometer first.',
    'quartz-empty': 'Fill the quartz cuvette first.',
    'quartz-not-in': 'Put the quartz cuvette in the fluorimeter first.',
    'bad-wavelength': 'The fluorimeter works from 300 to 750 nm, and a scan needs room: an emission scan starts 10 nm above the excitation, an excitation scan stops 10 nm below the emission.',
    // the gel
    'not-in-tank': 'The gel is not in the tank yet.',
    'power-on': 'Turn the power off first.',
    'bad-volts': 'The power supply gives 0 to 300 V.',
    'gel-not-out': 'Take the gel out of the tank into the tray first.',
    'not-in-imager': 'Put the gel in the imager first.',
    'light-off': 'Switch a light on in the imager first.',
    'not-poured': 'Pour the resolving gel first.',
    'comb-late': 'The stacking gel has already set: the comb no longer goes in. Start a fresh gel.',
    'no-comb': 'There is no comb in the gel.',
    'not-set': 'It has not set yet: wait (the step shows how long).',
    'already-poured': 'That mixture has been poured already.',
    'already-added': 'That has gone in already: each reagent goes in once.',
    'mix-not-made': 'Add the water and the acrylamide first.',
    'comb-in': 'Take the comb out first.',
    'gel-not-ready': 'Cast the gel first: both layers set and the comb out.',
    'no-samples': 'There are no samples kept from Part 1.',
    'no-laemmli': 'Add the Laemmli buffer first.',
    'not-heating': 'The samples are not in the heat block.',
    'no-buffer': 'Fill the tank with running buffer first.',
    'lid-on': 'Take the lid off to load.',
    'well-used': 'That well already has something in it.',
    'not-kept': 'That sample was not kept in Part 1.',
    'lid-off': 'The power supply will not start with the lid off: the buffer carries a dangerous current.',
    'no-leads': 'Plug the leads in first.',
    'no-volts': 'Set the volts first.',
    'in-imager': 'The gel is in the imager.',
    'not-stained': 'Stain the gel first.'
  };

  // ---- Mistakes that have happened: what they do, and whether that part can be done again ----
  // redo: 'cells' (start again from a fresh pellet), 'spin' (spin again), 'column' (a fresh column), or none.

  var MISTAKES = {
    'overheated': { text: 'The sample got warm during sonication (bursts with too little rest on ice). Part of your protein has unfolded and lost its glow: it still has its tag and will purify, but it no longer fluoresces.', redo: 'cells' },
    'poor-lysis': { text: 'Fewer than four cells in five were broken open. The protein in the unbroken cells goes into the pellet, so your yield will be lower.', redo: 'cells' },
    'weak-spin': { text: 'The spin was too gentle to clear the lysate. Debris stays in the liquid and will slow or clog the column.', redo: 'spin' },
    'not-cleared': { text: 'Lysate that was not cleared went onto the column. The debris clogs the resin and the column runs very slowly.', redo: 'column' },
    'little-resin': { text: 'The resin had settled, so little of it went into the column. A small bed holds less protein: some will run straight through.', redo: 'column' },
    'ran-dry': { text: 'The column ran dry. Air in the bed opens channels the liquid runs down without touching the beads, so some protein runs through without binding: expect more glow in the flow-through.', redo: 'column' },
    'ft-lost': { text: 'The flow-through went into the waste beaker, so there is no flow-through sample for the gel. The purification itself is not harmed.', redo: '' },
    'eluate-lost': { text: 'Your protein came off the column into a tube that is not an elution tube (or into the waste).', redo: 'column' },
    // Part 2
    'sample-volume': { text: 'A cuvette got a sample volume other than 20 µL, so its reading cannot be compared with the standards. Empty it and make it again.', redo: '' },
    'bradford-imidazole': { text: 'A sample with more than 200 mM imidazole went into the Bradford dye. The imidazole turns the dye blue by itself, so that reading is too high. Dilute the sample, empty the cuvette and make it again.', redo: '' },
    'bradford-early': { text: 'A cuvette was read before its 5 minutes were up, while the colour was still developing, so its reading was low. Read it again now that it has stood.', redo: '' },
    // the gel
    'set-in-tube': { text: 'The gel mixture set in its tube before it was poured: APS and TEMED had been in it too long. It cannot be used.', redo: 'gel' },
    'never-sets': { text: 'A gel layer was poured without APS or TEMED, so it will never set.', redo: 'gel' },
    'no-overlay': { text: 'The resolving gel was not covered with water, so its top edge set soft and uneven: the bands will come out wavy.', redo: 'gel' },
    'wrong-tris': { text: 'A layer was made with the wrong Tris buffer. The difference in pH between the two layers is what stacks the samples into a thin band; without it the bands come out broad.', redo: 'gel' },
    'no-laemmli': { text: 'A sample went into its well without Laemmli buffer: it floated out, and its lane will be empty.', redo: 'gel' },
    'unheated': { text: 'A sample was loaded without its 5 minutes at 95 °C. Some of the protein stays folded: it may still glow, and it runs faster than its size says.', redo: 'gel' },
    'reversed': { text: 'The gel ran with the leads the wrong way round. The proteins ran up, out of the top of the gel, into the buffer: the lanes are empty.', redo: 'gel' },
    'over-run': { text: 'The gel ran too long: the dye front and the smallest proteins ran off the bottom.', redo: 'gel' }
  };

  var NOTICES = {
    'running-dry': 'The liquid in the column is nearly down to the resin. Add the next buffer now, or close the outlet, so the bed does not run dry.',
    'spin-done': 'The centrifuge has stopped. Open the lid and take the tubes out.',
    'front-near-bottom': 'The blue dye front is nearly at the bottom of the gel: turn the power off now.'
  };

  var REDO_TEXT = {
    cells: 'Start again with a fresh cell pellet',
    spin: 'Spin the lysate again',
    column: 'Start a fresh column (with the spare lysate)',
    gel: 'Cast a fresh gel (your samples keep their buffer)'
  };

  function warnText(code, detail) { return (WARN_TEXT[code] || 'Check this step before going on.').replace('{d}', detail || ''); }
  function blockText(reason) { return BLOCK_TEXT[reason] || 'The bench cannot do that now.'; }
  function mistake(code) { return MISTAKES[code] || { text: 'Something went wrong in that step.', redo: '' }; }

  // ---- The questions at the end of each part (answered in words; not checked) ----

  var QUESTIONS = [
    { key: 'q1', text: 'Why does the lysis buffer already contain 10 mM imidazole, and the wash buffer 20 mM?' },
    { key: 'q2', text: 'What did the lysozyme do, and why does the sample have to rest on ice between bursts of the sonicator?' },
    { key: 'q3', text: 'Why must the centrifuge be balanced, and why is the lysate spun before it goes onto the column?' },
    { key: 'q4', text: 'Which tubes glowed, and what does that tell you about where your protein went at each step?' },
    { key: 'q5', text: 'Did anything go wrong at your bench? Say what happened and what it did to your result (write "nothing" if all went well).' }
  ];

  var QUESTIONS_2 = [
    { key: 'q6', text: 'Why does each sample go into the assay at a dilution that puts its reading on the straight part of the standard curve, and why do you then multiply by the dilution factor?' },
    { key: 'q7', text: 'Why can the pooled fractions not go into the Bradford dye as they are? What would the reading do if they did?' },
    { key: 'q8', text: 'What were your protein\'s excitation and emission peaks? Why is the emission peak at a longer wavelength than the excitation peak?' },
    { key: 'q9', text: 'Compare the fluorescence per mL of the cleared lysate, the flow-through and the pooled fractions. What do they tell you about where your protein went?' },
    { key: 'q11', text: 'Why does the stacking gel have a different pH and less acrylamide than the resolving gel?' },
    { key: 'q12', text: 'What mass did you find for your protein on the gel? A fluorescent protein alone is about 27 kDa: what does your mass suggest about the tag it carries?' },
    { key: 'q13', text: 'Which lanes show bands other than your protein, and why are there faint other bands even in your purified fractions?' },
    { key: 'q14', text: 'What were your yield and your fold purification? Where along the way was most of your protein lost, and why is the purification never 100% pure?' },
    { key: 'q10', text: 'Did anything go wrong in Part 2? Say what happened and what it did to your result (write "nothing" if all went well).' }
  ];

  var api = {
    normalizeCode: normalizeCode, validCode: validCode, randomCode: randomCode,
    clockText: clockText, ml: ml, rcf: rcf, ROTOR_RADIUS_CM: ROTOR_RADIUS_CM,
    TUBES: TUBES, SAMPLES: SAMPLES, GLOWS: GLOWS,
    MEASURED: MEASURED, STANDARDS: STANDARDS, LINEAR_TOP: LINEAR_TOP, CUVETTES: CUVETTES, FACTORS: FACTORS,
    fitLine: fitLine, concFrom: concFrom, num: num, close: close, checkConc: checkConc, peakOf: peakOf,
    LADDER: LADDER, LADDER_FIT: LADDER_FIT, VISIBLE_UG: VISIBLE_UG,
    WARN_TEXT: WARN_TEXT, BLOCK_TEXT: BLOCK_TEXT, MISTAKES: MISTAKES, NOTICES: NOTICES, REDO_TEXT: REDO_TEXT,
    warnText: warnText, blockText: blockText, mistake: mistake,
    QUESTIONS: QUESTIONS, QUESTIONS_2: QUESTIONS_2
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProteinLabModel = api;
})(this);
