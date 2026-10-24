# RxGene: narration script (read aloud)

The ElevenLabs voiceover reads the same text from `scripts/voiceover_sections.json` (with emotion tags). Keep the two in sync.

**Target: about 2:50 spoken** (about 420 words at a calm 150 words per minute). The hard limit is
3:00. Read the **bold section markers** silently. Leave a **one-second pause** where you see `//`
between sections; the editor uses those pauses to cut the video to your voice.

**Rules for the read:**
- No brand drug names: say "fluoxetine, an antidepressant".
- Don't say "safe" (our app never does either).
- The word "may" is fine.

**Pronunciation:**
- fluoxetine = *floo-OX-eh-teen*
- codeine = *KOH-deen*
- atomoxetine = *at-oh-MOX-eh-teen*
- CYP2D6 = *sip two-D-six*
- pharmacogenomics = *FAR-ma-ko-jeh-NO-mix*

---

**[S1 HOOK]**
So... Sarah takes fluoxetine. It's an antidepressant. And today, her doctor wants to give her codeine, for pain. Her DNA test? Says she processes painkillers... normally. So, the prescription looks fine. It's not.
`//`

**[S2 SARAH]**
Here's the thing. Your liver has this, like, cleanup crew for medicines... and your DNA decides how fast that crew works. But some drugs jam the crew. Fluoxetine's one of them. So Sarah's genes still say normal... but right now? Her body's slow. And RxGene catches that. Codeine probably won't relieve her pain, so... her doctor should avoid it, and pick something else.
`//`

**[S3 SAME-GENES]**
Same genes. Different response. Her gene report, on its own, says normal. And a regular interaction warning? It's the same for everybody. RxGene puts the two together... and tells you what's actually true for Sarah, today.
`//`

**[S4 EVIDENCE]**
And every alert shows its work. The guideline it comes from, how strong the evidence is, the score before and after... and the exact numbered rules behind it. The FDA reports down here? Those are just context. Never proof.
`//`

**[S5 MARCUS]**
Now, Marcus. He was already slow, just from his genes. So he still gets the codeine warning... but RxGene tells you straight up: the fluoxetine doesn't change anything for him. One clear alert. Not two noisy ones.
`//`

**[S6 LENA-TOM]**
It works the other way too. When Lena's doctor adds fluoxetine, RxGene goes back and re-checks the codeine she's already on. And if a gene result can't be read, like Tom's here... it just says so. Ask a pharmacist. No guessing.
`//`

**[S7 AGENT]**
For pharmacists, there's an AI agent that reviews the whole medication list. It calls our rule engine for every single drug... then drafts a consult note, and every sentence points back to the step it came from. But the AI never decides an alert. If even one citation doesn't check out... it falls back to a plain template.
`//`

**[S8 PATIENT]**
And patients get a plain-language version. In English... or in Spanish.
`//`

**[S9 EHR]**
It also plugs right into hospital systems. RxGene is a real CDS Hooks service, that's the standard for decision support inside health records. So here, a public test EHR is calling it... while a doctor orders codeine.
`//`

**[S10 KIRO]**
We built all of this with Kiro, spec first. Our genetics teammate wrote over fifty clinical rules before there was any code... and Kiro checked them for conflicts. Then Kiro's property-based tests caught two engine bugs our examples completely missed. And Kiro hooks stop the coding agent from touching the clinical data it's tested against.
`//`

**[S11 CLOSE]**
Your genes don't change. Your prescriptions do. This is RxGene.

---

## How to record the audio (10 minutes)

1. **Room:** quiet, with soft furnishings, and the door shut. Hold the laptop mic or earbuds about a hand's width from your mouth.
2. **App:** QuickTime Player → **File → New Audio Recording**. Click the arrow next to the record button, pick your mic and set Quality to **Maximum**. Voice Memos also works.
3. **Do one practice read** out loud, then record **two full takes** back to back. Keep the better one. If you stumble, pause, then restart that *section*; the editor can cut it.
4. **Pace:** a little slower than normal conversation. Smile on the hook and the close.
5. **Save it** as `~/projects/rxgene/media/narration.m4a` (or `.wav`), then tell the lead. `media/` is git-ignored, so no audio goes into the public repo.

## What happens next

1. The lead imports `narration.m4a` into FilmCraft, transcribes it (Whisper), removes filler words and long pauses, and writes **`media/timing.md`**: the exact start and end of each section S1–S11.
2. Codex records one screen clip per section, each a few seconds longer than its audio (see `docs/CODEX-RECORDING-PROMPT.md`), into `media/clips/`.
3. The lead assembles the clips in FilmCraft: your voice, each clip trimmed to its section, burned-in captions from the transcript (good for accessibility, which judges score), and an H.264 1080p export to `media/rxgene-demo.mp4`.
4. You watch it once, upload it to YouTube as **Public**, and paste the link into SundAI.
