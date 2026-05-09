# CAST AI RFI Assistant Spec

AI helper functions:

- Draft clearer RFI question from field input.
- Identify missing information.
- Suggest drawing references when drawing data exists.
- Suggest spec section when spec data exists.
- Summarize RFI history.
- Draft response summary.
- Identify possible cost impact.
- Identify possible schedule impact.
- Flag ambiguous language.
- Generate weekly RFI executive summary.

Guardrails:

- AI suggestions are clearly labeled suggestions.
- AI cannot mark official responses, close RFIs, change statuses, send notices, or alter official project records without explicit user approval.
- AI-generated summaries are stored separately from official records until approved.
