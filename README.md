# Hotel Murder Online

A real-time Thai and English social deduction browser game set in a seven-floor hotel. The custom Next.js and Socket.IO server runs the lobby, assigns hidden roles and rooms, resolves skills and voting, and sends each player only the information they may see. Players can inspect the twelve 3D anime characters on the main menu. Character identities stay hidden in the lobby and are randomly assigned when the game starts, independently of secret roles.

Use the ไทย / EN control on the menu, lobby, or game screen to change the interface language. The choice is stored in that browser and restored after refresh or reconnect. Players in the same room can use different interface languages; game state and privacy rules stay the same.

## Requirements

- Node.js 20.9 or newer
- npm
- MongoDB for persistent lobby data. The menu can render without MongoDB, but creating or joining a room requires a running database.

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and adjust `PORT`, `BIND_HOST`, and `MONGODB_URI` for your environment. `BIND_HOST=0.0.0.0` lets the server accept connections on the LAN; the unrelated machine `HOSTNAME` variable is ignored.
3. Start MongoDB locally or set `MONGODB_URI` to a reachable MongoDB instance.
4. Run `npm run dev` and open the `Local` URL printed by the server. Share a printed `Network` URL with friends on the same LAN. If their browser cannot reach it, allow the Node.js process through the host firewall on private networks.

The custom server loads `.env.local` before reading its settings. `MONGODB_URI` is validated when a lobby operation first requests a connection. Do not commit `.env.local`.

Create a room in one browser and join from another with its six-character code. The first successful create or join saves a guest profile and a room-specific reconnect token in that browser. Returning to a room from the same browser resumes the existing player, including after closing the tab; it does not create another character. This is a browser-local profile, so another device or cleared browser storage cannot recover it. Do not share the token. Rooms are removed after everyone has been disconnected for 10 minutes, after which their players cannot resume. Players can ready or unready. The host can set a player limit from 5 to 10 and discussion time from 30 to 600 seconds. All changes are validated and versioned on the server.

Up to two game rooms can be open at the same time, including games in progress. When a game finishes, its slot becomes available for a new room.

The build and custom server use Next.js's webpack path. In this environment, the default Turbopack build exited while starting its CSS worker; the webpack build completed successfully.

## Render deployment

The `render.yaml` Blueprint configures a free Node web service in Virginia from the `main` branch. It builds with `npm ci && npm run build`, starts the custom Socket.IO server with `npm start`, and checks `/` for health. During Blueprint creation, set `MONGODB_URI` to the Atlas application connection string with the database username and password filled in. Keep this value in Render's environment settings; never commit it.

Add the service's outbound IP ranges from Render's **Connect > Outbound** panel to the Atlas project Network Access list. Without those ranges, the site can load but lobby actions cannot reach MongoDB.

## Checks

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. To run the production custom server after building, use `npm start`.

## Project layout

- `server.ts`: custom Node/Next.js/Socket.IO entry point
- `src/app`: App Router pages and layout
- `src/components`: MUI-backed UI components
- `src/stores`: UI-only Zustand state
- `src/types`: shared domain contracts
- `src/server`: Mongoose lobby models, versioned lobby service, Socket.IO handlers, and server-authoritative game engine
- `docs/IMPLEMENTATION_PLAN.md`: milestones and architecture
- `docs/GAME_RULES.md`: authoritative game rules
- `docs/CHARACTER_ART_GUIDE.md`: character portrait, full-body art, and theme conventions

The full game aggregate must remain server-side. Public, player-private, murderer-team-private, and result data use separate projections before any browser emission.
