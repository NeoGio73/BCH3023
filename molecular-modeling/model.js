/*
 * Introduction to Molecular Modeling: the page's own logic, with no viewer and no page in it, so
 * that Node can load it for tests (node Tools/molmod_model_test.js).
 *
 * - The code at the top of the page picks the student's unknown from the pool (pool.js).
 * - parsePdb reads a .pdb file; facts works out, from that file alone, every answer the page
 *   checks. No answer is stored anywhere: the page checks against the file the student is
 *   looking at. The protein's name is never checked (the instructor marks it from a private key).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MolModModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Codes: five characters, the last a check character, as in the other labs ----

  var ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/1/I/L/O
  var BASE = ALPHABET.length;
  var CODE_SPACE = BASE * BASE * BASE * BASE;
  var SEED_ADD = 0x510e527f, SEED_MUL = 0x9b05688c, SEED_XOR = 0x1f83d9ab, DISCARD = 4;

  function normalizeCode(text) {
    return String(text == null ? '' : text).toUpperCase().replace(/[^0-9A-Z]/g, '');
  }
  function checkChar(digits) {
    var sum = 7;
    for (var i = 0; i < digits.length; i++) sum += (i + 2) * digits[i];
    return ALPHABET[sum % BASE];
  }
  function numberFromCode(text) {
    var code = normalizeCode(text);
    if (code.length !== 5) return null;
    var digits = [];
    for (var i = 0; i < 4; i++) {
      var d = ALPHABET.indexOf(code[i]);
      if (d < 0) return null;
      digits.push(d);
    }
    if (checkChar(digits) !== code[4]) return null;
    return ((digits[0] * BASE + digits[1]) * BASE + digits[2]) * BASE + digits[3];
  }
  function codeFromNumber(n) {
    n = ((n % CODE_SPACE) + CODE_SPACE) % CODE_SPACE;
    var digits = [];
    for (var i = 0; i < 4; i++) { digits.unshift(n % BASE); n = Math.floor(n / BASE); }
    return digits.map(function (d) { return ALPHABET[d]; }).join('') + checkChar(digits);
  }
  function isCode(text) { return numberFromCode(text) !== null; }
  function randomCode() { return codeFromNumber(Math.floor(Math.random() * CODE_SPACE)); }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // A stream of random numbers that depends only on the code.
  function streamOf(code) {
    var n = numberFromCode(code);
    if (n === null) return null;
    var next = mulberry32((Math.imul((n + SEED_ADD) >>> 0, SEED_MUL) ^ SEED_XOR) >>> 0);
    for (var i = 0; i < DISCARD; i++) next();
    return next;
  }
  // Which of the pool's proteins a code gives: its place in the pool, or null.
  function unknownIndex(code, poolSize) {
    var next = streamOf(code);
    return next ? Math.floor(next() * poolSize) : null;
  }

  // Which of `count` residues a code asks the angle of (the second number of the code's stream).
  function angleChoice(code, count) {
    var next = streamOf(code);
    if (!next || !count) return null;
    next();
    return Math.floor(next() * count);
  }

  // ---- Amino acids ----

  var AMINO = {
    ALA: ['A', 'alanine'], ARG: ['R', 'arginine'], ASN: ['N', 'asparagine'], ASP: ['D', 'aspartate'],
    CYS: ['C', 'cysteine'], GLN: ['Q', 'glutamine'], GLU: ['E', 'glutamate'], GLY: ['G', 'glycine'],
    HIS: ['H', 'histidine'], ILE: ['I', 'isoleucine'], LEU: ['L', 'leucine'], LYS: ['K', 'lysine'],
    MET: ['M', 'methionine'], PHE: ['F', 'phenylalanine'], PRO: ['P', 'proline'], SER: ['S', 'serine'],
    THR: ['T', 'threonine'], TRP: ['W', 'tryptophan'], TYR: ['Y', 'tyrosine'], VAL: ['V', 'valine']
  };
  var THREE_LETTER = Object.keys(AMINO).sort();
  var ACIDIC = ['ASP', 'GLU'];
  var BASIC = ['ARG', 'HIS', 'LYS'];
  // Largest side chain first.
  var AROMATIC = ['TRP', 'TYR', 'PHE'];

  function titleCase(resn) { return resn.charAt(0) + resn.slice(1).toLowerCase(); }
  function residueName(r) { return titleCase(r.resn) + ' ' + r.resi + (r.icode || ''); }

  // ---- Reading a .pdb file ----

  function parsePdb(text) {
    var out = { seqres: [], atoms: [], residues: [], helices: [], sheetLines: 0, ssbonds: [], het: [] };
    var byKey = {}, hetSeen = {};
    String(text).split(/\r?\n/).forEach(function (l) {
      var rec = l.slice(0, 6);
      if (rec === 'SEQRES') {
        l.slice(19).trim().split(/\s+/).forEach(function (r) { if (r) out.seqres.push(r); });
      } else if (rec === 'HELIX ') {
        out.helices.push({ start: parseInt(l.slice(21, 25), 10), startResn: l.slice(15, 18).trim(),
                           end: parseInt(l.slice(33, 37), 10), endResn: l.slice(27, 30).trim() });
      } else if (rec === 'SHEET ') {
        out.sheetLines++;
      } else if (rec === 'SSBOND') {
        out.ssbonds.push({ a: parseInt(l.slice(17, 21), 10), b: parseInt(l.slice(31, 35), 10) });
      } else if (rec === 'ATOM  ' || rec === 'HETATM') {
        var a = {
          het: rec === 'HETATM', serial: parseInt(l.slice(6, 11), 10), name: l.slice(12, 16).trim(),
          resn: l.slice(17, 20).trim(), chain: l.slice(21, 22), resi: parseInt(l.slice(22, 26), 10),
          icode: l.slice(26, 27).trim(), x: parseFloat(l.slice(30, 38)), y: parseFloat(l.slice(38, 46)),
          z: parseFloat(l.slice(46, 54)), elem: (l.slice(76, 78).trim() || l.slice(12, 16).trim().charAt(0))
        };
        out.atoms.push(a);
        if (a.het) {
          if (!AMINO[a.resn] && a.resn !== 'HOH' && !hetSeen[a.resn]) { hetSeen[a.resn] = true; out.het.push(a.resn); }
          if (!AMINO[a.resn]) return;
        }
        var key = a.chain + a.resi + a.icode;
        if (!byKey[key]) {
          byKey[key] = { resn: a.resn, resi: a.resi, icode: a.icode, chain: a.chain, atoms: {} };
          out.residues.push(byKey[key]);
        }
        byKey[key].atoms[a.name] = a;
      }
    });
    return out;
  }

  function oneLetter(list) {
    return list.map(function (r) { return AMINO[r] ? AMINO[r][0] : 'X'; }).join('');
  }

  function angleAt(a, b, c) {
    var u = [a.x - b.x, a.y - b.y, a.z - b.z], v = [c.x - b.x, c.y - b.y, c.z - b.z];
    var dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    var lu = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
    var lv = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return Math.acos(Math.max(-1, Math.min(1, dot / (lu * lv)))) * 180 / Math.PI;
  }
  function distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
  }
  function dihedral(a, b, c, d) {
    function sub(p, q) { return [p.x - q.x, p.y - q.y, p.z - q.z]; }
    function cross(u, v) { return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; }
    function dot(u, v) { return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]; }
    var b1 = sub(b, a), b2 = sub(c, b), b3 = sub(d, c);
    var n1 = cross(b1, b2), n2 = cross(b2, b3);
    var l2 = Math.sqrt(dot(b2, b2));
    var m1 = cross(n1, [b2[0] / l2, b2[1] / l2, b2[2] / l2]);
    return Math.atan2(dot(m1, n2), dot(n1, n2)) * 180 / Math.PI;
  }

  // Everything the page checks, worked out from the file. `code` picks the residue whose angle is
  // asked for (any residue but glycine and the two ends, with N, CA and C all in the file).
  function facts(pdb, code) {
    var res = pdb.residues;
    var first = res[0], last = res[res.length - 1];
    var seq = pdb.seqres;
    function count(list) { return seq.filter(function (r) { return list.indexOf(r) >= 0; }).length; }
    function where(list) {
      return res.filter(function (r) { return list.indexOf(r.resn) >= 0; }).map(residueName);
    }
    var longest = 0;
    pdb.helices.forEach(function (h) { longest = Math.max(longest, h.end - h.start + 1); });
    var longestHelices = pdb.helices.filter(function (h) { return h.end - h.start + 1 === longest; });
    var aromaticPresent = AROMATIC.filter(function (r) { return seq.indexOf(r) >= 0; });

    // An ordinary angle (104 to 118 degrees), so that the comparison with 109.5 degrees makes sense.
    var eligible = res.slice(1, -1).filter(function (r) {
      if (r.resn === 'GLY' || !r.atoms.N || !r.atoms.CA || !r.atoms.C) return false;
      var t = angleAt(r.atoms.N, r.atoms.CA, r.atoms.C);
      return t >= 104 && t <= 118;
    });
    var angleResidue = null, angle = null;
    var place = angleChoice(code, eligible.length);
    if (place !== null) {
      angleResidue = eligible[place];
      angle = angleAt(angleResidue.atoms.N, angleResidue.atoms.CA, angleResidue.atoms.C);
    }
    return {
      first: first, last: last,
      firstThree: res.slice(0, 3), lastThree: res.slice(-3),
      seqLength: seq.length, sequence: oneLetter(seq),
      helixCount: pdb.helices.length, longestHelices: longestHelices,
      hasStrands: pdb.sheetLines > 0,
      disulfides: pdb.ssbonds.length,
      acidic: count(ACIDIC), basic: count(BASIC), aromatic: count(AROMATIC),
      acidicWhere: where(ACIDIC), basicWhere: where(BASIC), aromaticWhere: where(AROMATIC),
      largestAromatic: aromaticPresent[0] || null,
      angleResidue: angleResidue, angle: angle,
      het: pdb.het.slice()
    };
  }

  // ---- The views: which end of which axis comes toward the viewer ----

  var VIEWS = [
    { key: 'front', name: 'Front', toward: '+Z' },
    { key: 'top', name: 'Top', toward: '+Y' },
    { key: 'bottom', name: 'Bottom', toward: '-Y' },
    { key: 'right', name: 'Right', toward: '+X' },
    { key: 'left', name: 'Left', toward: '-X' },
    { key: 'back', name: 'Back', toward: '-Z' }
  ];
  var AXIS_ENDS = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

  // ---- Checks: each returns { ok, tip } (tip says where to look, never the answer) ----

  function asInt(text) {
    var t = String(text == null ? '' : text).trim();
    return /^-?\d+$/.test(t) ? parseInt(t, 10) : null;
  }
  function asNumber(text) {
    var t = String(text == null ? '' : text).trim().replace(/[°\s]/g, '').replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
  }

  var check = {
    view: function (viewKey, answer) {
      var v = VIEWS.filter(function (w) { return w.key === viewKey; })[0];
      if (!answer) return null;
      return answer === v.toward ? { ok: true } :
        { ok: false, tip: 'Show the axes, press ' + v.name + ' and look for the label nearest to you: it points out of the screen.' };
    },
    residue: function (expected, answer, what) {
      if (!answer) return null;
      return answer === expected.resn ? { ok: true } :
        { ok: false, tip: 'Point at an atom of the ' + what + ' residue: its name appears under the viewer.' };
    },
    number: function (expected, text, tip) {
      if (String(text == null ? '' : text).trim() === '') return null;
      var n = asInt(text);
      if (n === null) return { ok: false, tip: 'Enter a whole number.' };
      return n === expected ? { ok: true } : { ok: false, tip: tip };
    },
    sequence: function (expected, text) {
      var t = String(text == null ? '' : text).toUpperCase().replace(/[^A-Z]/g, '');
      if (!t) return null;
      if (t === expected) return { ok: true };
      for (var i = 0; i < Math.min(t.length, expected.length); i++) {
        if (t[i] !== expected[i]) return { ok: false, tip: 'Letter ' + (i + 1) + ' does not match the SEQRES lines. Check the one-letter code of that residue.' };
      }
      return { ok: false, tip: t.length < expected.length ?
        'The sequence is ' + (expected.length - t.length > 1 ? 'missing some letters' : 'missing a letter') + ' at the end.' :
        'The sequence has more letters than the SEQRES lines.' };
    },
    longestHelix: function (f, startText, endText) {
      if (String(startText || '').trim() === '' || String(endText || '').trim() === '') return null;
      var s = asInt(startText), e = asInt(endText);
      if (s === null || e === null) return { ok: false, tip: 'Enter residue numbers.' };
      var ok = f.longestHelices.some(function (h) { return h.start === s && h.end === e; });
      return ok ? { ok: true } : { ok: false, tip: 'Read the HELIX lines of the file: each gives the first and last residue of one helix. Work out which is longest.' };
    },
    yesNo: function (expected, answer, tip) {
      if (!answer) return null;
      return (answer === 'yes') === expected ? { ok: true } : { ok: false, tip: tip };
    },
    largestAromatic: function (f, answer) {
      if (!answer) return null;
      if (answer === 'none') return f.largestAromatic ? { ok: false, tip: 'Press Show aromatic and look again.' } : { ok: true };
      return answer === f.largestAromatic ? { ok: true } :
        { ok: false, tip: f.largestAromatic && AROMATIC.indexOf(answer) >= 0 && f.aromaticWhere.length ?
          'Of the aromatic residues present, which has the largest side chain?' : 'Press Show aromatic and look again.' };
    },
    angle: function (f, text) {
      if (String(text == null ? '' : text).trim() === '') return null;
      var a = asNumber(text);
      if (a === null) return { ok: false, tip: 'Enter the angle in degrees, as a number.' };
      if (Math.abs(a - f.angle) <= 1.5) return { ok: true };
      return { ok: false, tip: 'Measure again: Measure angle, then click N, then CA (the α-carbon), then C of residue ' + residueName(f.angleResidue) + ', in that order.' };
    }
  };

  return {
    ALPHABET: ALPHABET, normalizeCode: normalizeCode, isCode: isCode, randomCode: randomCode,
    numberFromCode: numberFromCode, codeFromNumber: codeFromNumber, unknownIndex: unknownIndex,
    angleChoice: angleChoice,
    AMINO: AMINO, THREE_LETTER: THREE_LETTER, ACIDIC: ACIDIC, BASIC: BASIC, AROMATIC: AROMATIC,
    titleCase: titleCase, residueName: residueName, parsePdb: parsePdb, oneLetter: oneLetter,
    angleAt: angleAt, distance: distance, dihedral: dihedral, facts: facts,
    VIEWS: VIEWS, AXIS_ENDS: AXIS_ENDS, check: check
  };
});
