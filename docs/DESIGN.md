# Exact-reference UI-only handoff (latest direction, 2026-10-24)

Desktop completion adds the existing full-medication consult and FAERS evidence surfaces. The main verdict action emits `onReviewMedications`; Evidence stays in the header. The standalone adapter renders a clearly labelled local consult preview with cited trace steps and Copy note. It makes no agent requests. Backend integration supplies the real consult response to the existing `ConsultSheet`, which also supports loading, fallback reason and error/retry states. The verified FAERS panel is reused below guideline evidence, with its source/date and caveats unchanged. Mobile work is outside this completion pass at the user's request.

The user supplied a final screenshot and explicitly requested only the UI, with backend integration handled separately. This supersedes the compact connected-workbench visual direction below for the default screen.

The default entry renders a controlled presentation view with a separate local demo adapter. It uses the open molecular background, prominent DNA and enzyme artwork, three stage headings without enclosing cards, glossy pathway particles, an unboxed metabolism ruler and a full-width petrol verdict band. The initial Sarah / fluoxetine / codeine fixture matches the reference state. Normal and inhibited motion is illustrative and pausable, with a static reduced-motion version.

Public integration types live in `web/src/ui/types.ts`; the presentation component accepts values/results and emits input/check/reset/evidence/explanation callbacks. It makes no network calls and computes no clinical decisions. The previous connected app remains in `web/src/ConnectedApp.tsx` as an unmounted reference. Existing engine, API and clinical data remain available for the backend team.

# RxGene design spec

## Implementation refresh — October 24, 2026

Hemnaath authorized Codex to take ownership of the UI build after refining the design in chat. Product source is still authored through Kiro CLI for hackathon provenance. This refresh supersedes the original visual recipes below where they differ; the clinical engine, API behavior, evidence and synthetic-patient contracts are preserved.

The current direction is an atmospheric molecular prescribing workbench: locally served Sora headings and Plus Jakarta Sans body, a quiet pale-blue molecular background, transparent sculptural DNA and enzyme artwork, marine controls, and coral clinical warning accents. Inputs come before the explanation. The main story is one connected canvas with Genetic baseline → Medication effect → Current response, followed by one qualitative ruler and a horizontal verdict strip. Comparison is available on demand instead of occupying permanent space.

The DNA illustration communicates the inherited baseline and remains unchanged. Conceptual drug particles pass through the enzyme, never through DNA. Normal-flow green is an explanatory process motif, not a medication approval. Unknown, unsupported and uncomputed assessments stay neutral; per-drug engine support determines whether inhibition can be illustrated. The enzyme image is conceptual artwork, not an exact CYP2D6 structural reconstruction or a patient scan.

Production artwork lives in `web/public/art/`; see its README for provenance. Keep the center of the background quiet and protect text with a subtle light scrim. Do not replace these assets with a screenshot of the whole interface. Preserve accessible Base UI controls/sheets, the full evidence and patient-summary flows, and CDS/local mode.

Motion is user-controlled with a pathway playback control and respects reduced motion. Clinical results appear independently of playback. Patient/medication/result changes cancel prior playback; static labels always carry the assessment. Browser verification, not an image mockup, determines final spacing and contrast.

The following sections document the original scaffold and its clinical-state requirements; original three-card layouts, Geist-only typography and CSS-only background instructions are historical rather than requirements for this refresh.

Reference mockup (case 1, Sarah): [`docs/design/mockup-case1.webp`](design/mockup-case1.webp).
Kiro implements this through `.kiro/briefs/mithuna-06-apply-design.md`. All values here are
exact, so don't approximate them. Stack: Tailwind v4 + shadcn/ui (Base UI) + Motion,
with the Geist Variable font already installed.

## 1. Layout (desktop ≥ 1024px; judges watch on a laptop)

