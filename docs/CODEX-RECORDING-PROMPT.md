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

CLIPS (start URL → actions):
S1 HOOK      https://rxgene.vercel.app/?patient=sarah  (no prescription added yet)
             t=1 hover the Patient selector (Sarah); t=3 hover the fluoxetine medication chip;
             t=5 hover the prescription picker. No clicks.
S2 SARAH     https://rxgene.vercel.app/?patient=sarah
             t=1 choose "Codeine" in the prescription picker; t=2 click "Check prescription".
             Let the pathway animation and gauge play to the end (gauge moves Normal → Slow);
             t≈D-3 hover the big verdict ("Avoid codeine").
S3 COMPARE   https://rxgene.vercel.app/?patient=sarah&add=codeine
             Scroll so the comparison (gene report alone / typical interaction warning / RxGene)
             is centered; t=2… hover each of the three cells left to right, about 3 s each.
S4 EVIDENCE  https://rxgene.vercel.app/?patient=sarah&add=codeine
             t=1 click "Inspect evidence"; t=3 hover the phenotypes and the score 2.0 → 0;
             t=7 hover the guideline line; then scroll slowly down to the
             "Real-world reports (openFDA FAERS)" panel and rest on its caveat text until the end.
S5 MARCUS    https://rxgene.vercel.app/?patient=marcus&add=codeine
             Rest on the verdict; t=3 hover the note "adds no further effect".
S6 LENA      https://rxgene.vercel.app/?patient=lena&add=fluoxetine
             Rest on the verdict prefix "Adding fluoxetine affects a current medication".
S7 AGENT     https://rxgene.vercel.app/?patient=sarah&add=codeine
             t=1 click "Review full medication list". Keep recording through the loading state
             (the agent takes ~11–14 s; the editor shortens the wait). When the note appears,
             hover the trace steps T1…T6, then hover two citation chips (e.g. [T3]) in the note
             so their trace steps highlight. Record at least 30 s total for this clip.
S8 PATIENT   https://rxgene.vercel.app/?patient=sarah&add=codeine
             t=1 click "Patient explanation"; t=5 switch to "Español"; rest until the end.
S9 EHR       https://sandbox.cds-hooks.org  → "Rx View". The RxGene service
             (https://rxgene.vercel.app/cds-services) should already be added in this browser; if
             not, use the gear menu → "Add CDS Services" and enter that discovery URL, then save.
             Select service "rxgene-order-select" in the right-hand panel. t=2 type "codeine" in
             Medication and pick "Codeine sulfate 30 MG Oral Tablet". Rest on the RxGene card
             ("Insufficient data…" is correct: the sandbox patient has no genotype).
S10 KIRO     Open a Terminal window (dark theme, font 16 pt, sized 1440×900) in ~/projects/rxgene.
             Record these, typed at a natural speed, pausing 3 s after each output:
               1) less +/R21 .kiro/specs/rxgene-engine/requirements.md   (show R21, then q)
               2) grep -n "Shrunk counterexample" -A1 .kiro/specs/rxgene-engine/analysis.md
               3) printf '{"hook_event_name":"preToolUse","tool_name":"fs_write","tool_input":{"path":"data/inhibitors.json"}}' | node scripts/kiro-guard-clinical-data.mjs; echo "exit=$?"
                  (shows the guard blocking the write, exit=2)
               4) ls .kiro/briefs | head -25
S11 CLOSE    https://rxgene.vercel.app/?patient=sarah&add=codeine  — rest on the hero and verdict.

AFTER ALL CLIPS:
- List ~/projects/rxgene/media/clips with durations (mdls -name kMDItemDurationSeconds *.mov).
- Report any clip you had to re-record and why, and anything that didn't match the
  descriptions (button labels can differ slightly on the final UI; use the closest match
  and say which you used).
Never put any personal information on screen. If a dialog asks for permissions, credentials
or payment, stop and ask the user.
```

## Labels to re-check on the final UI
The prompt uses today's labels: "Check prescription", "Inspect evidence", "Patient explanation",
"Review full medication list", "Español". If brief 20 changes any, update this file before
pasting it.
