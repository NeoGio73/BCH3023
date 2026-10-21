/* The Enzyme's Handshake: the report (the last section of the page). It prints the part's results,
 * spectra and chromatograms as they stand on the page, and adds a summary for the instructor: what
 * the page accepted, the warnings the bench gave, and the answers it does not check (Part 2's faster
 * enantiomer and the Kazlauskas rule). The student's name is kept with the work.
 */
(function () {
  'use strict';
  var params = new URLSearchParams(window.location.search);
  var PART2 = params.get('part') === '2';
  var KEY = 'handshake-lab:v1:report';
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }
  if (!$('part-report')) return;
  var kept = {};
  try { kept = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { kept = {}; }
  $('report-name').value = kept.name || '';
  $('report-name').addEventListener('input', function () { kept.name = $('report-name').value; try { window.localStorage.setItem(KEY, JSON.stringify(kept)); } catch (e) { /* not kept */ } });

  function verdictOf(id) {
    var m = $(id);
    if (!m || !m.textContent) return 'not answered';
    return m.getAttribute('data-kind') === 'good' ? 'accepted' : 'not yet right';
  }
  function row(table, a, b) { var tr = el('tr'); tr.appendChild(el('th', { scope: 'row' }, a)); tr.appendChild(el('td', {}, b)); table.appendChild(tr); }

  function summary() {
    var box = $('report-summary'); box.textContent = '';
    var t = el('table', { 'class': 'data-table report-table' });
    t.appendChild(el('caption', {}, PART2 ? 'Part 2: what the page accepted' : 'Part 1: what the page accepted'));
    var warnings = [];
    if (!PART2 && window.HandPart1) {
      var s = window.HandPart1.state(), M = window.HandModel;
      row(t, 'Code and recipe', s.code + ', ' + M.RECIPES[window.HandPart1.picks().recipe].name);
      row(t, 'Percent yield', (s.entries.yield || '–') + ' % (' + verdictOf('p1-yield-msg') + ')');
      row(t, 'Specific rotation', (s.entries.specific || '–') + '° (' + verdictOf('p1-specific-msg') + ')');
      row(t, 'ee from the rotation', (s.entries.ee || '–') + ' % (' + verdictOf('p1-ee-msg') + ')');
      var right = 0, done = 0;
      window.HandNmr.SIGNALS.forEach(function (sig) { if (s.entries['nmr-' + sig.id]) { done++; if (window.HandNmr.checkSignal(sig.id, s.entries['nmr-' + sig.id]).ok) right++; } });
      row(t, 'NMR signals assigned', right + ' of 6 right' + (done < 6 ? ' (' + (6 - done) + ' not answered)' : ''));
      row(t, 'Ethyl acetoacetate left (NMR)', (s.entries.ketone || '–') + ' mol % (' + verdictOf('p1-ketone-msg') + ')');
      row(t, 'ee corrected for it', (s.entries.eecorr || '–') + ' % (' + verdictOf('p1-eecorr-msg') + ')');
      (s.bench.warnings || []).forEach(function (w) { warnings.push(M.BENCH_TEXT[w] || w); });
      if (s.bubble && s.reading !== null) warnings.push('The rotation was read with an air bubble in the tube.');
      if (!s.blanked && s.reading !== null) warnings.push('The rotation was read without zeroing on a blank.');
    }
    if (PART2 && window.HandPart2 && window.HandPart2.state) {
      var p = window.HandPart2.state(), M2 = window.HandModel2;
      row(t, 'Code and alcohol', p.code + ', ' + (p.info ? p.info.name : '–'));
      var b = p.bench;
      row(t, 'How it was run', b.started ? (b.enzymeMg + ' mg of Novozym 435, ' + b.vinyl + ' equiv of vinyl acetate, ' + b.tempC + ' °C, ' + (b.hexane || '–') + ' hexane; stopped at ' + (b.stopped === null ? '–' : b.stopped + ' h') + '; column in ' + (b.eluent || '–')) : 'not started');
      row(t, 'ee of the alcohol', (p.entries.ees || '–') + ' % (' + verdictOf('p2-ees-msg') + ')');
      row(t, 'ee of the acetate', (p.entries.eep || '–') + ' % (' + verdictOf('p2-eep-msg') + ')');
      row(t, 'Conversion', (p.entries.conv || '–') + ' % (' + verdictOf('p2-conv-msg') + ')');
      row(t, 'E', (p.entries.e || '–') + ' (' + verdictOf('p2-e-msg') + ')');
      row(t, 'Acetate yield / alcohol recovered', (p.entries.acyield || '–') + ' % (' + verdictOf('p2-acyield-msg') + ') / ' + (p.entries.alcyield || '–') + ' % (' + verdictOf('p2-alcyield-msg') + ')');
      row(t, 'Faster enantiomer (for the instructor to mark)', p.entries.faster ? '(' + p.entries.faster + ')' : 'not answered');
      row(t, 'The Kazlauskas rule (for the instructor to mark)', p.entries.rule || 'not answered');
      (b.warnings || []).forEach(function (w) { warnings.push(M2.TEXT[w] || w); });
    }
    box.appendChild(t);
    box.appendChild(el('h3', { 'class': 'routine-title' }, 'What the bench warned about'));
    if (!warnings.length) box.appendChild(el('p', {}, 'Nothing: no slips at the bench.'));
    else { var ul = el('ul'); warnings.forEach(function (w) { ul.appendChild(el('li', {}, w)); }); box.appendChild(ul); }
    $('report-date').textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  $('report-print').addEventListener('click', function () { summary(); window.print(); });
  window.addEventListener('beforeprint', summary);
  document.addEventListener('input', function () { window.clearTimeout(summary.t); summary.t = window.setTimeout(summary, 400); });
  document.addEventListener('click', function () { window.clearTimeout(summary.t); summary.t = window.setTimeout(summary, 400); });
  summary();
})();
