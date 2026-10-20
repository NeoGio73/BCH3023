/* Introduction to Molecular Modeling: the prelab, glucagon worked out. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  [].forEach.call(document.querySelectorAll('.reveal'), function (b) {
    b.addEventListener('click', function () {
      var a = $(b.getAttribute('data-answer'));
      a.hidden = !a.hidden;
      b.textContent = a.hidden ? (b.getAttribute('data-label') || 'Show the answer') : 'Hide the answer';
    });
    b.setAttribute('data-label', b.textContent);
  });

  if (!window.$3Dmol) {
    $('stage-status').textContent = 'The 3D viewer needs an internet connection. Connect and reload the page.';
    return;
  }
  var controls;
  var viewer = window.MolModViewer($('stage'), {
    onPoint: function (d) { controls && controls.point(d); },
    onMeasure: function (m) { controls && controls.measured(m); }
  });
  controls = window.MolModControls(viewer, { controls: $('tools'), readout: $('readout'), fullscreen: $('bench') });

  fetch('1gcn.pdb').then(function (r) { return r.text(); }).then(function (text) {
    $('pdb-text').textContent = text;
    viewer.load(text);
    $('stage-cover').hidden = true;
    window.MolModPrelab = { viewer: viewer };
  }).catch(function () { $('stage-status').textContent = 'Glucagon\'s file did not load. Reload the page.'; });

  $('take-ends').addEventListener('click', function () { viewer.focus([1, 29]); controls.pressShow(null); });
  $('take-nterm').addEventListener('click', function () { viewer.focus([1, 2, 3], { labels: true }); });
  $('take-cterm').addEventListener('click', function () { viewer.focus([27, 28, 29], { labels: true }); });
  $('take-helix').addEventListener('click', function () { controls.pressStyle('cartoonsticks'); controls.pressView(''); viewer.downHelix(6, 26); });
  $('take-trp').addEventListener('click', function () {
    controls.pressStyle('cartoon');
    controls.pressView('front');
    viewer.focus([25], { labels: true });
  });
  $('take-angle').addEventListener('click', function () {
    viewer.focus([6], { labels: true });
    controls.pressMeasure('angle');
    $('readout-measure').textContent = 'Click three atoms: N, then CA, then C.';
  });
})();
