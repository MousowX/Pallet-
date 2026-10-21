# Earlier versions of pallet-lab.html

Every version, numbered oldest first. What each one changed is in `../docs/CHANGELOG.md`.

| File | What it is |
|---|---|
| `01_first-version.html` | The version this work started from |
| `02_2026-09-23_details-and-notch-check.html` | Details panel, drawing dimensions, notch inputs and notch strength check |
| `03_2026-10-14_end-boards-and-laps.html` | End-board widths, bottom layout, separate side and end laps |
| `04_2026-10-14_cut-list.html` | Plywood-rip cleats, sheet layouts with saw kerf, order quantity and cut list |
| `05_2026-10-14_better-sheet-layouts.html` | Fewer sheets, better splits and joint advice |
| `06_2026-10-16_space-between-notches-shown.html` | Space between notches in details and drawing |
| `07_2026-10-16_notches-set-by-space.html` | Notches set by the space between them |
| `08_2026-10-16_version-stamp_REVERTED.html` | Version stamp; Isaac went back to 07 |
| `09_2026-10-16_fixes-with-stamp_SUPERSEDED.html` | Error fixes with the stamp; replaced by 10 |
| `10_2026-10-17_master.html` | **Approved master**: 07 + error fixes, no stamp. Same as `../pallet-lab.html` on 2026-10-17 |

## How the tests use this folder
- `tests/compare_versions.js` and `tests/browser/compare_drawings.py` compare the working file with the **newest approved version** here: the highest number that isn't marked REVERTED or SUPERSEDED.
- After Isaac approves a release, copy `pallet-lab.html` here as the next number (for example `11_2026-11-02_master.html`) and add it to `../docs/CHANGELOG.md`. It then becomes the new baseline.
- Old saved design files from these versions are in `tests/fixtures/old-saves`.
