```text
/make-plan Redesign the Sarathi Smart Solutions homepage. Current design failed a strict Dieter Rams audit at 14/30 with critical gaps in principles #2 Useful (1), #4 Understandable (1), and #6 Honest (1).

Primary user: homeowners, shop owners and housing-society decision makers seeking CCTV installation or local support in Mira-Bhayandar.
Primary task: compare relevant CCTV options, assess installer credibility and request a free local survey or assistance through WhatsApp or phone.
Constraints: retain Sarathi logo and navy/cyan/gold identity, static HTML/CSS/ES modules and existing service scope; design keyboard-operable mobile/desktop flows. No deadline supplied. Review did not test conversion, mobile rendering, image provenance or deployed performance.

Verdict paragraph:
> REDESIGN the homepage's information architecture and enquiry/recommendation flow, retaining the Sarathi brand and lightweight implementation, because the 14/30 audit exposes misleading planner output and excessive competing decision paths.

Why redesign and not refine: the total is below 20 and the planner produces recommendations that contradict the selected work/quantity, while two full enquiry forms and competing paths require structural consolidation.

Preserve from current design:
- Logo and navy/cyan/gold tokens: index.html:284–295; styles.css:1–16.
- Explicit local CCTV purpose: index.html:331–336.
- Starting prices and full exclusions: index.html:636–639,1036–1051.
- Honest WhatsApp review/send/staff-confirmation message: index.html:549–551; app.js:774–776.
- Native controls, inline validation and FAQ keyboard behavior: app.js:573–615,638–706.
- Responsive/lazy images and map deferred until requested: index.html:1578–1726; locator.js:56–80. Verify project image ownership before portfolio use.

Discard:
- Size-only recommendation text that merely appends contradictory work/quantity answers: recommendation.mjs:517–520; principles #2/#6.
- Two complete survey forms competing with a planner and repeated contact controls: index.html:442–566,1273–1453,2374–2498,2560–2602; principles #4/#10.
- Ten-bullet repeated package presentations and delayed price qualifiers: index.html:627–1051; principles #4/#10.
- Large mid-flow unrelated paperwork promotion: index.html:1456–1517; principle #5.

Top five moves from the audit, verbatim:
1. #2 Useful / #6 Honest: Make planner recommendations follow requested work and camera quantity; add society-appropriate sizing or route uncertain cases to an assessment without invented equipment guidance. Evidence: recommendation.mjs:59–66,339–342,517–520; E2.
2. #4 Understandable / #10 Minimal: Establish one primary WhatsApp enquiry route, one reusable survey form, and a clearly optional planner; point survey links to that single form and use enquiry labels until staff confirm a booking. Evidence: index.html:353,442–566,1273–1453,2374–2498,2560–2602; E1/E3.
3. #4 Understandable / #6 Honest: Shorten package cards to price, intended property, camera count and key differences; present common inclusions once, detail on demand, and GST/site-extra qualifications beside every starting price. Evidence: index.html:627–1051; E3.
4. #5 Unobtrusive / #7 Long-lasting: Move verified installation proof ahead of extended benefits, replace or reduce the decorative status console, and reduce Digital Seva promotion to a small footer/header link. Keep gallery copy factual and verify project ownership before presenting it as portfolio evidence. Evidence: index.html:365–430,1456–1517,1564–1752; E3/E4.
5. #4 Understandable / #8 Thorough: Restore mobile section navigation, enlarge meaningful small labels, and verify keyboard navigation, focus/error visibility, responsive comparison and reduced motion. Evidence: styles.css:204–205,482,527,552,1900–1906,1984–1992,2883–2902; index.html:281,283–323; app.js:432; E5/E6/E7.

Evidence context: repair of one camera in a Standard Home setup currently returns a 4–6-camera installation layout; new installation of twelve cameras in Compact Home returns 2–3 cameras. The code selects SERVICE_CATALOGUE[need].details[size] and appends answers. Mobile nav is hidden below 920px with no homepage replacement in source. Caption type is as small as 7.68px. Initial local JS is 54,475 raw bytes; request count and TTI were not measured. All six enquiry states are present, but synchronous loading feedback needs verification. Two full forms and fifteen FAQs appear on the page. Claims including popularity and portfolio provenance need owner evidence, not an assumption of falsity.

Redesign principles in priority order:
1. Useful (#2): every output matches installation/repair/maintenance intent and supplied quantity, with an explicit assessment fallback.
2. Understandable (#4): a first-time visitor can identify one enquiry path, compare packages and navigate by section on mobile.
3. Honest (#6): prices qualify exclusions nearby; actions say enquiry until confirmed; claims use substantiated evidence.
4. Minimal (#10): remove repeated exposition while retaining information needed to make a decision.

Deliverables for the plan:
- New information architecture organized around the visitor's decision, not the current section sequence.
- Labeled low-fidelity primary flow compared with current: hero, compact verified proof, package comparison, process, support, short FAQ, single enquiry form, location/footer; optional planner and other services secondary.
- Consolidated type/spacing/color specifications, desktop/mobile navigation and CTA hierarchy.
- Empty/loading/error/success/focus/disabled checklist, including honest WhatsApp preparation and fallback.
- Concrete target files, migration of anchor links to one form without losing entered values, and synchronized public assets according to repository workflow.
- Verification of repair/quantity/society scenarios, keyboard routes, actual 390/768/920/1280px layouts, sticky-bar clearance and reduced motion. Measure accessibility and deployed performance rather than infer them from source.
- Cutover criteria: relevant recommendations, single working enquiry route, no booking overclaim, nearby price qualifiers, usable mobile navigation, preserved disclosures, and accessible states. Retire duplicated forms at cutover.

Out of scope: Digital Seva page redesign, operations dashboard, backend booking system, speculative prices/testimonials, new service catalogue, hosting changes, deployment.

Guard against porting the current structure under new styling, indefinite dual designs, trend-driven changes, unverified portfolio/testimonial claims and treating the Preserve list as optional. This is a planning handoff, not authorization to publish.
```
