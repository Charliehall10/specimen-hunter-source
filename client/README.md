# Specimen Hunter client

PixiJS 8 + Vite. All art and sound are generated in code; there are no asset files.

```
npm install            # first time only
npm run dev            # play at http://localhost:5173
npm test               # engine tests (seeded, ~3 s)
npm run verify         # RTP check against the Python numbers (20M rounds, ~20 s)
npm run build          # demo build in dist/ (includes DEMO BONUS)
npm run build:release  # build without the DEMO BONUS button
```

Controls: Space / Enter spin, arrow keys change stake, I info, H history, M mute.

## Files

| File | What it does |
|---|---|
| `src/engine.js` | Game maths (JS port of `math/specimen_hunter_sim.py`). Decides every outcome. |
| `strips.json` | Reel strips exported from the simulator. |
| `src/main.js` | Game flow: rounds, free spins, win presentation, session tracking. |
| `src/reels.js` | Scrolling reels with fixed stop times (no slam stop). |
| `src/art.js` | Canvas-drawn symbols, lakeside scenes, frame and logo. |
| `src/audio.js` | WebAudio sound effects. |
| `src/ui.js`, `src/panels.js` | Buttons, HUD, info/history/reality-check screens. |
| `src/config.js` | Layout, stakes, timings and other presentation settings. |
| `src/engine.test.mjs`, `src/verify.mjs` | Tests and RTP check. |

Presentation code never changes outcomes. To change the maths, edit the simulator, re-export the strips and re-run `npm run verify`.
