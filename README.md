# Hotel Murder Online

Phase 2 foundation for a real-time social deduction browser game. The app serves a Thai main menu and multiplayer lobby through a custom Next.js and Socket.IO server. Gameplay and role assignment begin in Phase 3.

## Requirements

- Node.js 20.9 or newer
- npm
- MongoDB for persistent lobby data. The menu can render without MongoDB, but creating or joining a room requires a running database.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and adjust `PORT`, `HOSTNAME`, and `MONGODB_URI` for your environment.
3. Start MongoDB locally or set `MONGODB_URI` to a reachable MongoDB instance.
4. Run `npm run dev` and open `http://localhost:3000`.

The custom server loads `.env.local` before reading its settings. `MONGODB_URI` is validated when a lobby operation first requests a connection. Do not commit `.env.local`.

Create a room in one browser and join from another with its six-character code. Each browser keeps a rotating reconnect token in session storage; do not share that token. Players can ready or unready. The host can set a player limit from 5 to 10 and discussion time from 30 to 600 seconds. All changes are validated and versioned on the server. Starting the game is reserved for Phase 3.

The build and custom server use Next.js's webpack path. In this environment, the default Turbopack build exited while starting its CSS worker; the webpack build completed successfully.

## Checks

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. To run the production custom server after building, use `npm start`.

## Project layout

- `server.ts`: custom Node/Next.js/Socket.IO entry point
- `src/app`: App Router pages and layout
- `src/components`: MUI-backed UI components
- `src/stores`: UI-only Zustand state
- `src/types`: shared domain contracts
- `src/server`: Mongoose lobby models, versioned lobby service, and Socket.IO handlers; game engine will be added in Phase 3
- `docs/IMPLEMENTATION_PLAN.md`: milestones and architecture
- `docs/GAME_RULES.md`: authoritative game rules

The full game aggregate must remain server-side. Public, player-private, murderer-team-private, and result data use separate projections before any browser emission.
