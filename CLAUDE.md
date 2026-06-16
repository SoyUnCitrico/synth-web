# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based analog synthesizer emulator (React 19 + TypeScript + Vite + Tone.js).
The signal architecture mirrors a modular synth: 2 VCO + VCF + ADSR + VCA, with a
spectrum analyzer and oscilloscope tap. Code comments and UI text are in **Spanish** —
match that language when editing existing files.

## Commands

```bash
npm install        # install dependencies
npm run dev        # Vite dev server on http://localhost:3000 (strictPort, host 0.0.0.0)
npm run build      # tsc -b (typecheck) then vite build -> dist/
npm run lint       # eslint over the repo
npm run preview    # serve the production build locally
```

There is no test runner configured. `npm run build` doubles as the typecheck gate
(`tsc -b` runs before the bundle and fails on type errors).

## Architecture

The app is effectively a single page. `main.tsx` → `App.tsx` (React Router with one
route `/` → `BasicSynth`) → `pages/BasicSynth.tsx`, which is where everything lives.

**The audio engine lives in `src/audio/useSynthEngine.ts`, not in the components.**
`BasicSynth.tsx` holds the UI parameter state and passes each value + its `setX`
callback down to the presentational `components/` (VCO, VCF, ADSR, VCA, Noise, LFO,
Header) — those never touch Tone.js. The same param values are passed as one object
into `useSynthEngine`, which owns the Tone.js node graph. When adding a control: add
state in `BasicSynth`, pass it to the component, add it to the `SynthParams` object and
to the engine.

Signal chain (built inside `useSynthEngine`):

```
osc1 ─> ch1 ─┐
osc2 ─> ch2 ─┤ (mixer: one Gain per channel; ch2/ch3/chN connect to the filter
osc3 ─> ch3 ─┼  only when the source's *Enabled flag is on. ch1 is always on.)
noise─> chN ─┘
             └─> VCF ─> ADSR (AmplitudeEnvelope) ─> master VCA (Gain) ─┬─> Analyser "waveform"
                                                                        ├─> Analyser "fft"
                                                                        └─> Reverb ─> destination
                  ▲
AD filter envelope ─> Scale (0..amount Hz) ─┘  (Tone.Envelope, sustain 0; sums into filter.frequency)

LFO ──> oscillators' detune (pitch/vibrato)  OR  ──> filter frequency   (switched by lfoTarget)
```

Both envelopes (amplitude ADSR and the AD filter envelope) are triggered together by
`triggerAttack`/`triggerRelease`. Per-channel mixer levels and the master volume are
separate Gain nodes. The noise source is fully integrated into the VCA's mixer UI
(level fader + on/off + single-select type checkboxes) — there is no standalone Noise
module. ADSR and the mixer use vertical faders (`components/Fader/Fader.tsx`,
`.control-slider.vertical`).

Key conventions, **critical to keeping latency low**:

- **The graph is built exactly once** (mount-only `useEffect` with `[]` deps). Parameter
  changes are applied by **mutating existing nodes** in small per-parameter effects
  (e.g. `filter.frequency.setValueAtTime(...)`), never by rebuilding. Do **not**
  reintroduce a "rebuild on every change" effect — that was the original latency bug.
- Tone nodes are held only in `useRef`s inside the hook (no duplicate React state).
- All sources (oscillators, noise, LFO) run continuously and `start()` once; the
  AmplitudeEnvelope gates them (MiniMoog-style). Enable/disable toggles just
  `connect()`/`disconnect()` a source to the filter.
- Note playing is **monophonic, last-note priority**. `BasicSynth` keeps a held-notes
  stack and calls the engine's imperative API: `triggerAttack(note)` (first note),
  `setNote(note)` (legato change while held), `triggerRelease()` (last note released).
- Keyboard: `keyMap` maps computer keys (`z x c v b n m , . -` = white, `s d g h j l ñ`
  = black) to note names; `q`/`e` shift octave. Listeners are registered **once** on
  `window` using native `KeyboardEvent`; live state (octave, held notes) is read via refs.
- Tone.js requires a user gesture: `triggerAttack` calls `Tone.start()` if the context
  isn't running yet.
- `Oscilloscope` (d3-based) and `Spectrum` components exist but are currently commented
  out in `BasicSynth.tsx`. They read from `engine.waveformAnalyser` / `engine.fftAnalyser`
  via `requestAnimationFrame`.

## Deployment

`docs/` is a **committed production build** served by GitHub Pages — it is not source.
`dist/` (the actual `vite build` output) is git-ignored. To publish, the build output
is copied into `docs/`. Do not hand-edit files under `docs/assets/`.
