# Character art and display guide

## Public avatar visual bible (current style)

The **public avatars** are distinct from the twelve secret gameplay roles below. No character identity appears in the lobby. The server randomly assigns avatars only when the host starts the game; there is no avatar selection. This never determines a player's role, team, room, or skill. Source of truth: `src/lib/avatars.ts`. The twelve avatars are Adrian Blackwood, Irina Volkova, Somchai Prasert, Marcus Johnson, Elena Morales, Oliver Hayes, Amara Okafor, Claire Dubois, Seo-yeon Kim, Rafael Costa, Anaya Mehta, and Yusuf Demir. Anaya is a 48-year-old Indian botanist in a forest-green coat with a fern specimen case; Yusuf is a 52-year-old Turkish head chef in an ivory jacket with a silver serving cloche. Seo-yeon is a 31-year-old Korean pianist in deep teal velvet; Rafael is a 44-year-old Brazilian photojournalist in a cognac leather coat with a film camera. Irina is a **39-year-old Russian woman with red hair** and is the hotel receptionist. Do not restore the earlier Japanese/Yuki profile.

All new avatar illustrations use **cinematic stylized 3D anime**, with adult proportions, expressive sculpted faces, detailed hair, physically shaded vintage fabrics, warm amber rim light, cool violet fill, and the old hotel's dark noir mood. Match the existing `public/art/avatars/*.webp` figures: one centered person, complete silhouette from hair to footwear, consistent three-quarter camera angle, no text, logo, border, extra people, or weapons. Keep nationality and age readable through facial design and styling without caricature. The hotel era is approximately the late 1980s–1990s. The avatar art is a character identity, not a hint about hidden team.

Save a transparent full-body WebP at `public/art/avatars/<avatar-id>.webp` and a separate opaque face WebP at `public/art/avatars/<avatar-id>-portrait.webp`, both approximately 2:3. Reference the full-body image when generating the portrait to preserve identity. Check the complete figure in the homepage detail panel (`object-contain`) and the face at square and 44 px sizes (`object-cover object-top`). Keep face, hair, clothing, and accent color consistent. Add both paths to the roster profile. When adding an avatar, update the roster profile, game-start random assignment rules if capacity changes, story copy, and this guide. The game supports 10 players and assigns each a distinct avatar when all seats are filled.

## Secret role art (rules dialog)

There are now twelve secret gameplay roles, of which at most ten are assigned in one game. The Former Police Officer is an optional Innocent role illustrated as a mature silver-haired woman in a navy coat with a retired badge and case notebook. Her opaque face card is `public/art/former-police.webp`; her transparent full-body scene art is `public/art/characters/former-police-3d.webp`. She differs from the younger Detective's tan coat and magnifying glass. Her automatic clues describe the public avatar assigned to the Assassin, which remains independently randomized from every secret role.

The Lawyer is an optional Innocent role illustrated as an adult woman with long dark wavy hair in a burgundy suit, holding a leather case file and fountain pen. Her opaque face card is `public/art/lawyer.webp`; her transparent full-body scene art is `public/art/characters/lawyer-3d.webp`. She privately compares the teams of two other living guests without revealing either team.

The rules dialog explains secret roles and skills in text separately from the twelve homepage characters. The private room shows the assigned public avatar beside the player's private role and skill text; a player can look like Irina while secretly playing any role. Do not use an avatar to infer or assign a role.

The Photographer is a secret role illustrated as a short-haired woman with a silver streak, midnight-blue jacket, film camera, and contact sheet. Her role art is separate from Rafael Costa, the public photojournalist avatar; any public avatar may receive the Photographer role. This guide preserves the visual pattern used by the hotel's playable characters. The game takes place in an old hotel during a storm. At midnight the lights go out, footsteps are heard, and clues appear when power returns. New character introductions should fit that prologue without inventing a separate setting or contradicting a skill.

## Two images for each role

| Use | Existing examples | Required framing |
| --- | --- | --- |
| Face portrait | `public/art/locksmith.webp`, `public/art/avatars/irina-volkova-portrait.webp` | Opaque vertical portrait with a dark purple hotel interior and warm brass light. Show a large face near the top and enough shoulders or a signature prop to identify the role. Fill the whole frame; avoid empty transparent space. New portraits use cinematic 3D anime. |
| Full-body character | `public/art/characters/locksmith-3d.webp`, `public/art/avatars/irina-volkova.webp` | Transparent 3D anime cutout with expressive eyes, physical fabric shading, and detailed gothic hotel clothing. Show the whole figure from hair to boots, centered with a clear silhouette and role-specific clothing or prop. Preserve the alpha channel in the final WebP. |

Create the full-body art first, using an existing full-body character as a **style reference**, then create a separate close portrait using that new character as an **identity reference** and an existing portrait as a **framing and background reference**. Keep the face, hair, clothing, and prop consistent between the two assets. A crop of the full-body cutout alone is not enough for the portrait: it leaves transparent space and makes the face appear too small on the homepage. Inspect both generated images before adding them to the app.

Use the built-in image generation tool for new art. Convert final images to WebP, retaining transparency only for the full-body cutout. If replacing an image that may already be cached by Next.js, give the replacement a new filename and update its source path.

## Where each asset appears

- `src/components/role-portrait.tsx` maps each role to its **face portrait** for legacy game records without a public avatar.
- `src/lib/character-art.ts` maps each role to its **full-body cutout**. `src/components/game/private-room-scene.tsx` places it over the hotel-room background with `object-contain`.
- `src/components/main-menu.tsx` shows the twelve public avatar portraits on the homepage. Clicking one opens `AvatarDetail` with the matching full-body image and character introduction. Role skills stay in the rules dialog.

For a new role, add a distinct portrait path to `role-portrait.tsx` and a full-body path to `src/lib/character-art.ts`. Keep both filenames explicit. Use a new filename when replacing cached artwork.

## New role checklist

1. Add the role to `ROLE_ORDER` in `src/types/game.ts` at its actual skill-slot position.
2. Add its Thai name and portrait path in `src/components/role-portrait.tsx`.
3. Add its full-body path in `src/lib/character-art.ts`.
4. Add its skill text in `src/lib/role-skills.ts` and keep it grounded in the hotel mystery.
5. Confirm the rules dialog lists the new role and skill. The homepage gallery remains the separate public twelve-character roster.
6. Check the role portrait and full-body cutout in any legacy private scene. Run relevant tests and TypeScript check.

Do not reuse one image for both purposes. The electrician's original full-body image was once shown in a face card and looked inconsistent with the other roles; its current portrait and cutout show the intended separation.
