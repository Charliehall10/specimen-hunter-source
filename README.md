# Specimen Hunter: source code

Source code for **Specimen Hunter**, an original British carp-fishing slot (5 reels × 3 rows, 10 lines, 96.16% RTP).

[▶ Play the demo](https://charliehall10.github.io/specimen-hunter/play/) · [Case study](https://charliehall10.github.io/specimen-hunter/) · [Demo site repo](https://github.com/Charliehall10/specimen-hunter)

## What's here

| Folder | What it is |
|---|---|
| `client/` | The game: PixiJS 8 + Vite. All art, music and sound are generated in code. Contains the maths engine (`src/engine.js`) and its tests. |
| `server/` | Game server on plain `node:http` with no dependencies: sessions, GB stake limits, a whole-pence wallet, round history and safe retries. |
| `math/` | Python simulator that defines the maths, plus scripts that build the PAR sheet. |
| `desktop/` | Electron wrapper that packages the game as a Linux AppImage. |
| `site/` | Build and publish scripts for the portfolio site on GitHub Pages. |
| `docs/` | Game spec, PAR sheet, IP and regulatory check, pitch deck source and a dated dev log. |

## Running it

```
cd client && npm install && npm run dev     # play at http://localhost:5173 (symbols: /art-sheet.html)
cd client && npm test                       # engine tests
cd client && npm run verify                 # RTP check against the Python simulator (20M rounds)
cd server && npm test && npm start          # API tests, then the server on port 8787
bash site/build.sh                          # build the static demo site into site/dist
```

## How the maths is checked

The Python simulator in `math/` defines the game and exports the reel strips. The JavaScript engine is a port of it, and the same engine file runs in the browser demo and on the server. The RTP is worked out exactly from the strips (96.24% before the 5,000× win cap), including the baited-swim multipliers, which are stepped through every possible feature, and the kingfisher, which is averaged over every set of spots it can pick. The cap's cost is measured by playing 20 million features without it (0.085% ± 0.010), giving a design RTP of **96.16%**. Simulations agree: 96.30% ± 0.25% over 50 million rounds of the JS engine and 96.17% ± 0.08% over 500 million rounds of the Python simulator.

## Status

This is a **demo**: it uses demo money and a secure but **uncertified** random number generator, so it is not for real-money play. 18+ · [BeGambleAware.org](https://www.begambleaware.org/)

Created by **Charlie Hall** · [LinkedIn](https://www.linkedin.com/in/charliehall20)
