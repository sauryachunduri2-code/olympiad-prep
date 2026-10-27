# Olympiad Prep

Practice site for students preparing for USABO, USNCO, and F=ma, built for the National Science Competitions Club as a pilot.

It has two parts:

- **Resource Hub**: official past exams, syllabi, and readings, split by discipline.
- **Quiz engine**: drills by subtopic and full timed mocks. Questions come from official past exams, and generated variants of calculation questions are re-solved by code before a student sees them.

**Status:** planning is finished and the repo holds the spec and database schema. No application code exists yet.

## Where things are

| Path | Contents |
|---|---|
| `docs/spec.md` | The approved design: decisions, data model, retrieval and evaluation design, failure handling, roadmap |
| `docs/open-items.md` | Unresolved risks and decisions |
| `db/schema.sql` | Postgres schema with indexes and row-level security (not yet run) |
| `data/` | Tagged exam data and source chunks (see `data/README.md`) |
| `pipeline/` | Extraction and tagging scripts (empty until P0) |

## Source rules

- F=ma and USNCO exams are public and may be stored with their solutions.
- USABO exams belong to the Center for Excellence in Education. Only topic tags and cutoffs are stored, never question text.
- Campbell is a chapter map only. OpenStax (CC BY) is the text that gets indexed.
- Students use their own Gemini API key for generation and Q&A. The owner's key is never used at runtime.

## Roadmap

P0 data and tagging, P1 Hub and Replay mocks, P2 drills and numeric variants, P3 Ask the Sources, P4 biology generation. Details are in `docs/spec.md`.
