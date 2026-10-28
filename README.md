# Olympiad Prep

Practice site for students preparing for USABO, USNCO, and F=ma, built for the National Science Competitions Club as a pilot.

It has two parts:

- **Resource Hub**: official past exams, syllabi, and readings, split by discipline.
- **Quiz engine**: drills by subtopic and full timed mocks. Questions come from official past exams, and generated variants of calculation questions are re-solved by code before a student sees them.

**Status:** two F=ma papers (2023, 2024) are extracted, tagged, and checked against the official keys, and a static site in `web/` lets you sit them timed and see results. There is no sign-in, database, or AI yet. Everything saves in the visitor's browser.

## Where things are

| Path | Contents |
|---|---|
| `docs/spec.md` | The approved design: decisions, data model, retrieval and evaluation design, failure handling, roadmap |
| `docs/open-items.md` | Unresolved risks and decisions |
| `db/schema.sql` | Postgres schema with indexes and row-level security (not yet run) |
| `data/` | Tagged exam data and source chunks (see `data/README.md`) |
| `pipeline/` | Key extraction and figure cropping for AAPT exam PDFs |
| `web/` | The Astro site: home, Hub, and timed paper pages. Run `npm install && npm run dev` inside it |

## Source rules

- F=ma and USNCO exams are posted publicly by AAPT and ACS. AAPT's page states no reuse terms and each F=ma exam carries a copyright line. ACS's terms have not been checked. Confirm both before the site goes beyond the club.
- USABO exams belong to the Center for Excellence in Education. Only topic tags and cutoffs are stored, never question text.
- Campbell is a chapter map only. OpenStax (CC BY) is the text that gets indexed.
- Students use their own Gemini API key for generation and Q&A. The owner's key is never used at runtime.

## Roadmap

P0 data and tagging, P1 Hub and Replay mocks, P2 drills and numeric variants, P3 Ask the Sources, P4 biology generation. Details are in `docs/spec.md`.

## Deploying

The site is live at https://olympiad-prep.vercel.app. Deploys are manual: the build reads `data/`, which sits outside `web/`, so it runs on this machine and uploads the result.

```
cd web
npx vercel build --prod --yes
npx vercel deploy --prebuilt --prod
```
