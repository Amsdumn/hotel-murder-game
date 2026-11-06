# Former Police Officer role design

The Former Police Officer is an optional Innocent secret role. Hosts may include it in their selected Innocent role pool; the game still assigns at most ten distinct secret roles and assigns public avatars independently.

## Skill

On this role's slot in each of the four possible turns, the server automatically gives the living officer one private, truthful clue about the public avatar assigned to the Assassin:

1. Turn 1: gender.
2. Turn 2: age bracket (decade, not exact age).
3. Turn 3: hair color and broad skin tone.
4. Turn 4: country of birth.

The clue is appended to the officer's private result and action history, and never appears in public or Murderer team state. A dead officer or one on a blacked-out floor misses that turn's clue. The role has no target-selection UI and consumes no interactive timer. Clues describe the Assassin's public character, not the officer's own avatar or a fixed role appearance. The server stores these avatar traits explicitly so results stay deterministic and localizable.

## Presentation

Add Thai and English role names, skill descriptions, clue translations, and Role Book documentation. Add a distinct opaque face WebP and transparent full-body WebP following the character art guide. Keep the twelve public avatars unchanged.

## Verification

Test clue order and accuracy for assigned avatars, private-only delivery, skip behavior for death and blackout, role selection and assignment, both languages, and the two asset mappings. Run the full test suite, TypeScript check, lint, and build. Commit the finished change without pushing.
