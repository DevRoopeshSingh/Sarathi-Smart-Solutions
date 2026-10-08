# Homepage UI/UX evidence

Reviewed 7 October 2026. User confirmed the Sarathi Smart Solutions homepage. Three evidence agents gathered structure/accessibility, visual source facts, and copy; the structural agent subsequently gathered weight/friction. Scoring is by the primary reviewer.

## Evidence quality

- **Observed:** locally rendered desktop hero, accessibility tree across the homepage, and a desktop footer view in native Chrome at `http://127.0.0.1:8080/`. The hero has a large left headline, right property illustration, green WhatsApp action, two secondary actions, and persistent contact controls. The expert-call action wrapped onto a second row in the first desktop view. Decorative console text was very small.
- **Source-confirmed:** markup, CSS declarations, enquiry behavior, recommendation construction, and exact local file sizes.
- **Inferred:** mobile presentation, computed responsive behavior, initial visible-control counts, and requests. Browser access later returned `noWindowsAvailable` / `No browser is available`; package/mobile screenshots and interactive verification could not be completed. Do not treat this tool failure as a website defect.
- No customer messages or enquiry submissions were sent. No application code was changed. No user study, screen-reader session, deployed performance trace, competitor benchmark or image-provenance verification was performed.

## E1 — Purpose and primary path

The headline names CCTV and Mira-Bhayandar; hero actions offer WhatsApp, survey and phone (`index.html:331–361`). Four camera-count packages have direct WhatsApp enquiry drafts (`index.html:627–1017`). The visitor can contact the business directly, but encounters three hero actions, a quick full form, four package actions, a separate three-step planner, a second full form, and three floating contact actions (`index.html:338–354,442–566,1273–1453,2374–2498,2560–2602`).

The hero survey action targets the bottom `#survey-form`, bypassing the nearer `#hero-survey` (`index.html:353,436,2348`). Six source links use that bottom destination. Repeated contact opportunities can serve a long page; two complete forms and competing primary paths add avoidable choice.

## E2 — Recommendation accuracy

`recommendation.mjs:517–520` selects a fixed recommendation using property size and appends enquiry answers. It does not adapt that recommendation to requested work or camera quantity.

Reproduced with the exported `buildRecommendation` function:

- Home / Standard / CCTV / repair / 1 camera returns a **4–6 camera starting layout**, followed by the answer specifying repair and one camera.
- Home / Compact / CCTV / new installation / 12 cameras returns a **2–3 camera starting layout**, followed by the answer specifying twelve cameras.

The source catalogue provides those fixed layouts at `recommendation.mjs:59–66`. The stated tailoring at `index.html:1320` and `recommendation.mjs:536` is therefore stronger than the implemented behavior. Home includes “society space” (`index.html:1337`), but Home sizes describe rooms/flats/bungalows (`recommendation.mjs:339–342`). These are functional UX gaps, not styling preferences.

## E3 — Pricing and copy honesty

Four package cards each contain ten feature bullets (`index.html:641–712,739–810,838–909,936–1006`). Many repeat storage/cabling/installation/mobile/warranty/timing details; differences are hard to scan. Starting prices are ₹13,900, ₹15,900, ₹17,900 and ₹30,900. GST and site extras are explained **after** all four cards (`index.html:1036–1051`). Caveats are present, so hidden-cost deception is not established; a short qualification beside every price would be easier to notice.

Visible package buttons say “Book on WhatsApp,” whereas accessible labels and drafted messages describe enquiries (`index.html:713–720,811–818,910–917,1007–1014`). Prefer “Enquire on WhatsApp.” Smart-lock “Book Smart Lock Demo” goes to a planner, not a demo booking (`recommendation.mjs:156`; `app.js:83–92`).

“Most Popular” and “Complete Security” occur on the four-camera package (`index.html:824–831`). Popularity requires business evidence; it has not been shown false. “Complete Security” overstates a layout that itself calls for blind-spot assessment. Other claims needing owner substantiation include “100% Genuine,” “Trained technicians,” “Direct supplier pricing” and “Real on-site workmanship” (`index.html:1133–1135,1165,1193,1571`). Gallery ownership is unverified; do not assume stock or AI images.

