# Innocent Role Selection Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the lobby host choose between custom Innocent role selection and automatic system selection before starting a game.

**Architecture:** Persist `innocentRoleMode` in each lobby, projecting legacy rooms as `CUSTOM`. `CUSTOM` retains the selected-role rules; `RANDOM` draws from all Innocent roles at game start and ignores the saved custom pool without deleting it. Both modes continue to enforce the player and readiness requirements.

**Tech Stack:** TypeScript, React, Socket.IO, Mongoose, Vitest.

**Spec:** User request on 2026-11-07: two major options, “กำหนดเอง” and “สุ่มตามระบบ”.

## Global Constraints

- Keep Thai and English copy for every new player-facing label.
- Keep legacy rooms in custom mode and preserve their chosen roles.
- Commit the verified change; do not push.

## Review Focus

- A random-mode host can start with no manually selected roles after all players are ready.
- Random assignment includes only distinct Innocent roles and never changes Assassin/Accomplice rules.
- Switching back to custom restores the prior selection and requires the correct count.
- Reconnect and guest views show the saved mode.
- A guest cannot change the mode.

---

### Task 1: Persist and enforce the mode

**Files:** `src/types/lobby.ts`, `src/server/lobby/lobby-store.ts`, `src/server/database/models.ts`, `src/server/lobby/lobby-service.ts`, `src/server/game-engine/game-service.ts`, associated tests.

- [x] Write failing tests for random start, legacy/custom validation, mode switching, and server-owned role assignment.
- [x] Add the mode to the schema, lobby projection, configuration, start checks, and game-start role selection.
- [x] Run server tests.

### Task 2: Lobby UI and rules

**Files:** `src/components/lobby/lobby-screen.tsx`, `src/components/lobby/lobby-screen.test.ts`, `src/components/main-menu.tsx`.

- [x] Write failing UI tests for both modes and bilingual explanatory text.
- [x] Add a responsive two-choice control and only show the custom role list in custom mode.
- [x] Save and restore the selected mode, including the dirty-state and status text.
- [x] Run UI tests.

### Task 3: Verify and commit

- [x] Run full tests, typecheck, lint, and build.
- [x] Inspect the diff, discard only generated build artifacts, and commit this change without pushing.
