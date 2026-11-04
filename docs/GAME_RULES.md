# Hotel Murder Online game rules

## Hotel and players

The hotel has seven floors and three rooms per floor: `101–103`, `201–203`, `301–303`, `401–403`, `501–503`, `601–603`, `701–703`. Each player receives a unique room. Games support 5–10 players; seven is recommended.

Every game has exactly one Killer, one Accomplice, and only innocents in the remaining seats. At seven players, assign one of each of the five innocent roles. At five or six, randomly choose the needed innocent roles. At eight to ten, duplicate innocent roles as needed. A duplicate role is a distinct player and acts in ascending `seatIndex` order.

The Killer and Accomplice know each other's identities and rooms. Each innocent knows only their own role and room. Dead players enter Spectator Mode: they stay in the public player list, may remain connected, and may watch the board, discussion, voting phases, and public events. They cannot use skills, vote, access another player's private data, or return as living players. Spectators do not gain access to all roles before the game finishes.

ผู้เล่นที่เสียชีวิตแล้วต้องหยุดให้ข้อมูลเกี่ยวกับเกมทันที แม้จะยังสามารถรับชมเกมต่อได้. Display this reminder on entering Spectator Mode. MVP discussion happens outside the website, so external verbal communication cannot be technically prevented; do not add voice moderation or microphone monitoring.

## Initial crime scenes

After assigning roles and rooms, show all players a 15-second story prologue in `ROLE_REVEAL`. During this interval, the public board and private controls are hidden; no initial crime rooms have been selected or announced. When the persisted server deadline expires, select and publish the three rooms, then start the first skill slot with its full 60-second deadline. Reconnecting players see the same prologue until the server advances the phase.

After roles and rooms are assigned, select three **unique, unoccupied** rooms uniformly with a server-side random source. A selection containing any player's room is discarded and rerolled. No player dies during initial crime scene selection.

Publish the three selected room numbers and mark those rooms `CRIME_SCENE`. The selected rooms are empty by construction; no death notification is sent.

Initial crime scene rooms remain unavailable for voting throughout the game.

## Turns and victory

There are at most four turns. Each turn proceeds through Skill Phase, Discussion, Voting, and Resolution, following Role Reveal and Initial Crime. The explicit phases are `LOBBY`, `ROLE_REVEAL`, `INITIAL_CRIME`, `SKILL_PHASE`, `DISCUSSION`, `VOTING`, `RESOLUTION`, and `FINISHED`.

The Innocent team wins immediately if the Killer dies, even when the Accomplice survives. The Murderer team wins if the Killer remains alive through the end of turn four. Check victory after every death and after turn-four resolution.

After the game reaches `FINISHED`, reveal the winning team, every player's role, team, room assignment and final living/dead status, the important public events, and the number of turns played. Show `ผู้บริสุทธิ์ชนะ! ฆาตกรถูกเปิดโปงแล้ว` for an Innocent victory or `ฆาตกรชนะ! ความลับถูกฝังไว้ในโรงแรมแห่งนี้` for a Murderer victory. Never send this result projection before the game finishes.

## Skills

Each living player may use their own ability once per turn, only during their active slot. Slots use role order below; dead players are skipped. Disconnected players cannot block progress permanently. The server validates targets and advances after a valid action.

| Order | Role | Team | Action |
| --- | --- | --- | --- |
| 1 | Locksmith | Innocent | Lock one room for the current turn against Killer assassination only. The lock expires at turn end and does not stop voting. |
| 2 | Housekeeper | Innocent | Privately learn the number of living players on one selected floor. |
| 3 | Window Cleaner | Innocent | Privately learn the number of living players in room column 1, 2, or 3 across all seven floors. |
| 4 | Detective | Innocent | Inspect one room. If occupied by a living player, privately learn `INNOCENT` or `MURDERER`; otherwise learn `EMPTY`. Never learn identity or exact role. |
| 5 | Accomplice | Murderer | Select any other player. Learn their floor if they are alive. Selecting a dead player yields no floor information and still consumes this turn's skill. Reject unknown player IDs without consuming the skill. The result is private to the living Murderer team. |
| 6 | Killer | Murderer | Target one room. Kill its living occupant if unlocked; fail on a locked or empty room. Once per turn. On a successful kill, mark that room as murdered publicly without publishing the victim's or Killer's identity. |
| 7 | Witness | Innocent | Acts after the Killer chooses a room. Select one floor. If it contains an initial crime scene, privately learn whether the Killer's floor is `ABOVE`, `BELOW`, or `SAME_FLOOR`; otherwise receive no direction. If killed before their slot, the Witness is skipped. |

For successful assassination, broadcast the generic murder notification `{ type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม", turn: currentTurn }` and mark the victim's room `MURDERED` in public room state; announce victory separately if this ends the game. If that room is later opened through voting, show `OPENED_MURDERED`. The event and public history remain generic and do not include the room number. The victim receives a private death notification. Public data must not reveal the victim's identity, role, team, or Killer identity. If the target room is empty, locked, or already contains a dead player, send the failure result privately to the Killer; publish no murder event or room status change.

