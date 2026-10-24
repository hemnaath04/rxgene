# RxGene: narration script (read aloud)

**Target: about 2:35 spoken** (about 390 words at a calm 150 words per minute). The hard limit is
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
Sarah takes fluoxetine, an antidepressant. Today her doctor wants to prescribe codeine for her pain. Her DNA test says she processes painkillers normally. So the prescription looks fine. It isn't.
`//`

**[S2 SARAH]**
Your liver has a cleanup crew for medicines, and your DNA decides how fast that crew works. But some drugs jam the crew, and fluoxetine is one of them. So Sarah's genes still say normal, but right now her body is slow. RxGene catches it: codeine likely won't relieve her pain, so her doctor should consider an alternative.
`//`

**[S3 COMPARISON]**
Her genetic report on its own says everything is fine. A typical interaction warning is the same for every patient. RxGene combines her genes with her medication list, and gives the answer that's actually true for Sarah.
`//`

**[S4 EVIDENCE]**
Every alert shows its work: the clinical guideline it comes from, how strong the evidence is, the score before and after, and the exact numbered rule that produced it. Real-world FDA reports are shown for context only, never as proof.
`//`

**[S5 MARCUS]**
Marcus was already slow because of his genes. He still gets the codeine warning, but one precise alert instead of two noisy ones.
`//`

**[S6 LENA]**
And it works in reverse. When Lena's doctor adds fluoxetine, RxGene re-checks the codeine she already takes.
`//`

**[S7 AGENT]**
For pharmacists, an AI agent reviews the whole medication list. It calls our rule engine as a tool for every drug, then drafts the consult note, and every sentence cites the exact result it came from. The AI never decides an alert. If a single citation doesn't check out, the note falls back to a fixed template.
`//`

**[S8 PATIENT]**
Patients get a plain-language explanation, in English or in Spanish.
`//`

**[S9 EHR]**
And it plugs into hospital systems. RxGene is a real CDS Hooks service, the standard for decision support inside health records. Here, a public test EHR calls it while a doctor orders codeine.
`//`

**[S10 KIRO]**
We built RxGene with Kiro, spec first. Our genetics teammate wrote more than fifty safety rules before any code existed, and Kiro checked them for conflicts. Kiro's property-based tests then found two engine bugs our examples had missed. And Kiro hooks stop the coding agent from changing the clinical data it's tested against.
`//`

**[S11 CLOSE]**
Your genes don't change. Your prescriptions do. This is RxGene.

---

## How to record the audio (10 minutes)

1. **Room:** quiet, with soft furnishings, and the door shut. Hold the laptop mic or earbuds about a hand's width from your mouth.
2. **App:** QuickTime Player → **File → New Audio Recording**. Click the arrow next to the record button, pick your mic and set Quality to **Maximum**. Voice Memos also works.
3. **Do one practice read** out loud, then record **two full takes** back to back. Keep the better one. If you stumble, pause, then restart that *section*; the editor can cut it.
4. **Pace:** a little slower than normal conversation. Smile on the hook and the close.
5. **Save it** as `~/projects/rxgene/media/narration.m4a` (or `.wav`), then tell Claude. `media/` is git-ignored, so no audio goes into the public repo.

## What happens next

1. Claude imports `narration.m4a` into FilmCraft, transcribes it (Whisper), removes filler words and long pauses, and writes **`media/timing.md`**: the exact start and end of each section S1–S11.
2. Codex records one screen clip per section, each a few seconds longer than its audio (see `docs/CODEX-RECORDING-PROMPT.md`), into `media/clips/`.
3. Claude assembles the clips in FilmCraft: your voice, each clip trimmed to its section, burned-in captions from the transcript (good for accessibility, which judges score), and an H.264 1080p export to `media/rxgene-demo.mp4`.
4. You watch it once, upload it to YouTube as **Public**, and paste the link into SundAI.
