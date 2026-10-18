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

## Purifying a Glowing Protein (preview: Part 1)

A virtual lab at an open bench. Each student's bacteria make one fluorescent protein carrying a
His-tag; the student breaks the cells open (lysozyme and the sonicator), clears the lysate in the
centrifuge (balanced, at the right speed and time) and purifies the protein on a nickel (Ni-NTA)
column: equilibrate, load, wash twice, elute in four fractions, and find the protein under a UV or
blue lamp. Every step is done by hand. When a step is about to go wrong the bench warns first;
when something does go wrong it says what that does to the result and lets the student start
that part again.

**Open the lab**

- Part 1 (from the cell pellet to the purified protein):
  https://neogio73.github.io/BCH3023/protein-purification-lab/

How it works

- Each student has their own unknown, shown as a five-character code at the top of the page (an
  address ending in `?code=` and a code opens a chosen one). Which protein it is, is never
  checked on the page.
- The protocol follows QIAGEN's *The QIAexpressionist* (lysis, wash and elution buffers with 10,
  20 and 250 mM imidazole; 1 mL of 50% Ni-NTA slurry). The bench clock runs in real time;
  "Speed up the wait" runs it 60 times faster.
- The page checks what the student says each tube shows under the lamp. The written questions
  are saved and printed but not checked.
- Adding `&warnings=after` to the address turns off the warnings before a step (the notes after a
  mistake stay).
- Work is saved in the student's own browser.
- Part 2 (the Bradford assay, fluorescence spectra, SDS-PAGE and the purification table) and a
  prelab review are still being built.

Centrifuge model: "Table centrifuge with blood samples" by Steffen, from BlendKit (royalty-free
license), adapted.
