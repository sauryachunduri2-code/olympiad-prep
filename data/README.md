# Data

- `exams/`: one JSON file per paper, named `<competition>-<year>-<round>[-<form>].json`. Holds extracted questions, keys, tags, and figure references. USABO files contain tags only (`stem` is null).
- `sources/`: chunked OpenStax text and the reading map.
- `raw/`: downloaded PDFs. Git-ignored on purpose.

Every tagged question must be checked against the official key before it is committed.
