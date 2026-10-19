/*
 * The Hemoglobin Clinic: the page's own logic, with nothing about the patient in it. Codes, the
 * words for every refusal, warning, mistake and notice the bench can send, the reaction's and the
 * digest's recipes and their checks (the arithmetic of C1V1 = C2V2), the thermocycler's program,
 * what the student's primers make from the public reference sequence and what DdeI makes of it
 * (for the predictions), the gel's agarose, and the reading of the gel: the ladder's line and
 * each band's size from it. Loads in a browser (window.DnaLabModel, with window.DnaLabLocus) and
 * in Node, for the tests (node Tools/dna_model_test.js).
 *
 * The bench (Unity) holds the patient's DNA and works out what each tube makes; the page is
 * never told. What the page checks here follows only from numbers printed on the page.
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

  // ---- The bench's names ----

  var STOCKS = [
    { id: 'mastermix', name: 'Master mix (2x)', part: 1 },
    { id: 'fwd', name: 'Forward primer (10 µM)', part: 1 },
    { id: 'rev', name: 'Reverse primer (10 µM)', part: 1 },
    { id: 'patient', name: 'Patient DNA (20 ng/µL)', part: 1 },
    { id: 'control', name: 'Control DNA (20 ng/µL)', part: 1 },
    { id: 'water', name: 'Water', part: 1 },
    { id: 'pcr-patient', name: 'PCR tube: Patient', part: 0 },
    { id: 'pcr-control', name: 'PCR tube: Control', part: 0 },
    { id: 'pcr-none', name: 'PCR tube: No DNA', part: 2 },
    { id: 'dbuffer', name: 'Digest buffer (10x)', part: 1 },
    { id: 'ddei', name: 'DdeI (10 units/µL)', part: 1 },
    { id: 'cleanup', name: 'PCR clean-up enzymes', part: 1 },
    { id: 'digest-patient', name: 'Digest: patient', part: 2 },
    { id: 'digest-control', name: 'Digest: control', part: 2 },
    { id: 'dye', name: 'Loading dye (6x)', part: 2 },
    { id: 'ladder', name: 'DNA ladder (ready to load)', part: 2 },
    { id: 'stain', name: 'DNA gel stain (10,000x)', part: 2 }
  ];
  /** Where a pipette's load can go, by session (0: both). */
  var TARGETS = [
    { id: 'patient', name: 'PCR tube: Patient', part: 0 },
    { id: 'control', name: 'PCR tube: Control', part: 0 },
    { id: 'none', name: 'PCR tube: No DNA', part: 0 },
    { id: 'digest-patient', name: 'Digest: patient', part: 0 },
    { id: 'digest-control', name: 'Digest: control', part: 0 },
    { id: 'seq-patient', name: 'Sequencing: patient', part: 1 },
    { id: 'seq-control', name: 'Sequencing: control', part: 1 },
    { id: 'flask', name: 'The flask of agarose', part: 2 }
  ];
  for (var w = 1; w <= 10; w++) TARGETS.push({ id: 'well-' + w, name: 'Well ' + w, part: 2 });
  var TUBES = [
    { id: 'patient', name: 'Patient' },
    { id: 'control', name: 'Control' },
    { id: 'none', name: 'No DNA' }
  ];
  var PIPETTES = [
    { id: 'p2', name: 'P2', min: 0.2, max: 2, step: 0.01, tips: '10 µL' },
    { id: 'p20', name: 'P20', min: 2, max: 20, step: 0.1, tips: '200 µL' },
    { id: 'p200', name: 'P200', min: 20, max: 200, step: 0.1, tips: '200 µL' }
  ];

  function stockName(id) { for (var i = 0; i < STOCKS.length; i++) if (STOCKS[i].id === id) return STOCKS[i].name; return id; }
  function tubeName(id) { for (var i = 0; i < TUBES.length; i++) if (TUBES[i].id === id) return TUBES[i].name; return id; }

  // ---- The reaction: 25 µL, 1x master mix, 0.4 µM of each primer, 20 ng of DNA ----

  var REACTION = { totalUl: 25, mixX: 2, mixFinalX: 1, primerStockUm: 10, primerFinalUm: 0.4, dnaNgPerUl: 20, dnaNg: 20 };
  var ROWS = ['water', 'mastermix', 'fwd', 'rev', 'dna'];

  /** What each tube should get, µL (the answers to the recipe; all of it follows from the numbers printed on the page). */
  function recipe(tube) {
    var r = REACTION;
    var mix = r.totalUl * r.mixFinalX / r.mixX;
    var primer = r.totalUl * r.primerFinalUm / r.primerStockUm;
    var dna = tube === 'none' ? 0 : r.dnaNg / r.dnaNgPerUl;
    return { mastermix: mix, fwd: primer, rev: primer, dna: dna, water: r.totalUl - mix - 2 * primer - dna };
  }

  function num(text) {
    var t = String(text == null ? '' : text).trim().replace(',', '.');
    if (t === '' || !/^-?\d*\.?\d+$/.test(t)) return NaN;
    return parseFloat(t);
  }

  /**
   * One box of the recipe: 'ok', 'empty', 'bad' (not a number), or 'no' with a hint for what to
   * look at again (never the value).
   */
  function checkRecipe(tube, row, text) {
    if (String(text || '').trim() === '') return { verdict: 'empty' };
    var v = num(text);
    if (isNaN(v) || v < 0) return { verdict: 'bad' };
    var want = recipe(tube)[row];
    if (Math.abs(v - want) <= 0.051) return { verdict: 'ok' };
    var hint = {
      mastermix: 'The master mix is 2x and must end at 1x in 25 µL: C1V1 = C2V2.',
      fwd: 'The stock is 10 µM and the reaction needs 0.4 µM in 25 µL: C1V1 = C2V2.',
      rev: 'The stock is 10 µM and the reaction needs 0.4 µM in 25 µL: C1V1 = C2V2.',
      dna: tube === 'none' ? 'This is the tube with no DNA.' : 'The stock is 20 ng/µL and the tube needs 20 ng.',
      water: 'Water makes up whatever is left of the 25 µL.'
    }[row];
    return { verdict: 'no', hint: hint };
  }

  /** Which pipette a volume needs: the smallest one whose range holds it, or null. */
  function pipetteFor(ul) {
    for (var i = 0; i < PIPETTES.length; i++) if (ul >= PIPETTES[i].min - 1e-6 && ul <= PIPETTES[i].max + 1e-6) return PIPETTES[i];
    return null;
  }

  // ---- The digest: 20 µL, 10 µL of product, 1x buffer from 10x, 10 units of DdeI from 10 units/µL ----

  var DIGEST = { totalUl: 20, productUl: 10, bufferX: 10, units: 10, unitsPerUl: 10 };
  var DIGEST_ROWS = ['product', 'dbuffer', 'ddei', 'water'];

  function digestRecipe() {
    var d = DIGEST;
    var buffer = d.totalUl / d.bufferX, enzyme = d.units / d.unitsPerUl;
    return { product: d.productUl, dbuffer: buffer, ddei: enzyme, water: d.totalUl - d.productUl - buffer - enzyme };
  }

  function checkDigest(row, text) {
    if (String(text || '').trim() === '') return { verdict: 'empty' };
    var v = num(text);
    if (isNaN(v) || v < 0) return { verdict: 'bad' };
    if (Math.abs(v - digestRecipe()[row]) <= 0.051) return { verdict: 'ok' };
    var hint = {
      product: 'The digest takes 10 µL of the PCR product.',
      dbuffer: 'The buffer is 10x and must end at 1x in 20 µL: C1V1 = C2V2.',
      ddei: 'The enzyme is 10 units per µL, and the digest needs 10 units.',
      water: 'Water makes up whatever is left of the 20 µL.'
    }[row];
    return { verdict: 'no', hint: hint };
  }

  // ---- BLAST: what the student found for the patient's read ----

  /** Accessions that are HBB itself, or hold it: RefSeqGene, mRNA, the beta-globin locus, chromosome 11's reference. */
  var HBB_ACCESSIONS = /^(NG_059281|NM_000518|NG_000007|NC_000011|NT_009237|LRG_1232|U01317|V00499|J00179|AF007546|AF117710|AY136510|EU760\d{3}|L48931|L48932|M25079)/i;

  function checkBlast(field, text) {
    var t = String(text || '').trim();
    if (t === '') return { verdict: 'empty' };
    switch (field) {
      case 'gene':
        return /^(HBB|beta[- ]?globin|β[- ]?globin|hemoglobin,? (subunit )?beta|haemoglobin,? (subunit )?beta|hemoglobin beta)/i.test(t)
          ? { verdict: 'ok' } : { verdict: 'no', hint: 'Look at the description of the top hit: which gene is it?' };
      case 'organism':
        return /homo sapiens|human/i.test(t) ? { verdict: 'ok' } : { verdict: 'no', hint: 'The organism is in the top hit\u2019s description (or the Taxonomy tab).' };
      case 'accession':
        if (HBB_ACCESSIONS.test(t.replace(/\s/g, ''))) return { verdict: 'ok' };
        return /^[A-Z]{1,2}_?\d{5,9}(\.\d+)?$/i.test(t.replace(/\s/g, ''))
          ? { verdict: 'unsure', hint: 'The page does not know this accession. Check that its description is the beta-globin gene.' }
          : { verdict: 'no', hint: 'An accession looks like NG_059281.1 or NM_000518.5: copy it from the Accession column.' };
      case 'identity': {
        var v = num(t.replace('%', ''));
        if (isNaN(v)) return { verdict: 'bad' };
        return Math.abs(v - 100) < 0.05 ? { verdict: 'ok' } : { verdict: 'no', hint: 'Per. Ident. in the top hit\u2019s row.' };
      }
      case 'cover': {
        var c = num(t.replace('%', ''));
        if (isNaN(c)) return { verdict: 'bad' };
        return Math.abs(c - 100) < 0.05 ? { verdict: 'ok' } : { verdict: 'no', hint: 'Query Cover in the top hit\u2019s row.' };
      }
      case 'evalue': {
        // a 500-base perfect match: BLAST prints 0.0 (anything below 1e-150)
        var e = t.replace(/\s/g, '').replace(/[x×]10\^?/i, 'e');
        var n = Number(e);
        if (/^0(\.0+)?$/.test(e) || (!isNaN(n) && n < 1e-150)) return { verdict: 'ok' };
        return isNaN(n) ? { verdict: 'bad' } : { verdict: 'no', hint: 'E value in the top hit\u2019s row (for a long perfect match BLAST prints 0.0).' };
      }
    }
    return { verdict: 'empty' };
  }

  // ---- Designing a primer: the same melting temperature as the bench and Primer-BLAST ----

  // SantaLucia (1998) nearest-neighbour values (dH kcal/mol, dS cal/K/mol), as in the bench's Pcr.cs
  var NN = { AA: [-7.9, -22.2], AT: [-7.2, -20.4], TA: [-7.2, -21.3], CA: [-8.5, -22.7], GT: [-8.4, -22.4],
    CT: [-7.8, -21.0], GA: [-8.2, -22.2], CG: [-10.6, -27.2], GC: [-9.8, -24.4], GG: [-8.0, -19.9] };

  /** Tm (°C) at Primer-BLAST's defaults: 50 mM monovalent salt, 1.5 mM Mg2+, 0.6 mM dNTPs, 50 nM primer. */
  function tm(primer) {
    var p = cleanSequence(primer);
    if (p.length < 2) return NaN;
    var dH = 0, dS = 0;
    for (var i = 0; i + 1 < p.length; i++) {
      var two = p.substr(i, 2), v = NN[two] || NN[revComp(two)];
      dH += v[0]; dS += v[1];
    }
    [p[0], p[p.length - 1]].forEach(function (end) {
      if (end === 'G' || end === 'C') { dH += 0.1; dS += -2.8; } else { dH += 2.3; dS += 4.1; }
    });
    var naEq = 50 + 120 * Math.sqrt(Math.max(0, 1.5 - 0.6));
    dS += 0.368 * (p.length - 1) * Math.log(naEq / 1000);
    return dH * 1000 / (dS + 1.987 * Math.log(50e-9 / 4)) - 273.15;
  }

  function gc(primer) {
    var p = cleanSequence(primer);
    return p.length ? (p.split('').filter(function (b) { return b === 'G' || b === 'C'; }).length / p.length) * 100 : 0;
  }

  /** How many bases at the 3' ends of two primers pair (both 3' ends in the pair), as the bench works out dimers. */
  function threeEndPairing(a, b) {
    var best = 0, rb = revComp(b);
    for (var k = 3; k <= Math.min(a.length, b.length); k++) if (a.substr(a.length - k) === rb.substr(0, k)) best = k;
    return best;
  }

  /** The longest hairpin stem a primer can fold into (with a loop of 3 or more), and whether it holds the 3' end. */
  function hairpin(p) {
    var best = { stem: 0, threeEnd: false };
    for (var i = 0; i < p.length; i++)
      for (var j = p.length - 1; j > i + 3; j--) {
        var k = 0;
        while (i + k < j - k - 3 && p[i + k] === revComp(p[j - k])) k++;
        if (k > best.stem) best = { stem: k, threeEnd: j === p.length - 1 };
      }
    return best;
  }

  /** Where a primer sits on the reference: perfect matches on either strand ([{ at, top }]). */
  function placesOn(seq, primer) {
    var p = cleanSequence(primer), out = [];
    if (p.length < 10) return out;
    allAt(seq, p).forEach(function (i) { out.push({ at: i, top: true }); });
    allAt(seq, revComp(p)).forEach(function (i) { out.push({ at: i, top: false }); });
    return out;
  }

  /** The fewest mismatches with which a primer matches HBD (the stretch's first 4500 bases), either strand. */
  function hbdMismatches(locus, primer) {
    var p = cleanSequence(primer), best = 99;
    var h = locus.reference.substring(0, 4500);
    [p, revComp(p)].forEach(function (q) {
      for (var i = 0; i + q.length <= h.length; i++) {
        var mm = 0;
        for (var k = 0; k < q.length && mm < best; k++) if (h[i + k] !== q[k]) mm++;
        if (mm < best) best = mm;
      }
    });
    return best;
  }

  /**
   * The design checklist for a pair: each primer's length, GC, Tm, 3' clamp, runs, hairpin and
   * self-pairing, then the pair's Tm difference and pairing, where they sit and what they make.
   * Each line { key, ok (true, false or null for a note), text }.
   */
  function primerChecks(locus, fwd, rev) {
    var lines = [];
    var pr = { forward: cleanSequence(fwd), reverse: cleanSequence(rev) };
    Object.keys(pr).forEach(function (name) {
      var p = pr[name];
      if (p.length === 0) return;
      var t = tm(p), g = gc(p), hp = hairpin(p), self = threeEndPairing(p, p);
      lines.push({ key: name + '-length', ok: p.length >= 18 && p.length <= 25, text: name + ': ' + p.length + ' bases (18 to 25)' });
      lines.push({ key: name + '-gc', ok: g >= 40 && g <= 60, text: name + ': ' + g.toFixed(0) + '% GC (40 to 60%)' });
      lines.push({ key: name + '-tm', ok: t >= 57 && t <= 63, text: name + ': Tm ' + t.toFixed(1) + ' °C (57 to 63)' });
      var last2 = p.substr(-2), clamp = (last2.match(/[GC]/g) || []).length, last5 = (p.substr(-5).match(/[GC]/g) || []).length;
      lines.push({ key: name + '-clamp', ok: clamp >= 1 && last5 <= 3, text: name + ': 3\u2032 end ' + p.substr(-5) + (clamp >= 1 ? (last5 <= 3 ? ' (a G or C at the end, not too many)' : ' (too many G and C in the last five: it can prime where it should not)') : ' (no G or C at the 3\u2032 end)') });
      lines.push({ key: name + '-runs', ok: !/(A{4,}|C{4,}|G{4,}|T{4,})/.test(p), text: name + ': ' + (/(A{4,}|C{4,}|G{4,}|T{4,})/.test(p) ? 'a run of four or more of one base' : 'no runs of four or more') });
      lines.push({ key: name + '-hairpin', ok: hp.stem < 4 || (hp.stem < 5 && !hp.threeEnd), text: name + ': ' + (hp.stem >= 4 ? 'can fold into a hairpin of ' + hp.stem + ' base pairs' + (hp.threeEnd ? ', holding its 3\u2032 end' : '') : 'no hairpin of 4 or more') });
      lines.push({ key: name + '-self', ok: self < 4, text: name + ': ' + (self >= 4 ? 'its 3\u2032 end pairs with itself over ' + self + ' bases (a primer-dimer)' : 'no 3\u2032 pairing with itself') });
      var places = placesOn(locus.reference, p);
      lines.push({ key: name + '-place', ok: places.length === 1, text: name + ': ' + (places.length === 0 ? 'not found in the reference as written' : places.length === 1 ? 'found once in the reference, on the ' + (places[0].top ? 'top' : 'bottom') + ' strand' : 'found ' + places.length + ' times in the reference') });
      var hbd = hbdMismatches(locus, p);
      lines.push({ key: name + '-hbd', ok: null, text: name + ': ' + (hbd === 0 ? 'matches HBD exactly too' : 'closest match in HBD: ' + hbd + ' mismatch' + (hbd === 1 ? '' : 'es')) });
    });
    if (pr.forward && pr.reverse) {
      var d = Math.abs(tm(pr.forward) - tm(pr.reverse));
      lines.push({ key: 'pair-tm', ok: d <= 3, text: 'the pair: Tm differs by ' + d.toFixed(1) + ' °C (3 or less)' });
      var pair = threeEndPairing(pr.forward, pr.reverse);
      lines.push({ key: 'pair-dimer', ok: pair < 4, text: 'the pair: ' + (pair >= 4 ? 'their 3\u2032 ends pair over ' + pair + ' bases (a primer-dimer)' : 'their 3\u2032 ends do not pair') });
      var prod = productOn(locus.reference, pr.forward, pr.reverse);
      if (prod.error) lines.push({ key: 'pair-product', ok: false, text: 'the pair: ' + { short: 'too short', none: 'a primer is not in the reference', facing: 'the primers do not face each other', several: 'more than one product' }[prod.error] });
      else {
        var covers = prod.start <= locus.atg && prod.end >= locus.coding[1][0] + 3 * 43 - 92;
        lines.push({ key: 'pair-product', ok: prod.length >= 300 && prod.length <= 900 && covers, text: 'the pair: a product of ' + prod.length + ' bp' + (covers ? ', from before codon 1 to past codon 42' : ', which does not reach from before codon 1 to past codon 42') + (prod.length < 300 || prod.length > 900 ? ' (aim for 300 to 900)' : '') });
      }
      var hf = hbdMismatches(locus, pr.forward), hr = hbdMismatches(locus, pr.reverse);
      lines.push({ key: 'pair-hbd', ok: Math.max(hf, hr) >= 4, text: 'the pair: ' + (Math.max(hf, hr) >= 4 ? 'at least one primer differs from HBD in 4 or more bases' : 'both primers nearly match HBD: they will amplify it too') });
    }
    return lines;
  }

  // ---- From the trace back to the gene ----

  /**
   * Where a position of the trace (1-based, counted from the base after the primer) lies in the
   * reference (index in the stretch), for a read from the forward or the reverse primer.
   */
  function traceToReference(locus, fwd, rev, primer, pos) {
    var prod = productOn(locus.reference, fwd, rev);
    if (prod.error) return -1;
    var f = cleanSequence(fwd), r = cleanSequence(rev);
    // the product on the top strand starts with whichever primer reads that way
    var startsWithF = locus.reference.substr(prod.start, f.length) === f;
    var topPrimer = startsWithF ? f : r, bottomPrimer = startsWithF ? r : f;
    var readsTop = primer === (startsWithF ? 'fwd' : 'rev');
    if (readsTop) return prod.start + topPrimer.length + pos - 1;
    return prod.end - bottomPrimer.length - pos;
  }

  /** What part of HBB an index of the stretch is: { where: 'codon', codon (Lehninger's numbering), base (1 to 3) } or an intron or a UTR. */
  function placeInGene(locus, i) {
    var off = 0;
    for (var k = 0; k < locus.coding.length; k++) {
      var a = locus.coding[k][0], b = locus.coding[k][1];
      if (i >= a && i <= b) {
        var c = off + (i - a);
        var fromAtg = Math.floor(c / 3) + 1;
        return { where: 'codon', codon: fromAtg - 1, base: c % 3 + 1 };
      }
      off += b - a + 1;
    }
    if (i >= locus.intron1[0] && i <= locus.intron1[1]) return { where: 'intron 1', base: i - locus.intron1[0] + 1 };
    if (i > locus.exon2[1] && i < locus.coding[2][0]) return { where: 'intron 2', base: i - locus.exon2[1] };
    if (i < locus.coding[0][0]) return { where: 'before the ATG', base: locus.coding[0][0] - i };
    return { where: 'elsewhere', base: 0 };
  }

  /** The student's "codon 6, base 2" or "intron 1, base 110", against where a double peak is. */
  function checkPlace(want, text) {
    var t = String(text || '').trim().toLowerCase();
    if (t === '') return { verdict: 'empty' };
    var m = t.match(/codon\s*(-?\d+)\D+(\d)/), n = t.match(/intron\s*(\d)\D+(\d+)/);
    if (want.where === 'codon') {
      if (!m) return { verdict: 'no', hint: 'Write it as "codon 6, base 2" (codons numbered as in Lehninger, from the valine after the starting Met).' };
      if (Number(m[1]) === want.codon + 1 && Number(m[2]) === want.base) return { verdict: 'no', hint: 'Count again: Lehninger numbers the codons from the first amino acid of the finished protein, after the starting Met is removed.' };
      return Number(m[1]) === want.codon && Number(m[2]) === want.base ? { verdict: 'ok' } : { verdict: 'no', hint: 'Count from the ATG along the exons only (the intron is spliced out).' };
    }
    if (want.where === 'intron 1' || want.where === 'intron 2') {
      if (!n) return { verdict: 'no', hint: 'This one is not in a codon. Write it as "intron 1, base 110".' };
      return 'intron ' + n[1] === want.where && Math.abs(Number(n[2]) - want.base) <= 0 ? { verdict: 'ok' } : { verdict: 'no', hint: 'Count from the intron\u2019s first base (the G of its GT).' };
    }
    return { verdict: 'no', hint: 'This position lies outside the codons and introns the page can check.' };
  }

  // ---- The genetic code ----

  var CODE = {};
  (function () {
    var b = 'TCAG', aa = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', i = 0;
    for (var x = 0; x < 4; x++) for (var y = 0; y < 4; y++) for (var z = 0; z < 4; z++) CODE[b[x] + b[y] + b[z]] = aa[i++];
  })();
  var THREE = { A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'stop' };

  /** A DNA sequence translated from its first base (a tool for the student: it does no splicing). */
  function translate(dna) {
    var d = cleanSequence(dna), out = '';
    for (var i = 0; i + 3 <= d.length; i += 3) out += CODE[d.substr(i, 3)] || 'X';
    return out;
  }

  /** The normal protein's first amino acids, from the reference (spliced), Lehninger's numbering (no Met). */
  function normalProtein(locus, n) {
    var cds = locus.coding.map(function (c) { return locus.reference.substring(c[0], c[1] + 1); }).join('');
    return translate(cds).substring(1, 1 + n);
  }

  function checkProtein(locus, text) {
    var t = String(text || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (t === '') return { verdict: 'empty' };
    var want = normalProtein(locus, 10);
    if (t === want) return { verdict: 'ok' };
    if (t === 'M' + want.substring(0, 9) || t === 'M' + want) return { verdict: 'no', hint: 'Leave out the starting Met: Lehninger numbers the protein from the amino acid after it.' };
    return { verdict: 'no', hint: 'Translate from the ATG, three bases at a time, in one-letter codes.' };
  }

  // ---- The conclusions, against the student's own readings (never against the patient) ----

  /** True when an allele named in the student's words is HbS. */
  function isSickle(text) { return /hbs\b|sickle|glu\s*6\s*val|e6v|val\s*6/i.test(String(text || '')); }

  /**
   * Whether the student's two alleles agree with their own gel (the bands they listed in the
   * patient's digested lane) and their own trace (its double peaks): words for what disagrees, or
   * an empty list. It never says whether the alleles are the patient's.
   */
  function disagreements(a1, a2, digestSizes, mixed) {
    var out = [];
    var s = (isSickle(a1) ? 1 : 0) + (isSickle(a2) ? 1 : 0);
    var has = function (bp) { return digestSizes.some(function (x) { return Math.abs(x - bp) / bp <= 0.06; }); };
    if (digestSizes.length) {
      if (s === 0 && has(381)) out.push('Your gel shows a band near 381 bp in the patient\u2019s digest, which an allele that keeps the DdeI site at codon 6 does not give.');
      if (s >= 1 && !has(381)) out.push('Your gel shows no band near 381 bp in the patient\u2019s digest, which an HbS allele gives.');
      if (s === 2 && (has(201) || has(180))) out.push('Your gel shows the bands of an allele that keeps the DdeI site (near 201 and 180 bp), which two HbS alleles would not give.');
    }
    if (mixed != null) {
      var same = String(a1 || '').trim().toLowerCase() === String(a2 || '').trim().toLowerCase();
      if (same && mixed > 0) out.push('Your trace shows double peaks, which two identical alleles would not give.');
      if (!same && mixed === 0) out.push('Your trace shows no double peak, which two different alleles would give (unless they differ outside what was read).');
    }
    return out;
  }

  // ---- The tube for sequencing: 5 µL of product, 2 µL of clean-up, then 1 µL of one primer and 2 µL of water ----

  var SEQ_ROWS = ['product', 'cleanup', 'primer', 'water'];
  var SEQ_RECIPE = { product: 5, cleanup: 2, primer: 1, water: 2 };

  function checkSeq(row, text) {
    if (String(text || '').trim() === '') return { verdict: 'empty' };
    var v = num(text);
    if (isNaN(v) || v < 0) return { verdict: 'bad' };
    if (Math.abs(v - SEQ_RECIPE[row]) <= 0.051) return { verdict: 'ok' };
    var hint = {
      product: 'The core asks for 5 µL of PCR product.',
      cleanup: 'The clean-up enzymes go in at 2 µL for each 5 µL of product.',
      primer: 'One primer, 1 µL of the 10 µM stock: it reads from one end only.',
      water: 'Water makes the tube up to 10 µL.'
    }[row];
    return { verdict: 'no', hint: hint };
  }

  // ---- Reading a trace ----

  var IUPAC = { AC: 'M', AG: 'R', AT: 'W', CG: 'S', CT: 'Y', GT: 'K' };
  var BASES = 'ACGT';

  /** The trace's peaks, position by position: [[a, c, g, t], ...] from the flat list the core sends. */
  function traceRows(heights) {
    var rows = [];
    for (var i = 0; i + 3 < heights.length; i += 4) rows.push([heights[i], heights[i + 1], heights[i + 2], heights[i + 3]]);
    return rows;
  }

  /**
   * The base called at each position: the tallest peak; two bases (an IUPAC letter) where the
   * second is at least 35% of the first; N where the peaks are too low to call.
   */
  function callBases(rows) {
    return rows.map(function (h) {
      var order = [0, 1, 2, 3].sort(function (a, b) { return h[b] - h[a]; });
      if (h[order[0]] < 150) return 'N';
      if (h[order[1]] >= 0.35 * h[order[0]]) return IUPAC[[BASES[order[0]], BASES[order[1]]].sort().join('')];
      return BASES[order[0]];
    }).join('');
  }

  /** Where the trace shows two peaks, after its poor first 20 bases: [{ at (1-based), bases: 'A/T' }]. */
  function mixedPositions(rows) {
    var out = [];
    for (var i = 20; i < rows.length; i++) {
      var h = rows[i];
      var order = [0, 1, 2, 3].sort(function (a, b) { return h[b] - h[a]; });
      if (h[order[0]] >= 150 && h[order[1]] >= 0.35 * h[order[0]]) out.push({ at: i + 1, bases: [BASES[order[0]], BASES[order[1]]].sort().join('/') });
    }
    return out;
  }

  /**
   * The student's list of double peaks ("188 A/T"), against the trace: 'ok' when it holds each one
   * (positions within 1), 'many' when the trace is a mixture almost throughout (then there is no
   * short list to give), 'no' with what is wrong.
   */
  function checkMixed(text, rows) {
    var mixed = mixedPositions(rows);
    var t = String(text || '').trim();
    if (t === '') return { verdict: 'empty' };
    if (mixed.length > 15) return /mix|many|from/i.test(t) ? { verdict: 'ok' } : { verdict: 'no', hint: 'This trace shows two peaks at very many positions: say from which position it becomes a mixture.' };
    if (/none|no\b|0/i.test(t) && mixed.length === 0) return { verdict: 'ok' };
    var got = (t.match(/\d+\s*[ACGT]\s*\/\s*[ACGT]/gi) || []).map(function (x) {
      var m = x.match(/(\d+)\s*([ACGT])\s*\/\s*([ACGT])/i);
      return { at: Number(m[1]), bases: [m[2].toUpperCase(), m[3].toUpperCase()].sort().join('/') };
    });
    if (got.length === 0) return { verdict: 'bad' };
    var miss = mixed.filter(function (m) { return !got.some(function (g) { return Math.abs(g.at - m.at) <= 1 && g.bases === m.bases; }); });
    var extra = got.filter(function (g) { return !mixed.some(function (m) { return Math.abs(g.at - m.at) <= 1 && g.bases === m.bases; }); });
    if (miss.length === 0 && extra.length === 0) return { verdict: 'ok' };
    return { verdict: 'no', hint: extra.length ? 'At least one of those positions does not show two peaks of those bases.' : 'There is a double peak you have not listed.' };
  }

  // ---- What the primers make from the reference, and what DdeI makes of it ----

  function revComp(s) {
    var c = { A: 'T', T: 'A', G: 'C', C: 'G' };
    var out = '';
    for (var i = s.length - 1; i >= 0; i--) out += c[s[i]] || 'N';
    return out;
  }

  function allAt(text, word) {
    var at = [], i = text.indexOf(word);
    while (i >= 0) { at.push(i); i = text.indexOf(word, i + 1); }
    return at;
  }

  /**
   * The product of two primers on a sequence (perfect matches only, as on the reference): the
   * forward primer on the top strand and the reverse primer's reverse complement after it, within
   * 3000 bases. Returns { start, end, length, seq } or { error }: 'none' (a primer is not in it),
   * 'facing' (they do not face each other), 'several' (more than one product).
   */
  function productOn(seq, fwd, rev) {
    fwd = cleanSequence(fwd); rev = cleanSequence(rev);
    if (fwd.length < 15 || rev.length < 15) return { error: 'short' };
    var pairs = [];
    [[fwd, rev], [rev, fwd]].forEach(function (pr) {
      var a = allAt(seq, pr[0]), b = allAt(seq, revComp(pr[1]));
      a.forEach(function (i) {
        b.forEach(function (j) {
          var end = j + pr[1].length;
          if (j >= i && end - i <= 3000 && end - i >= pr[0].length) pairs.push({ start: i, end: end });
        });
      });
    });
    if (pairs.length === 0) {
      var found = allAt(seq, fwd).length + allAt(seq, revComp(fwd)).length > 0 && allAt(seq, rev).length + allAt(seq, revComp(rev)).length > 0;
      return { error: found ? 'facing' : 'none' };
    }
    if (pairs.length > 1) return { error: 'several' };
    var p = pairs[0];
    return { start: p.start, end: p.end, length: p.end - p.start, seq: seq.substring(p.start, p.end) };
  }

  /** Where DdeI (C^TNAG) cuts: the index of the first base after each cut. */
  function ddeiCuts(seq) {
    var cuts = [];
    for (var i = 0; i + 5 <= seq.length; i++)
      if (seq[i] === 'C' && seq[i + 1] === 'T' && seq[i + 3] === 'A' && seq[i + 4] === 'G') cuts.push(i + 1);
    return cuts;
  }

  /** The fragments of a full digest, largest first. */
  function fragments(seq) {
    var bounds = [0].concat(ddeiCuts(seq)).concat([seq.length]);
    var out = [];
    for (var i = 1; i < bounds.length; i++) out.push(bounds[i] - bounds[i - 1]);
    return out.sort(function (a, b) { return b - a; });
  }

  /** The reference with the sickle change (HbS), or as it is (HbA). */
  function alleleSeq(locus, allele) {
    if (allele !== 'S') return locus.reference;
    var at = locus.sickle.at;
    return locus.reference.substring(0, at) + locus.sickle.to + locus.reference.substring(at + 1);
  }

  /**
   * What the student's primers should give from an HbA and an HbS allele: the undigested product
   * and the fragments of 50 bp or more after DdeI (smaller ones are faint and run near the dye).
   */
  function predictions(locus, fwd, rev) {
    var a = productOn(alleleSeq(locus, 'A'), fwd, rev);
    if (a.error) return { error: a.error };
    var s2 = productOn(alleleSeq(locus, 'S'), fwd, rev);
    var covers = a.start <= locus.atg && a.end >= locus.coding[1][0] + 3 * 43 - 92;
    var big = function (list) { return list.filter(function (x) { return x >= 50; }); };
    return {
      length: a.length,
      covers: covers,
      hbA: big(fragments(a.seq)),
      hbS: s2.error ? null : big(fragments(s2.seq))
    };
  }

  /** Numbers typed as a list ("381, 201 180"). */
  function numbers(text) {
    return String(text || '').split(/[^0-9.]+/).filter(function (t) { return t !== ''; }).map(Number).filter(function (x) { return !isNaN(x); });
  }

  /** A list of sizes against the right list: 'ok' when they match within 3 bp each, in any order. */
  function checkSizes(text, want) {
    var got = numbers(text);
    if (got.length === 0) return { verdict: 'empty' };
    if (got.length !== want.length) return { verdict: 'no', hint: got.length < want.length ? 'There are more fragments of 50 bp or more than that.' : 'There are fewer fragments of 50 bp or more than that.' };
    var left = want.slice();
    for (var i = 0; i < got.length; i++) {
      var k = -1;
      for (var j = 0; j < left.length; j++) if (Math.abs(left[j] - got[i]) <= 3) { k = j; break; }
      if (k < 0) return { verdict: 'no', hint: 'Count again from each DdeI site (C^TNAG) to the next, and to the ends of the product.' };
      left.splice(k, 1);
    }
    return { verdict: 'ok' };
  }

  // ---- The gel ----

  var GEL_ML = 50;
  function gelGrams(percent) { return percent * GEL_ML / 100; }
  function checkGrams(percent, text) {
    if (String(text || '').trim() === '') return { verdict: 'empty' };
    var v = num(text);
    if (isNaN(v) || v <= 0) return { verdict: 'bad' };
    if (Math.abs(v - gelGrams(percent)) <= 0.011) return { verdict: 'ok' };
    return { verdict: 'no', hint: 'A 1% gel holds 1 g of agarose in 100 mL.' };
  }

  var LADDER = [1500, 1200, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100];

  /** Whether a distance typed is a band in that lane of the picture (within 1 mm). */
  function checkMm(bands, text) {
    if (String(text || '').trim() === '') return { verdict: 'empty' };
    var v = num(text);
    if (isNaN(v) || v < 0) return { verdict: 'bad' };
    for (var i = 0; i < (bands || []).length; i++) if (Math.abs(bands[i].mm - v) <= 1.0) return { verdict: 'ok' };
    return { verdict: 'no', hint: 'Measure from the bottom of the well to the middle of the band, against the ruler.' };
  }

  /** The straight line of log10(size) against distance, from the ladder's rows: { slope, intercept, r2, n } or null. */
  function ladderLine(rows) {
    var pts = rows.filter(function (r) { return r.mm > 0 && r.bp > 0; });
    if (pts.length < 3) return null;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    pts.forEach(function (r) { var x = r.mm, y = Math.log(r.bp) / Math.LN10; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y; });
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    var intercept = (sy - slope * sx) / n;
    var ssTot = syy - sy * sy / n, ssRes = 0;
    pts.forEach(function (r) { var e = Math.log(r.bp) / Math.LN10 - (intercept + slope * r.mm); ssRes += e * e; });
    return { slope: slope, intercept: intercept, r2: ssTot > 0 ? 1 - ssRes / ssTot : 1, n: n };
  }

  function sizeFrom(line, mm) { return Math.pow(10, line.intercept + line.slope * mm); }

  /** A size typed against the student's own line: within 5%. */
  function checkSize(line, mm, text) {
    if (String(text || '').trim() === '') return { verdict: 'empty' };
    var v = num(text);
    if (isNaN(v) || v <= 0) return { verdict: 'bad' };
    if (!line) return { verdict: 'no', hint: 'Fill in the ladder first: the size comes from its line.' };
    var want = sizeFrom(line, mm);
    if (Math.abs(v - want) / want <= 0.05) return { verdict: 'ok' };
    return { verdict: 'no', hint: 'Read the size from your ladder line at this distance: size = 10^(intercept + slope x distance).' };
  }

  // ---- The thermocycler's program ----

  var PROGRAM_FIELDS = [
    { id: 'initialC', label: 'Initial denaturation', unit: '°C', def: '95' },
    { id: 'initialS', label: '', unit: 's', def: '120' },
    { id: 'cycles', label: 'Cycles', unit: '', def: '' },
    { id: 'denatureC', label: 'Denature', unit: '°C', def: '95' },
    { id: 'denatureS', label: '', unit: 's', def: '30' },
    { id: 'annealC', label: 'Anneal', unit: '°C', def: '' },
    { id: 'annealS', label: '', unit: 's', def: '30' },
    { id: 'extendC', label: 'Extend', unit: '°C', def: '72' },
    { id: 'extendS', label: '', unit: 's', def: '' },
    { id: 'finalC', label: 'Final extension', unit: '°C', def: '72' },
    { id: 'finalS', label: '', unit: 's', def: '300' }
  ];

  /** The step the bench takes ("program 95 120 30 ..."), or an error: the first empty or unreadable box. */
  function programStep(values) {
    var parts = [];
    for (var i = 0; i < PROGRAM_FIELDS.length; i++) {
      var f = PROGRAM_FIELDS[i], v = num(values[f.id]);
      if (isNaN(v)) return { error: f.id };
      parts.push(String(v));
    }
    return { step: 'program ' + parts.join(' ') };
  }

  // ---- Words for what the bench says ----

  var BLOCKED = {
    'no-pipette': 'Pick up a pipette first (click one on its stand, or choose one beside the room).',
    'unknown-pipette': 'That is not one of the pipettes.',
    'out-of-range': 'That pipette cannot be set to that volume. The P2 takes 0.2 to 2 µL, the P20 2 to 20 µL and the P200 20 to 200 µL.',
    'has-tip': 'There is already a tip on the pipette.',
    'no-tip': 'Put a tip on the pipette first.',
    'tip-wont-fit': 'Those tips do not fit this pipette: the P2 takes the 10 µL tips, the P20 and the P200 the 200 µL tips.',
    'tip-full': 'The tip still holds liquid. Dispense it first.',
    'tip-empty': 'The tip is empty. Draw from a stock first.',
    'unknown-stock': 'That is not one of the stocks.',
    'unknown-tube': 'That is not one of the tubes.',
    'no-primers-yet': 'Your primers are not in their tubes yet. Enter them in part 1 and press "Use these primers".',
    'primer-length': 'A primer must be 15 to 40 bases long, written as A, C, G and T.',
    'primers-in-use': 'Your primers are already in the tubes. To use others, start the set-up again.',
    'not-in-block': 'That tube is not in the cold block.',
    'capped': 'That tube is capped. Uncap it first.',
    'already-run': 'That tube has already been through the thermocycler.',
    'tube-full': 'That would overfill the tube.',
    'uncapped-flick': 'Cap the tube before you flick it.',
    'uncapped-spin': 'Cap every tube before the spin: an open tube would spray its contents round the rotor.',
    'empty': 'There is nothing in it yet.',
    'running': 'The thermocycler is running.',
    'lid-closed': 'Open the thermocycler\'s lid first.',
    'lid-open': 'Close the thermocycler\'s lid first: it heats the tubes from above.',
    'no-program': 'Send the thermocycler a program first.',
    'no-tubes': 'There are no tubes in the thermocycler.',
    'bad-program': 'The program is not complete.',
    'bad-temperature': 'Each temperature must be between 4 and 99 °C.',
    'bad-time': 'Each time must be between 0 and 900 seconds.',
    'bad-cycles': 'The number of cycles must be between 1 and 50.',
    'unknown-step': 'The bench did not understand that step.',
    'not-run': 'That PCR tube has not been through the thermocycler yet.',
    'not-enough': 'There is not that much left in the tube.',
    'wrong-target': 'That does not go there.',
    'bad-amount': 'That amount is not one the balance or the cylinder can give.',
    'already-poured': 'The gel is already poured. For a fresh one, start the gel again.',
    'flask-empty': 'The flask is empty: agarose and TAE go in first.',
    'not-dissolved': 'The agarose has not all melted: some grains still float in the flask. A little longer in the microwave.',
    'set-in-flask': 'The agarose has set in the flask. Melt it again in the microwave.',
    'gel-poured': 'The gel is poured round the comb: take the comb out once the gel has set.',
    'not-poured': 'The gel has not been poured yet.',
    'no-comb': 'There is no comb in the tray.',
    'not-set': 'The gel has not set yet.',
    'comb-in': 'Take the comb out first.',
    'buffer-in': 'The gel is already under the buffer.',
    'not-in-box': 'Put the gel in the gel box first.',
    'power-on': 'Switch the power supply off first.',
    'lid-off': 'Put the lid on the gel box first: the leads plug into it.',
    'bad-volts': 'Set the power supply to 20 to 150 V.',
    'no-leads': 'Connect the leads first.',
    'not-on-blue': 'Put the gel on the blue-light box first.',
    'blue-off': 'Switch on the blue light first.',
    'unknown-well': 'That is not one of the wells.',
    'no-wells': 'There are no wells: the gel was poured without the comb, or the comb is still in.',
    'no-buffer': 'Cover the gel with TAE before you load it.',
    'well-full': 'That would overfill the well: a well holds about 20 µL.',
    'well-used': 'That well already holds something else.',
    'bad-heat': 'The heat block is set to 37 °C or to 80 °C.',
    'nothing-sent': 'No tube went to the sequencing core in Session 1.',
    'already-sent': 'That tube has gone to the sequencing core.',
    'in-heat': 'That tube is in the heat block. Take it out first.',
    'no-product': 'There is no PCR product in that tube.'
  };

  var WARN = {
    'dirty-tip-stock': function (d) { return 'This tip has touched something else. Put it back into the ' + stockName(d).replace(/ \(.*\)$/, '').toLowerCase() + ' stock and it leaves a trace of that there, in every tube that stock goes into afterwards. A fresh tip costs nothing.'; },
    'stop-run': function () { return 'The thermocycler is still running. Opening the lid stops the program where it is.'; },
    'uncapped': function () { return 'A tube in the thermocycler is open. At 95 °C it will dry out.'; },
    'unmixed': function () { return 'A tube has not been mixed since the last thing went in. The master mix is dense and sinks: flick the capped tube first.'; },
    'unspun': function () { return 'A tube has not had a quick spin. Drops on the wall or the cap miss the reaction.'; },
    'not-set': function () { return 'The gel has not set yet. Pulling the comb now tears the wells.'; },
    'no-buffer': function () { return 'The gel is not under buffer. With no buffer the current has nowhere to go but through the gel, which heats and dries it.'; },
    'boil-over': function () { return 'A long burst boils a flask of agarose over. Heat it in short bursts (about 30 s) and swirl between them.'; },
    'too-hot': function () { return 'The agarose is still above 70 °C. Poured this hot it can warp the tray, and the steam fogs the gel. Let it cool to about 55 °C.'; },
    'too-cool': function () { return 'The agarose has cooled below 48 °C and is starting to set: the gel will have lumps in it.'; },
    'no-stain': function () { return 'There is no stain in the agarose: the DNA will not show under the blue light.'; },
    'no-comb': function () { return 'The comb is not in the tray: the gel will have no wells.'; },
    'no-dye': function () { return 'There is no loading dye in that sample. Without it the sample is lighter than the buffer and floats up out of the well.'; },
    'primer-eaten': function () { return 'The clean-up enzymes are still alive: they eat single-stranded DNA, and a primer is single-stranded. Kill them first (15 minutes at 80 °C), then add the primer.'; },
    'no-seq-primer': function () { return 'There is no primer in that tube: the core has nothing to start reading from.'; },
    'not-cleaned': function () { return 'That tube has not been cleaned up. The PCR\u2019s own leftover primers will read too, from both ends, and the trace will be a mixture.'; }
  };

  var MISTAKES = {
    'dirty-stock-water': 'The water stock now holds a trace of DNA. PCR finds even a few copies: a band in the tube with no DNA would show it.',
    'dirty-stock-mastermix': 'The master mix stock now holds a trace of something else.',
    'dirty-stock-fwd': 'The forward primer stock now holds a trace of something else.',
    'dirty-stock-rev': 'The reverse primer stock now holds a trace of something else.',
    'dirty-stock-patient': 'The patient\'s DNA stock now holds a trace of something else.',
    'dirty-stock-control': 'The control DNA stock now holds a trace of the patient\'s DNA.',
    'uncapped': 'A tube went through the run open: it dried out, and nothing will come of it.',
    'unmixed': 'A tube went into the run unmixed: expect less product from it.',
    'unspun': 'A tube went into the run without a spin: a little of it missed the reaction.',
    'run-stopped': 'The run was stopped before it finished: the tubes had fewer cycles than the program asked for.',
    'torn-wells': 'The comb came out before the gel had set, and tore some of the wells: their lanes will be lost.',
    'dry-run': 'The current ran with no buffer over the gel.',
    'boiled-over': 'The agarose boiled over. Water foamed out, so the gel is stronger than you meant.',
    'poured-hot': 'The gel was poured very hot.',
    'lumpy': 'The gel was poured as it began to set: it has lumps, and its bands may be uneven.',
    'no-stain': 'The gel has no stain in it: nothing will show under the blue light.',
    'no-wells': 'The gel was poured without the comb: it has no wells.',
    'floated': 'A sample went in without loading dye and floated out of its well.',
    'ran-backwards': 'The DNA is running out of the wells into the buffer, away from the gel: the wells are at the wrong end, or the leads are the wrong way round.',
    'primer-eaten': 'The primer went in with the clean-up enzymes still alive: they ate it, and that tube will give no trace.',
    'no-seq-primer': 'A tube went to the core with no primer in it.',
    'not-cleaned': 'A tube went to the core without the clean-up.'
  };

  var NOTICES = {
    'run-started': 'The thermocycler is running. "Speed up the wait" makes the bench clock run 60 times faster.',
    'run-done': 'The run is over. The block holds the tubes at 4 °C.',
    'fresh-setup': 'Fresh tubes and fresh stocks: the set-up starts again.',
    'power-on': 'The current is on. Watch the electrodes: bubbles mean current is flowing.',
    'fresh-gel': 'A fresh flask and tray: the gel starts again.',
    'sent': 'The tube is in the core\u2019s drop-off. The results come back by Session 2.'
  };

  function blockedText(code) { return BLOCKED[code] || 'The bench refused that step.'; }
  function warnText(code, detail) { var f = WARN[code]; return f ? f(detail) : 'That step may go wrong.'; }
  function mistakeText(code) { return MISTAKES[code] || 'Something went wrong at the bench.'; }
  function noticeText(code) { return NOTICES[code] || ''; }

  // ---- Numbers as the page shows them ----

  function clockText(minutes) {
    var s = Math.max(0, Math.round(minutes * 60));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    return h > 0 ? h + ':' + two(m) + ':' + two(sec) : m + ':' + two(sec);
  }

  function ul(x) {
    if (!(x > 0.0005)) return '0';
    return String(Math.round(x * 100) / 100);
  }

  function cleanSequence(text) { return String(text || '').toUpperCase().replace(/[^ACGT]/g, ''); }

  var api = {
    normalizeCode: normalizeCode, validCode: validCode, randomCode: randomCode,
    STOCKS: STOCKS, TARGETS: TARGETS, TUBES: TUBES, PIPETTES: PIPETTES, ROWS: ROWS, REACTION: REACTION,
    DIGEST: DIGEST, DIGEST_ROWS: DIGEST_ROWS, digestRecipe: digestRecipe, checkDigest: checkDigest,
    revComp: revComp, productOn: productOn, ddeiCuts: ddeiCuts, fragments: fragments, alleleSeq: alleleSeq,
    predictions: predictions, numbers: numbers, checkSizes: checkSizes,
    GEL_ML: GEL_ML, gelGrams: gelGrams, checkGrams: checkGrams, LADDER: LADDER, checkMm: checkMm,
    ladderLine: ladderLine, sizeFrom: sizeFrom, checkSize: checkSize,
    checkBlast: checkBlast, tm: tm, gc: gc, threeEndPairing: threeEndPairing, hairpin: hairpin, placesOn: placesOn,
    hbdMismatches: hbdMismatches, primerChecks: primerChecks, traceToReference: traceToReference, placeInGene: placeInGene,
    checkPlace: checkPlace, translate: translate, normalProtein: normalProtein, checkProtein: checkProtein, THREE: THREE,
    isSickle: isSickle, disagreements: disagreements,
    SEQ_ROWS: SEQ_ROWS, checkSeq: checkSeq, traceRows: traceRows, callBases: callBases, mixedPositions: mixedPositions, checkMixed: checkMixed,
    stockName: stockName, tubeName: tubeName,
    recipe: recipe, checkRecipe: checkRecipe, pipetteFor: pipetteFor, num: num,
    PROGRAM_FIELDS: PROGRAM_FIELDS, programStep: programStep,
    blockedText: blockedText, warnText: warnText, mistakeText: mistakeText, noticeText: noticeText,
    BLOCKED: BLOCKED, WARN: WARN, MISTAKES: MISTAKES, NOTICES: NOTICES,
    clockText: clockText, ul: ul, cleanSequence: cleanSequence
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DnaLabModel = api;
})(this);
