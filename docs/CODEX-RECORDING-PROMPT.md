# Prompt for Codex (computer use): record the demo clips

Paste everything inside the block into Codex once the steps in **Before you start** are done.

## Before you start (Hemnaath)
1. The narration is recorded and Claude has written `~/projects/rxgene/media/timing.md` (each section's spoken length).
2. The final UI is merged and live. Run `python3 ~/projects/rxgene/scripts/check_live.py https://rxgene.vercel.app` and confirm 8/8.
3. Grant Codex **Screen Recording** and **Accessibility** permissions (System Settings → Privacy & Security) for the app Codex controls. Turn on **Do Not Disturb**.

```text
You are recording silent screen clips for a hackathon demo video of RxGene, a web app at
https://rxgene.vercel.app (synthetic patients only). You have computer use on this Mac.
Do NOT change any app code, git state or settings other than what's needed to record.
Do NOT type into any login, payment or account form. Do NOT visit other sites except
https://sandbox.cds-hooks.org for clip S9.

GOAL: one .mov clip per narration section S1–S11, saved to ~/projects/rxgene/media/clips/
named S1.mov … S11.mov. Each clip must be at least (spoken length + 3 s) from
~/projects/rxgene/media/timing.md. The editor (Claude, FilmCraft) trims them to the voice, so
extra seconds at the start and end are good; missing seconds are not.

SETUP (once):
1. mkdir -p ~/projects/rxgene/media/clips
2. Open a fresh browser window (a guest/clean profile: no bookmarks bar, no extensions, no other
   tabs). Set the window to exactly 1440×900 at position 0,0, page zoom 100%. Close any
   notifications.
3. Read ~/projects/rxgene/media/timing.md to get each section's duration D (seconds).
4. Warm-up: open https://rxgene.vercel.app/?patient=sarah&add=codeine once, click
   "Review full medication list", wait until the consult note appears, close it. (This warms the
   server so the real take is faster.)

HOW TO RECORD EACH CLIP:
- Navigate to the start URL first and wait for the page to fully settle, so loading never shows.
- Start a background recording of the browser window's region, without sound and with click
  highlights:
    screencapture -v -k -x -V <D+3> -R0,0,1440,900 ~/projects/rxgene/media/clips/S<n>.mov &
  (If -R isn't honored with -v on this macOS, drop -R and record the full screen; Claude crops it.)
- Wait 1 s, then perform the clip's actions at the given offsets (t = seconds after start).
  Move the mouse smoothly; never click outside the app window.
- Wait until the recording ends (D+3 s), then verify the .mov exists and is non-zero. Re-record
  a clip if anything went wrong (an error toast, a wrong patient, a loading spinner visible > 2 s).

CLIPS (start URL → actions). The app is ONE screen (no scrolling): a top bar (Patient, Current
medications, Check prescription picker, "Check prescription" button, "Evidence" top right), the
pathway scene (DNA → enzyme → "Current response"), a speed scale (Slow / Reduced / Normal / Fast)
and a dark verdict band at the bottom ("Review full medication list", "Patient explanation").
S1 HOOK      https://rxgene.vercel.app/?patient=sarah  (not checked yet: "Not checked yet",
             "Choose a prescription"). t=1 hover the Patient field (Sarah · P01); t=3 hover the
             "Fluoxetine" chip; t=5 hover the Codeine prescription picker. No clicks.
S2 SARAH     https://rxgene.vercel.app/?patient=sarah
             t=1 click "Check prescription". Let the particle animation play; the result reads
             "Slow", "Activity score 2.0 → 0", and the band reads "Avoid codeine.".
             t≈8 click "Play pathway" once to replay it; t≈D-3 hover "Avoid codeine.".
S3 SAME GENES https://rxgene.vercel.app/?patient=sarah&add=codeine
             t=1 hover the headline "Same genes. Different response."; t=4 hover "Normal by genes"
             (left); t=7 hover the speed scale's "By genes" marker (Normal) then the "With
             medications" marker (Slow); t=11 hover "Activity score 2.0 → 0"; rest on "Slow".
S4 EVIDENCE  https://rxgene.vercel.app/?patient=sarah&add=codeine
             t=1 click "Evidence" (top right). The sheet opens on the right. t=3 hover "Rule inputs
             and result" (2.0 → 0, Normal → Poor); t=7 hover the CPIC recommendation; then scroll
             the sheet slowly through "Requirements behind this alert" (R1, R10…) down to
             "Real-world reports (openFDA FAERS)" and rest on its caveat text until the end.
S5 MARCUS    https://rxgene.vercel.app/?patient=marcus&add=codeine
             Rest on the scene; t=2 hover the caption "Fluoxetine adds no further effect: Marcus was
             already slow by genes."; t=6 hover "Avoid codeine.".
S6 LENA+TOM  https://rxgene.vercel.app/?patient=lena&add=fluoxetine
             t=1 hover the band's "Adding fluoxetine affects a current medication:" and "Avoid
             codeine."; at t≈(D/2) open the Patient field, choose "Tom · P20", make sure the
             prescription is Codeine and click "Check prescription"; rest on "Not assessed" and
             "Indeterminate: ask a pharmacist".
S7 AGENT     https://rxgene.vercel.app/?patient=sarah&add=codeine
             t=1 click "Review full medication list". Keep recording through "Generating note…"
             (the agent takes ~11–14 s; the editor shortens the wait). When the note appears, hover
             the numbered "Agent trace" steps 1…6 on the left, then two citation chips (e.g. [3])
             in the note, then "Copy note". Record at least 30 s total for this clip.
S8 PATIENT   https://rxgene.vercel.app/?patient=sarah&add=codeine
             t=1 click "Patient explanation" (wait for the text, ~3 s); t=6 click "Español"; rest
             until the end.
S9 EHR       https://sandbox.cds-hooks.org  → "Rx View". The RxGene service
             (https://rxgene.vercel.app/cds-services) should already be added in this browser; if
             not, use the gear menu → "Add CDS Services" and enter that discovery URL, then save.
             Select service "rxgene-order-select" in the right-hand panel. t=2 type "codeine" in
             Medication and pick "Codeine sulfate 30 MG Oral Tablet". Rest on the RxGene card
             ("Insufficient data…" is correct: the sandbox patient has no genotype).
S10 KIRO     Open a Terminal window (dark theme, font 16 pt, sized 1440×900) in ~/projects/rxgene.
             Type `scripts/demo-kiro.sh` (don't press Enter yet), start the recording, wait 1 s,
             press Enter. The script clears the screen and runs, with pauses, the R21 spec rule, the
             property-test counterexample, the fix commit, "13 passed", and the Kiro hook blocking
             a clinical-data write (exit=2). It takes about 20 s. Don't type anything else.
S11 CLOSE    https://rxgene.vercel.app/?patient=sarah&add=codeine  — rest on the headline, "Slow" and the
             verdict band. No clicks.

AFTER ALL CLIPS:
- List ~/projects/rxgene/media/clips with durations (mdls -name kMDItemDurationSeconds *.mov).
- Report any clip you had to re-record and why, and anything that didn't match the
  descriptions (button labels can differ slightly on the final UI; use the closest match
  and say which you used).
Never put any personal information on screen. If a dialog asks for permissions, credentials
or payment, stop and ask the user.
```

## Labels (checked on the final UI, production after PR #11)
"Check prescription", "Play pathway", "Evidence" (top bar), "Review full medication list",
"Patient explanation", "English" / "Español", "Copy note", "Reset". Patients appear as
"Name · P0n" in the Patient field.
