# Demo video: shot list and checklist

**Rules** (official Rules & Project Submittal doc):
- **Length: under 3:00.** Judges may stop at 3:00. Target **2:30–2:45**.
- Show the project **working on the device it's built for**: the live web app.
- Upload to **YouTube (public or unlisted-but-viewable) or Vimeo**, and put the link on the SundAI card.
- **No third-party trademarks, and no copyrighted music.** Say "fluoxetine, an antidepressant", never brand drug names. No music, or royalty-free music you're allowed to use. Keep other companies' logos off screen as much as possible.

**Record on:** https://rxgene.vercel.app (production). Use a browser window at about 1280×800 (laptop size), zoom 100%, no bookmarks bar, no other tabs. All patients are synthetic.

The script describes *what happens*, not exact pixels, so it still works if the UI is restyled. Re-check every beat on the final UI before recording.

## Shot list (about 2:40)

| # | Time | Screen | Narration (plain language, no gene names until 0:30) |
|---|---|---|---|
| 1 | 0:00–0:15 | Title card or the app's hero ("Same genes. Different response.") | "Sarah's DNA test says she processes painkillers normally. She also takes fluoxetine, an antidepressant, and her doctor wants to add codeine." |
| 2 | 0:15–0:40 | https://rxgene.vercel.app/?patient=sarah&add=codeine. Let the result animate: the gauge slides from Normal to Slow, then the verdict | "Your liver has a cleanup crew for medicines. Fluoxetine jams it. So Sarah's genes still say 'normal', but right now she's 'slow'. RxGene says codeine likely won't relieve her pain, and to consider an alternative." |
| 3 | 0:40–0:55 | Comparison strip (gene report alone vs. typical interaction warning vs. RxGene) | "Her genetic report alone says fine. A typical interaction warning is generic. Only combining both gives the right answer." |
| 4 | 0:55–1:10 | Open **Inspect evidence**: both phenotypes, activity score 2.0 → 0, the CPIC guideline and strength, the requirement IDs | "Every alert shows its guideline, its evidence strength, and the exact rule that produced it." |
| 5 | 1:10–1:20 | https://rxgene.vercel.app/?patient=marcus&add=codeine | "Marcus is already slow by genes. He still gets the codeine warning, but one precise alert instead of two blunt ones." |
| 6 | 1:20–1:30 | https://rxgene.vercel.app/?patient=lena&add=fluoxetine | "And it works in reverse. Adding fluoxetine re-checks the codeine Lena already takes." |
| 7 | 1:30–1:55 | Back to Sarah. Click **Review full medication list**. Show the trace steps (T1…T6) appearing, then the note with [T3] chips. Hover a chip | "A pharmacist consult agent reviews the whole list. It calls our rule engine as a tool for every drug and drafts the consult note, and every sentence cites the tool result it came from. The AI never decides an alert. If a citation doesn't check out, you get the fixed template instead." |
| 8 | 1:55–2:05 | **Patient explanation**, EN, then the ES tab | "Patients get a plain-language summary, in English or Spanish." |
| 9 | 2:05–2:15 | `docs/proof/cds-hooks-sandbox.jpg`, or a live recording of the CDS Hooks sandbox Rx View showing the RxGene card | "It's a real CDS Hooks service. Here a public test EHR calls it while ordering codeine." |
| 10 | 2:15–2:40 | The Kiro story: a terminal showing `kiro-cli` with a brief; `.kiro/specs/rxgene-engine/requirements.md` (R21); the guard blocking a write to `data/inhibitors.json`; the PBT counterexample in `analysis.md` | "We built it with Kiro, spec first. 56 safety rules written by our genetics teammate before any code. Kiro's property-based tests found two engine bugs our examples missed. And Kiro hooks block the coding agent from touching the clinical data." |
| 11 | 2:40–2:45 | Closing line on screen | "Your genes don't change. Your prescriptions do. RxGene." |

## Before you hit record

- [ ] The final UI is deployed to production and `python3 scripts/check_live.py https://rxgene.vercel.app` shows 8/8.
- [ ] Open Sarah's consult once beforehand, so the cache is warm. The agent takes about 11–14 s; trim the wait in editing.
- [ ] Check that no brand names appear on screen. `grep -rniE "prozac|plavix|strattera" web/src` should be empty.
- [ ] Notifications are off, and nothing personal is visible (email, other tabs).

## After recording

- [ ] Upload to YouTube or Vimeo, and check the link works in a private window.
- [ ] Paste the link into the SundAI card. Note the length (must be under 3:00).
