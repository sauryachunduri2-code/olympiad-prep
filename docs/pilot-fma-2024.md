# Pilot: F=ma 2024

One paper, start to finish: download, extract, tag, check. Output is `data/exams/fma-2024-fma.json` with 25 questions and 16 figure crops.

## What the PDFs gave us

The exam PDF has a real text layer, so no OCR is needed. The text is unreliable only for math: fractions and square roots split across lines. Every question with algebraic choices (10, 12, 15, 17 to 21, 24) was transcribed from the rendered page, not from the text.

The solutions PDF marks the correct choice by setting its letter in red bold. Figure labels use the same letters in black, so a text pattern would misread Q12. `pipeline/extract_fma_key.py` reads the color. Its key matched my hand-read key on all 25 questions.

All figures are vector drawings, not embedded images. `pipeline/crop_fma_figures.py` crops them by finding the drawings above the answer choices, then pulling in nearby labels (M, 2M, omega) and stopping at neighboring stem text. Four questions (4, 6, 7, 13) have graphs as their choices, so those get a crop of the whole question.

## Checking the key

Beyond the extracted key, I re-derived the numeric answers for Q1, 2, 5, 8, 9, 10, 11, 12, 14, 15, 17 to 24 myself, and read the figures for the graph questions (4, 6, 7, 13) against the official explanations. No disagreements.

## Rules we chose

Difficulty bands come from position only (five questions per band) until student results exist to replace them. Stems keep the exam's typos. Solutions are short summaries, not the official text.

## Scaling up

The extraction and cropping scripts carry over to other AAPT papers, including the A and B forms. The slow part is transcribing math choices from page images and writing the tags, roughly 30 KB of JSON per 25-question paper. Claude usage for this pilot was not measured inside the session. Check `/cost` before and after the next paper to get a real per-paper number before committing to eight years of three competitions.

USNCO Part I has 60 questions. Check those PDFs for a text layer and vector figures before assuming this pipeline fits.

## Added with 2023

Two things the 2024 paper did not exercise. AAPT accepted a second answer for 2023 Q15 after the exam, so the key extractor returns every marked letter and the data holds `also_accepted`. And two 2023 questions (15, 23) cross a page break, so the cropper stacks the pieces from each page.