During the skill phase, public UI shows only `กำลังดำเนินการสืบสวน...`. Only the active player receives a private action request. Skip dead players silently; do not publish the active player's identity, internal role queue, skipped player identity, skill completion events, or action timestamps. Each skill slot has a persisted, server-owned 60-second deadline; an expired slot is silently skipped.

On a public `MURDER_OCCURRED` event, clients darken the screen, play a short suspense sound (unless muted), show `มีเหตุฆาตกรรมเกิดขึ้นภายในโรงแรม...` followed by `แต่ไม่มีใครรู้ว่าเหยื่อคือใคร`, then fade back over about 4.6 seconds. Support reduced motion. The server resolves the action immediately without waiting for animation. Reconnect restores authoritative state rather than replaying old animations.

## Discussion and voting

Discussion defaults to 180 seconds; the host may configure duration before game start. Players may speak outside the website and may lie about roles, rooms, and clues. The website does not verify discussion claims. Voice chat is outside the MVP.

Each living player may vote immediately in any order for one eligible room per ballot, including their own room. The first accepted vote is final for that ballot; the player cannot change it or cast another vote until a separate runoff ballot begins. Concurrent votes from different players must all be accepted without requiring them to resubmit after another player's vote. Initial crime scene rooms and rooms previously opened through voting are ineligible. The server must validate room geometry and eligibility for every initial vote and runoff vote; disabled frontend buttons are only a visual aid. A room number is valid only when it is an integer on floors 1–7 with room suffix 01, 02, or 03.

The room with the most votes opens. If multiple rooms tie, conduct one runoff limited to those rooms. If the runoff still ties, the server randomly chooses a tied room. A room opens at the end of every voting phase. An empty room is announced as `EMPTY ROOM`; a living occupant dies. Check victory immediately if that occupant is the Killer. Locks do not affect voting. Dead players cannot submit votes.

Public voting results reveal the selected room, whether it is empty or occupied, and whether the game ended. They do not reveal the occupant's identity or role during ongoing play. If the room contains a dead player, opening it does not revive or kill them again. Determine voting completion from the server's private living-player set; do not publish individual voter eligibility, voter identities, or counters that identify dead players. A tied first ballot starts a runoff with a fresh one-vote allowance for each living player.

The voting engine must use this server-side eligibility rule:

```typescript
function canVoteForRoom(
  roomNumber: number,
  crimeRooms: number[],
  openedRooms: number[],
): boolean {
  const floor = Math.floor(roomNumber / 100);
  const room = roomNumber % 100;
  const isValidRoom = Number.isInteger(roomNumber) &&
    floor >= 1 && floor <= 7 && room >= 1 && room <= 3;

  return isValidRoom &&
    !crimeRooms.includes(roomNumber) &&
    !openedRooms.includes(roomNumber);
}
```

## Information and authority

The server owns assignments, phases, clocks, skill outcomes, votes, deaths, and victory. Clients submit validated actions with an action ID and expected state version. Acknowledgements report accepted/rejected actions. Public state, individual private state, Murderer-team private state, and result state are distinct allowlisted projections. No client receives the complete game aggregate. Reconnect requires a secure token; replayed or stale actions cannot execute twice.

Public projections must not contain hidden room assignments, roles, teams, private investigation results, failed assassination targets, or hidden victim identities. This prohibition applies equally to Socket.IO broadcasts, API responses, Zustand state, server-rendered HTML, public event logs, and error messages. Public player entries include only ID, display name, and seat index. They omit `isAlive`, `isDead`, death reason/turn, room number, role, team, and gameplay connection changes. Dead players remain in the list. Public room states are `UNKNOWN`, `CRIME_SCENE`, `MURDERED`, `OPENED_EMPTY`, `OPENED_OCCUPIED`, and `OPENED_MURDERED`. A successful assassination reveals its room through public room state but not through the murder event or history. A murdered room remains eligible for voting until opened. Opening a room through voting does not identify its occupant.

Each player receives only their own role, team, room number, `isAlive`, Spectator Mode, skill/vote eligibility, and private notices/results. Living Murderer-team members may additionally receive the Killer and Accomplice identities and room assignments. A dead spectator cannot access another player's private state or the Murderer-team projection. Authorize every private projection from the server-side session.

The game screen hides role, room, team, private results, and personal action history until the player explicitly opens the private information panel. The panel starts closed on every visit. During the skill phase, only the active living player sees a prompt to act; discussion and voting prompts follow the server-owned phase and each player's eligibility. Public history records crime scenes, murders, opened rooms, phase changes, runoff, and victory without actor identity or private targets. Each player's accepted skills and votes, skill timeout, and own death are persisted in their private history and restored on reconnect; no other player receives that history.
