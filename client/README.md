# Specimen Hunter client

PixiJS 8 + Vite. All art, music and sound effects are generated in code; there are no asset files.

```
npm install            # first time only
npm run dev            # play at http://localhost:5173
npm test               # engine tests (seeded, ~3 s)
npm run verify         # RTP check against the Python numbers (20M rounds, ~20 s)
npm run build          # demo build in dist/ (includes DEMO BONUS)
npm run build:release  # build without the DEMO BONUS button
```

While `npm run dev` is running, http://localhost:5173/art-sheet.html shows every symbol, the baited-swim patch,
both logos, the kingfisher, the baiting catapult and the app icon, for checking artwork without playing. It is not
part of the game build. `art-sheet.html?icon=512` shows just the app icon at 512 px (`desktop/icon.png` and
`public/favicon.png` were saved from it).

Controls: Space / Enter spin, arrow keys change stake, I info, H history, N music on/off, M mute all sound.

## Files

| File | What it does |
|---|---|
| `src/engine.js` | Game maths (JS port of `math/specimen_hunter_sim.py`). Decides every outcome. |
| `strips.json` | Reel strips exported from the simulator. |
| `src/main.js` | Game flow: rounds, the kingfisher, free spins and baited swims, win presentation, session tracking. |
| `src/reels.js` | Scrolling reels with fixed stop times (no slam stop). |
| `src/art.js` | Canvas-drawn symbols (fish built from species shapes, tackle with outlines), lakeside scenes, reel background, swims, frame and logo. |
| `src/audio.js` | WebAudio sound effects. |
| `src/ui.js`, `src/panels.js` | Buttons, HUD, info/history/reality-check screens. |
| `src/config.js` | Layout, stakes, timings and other presentation settings. |
| `src/engine.test.mjs`, `src/verify.mjs` | Tests and RTP check. |
| `art-sheet.html`, `src/artSheet.js` | Dev-only symbol sheet. |

Presentation code never changes outcomes. To change the maths, edit the simulator, re-export the strips and re-run `npm run verify`.