```
┌ Header ────────────────────────────────────────────────────────────────────────┐
│ RxGene. | Pharmacogenomics          SYNTHETIC DEMO | [EHR mode ⏻] | Evidence | Reset │
├ Control bar (frosted panel) ───────────────────────────────────────────────────┤
│ Patient [Sarah · P01 ▾] | Current medications [Fluoxetine ×][+ Add] | Check prescription [Codeine ▾] [Check prescription →] │
├ Hero ──────────────────────────────────────────────────────────────────────────┤
│ H1 "Same genes. Different response."   sub "See how current medications change this prescription assessment." │
├ Story row: three equal columns ────────────────────────────────────────────────┤
│ 01 Genetic baseline   │ 02 Medication effect          │ 03 Current response     │
│ helix art             │ inhibitor badge + enzyme art  │ "With current medications" │
│ CYP2D6 · *1/*1        │ codeine pill → particles → ⊣  │ SLOW (display size)     │
│ Normal by genes       │ "Reduced morphine formation"  │ Activity score 2.0 → 0  │
│ 🔒 Genes unchanged     │ caption + "illustrative" note │ Rule-adjusted           │
├ Gauge (full width) ────────────────────────────────────────────────────────────┤
│ Slow ──── Reduced ──── Normal ──── Fast   ● with medications   ○ by genes        │
├ Comparison strip (NEW, see §3) ────────────────────────────────────────────────┤
├ Verdict bar (dark, sticky to the bottom of the story) ─────────────────────────┤
│ ⚠ Prescription review · Avoid codeine. | plain sentence + "CPIC Opioids · 2021 · Strong" | [Inspect evidence ↗] [Patient explanation →] │
│ badge: via CDS Hooks / local fallback          footer: Hackathon prototype · Synthetic data only · For clinician review │
└────────────────────────────────────────────────────────────────────────────────┘
```

Below 1024px, the story row stacks into one column (01 → 02 → 03), the control bar
wraps to two rows, and the verdict bar's actions move under the text.

**Interaction model.** The "Check prescription" button runs the check, which keeps the
demo beat. A deep link with `?add=` runs the check automatically on load. Editing the
medication chips after a check re-runs it immediately (this is the reverse case), with
no button press.

## 2. Tokens (add to `web/src/index.css` under `@theme`)

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `oklch(0.24 0.06 255)` | headings, by-genes marker, primary text |
| `--color-ink-muted` | `oklch(0.42 0.05 250)` | secondary text (must stay ≥ 4.5:1 on panels) |
| `--color-panel` | `oklch(0.98 0.01 230 / 0.78)` + `backdrop-filter: blur(16px)` | control bar, story columns |
| `--color-verdict` | `oklch(0.30 0.06 230)` | verdict bar background |
| `--color-primary` | `oklch(0.32 0.09 255)` | primary button |
| `--color-alert-red` | `oklch(0.62 0.21 35)` | display "Slow", the with-meds marker, inhibitor badge (large text and graphics only) |
| `--color-alert-red-text` | `oklch(0.50 0.19 33)` | **small** red text such as "2.0 → 0" (needs 4.5:1) |
| `--color-alert-amber` | `oklch(0.72 0.15 75)` | YELLOW level |
| `--color-alert-neutral` | `oklch(0.60 0.03 240)` | GREEN level ("No supported alert"). Never green: green reads as "safe" |
| `--color-alert-grey` | `oklch(0.55 0.01 250)` | GREY level |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | entrances, exits |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen movement |

**Background:** layered radial gradients from `oklch(0.93 0.04 220)` to
`oklch(0.97 0.02 210)`, with soft bokeh drawn in CSS (radial-gradient circles at
`opacity: 0.35`). Use no photographic image behind text. The helix and enzyme are simple
inline SVGs (or designer-exported WebP files ≤ 200 KB in `web/public/art/`), set **inside**
their columns, never under body text.

**Type:**
- H1: Geist 700, 56/60, `-0.02em` letter-spacing.
- Section labels: 600, 20.
- Display "Slow": 800, 96/1.
- Body text: 16/24 minimum.

