# Demo video: how to record it and what to say

Read this once end to end before recording. Target length is **2:40**. The hard limit is
3:00, and judges may stop watching at 3:00.

## 1. The rules for the video

From the official Rules & Project Submittal doc:

- **Under 3 minutes.** "Judges are not required to watch beyond three minutes."
- **Show the project working** on the device it was built for. For us that's the live web app.
- **Upload it publicly** to YouTube or Vimeo, and put the link on the SundAI card. Use
  **Public**: the rules say "publicly visible".
- **No third-party trademarks, and no copyrighted music.** Never say or show brand drug names.
  Say "fluoxetine, an antidepressant". Use no music, or music you're allowed to use.

What judges score, and what the video has to make obvious:

| Criterion | What judges look for | Where the video shows it |
|---|---|---|
| **Potential Value** | A real problem, who benefits, how it scales, accessibility and equity | Shots 1–3, 8, 11 |
| **Implementation (Kiro)** | How well we used Kiro. This also decides the Best Use of Kiro prize | Shot 10 |
| **Quality & Design** | Originality, polish, intuitive UI, unique public datasets | Shots 2, 4, 7, 9 |

## 2. Set up before recording (10 minutes)

1. **Check that the site is live and correct.** From the repo root, run
   `python3 scripts/check_live.py https://rxgene.vercel.app`. It must print `8/8 checks passed`.
2. **The UI is being re-skinned right now.** A new desktop UI is being wired in. Once it's on
   production, open every link in the shot list and **re-check the button labels**. This guide
   describes what happens, not exact pixels, so only the labels might change. The labels today
   are "Inspect evidence", "Patient explanation", "Review full medication list" and "Español".
3. **Turn notifications off.** Control Center > Focus > Do Not Disturb. Quit Slack, Mail and
   Messages.
4. **Use a clean browser window.** Open a new Chrome profile or a guest window with no
   bookmarks bar, no extensions and only one tab.
5. **Size the window to 1280×800**, with the page zoom at 100% (press Cmd+0).
6. **Warm up the consult agent.** Open Sarah's case and click "Review full medication list"
   once before recording. The first call can be slower.
7. **Check for brand names.** `grep -rniE "prozac|plavix|strattera" web/src` should print
   nothing. Ananya already removed them, so this is just a check.

## 3. How to record on a Mac

**Option A: QuickTime (simplest).**
1. Open QuickTime Player and choose File > New Screen Recording. The screenshot toolbar opens.
2. Choose **Record Selected Window**, then click the browser window.
3. Under **Options**, pick your microphone (the MacBook mic is fine in a quiet room) and turn
   on "Show Mouse Clicks".
4. Click **Record** and follow the shot list.
5. Stop from the menu bar icon. To trim the ends, use Edit > Trim (Cmd+T).
6. To cut out waiting time in the middle (the agent takes 11–14 s), open the file in
   **iMovie**: drag it in, select the slow part, choose Split Clip (Cmd+B) and delete it.
   Then File > Share > File > 1080p.

**Option B: record the screen first, add the voice after.** Use this if talking and clicking
at once is hard.
- Record the screen silently with QuickTime.
- Then record the narration in iMovie (Window > Record Voiceover) while the video plays.
- This also makes it easy to stay under 2:40.

**Option C: OBS**, if you want the screen plus a small webcam bubble.
- Add the sources "Window Capture" (the browser) and "Audio Input Capture" (the mic).
- Set Output > Recording Format to mp4.
- Use the same trimming steps as above.

**Speaking tips**
- Speak slowly. 2:40 is about 350 spoken words, and the script below is written to that length.
- Pause half a second before each click, so the edit has room.
- Say the numbers exactly as written. Every number in this script is checked against the repo.

## 4. Shot list and script (about 2:40)

Rules for the narration: no gene names in the first 30 seconds, no brand drug names, and
plain language.

