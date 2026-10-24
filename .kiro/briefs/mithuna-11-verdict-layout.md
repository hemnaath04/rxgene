Model: auto. Found by walking all 8 presets on production (https://rxgene.vercel.app) at a 1280x800 laptop viewport. The engine is correct for every preset; these are display fixes only. Don't change the engine, API or wording sources.

1. The verdict bar covers the story. It's sticky and grows with long notes (Dev's caveat, Jordan's FDA label quote), so on load it hides the "Slow" result and the gauge, which are the main demo visuals. Fix:
   - Make the verdict bar NOT sticky. It sits in normal flow after the gauge and comparison strip.
   - Show only: the headline ("Avoid codeine."), ONE plain sentence, at most one short note line (inhibitor note OR confidence flag, truncated to ~120 chars), the source line, the badge and the two buttons.
   - Everything longer (the full CPIC/FDA text, the caveats, the genotype recommendation, label quotes) moves into the Evidence sheet, which already exists.
   - At 1280x800, the story row's col 03 ("Slow" plus the activity score) and the gauge must be visible on first load without scrolling, for Sarah, Dev and Jordan.
2. Reverse case (Lena: on codeine, add fluoxetine). Per DESIGN.md section 3, the verdict must start with the prefix "Adding fluoxetine affects a current medication:" (use the added drug's name), because the alert is about codeine, not the drug just added.
3. The leftover "Not checked yet" / "Checking…" text in col 03 stays in the DOM after the result renders (found via innerText on Lena, Dev and Tom). Make sure exited elements unmount (AnimatePresence) or are aria-hidden, so screen readers and copy-paste don't read stale state.

Check all 8 presets at 1280x800 after the change, and run npm test (all 79 must pass). Don't run git. List the files you changed.
