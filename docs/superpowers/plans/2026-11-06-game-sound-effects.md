# Game Sound Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add five short sound cues to the game and unify mute behavior.

**Architecture:** A pure cue selector maps state transitions to event keys. A shared Web Audio synthesizer plays distinct motifs. The game screen owns local mute and deduplication; the lobby primes browser audio on interaction.

**Tech Stack:** React, TypeScript, Web Audio API, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-game-sound-effects-design.md`

## Global Constraints

- Thai and English controls; local browser preference.
- Keep server game logic and role assignment intact.
- Commit only files belonging to this change; do not push.

## Review Focus

- A reconnect or duplicate state update must not replay audio.
- A skill alert must not sound for other players.
- A runoff voting round should be distinguishable from repeat updates.
- Muting must also stop the existing murder cue.
- Autoplay blocking must not throw or break the game UI.

### Task 1: Cue selection and synthesis

**Files:** Create `src/lib/game-sound.ts`, `src/lib/game-sound.test.ts`.

**Interfaces:** `getGameSoundEvent(previous, current)` returns a cue and stable event key, or null; `playGameSound(cue)` and `primeGameAudio()` wrap Web Audio.

- [x] Write tests for start, private skill turn, vote, runoff, room opening, result, and duplicate/reconnect suppression.
- [x] Run the focused test and see it fail.
- [x] Implement cue selection and short Web Audio motifs.
- [x] Run the focused test and see it pass.

### Task 2: UI wiring and verification

**Files:** Modify `src/components/game/game-screen.tsx`, `src/components/game/murder-event-overlay.tsx`, `src/components/lobby/lobby-screen.tsx`.

- [x] Add shared mute state, prologue control, local persistence, and event playback.
- [x] Prime audio from lobby user interaction and route the murder cue through the shared synthesizer.
- [x] Run tests, typecheck, and lint; inspect the diff.
- [x] Commit the finished change.
