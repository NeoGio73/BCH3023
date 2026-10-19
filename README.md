# BCH3023

Course materials for BCH3023 that run in a web browser.

## Biofuel Enzyme Lab

A virtual lab set in a fume hood: a simulation of the Bio-Rad Biofuel Enzyme Kit experiment
(catalog 166-5035EDU). Students pipet the reactions with the enzyme cellobiase, stop timed samples
in cuvettes of stop solution, compare the yellow color with five standards by eye, read the
absorbance at 410 nm in a spectrophotometer, and work out reaction rates.

**Open the lab**

- Prelab review (about ten minutes, to read before the lab: the reaction, how the color becomes a
  number, how an amount becomes a rate, and how the bench works):
  https://neogio73.github.io/BCH3023/enzyme-lab/prelab/
- Activities 1 to 3 (enzyme or no enzyme, temperature, pH):
  https://neogio73.github.io/BCH3023/enzyme-lab/
- Activities 4 and 5 (enzyme concentration, substrate concentration):
  https://neogio73.github.io/BCH3023/enzyme-lab/?part=2

How it works

- The numbers follow the typical classroom results in the kit's manual, with a little scatter, so
  each student's results differ slightly from anyone else's.
- The page checks each color match, absorbance, amount and rate as it is entered. The written
  questions are saved and printed but not checked.
- "Print or save as PDF" gives a report with the tables, the graphs and the student's answers.
- Work is saved in the student's own browser. The two pages share it, so the standard curve from
  the first session is there in the second. A different browser or computer starts afresh.
- Activity 3 samples at 2 minutes, as in the manual's typical results. Activity 6 (mushroom
  extract) is not included.

Fume hood model: ["Dm3-004-08"](https://sketchfab.com/3d-models/dm3-004-08-a640c09386df411e8669ddb19e3fd40f)
by foxart3d, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), shown with the
sash raised and with different materials.

## Purifying a Glowing Protein

A virtual lab at an open bench, in two parts. Each student's bacteria make one fluorescent protein
carrying a His-tag (one of nine proteins with one of three tags). In Part 1 the student breaks the
cells open (lysozyme and the sonicator), clears the lysate in the centrifuge (balanced, at the
right speed and time) and purifies the protein on a nickel (Ni-NTA) column: equilibrate, load,
wash twice, elute in four fractions, and find the protein under a UV or blue lamp. In Part 2 they
measure what they purified (a Bradford assay against BSA standards, the fluorimeter's readings and
its excitation and emission scans), cast and run an SDS gel and read their protein's mass from the
ladder, work out a purification table, and decide which protein and which tag their unknown is.
Every step is done by hand. When a step is about to go wrong the bench warns first; when
something does go wrong it says what that does to the result and lets the student start that part
again.

**Open the lab**

- Prelab review (to read before the lab: tags and nickel, breaking cells, the centrifuge, the
  column, fluorescence, the Bradford assay, the gel and the purification table, with made-up
  examples): https://neogio73.github.io/BCH3023/protein-purification-lab/prelab/
- Part 1 (from the cell pellet to the purified protein):
  https://neogio73.github.io/BCH3023/protein-purification-lab/
- Part 2 (the measurements, the gel, the purification table and the identification):
  https://neogio73.github.io/BCH3023/protein-purification-lab/?part=2
- Guide to Part 2 (a PDF to keep open beside the lab: every step, what to see and why, what to do
  when the bench objects, and a one-page quick reference):
  https://neogio73.github.io/BCH3023/protein-purification-lab/guide/guide-to-part-2.pdf

How it works

- Each student has their own unknown, shown as a five-character code at the top of the page (an
  address ending in `?code=` and a code opens a chosen one). Which protein and tag it is, is never
  checked on the page: the student chooses from a reference sheet and gives their evidence, and
  the instructor marks it.