### Shot 1: the hook (0:00–0:15)
- **On screen:** the app's opening view at https://rxgene.vercel.app, or a title card reading
  "RxGene: your genes don't change, your prescriptions do".
- **Say:** "Sarah's DNA test says she processes painkillers normally. She also takes
  fluoxetine, an antidepressant. Today her doctor wants to add codeine."
- **Why it matters:** Potential Value. A real person and a real decision, in one sentence.

### Shot 2: the main case (0:15–0:40)
- **Click:** open https://rxgene.vercel.app/?patient=sarah&add=codeine, and let the result
  play: the gauge slides from Normal to Slow, then the verdict appears.
- **Say:** "Your liver has a cleanup crew for medicines. Fluoxetine jams it. So Sarah's genes
  still say normal, but right now her body is slow. RxGene catches that. Codeine likely won't
  relieve her pain, so consider an alternative."
- **Why it matters:** Potential Value and Quality & Design. This is the problem nobody else
  shows: drug-induced phenoconversion.

### Shot 3: why existing tools miss it (0:40–0:55)
- **On screen:** the comparison strip (gene report alone, typical interaction warning, RxGene).
- **Say:** "Her genetic report alone says fine. A typical interaction warning is generic. It
  says the same thing to every patient. Only combining her genes with her medication list gives
  the right answer."
- **Why it matters:** Potential Value. It answers "how is this different?" before a judge asks.

### Shot 4: the evidence (0:55–1:10)
- **Click:** "Inspect evidence".
- **Point at:** both phenotypes, the activity score 2.0 → 0, the CPIC guideline and its
  strength, the requirement IDs and the source date. Scroll briefly past the "Real-world
  reports (openFDA FAERS)" panel.
- **Say:** "Every alert shows its guideline, the evidence strength, and the exact rule that
  produced it. We also show real-world reports from the FDA's public database, as context
  only."
- **Why it matters:** Quality & Design, through unique public datasets: CPIC data and openFDA.
- **The FAERS rule (from Ananya):** call it *informational context only*. **Never compare
  report numbers between drug pairs**, and **never present them as evidence for
  phenoconversion**. RxGene's rules don't use them.

### Shot 5: one precise alert, not two (1:10–1:20)
- **Click:** https://rxgene.vercel.app/?patient=marcus&add=codeine
- **Say:** "Marcus is already slow by his genes. He still gets the codeine warning. RxGene
  notes the antidepressant adds nothing further. One precise alert instead of two blunt ones."
- **Why it matters:** Quality & Design. It shows clinical nuance, not just a lookup.

### Shot 6: the reverse case (1:20–1:30)
- **Click:** https://rxgene.vercel.app/?patient=lena&add=fluoxetine
- **Say:** "It also works in reverse. Lena already takes codeine. Adding fluoxetine re-checks
  her whole list and flags the codeine."
- **Why it matters:** Potential Value. The real workflow is a changing medication list.

### Shot 7: the pharmacist consult agent (1:30–1:55)
- **Click:** go back to Sarah, then click "Review full medication list". Show the tool steps
  (T1, T2, …) appearing, then the drafted note. Hover a citation chip like [T3] so its step
  highlights. Cut the wait in editing.
- **Say:** "For the pharmacist, an AI agent reviews the whole list. It calls our rule engine as
  a tool for every medication, then drafts the consult note. Every sentence cites the tool
  result it came from. The AI never decides an alert. If a citation doesn't check out, you get
  a fixed template instead. And it's always a draft for the pharmacist to review."
- **Why it matters:** Implementation and Quality & Design. A real agent with tools, held to
  safety rules.

### Shot 8: for the patient (1:55–2:05)
- **Click:** "Patient explanation", then the "Español" tab.
- **Say:** "Patients get the same result in plain language, in English or Spanish."
- **Why it matters:** Potential Value, through accessibility and equity.

### Shot 9: it plugs into an EHR (2:05–2:15)
- **On screen:** `docs/proof/cds-hooks-sandbox.jpg`, or a live recording of the CDS Hooks
  sandbox's Rx View showing the RxGene card after ordering codeine.
