# Data

- `exams/`: one JSON file per paper, named `<competition>-<year>-<round>[-<form>].json`. `figures/<paper>/` holds the crops those files point to.
- `taxonomy/`: topic and subtopic slugs per discipline. Every question's `topics` must use a slug from here.
- `sources/`: chunked OpenStax text and the reading map (empty until P0 reaches it).
- `raw/`: downloaded PDFs, one folder per paper. Git-ignored on purpose.

## Paper file

`paper` holds the metadata that becomes an `exam_papers` row, `tagging` records how the file was made, and `questions` has one entry per question: `stem` and `solution` in LaTeX-flavored text, `choices` as five strings, `answer_index`, `also_accepted` (extra indexes the exam board accepted later, as in 2023 Q15), `format` (calc, concept, graph, or figure), `difficulty_band` (1 to 5), `topics` with weights, and `skills`.

Graph and figure questions have `choices: null`. Their answer choices are plots (graph) or drawings (figure), so `figure_ref` points to a `-full.png` crop of the whole question. A question that runs across a page break is stacked into one image. Other figures are `-diagram.png` crops of the stem diagram only.

Stems are transcribed verbatim, typos included. Solutions are short summaries in our own words, not the official text.

## Checks before a paper is committed

1. The answer key is read from the official solutions PDF, not retyped (`pipeline/extract_fma_key.py`).
2. Every numeric answer is re-derived independently.
3. Every plain-English word in a stem or choice appears in the exam PDF.
4. Every figure crop is looked at once.
