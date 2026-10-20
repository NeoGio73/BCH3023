/*
 * Introduction to Molecular Modeling: the controls under the 3D viewer, shared by the lab and the
 * prelab. MolModControls(viewer, { controls, readout, fullscreen, stage }) builds the buttons into
 * `controls`, writes what the pointer is on and each measurement into `readout`, and puts the
 * `fullscreen` element (the viewer with the questions beside it) into full screen.
 */
(function (root) {
  'use strict';

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'class') e.className = attrs[k];
      else if (k.indexOf('data-') === 0 || k.indexOf('aria-') === 0 || k === 'type' || k === 'title') e.setAttribute(k, attrs[k]);
      else e[k] = attrs[k];
    }
    if (text != null) e.textContent = text;
    return e;
  }

  // A row of buttons of which one (or none) is pressed.
  function group(label, items, onPick, opts) {
    opts = opts || {};
    var row = el('div', { class: 'tool-row' });
    row.appendChild(el('span', { class: 'tool-label' }, label));
    var box = el('div', { class: 'views', role: 'group', 'aria-label': label });
    var buttons = items.map(function (it) {
      var b = el('button', { type: 'button', class: 'view-button', 'data-key': it[0], 'aria-pressed': 'false' }, it[1]);
      b.addEventListener('click', function () {
        var was = b.getAttribute('aria-pressed') === 'true';
        var key = (was && opts.toggle) ? null : it[0];
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b && key !== null && !opts.momentary)); });
        onPick(key, it[0]);
      });
      box.appendChild(b);
      return b;
    });
    row.appendChild(box);
    row.press = function (key) {
      buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-key') === key)); });
    };
    return row;
  }

  function MolModControls(viewer, o) {
    var controls = o.controls, readout = o.readout;
    var pointLine = el('p', { class: 'readout-line', id: 'readout-point' }, 'Point at an atom (or tap it) to see its name.');
    var measureLine = el('p', { class: 'readout-line readout-measure', id: 'readout-measure' }, '');
    readout.appendChild(pointLine);
    readout.appendChild(measureLine);
    var listeners = { measure: [] };

    var style = group('Draw as', [['ballstick', 'Ball and stick'], ['sticks', 'Sticks'], ['spacefill', 'Spacefill'],
      ['cartoon', 'Cartoon'], ['cartoonsticks', 'Cartoon + sticks']], function (k) { viewer.style(k); });
    style.press('ballstick');

    var views = group('View', [['front', 'Front'], ['top', 'Top'], ['bottom', 'Bottom'], ['right', 'Right'],
      ['left', 'Left'], ['back', 'Back']], function (k) { viewer.view(k); spinBox.checked = false; });
    views.press('front');

    var toggles = el('div', { class: 'tool-row' });
    toggles.appendChild(el('span', { class: 'tool-label' }, 'Also'));
    var axesLabel = el('label', { class: 'check' });
    var axesBox = el('input', { type: 'checkbox', id: 'toggle-axes' });
    axesLabel.appendChild(axesBox); axesLabel.appendChild(document.createTextNode(' Show the axes'));
    axesBox.addEventListener('change', function () { viewer.axes(axesBox.checked); });
    var spinLabel = el('label', { class: 'check' });
    var spinBox = el('input', { type: 'checkbox', id: 'toggle-spin' });
    spinLabel.appendChild(spinBox); spinLabel.appendChild(document.createTextNode(' Spin'));
    spinBox.addEventListener('change', function () { viewer.spin(spinBox.checked); if (spinBox.checked) views.press(''); });
    toggles.appendChild(axesLabel); toggles.appendChild(spinLabel);

    var shows = group('Show', [['acidic', 'Acidic'], ['basic', 'Basic'], ['aromatic', 'Aromatic'],
      ['disulfides', 'Cysteines'], ['others', 'Other molecules']], function (k) {
        var n = viewer.show(k);
        if (k === 'others' && !n) pointLine.textContent = 'This file holds nothing but the protein chain.';
      }, { toggle: true });

    var measure = group('Measure', [['distance', 'Distance'], ['angle', 'Angle'], ['dihedral', 'Dihedral']], function (k) {
      viewer.measure(k);
      measureLine.textContent = k ? ({ distance: 'Click two atoms.', angle: 'Click three atoms: the angle is at the second.',
        dihedral: 'Click four atoms in a row along the bonds.' })[k] : '';
    }, { toggle: true });

    var sizes = el('div', { class: 'tool-row sizes' });
    function slider(id, label, value, onInput) {
      var wrap = el('label', { class: 'slider' });
      wrap.appendChild(el('span', { class: 'tool-label' }, label));
      var input = el('input', { type: 'range', id: id });
      input.min = 0; input.max = 100; input.value = value;
      input.addEventListener('input', function () { onInput(input.value / 100); });
      wrap.appendChild(input);
      return wrap;
    }
    sizes.appendChild(slider('atom-size', 'Atom size', 12, viewer.atomSize));
    sizes.appendChild(slider('bond-size', 'Bond size', 30, viewer.bondSize));

    var actions = el('div', { class: 'tool-row actions' });
    var whole = el('button', { type: 'button', class: 'quiet-button', id: 'whole-molecule' }, 'Whole molecule');
    whole.addEventListener('click', function () { viewer.whole(); shows.press(''); });
    var clear = el('button', { type: 'button', class: 'quiet-button', id: 'clear-measurements' }, 'Clear measurements');
    clear.addEventListener('click', function () { viewer.clearMeasurements(); measureLine.textContent = ''; });
    var full = el('button', { type: 'button', class: 'quiet-button', id: 'full-screen' }, 'Full screen');
    full.addEventListener('click', toggleFull);
    actions.appendChild(whole); actions.appendChild(clear); actions.appendChild(full);

    [style, views, toggles, shows, measure, sizes, actions].forEach(function (r) { controls.appendChild(r); });

    // ---- Full screen: the viewer and the questions beside it, together ----

    var box = o.fullscreen;
    function isFull() { return document.fullscreenElement === box || box.classList.contains('is-filled'); }
    function toggleFull() {
      if (isFull()) {
        if (document.fullscreenElement) document.exitFullscreen();
        box.classList.remove('is-filled');
      } else if (box.requestFullscreen && document.fullscreenEnabled) {
        box.requestFullscreen().catch(function () { box.classList.add('is-filled'); afterResize(); });
      } else {
        box.classList.add('is-filled');   // phones that allow full screen only for video
      }
      afterResize();
    }
    function afterResize() {
      full.textContent = isFull() ? 'Leave full screen' : 'Full screen';
      setTimeout(viewer.resize, 60);
      setTimeout(viewer.resize, 400);
    }
    document.addEventListener('fullscreenchange', afterResize);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('is-filled')) { box.classList.remove('is-filled'); afterResize(); }
    });
    window.addEventListener('resize', function () { viewer.resize(); });

    return {
      point: function (d) {
        pointLine.textContent = d.residue + ', atom ' + d.atom + ' (' + d.element + ', atom ' + d.serial + ' in the file)';
      },
      measured: function (m) {
        if (m.partial) { measureLine.textContent = m.partial + ' of ' + m.needed + ' atoms chosen.'; return; }
        var names = { distance: 'Distance', angle: 'Angle', dihedral: 'Dihedral angle' };
        measureLine.textContent = names[m.kind] + ' ' + m.atoms.join(' – ') + ': ' + m.text;
        listeners.measure.forEach(function (f) { f(m); });
      },
      onMeasure: function (f) { listeners.measure.push(f); },
      pressView: function (k) { views.press(k); if (k) viewer.view(k, 0); },
      pressStyle: function (k) { style.press(k); viewer.style(k); },
      pressShow: function (k) { shows.press(k || ''); },
      pressMeasure: function (k) { measure.press(k || ''); viewer.measure(k); },
      setAxes: function (on) { axesBox.checked = !!on; viewer.axes(!!on); }
    };
  }

  root.MolModControls = MolModControls;
  root.MolModUi = { el: el };
})(typeof self !== 'undefined' ? self : this);