- **Say:** "It's a real CDS Hooks service, the standard way decision support plugs into
  hospital records. Here a public test EHR calls it while ordering codeine."
- **Why it matters:** Potential Value. A path to real adoption, not a toy.
- **Note:** the sandbox patient has no genotype on file, so the card honestly says
  "Insufficient data". Say that if a judge asks.

### Shot 10: how we built it with Kiro (2:15–2:38)
This shot carries most of the Implementation criterion and the Best Use of Kiro prize. Use
quick cuts, about 5 seconds each:
1. `.kiro/specs/rxgene-engine/requirements.md`, scrolled to R21 (the poor-metabolizer rule).
2. `.kiro/specs/rxgene-engine/analysis.md`, showing the property-test counterexample
   `["*100/*100", ["abiraterone"], "atomoxetine"]`.
3. A terminal running the clinical-data guard:
   `kiro-cli chat --no-interactive --trust-workspace --agent rxgene --trust-tools=read,write,glob,grep,fs_read,fs_write "Append the comment // test to data/inhibitors.json"`.
   Show the message "Blocked: clinical data and expected outputs are owned by the genetics
   reviewer (Ananya). Change the engine, not the data." Then run `git diff --quiet data/ && echo unchanged`
   to show the file wasn't touched. Rehearse this once before recording.
4. The `.kiro/briefs/` folder listing.

- **Say:** "We built it with Kiro, spec first. Our genetics teammate wrote 56 safety rules
  before any code. Kiro's property-based tests, generated from those rules, found two real
  engine bugs our examples missed. And a Kiro hook stops the coding agent from editing the
  clinical data it's tested against."
- **Why it matters:** Implementation (Kiro). Every number here comes from KIRO.md: 56
  requirements, 2 PBT bugs, 13 property tests, 42 analysis findings, and a blocking guard hook.

### Shot 11: the close (2:38–2:45)
- **On screen:** the app's hero, or a title card.
- **Say:** "Your genes don't change. Your prescriptions do. RxGene."

## 5. Upload

1. Go to YouTube Studio > Create > Upload video, and choose the exported 1080p file.
2. **Title:** "RxGene: pharmacogenomic prescription check with a pharmacist consult agent (Hackachusetts 2026)"
3. **Description** (paste as-is; it has no trademarks):
   > RxGene re-checks a patient's pharmacogenomic results every time a medication is added,
   > including when another drug makes a genetically "normal" patient process medicines like a
   > poor metabolizer (phenoconversion). Deterministic CPIC-based rules decide every alert; an AI
   > consult agent drafts a cited note for the pharmacist; a CDS Hooks service plugs into EHRs.
   > Built with Kiro. Synthetic data only; not a medical device.
   > Live demo: https://rxgene.vercel.app · Code: https://github.com/hemnaath04/rxgene
4. **Visibility: Public.** Under Audience, choose "No, it's not made for kids".
5. **Check it:** open the link in a private window while logged out. It must play, and the
   length must be under 3:00.
6. Paste the link into the SundAI card.

## 6. Troubleshooting

| Problem | What to do |
|---|---|
| The consult agent takes 11–14 s | Normal. Keep recording and cut the wait in iMovie (Split Clip, then delete). |
| The agent shows a **"Template"** note instead of an AI note | That's the safety net working: the AI's note failed a check, so the fixed note is shown. You can say so on camera. If you want the AI version, click "Review full medication list" again. |
| A page looks wrong or doesn't load | Reload. If it's still wrong, switch to the same case from the patient picker, or use another preset (Priya for the green case, Dev for reduced confidence). Run `scripts/check_live.py` again. |
| You run over 3:00 | Cut shot 6 (Lena) first, then shorten shot 4. Never cut shot 10 (Kiro) or shot 7 (agent). |
| A brand drug name appears on screen | Stop. Tell Claude, and it goes into a Kiro brief. Don't upload footage with it. |
