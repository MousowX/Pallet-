# PALLET·LAB

`pallet-lab.html` is a single-file tool for Maderas y Tarimas Cobaza. It designs wood pallets and pallet boxes: stringer pallets, block pallets and cleated plywood crates. It shows a 2D orthographic drawing and a bill of materials, with a cut list for the whole order that lays out the plywood sheets. It estimates load capacity, prints a spec sheet and a cut list, and saves designs as .json files or in the browser.

This file is the only pallet tool and the only source of load-capacity numbers. Every update goes into it.

## Project layout
| Path | What it is |
|---|---|
| `pallet-lab.html` | the tool: the working file |
| `history/` | every earlier version, numbered; the newest approved one is the baseline for comparisons (see `history/README.md`) |
| `tests/` | automatic checks (below), old saved designs in `tests/fixtures/old-saves` |
| `docs/` | `CHANGELOG.md`, the decision note, and Isaac's checklist (`.xlsx`) |
| `README.md` | overview for Isaac, in Spanish |

## Rules
- **One self-contained HTML file.** Inline CSS and JavaScript only: no libraries, CDNs or web fonts to download. It must work offline by double-clicking the file.
- **No prices or costs** anywhere in the tool or its printouts.
- **Lumber:** only White Fir and Pino Mexicano, dry lumber (MC ≤ 19%). Don't add species or wet-service factors.
- **Colors:** a change to the page's colors applies to the screen interface only. The 2D drawing and the printouts keep their own colors.
- **Language:** the interface is in English. Keep the Spanish shop terms already used (tablas, triplay, seco).
- **Capacity math:** never change it silently. Say what changed and show before and after numbers for the GMA 48×40 (the RESET button) and the export crate preset.
- **Printing:** a pallet spec sheet must fit on one Letter page.

## Saved designs: keep old files working
- A design file is JSON: `{fmt:"pallet-lab/1", type, saved, f:{<input id>: value}}`. Every `input` and `select` with an id in `#main` is saved automatically (`collectState`).
- **Renaming or removing an input:** add the old id to `RETIRED` and add a rule to `MIGRATE`, so old files open the way they were saved.
- **A new input:** a file without it must open the way it did before, either through the input's default value or a `MIGRATE` rule.
- After any change to inputs, run `node tests/oldfiles.js`. Before changing the format, follow `tests/fixtures/old-saves/README.md`.

## Restructuring or refactoring
- A restructure must not change any result. Two checks prove it against the baseline in `history/`:
  - `cd tests && npm run compare`: capacities, bill of materials, details, warnings, cut list, both printouts and saved files, over 600 designs.
  - `python3 tests/browser/compare_drawings.py`: the drawings, pixel for pixel.

  Both must report no differences. Screen-drawing differences alone are expected only if the page layout changed on purpose.
- If the source is split into several files, the tool Isaac uses must still be one self-contained `pallet-lab.html` (a build step is fine), and the tests run on that file.
- The tests use the element ids and page functions listed at the top of `tests/compare_versions.js`. Keep them, or update the tests in the same change.

## Where things are in pallet-lab.html
| Section (search for the banner) | What it does |
|---|---|
| `SPECIES DATABASE` | the two species and their design values |
| `STATE` | `V(id)` reads every number and keeps it inside the input's limits; `inch()` formats sizes |
| `GEOMETRY MODEL` | notches (`notchGeom`), deck boards (`deckBoards`), bottom deck layouts (`bottomBoards`) |
| `CUTTING` | plywood splitting and sheet layouts (`splitToFit`, `fillSheet`, `nestParts`, `cutPlywood`), lumber cut list, `buildModel` |
| `STRUCTURAL ANALYSIS` | beam-theory capacities, notch check, stacking (`analyze`) |
| `PALLET DETAILS` | gaps, spacing, fork openings, warnings (`palletDetails`) |
| `RENDER: …` | capacity cards, bill of materials, cut list panel and printed cut list |
| `2D SPEC DRAWING` | top, side and end views (`drawSpec2D`); paper version (`printDrawingPNG`) |
| `SPEC SHEET (print)` | the printed spec sheet (`buildSpec`) |
| `UPDATE PIPELINE` / `EVENTS` | `update()` runs on every change; buttons, presets, printing |
| `SAVE / LOAD DESIGNS` | design files, browser list, `RETIRED`, `MIGRATE`, `applyState` |

## Before calling a change done
1. Run `cd tests && npm install` the first time, then `npm test`. Every script must end with `failed checks: 0`.
2. Run `npm run compare`. For a restructure it must show no differences. For a real change it must show only the intended ones: list them for Isaac.
3. Browser checks, when Python and Playwright are available, from `tests/browser/`:
   - `flows.py`: browser list, design files, switching types, printing;
   - `printfit.py`: a pallet spec sheet fits one page;
   - `labels.py`: no labels on top of each other in the drawings;
   - `inputs_fit.py`: every input shows its whole value;
   - `compare_drawings.py`: the drawings match the baseline.
4. Open `pallet-lab.html` in a browser. Look at the changed area on screen and in print preview, for both the spec sheet and the CUT LIST.
5. Tell Isaac in plain words what changed. Include before and after numbers whenever capacity, the bill of materials or the cut list change.

## Git and releases
- Make one branch per change. Never commit or push directly to `main`: Isaac reviews and approves every merge.
- After Isaac approves a release:
  - tag it with its date (for example `git tag 2026-10-17`);
  - copy `pallet-lab.html` into `history/` with the next number;
  - add a section to `docs/CHANGELOG.md`.

## Known open issues
- FORK SUPPORT capacity ignores the notches, so it reads too high when forks go in through them.
- Screen drawing: on long pallet boxes with exterior edge cleats, the top view's vertical "EXT" dimension (left side) runs off the left edge of the drawing area. Example: a 120×48 box with exterior edge cleats. The paper drawing is fine.
- Paper drawing: when a notch sits about 1″ from the stringer end and is short (6″), the "1″" and "6″" labels of the notch dimension chain print on top of each other. Example: a 36″ box base with 6″ notches and 22″ between.
- Until the two drawing issues are fixed, `tests/browser/labels.py` reports them: 1 case with the default 250 designs.
