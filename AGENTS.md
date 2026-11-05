# Project guidance for character art

Public avatars and secret roles are separate. For every new public avatar, follow the **cinematic 3D anime** visual bible in `docs/CHARACTER_ART_GUIDE.md`, add its profile and two WebPs to `src/lib/avatars.ts` and `public/art/avatars/`, and confirm the homepage face card, full-body detail, hidden lobby projections, server-owned game-start random assignment, public game guest list, reconnect, and final reveal. Twelve avatars now form the public roster; up to ten are assigned per game without repeats. The receptionist avatar is Irina Volkova: Russian woman, 39, red hair. Avatar assignment must not affect secret role assignment. Players cannot choose avatars.

When adding or changing a playable role, read [docs/CHARACTER_ART_GUIDE.md](docs/CHARACTER_ART_GUIDE.md) before creating images or editing the UI. Every role needs two distinct WebP assets: an opaque close portrait for face cards and a transparent full-body cutout for character scenes and the homepage detail view. Never use the full-body cutout as the face portrait.

Keep the role present in `ROLE_ORDER`, `roleNames`, the portrait map, `roleSkillDescriptions`, the rules dialog, and the full-body character map in `src/lib/character-art.ts`. Verify all ten existing roles remain documented after a new role is added. The homepage gallery shows the twelve public characters from `src/lib/avatars.ts`.

After completing and verifying each requested change, commit the finished work to Git in the same task. Include only files belonging to that change in its commit; do not push unless requested.

The player interface supports Thai and English. For new public characters, add English names and stories to `src/lib/avatar-translations.ts`. For new roles, add English names and skill descriptions alongside the Thai ones. New player-facing UI and server-result copy must render in both languages; keep language selection local to each browser so players in one game may use different languages.
