/*
 * Biofuel Enzyme Lab, Activities 1 to 5: page logic.
 * Keeps the student's entries, draws the graphs from them, checks what can be checked from the
 * student's own entries, and talks to the 3D lab (a Unity build in the canvas: a fume hood with
 * the bench inside it). The 3D lab owns the bench: what is in each tube, the timer and the
 * spectrophotometer. It is set out for one activity at a time; the page keeps each activity's
 * bench and hands it back when the student returns to that activity. The page sends each color
 * match and absorbance to the 3D lab and shows the verdict that comes back.
 *
 * The lab is done over two sessions. This one file serves both: Activities 1 to 3 as it is, and
 * Activities 4 and 5 when it is opened with ?part=2. Both share the saved work, so the standard
 * curve from the first session is there in the second.
 */
(function () {
  'use strict';

  var M = window.EnzymeLabModel;
  var ACTS = M.ACTIVITIES, NUMBERS = M.ACTIVITY_NUMBERS, STANDARDS = M.STANDARDS, QUESTIONS = M.QUESTIONS;
  var STORE_KEY = 'enzyme-lab-1:v2';
  var params = new URLSearchParams(window.location.search);
  var PART = params.get('part') === '2' ? 2 : 1;
  var PAGE = M.PARTS[PART];          // the activities on this page
  // Automated tests of the page run it without the 3D lab, against a stand-in they supply.
  var standIn = typeof window.EnzymeLabStandIn === 'function' ? window.EnzymeLabStandIn : null;

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  function svg(tag, attrs, text) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  function each(selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn); }
  function fid(n, kind, id) { return 'a' + n + '-' + kind + '-' + id; }
  function rateKeys(n) { return ACTS[n].rates.map(function (r) { return r.key; }); }

  // ---- Saved work ----------------------------------------------------------------------------

  function blankEntries(n) {
    var e = { match: {}, amount: {}, abs: {}, curve: {}, rate: {} };
    ACTS[n].cuvettes.forEach(function (c) { e.match[c.id] = ''; e.amount[c.id] = ''; e.abs[c.id] = ''; e.curve[c.id] = ''; });
    rateKeys(n).forEach(function (k) { e.rate[k] = ''; });
    return e;
  }

  function blankActivity(n) {
    return {
      bench: null,             // the 3D lab's last account of this activity's bench, handed back to it later
      lab: 0,                  // where the bench clock had got to
      entries: blankEntries(n),
      verdicts: {},            // the 3D lab's last word on each entry it checks
      answers: {}              // what the student has written for each question, by question id
    };
  }

  function blankState(seed) {
    var s = {
      v: 2,
      seed: seed || Math.floor(Math.random() * 1e9) + 1,   // this student's own scatter
      name: '',
      activity: 1,
      last: { 1: 1, 2: 4 },    // the activity last open on each of the two pages
      volume: 500,             // what the pipets draw up, microliters
      std: {},                 // Table 3: absorbance of standards S2 to S5 as typed
      stdVerdicts: {},
      acts: {},
      flags: { match: 0, amount: 0, abs: 0, curve: 0, rate: 0 }
    };
    STANDARDS.slice(1).forEach(function (st) { s.std[st.id] = ''; });
    NUMBERS.forEach(function (n) { s.acts[n] = blankActivity(n); });
    return s;
  }

  function loadState() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (!saved || saved.v !== 2 || !saved.seed) return null;
      var fresh = blankState(saved.seed);
      fresh.name = typeof saved.name === 'string' ? saved.name : '';
      fresh.activity = NUMBERS.indexOf(saved.activity) >= 0 ? saved.activity : 1;
      [1, 2].forEach(function (part) {
        if (saved.last && M.PARTS[part].indexOf(saved.last[part]) >= 0) fresh.last[part] = saved.last[part];
      });
      fresh.volume = [250, 500, 1000].indexOf(saved.volume) >= 0 ? saved.volume : 500;
      fresh.flags = Object.assign(fresh.flags, saved.flags || {});
      Object.keys(fresh.std).forEach(function (id) { if (saved.std && typeof saved.std[id] === 'string') fresh.std[id] = saved.std[id]; });
      if (saved.stdVerdicts && typeof saved.stdVerdicts === 'object') fresh.stdVerdicts = saved.stdVerdicts;
      NUMBERS.forEach(function (n) {
        var from = saved.acts && saved.acts[n];
        if (!from) return;
        var to = fresh.acts[n], e = from.entries || {};
        ['match', 'amount', 'abs', 'curve', 'rate'].forEach(function (k) {
          Object.keys(to.entries[k]).forEach(function (id) { if (e[k] && typeof e[k][id] === 'string') to.entries[k][id] = e[k][id]; });
        });
        to.bench = from.bench && Array.isArray(from.bench.vessels) ? from.bench : null;
        to.lab = typeof from.lab === 'number' ? from.lab : 0;
        if (from.verdicts && typeof from.verdicts === 'object') to.verdicts = from.verdicts;
        if (from.answers && typeof from.answers === 'object') {
          Object.keys(from.answers).forEach(function (id) { if (typeof from.answers[id] === 'string') to.answers[id] = from.answers[id]; });
        }
      });
      return fresh;
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private window: work simply is not kept */ }
  }

  var state = loadState() || blankState();
  state.activity = state.last[PART];
  var lastFlagged = {};      // field -> last value that was flagged, so retyping is not counted twice
  var results = {};          // field -> { ok, message } as last shown
  var temps = {};            // the temperature of each tube standing in a bath, from the 3D lab's last tick

  function paint(input, msg, result) {
    var stateName = result.ok === true ? 'ok' : (result.ok === false ? 'bad' : '');
    if (stateName) input.setAttribute('data-state', stateName); else input.removeAttribute('data-state');
    if (result.ok === false) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    if (msg) {
      msg.textContent = result.message || '';
      if (result.ok !== false) msg.setAttribute('data-kind', 'tip'); else msg.removeAttribute('data-kind');
    }
  }

  function countFlag(group, field, value, result) {
    if (result.ok !== false) return;
    if (lastFlagged[field] === value) return;
    lastFlagged[field] = value;
    state.flags[group] += 1;
  }

  // ---- What a bench looks like, from the 3D lab's last account of it -----------------------------

  function vessel(n, id) {
    var list = state.acts[n].bench && state.acts[n].bench.vessels;
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function hasSample(n, id) { var v = vessel(n, id); return !!(v && v.hasSample); }

  // The minutes a cuvette's sample had really been reacting; the time it was due if that is not known.
  function sampledMinutes(n, c) {
    var v = vessel(n, c.id);
    if (c.enzyme && v && v.hasSample && v.sampleSeconds >= 0) return Math.round(v.sampleSeconds / 60 * 100) / 100;
    return c.minutes;
  }

  function cuvette(n, id) {
    var list = ACTS[n].cuvettes;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function vesselName(n, id) {
    if (M.isStandard(id)) return 'standard ' + id;
    var c = cuvette(n, id);
    if (c) return 'cuvette ' + c.label;
    return ACTS[n].vessels[id] ? ACTS[n].vessels[id].name : 'that tube';
  }

  function liquidName(n, id) { return ACTS[n].vessels[id] ? ACTS[n].vessels[id].liquid : 'liquid'; }
  function pipetName(n, id) { return ACTS[n].pipets[id] ? ACTS[n].pipets[id].name : 'the pipet'; }
  function pipetJob(n, id) { return ACTS[n].pipets[id] ? ACTS[n].pipets[id].job : ''; }

  function listNames(names) {
    if (names.length <= 1) return names.join('');
    return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
  }

  // ---- The next thing to do at the bench, worked out from what is in the tubes and cuvettes -------

  function needStop(n) {
    var waiting = ACTS[n].cuvettes.filter(function (c) { var v = vessel(n, c.id); return !v || (v.stop < 400 && !v.hasSample); });
    if (!waiting.length) return '';
    return 'Next: with the Stop pipet, put 500 µL of stop solution in ' +
      (waiting.length === ACTS[n].cuvettes.length ? 'each of the ' + ({ 3: 'three', 6: 'six', 7: 'seven' })[waiting.length] + ' cuvettes.' :
        waiting.map(function (c) { return 'cuvette ' + c.label; }).join(', ') + '.');
  }

  // When the next sample is due, as the timer will show it, and which cuvette it is for.
  function nextSample(n) {
    var bench = state.acts[n].bench, best = null;
    ACTS[n].cuvettes.forEach(function (c) {
      if (!c.enzyme || hasSample(n, c.id)) return;
      var source = vessel(n, c.source);
      if (!source || source.startedAt < 0) return;
      var due = source.startedAt - bench.firstStart + c.minutes * 60;
      if (!best || due < best.due) best = { c: c, due: due };
    });
    return best;
  }

  function finished(n) {
    return 'All the samples are taken. Drag each cuvette to the standards to compare it by eye, then measure in the spectrophotometer, starting with standard S1.';
  }

  function nextStep(n) {
    var bench = state.acts[n].bench;
    if (!bench) return '';
    var stop = needStop(n);
    if (stop) return stop;
    var started = bench.firstStart >= 0;
    var due;

    if (n === 1) {
      var reaction = vessel(1, 'reaction') || {}, control = vessel(1, 'control') || {};
      if (!started && reaction.substrate < 2700) {
        return reaction.substrate > 1200
          ? 'Next: with the Sub pipet, put 1 mL more of 1.5 mM substrate in the Enzyme Reaction tube, to make 2 mL.'
          : 'Next: with the Sub pipet, put 2 mL of 1.5 mM substrate in the Enzyme Reaction tube (1 mL, twice).';
      }
      if (!hasSample(1, 'Start')) {
        if (control.substrate < 1350) return 'Next: with the Sub pipet, put 1 mL of 1.5 mM substrate in the Control tube.';
        if (control.ul < control.substrate / 1.5 + 400) return 'Next: with pipet C, add 500 µL of buffer to the Control tube.';
        return 'Next: with pipet C, move 500 µL from the Control tube to the cuvette Start.';
      }
      if (!started) return 'Next: with pipet E, add 1 mL of enzyme to the Enzyme Reaction tube. The timer starts as the enzyme goes in.';
      due = nextSample(1);
      if (due) return 'Next sample: ' + due.c.label + ' at ' + M.clock(due.due) + '. With pipet E, move 500 µL from the Enzyme Reaction tube to cuvette ' + due.c.label + '.';
      if (!hasSample(1, 'End')) return 'Next: with pipet C, move 500 µL from the Control tube to the cuvette End.';
      return finished(1);
    }

    if (n === 2) {
      var zones = ['0', '22', '37'];
      var unmixed = zones.filter(function (z) { return (vessel(2, 'S' + z) || {}).startedAt < 0; });
      var noEnzyme = unmixed.filter(function (z) { return (vessel(2, 'E' + z) || {}).enzyme < 150; });
      if (noEnzyme.length) return 'Next: set the pipet to 250 µL and, with pipet E, put 250 µL of enzyme in ' + (noEnzyme.length === 3 ? 'each of the three Enzyme tubes.' : 'the Enzyme tube ' + where(noEnzyme) + '.');
      var noSubstrate = unmixed.filter(function (z) { return (vessel(2, 'S' + z) || {}).substrate < 600; });
      if (noSubstrate.length) return 'Next: set the pipet to 500 µL and, with the Sub pipet, put 500 µL of substrate in ' + (noSubstrate.length === 3 ? 'each of the three Substrate tubes.' : 'the Substrate tube ' + where(noSubstrate) + '.');
      if (unmixed.length === 3) {
        var cold = Math.max(temp('E0', 0), temp('S0', 0)), warm = Math.min(temp('E37', 37), temp('S37', 37));
        if (cold > 1.5 || warm < 35.5) {
          return 'Now wait for the tubes to reach the temperature of their baths: the ice-bath tubes are at ' + Math.round(cold) +
            ' °C and the warm-bath tubes at ' + Math.round(warm) + ' °C. Fast forward makes the wait shorter.';
        }
      }
      if (unmixed.length) {
        return 'Next: with pipet E, move the enzyme from the Enzyme tube ' + where([unmixed[0]]) + ' into the Substrate tube beside it' +
          (started ? '.' : '. The timer starts with the first.');
      }
      due = nextSample(2);
      if (due) return 'Next sample: ' + due.c.label + ' at ' + M.clock(due.due) + ' on the timer. With ' + pipetName(2, 'p' + due.c.id.slice(1)) + ', move 500 µL from ' + vesselName(2, due.c.source) + ' to its cuvette.';
      return finished(2);
    }

    if (n === 4) {
      var high = vessel(4, 'high') || {}, low = vessel(4, 'low') || {};
      if (low.startedAt < 0) {
        if (low.ul - low.enzyme / 4 < 900) return 'Next: set the pipet to 1 mL and, with the Mix pipet, put 1 mL of buffer in the Low Enzyme tube.';
        if (low.enzyme < 3000) return 'Next: with the Mix pipet, move 1 mL of enzyme from the High Enzyme tube to the Low Enzyme tube.';
      }
      if (high.startedAt < 0) return 'Next: set the pipet to 250 µL and, with pipet H, add 250 µL of 1.5 mM substrate to the High Enzyme tube. The timer starts as it goes in.';
      if (low.startedAt < 0) return 'Next: straight away, with pipet L, add 250 µL of 1.5 mM substrate to the Low Enzyme tube.';
      due = nextSample(4);
      if (due) return sampleStep(4, due);
      return finished(4);
    }

    if (n === 5) {
      var hs = vessel(5, 'hs') || {}, ls = vessel(5, 'ls') || {};
      if (hs.startedAt < 0 && hs.substrate < 2000) {
        return hs.substrate > 1200
          ? 'Next: set the pipet to 500 µL and, with the Sub pipet, put 500 µL more substrate in the High Substrate tube, to make 1.5 mL.'
          : 'Next: with the Sub pipet, put 1.5 mL of 1.5 mM substrate in the High Substrate tube (1 mL, then 500 µL).';
      }
      if (ls.startedAt < 0) {
        var buffer = ls.ul - ls.substrate / 1.5;
        if (buffer < 1100) {
          return buffer > 800
            ? 'Next: set the pipet to 250 µL and, with the Buf pipet, put 250 µL more buffer in the Low Substrate tube, to make 1.25 mL.'
            : 'Next: with the Buf pipet, put 1.25 mL of buffer in the Low Substrate tube (1 mL, then 250 µL).';
        }
        if (ls.substrate < 300) return 'Next: set the pipet to 250 µL and, with the Sub pipet, add 250 µL of 1.5 mM substrate to the Low Substrate tube.';
      }
      if (hs.enzyme < 650 && !hasSample(5, 'H1')) {
        return hs.enzyme > 350
          ? 'Next: set the pipet to 250 µL and, with pipet E, add 250 µL more enzyme to the High Substrate tube, to make 750 µL.'
          : 'Next: with pipet E, add 750 µL of enzyme to the High Substrate tube (500 µL, then 250 µL).' + (started ? '' : ' The timer starts as the enzyme goes in.');
      }
      if (ls.enzyme < 650 && !hasSample(5, 'L1')) {
        return ls.enzyme > 350
          ? 'Next: set the pipet to 250 µL and, with pipet E, add 250 µL more enzyme to the Low Substrate tube, to make 750 µL.'
          : 'Next: straight away, with pipet E, add 750 µL of enzyme to the Low Substrate tube (500 µL, then 250 µL).';
      }
      due = nextSample(5);
      if (due) return sampleStep(5, due);
      return finished(5);
    }

    var tubes = ['P50', 'P63', 'P86'];
    var waiting = tubes.filter(function (id) { return (vessel(3, id) || {}).startedAt < 0; });
    var dry = waiting.filter(function (id) { return (vessel(3, id) || {}).substrate < 600; });
    if (dry.length) return 'Next: set the pipet to 250 µL and, with the Sub pipet, add 250 µL of 3.0 mM substrate to ' + (dry.length === 3 ? 'each of the three pH tubes.' : dry.map(function (id) { return vesselName(3, id); }).join(' and ') + '.');
    if (waiting.length) return 'Next: with pipet E, add 250 µL of enzyme to ' + vesselName(3, waiting[0]) + (started ? '.' : '. The timer starts as the enzyme goes in.');
    due = nextSample(3);
    if (due) return 'Next sample: ' + due.c.label + ' at ' + M.clock(due.due) + ' on the timer. Set the pipet to 500 µL and, with ' + pipetName(3, 'p' + due.c.id.slice(1)) + ', move 500 µL from ' + vesselName(3, due.c.source) + ' to its cuvette.';
    return finished(3);
  }

  // "Next sample: H1 at 1:00 on the timer. With pipet H, move 500 µL from ... to cuvette H1."
  function sampleStep(n, due) {
    return 'Next sample: ' + due.c.label + ' at ' + M.clock(due.due) + ' on the timer. Set the pipet to 500 µL and, with ' + pipetName(n, due.c.pipet) +
      ', move 500 µL from ' + vesselName(n, due.c.source) + ' to cuvette ' + due.c.label + '.';
  }

  function where(zones) {
    var names = { '0': 'in the ice bath', '22': 'on the bench', '37': 'in the warm bath' };
    return zones.map(function (z) { return names[z]; }).join(' and ');
  }

  // A tube's temperature: from the 3D lab's last tick, or, before the first tick after a reload,
  // from its last account of the bench.
  function temp(id, fallback) {
    if (typeof temps[id] === 'number') return temps[id];
    var v = vessel(state.activity, id);
    return v && v.ul > 0 && typeof v.celsius === 'number' ? v.celsius : fallback;
  }

  // ---- Tables ------------------------------------------------------------------------------------

  function textInput(id, label) {
    return el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', id: id, 'aria-label': label, 'aria-describedby': 'msg-' + id });
  }

  function cellWith(control, id) {
    var cell = el('td');
    cell.appendChild(control);
    cell.appendChild(el('p', { 'class': 'msg', id: 'msg-' + id, role: 'status' }));
    return cell;
  }

  // get/set: read and write the entry this input stands for.
  function bindText(input, field, get, set) {
    input.value = get();
    input.addEventListener('input', function () {
      set(input.value);
      paint(input, $('msg-' + field), { ok: null, message: '' });
      saveState();
    });
    input.addEventListener('change', function () { checkAll(field); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
  }

  function entryBinder(n, kind, id) {
    return [function () { return state.acts[n].entries[kind][id]; }, function (v) { state.acts[n].entries[kind][id] = v; }];
  }

  function buildTables() {
    NUMBERS.forEach(function (n) {
      var eye = $('rows-a' + n + '-eye'), abs = $('rows-a' + n + '-abs'), timed = ACTS[n].timeColumn;
      ACTS[n].cuvettes.forEach(function (c) {
        var b;
        var row = el('tr');
        if (timed) row.appendChild(el('td', { 'class': 'col-time', id: fid(n, 'time2', c.id) }, String(c.minutes)));
        row.appendChild(el('th', { scope: 'row', 'class': timed ? 'col-id' : 'col-cond', id: timed ? fid(n, 'name2', c.id) : fid(n, 'time2', c.id) }, c.label));
        var matchField = fid(n, 'match', c.id);
        var select = el('select', { id: matchField, 'aria-label': 'Standard most similar to cuvette ' + c.label, 'aria-describedby': 'msg-' + matchField });
        select.appendChild(el('option', { value: '' }, '–'));
        STANDARDS.forEach(function (s, i) { select.appendChild(el('option', { value: String(i + 1) }, s.id)); });
        select.value = state.acts[n].entries.match[c.id];
        select.addEventListener('change', function () {
          state.acts[n].entries.match[c.id] = select.value;
          saveState();
          checkAll(matchField);
        });
        row.appendChild(cellWith(select, matchField));
        var amountField = fid(n, 'amount', c.id);
        var amount = textInput(amountField, 'Amount of p-nitrophenol in cuvette ' + c.label + ', from its closest standard');
        b = entryBinder(n, 'amount', c.id);
        bindText(amount, amountField, b[0], b[1]);
        row.appendChild(cellWith(amount, amountField));
        eye.appendChild(row);

        var row2 = el('tr');
        if (timed) row2.appendChild(el('td', { 'class': 'col-time', id: fid(n, 'time4', c.id) }, String(c.minutes)));
        row2.appendChild(el('th', { scope: 'row', 'class': timed ? 'col-id' : 'col-cond', id: timed ? fid(n, 'name4', c.id) : fid(n, 'time4', c.id) }, c.label));
        var absField = fid(n, 'abs', c.id);
        var absInput = textInput(absField, 'Absorbance of cuvette ' + c.label);
        b = entryBinder(n, 'abs', c.id);
        bindText(absInput, absField, b[0], b[1]);
        row2.appendChild(cellWith(absInput, absField));
        var curveField = fid(n, 'curve', c.id);
        var curve = textInput(curveField, 'Amount of p-nitrophenol in cuvette ' + c.label + ', from the standard curve');
        b = entryBinder(n, 'curve', c.id);
        bindText(curve, curveField, b[0], b[1]);
        row2.appendChild(cellWith(curve, curveField));
        abs.appendChild(row2);
      });

      // the rates beside this activity's graph
      var side = $('a' + n + '-rates');
      ACTS[n].rates.forEach(function (rate) {
        var key = rate.key, field = fid(n, 'rate', key), text = rate.label;
        var label = el('label', { 'class': 'field' });
        var name = el('span', { 'class': 'field-name' }, text + ' ');
        name.appendChild(el('span', { 'class': 'unit' }, '(nmol/min)'));
        label.appendChild(name);
        var input = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', id: field, 'aria-describedby': 'msg-' + field });
        var b = entryBinder(n, 'rate', key);
        bindText(input, field, b[0], b[1]);
        label.appendChild(input);
        side.appendChild(label);
        side.appendChild(el('p', { 'class': 'msg', id: 'msg-' + field, role: 'status' }));
      });
    });

    var rows = $('rows-std');
    STANDARDS.forEach(function (s, i) {
      var row = el('tr');
      row.appendChild(el('th', { scope: 'row', 'class': 'col-id' }, s.id));
      row.appendChild(el('td', null, String(s.nmol)));
      if (i === 0) {
        row.appendChild(el('td', { 'class': 'given' }, '0.00 (the blank)'));
      } else {
        var field = 'std-' + s.id;
        var input = textInput(field, 'Absorbance of standard ' + s.id);
        bindText(input, field, function () { return state.std[s.id]; }, function (v) { state.std[s.id] = v; });
        row.appendChild(cellWith(input, field));
      }
      rows.appendChild(row);
    });
  }

  // ---- Questions: answered in words, saved and printed, not checked ----------------------------------

  function questionField(n, q) { return 'a' + n + '-answer-' + q.id; }

  function buildQuestions() {
    var holder = $('questions');
    NUMBERS.forEach(function (n) {
      var list = QUESTIONS[n] || [];
      if (!list.length) return;
      var panel = el('div', { 'class': 'panel', 'data-activity': String(n) });
      panel.appendChild(el('h3', { 'class': 'panel-title' }, ACTS[n].title));
      var ol = el('ol', { 'class': 'questions' });
      list.forEach(function (q) {
        var field = questionField(n, q);
        var item = el('li');
        var label = el('label', { 'for': field }, q.text);
        var box = el('textarea', { id: field, rows: '4' });
        var printed = el('p', { 'class': 'answer-print', id: 'print-' + field, 'aria-hidden': 'true' });
        box.value = state.acts[n].answers[q.id] || '';
        printed.textContent = box.value;
        box.addEventListener('input', function () {
          state.acts[n].answers[q.id] = box.value;
          printed.textContent = box.value;
          saveState();
        });
        box.addEventListener('change', updateStatus);
        item.appendChild(label);
        item.appendChild(box);
        item.appendChild(printed);
        ol.appendChild(item);
      });
      panel.appendChild(ol);
      holder.appendChild(panel);
    });
    // The section is only there when this page's activities have questions; "Turn in" is numbered to suit.
    var any = PAGE.some(function (n) { return (QUESTIONS[n] || []).length > 0; });
    $('part-questions').hidden = !any;
    $('report-step').textContent = any ? '5' : '4';
  }

  function refreshAnswers() {
    NUMBERS.forEach(function (n) {
      (QUESTIONS[n] || []).forEach(function (q) {
        var box = $(questionField(n, q));
        if (!box) return;
        box.value = state.acts[n].answers[q.id] || '';
        $('print-' + questionField(n, q)).textContent = box.value;
      });
    });
  }

  function answered(n) {
    return (QUESTIONS[n] || []).filter(function (q) { return !!String(state.acts[n].answers[q.id] || '').trim(); }).length;
  }

  // Shows when each sample was really taken, where that is more than a few seconds from when it was due.
  function showTimes() {
    NUMBERS.forEach(function (n) {
      ACTS[n].cuvettes.forEach(function (c) {
        var timed = ACTS[n].timeColumn;
        var v = vessel(n, c.id), base = timed ? String(c.minutes) : c.label, text = base;
        if (c.enzyme && v && v.hasSample && v.sampleSeconds >= 0 && Math.abs(v.sampleSeconds - c.minutes * 60) > 5) {
          text = base + ' (' + (timed ? 'taken at ' : 'stopped after ') + M.clock(v.sampleSeconds) + ')';
        }
        $(fid(n, 'time2', c.id)).textContent = text;
        $(fid(n, 'time4', c.id)).textContent = text;
      });
    });
  }

  // ---- Checking ----------------------------------------------------------------------------------
  // The page screens each entry itself. A color match or an absorbance then goes to the 3D lab,
  // which compares it with the cuvette and sends back a verdict. Until the verdict for the current
  // entry is in, the entry is shown as neither right nor wrong. Verdicts are kept with the saved
  // work, because the 3D lab can only check the activity that is on its bench.

  var asked = {};         // request number -> { field: context } for the entries sent with it
  var nextAsk = 1;
  var toCount = {};       // fields the student just finished: count a flag once their result is in

  // The entries the 3D lab checks for one activity: field name, which cuvette, what kind, what was entered.
  function benchFields(n) {
    var list = [];
    ACTS[n].cuvettes.forEach(function (c) {
      list.push({ field: fid(n, 'match', c.id), n: n, vessel: c.id, kind: 'match', group: 'match', text: state.acts[n].entries.match[c.id], store: state.acts[n].verdicts });
      list.push({ field: fid(n, 'abs', c.id), n: n, vessel: c.id, kind: 'abs', group: 'abs', text: state.acts[n].entries.abs[c.id], store: state.acts[n].verdicts });
    });
    return list;
  }

  // The standards are the same in every activity, so they are checked on whichever bench is out,
  // and a reading that has been accepted stays accepted on every other bench.
  function standardFields() {
    return STANDARDS.slice(1).map(function (s) {
      return { field: 'std-' + s.id, n: state.activity, vessel: s.id, kind: 'abs', group: 'abs', text: state.std[s.id], store: state.stdVerdicts, standard: true };
    });
  }

  function standardSettled(f) {
    var known = f.store[f.field];
    if (!known || known.verdict !== 'ok') return false;
    // (work saved by an earlier version kept what was typed only as the first part of the context)
    var text = typeof known.text === 'string' ? known.text : String(known.context || '').split('|')[0];
    return text === f.text;
  }

  // A verdict depends on the cuvette as well as on what was typed.
  function contextOf(f) {
    var v = vessel(f.n, f.vessel) || {};
    return [f.text, v.hasSample ? 1 : 0, v.read ? 1 : 0, Math.round(v.ul || 0), Math.round((v.sampleSeconds || 0) * 10)].join('|');
  }

  function screened(f) { return f.kind === 'match' ? M.screenMatch(f.text) : M.screenAbsorbance(f.text); }

  function benchResult(f) {
    var s = screened(f);
    if (!s.ready) return { ok: s.ok, message: s.message };
    if (f.standard && standardSettled(f)) return { ok: true, message: '' };
    var known = f.store[f.field];
    if (!known || known.context !== contextOf(f)) return { ok: null, message: '', waiting: true };
    var name = vesselName(f.n, f.vessel);
    return f.kind === 'match' ? M.matchMessage(known.verdict, name) : M.absorbanceMessage(known.verdict, name);
  }

  function checkAll(changedField) {
    if (changedField) toCount[changedField] = true;
    showChecks();
    askBench();
  }

  function accepted(field) { return !!(results[field] && results[field].ok === true); }

  function standardAbsorbance(id) {
    if (id === 'S1') return 0;
    return accepted('std-' + id) ? M.parseNumber(state.std[id]) : null;
  }

  function acceptedAbsorbance(n, id) {
    return accepted(fid(n, 'abs', id)) ? M.parseNumber(state.acts[n].entries.abs[id]) : null;
  }

  function standardPoints() {
    return STANDARDS.map(function (s) { return { id: s.id, nmol: s.nmol, absorbance: standardAbsorbance(s.id) }; });
  }

  // The amount in a cuvette as the student has it: from the curve if that is accepted, else by eye.
  function acceptedAmount(n, id) {
    if (accepted(fid(n, 'curve', id))) return M.parseNumber(state.acts[n].entries.curve[id]);
    if (accepted(fid(n, 'amount', id))) return M.parseNumber(state.acts[n].entries.amount[id]);
    return null;
  }

  function ratePoints() {
    return ACTS[1].cuvettes.filter(function (c) { return c.enzyme; }).map(function (c) {
      return { id: c.id, minutes: sampledMinutes(1, c), nmol: acceptedAmount(1, c.id) };
    });
  }

  function show(field, group, value, result) {
    results[field] = result;
    paint($(field), $('msg-' + field), result);
    if (toCount[field] && !result.waiting) {
      delete toCount[field];
      countFlag(group, field, value, result);
    }
  }

  function showChecks() {
    standardFields().forEach(function (f) { show(f.field, f.group, f.text, benchResult(f)); });
    var slope = M.fitSlope(standardPoints());

    NUMBERS.forEach(function (n) {
      var e = state.acts[n].entries;
      benchFields(n).forEach(function (f) { show(f.field, f.group, f.text, benchResult(f)); });
      ACTS[n].cuvettes.forEach(function (c) {
        var amount = M.checkAmount(e.match[c.id], e.amount[c.id]);
        if (amount.ok === true && !accepted(fid(n, 'match', c.id))) amount = { ok: null, message: 'This is checked once the closest standard is accepted.' };
        show(fid(n, 'amount', c.id), 'amount', e.amount[c.id], amount);
        show(fid(n, 'curve', c.id), 'curve', e.curve[c.id], M.checkFromCurve(acceptedAbsorbance(n, c.id), slope, e.curve[c.id]));
      });
      ACTS[n].rates.forEach(function (rate) {
        var text = e.rate[rate.key], result;
        if (rate.kind === 'slope') result = M.checkEnzymeRate(ratePoints(), text);
        else if (rate.kind === 'control') result = M.checkControlRate(acceptedAmount(1, 'Start'), acceptedAmount(1, 'End'), 8, text);
        else {
          var c = cuvette(n, rate.cuvette);
          result = M.checkSingleRate(acceptedAmount(n, c.id), c.minutes, sampledMinutes(n, c), text);
        }
        show(fid(n, 'rate', rate.key), 'rate', text, result);
      });
    });

    saveState();
    showTimes();
    drawCurve();
    NUMBERS.forEach(function (n) { if (ACTS[n].chart === 'time') drawTime(n); else drawCondition(n); });
    updateStatus();
  }

  // Sends the entries for the activity that is on the bench.
  function askBench() {
    if (!benchReady) return;
    var n = state.activity, id = nextAsk++, sent = {}, items = [];
    benchFields(n).concat(standardFields().filter(function (f) { return !standardSettled(f); })).forEach(function (f) {
      var s = screened(f);
      if (!s.ready) return;
      sent[f.field] = { context: contextOf(f), store: f.store, text: f.text };
      items.push({ field: f.field, kind: f.kind, vessel: f.vessel, value: s.value });
    });
    if (!items.length) return;
    asked[id] = sent;
    sendBench('Check', JSON.stringify({ id: id, items: items }));
  }

  function takeVerdicts(e) {
    var sent = asked[e.id];
    delete asked[e.id];
    if (!sent) return;
    (e.rows || []).forEach(function (row) {
      var s = sent[row.field];
      if (row.verdict && s) s.store[row.field] = { context: s.context, verdict: row.verdict, text: s.text };
    });
    showChecks();
  }

  // ---- Graphs ------------------------------------------------------------------------------------

  var W = 520, H = 340, PAD = { left: 56, right: 16, top: 14, bottom: 46 };

  function frame(holder, xMin, xMax, yMax, xStep, yStep, xLabel, yLabel, label) {
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': label, 'class': 'plot' });
    var x = function (v) { return PAD.left + (W - PAD.left - PAD.right) * (v - xMin) / (xMax - xMin); };
    var y = function (v) { return H - PAD.bottom - (H - PAD.top - PAD.bottom) * v / yMax; };
    for (var gx = xMin; gx <= xMax + 1e-9; gx += xStep) {
      root.appendChild(svg('line', { x1: x(gx), x2: x(gx), y1: y(0), y2: y(yMax), 'class': 'grid' }));
      root.appendChild(svg('text', { x: x(gx), y: y(0) + 16, 'class': 'tick', 'text-anchor': 'middle' }, M.trim(gx, 2)));
    }
    for (var gy = 0; gy <= yMax + 1e-9; gy += yStep) {
      root.appendChild(svg('line', { x1: x(xMin), x2: x(xMax), y1: y(gy), y2: y(gy), 'class': 'grid' }));
      root.appendChild(svg('text', { x: x(xMin) - 7, y: y(gy) + 4, 'class': 'tick', 'text-anchor': 'end' }, M.trim(gy, 2)));
    }
    root.appendChild(svg('line', { x1: x(xMin), x2: x(xMax), y1: y(0), y2: y(0), 'class': 'axis' }));
    root.appendChild(svg('line', { x1: x(xMin), x2: x(xMin), y1: y(0), y2: y(yMax), 'class': 'axis' }));
    root.appendChild(svg('text', { x: (x(xMin) + x(xMax)) / 2, y: H - 8, 'class': 'axis-label', 'text-anchor': 'middle' }, xLabel));
    root.appendChild(svg('text', { x: 14, y: (y(0) + y(yMax)) / 2, 'class': 'axis-label', 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (y(0) + y(yMax)) / 2 + ')' }, yLabel));
    holder.textContent = '';
    holder.appendChild(root);
    return { root: root, x: x, y: y, xMax: xMax, yMax: yMax };
  }

  var curveAt = 0.5;       // the absorbance the standard curve is being read at
  var curvePlot = null, curveSlope = null;

  function drawCurve() {
    var points = standardPoints();
    curveSlope = M.fitSlope(points);
    var p = curvePlot = frame($('curve-chart'), 0, 120, 2, 20, 0.5, 'p-Nitrophenol (nmol)', 'Absorbance at 410 nm',
      'Standard curve: absorbance against amount of p-nitrophenol');
    if (curveSlope) {
      var endX = Math.min(p.xMax, p.yMax / curveSlope);
      p.root.appendChild(svg('line', { x1: p.x(0), y1: p.y(0), x2: p.x(endX), y2: p.y(endX * curveSlope), 'class': 'fit' }));
      var a = Math.min(curveAt, endX * curveSlope), n = a / curveSlope;
      p.root.appendChild(svg('polyline', { points: p.x(0) + ',' + p.y(a) + ' ' + p.x(n) + ',' + p.y(a) + ' ' + p.x(n) + ',' + p.y(0), 'class': 'guide' }));
      p.root.appendChild(svg('circle', { cx: p.x(n), cy: p.y(a), r: 4, 'class': 'guide-dot' }));
      $('curve-readout').textContent = 'On the line, an absorbance of ' + a.toFixed(2) + ' is ' + M.trim(n, 1) + ' nmol of p-nitrophenol.';
    } else {
      $('curve-readout').textContent = 'The line is drawn once the absorbances of at least two of the standards S2 to S5 are accepted in Table 3.';
    }
    points.forEach(function (s) {
      if (s.absorbance == null) return;
      p.root.appendChild(svg('circle', { cx: p.x(s.nmol), cy: p.y(Math.min(s.absorbance, p.yMax)), r: 5, 'class': 'point' }));
      p.root.appendChild(svg('text', { x: p.x(s.nmol) + 8, y: p.y(Math.min(s.absorbance, p.yMax)) + 14, 'class': 'point-label' }, s.id));
    });
    $('curve-slider').disabled = !curveSlope;
  }

  function bindCurve() {
    var slider = $('curve-slider');
    slider.value = String(curveAt);
    slider.addEventListener('input', function () { curveAt = parseFloat(slider.value) || 0; drawCurve(); });
    function fromPointer(e) {
      if (!curvePlot || !curveSlope) return;
      var box = curvePlot.root.getBoundingClientRect();
      if (!box.height) return;
      var py = (e.clientY - box.top) / box.height * H;
      var a = (H - PAD.bottom - py) / (H - PAD.top - PAD.bottom) * curvePlot.yMax;
      curveAt = Math.max(0, Math.min(2, Math.round(a * 100) / 100));
      slider.value = String(curveAt);
      drawCurve();
    }
    $('curve-chart').addEventListener('pointermove', fromPointer);
    $('curve-chart').addEventListener('pointerdown', fromPointer);
  }

  // Activities 1, 4 and 5: product against time, one set of points for each reaction.
  function drawTime(n) {
    var a = ACTS[n];
    var sets = a.series.map(function (series) {
      return {
        series: series,
        points: series.ids.map(function (id) {
          var c = cuvette(n, id);
          return { id: id, minutes: c.enzyme ? sampledMinutes(n, c) : c.minutes, nmol: acceptedAmount(n, id) };
        }).filter(function (p) { return p.nmol != null; }).sort(function (p, q) { return p.minutes - q.minutes; })
      };
    });
    var top = 100, right = 8;
    sets.forEach(function (set) { set.points.forEach(function (p) { top = Math.max(top, p.nmol); right = Math.max(right, p.minutes); }); });
    var yMax = Math.ceil(top * 1.08 / 25) * 25, xMax = Math.ceil(right + 0.5);
    var p = frame($('a' + n + '-rate-chart'), 0, xMax, yMax, 1, 25, 'Time (minutes)', 'p-Nitrophenol (nmol)', 'Amount of p-nitrophenol against time');

    // Activity 1: the student's own rate, drawn as a line from zero
    var slope = a.rates.filter(function (r) { return r.kind === 'slope'; })[0];
    var rate = slope && accepted(fid(n, 'rate', slope.key)) ? M.parseNumber(state.acts[n].entries.rate[slope.key]) : null;
    if (rate > 0) {
      var endX = Math.min(xMax, yMax / rate);
      p.root.appendChild(svg('line', { x1: p.x(0), y1: p.y(0), x2: p.x(endX), y2: p.y(endX * rate), 'class': 'fit dashed' }));
    }
    sets.forEach(function (set, index) {
      var square = set.series.shape === 'square';
      if (set.series.joined && set.points.length) {
        var path = [p.x(0) + ',' + p.y(0)].concat(set.points.map(function (q) { return p.x(q.minutes) + ',' + p.y(q.nmol); }));
        p.root.appendChild(svg('polyline', { points: path.join(' '), 'class': 'fit join' + (square ? ' dashed' : '') }));
      }
      set.points.forEach(function (q) {
        if (square) p.root.appendChild(svg('rect', { x: p.x(q.minutes) - 5, y: p.y(q.nmol) - 5, width: 10, height: 10, 'class': 'point control' }));
        else p.root.appendChild(svg('circle', { cx: p.x(q.minutes), cy: p.y(q.nmol), r: 5, 'class': 'point' }));
        p.root.appendChild(svg('text', { x: p.x(q.minutes) + 9, y: p.y(q.nmol) + (square ? -8 : 14), 'class': 'point-label' }, q.id));
      });
      var keyY = PAD.top + 12 + index * 19;
      if (square) p.root.appendChild(svg('rect', { x: PAD.left + 11, y: keyY - 5, width: 10, height: 10, 'class': 'point control' }));
      else p.root.appendChild(svg('circle', { cx: PAD.left + 16, cy: keyY, r: 5, 'class': 'point' }));
      p.root.appendChild(svg('text', { x: PAD.left + 27, y: keyY + 4, 'class': 'point-label' }, set.series.name));
    });
  }

  // Activities 2 and 3: the student's accepted rates against temperature or pH.
  function drawCondition(n) {
    var a = ACTS[n];
    var points = a.cuvettes.map(function (c) {
      var field = fid(n, 'rate', c.id);
      return { label: c.label, x: c.x, rate: accepted(field) ? M.parseNumber(state.acts[n].entries.rate[c.id]) : null };
    }).filter(function (p) { return p.rate != null; });
    var top = 10;
    points.forEach(function (p) { top = Math.max(top, p.rate); });
    var step = top > 40 ? 10 : 5, yMax = Math.ceil(top * 1.1 / step) * step;
    var p = frame($('a' + n + '-rate-chart'), a.axisMin, a.axisMax, yMax, a.axisStep, step, a.axis, 'Initial rate (nmol/min)', 'Initial rate against ' + a.rowHead.toLowerCase());
    if (points.length > 1) {
      p.root.appendChild(svg('polyline', { points: points.map(function (q) { return p.x(q.x) + ',' + p.y(q.rate); }).join(' '), 'class': 'fit join' }));
    }
    points.forEach(function (q) {
      p.root.appendChild(svg('circle', { cx: p.x(q.x), cy: p.y(q.rate), r: 5, 'class': 'point' }));
      p.root.appendChild(svg('text', { x: p.x(q.x) + 8, y: p.y(q.rate) - 8, 'class': 'point-label' }, M.trim(q.rate, 1)));
    });
  }

  // ---- Progress and the printed report -------------------------------------------------------------

  function countAccepted(fields) { return fields.filter(accepted).length; }

  function progress(n) {
    var ids = ACTS[n].cuvettes.map(function (c) { return c.id; });
    var of = function (kind) { return ids.map(function (id) { return fid(n, kind, id); }); };
    var stdFields = STANDARDS.slice(1).map(function (s) { return 'std-' + s.id; });
    var p = {
      count: ids.length,
      samples: ids.filter(function (id) { return hasSample(n, id); }).length,
      eye: countAccepted(of('match')) + countAccepted(of('amount')),
      std: countAccepted(stdFields),
      abs: countAccepted(of('abs')),
      curve: countAccepted(of('curve')),
      rates: countAccepted(rateKeys(n).map(function (k) { return fid(n, 'rate', k); })),
      rateCount: rateKeys(n).length,
      answers: answered(n),
      questionCount: (QUESTIONS[n] || []).length
    };
    var k = p.count, tables = [ACTS[n].tables.eye, 'Table 3', ACTS[n].tables.abs];
    if (p.samples < k) p.todo = (k - p.samples) + ' of the ' + k + ' samples at the bench';
    else if (p.eye < 2 * k) p.todo = tables[0] + ', comparing the cuvettes with the standards by eye';
    else if (p.std < 4) p.todo = 'Table 3, the absorbance of standards S2 to S5';
    else if (p.abs < k) p.todo = (k - p.abs) + ' of the ' + k + ' absorbances in ' + tables[2];
    else if (p.curve < k) p.todo = (k - p.curve) + ' of the ' + k + ' amounts from the standard curve in ' + tables[2];
    else if (p.rates < p.rateCount) p.todo = 'the rates in part 3';
    else if (p.answers < p.questionCount) p.todo = p.questionCount === 1 ? 'the question in part 4' : (p.questionCount - p.answers) + ' of the ' + p.questionCount + ' questions in part 4';
    else p.todo = '';
    p.started = p.samples > 0 || p.eye + p.abs + p.curve + p.rates + p.answers > 0;
    return p;
  }

  function updateStatus() {
    var all = PAGE.map(progress);
    var open = [];
    all.forEach(function (p, i) { if (p.todo) open.push('Activity ' + PAGE[i] + ': ' + p.todo + '.'); });
    $('report-status').textContent = open.length ? 'Still to do. ' + open.join(' ') : 'Everything is checked. Add your name, then print or save the report as a PDF.';

    var now = all[PAGE.indexOf(state.activity)];
    var done = now.eye + now.abs + now.curve;
    $('table-status').textContent = done ? done + ' of ' + now.count * 4 + ' table entries accepted for this activity.' : '';

    var f = state.flags;
    $('print-name').textContent = 'Name: ' + (state.name || '________________');
    $('print-date').textContent = 'Printed ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    $('print-checks').textContent = 'Checked by the lab page. Table 3: ' + all[0].std + ' of 4 absorbances of the standards accepted. ' + all.map(function (p, i) {
      return 'Activity ' + PAGE[i] + ': ' + p.samples + ' of ' + p.count + ' samples taken; ' + p.eye + ' of ' + 2 * p.count + ' by-eye entries, ' +
        p.abs + ' of ' + p.count + ' absorbances, ' + p.curve + ' of ' + p.count + ' amounts from the curve and ' +
        p.rates + ' of ' + p.rateCount + ' rates accepted' + (p.questionCount ? '; ' + p.answers + ' of ' + p.questionCount + ' questions answered (not checked).' : '.');
    }).join(' ') + ' Flagged before correction, in all: ' + (f.match + f.amount) + ' by-eye entries, ' + f.abs + ' absorbances, ' + f.curve +
      ' amounts from the curve, ' + f.rate + ' rates.';

    // In print, leave out an activity that has not been started.
    PAGE.forEach(function (n, i) {
      each('.panel[data-activity="' + n + '"]', function (node) { node.setAttribute('data-untouched', all[i].started ? 'false' : 'true'); });
    });
  }

  // ---- The 3D bench ----------------------------------------------------------------------------

  var unity = null;
  var unityAwake = false;
  var benchReady = false;     // the 3D lab has set out the bench for the current activity and can check entries
  var persistentNote = { text: '', kind: '' };

  function sendBench(method, value) {
    if (!unity) return;
    try { unity.SendMessage('Lab', method, value == null ? '' : String(value)); } catch (e) { console.error(e); }
  }

  // A fresh lab opens on the whole fume hood and then moves in to the bench. Someone coming back
  // to work already under way starts at the bench, and ?intro=0 always does. Visitors who ask
  // their system for reduced motion get straight cuts between views and no opening move.
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function workUnderWay() { return PAGE.some(function (n) { return !!state.acts[n].bench; }); }

  function configureBench() {
    if (!unity || !unityAwake) return;
    benchReady = false;
    temps = {};
    var a = state.acts[state.activity];
    var config = {
      activity: state.activity,
      seed: state.seed,
      hasState: !!a.bench,
      lab: a.lab,
      intro: params.get('intro') !== '0' && !calm && !workUnderWay(),
      calm: calm
    };
    if (a.bench) config.state = a.bench;
    sendBench('Configure', JSON.stringify(config));
    sendBench('SetVolume', state.volume);
  }

  // A step or warning note stays up for a few seconds before labels for whatever the pointer is
  // over take its place, so that a warning can be read.
  var holdNoteUntil = 0;
  var pendingHover = null;
  var hoverTimer = null;

  function note(text, kind, temporary) {
    if (!temporary) {
      persistentNote = { text: text, kind: kind || '' };
      holdNoteUntil = Date.now() + (kind === 'warn' ? 4500 : 2500);
      pendingHover = null;
    }
    var node = $('stage-note');
    if (node.textContent !== text) node.textContent = text;
    if (kind) node.setAttribute('data-kind', kind); else node.removeAttribute('data-kind');
  }

  // text: a label for what the pointer is over, or null when it is over nothing.
  function hoverNote(text) {
    clearTimeout(hoverTimer);
    hovering = text !== null;
    var wait = holdNoteUntil - Date.now();
    if (wait > 0) {
      pendingHover = text;
      if (text !== null) hoverTimer = setTimeout(function () {
        if (pendingHover !== null) { var t = pendingHover; pendingHover = null; note(t, '', true); }
      }, wait);
      return;
    }
    pendingHover = null;
    if (text === null) note(persistentNote.text, persistentNote.kind, true);
    else note(text, '', true);
  }

  var hovering = false, holding = false;

  function amountText(ul) {
    if (!(ul > 1)) return 'empty';
    return 'about ' + M.volume(ul < 2000 ? Math.round(ul / 50) * 50 : Math.round(ul / 100) * 100);
  }

  function hoverText(e) {
    var n = state.activity, v = vessel(n, e.id);
    if (e.item === 'pipet') return pipetJob(n, e.id) + ' Click it to pick it up.';
    if (e.item === 'tube') {
      var text = M.capital(vesselName(n, e.id)) + (v ? ': ' + amountText(v.ul) : '');
      if (typeof temps[e.id] === 'number') text += ', at ' + Math.round(temps[e.id]) + ' °C';
      return text + '.';
    }
    if (e.item === 'cuvette') {
      if (M.isStandard(e.id)) return 'Standard ' + e.id + '. Drag it to the spectrophotometer to read its absorbance.';
      if (lab.view === 'standards') return M.capital(vesselName(n, e.id)) + '. Slide it from side to side to line it up under a standard.';
      return M.capital(vesselName(n, e.id)) + ' (' + (v && v.ul > 1 ? M.volume(Math.round(v.ul / 50) * 50) : 'empty') + '). Drag it to the standards or to the spectrophotometer.';
    }
    if (e.item === 'meter') return 'Spectrophotometer, set to 410 nm. Drag a cuvette onto it to read its absorbance; blank it with S1 first.';
    if (e.item === 'timer') return 'Timer. It starts when the enzyme first meets the substrate.';
    return null;
  }

  function blockedText(e) {
    var n = state.activity, target = vesselName(n, e.vessel);
    switch (e.reason) {
      case 'not-source': return 'The pipet is empty. Draw liquid up from a tube first.';
      case 'wrong-pipet': return pipetJob(n, e.pipet) + ' Use a different pipet for ' + target + ', so the solutions do not get mixed.';
      case 'empty': return M.capital(target) + ' is empty.';
      case 'not-mixed': return 'The reaction in ' + target + ' has not been started yet.';
      case 'standard': return 'The standards are finished solutions. Nothing is added to them.';
      case 'wrong-target':
        if (e.targets && e.targets.length) {
          return M.capital(liquidName(n, e.from)) + ' goes into ' + listNames(e.targets.map(function (id) { return vesselName(n, id); })) + ', not into ' + target + '.';
        }
        return M.capital(pipetName(n, e.pipet)) + ' cannot be used there.';
      case 'no-stop': return M.capital(target) + ' has no stop solution in it yet. Put 500 µL in first, or the reaction will not stop.';
      case 'has-sample': return M.capital(target) + ' already has its sample.';
      case 'full': return M.capital(target) + ' cannot hold that much more.';
    }
    return M.capital(pipetName(n, e.pipet)) + ' cannot be used there.';
  }

  function setView(view) {
    each('.view-button[data-view]', function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === view ? 'true' : 'false'); });
  }

  function setVolume(ul) {
    state.volume = ul;
    each('.volume-button', function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-volume') === String(ul) ? 'true' : 'false'); });
    sendBench('SetVolume', ul);
    saveState();
  }

  var lastSavedAt = 0;

  function showTimer(e) {
    $('timer').hidden = false;
    $('timer-time').textContent = M.clock(e.seconds);
    $('fast-forward').setAttribute('aria-pressed', e.fast ? 'true' : 'false');
    temps = e.temps || {};
    state.acts[state.activity].lab = e.lab;
    // Keep the saved bench clock within a second of the real one (and see the "pagehide" listener
    // below), so that a reload picks up where the bench was, even during fast forward.
    if (Date.now() - lastSavedAt > 1000) { lastSavedAt = Date.now(); saveState(); }
    // While the student is waiting for the baths, the note keeps up with the temperatures.
    if (!hovering && !holding && Date.now() > holdNoteUntil && /^Now wait/.test(persistentNote.text)) {
      var step = nextStep(state.activity);
      if (step && step !== persistentNote.text) { persistentNote.text = step; note(step, '', true); }
    }
  }

  function takeState(bench) {
    if (!bench || !Array.isArray(bench.vessels) || bench.activity !== state.activity) return;
    var a = state.acts[state.activity];
    a.bench = bench;
    a.lab = bench.lab || 0;
    saveState();
  }

  function onBenchEvent(json) {
    var e;
    try { e = JSON.parse(json); } catch (err) { return; }
    // news from a bench that has since been put away
    if (typeof e.activity === 'number' && e.activity !== state.activity) return;
    var n = state.activity;
    switch (e.type) {
      case 'ready':
        unityAwake = true;
        configureBench();
        break;
      case 'configured':
        $('stage-cover').hidden = true;
        takeState(e.state);
        benchReady = true;
        holding = false;
        note(nextStep(n));
        checkAll();
        break;
      case 'state':
        takeState(e.state);
        checkAll();
        break;
      case 'tick':
        if (benchReady) showTimer(e);
        break;
      case 'checked':
        takeVerdicts(e);
        break;
      case 'hover':
        hoverNote(hoverText(e));
        break;
      case 'holding':
        clearTimeout(hoverTimer);
        pendingHover = null;
        holding = true;
        if (e.item === 'pipet') note('Holding ' + pipetName(n, e.id) + '. Tap or click a tube to draw liquid up, or the bench to put the pipet back.', '', true);
        else note('Holding ' + vesselName(n, e.id) + '. Tap or click the stand of standards or the spectrophotometer, or anywhere else to put it back.', '', true);
        break;
      case 'returned':
        holding = false;
        note(nextStep(n) || persistentNote.text);
        break;
      case 'drew':
        holding = true;
        note(M.capital(pipetName(n, e.pipet)) + ' holds ' + M.volume(e.ul) + ' of ' + liquidName(n, e.vessel) + '. Tap or click the tube or cuvette it goes into.');
        break;
      case 'added':
        if (e.started) note((n === 1 ? 'The enzyme is in and the timer is running. ' : 'The first reaction is mixed and the timer is running. ') + nextStep(n));
        else if (e.sample) note(M.capital(vesselName(n, e.vessel)) + ' has its sample' + (e.seconds >= 0 ? ', taken at ' + M.clock(e.seconds) : '') + '. ' + nextStep(n));
        else if (e.from === e.vessel) note('Put back. ' + nextStep(n));
        else note(M.volume(e.ul) + ' of ' + liquidName(n, e.from) + ' is in ' + vesselName(n, e.vessel) + '. ' + nextStep(n));
        break;
      case 'blocked':
        note(blockedText(e), 'warn');
        break;
      case 'blank':
        note('The spectrophotometer is blanked with S1: it reads 0.00. Now read ' + (accepted('std-S5') ? '' : 'the other standards for Table 3 and ') + 'your cuvettes for ' + ACTS[n].tables.abs + '.');
        break;
      case 'unread':
        if (e.reason === 'not-blanked') note('Blank the spectrophotometer first: put standard S1 in it.', 'warn');
        else note('There is too little liquid in ' + vesselName(n, e.vessel) + ' for the light to pass through. It needs about 1 mL.', 'warn');
        break;
      case 'reading':
        note(M.capital(vesselName(n, e.vessel)) + ' is in the spectrophotometer. Record the absorbance on its display' +
          ' in ' + (M.isStandard(e.vessel) ? 'Table 3' : ACTS[n].tables.abs) + '.');
        break;
      case 'compare':
        note(M.capital(vesselName(n, e.vessel)) + ' is in front of the standards. Slide it along to find the closest color, and record it in ' +
          ACTS[n].tables.eye + '.');
        break;
      case 'reset':
        state.acts[n].entries = blankEntries(n);
        state.acts[n].verdicts = {};
        lastFlagged = {};
        holding = false;
        takeState(e.state);
        refreshInputs();
        note('Everything is washed and set out again. ' + nextStep(n));
        checkAll();
        break;
      case 'view':        // the camera has set off for this view
        setView(e.view);
        lab.view = e.view;
        lab.viewSettled = false;
        break;
      case 'arrived':     // and has got there
        setView(e.view);
        lab.view = e.view;
        lab.viewSettled = true;
        break;
    }
  }

  // ---- Moving between activities -----------------------------------------------------------------

  function showActivity() {
    document.body.setAttribute('data-part', String(PART));
    document.body.setAttribute('data-activity', String(state.activity));
    document.title = 'Biofuel Enzyme Lab: ' + (PART === 1 ? 'Activities 1 to 3' : 'Activities 4 and 5');
    $('subtitle').textContent = PART === 1 ? 'Activities 1 to 3' : 'Activities 4 and 5';
    var link = $('part-link');
    link.textContent = PART === 1 ? 'Go to Activities 4 and 5' : 'Back to Activities 1 to 3';
    link.setAttribute('href', PART === 1 ? '?part=2' : '?part=1');
    each('.activity-tab', function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-go') === String(state.activity) ? 'true' : 'false'); });
  }

  function goToActivity(n) {
    if (n === state.activity || PAGE.indexOf(n) < 0) return;
    state.activity = n;
    state.last[PART] = n;
    saveState();
    showActivity();
    persistentNote = { text: '', kind: '' };
    note('Setting out the bench for Activity ' + n + '.');
    updateStatus();
    configureBench();
  }

  function bindBenchControls() {
    each('.activity-tab', function (button) {
      button.addEventListener('click', function () { goToActivity(parseInt(button.getAttribute('data-go'), 10)); });
    });
    each('.view-button[data-view]', function (button) {
      button.addEventListener('click', function () { sendBench('SetView', button.getAttribute('data-view')); });
    });
    each('.volume-button', function (button) {
      button.addEventListener('click', function () { setVolume(parseInt(button.getAttribute('data-volume'), 10)); });
    });
    $('fast-forward').addEventListener('click', function () {
      var fast = $('fast-forward').getAttribute('aria-pressed') !== 'true';
      $('fast-forward').setAttribute('aria-pressed', fast ? 'true' : 'false');
      sendBench('SetSpeed', fast ? '10' : '1');
    });
    $('reset-bench').addEventListener('click', function () {
      $('reset-bench').hidden = true;
      $('reset-confirm').hidden = false;
      $('reset-no').focus();
    });
    $('reset-no').addEventListener('click', function () {
      $('reset-confirm').hidden = true;
      $('reset-bench').hidden = false;
      $('reset-bench').focus();
    });
    $('reset-yes').addEventListener('click', function () {
      $('reset-confirm').hidden = true;
      $('reset-bench').hidden = false;
      sendBench('ResetBench', '');
    });

    // Let the page scroll when the wheel turns over the 3D view. The lab does not use the wheel,
    // but its engine would otherwise swallow it; this listener is registered first and on the
    // window, so it gets there before the engine's own.
    window.addEventListener('wheel', function (e) {
      if (e.target === $('unity-canvas')) e.stopImmediatePropagation();
    }, { capture: true, passive: true });
  }

  // ---- Name, print, start over -------------------------------------------------------------------

  function bindReport() {
    var nameInput = $('student-name');
    nameInput.value = state.name;
    nameInput.addEventListener('input', function () { state.name = nameInput.value; saveState(); updateStatus(); });
    $('print-report').addEventListener('click', function () { window.print(); });
    window.addEventListener('beforeprint', updateStatus);

    $('start-over').addEventListener('click', function () {
      $('start-over').hidden = true;
      $('start-confirm').hidden = false;
      $('start-no').focus();
    });
    $('start-no').addEventListener('click', function () {
      $('start-confirm').hidden = true;
      $('start-over').hidden = false;
    });
    $('start-yes').addEventListener('click', function () {
      state = blankState(state.seed);     // the same student keeps the same scatter
      state.activity = state.last[PART];
      lastFlagged = {};
      saveState();
      $('start-confirm').hidden = true;
      $('start-over').hidden = false;
      $('student-name').value = '';
      showActivity();
      refreshInputs();
      setVolume(500);
      checkAll();
      configureBench();
      window.scrollTo({ top: 0 });
    });
  }

  function refreshInputs() {
    NUMBERS.forEach(function (n) {
      var e = state.acts[n].entries;
      ACTS[n].cuvettes.forEach(function (c) {
        $(fid(n, 'match', c.id)).value = e.match[c.id];
        $(fid(n, 'amount', c.id)).value = e.amount[c.id];
        $(fid(n, 'abs', c.id)).value = e.abs[c.id];
        $(fid(n, 'curve', c.id)).value = e.curve[c.id];
      });
      rateKeys(n).forEach(function (k) { $(fid(n, 'rate', k)).value = e.rate[k]; });
    });
    STANDARDS.slice(1).forEach(function (s) { $('std-' + s.id).value = state.std[s.id]; });
    refreshAnswers();
  }

  // ---- Wiring for the Unity loader in index.html ---------------------------------------------------

  var lab = window.EnzymeLab = {
    isMock: !!standIn,      // true when a test stand-in replaces the 3D lab
    view: 'bench',          // which camera view the 3D lab is showing or moving to
    viewSettled: false,     // false while the camera is still travelling
    onUnityEvent: onBenchEvent,
    attachUnity: function (instance) { unity = instance; configureBench(); },
    unityProgress: function (fraction) {
      $('progress-fill').style.width = Math.round(Math.max(0.04, fraction) * 100) + '%';
    },
    unityFailed: function (error) {
      console.error(error);
      var cover = $('stage-cover');
      cover.hidden = false;
      cover.setAttribute('data-state', 'failed');
      $('stage-status').textContent = 'The 3D lab could not start in this browser. Open this page in a current version of Chrome, Edge, Firefox or Safari on a computer.';
      document.querySelector('.progress').hidden = true;
    },
    unityBanner: function (message, type) {
      if (type === 'error') lab.unityFailed(message); else console.warn(message);
    }
  };

  // Save at the last moment too, when the page is closed, reloaded or put in the background.
  window.addEventListener('pagehide', saveState);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveState(); });

  showActivity();
  buildTables();
  buildQuestions();
  bindBenchControls();
  bindCurve();
  bindReport();
  setVolume(state.volume);
  checkAll();
  saveState();

  // ---- Stand-in for the 3D lab, supplied by automated tests -------------------------------------

  if (standIn) {
    unity = standIn(onBenchEvent);
    onBenchEvent('{"type":"ready"}');
  }
})();
