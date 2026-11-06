# Lawyer Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Innocent Lawyer who privately compares the teams of two distinct living guests each turn.

**Architecture:** Add Lawyer to the shared role union and ordering. Reuse the existing skill action and private result pipeline with a two-player-ID target, and extend guest-card selection to hold two IDs. Add distinct role art and bilingual role/rules copy.

**Tech Stack:** TypeScript, React, Next.js, Vitest, image generation/WebP.

**Spec:** `docs/superpowers/specs/2026-11-07-lawyer-role-design.md`

## Global Constraints

- Server owns all team comparison and target validation; never publish either target's team in the Lawyer result.
- Respect death, blackout, timeout, one-use-per-turn, and reconnect behavior.
- Support Thai and English in new player-facing copy.
- Two distinct WebP assets: opaque portrait and transparent full-body cutout.
- Commit only this change; do not push.

## Review Focus

- Same-team and different-team results are private and contain no team names.
- Invalid or duplicate targets do not consume the Lawyer's turn.
- All eleven old roles remain documented and game assignment stays independent of public avatars.
- Guest selection resets per turn and does not accept dead guests or the Lawyer.

### Task 1: Engine and role data

**Files:** `src/types/game.ts`, `src/server/game-engine/gameplay.ts`, engine tests, `src/lib/game-copy.ts` and tests.

- [x] Write failing engine tests for Lawyer assignment, both comparison outcomes, invalid targets, and private-only delivery.
- [x] Add Lawyer role and server-side comparison with bilingual result translation.
- [x] Run focused tests and typecheck.

### Task 2: Player interface and documentation

**Files:** `src/components/game/game-screen.tsx`, game-screen tests, `src/components/role-book.tsx` and tests, `src/lib/role-skills.ts`, `src/components/role-portrait.tsx`, `src/lib/character-art.ts`, `src/components/lobby/lobby-screen.test.ts`.

- [x] Write failing UI and rules tests for two-card selection and bilingual guidance.
- [x] Add Lawyer selection, skill panel summary, role text, role-book entry, and art mappings.
- [x] Run focused tests and typecheck.

### Task 3: Role art and verification

**Files:** `public/art/lawyer.webp`, `public/art/characters/lawyer-3d.webp`, `docs/CHARACTER_ART_GUIDE.md`.

- [x] Generate and inspect distinct full-body and portrait images; convert to WebP and verify alpha/opacity.
- [x] Update the art guide for the twelfth role.
- [x] Run full tests, lint, typecheck, build; inspect diff and commit.
