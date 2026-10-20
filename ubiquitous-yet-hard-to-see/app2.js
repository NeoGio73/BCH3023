/* Ubiquitous, Yet Hard to See: Session 2 (the page opened with ?part=2).
 * The NOEs and the bundles, the binding titrations, the crystal plate, the routine in the X-ray room,
 * the diffraction frame, the electron density and the B-factors, the three structures compared, and
 * where the field is now. Runs after app.js and uses its helpers (window.UbiqLab.core).
 */
(function () {
  'use strict';
  var L = window.UbiqLab;
  if (!L || L.part !== 2) { window.UbiqLab2 = null; return; }
  var C = L.core, D = C.D, M = C.M, $ = C.$, el = C.el, S = window.UbiqStructures;
  var state = L.state();
  var P2 = M.picks2(D, state.code);
  var INK = '#17211e', SOFT = '#74807c', BLUE = '#1c4c9a', RED = '#ab2a1c', ORANGE = '#d9822b', GREEN = '#1b7a40';
  if (state.selDrop === undefined) state.selDrop = -1;
  function res(n) { var r = D.residues[n - 1]; return r.aa + n; }
  var NAMES3 = { A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val' };
  function res3(n) { return NAMES3[D.residues[n - 1].aa] + n; }

  // ---- The X-ray room's routine ---------------------------------------------------------------

  function xact(what) {
    var r = M.xstep(state.xray, P2.plate, what);
    if (!r.ok) { C.note(M.routineText(r.reason), 'blocked'); showRoutine(); return false; }
    C.note('');
    state.xray = r.state;
    var verb = what.split(' ')[0];
    var go = { fish: 'crystals', freeze: 'crystals', open: 'inside', mount: 'inside', centre: 'inside', close: 'diffractometer', xrays: 'diffractometer', collect: 'xdesk' }[verb];
    if (go) C.setView(go);
    if (verb === 'collect') { state.recorded.frame = true; C.note('A frame collected: it is in its part below.', 'info'); C.showFigures(); }
    C.showRoom();
    showRoutine();
    C.saveState();
    return true;
  }

  function showRoutine() {
    var list = $('routine-xray'); if (!list) return;
    list.textContent = '';
    var x = state.xray, dropName = state.selDrop >= 0 ? 'drop ' + dropLabel(state.selDrop) : 'a drop';
    var steps = [
      ['Fish a crystal', 'Under the microscope, a nylon loop on a pin lifts a single crystal out of its drop, in a film of the drop’s liquid.', !!x.crystal, !x.crystal, [['Fish from ' + dropName, 'fish ' + state.selDrop]]],
      ['Freeze it', 'Plunged into liquid nitrogen in the foam dewar, it freezes in a moment; frozen, it survives the beam for hours.', x.crystal === 'frozen' || x.crystal === 'mounted', x.crystal === 'loop', [['Into the nitrogen', 'freeze']]],
      ['Open the doors', 'The cabinet’s doors open only with the X-rays off.', x.doors || x.crystal === 'mounted' && !x.doors && x.centred, x.crystal === 'frozen' && !x.doors, [[x.doors ? 'Close them' : 'Open them', x.doors ? 'close' : 'open']]],
      ['Mount it on the goniometer', 'The pin goes onto the magnetic head, in the cold stream at 100 K, before the crystal can warm.', x.crystal === 'mounted', x.crystal === 'frozen' && x.doors, [['Mount it', 'mount']]],
      ['Centre it in the beam', 'With the camera, the crystal is turned and moved until it sits at the rings’ centre in every turn.', x.centred, x.crystal === 'mounted' && !x.centred, [['Centre it', 'centre']]],
      ['Close the doors, X-rays on', 'The lamps on the cabinet light while the X-rays are on.', x.xrays, x.centred && !x.xrays, [['Close the doors', 'close'], ['X-rays on', 'xrays']]],
      ['Collect a frame', 'The crystal turns half a degree while the detector counts the scattered X-rays: one frame of the hundreds of a full data set.', x.collected, x.xrays && !x.collected, [['Collect', 'collect'], ['X-rays off', 'xraysoff']]]
    ];
    steps.forEach(function (s) {
      var li = el('li', { 'class': 'routine-step', 'data-state': s[2] ? 'done' : s[3] ? 'next' : '' });
      li.appendChild(el('span', { 'class': 'routine-name' }, s[0]));
      li.appendChild(el('span', { 'class': 'routine-why' }, s[1]));
      var b = el('span', { 'class': 'routine-buttons' });
      s[4].forEach(function (x2) { var btn = el('button', { type: 'button', 'class': 'quiet-button' }, x2[0]); btn.addEventListener('click', function () { xact(x2[1]); }); b.appendChild(btn); });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  var HOVER = {
    microscope: function () { return 'Click the microscope to look at the plate'; },
    plate: function () { return state.selDrop >= 0 ? 'Click the plate to fish a crystal from drop ' + dropLabel(state.selDrop) : 'Choose a drop on the page first (part 4), then click the plate'; },
    dewar: function () { return 'Click the foam dewar of liquid nitrogen to freeze the crystal'; },
    doors: function () { return state.xray.xrays ? 'The doors are locked while the X-rays are on' : 'Click the doors to ' + (state.xray.doors ? 'close' : 'open') + ' them'; },
    goniometer: function () { return state.xray.crystal === 'mounted' ? 'Click the goniometer to centre the crystal' : 'Click the goniometer to mount the crystal'; },
    xraybutton: function () { return 'Click to switch the X-rays ' + (state.xray.xrays ? 'off' : 'on'); },
    xcomputer: function () { return 'Click the computer to collect a frame'; }
  };
  function click(item) {
    var x = state.xray;
    if (item === 'microscope') C.setView('crystals');
    else if (item === 'plate') xact('fish ' + state.selDrop);
    else if (item === 'dewar') xact('freeze');
    else if (item === 'doors') xact(x.doors ? 'close' : 'open');
    else if (item === 'goniometer') xact(x.crystal === 'mounted' ? 'centre' : 'mount');
    else if (item === 'xraybutton') xact(x.xrays ? 'xraysoff' : 'xrays');
    else if (item === 'xcomputer') xact('collect');
  }

  // ---- 3Dmol helpers ------------------------------------------------------------------------------

  var texts = {};
  function load(name) {
    if (!texts[name]) texts[name] = fetch('structures/' + name).then(function (r) { return r.text(); });
    return texts[name];
  }
  function viewer(id) {
    if (!window.$3Dmol) { $(id).textContent = 'The 3D viewer did not load (it needs an internet connection).'; return null; }
    return window.$3Dmol.createViewer($(id), { backgroundColor: 'white' });
  }

  // ---- 1: NOEs, the bundle, the ensemble --------------------------------------------------------

  var noeV = null, mode = 'noe';
  function showNoe() {
    if (!noeV) noeV = viewer('noe-viewer');
    if (!noeV) return;
    var n = P2.noe;
    noeV.clear();
    if (mode === 'noe') {
      load('nmr.pdb').then(function (text) {
        noeV.addModel(text, 'pdb', { keepH: true });      // the NOEs are between hydrogens
        noeV.setStyle({}, { cartoon: { color: '#c9d6d1', opacity: 0.85 } });
        noeV.setStyle({ elem: 'H' }, {});
        noeV.setStyle({ resi: n }, { cartoon: { color: BLUE }, stick: { color: BLUE, radius: 0.18 } });
        var me = noeV.selectedAtoms({ resi: n, atom: 'H' })[0];
        (D.residues[n - 1].noe || []).forEach(function (x) {
          var other = noeV.selectedAtoms({ resi: x[2], atom: x[3] })[0];
          if (!me || !other) return;
          var far = Math.abs(x[2] - n) >= 5;
          noeV.addCylinder({ start: { x: me.x, y: me.y, z: me.z }, end: { x: other.x, y: other.y, z: other.z }, radius: 0.13, color: far ? RED : ORANGE, fromCap: 1, toCap: 1 });
          if (far) noeV.setStyle({ resi: x[2] }, { cartoon: { color: '#e9b4ab' }, stick: { color: RED, radius: 0.12 } });
        });
        noeV.zoomTo({ resi: n }); noeV.zoom(0.45); noeV.render();
      });
      $('noe-caption').textContent = 'Your residue, ' + res3(n) + ' (blue), and every proton within 5 Å of its amide proton: orange lines to residues close along the chain, red lines (and red side chains) to residues five or more away.';
      $('bundle-note').textContent = '';
    } else if (mode === 'bundle') {
      load('bundle.pdb').then(function (text) {
        noeV.addModels(text, 'pdb');
        noeV.setStyle({}, { cartoon: { color: '#7d8894', thickness: 0.2, opacity: 0.9 } });
        P2.spreadPair.forEach(function (k, i) { noeV.setStyle({ resi: k }, { cartoon: { color: i ? ORANGE : BLUE } }); });
        noeV.zoomTo(); noeV.render();
      });
      $('noe-caption').textContent = 'The ten models of the NMR structure, laid on one another. ' + res3(P2.spreadPair[0]) + ' in blue, ' + res3(P2.spreadPair[1]) + ' in orange.';
      $('bundle-note').textContent = 'The bundle is tight because it was refined with residual dipolar couplings, which fix the bonds’ directions; it shows how well the structure is defined, not how much the protein moves.';
    } else {
      load('ensemble.pdb').then(function (text) {
        noeV.addModels(text, 'pdb');
        noeV.setStyle({}, { line: { color: '#7d8894', opacity: 0.5 } });
        noeV.zoomTo(); noeV.render();
      });
      $('noe-caption').textContent = 'PDB 2K39 (Lange and colleagues, 2008): 116 models chosen to match how the protein moves on time scales up to microseconds, drawn as Cα traces.';
      $('bundle-note').textContent = 'Here the spread is motion: the loops and the tail move, and the parts that move most are the ones ubiquitin’s partners grip.';
    }
    document.querySelectorAll('[data-bundle]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-bundle') === mode ? 'true' : 'false'); });
  }

  // ---- 2: binding ------------------------------------------------------------------------------------

  var H_HI = 10.0, H_LO = 5.8, N_LO = 101, N_HI = 135, bindV = null;
  function drawBind() {
    var partner = state.bindPartner, have = state.recorded[partner];
    if (!have) { partner = state.recorded.sh3a ? 'sh3a' : 'sh3c'; state.bindPartner = partner; }
    $('bind-partner').value = partner;
    var ratio = +state.bindRatio, fb = M.fractionBound(200, 200 * ratio, D.partners[partner].kdMicromolar);
    $('bind-ratio').value = String(ratio);
    $('bind-ratio-out').textContent = ratio.toFixed(2) + ' : 1, ' + Math.round(fb * 100) + '% bound';
    var c = $('bind-canvas'), f = C.frame2d(c, H_HI, H_LO, N_LO, N_HI, '¹H (ppm)', '¹⁵N (ppm)', true), hits = [], free = {};
    M.amidePeaks(D).forEach(function (p) { free[p.n] = { x: f.x(p.H), y: f.y(p.N) }; C.blob(f, f.x(p.H), f.y(p.N), 6, '#c9d3e6', 1); });
    M.titratedPeaks(D, partner, fb).forEach(function (p) {
      var x = f.x(p.H), y = f.y(p.N);
      C.blob(f, x, y, 7, BLUE, 1);
      if (p.n === P2.mover && partner === P2.partner) { f.g.strokeStyle = RED; f.g.lineWidth = 3; f.g.beginPath(); f.g.ellipse(x, y, 14, 16, 0, 0, 2 * Math.PI); f.g.stroke(); }
      hits.push({ x: x, y: y, x0: free[p.n].x, y0: free[p.n].y, p: p, fb: fb });
    });
    C.hitList(c, hits);
    showBindStructure(partner);
  }
  function showBindStructure(partner) {
    if (!bindV) bindV = viewer('bind-viewer');
    if (!bindV) return;
    load('xray.pdb').then(function (text) {
      bindV.clear(); bindV.addModel(text, 'pdb');
      bindV.setStyle({}, { cartoon: { colorfunc: function (atom) {
        var cs = M.combinedShift(D, partner, atom.resi);
        if (cs === null || cs < 0.05) return '#d5dbd8';
        var t = Math.min(1, (cs - 0.05) / 0.25);
        var r = Math.round(240 - 70 * t), g = Math.round(200 - 170 * t), b = Math.round(190 - 165 * t);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
      } } });
      bindV.zoomTo(); bindV.render();
    });
  }

  // ---- 3: the plate --------------------------------------------------------------------------------

  function dropLabel(i) { return 'ABCD'.charAt(Math.floor(i / 6)) + (i % 6 + 1); }
  function drawDrop(g, kind, size, seed) {
    var s = size, cx = s / 2, cy = s / 2, rr = s * 0.42, rnd = seed;
    function rand() { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; }
    g.fillStyle = '#e9ecef'; g.fillRect(0, 0, s, s);
    var grad = g.createRadialGradient(cx - rr * 0.3, cy - rr * 0.3, rr * 0.1, cx, cy, rr);
    grad.addColorStop(0, '#fbfcfd'); grad.addColorStop(1, '#d6dde4');
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, rr, 0, 2 * Math.PI); g.fill();
    g.strokeStyle = '#aab4bd'; g.lineWidth = Math.max(1, s / 120); g.stroke();
    if (kind === 'precipitate') { for (var i = 0; i < 260; i++) { var a = rand() * 6.283, d = Math.sqrt(rand()) * rr * 0.9; g.fillStyle = 'rgba(120,90,50,' + (0.25 + rand() * 0.5) + ')'; g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s / 90 + rand() * s / 120, s / 90 + rand() * s / 120); } }
    if (kind === 'micro') { for (var j = 0; j < 160; j++) { var a2 = rand() * 6.283, d2 = Math.sqrt(rand()) * rr * 0.85; g.fillStyle = 'rgba(160,190,220,0.9)'; g.beginPath(); g.arc(cx + Math.cos(a2) * d2, cy + Math.sin(a2) * d2, s / 160, 0, 6.283); g.fill(); } }
    if (kind === 'skin') { g.strokeStyle = 'rgba(150,140,120,0.7)'; g.lineWidth = s / 80; for (var k = 0; k < 6; k++) { g.beginPath(); g.arc(cx + (rand() - 0.5) * rr, cy + (rand() - 0.5) * rr, rr * (0.3 + rand() * 0.4), rand() * 6, rand() * 6 + 1.5); g.stroke(); } }
    function crystal(x, y, w, ang) {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = 'rgba(170,205,235,0.85)'; g.strokeStyle = 'rgba(60,100,150,0.9)'; g.lineWidth = Math.max(1, s / 200);
      g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w * 0.5, -w * 0.6); g.lineTo(w * 0.5, -w * 0.6); g.lineTo(w, 0); g.lineTo(w * 0.5, w * 0.6); g.lineTo(-w * 0.5, w * 0.6); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    if (kind === 'cluster') { for (var q = 0; q < 7; q++) crystal(cx + (rand() - 0.5) * rr * 0.4, cy + (rand() - 0.5) * rr * 0.4, s * (0.05 + rand() * 0.05), rand() * 3); }
    if (kind === 'crystal') crystal(cx + (rand() - 0.5) * rr * 0.6, cy + (rand() - 0.5) * rr * 0.6, s * 0.11, rand() * 3);
  }
  function buildPlate() {
    var box = $('plate'); box.textContent = '';
    P2.plate.forEach(function (kind, i) {
      var b = el('button', { type: 'button', 'class': 'drop', 'aria-label': 'Drop ' + dropLabel(i) });
      var cv = el('canvas', { width: '80', height: '80' });
      drawDrop(cv.getContext('2d'), kind, 80, 17 + i * 31);
      b.appendChild(cv); b.appendChild(el('span', null, dropLabel(i)));
      if (state.selDrop === i) b.setAttribute('aria-pressed', 'true');
      b.addEventListener('click', function () { state.selDrop = i; C.saveState(); buildPlate(); showDrop(); showRoutine(); showChecks(); });
      box.appendChild(b);
    });
  }
  function showDrop() {
    var c = $('drop-canvas'), g = c.getContext('2d'), i = state.selDrop;
    g.clearRect(0, 0, c.width, c.height);
    if (i < 0) { $('drop-text').textContent = 'Click a drop.'; return; }
    drawDrop(g, P2.plate[i], c.width, 17 + i * 31);
    $('drop-text').textContent = 'Drop ' + dropLabel(i) + ' under the microscope: ' + M.DROP_TEXT[P2.plate[i]];
    $('q2-drop-show').textContent = state.xray.drop >= 0 ? 'drop ' + dropLabel(state.xray.drop) : 'none yet (choose one, then fish from it in the room)';
  }

  // ---- 4: the frame -------------------------------------------------------------------------------

  function drawFrame() {
    var c = $('frame-canvas'), g = c.getContext('2d'), W = c.width, mid = W / 2, half = 60;      // the detector: 120 mm across
    var mm = function (v) { return (v / half) * (W / 2 - 30); };
    g.fillStyle = '#1b1d22'; g.fillRect(0, 0, W, W);
    var rnd = 12345; function rand() { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; }
    for (var i = 0; i < 900; i++) {
      var a = rand() * 6.283, r = Math.sqrt(rand()) * P2.spotMm;
      var bright = 1 - 0.75 * (r / P2.spotMm) + 0.25 * rand();
      g.fillStyle = 'rgba(255,' + Math.round(200 + 55 * bright) + ',' + Math.round(120 * bright) + ',' + Math.min(1, 0.35 + bright) + ')';
      g.beginPath(); g.arc(mid + mm(r * Math.cos(a)), mid + mm(r * Math.sin(a)), 1.2 + 1.8 * bright, 0, 6.283); g.fill();
    }
    g.fillStyle = '#000'; g.beginPath(); g.arc(mid, mid, mm(4), 0, 6.283); g.fill();      // the beamstop's shadow
    g.fillRect(mid - mm(1), mid, mm(2), W);
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '18px system-ui, sans-serif'; g.textAlign = 'center';
    for (var t = -60; t <= 60; t += 10) { g.beginPath(); g.moveTo(mid + mm(t), W - 26); g.lineTo(mid + mm(t), W - 16); g.stroke(); g.fillText(String(t), mid + mm(t), W - 2 - 0); }
    $('frame-caption').textContent = 'One frame on the detector, its scale in millimetres from the beam’s centre (the shadow is the beamstop and its arm). The detector is ' + P2.detectorMm + ' mm from the crystal.';
  }

  // ---- 5: maps and B-factors ---------------------------------------------------------------------

  var MAP_LABELS = ['Map 1', 'Map 2', 'Map 3'];
  function dx(m, res) {
    var bytes = atob(m.maps[String(res)]), n = m.n, out = [];
    out.push('object 1 class gridpositions counts ' + n + ' ' + n + ' ' + n);
    out.push('origin ' + m.origin.join(' '));
    out.push('delta ' + m.step + ' 0 0'); out.push('delta 0 ' + m.step + ' 0'); out.push('delta 0 0 ' + m.step);
    out.push('object 2 class gridconnections counts ' + n + ' ' + n + ' ' + n);
    out.push('object 3 class array type double rank 0 items ' + (n * n * n) + ' data follows');
    var line = [];
    for (var i = 0; i < bytes.length; i++) { line.push(bytes.charCodeAt(i)); if (line.length === 3) { out.push(line.join(' ')); line = []; } }
    if (line.length) out.push(line.join(' '));
    return out.join('\n');
  }
  function buildMaps() {
    var box = $('maps'), qs = $('map-questions'), m = S.maps[String(P2.mapResidue)];
    box.textContent = ''; qs.textContent = '';
    if (!state.answers.maps) state.answers.maps = ['', '', ''];
    P2.mapOrder.forEach(function (k, i) {
      var wrap = el('figure', { 'class': 'map-fig' });
      var v = el('div', { 'class': 'viewer small-viewer', id: 'map-' + i }); wrap.appendChild(v);
      wrap.appendChild(el('figcaption', { 'class': 'soft' }, MAP_LABELS[i] + ': the density round ' + res3(P2.mapResidue) + ' and its neighbours, with the atoms built into it.'));
      box.appendChild(wrap);
      var p = el('p', { 'class': 'q-text' }, MAP_LABELS[i] + ' is at'); qs.appendChild(p);
      var cell = el('p'), sel = el('select', { id: 'q2-map-' + i });
      [['', 'Choose'], ['3.5', '3.5 Å'], ['2.5', '2.5 Å'], ['1.5', '1.5 Å']].forEach(function (o) { sel.appendChild(el('option', { value: o[0] }, o[1])); });
      sel.value = state.answers.maps[i] || '';
      sel.addEventListener('change', function () { state.answers.maps[i] = sel.value; C.saveState(); showChecks(); });
      cell.appendChild(sel); if (i === 2) cell.appendChild(el('span', { 'class': 'msg', id: 'q2-maps-msg' })); qs.appendChild(cell);
      var vw = viewer('map-' + i); if (!vw) return;
      load('xray.pdb').then(function (text) {
        vw.addModel(text, 'pdb');
        var vol = new window.$3Dmol.VolumeData(dx(m, S.resolutions[k]), 'dx');
        // contoured so that the residue sits inside its density, as a map is drawn to build into: at a
        // little under half the density at the residue's own atoms (the middle of them)
        var region = vw.selectedAtoms({ resi: P2.mapResidue });
        var at = region.map(function (q) { return vol.getVal(q.x, q.y, q.z); }).sort(function (u, w) { return u - w; });
        var level = 0.45 * at[Math.floor(at.length / 2)];
        vw.addIsosurface(vol, { isoval: level, color: '#3b6fd6', wireframe: true, opacity: 0.9, selectedRegion: region, selectedOffset: 2.4 });
        vw.setStyle({}, {});
        vw.setStyle({ resi: P2.mapResidue }, { stick: { radius: 0.12, colorscheme: 'grayCarbon' } });
        vw.zoomTo({ resi: P2.mapResidue }); vw.render();
      });
    });
  }
  var bV = null;
  function showB() {
    if (!bV) bV = viewer('b-viewer'); if (!bV) return;
    load('xray.pdb').then(function (text) {
      bV.clear(); bV.addModel(text, 'pdb');
      bV.setStyle({}, { cartoon: { colorscheme: { prop: 'b', gradient: 'rwb', min: 30, max: 2 } } });
      P2.bPair.forEach(function (n) {
        bV.setStyle({ resi: n }, { cartoon: { colorscheme: { prop: 'b', gradient: 'rwb', min: 30, max: 2 } }, stick: { colorscheme: { prop: 'b', gradient: 'rwb', min: 30, max: 2 }, radius: 0.2 } });
        var a = bV.selectedAtoms({ resi: n, atom: 'CA' })[0];
        if (a) bV.addLabel(res3(n), { position: a, backgroundColor: '#ffffff', fontColor: '#17211e', fontSize: 12, backgroundOpacity: 0.85 });
      });
      bV.zoomTo(); bV.render();
    });
  }

  // ---- 6: the three structures ---------------------------------------------------------------------

  var cV = null;
  function showCompare() {
    if (!cV) cV = viewer('compare-viewer'); if (!cV) return;
    Promise.all([load('xray.pdb'), load('nmr.pdb'), load('alphafold.pdb')]).then(function (t) {
      cV.clear();
      [[t[0], BLUE], [t[1], ORANGE], [t[2], GREEN]].forEach(function (x, i) { var mdl = cV.addModel(x[0], 'pdb'); cV.setStyle({ model: i }, { cartoon: { color: x[1], thickness: 0.3, opacity: 0.85 } }); });
      cV.zoomTo(); cV.render();
    });
    var tb = $('rmsd-table').querySelector('tbody'); tb.textContent = '';
    [['Crystal and NMR', S.rmsd.nmr_xray], ['Crystal and AlphaFold', S.rmsd.af_xray], ['NMR and AlphaFold', S.rmsd.af_nmr]].forEach(function (row) {
      var tr = el('tr'); tr.appendChild(el('th', { scope: 'row' }, row[0])); tr.appendChild(el('td', null, row[1][0].toFixed(2) + ' Å')); tr.appendChild(el('td', null, row[1][1].toFixed(2) + ' Å')); tb.appendChild(tr);
    });
  }

  // ---- Questions -----------------------------------------------------------------------------------

  var MOST = [['', 'Choose'], ['xray', 'X-ray crystallography'], ['em', 'Electron microscopy'], ['nmr', 'NMR'], ['af', 'Prediction (AlphaFold)']];
  var MDA = [['', 'Choose'], ['methyl', 'Labelling only the methyls of Ile, Leu and Val, in an otherwise deuterated protein, with TROSY'], ['field', 'A stronger magnet alone'], ['cryo', 'A cryogenically cooled probe alone'], ['15n', 'Labelling with ¹⁵N alone']];
  function choice(id, opts) { var s = $(id); s.textContent = ''; opts.forEach(function (o) { s.appendChild(el('option', { value: o[0] }, o[1])); }); }
  function pairChoice(id, pair) { choice(id, [['', 'Choose']].concat(pair.map(function (n) { return [String(n), res3(n)]; }))); }
  var Q2 = [
    { id: 'q2-long', check: function (v) { return M.checkLongRange(D, P2.noe, v); } },
    { id: 'q2-spread', check: function (v) { return M.checkSpread(D, P2.spreadPair, v); } },
    { id: 'q2-shift', check: function (v) { return M.checkShift(D, P2.partner, P2.mover, v); } },
    { id: 'q2-topa', check: function (v) { return M.checkTopMover(D, 'sh3a', v); } },
    { id: 'q2-topc', check: function (v) { return M.checkTopMover(D, 'sh3c', v); } },
    { id: 'q2-res', check: function (v) { return M.checkResolution(P2, v); } },
    { id: 'q2-ordered', check: function (v) { return M.checkOrdered(D, P2.bPair, v); } },
    { id: 'q2-most', check: function (v) { return v ? (v === 'xray' ? { ok: true, kind: 'good', text: 'Accepted.' } : { ok: false, kind: 'off', text: 'Not yet: look at the numbers for 2025.' }) : { ok: false, kind: 'empty', text: '' }; } },
    { id: 'q2-mda', check: function (v) { return v ? (v === 'methyl' ? { ok: true, kind: 'good', text: 'Accepted.' } : { ok: false, kind: 'off', text: 'Not this alone: see “Bigger proteins”.' }) : { ok: false, kind: 'empty', text: '' }; } }
  ];
  function showChecks() {
    Q2.forEach(function (q) {
      var input = $(q.id); if (!input) return;
      var v = q.check(input.value), m = $(q.id + '-msg');
      if (m) { m.textContent = v.kind === 'empty' ? '' : v.text; m.setAttribute('data-kind', v.kind); }
    });
    var dv = state.xray.drop >= 0 ? M.checkDrop(P2.plate, state.xray.drop) : { kind: 'empty', text: '' };
    $('q2-drop-msg').textContent = dv.kind === 'empty' ? '' : dv.text; $('q2-drop-msg').setAttribute('data-kind', dv.kind || '');
    var mv = M.checkMapOrder(P2.mapOrder, state.answers.maps || ['', '', '']), mm = $('q2-maps-msg');
    if (mm) { mm.textContent = mv.kind === 'empty' ? '' : mv.text; mm.setAttribute('data-kind', mv.kind); }
    C.showFooter();
  }
  function bindQuestions() {
    pairChoice('q2-spread', P2.spreadPair); pairChoice('q2-ordered', P2.bPair); choice('q2-most', MOST); choice('q2-mda', MDA);
    var bp = $('bind-partner'); bp.textContent = '';
    [['sh3a', 'SH3-A (sample D)'], ['sh3c', 'SH3-C (sample E)']].forEach(function (o) { bp.appendChild(el('option', { value: o[0] }, o[1])); });
    Q2.forEach(function (q) {
      var input = $(q.id); if (!input) return;
      if (state.answers[q.id] !== undefined) input.value = state.answers[q.id];
      input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', function () { state.answers[q.id] = input.value; C.saveState(); showChecks(); });
    });
    $('own-mover').textContent = res3(P2.mover);
    $('own-partner').textContent = P2.partner === 'sh3a' ? 'SH3-A' : 'SH3-C';
    $('own-dist').textContent = String(P2.detectorMm);
    $('own-spot').textContent = P2.spotMm.toFixed(1);
    document.querySelectorAll('[data-bundle]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-bundle'); showNoe(); }); });
    bp.addEventListener('change', function () {
      if (!state.recorded[bp.value]) { C.note('Record that titration first (sample ' + (bp.value === 'sh3a' ? 'D' : 'E') + ').', 'blocked'); bp.value = state.bindPartner; return; }
      state.bindPartner = bp.value; C.saveState(); drawBind();
    });
    $('bind-ratio').addEventListener('input', function () { state.bindRatio = +$('bind-ratio').value; C.saveState(); drawBind(); });
    $('bind-canvas').addEventListener('click', function (ev) {
      var h = C.hitAt($('bind-canvas'), ev);
      $('bind-read').textContent = h ? res(h.p.n) + ' at ' + Math.round(h.fb * 100) + '% bound: ¹H ' + h.p.H.toFixed(3) + ' ppm, ¹⁵N ' + h.p.N.toFixed(2) + ' ppm' : 'Click a peak to read its shifts.';
    });
    // pointing at a peak: its two shifts, and a dotted line back to where it was before any partner was added
    C.pointable($('bind-canvas'), function (g, f, h) {
      if (Math.abs(h.x - h.x0) + Math.abs(h.y - h.y0) > 3) { C.dots(g, h.x0, h.y0, h.x, h.y); C.ringAt(g, h.x0, h.y0, 11, true); }
      C.ringAt(g, h.x, h.y, 13);
      C.toAxes(g, f, h.x, h.y, h.p.H.toFixed(3), h.p.N.toFixed(2));
    });
  }

  function showFigures() {
    document.querySelectorAll('[data-needs-any]').forEach(function (w) { w.hidden = w.getAttribute('data-needs-any').split(' ').some(function (k) { return state.recorded[k]; }); });
    document.querySelectorAll('[data-shows-any]').forEach(function (f) { f.hidden = !f.getAttribute('data-shows-any').split(' ').some(function (k) { return state.recorded[k]; }); });
    if (state.recorded.sh3a || state.recorded.sh3c) drawBind();
    if (state.recorded.frame) drawFrame();
    showDrop();
  }

  function footer() {
    var good = Q2.filter(function (q) { return $(q.id) && q.check($(q.id).value).ok; }).length
      + (state.xray.drop >= 0 && M.checkDrop(P2.plate, state.xray.drop).ok ? 1 : 0)
      + (M.checkMapOrder(P2.mapOrder, state.answers.maps || ['', '', '']).ok ? 1 : 0);
    var recs = ['sh3a', 'sh3c', 'frame'].filter(function (k) { return state.recorded[k]; }).length;
    return 'Code ' + state.code + ', Session 2. The page accepted ' + good + ' of ' + (Q2.length + 2) + ' answers; recorded: ' + recs + ' of 3 (two titrations and a frame).';
  }

  window.UbiqLab2 = {
    click: click, hover: function (item) { return HOVER[item] ? HOVER[item]() : ''; }, showRoutine: showRoutine, showFigures: showFigures, footer: footer,
    picks: function () { return P2; }, xact: xact
  };

  bindQuestions();
  buildPlate();
  showRoutine();
  showNoe();
  buildMaps();
  showB();
  showCompare();
  showFigures();
  showChecks();
})();
