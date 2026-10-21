# Old saved designs

Design files saved by earlier versions of PALLET·LAB, one stringer pallet, one block pallet and one pallet box per version. `oldfiles.js` opens each one in the current `pallet-lab.html` and checks that:

- every value in the file comes back unchanged,
- the pallet type is kept,
- fields the file doesn't have (renamed or added later) open with the values in `expected.json`,
- no "unknown field" or "unreadable value" message appears.

| Prefix | Saved by | What changed in the format |
|---|---|---|
| `1-first-version` | first version (before Sep 23) | no notch inputs; one skirt lap; stringer-board count |
| `2-sep-23` | Sep 23 | notch length, depth and distance from each end |
| `3-oct-14` | Oct 14 | end-board widths, bottom layout, side and end laps, cleat stock, order quantity, sheet size, saw cut |
| `4-oct-16-notch-from-ends` | Oct 16 (morning) | same fields as Oct 14 |
| `5-oct-16-space-between-notches` | Oct 16 | "space between notches" replaces "from each end" |
| `6-oct-16-version-stamp` | Oct 16 (stamped build) | adds a `tool` line at the top; same fields |

## When the saved format changes

1. Before changing it, save one design of each type with the current version and copy the files here, with a new numbered prefix.
2. Make the change, with a `RETIRED` entry and a `MIGRATE` rule for anything renamed or removed.
3. Add the new files to `expected.json`: `type`, plus `converted` = the values the fields missing from the file must open with.
4. Run `node oldfiles.js`.
