/*
 * Introduction to Molecular Modeling: the 3D viewer shared by the lab and the prelab.
 * Drawn with 3Dmol.js (loaded by the page). Nothing here knows which protein is shown.
 *
 *   var v = MolModViewer(element, { onPoint, onMeasure, onPick })
 *   v.load(pdbText)        v.style('ballstick' | 'sticks' | 'spacefill' | 'cartoon' | 'cartoonsticks')
 *   v.atomSize(0..1)       v.bondSize(0..1)        v.spin(on)        v.axes(on)
 *   v.view('front' | 'top' | ...)                  v.whole()
 *   v.show(kind)           kind: 'acidic' | 'basic' | 'aromatic' | 'disulfides' | 'others' | null
 *   v.focus(residueNumbers, opts)                  v.downHelix(start, end)
 *   v.measure('distance' | 'angle' | 'dihedral' | null)        v.clearMeasurements()
 *
 * Views: the molecule's own x, y and z axes, as in Jmol. Front looks down -z (x to the right,
 * y up, +z toward the viewer); Top brings +y toward the viewer, Right +x, and so on.
 */
(function (root) {
  'use strict';

  var REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ms(t) { return REDUCED ? 0 : t; }

  var S = Math.SQRT1_2;
  // The quaternion (x, y, z, w) that turns the molecule for each view.
  var TURN = {
    front: [0, 0, 0, 1],
    back: [0, 1, 0, 0],
    top: [S, 0, 0, S],      // +90 degrees about x: +y comes toward the viewer
    bottom: [-S, 0, 0, S],
    right: [0, -S, 0, S],   // -90 degrees about y: +x comes toward the viewer
    left: [0, S, 0, S]
  };

  var ELEMENT_NAMES = { C: 'carbon', N: 'nitrogen', O: 'oxygen', S: 'sulfur', H: 'hydrogen', FE: 'iron',
    CU: 'copper', ZN: 'zinc', CA: 'calcium', MG: 'magnesium', NA: 'sodium', CL: 'chlorine', P: 'phosphorus',
    CD: 'cadmium', K: 'potassium', PT: 'platinum', PB: 'lead', LI: 'lithium', I: 'iodine', SE: 'selenium' };
  var WATER = ['HOH', 'DOD', 'WAT'];

  function titleCase(s) { return s ? s.charAt(0) + s.slice(1).toLowerCase() : ''; }

  function MolModViewer(element, opts) {
    opts = opts || {};
    var $3Dmol = root.$3Dmol;
    var v = $3Dmol.createViewer(element, { backgroundColor: 'white', antialias: true });
    var model = null, atoms = [];
    var state = { style: 'ballstick', atomSize: 0.12, bondSize: 0.3, axes: false, show: null,
                  focus: null, measure: null, spinning: false };
    var picks = [], pickShapes = [], measurements = [];
    var axisShapes = [], axisLabels = [], focusLabels = [];
    var hoverLabel = null;

    function center() {
      var c = { x: 0, y: 0, z: 0 }, n = 0;
      atoms.forEach(function (a) { if (!a.hetflag || true) { c.x += a.x; c.y += a.y; c.z += a.z; n++; } });
      return n ? { x: c.x / n, y: c.y / n, z: c.z / n } : c;
    }
    function extent() {
      var c = center(), r = 0;
      atoms.forEach(function (a) { r = Math.max(r, Math.sqrt(Math.pow(a.x - c.x, 2) + Math.pow(a.y - c.y, 2) + Math.pow(a.z - c.z, 2))); });
      return r;
    }

    // ---- Drawing styles ----

    function sphereScale() { return 0.12 + state.atomSize * 0.88; }   // 0.12 to 1.0 of the van der Waals radius
    function stickRadius() { return 0.06 + state.bondSize * 0.34; }   // 0.06 to 0.40 angstrom

    function baseStyle(dim) {
      var scheme = dim ? { colorscheme: { prop: 'elem', map: {} }, color: '#c9cfcc' } : { colorscheme: 'Jmol' };
      function withScheme(o) { for (var k in scheme) o[k] = scheme[k]; return o; }
      switch (state.style) {
        case 'sticks': return { stick: withScheme({ radius: stickRadius() }) };
        case 'spacefill': return { sphere: withScheme({ scale: 1.0 }) };
        case 'cartoon': return { cartoon: { color: dim ? '#d5dad8' : 'spectrum' } };
        case 'cartoonsticks': return { cartoon: { color: dim ? '#d5dad8' : 'spectrum', opacity: 0.85 },
                                       stick: withScheme({ radius: Math.min(stickRadius(), 0.2) }) };
        default: return { sphere: withScheme({ scale: sphereScale() }), stick: withScheme({ radius: stickRadius() }) };
      }
    }

    function selectionOf(kind) {
      switch (kind) {
        case 'acidic': return { resn: ['ASP', 'GLU'], hetflag: false };
        case 'basic': return { resn: ['ARG', 'HIS', 'LYS'], hetflag: false };
        case 'aromatic': return { resn: ['PHE', 'TYR', 'TRP'], hetflag: false };
        case 'disulfides': return { resn: ['CYS'], hetflag: false };
        case 'others': return { hetflag: true, not: { resn: WATER } };
        default: return null;
      }
    }

    function redraw() {
      if (!model) return;
      var dim = !!(state.focus || state.show);
      v.setStyle({}, baseStyle(dim));
      v.setStyle({ hetflag: true }, {
        sphere: { colorscheme: 'Jmol', scale: dim ? 0.18 : Math.max(0.25, sphereScale()) },
        stick: { colorscheme: 'Jmol', radius: 0.12 } });
      if (state.show) {
        var sel = selectionOf(state.show);
        var shown = state.show === 'disulfides' ?
          { stick: { colorscheme: 'Jmol', radius: 0.28 }, sphere: { colorscheme: 'Jmol', scale: 0.35 } } :
          { sphere: { colorscheme: 'Jmol', scale: 1.0 } };
        v.setStyle(sel, shown);
      }
      if (state.focus) {
        v.addStyle({ resi: state.focus }, { stick: { colorscheme: 'Jmol', radius: 0.22 },
                                            sphere: { colorscheme: 'Jmol', scale: 0.3 } });
      }
      v.render();
    }

    // ---- Pointing and measuring ----

    function describe(a) {
      var el = (a.elem || '').toUpperCase();
      var what = (a.hetflag && WATER.indexOf(a.resn) < 0 && !isAmino(a.resn)) ? a.resn + ' (not part of the chain)' :
        titleCase(a.resn) + ' ' + a.resi;
      return { residue: what, atom: a.atom, element: ELEMENT_NAMES[el] || el, serial: a.serial };
    }
    function isAmino(r) {
      return ['ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE', 'LEU', 'LYS', 'MET', 'PHE',
              'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL'].indexOf(r) >= 0;
    }

    function hover(atom) {
      if (!atom) return;
      if (hoverLabel) { v.removeLabel(hoverLabel); hoverLabel = null; }
      var d = describe(atom);
      hoverLabel = v.addLabel(d.residue + ' · ' + d.atom, {
        position: { x: atom.x, y: atom.y, z: atom.z }, inFront: true, fontSize: 13, fontColor: '#17211e',
        backgroundColor: '#ffffff', backgroundOpacity: 0.88, borderThickness: 1, borderColor: '#8d9994',
        alignment: 'bottomLeft', screenOffset: { x: 8, y: -8 } });
      if (opts.onPoint) opts.onPoint(d);
    }
    function unhover() {
      if (hoverLabel) { v.removeLabel(hoverLabel); hoverLabel = null; v.render(); }
    }

    var NEEDED = { distance: 2, angle: 3, dihedral: 4 };
    function vec(a) { return { x: a.x, y: a.y, z: a.z }; }

    function click(atom) {
      if (!atom) return;
      hover(atom);
      if (opts.onPick) opts.onPick(describe(atom));
      if (!state.measure) { v.render(); return; }
      if (picks.length && picks[picks.length - 1].serial === atom.serial) return;
      picks.push(atom);
      pickShapes.push(v.addSphere({ center: vec(atom), radius: 0.55, color: '#1c4c9a', opacity: 0.45 }));
      var need = NEEDED[state.measure];
      if (picks.length === need) {
        var M = root.MolModModel, value, unit, text;
        if (need === 2) { value = M.distance(picks[0], picks[1]); unit = ' Å'; }
        else if (need === 3) { value = M.angleAt(picks[0], picks[1], picks[2]); unit = '°'; }
        else { value = M.dihedral(picks[0], picks[1], picks[2], picks[3]); unit = '°'; }
        var shapes = [];
        for (var i = 0; i + 1 < picks.length; i++) {
          shapes.push(v.addCylinder({ start: vec(picks[i]), end: vec(picks[i + 1]), radius: 0.06, color: '#c26a00',
                                      dashed: true, dashLength: 0.25, gapLength: 0.18, fromCap: 1, toCap: 1 }));
        }
        var at = need === 3 ? picks[1] : { x: (picks[0].x + picks[need - 1].x) / 2,
          y: (picks[0].y + picks[need - 1].y) / 2, z: (picks[0].z + picks[need - 1].z) / 2 };
        text = value.toFixed(need === 2 ? 2 : 1) + unit;
        var label = v.addLabel(text, { position: vec(at), inFront: true, fontSize: 14, fontColor: '#ffffff',
          backgroundColor: '#c26a00', backgroundOpacity: 0.95, alignment: 'bottomCenter', screenOffset: { x: 0, y: -18 } });
        var names = picks.map(function (a) { var d = describe(a); return d.residue + ' ' + d.atom; });
        measurements.push({ shapes: shapes.concat(pickShapes), label: label });
        if (opts.onMeasure) opts.onMeasure({ kind: state.measure, value: value, text: text, atoms: names });
        picks = []; pickShapes = [];
      } else if (opts.onMeasure) {
        opts.onMeasure({ kind: state.measure, partial: picks.length, needed: need });
      }
      v.render();
    }

    function clearPicks() {
      pickShapes.forEach(function (s) { v.removeShape(s); });
      picks = []; pickShapes = [];
    }

    // ---- Axes ----

    function drawAxes() {
      axisShapes.forEach(function (s) { v.removeShape(s); });
      axisLabels.forEach(function (l) { v.removeLabel(l); });
      axisShapes = []; axisLabels = [];
      if (!state.axes || !model) return;
      var c = center(), L = Math.max(8, extent() * 0.75);
      [['X', [1, 0, 0], '#c0392b'], ['Y', [0, 1, 0], '#1b7a40'], ['Z', [0, 0, 1], '#1c4c9a']].forEach(function (ax) {
        var d = ax[1], col = ax[2];
        var tip = { x: c.x + d[0] * L, y: c.y + d[1] * L, z: c.z + d[2] * L };
        var tail = { x: c.x - d[0] * L, y: c.y - d[1] * L, z: c.z - d[2] * L };
        axisShapes.push(v.addArrow({ start: c, end: tip, radius: 0.22, radiusRatio: 2.4, mid: 0.9, color: col }));
        axisShapes.push(v.addCylinder({ start: c, end: tail, radius: 0.1, color: col, dashed: true, dashLength: 0.6, gapLength: 0.4 }));
        axisLabels.push(v.addLabel('+' + ax[0], { position: tip, inFront: true, fontSize: 16, fontColor: '#ffffff',
          backgroundColor: col, backgroundOpacity: 1, alignment: 'center' }));
        axisLabels.push(v.addLabel('−' + ax[0], { position: tail, inFront: true, fontSize: 13, fontColor: col,
          backgroundColor: '#ffffff', backgroundOpacity: 0.9, borderThickness: 1, borderColor: col, alignment: 'center' }));
      });
    }

    // ---- Turning ----

    function turnTo(q, duration) {
      var view = v.getView();
      view[4] = q[0]; view[5] = q[1]; view[6] = q[2]; view[7] = q[3];
      v.setView(view, ms(duration || 0));
    }

    // The quaternion that turns direction d to point at the viewer (+z).
    function quaternionTowardViewer(d) {
      var l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
      var u = [d[0] / l, d[1] / l, d[2] / l];
      var axis = [u[1], -u[0], 0];               // u x z
      var s = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1]);
      var angle = Math.acos(Math.max(-1, Math.min(1, u[2])));
      if (s < 1e-6) return u[2] > 0 ? [0, 0, 0, 1] : [0, 1, 0, 0];
      var h = Math.sin(angle / 2) / s;
      return [axis[0] * h, axis[1] * h, 0, Math.cos(angle / 2)];
    }

    // ---- Public ----

    var api = {
      viewer: v,
      load: function (text) {
        v.clear();
        model = v.addModel(text, 'pdb');
        atoms = model.selectedAtoms({});
        v.setHoverable({}, true, function (atom) { hover(atom); v.render(); }, unhover);
        v.setHoverDuration(80);
        v.setClickable({}, true, function (atom) { click(atom); });
        state.focus = null; state.show = null; measurements = []; picks = []; pickShapes = [];
        redraw();
        v.zoomTo();
        turnTo(TURN.front);
        drawAxes();
        v.render();
      },
      style: function (kind) { state.style = kind; redraw(); },
      atomSize: function (f) { state.atomSize = f; redraw(); },
      bondSize: function (f) { state.bondSize = f; redraw(); },
      spin: function (on) { state.spinning = !!on; v.spin(on ? 'y' : false, 0.6); },
      axes: function (on) { state.axes = !!on; drawAxes(); v.render(); },
      view: function (key, duration) {
        if (state.spinning) api.spin(false);
        turnTo(TURN[key], duration == null ? 700 : duration);
      },
      whole: function () {
        state.focus = null; state.show = null;
        focusLabels.forEach(function (l) { v.removeLabel(l); }); focusLabels = [];
        redraw(); v.zoomTo({}, ms(700));
      },
      show: function (kind) {
        state.show = kind || null;
        state.focus = null;
        focusLabels.forEach(function (l) { v.removeLabel(l); }); focusLabels = [];
        redraw();
        if (kind) {
          var sel = selectionOf(kind);
          if (model.selectedAtoms(sel).length) v.zoomTo({}, ms(500));
        }
        return kind ? model.selectedAtoms(selectionOf(kind)).length : 0;
      },
      // Frame some residues. opts.labels: put each residue's name beside it.
      focus: function (residues, o) {
        o = o || {};
        state.focus = residues && residues.length ? residues : null;
        focusLabels.forEach(function (l) { v.removeLabel(l); }); focusLabels = [];
        redraw();
        if (!state.focus) return;
        if (o.labels) {
          residues.forEach(function (r) {
            var ca = model.selectedAtoms({ resi: r, atom: 'CA' })[0];
            if (ca) focusLabels.push(v.addLabel(titleCase(ca.resn) + ' ' + r, { position: vec(ca), inFront: true,
              fontSize: 13, fontColor: '#ffffff', backgroundColor: '#1c4c9a', backgroundOpacity: 0.92,
              alignment: 'topCenter', screenOffset: { x: 0, y: 16 } }));
          });
        }
        // frame a few neighbours too, so a single residue is seen in its setting
        var around = {};
        residues.forEach(function (r) { for (var k = r - 3; k <= r + 3; k++) around[k] = true; });
        v.zoomTo({ resi: Object.keys(around).map(Number) }, ms(800));
        v.render();
      },
      // Look straight down a helix, from its first residues toward its last.
      downHelix: function (start, end) {
        function mean(list) {
          var m = [0, 0, 0];
          list.forEach(function (a) { m[0] += a.x; m[1] += a.y; m[2] += a.z; });
          return m.map(function (x) { return x / list.length; });
        }
        var cas = model.selectedAtoms({ atom: 'CA', hetflag: false }).filter(function (a) { return a.resi >= start && a.resi <= end; });
        if (cas.length < 6) return;
        var a = mean(cas.slice(0, 4)), b = mean(cas.slice(-4));
        // the first residues toward the viewer, so the viewer looks down the helix from its start
        turnTo(quaternionTowardViewer([a[0] - b[0], a[1] - b[1], a[2] - b[2]]), 900);
        var rs = []; for (var r = start; r <= end; r++) rs.push(r);
        state.focus = null; redraw();
        v.zoomTo({ resi: rs }, ms(900));
      },
      measure: function (kind) {
        clearPicks();
        state.measure = kind || null;
        v.render();
      },
      clearMeasurements: function () {
        clearPicks();
        measurements.forEach(function (m) { m.shapes.forEach(function (s) { v.removeShape(s); }); v.removeLabel(m.label); });
        measurements = [];
        v.render();
      },
      resize: function () { v.resize(); v.render(); },
      residues: function () {
        return model ? model.selectedAtoms({ atom: 'CA', hetflag: false }).map(function (a) { return { resn: a.resn, resi: a.resi }; }) : [];
      },
      // For tests: the quaternion of the current view.
      turn: function () { return v.getView().slice(4); }
    };
    return api;
  }

  root.MolModViewer = MolModViewer;
})(typeof self !== 'undefined' ? self : this);