The enquiry forms correctly explain that details are not saved on the website, customers must review and send in WhatsApp, and staff confirm survey timing (`index.html:549–551,2482–2483`; `app.js:774–776`). No coercive countdowns, prechecked marketing consent or invented numeric review rating were found in the reviewed source.

Copy inventory: `05-copy-inventory.md` contains 576 static text/accessible-label rows, dynamic copy and decoded messages. Useful plain-language replacements: OEM → manufacturer; DVR/NVR → camera recorder; AMC → annual maintenance; remediation → cable cleanup.

## E4 — Visual hierarchy and restraint

Brand tokens are navy, cyan and gold with Manrope (`styles.css:1–16,100–108`). Final hero headline is `clamp(2.2rem,6vw,4.6rem)` / line height 1.06 (`styles.css:2362–2365`). In the observed desktop hero, the purpose and primary WhatsApp action were immediately identifiable.

Source-inferred small text: illustration captions **7.68px** (`styles.css:482,527,552`), brand subline **8.8px** (`182`), header links **11.84px** at 920–1199 and **12.8px** at ≥1200 (`2883–2886,2899–2902`), assuming a 16px root. Decorative caption sizes are not equivalent to primary form-text accessibility failures; remove decorative microcopy or enlarge it.

Source contains 11 distinct hex-valued root brand tokens. A scoped CSS extraction found **69 candidate hex values**, including superseded, shared map/legal and state rules; this is an upper bound, **not** a rendered color count. Representative spacing values are `[8,10,12,14,16,18,20,22,24,25,26,28,30,32,34,36,38,40,44,48,50,54,64,65,72,80,90]`. Representative type values in px are `[7.68,8.8,10.4,11.2,11.52,11.84,12,12.48,12.8,13,13.6,13.76,14,14.4,14.72,16,16.32,16.8,18.4,20,22.4,23.2,24,28,32,35.2,52.8,73.6]`, with fluid sizes between limits (`styles.css:135–674,1850–1992,2340–2490,2740–2919,4946–5090`). These are source candidate scales, not computed-style measurements.

Glows, concentric orbits, a status console and floating mini cards decorate the hero (`index.html:327–430`). They explain the smart-property theme but provide less installer credibility than a verified project photo. A large paperwork-services cross-promotion interrupts CCTV content between planner and installation process (`index.html:1456–1517`). There are 17 named sections and 15 FAQs; repetition spans advantages, process, sample quote and support (`index.html:1114–1212,1519–2344`).

## E5 — Mobile navigation and accessibility

Main navigation is hidden below 920px (`styles.css:204–205,1900–1906`); homepage header has no mobile-menu replacement (`index.html:283–323`). Phone and planner header controls also disappear below 640px (`styles.css:1850–1855`). At ≤768px the illustration is removed and the floating bar retains only WhatsApp, with safe-area padding and bottom space reservation (`styles.css:2792–2844`). These are **source-inferred**, not mobile-rendered findings.

Skip link exists but jumps straight to planner, bypassing packages and other main content (`index.html:281,1273`). Core semantic landmarks: six source elements (header, two navs, main, aside, footer). Seventeen named sections and seventeen explicit regions can add landmark density, but several are hidden; total declarations are not initially exposed landmark counts.

Native controls and source event handlers support keyboard operation for core actions, forms, planner and FAQs. FAQ Arrow/Home/End behavior exists (`app.js:573–615`). No positive tabindex was found. Actual keyboard reachability for every control was not tested. Source order begins skip → brand → desktop nav → header contact → hero contact → quick form → packages → services → planner → lower-page actions/FAQs → final form → location → floating actions → footer.

Global 3px gold focus treatment and form 2px cyan treatment exist (`styles.css:393–411,2413–2417`); planner legends suppress outline (`413–415`). Source radiogroup names use explanatory help rather than visible question legends (`index.html:1318–1328,1371–1379`).

