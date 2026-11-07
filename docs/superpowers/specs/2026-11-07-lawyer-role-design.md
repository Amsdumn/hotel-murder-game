# Lawyer role design

## Intent

Add Lawyer (ทนายความ) as an optional Innocent secret role. On the Lawyer's skill slot each turn, the player selects two distinct, living guests other than themselves and privately learns only whether the two guests belong to the same team. This helps deduction without directly naming either team or role.

## Goals and constraints

- The host may include Lawyer in a custom Innocent pool; the system random mode may draw it. Existing Assassin and Accomplice counts and public avatar assignment stay the same.
- The server validates both targets, compares their server-owned `team` fields, and sends a result only to the Lawyer. No team names or role names appear in the result.
- One comparison is available per Lawyer skill slot. Normal death, blackout, and timeout rules apply. The UI and result copy work in Thai and English, including reconnect.
- Add two different WebP assets according to `docs/CHARACTER_ART_GUIDE.md`: an opaque close portrait and a transparent full-body character.
- Keep all existing roles documented in the role book and both languages.

## Approaches

1. **Tap two guest cards in the existing guest list (chosen).** Reuses the established player-target interaction and highlights both selections. The confirmation bar enables when exactly two valid guests are selected. This keeps the board and skill panel compact.
2. **Use two name selectors in the skill panel.** Easier to implement in isolation but duplicates the guest list, occupies more space on mobile, and is less consistent with existing skills.

## Behavior and interface

- Put Lawyer after Detective in `ROLE_ORDER` so its skill slot is predictable in the role book and turn flow.
- During the slot, eligible guest cards toggle selection. A third tap replaces the first selected guest; tapping a selected card removes it. Selected count and names appear in the skill panel and confirmation bar.
- Submit an array of exactly two distinct player IDs. The server rejects the Lawyer, unknown IDs, dead guests, duplicates, and non-array payloads without consuming the slot.
- Server result is one of two canonical Thai strings: `ผู้เข้าพักทั้งสองอยู่ฝ่ายเดียวกัน` or `ผู้เข้าพักทั้งสองอยู่คนละฝ่าย`. Translation maps them to English. The result appears in the private result overlay and history; no public event or Murderer-team result is emitted.
- Use role art of a poised adult lawyer in a dark burgundy late-1980s suit holding a slim case file; a distinct opaque face card and transparent full-body scene cutout keep the cinematic 3D anime visual style.

## Verification

- Engine tests cover same-team and different-team comparisons, invalid targets, one-use-per-turn, and private-only results.
- UI tests cover selecting two distinct living guests, selected state, and bilingual instructions/results.
- Role-book, art mapping, typecheck, lint, full tests, and production build pass. Commit the finished change without pushing.
