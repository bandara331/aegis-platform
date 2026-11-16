# Prompt for the Antigravity agent

Read `README.md` and `.agent/rules/aegis.md` first. Create an Implementation Plan and Task List, then build:

1. `/help` citizen request wizard (mobile first): category, urgency, description, map location,
   evidence upload with client-side MIME/size validation, consent, status tracker. Language switcher
   for English, Sinhala, Tamil (Arabic with RTL later).
2. `/command/scenario-lab`: shortage simulator with a draggable supply slider (client component),
   re-ranked allocation, per-request score breakdown, strategy selector (max urgency / fair share /
   fastest ETA).
3. Make the AI drawer interactive: Approve / Modify / Reject / Defer, justification required for
   Modify and Reject, second-approver modal for critical actions, new entry appended to an audit
   timeline with a visible hash chain.
4. Role switcher ("Demo as...") for the nine roles with role-based navigation.
5. Service-health panel with outage toggles and degraded-mode banners.

Keep the existing visual language. Use the browser agent to check 390, 820 and 1440 px widths and
attach screenshots. Finish with a Walkthrough artifact.