Contrast was calculated from explicit opaque source pairs using relative luminance: ink/body **17.79:1**, muted/body **7.95:1**, hero paragraph/body **10.48:1**, hero WhatsApp text/background **9.44:1**, gold primary button **12.36:1**. Lowest tested candidate navy/secondary pair is **5.51:1** (`styles.css:1–13,365,416–418,2357–2360`). Exact rendered minimum, including gradients/opacity/all states, is **unmeasured**. These results do not establish whole-page accessibility compliance.

## E6 — States and implementation detail

All six state categories are represented in the enquiry flow: empty initial fields/options (`index.html:460–483`); loading with disabled submit/aria-busy (`app.js:760–766`); inline errors and first-error focus (`638–706`); honest prepared-enquiry success (`774–776`); focus styles; disabled state (`index.html:554`; `styles.css:2128–2133`). Loading text is synchronously replaced, so its perceptibility/announcement is rough or unverified. Map loading/error/fallback handling is implemented (`locator.js:62–113`).

Static source contains **101 native interactive elements** including hidden/noscript controls. JS adds 12 service links, 12 need checkboxes and 39 optional fields; subtracting three noscript anchors gives **161 source-inferred initial DOM controls**, many hidden. This is **not** the number simultaneously presented to users. Desktop initially visible count was inferred as 102 before locator/configuration and responsive differences; native Chrome showed the map button, illustrating this caveat. Static maximum main nesting is 9 descendant edges including SVG; excluding SVG, 8 edges (`index.html:325–383,2348–2415`).

Sixteen repeated identical destination groups cover 44 source anchors (28 repeats beyond first occurrences). Repeat count is a proxy, not a claim that every repetition is unnecessary. All seven app.js imports are used; component props are not applicable. Five additional-service branches construct a category tag never appended and replace an earlier CTA string (`app.js:77–100`); this is minor code evidence, not a design verdict driver.

## E7 — Weight and friction

Exact local executable JS: **54,475 bytes uncompressed** = app.js 28,924 + locator.js 4,162 + recommendation.mjs 21,389 (`index.html:2732–2733`; `app.js:8–16`). Raw CSS is 112,515 bytes; raw homepage HTML 118,891 bytes. This is a lightweight JS implementation; source size is not deployed transfer size.

Typical cold initial requests estimated at **9**: HTML + two stylesheets + three local JS modules + logo + favicon + one assumed font file. Seven eager resources are directly identifiable; favicon/fonts/lazy loading/browser cache can change the total (`index.html:60–84,287–292,2732–2733`). Once seven distinct below-fold images load, the corresponding typical estimate is 16. **No network request measurement or TTI measurement is available.**

Idle ongoing animation: **0 source-inferred** on the homepage. Seva infinite-animation selectors do not match the homepage sister-division panel; homepage fadeUp animations are finite (`styles.css:905–910,1166–1167,1414–1425,3090–3100,3159–3162,4947–5068`). Reduced-motion rules exist (`1984–1992`), although explicit JS smooth scrolling at `app.js:432` needs verification. Dark palette is fixed; system light preference has no corresponding CSS treatment. This alone does not establish a failure to honor dark mode.

Maps dependencies are deferred until user action (`locator.js:56–80`); gallery is lazy/responsive (`index.html:1578–1726`). Initial source-inferred notifications and modals: **0**. Page-wide badges/tags: **20** narrowly defined (eight brands, four package badges, one expertise badge, seven generated core tags); 28 if including popularity ribbon, console status and six gallery tags. These are page-wide, not first-viewport counts.

## E8 — Pattern originality and durability

Split hero, cards, steps and FAQs use familiar landing-page patterns (`index.html:326–434,627–1017,1273–1453,1876–2344`). No comparison with five or more peer products was conducted; originality scoring is conservative and provisional. Manrope and a restrained base palette are reusable foundations. The glow/orbit/status-console motif is the primary potentially trend-dependent layer. There is no basis to redesign the technical stack purely from this audit.