## 3. States the mockup doesn't show (all required)

Each verdict has an **icon + word + color**, so color is never the only cue.

| Case (preset) | Story col 03 | Gauge | Verdict bar |
|---|---|---|---|
| RED, phenoconverted (Sarah) | as mockup | ○ Normal, ● Slow | ⚠ "Avoid codeine." |
| RED, already PM (Marcus \*4/\*4) | "Slow" + "Activity score 0 → 0" | ○ and ● both at Slow, ● drawn on top with a ring offset so both stay visible | ⚠ "Avoid codeine." + note: "Fluoxetine adds no further effect: this patient was already slow by genes." **The codeine alert always stays.** |
| UM + strong inhibitor (Dev) | "Slow" + chip **"Reduced confidence"** (dashed outline) | ○ Fast, ● Slow drawn as a **dashed** ring | ⚠ "Avoid codeine." + "Ultrarapid metabolizers may not fully convert (CPIC 2023)." |
| YELLOW (Jordan, atomoxetine) | "Slow" | ○ Normal, ● Slow | ◐ amber "Adjust atomoxetine dosing." + CPIC titration text. **Never "Avoid".** |
| GREEN (Priya) | "Normal" | ○ and ● at Normal | ◯ neutral "No supported alert" + "(not the same as safe)" |
| GREY, not assessed / insufficient data (Tom) | "Not assessed" | no markers, track dimmed, label "No gene result we can read" | ? grey "Not assessed: refer to pharmacist" |
| Reverse case (Lena: on codeine, add fluoxetine) | col 02 shows the **added** drug as the inhibitor | as Sarah | Verdict is about **codeine**, with the prefix "Adding fluoxetine affects a current medication:" |
| More than one assessment | col 03 shows the highest-severity one | that one | Verdict bar shows the top one plus "+1 more alert" (opens a list in the evidence sheet). Order: RED > YELLOW > GREY > GREEN. |

**Comparison strip** (only when `phenoconverted` is true). It sits between the gauge and
the verdict and has three equal cells:
- "Gene report alone": "Normal. Standard dosing." with a muted check icon
- "Typical interaction warning (illustrative)": "Fluoxetine may interact with codeine." with a muted info icon
- "RxGene": "Slow right now → avoid codeine." with the alert icon and a stronger border

It must not use product names or severity ratings.

