# Pallet tools: work only on PALLET·LAB

**Decided:** 2026-10-16 · **Updated:** 2026-10-17

## Decision
**PALLET·LAB is the only pallet tool.** It is the only source for load capacity, and every future update goes into it. The 40×48 load calculator and PalletForge are not developed further.

## Master file
- The working file is **pallet-lab.html of 2026-10-17**. All updates start from it.
- A frozen backup is saved in this project: `pallet-lab/pallet-lab-backup-2026-10-17.html`.
- It is the version from before the version stamp (step 3), plus the error fixes of Oct 16–17 and the old-save conversion. Printouts say "PALLET·LAB in-house tool"; there is no version stamp.
- Further work is planned in Claude Code: a folder or repo with the file, a CLAUDE.md with the rules, and the test scripts. Changes go on a separate branch and Isaac approves them before they reach main.

## Why one tool
- Three tools had three copies of the capacity math, and they drifted apart. The September notch fix only reached PALLET·LAB.
- What that check is worth, GMA 48×40 in a rack, long span 44″: **339 lb** with the notch check vs **947 lb** without it (about 2.8× higher). The other two tools were not run directly; this is the same math with and without the check.

## Status
- **Old saved designs** (files and the in-browser list, from every earlier version) open with all their values; renamed fields are converted. Files from September or earlier show corrected numbers (notch check, bottom boards under the block columns, plywood by sheet layout).
- **Known open issue:** the forklift capacity ignores the notches, so it reads too high when forks go in through them.
- **Old spec sheets** printed from the other two tools may overstate capacity. Worth a check if any went to clients.

## Note on inputs
Capacity is only as good as the sizes entered. On the GMA 48×40, using the sizes actually delivered (1¼″ stringers, 9/16″ boards) instead of 1½″ and ¾″ drops the governing capacity from **336 lb to 189 lb**. Enter delivered sizes.