- The protocol follows QIAGEN's *The QIAexpressionist* (lysis, wash and elution buffers with 10,
  20 and 250 mM imidazole; 1 mL of 50% Ni-NTA slurry), Bio-Rad's Quick Start Bradford manual
  (20 µL of sample in 1 mL of dye, read at 595 nm, BSA standards from 0.125 to 2 mg/mL) and its
  Mini-PROTEAN manual (a 10% resolving and a 4% stacking gel, 200 V). The fluorescent proteins'
  properties are from FPbase. The bench clock runs in real time; "Speed up the wait" runs it 60
  times faster.
- The page checks each reading against what the instrument showed, and each calculation against
  the student's own earlier numbers (the standard curve, the dilutions, the gel's ladder line, the
  purification table), with a hint for the commonest slips. The written questions are saved and
  printed but not checked.
- Adding `&warnings=after` to the address turns off the warnings before a step (the notes after a
  mistake stay).
- Work is saved in the student's own browser, and the two parts share it: Part 2 measures the
  samples kept in Part 1. A different browser or computer starts afresh.
- "Print or save as PDF" on each part gives its report.

Centrifuge model: "Table centrifuge with blood samples" by Steffen, from BlendKit (royalty-free
license), adapted.

## The Hemoglobin Clinic

A virtual molecular biology lab in two sessions. Each student is given a patient (one of thirty,
each with two copies of the beta-globin gene, HBB) and works out from the patient's DNA which
hemoglobin variants they carry. In Session 1 the student identifies a read with BLAST, designs a
pair of PCR primers (checked against the page's rules and with Primer-BLAST), and sets up and runs
the PCR by hand at the bench: the recipe, the pipettes and tips, the thermocycler's program. In
Session 2 they digest the product with DdeI, cast and run an agarose gel and size the bands from
the ladder, clean up the product and send it for Sanger sequencing, read the trace for double
peaks, translate the gene, look at normal and sickle hemoglobin in 3D, and write a diagnosis and a
report. Every step is done by hand. When a step is about to go wrong the bench warns first; when
something does go wrong the result shows it, as it would on a real bench.

**Open the lab**

- Prelab review (to read before the lab: reverse complements, primer rules, a PCR recipe,
  restriction digests, reading a gel and a trace, and translation, with made-up examples):
  https://neogio73.github.io/BCH3023/hemoglobin-clinic/prelab/
- Session 1 (BLAST, primer design and the PCR):
  https://neogio73.github.io/BCH3023/hemoglobin-clinic/
- Session 2 (the digest, the gel, the sequencing, the protein and the diagnosis):
  https://neogio73.github.io/BCH3023/hemoglobin-clinic/?part=2
- Guide (a PDF to keep open beside the lab: every step, what to see and what to do when the bench
  objects): https://neogio73.github.io/BCH3023/hemoglobin-clinic/guide/how-to-run-the-clinic.pdf

How it works

- Each student has their own patient, shown as a five-character code at the top of the page (an
  address ending in `?code=` and a code opens a chosen one). The patient's alleles and diagnosis
  are never checked on the page: the student gives them with their evidence, and the instructor
  marks them.
- The PCR is worked out from the student's own primers on the real human beta-globin locus
  (GenBank NG_000007.3, which also holds the closely related delta-globin gene, HBD), with melting
  temperatures as Primer-BLAST computes them. Primers that also fit HBD, bind poorly or pair with
  each other give the products they would give.
- The page checks each recipe, program, band size, sequencing position and translation as it is
  entered, against the student's own gel and trace, with a hint for the commonest slips. The
  report's footer says how many entries were wrong before they were right.
- The 3D structures are PDB entries 2HHB and 2HBS, shown with 3Dmol.js; they need an internet
  connection.
- Work is saved in the student's own browser, and the two sessions share it: Session 2 uses the
  PCR product made in Session 1. A different browser or computer starts afresh.
- "Print the report, or save it as a PDF" at the end of Session 2 gives the report.

Models from BlendKit (royalty-free license): "Microwave Oven" by hd poly, "Disposable Gloves Box"
by 3D Addicts, "Paper Towel Dispenser" by Joyble.