**Evidence sheet** (shadcn Sheet from the right, 480px wide, `overscroll-behavior: contain`).
It contains:
- diplotype; AS genotype → adjusted
- both phenotypes; inhibitor + FDA class
- the CPIC recommendation verbatim + strength + guideline link + fetched date
- the requirement IDs (R#)
- the note on the old atomoxetine thresholds (R40)
- a collapsible "CDS Hooks card JSON" panel, plus request/response latency in EHR mode

**Patient explanation:** a second Sheet with EN/ES Tabs. Its source tag reads
"AI-written from rule output" or "Template", and ES adds "Machine-translated: review
before giving to patient."

**Header additions:** an "EHR mode" Switch (default on, label "EHR mode (CDS Hooks)").
Next to the verdict sits a small badge: "via CDS Hooks", "local fallback" or "local".

## 4. Motion spec

**Gate.** A check runs a few times per session and exists to explain, so it gets the
staged entrance. Everything high-frequency (select open, chip remove, hover, mode toggle)
gets no expressive motion. Wrap the app in `<MotionConfig reducedMotion="user">`.

**Check result sequence.** It runs when a check completes and only animates the parts
that changed. Use the full transform strings in Motion (no `x`/`y`/`scale` shorthands).

| Step | Element | From → to | Timing |
|---|---|---|---|
| 0 ms | col 02 inhibitor badge (only if an inhibitor is present) | opacity 0, `translateY(12px)`, `blur(4px)` → 1, 0, 0 | 300 ms `--ease-out` |
| 100 ms | col 03 value ("Normal" → "Slow") | old exits: opacity → 0, `translateY(-12px)`, blur 4px, 150 ms; new enters like step 0 | 300 ms `--ease-out` |
| 200 ms | gauge ● marker | `transform: translateX(<from>%)` → `translateX(<to>%)` | spring `{ type: "spring", duration: 0.6, bounce: 0 }`. This is explanatory motion, so 600 ms is justified |
| 300 ms | comparison strip, then the verdict bar | opacity 0, `translateY(12px)`, blur 4px → visible | 300 ms `--ease-out`, the strip's cells staggered 100 ms |

**Gauge implementation rule.** The ● and ○ markers are each a wrapper as wide as the
track. Move them with `translateX(0% | 33.333% | 66.667% | 100%)`, where the percentage is
relative to the wrapper, which equals the track. The dot inside is offset by
`translateX(-50%)`. Never animate `left` or `width`.

**Particle flow (col 02).** Predetermined constant motion, so it's a **CSS animation**
(it runs off the main thread). Five dots travel along the path with `transform:
translateX()` over 2.4 s `linear` infinite, staggered 0.48 s. When an inhibitor is
present, the dots past the enzyme get `opacity: 0.25` and the line after the T-bar is
dashed. Under `prefers-reduced-motion: reduce`, dots are static at fixed positions. Keep
the "Conceptual pathway · particle flow is illustrative" caption.

**Re-checks** (a patient switch or a med edit): wrap the swapped regions in
`<AnimatePresence mode="popLayout" initial={false}>`. Exits take 150 ms and enters 300 ms,
with the same values as above. On a patient switch, don't replay the particle intro.

**Controls:**
- Buttons: press `scale: 0.96` over 150 ms `--ease-out`, never on `:disabled`. Hover
  changes `background-color` only, over 150 ms `ease`, gated by `hover:` (Tailwind 4 already
  wraps it in `@media (hover: hover)`).
- Select and popover: keep the Base UI defaults, with `transform-origin:
  var(--transform-origin)`.
- Sheets: keep the shadcn defaults.
- Medication chips: removal has no animation (high-frequency).

**Reduced motion:** markers and values cross-fade with opacity over 200 ms and don't
move; particles are static; there's no blur and no translate.

## 5. Polish fixes to the mockup

| Severity | Where | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | Gauge, "Fast" end | A filled navy dot at Fast looks like a third marker | Plain tick + label at every stop; only ● and ○ are dots | A state cue must not be ambiguous |
| MEDIUM | Background behind text | Photographic bokeh and helices under headings and captions | Text sits on `--color-panel` frosted surfaces; art stays inside the columns | Readability; busy art under text reads as noise |
| MEDIUM | Small red text "2.0 → 0" and "Strong inhibitor" | The same orange as the display "Slow" | `--color-alert-red-text` for anything under 24px | Small text needs 4.5:1 contrast |
| MEDIUM | Caption "Conceptual pathway · particle flow is illustrative" | Pale teal | `--color-ink-muted` at 14px | Too faint to read on a projector |
| MEDIUM | Verdict, GREEN state | (not designed) | Neutral grey-blue + "not the same as safe" | Green implies "safe" (R31, R33) |
| LOW | Control bar | Inputs and the panel use similar radii | Panel `rounded-2xl` (16px), inputs `rounded-lg` (8px); padding exceeds 24px, so they're separate surfaces | Radius consistency |
| LOW | Icons | Mixed weights | lucide-react only; 2px stroke next to 600-weight text, 1.5px next to 400 | Icon stroke matches text weight |
| LOW | "Check prescription →" and "Patient explanation →" arrows | | Arrow side padding 2px less than the text side | Optical alignment |
| LOW | Footer microcopy on the dark bar | ~11px | 12px minimum, `oklch(0.85 0.02 230)` | Legibility |

**Verdict: Approve with the fixes above.** Not verified: actual contrast ratios. They're
estimated from the mockup; check them in the browser once implemented.
