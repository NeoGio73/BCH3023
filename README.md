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
license), adapted. Lab chair: "Laboratories - Big Pack" by Mixall (Unity Asset Store).

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

- Prelab review (30 to 40 minutes, to read before the lab: hemoglobin and its genes, DNA strands,
  BLAST, PCR and primer design, setting up a reaction, restriction digests, agarose gels, Sanger
  sequencing, from gene to protein, naming a change and looking it up in ClinVar, and a protein in
  3D; with figures, small tools, practice boxes and a quiz, all on made-up examples):
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
by 3D Addicts, "Paper Towel Dispenser" by Joyble. Lab chair, vortex, balance, power supply and the
tubes on the shelf: "Laboratories - Big Pack" by Mixall (Unity Asset Store).

## Ubiquitous, Yet Hard to See

A virtual protein NMR lab in two sessions, with a short visit to X-ray crystallography. Everyone
works on the same small protein, ubiquitin (76 amino acids), and sees why even a protein this small
was so hard to work out. In Session 1 the student takes three samples into a 1.2 GHz NMR magnet (up
the platform, down into the magnet; lock, shim, tune, 25 °C), records the spectra used on proteins
and reads each one: the crowded 1D proton spectrum, and what a bigger protein's slower tumbling
does to it; a TOCSY, to name an amino acid from its spin system; a NOESY, and the crowd of amide
protons that share a shift; the ¹H–¹⁵N HSQC, the protein's fingerprint, and how many peaks a
sequence gives; a mystery sample, folded or unfolded; the D₂O shake, with amides fading over four
weeks; and a short sequential walk with HNCACB strips. In Session 2 they watch two partner domains
(SH3-A and SH3-C of CD2AP) bind in HSQC titrations, see how NOEs become a structure (the NMR
bundle, and an ensemble of its motion), then in the X-ray room choose a crystal from a plate,
freeze, mount and shoot it, and read its resolution from the frame, its electron density at three
resolutions and its B-factors. They lay the crystal structure, the NMR structure and AlphaFold's
prediction over one another, and end with where the field is now.

**Open the lab**

- Prelab review (to read before the lab, in three parts: the basics of NMR and of a protein's
  atoms; Session 1's techniques, from why a protein is hard to reading 2D spectra, the HSQC,
  exchange and the sequential walk; Session 2's, from NOEs to a structure, binding, crystals,
  diffraction and density to prediction; with spectra to point at, small tools and check-yourself
  questions, all on made-up examples):
  https://neogio73.github.io/BCH3023/ubiquitous-yet-hard-to-see/prelab/
- Session 1 (the NMR hall: the spectra and what each one shows):
  https://neogio73.github.io/BCH3023/ubiquitous-yet-hard-to-see/
- Session 2 (binding, the structure, the crystal, the comparison and where the field is now):
  https://neogio73.github.io/BCH3023/ubiquitous-yet-hard-to-see/?part=2
- Guides (PDFs to keep open beside the lab: every step, what to see and why, and what to do when
  the hall objects): https://neogio73.github.io/BCH3023/ubiquitous-yet-hard-to-see/guide/guide-to-session-1.pdf
  and https://neogio73.github.io/BCH3023/ubiquitous-yet-hard-to-see/guide/guide-to-session-2.pdf

How it works

- Everyone studies ubiquitin, but each student's questions are their own, from a five-character
  code at the top of the page (an address ending in `?code=` and a code opens a chosen one): the
  residue to name, a made-up protein's mass and sequence, the mystery sample's share unfolded, three
  amides to follow in D₂O and the stretch to walk; in Session 2, the residue whose NOEs to count,
  the residues to compare in the bundle and by B-factor, the partner and the peak to measure, the
  plate of drops, the detector's distance and the crystal's resolution, and the order of the maps.
- Every peak is placed at a measured chemical shift (BMRB entries 17769, 16626 and 17439; the
  binding shifts from 19447 and 18737, Ortega Roldan and colleagues, 2013). The NOEs come from the
  NMR structure PDB 1D3Z and the exchange rates from LeMaster, Anderson and Hernández
  (Biochemistry, 2009). Line widths, heights and the fading in D₂O are modelled, and the electron
  density maps are computed from the atoms of the crystal structure, PDB 1UBQ, not measured.
