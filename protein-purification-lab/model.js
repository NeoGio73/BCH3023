/*
 * Purifying a Glowing Protein: the page's own logic, with nothing about the unknown in it.
 * Codes, the words for every warning, refusal and mistake the bench can send, and the steps of
 * Part 1. Loads in a browser (window.ProteinLabModel) and in Node, for the tests
 * (node Tools/protein_model_test.js).
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
    'wash-to-waste': 'The waste beaker is under the column. Collect the washes in the wash tubes: the gel needs them.'
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
    'source-empty': 'There is nothing in that tube to sample yet.'
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
    'eluate-lost': { text: 'Your protein came off the column into a tube that is not an elution tube (or into the waste).', redo: 'column' }
  };

  var NOTICES = {
    'running-dry': 'The liquid in the column is nearly down to the resin. Add the next buffer now, or close the outlet, so the bed does not run dry.',
    'spin-done': 'The centrifuge has stopped. Open the lid and take the tubes out.'
  };

  var REDO_TEXT = {
    cells: 'Start again with a fresh cell pellet',
    spin: 'Spin the lysate again',
    column: 'Start a fresh column (with the spare lysate)'
  };

  function warnText(code, detail) { return (WARN_TEXT[code] || 'Check this step before going on.').replace('{d}', detail || ''); }
  function blockText(reason) { return BLOCK_TEXT[reason] || 'The bench cannot do that now.'; }
  function mistake(code) { return MISTAKES[code] || { text: 'Something went wrong in that step.', redo: '' }; }

  // ---- The questions at the end of Part 1 (answered in words; not checked) ----

  var QUESTIONS = [
    { key: 'q1', text: 'Why does the lysis buffer already contain 10 mM imidazole, and the wash buffer 20 mM?' },
    { key: 'q2', text: 'What did the lysozyme do, and why does the sample have to rest on ice between bursts of the sonicator?' },
    { key: 'q3', text: 'Why must the centrifuge be balanced, and why is the lysate spun before it goes onto the column?' },
    { key: 'q4', text: 'Which tubes glowed, and what does that tell you about where your protein went at each step?' },
    { key: 'q5', text: 'Did anything go wrong at your bench? Say what happened and what it did to your result (write "nothing" if all went well).' }
  ];

  var api = {
    normalizeCode: normalizeCode, validCode: validCode, randomCode: randomCode,
    clockText: clockText, ml: ml, rcf: rcf, ROTOR_RADIUS_CM: ROTOR_RADIUS_CM,
    TUBES: TUBES, SAMPLES: SAMPLES, GLOWS: GLOWS,
    WARN_TEXT: WARN_TEXT, BLOCK_TEXT: BLOCK_TEXT, MISTAKES: MISTAKES, NOTICES: NOTICES, REDO_TEXT: REDO_TEXT,
    warnText: warnText, blockText: blockText, mistake: mistake,
    QUESTIONS: QUESTIONS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ProteinLabModel = api;
})(this);
