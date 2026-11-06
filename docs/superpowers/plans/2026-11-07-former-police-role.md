# Former Police Officer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add an optional Innocent Former Police Officer who automatically receives increasingly specific private Assassin avatar clues over four turns.

**Architecture:** Add explicit bilingual clue traits to the twelve public avatar profiles; use the Assassin's assigned avatar on the server at the officer's automatic skill slot. Keep role assignment independent of avatar assignment. Localize server results through the existing `gameMessage` path and add two distinct role art assets.

**Tech Stack:** Next.js, React, TypeScript, Vitest, WebP.

**Spec:** `docs/FORMER_POLICE_ROLE.md`

## Global Constraints

- Hosts choose the optional Innocent role through the existing role selection; at most ten players join.
- Clues are private, truthful, and ordered: gender, age decade, hair and broad skin tone, country of birth.
- Dead or blacked-out officers miss the current turn's clue.
- Player-facing UI and result copy work in Thai and English.
- Face portrait is opaque and full-body art has transparency; the two assets are distinct.
- Commit the finished change without pushing.

## Review Focus

- An Assassin assigned any of the twelve avatars gets traits from that avatar, regardless of secret role selection.
- Turn transitions or reconnects cannot award duplicate clues.
- No clue leaks through public state or Murderer team state.
- Automatic slots never expose a target action or interactive timer.
- Missing avatar IDs in legacy games give a safe, private unavailable message.

---

### Task 1: Role and clue data

**Files:** `src/types/game.ts`, `src/lib/avatars.ts`, `src/lib/avatar-translations.ts`, `src/lib/assassin-clues.ts`, associated tests.

- [x] Add `FORMER_POLICE` in the skill order after `DETECTIVE`.
- [x] Define typed, stable avatar clue traits and a function that builds the turn-specific private message.
- [x] Add tests for every turn, all avatars, and a missing legacy avatar.

### Task 2: Server automatic skill

**Files:** `src/server/game-engine/hidden-death.ts`, `src/server/game-engine/gameplay.ts`, `src/server/game-engine/gameplay.test.ts`, `src/server/game-engine/hidden-death.test.ts`.

- [x] Write failing tests for one clue per slot, death and blackout skips, privacy, and rejection of manual submission.
- [x] Resolve the officer automatically at their slot, append private result/action history, and emit a private event.
- [x] Run server tests.

### Task 3: Bilingual UI and documentation

**Files:** `src/components/role-portrait.tsx`, `src/lib/character-art.ts`, `src/lib/role-skills.ts`, `src/components/role-book.tsx`, `src/components/main-menu.tsx`, `src/lib/game-copy.ts`, `docs/CHARACTER_ART_GUIDE.md`, associated tests.

- [x] Add Thai and English role names, skill instructions, Role Book entry, and result translations.
- [x] Add distinct portrait and full-body asset mappings.
- [x] Run component and localization tests.

### Task 4: Role art and verification

**Files:** `public/art/former-police.webp`, `public/art/characters/former-police-3d.webp`.

- [x] Generate transparent full-body art with an existing role as style reference, then opaque close portrait using the new full-body image as identity reference.
- [x] Inspect alpha, framing, and visual identity; convert to WebP and place in workspace.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] Commit only files for this feature.