- Pointing at a peak of a 2D spectrum draws dotted lines to the shifts it links: on the lab page
  the shifts only, in the prelab with its made-up protons named.
- The page checks each answer as it is entered, against the data and the student's own readings.
  The written questions are saved and printed but not checked.
- The 3D structures (PDB 1UBQ, 1D3Z and 2K39, and AlphaFold DB's model AF-P0CG47-F1, used under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) are shown with 3Dmol.js; they need
  an internet connection.
- Work is saved in the student's own browser, and the two sessions share it. A different browser
  or computer starts afresh.
- "Print the report, or save it as a PDF" at the end of each session gives its report.

Keyboard and mouse: "Keyboard and Mouse black" by Demycs (BlendKit, royalty-free license). Lab
furniture and equipment: "Laboratories - Big Pack" by Mixall (Unity Asset Store). The magnet's
maker, BROKER, and its name, Pinnacle, are made up.

## Introduction to Molecular Modeling

Reading a protein's structure in 3D. The prelab works a PDB file through step by step on glucagon
(PDB 1GCN): the axes and views, the two ends of the chain, the sequence, the helix, the acidic,
basic and aromatic side chains, an angle at an α-carbon, and what BLAST finds. In the lab each
student is given one of 59 small proteins, solved by X-ray crystallography, with its name, source
and authors taken out of its file; they read its structure, measure it, and then find out what it
is by searching its sequence with BLAST.

**Open the lab**

- Prelab (glucagon, worked out, with each answer explained):
  https://neogio73.github.io/BCH3023/molecular-modeling/prelab/
- The lab: https://neogio73.github.io/BCH3023/molecular-modeling/

How it works

- Each student has their own unknown protein, shown as a five-character code at the top of the
  page (an address ending in `?code=` and a code opens a chosen one). The protein's name, its
  organism and what it does are never checked on the page: the instructor marks them.
- The page checks every other answer as it is entered, against the student's own file: the views,
  the two ends, the sequence, the helices and disulfides, the side chains, and the N–Cα–C angle at
  a residue picked from the code. A wrong answer is told where to look, never the answer.
- "Take me there" buttons turn the molecule to the part a question is about, without naming it,
  and "Full screen" shows the molecule and the questions together.
- The structures come from the RCSB Protein Data Bank and are drawn with 3Dmol.js; the pages need
  an internet connection.
- Work is saved in the student's own browser. "Print or save as PDF" gives the report, with a
  picture of the student's own view of their protein.


## Study guides and workbenches

Interactive pages for studying on your own, each a single file that opens in any browser. The
study guides start with a roadmap and work through their topic in sections, each with models to
explore, the key facts, and practice with feedback. The workbenches are hands-on: build a
molecule or run a process, then check yourself. Names and values follow Lehninger, *Principles of
Biochemistry*, 8th ed. Nothing is graded or recorded.

| Page | Topic | Sections |
| --- | --- | --- |
| [Carbohydrates Study Guide](https://neogio73.github.io/BCH3023/study-guides/carbohydrates-study-guide.html) | Lehninger ch. 7 | Monosaccharides · Rings and anomers · Derivatives and reducing sugars · Glycosidic bonds · Polysaccharides · Glycosaminoglycans and proteoglycans · Glycoproteins and glycolipids · The sugar code · Working with carbohydrates |
| [Lipids Study Guide](https://neogio73.github.io/BCH3023/study-guides/lipids-study-guide.html) | Lipids, membranes, lipid metabolism | Fatty acids and fats · Membrane lipids · Signals and cofactors · Lab methods · Membranes · Digestion and transport · β Oxidation · Ketone bodies · Fatty acid synthesis · Fats and phospholipids · Cholesterol and lipoproteins |
| [Lipid Workbench](https://neogio73.github.io/BCH3023/study-guides/lipid-workbench.html) | Lipid structure and assembly | Build storage and membrane lipids · Cut them with phospholipases · Self-assembly in water · Membrane fluidity · Challenges |
| [DNA Workbench](https://neogio73.github.io/BCH3023/study-guides/dna-workbench.html) | Nucleic acids and DNA technology | Strand builder · Double helix · Melting · PCR · Restriction digest and gel · Cloning · Sanger sequencing · CRISPR–Cas9 |
| [Gluconeogenesis Workbench](https://neogio73.github.io/BCH3023/study-guides/gluconeogenesis-workbench.html) | Gluconeogenesis and its regulation | Pathway map · Why bypass? · Compartments · What can become glucose? · Energy ledger · Reciprocal regulation · Fed vs fasted · Cori and glucose–alanine cycles |

The DNA Workbench loads its fonts from Google Fonts and falls back to built-in fonts without them;
the other pages load nothing from other sites.

## The Enzyme's Handshake

Organic chemistry done by enzymes, and measured by how well they tell mirror-image molecules
apart, in two sessions. In Session 1, baker's yeast reduces ethyl acetoacetate to ethyl
3-hydroxybutanoate, mostly the (S) enantiomer: the student wakes the yeast, feeds it the ketone on a
sped-up bench clock, filters off the cells through Celite, salts out and extracts the product,
dries and evaporates it, weighs it, measures its rotation on a digital polarimeter (the ee) and
runs its ¹H NMR (what else is in it). In Session 2, the lipase CAL-B (Novozym 435) with vinyl
acetate acylates one enantiomer of a racemic secondary alcohol faster than the other: the student
follows it on a chiral GC, stops it near 50%, separates the acetate from the alcohol left on a
column, and works out the two ee values, the conversion and the enzyme's selectivity, E, then which
enantiomer it preferred and whether the Kazlauskas rule predicts it.

**Open the lab**

- Prelab review (to read before the lab: enantiomers and ee, optical rotation, chiral GC, the yeast,
  the lipase on its beads, kinetic resolution and E, the Kazlauskas rule, and the bench techniques,
  each topic with a drawn figure, small tools and check-yourself questions, all on made-up examples):
  https://neogio73.github.io/BCH3023/enzyme-handshake/prelab/
- Session 1 (the yeast): https://neogio73.github.io/BCH3023/enzyme-handshake/
- Session 2 (the lipase): https://neogio73.github.io/BCH3023/enzyme-handshake/?part=2
- Guide (a PDF to keep open beside the lab: every step, what to see and why, and the bench's
  warnings): https://neogio73.github.io/BCH3023/enzyme-handshake/guide/guide-to-the-lab.pdf

How it works

- Each student has a five-character code at the top of the page (an address ending in `?code=` and
  a code opens a chosen one). It sets how their yeast is fed in Session 1 (one portion, two with
  fresh sugar, slow feeding, or starved yeast: each with its published ee) and, in Session 2, which
  of 17 alcohols with published CAL-B selectivities they resolve, and how much enzyme their handout
  gives.
- Every step can be done in the 3D room, by clicking the thing it uses, or with its button on the
  page. Mistakes are allowed and warned about, never blocked: water too hot for the yeast, no Celite
  bed, an emulsion, wet solvent, too much enzyme, a warm shaker, an air bubble in the polarimeter
  tube, an overloaded GC sample, the wrong eluent.
- The page checks the student's own numbers as they are entered: the yield, the specific rotation
  and ee, the NMR assignments and the ketone left, the ee values from their own peak areas, the
  conversion and E (Chen, Fujimoto, Girdaukas and Sih, 1982). Which enantiomer the lipase
  preferred, and whether the rule held, are never checked: the instructor marks them.
- Peaks on the chiral column are named from a pure (R) standard, run the same way; their order
  differs from one alcohol to the next. Retention times are modelled except 1-phenylethanol's.
- Work is saved in the student's own browser, and the two sessions share the code. A different
  browser or computer starts afresh. "Print or save as PDF" at the end of each session gives its
  report, with a summary of what the page accepted and what the bench warned about.

Fume hood model: "Dm3-004-08" by foxart3d, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Keyboard and mouse: "Keyboard and Mouse
black" by Demycs (BlendKit, royalty-free license). Lab furniture and equipment: "Laboratories - Big
Pack" by Mixall (Unity Asset Store). Flasks and beakers: Liquid Volume Pro (Kronnect). The stirring
hotplate, rotary evaporator and polarimeter are modelled after common instruments, with no maker's
name; the magnet's maker, BROKER, and the instruments' maker, ThermoFritter, are made up.
