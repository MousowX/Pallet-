# PALLET·LAB — changelog

Newest first. The numbers match the files in `../history`. The working file `../pallet-lab.html` is version 11.

## 11 · 2026-10-20 — restructure and design database (working file)
Version 10 with its code reorganized and a database for saved designs. Every result is the same as version 10: capacities, bill of materials, details, warnings, cut list, both printouts, saved files and the drawings (600 designs and 120 drawings compared, no differences).
- The code lives in `src/`, one file per part (calculations, drawing, printouts, designs). `node build.js` joins it into the one self-contained `pallet-lab.html`, which still opens with a double-click, offline.
- DESIGNS list: every design is kept in one database in the browser (IndexedDB): SAVE HERE, every SAVE FILE and LOAD FILE (under the file's name), and the new IMPORT FILES TO THE LIST for many files at once. A design saved under a name already in the list replaces it and keeps its place.
- A search box over the list: name, client, part #, type or date; every word must match; accents and capitals don't matter.
- Designs saved in the browser by earlier versions move into the database the first time this version opens; the old list is kept as a backup in the browser. Earlier versions then show an empty in-browser list.
- Where the browser refuses the database, the older in-browser list is used as before. Blocked or full storage is reported as before.
- Lighter on the computer: a panel is rewritten only when it changes, the drawing area isn't reallocated on every keystroke, and a window resize redraws without working the design out again.

## 10 · 2026-10-17 — master
Version 7, plus the error fixes of Oct 16–17. It has **no version stamp**: Isaac asked to go back to the version before step 3.
- A damaged in-browser design list no longer leaves the tool as a blank page; bad entries are skipped.
- A bad or foreign design file is refused before anything changes. Values a field can't take go back to their default, and a message says how many.
- Error messages are in plain words and stay on screen long enough to read.
- When browser storage is full, the tool says so and Delete still works. A second open tab sees saves and deletes.
- Drawing: no "0″" measurement on top of the notch label when the notches sit at the ends.
- Fork entry: "Restricted — the panel laps lower the openings" replaces "None — openings covered" when the laps only lower the openings. The warnings say "lowers … to X″". The rule is unchanged; only the wording changed.
- The bill of materials uses one number format (40, 25.5, 39.25, never 40.00 next to 48).
- The "INT … CLEAR" label in the top view has a halo, so lines don't run through it.
- Text: the box hint no longer shows the code name "ct"; "centred" became "centered"; saved file names keep ñ and accents.
- Old files from the first version keep their notches where that version drew them (9″ long, centered at 27% and 73% of the length, depth min(1.5″, 40% of the stringer)).

## 09 · 2026-10-16 — error fixes with version stamp (SUPERSEDED)
The same error fixes, on top of version 8, with the stamp "v2026-10-16b". Replaced by version 10.

## 08 · 2026-10-16 — version stamp (REVERTED)
"PALLET·LAB v2026-10-16" on screen, on the spec sheet, on the cut list and in saved files. It was part of step 3 (one tool for capacity). Isaac asked to go back to the version before it.

## 07 · 2026-10-16 — notches set by the space between them
- New input "Between notches" replaces "Notch from each end". The two notches are centered on the stringer.
- Old files are converted so the notches stay where they were.
- Warnings when the notches don't fit on the stringer or meet in the middle.

## 06 · 2026-10-16 — space between notches shown
- "Between notches" (and center to center) in the details panel and on the spec sheet.
- Side elevation: dimension chain (end → notch → notch size → space between), also on pallet boxes.

## 05 · 2026-10-14 — better sheet layouts
- The plywood layout also tries plain grids and keeps the layout with the fewest sheets. It is never worse than cutting each part type on its own sheets, and whole orders use about 6.6% fewer sheets.
- Parts bigger than a sheet are split two ways (shared remainder, or a 12″ strip), and the better way is used.
- The joint advice matches the part: floor joints on a stringer or board; cleat strips with a splice plate; walls and lid with a cleat behind the joint.
- The printed cut list shows every sheet layout.

## 04 · 2026-10-14 — cut list
- Cleat stock: lumber 1×4 or plywood rips. Rips are ISPM-15 exempt and use about 580 psi for stacking.
- Plywood laid out on real sheets with a saw kerf, using straight cuts only. Sheet size and kerf are inputs.
- Order quantity, and a cut list for the whole order: lumber pieces grouped by size, sheets per thickness with drawings, and nails.
- CUT LIST print button.
- Fixed: walls no taller than their two rails listed 0″ vertical cleats and counted them for stacking.

## 03 · 2026-10-14 — end boards, bottom layout, laps
- End-board width for the top and bottom decks (blank = same as the rest).
- Bottom deck layout: "Clear the notches (GMA)" or "Even spacing".
- Separate side and end skirt laps. The export crate preset keeps the fork openings clear.

## 02 · 2026-09-23 — details panel and notch check
- Details panel and spec-sheet section: board gaps, center to center, coverage, stringers or blocks, fork openings, warnings.
- Drawing dimensions for board gaps, notches and fork openings.
- Notch inputs (length, depth, distance from each end) and a strength check at the notch in the racked capacity.
- Bottom deck boards run across the stringers (they ran lengthwise before).
- Pallet box on a block base: one bottom board under each block column, and one stringer board per block row (the stringer-board count field was retired).

## 01 · first version
Stringer pallets, block pallets and pallet boxes, with a 2D drawing, bill of materials, capacity estimates and a printable spec sheet. Designs are saved as .json files or in the browser. Notches were only drawn: they had no inputs and no strength check.
