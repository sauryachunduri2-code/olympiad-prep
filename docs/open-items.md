# Open items

1. **Gemini terms.** The Gemini API terms (effective 2026-03-23) say users must be 18 or older and that the API may not be used in a service likely to be accessed by people under 18. The owner has chosen to proceed and says students already have Gemini accounts. The LLM calls go through a provider adapter so the model can be swapped.
2. **Unverified biology questions.** Biology has no stored exams and cannot be checked by code, so generated questions ship labeled "Unverified" with student flagging.
3. **Schema not run.** `db/schema.sql` has not been executed against Postgres. Test it on a dev project first.
4. **Free-tier pause policy.** Confirm the host's current rules for pausing idle free databases before launch.
5. **USABO coverage.** Missing from the supplied material: 2019, 2022 to 2026, and some answer keys.
6. **Skills requested but not installed.** product-manager, information-architecture, rag-pipeline-planning, few-shot-evaluation, and schema-design were not in the marketplace. GitHub candidates must have over 10,000 stars before installing.
7. **Owner's writing rules.** The rules on AI-generated filler were not found in saved memory or CLAUDE.md and are still needed.
