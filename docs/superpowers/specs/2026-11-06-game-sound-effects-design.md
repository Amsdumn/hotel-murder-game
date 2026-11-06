# Game sound effects design

## Intent

Give players short audio cues at game start, their own skill turn, voting, room opening, and final reveal. Keep the existing murder cue and one shared mute control.

## Approach

Use Web Audio synthesis, matching the existing murder cue. Recorded files could sound more realistic but require asset sourcing and larger downloads; synthesis keeps this change small and lets each event have a distinct motif.

## Behavior

- Game start plays at the prologue; a skill turn plays only for its active player; voting, room opening, and the final result play for every connected player.
- Cues are short and restrained. Muting is local to each browser, persists across reloads, and controls all six cues including murder.
- Repeated state updates and reconnects do not replay a cue. Browsers that block sound until user interaction remain silent until audio is allowed.
- The prologue has the same bilingual mute control as the game screen. No server rules or secret role data change.
