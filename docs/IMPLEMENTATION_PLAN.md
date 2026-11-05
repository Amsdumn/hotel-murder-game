# Hotel Murder Online implementation plan

## Architecture

- **Single process:** a custom Node.js HTTP server prepares Next.js App Router and attaches Socket.IO to the same HTTP server. Deploy to a Node host that supports long-lived WebSocket connections. Avoid Next.js `standalone` output because it does not trace a custom server.
- **Domain boundary:** `src/server/game-engine` owns roles, room assignment, clue rooms, turns, skills, voting, and win conditions. Socket handlers authenticate, validate with Zod, call application services, and emit only viewer-specific projections.
- **Persistence:** Mongoose models for games, player sessions, and game events. Game actions will use optimistic concurrency on a state version and an action ID for idempotency. A per-game serialized command path will guard simultaneous socket events.
- **Client:** App Router pages render public shell content. Client components use MUI controls, Tailwind layout utilities, and Zustand only for local UI state and authorized projections. All visible text is Thai.
- **Privacy:** private role, room, death notices, and ability results are sent only to authorized sessions; living Murderer-team members may receive teammate assignments. The full game aggregate never crosses the server boundary. Public players retain ID, display name, and seat index with no alive/dead or gameplay connection status. A successful assassination marks its room publicly without exposing the victim's identity.

## Dependencies

Runtime: `next`, `react`, `react-dom`, `@mui/material`, `@mui/material-nextjs`, `@emotion/react`, `@emotion/styled`, `@emotion/cache`, `tailwindcss`, `socket.io`, `socket.io-client`, `mongoose`, `zod`, `zustand`.

Development: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `tsx`, `eslint`, `eslint-config-next`, `vitest`, `@tailwindcss/postcss`, `postcss`.

## Risks and controls

1. **Hidden information:** DTO allowlists and tests must prove public payloads, API responses, SSR, Zustand, public events, and errors never expose hidden victim identities, death status, roles, teams, private results, failed assassination targets, or active skill actors. Initial crime scene rooms are empty; successful assassination emits a generic murder notification and marks its room as murdered in public state.
2. **Concurrent actions:** state version checks and unique action IDs must make retries safe and reject stale actions; use MongoDB optimistic concurrency and serialize commands per game.
3. **Reconnect and identity:** store hashed, high-entropy reconnect tokens in player sessions; never trust client role, team, or room values.
4. **Disconnected actors and timers:** server-owned deadlines must advance the game without a connected active player, including after restart.
5. **Empty initial crime scenes:** choose three unique unoccupied rooms after assigning players. Reroll any selection containing a player's room. Initial selection causes no deaths.
6. **Deployment:** a custom Node server and WebSockets need a persistent Node runtime; serverless-only hosting is unsuitable for this design.

## Milestones

### Phase 1 — Foundation

- [x] Inspect repository and document architecture, dependencies, and risks.
- [x] Document complete game rules in `docs/GAME_RULES.md`.
- [x] Configure Next.js App Router, strict TypeScript, ESLint, Vitest, and Tailwind.
- [x] Add MUI theme/provider, responsive Thai main menu shell, and Zustand UI-only store.
- [x] Add shared domain contracts without implementing gameplay.
- [x] Add custom Node server with Socket.IO initialization and a MongoDB connection helper.
- [x] Add `.env.example`, startup documentation, and run typecheck, lint, tests, build, and startup checks.

### Phase 2 — Lobby system

- [x] Define Game, PlayerSession, and GameEvent Mongoose models and indexes.
- [x] Implement create/join lobby, 5–10 player limit, room codes, ready/unready, host permissions, and reconnect token rotation.
- [x] Add lobby UI and socket acknowledgements, action IDs, version checks, and multi-window integration tests.

### Phase 3 — Game engine

- [x] Add isolated hidden-death, public/private projection, spectator eligibility, silent skill-turn skipping, room eligibility, and public voting outcome modules with unit tests.
- [x] Implement randomized role/room assignment for 5–10 players and select three empty initial crime scene rooms.
- [x] Implement role-order queue with seat-index tie break, ten skills, death, and win handling. Players explicitly reveal their private role during the prologue; Receptionist and Photographer receive their private automatic results on turn three.
- [x] In the isolated engine, publish three empty `CRIME_SCENE` room numbers; initial selection causes no deaths or private death notifications.
- [x] In the isolated engine, publish a generic `MURDER_OCCURRED` and mark the murdered room on successful assassination, hide victim/Killer identities, and privately notify the victim; keep failed attempts private. Selecting a dead player with the Accomplice skill consumes that turn's use without a floor result.
- [x] Implement persisted server-owned skill, discussion, voting, and resolution timing; immediate order-independent room voting; runoff; and server-random final tie break or zero-vote room choice. Retry concurrent version conflicts so different players can vote without resubmitting; keep each player's first vote final for that ballot. Use `canVoteForRoom(roomNumber, crimeRooms, openedRooms)` on the server for initial and runoff votes; allow self-room votes and reject clue rooms, opened rooms, and invalid hotel rooms.
- [x] In the isolated engine, enforce dead-player skill and vote restrictions and preserve the dead player's public roster entry and private Spectator Mode.
- [x] Persist and connect engine state to sessions; prevent a dead player from returning as living through reconnect.
- [x] Add isolated unit tests for empty initial crime scenes; successful/failed assassination notices; self-room, opened-room, and crime-room voting; concurrent voting, one vote per ballot, dead-player vote/skill rejection; silent turn skipping; and immediate Innocent victory when the Killer dies.
- [ ] Expand service/transport privacy tests across every public boundary. Socket.IO murder privacy and spectator reconnect tests are in place; API, SSR, Zustand, and error response coverage remains.

### Phase 4 — Gameplay UI

- [x] Build private role display, 21-room hotel board, generic public skill-phase status, skill forms, discussion timer, voting, private death screen, spectator view, public room outcomes, and result screen. Public murders trigger a 4.6-second sound and motion overlay with mute and reduced-motion support.
- [x] Start the private information panel closed, show server-authoritative phase and active-turn notices, and render a minimal hotel board. Persist public phase/event history separately from each player's private accepted-action history so reconnect restores both without leaking hidden data.
- [ ] Check desktop/mobile layout and ensure room styling does not disclose hidden occupancy or victim identity; mark initial crime scenes, successfully murdered rooms, and publicly opened voting rooms.

### Phase 5 — Multiplayer integration

- [x] Connect server-authoritative game commands to Socket.IO, including private results, public updates, reconnection, and persisted deadline recovery after process restart.
- [x] Broadcast generic `MURDER_OCCURRED` only after a successful kill, mark that room in public state, route death notices only to the victim, and withhold actor/victim identifiers from other clients.
- [ ] Add multi-client integration tests for turn order, hidden dead-player skipping, voting completion without voter eligibility leaks, spectator access, phase sync, private death notices, and public/private information boundaries across broadcasts, API responses, SSR, client state, event logs, and errors.

### Phase 6 — Polish and release checks

- [ ] Improve responsive behavior, motion, errors, reconnect recovery, and deployment configuration.
- [ ] Run security, multiplayer end-to-end, production build, and deployment smoke checks.

## Phase 1 acceptance checks

- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- `npm run dev` serves the Thai main menu and the custom server initializes Socket.IO.
- The MongoDB helper validates configuration and connects lazily, so the landing page can build without a live database; later data operations must require the connection.
- No lobby or gameplay actions are implemented in this phase.
