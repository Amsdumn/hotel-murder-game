import { mediaUrl } from "./media-url";
import type { Role } from "@/types/game";

export const fullBodyArt: Record<Role, string> = {
  ELECTRICIAN: mediaUrl("/art/avatars/marcus-johnson.webp"),
  LOCKSMITH: mediaUrl("/art/characters/locksmith-3d.webp"),
  HOUSEKEEPER: mediaUrl("/art/characters/housekeeper-3d.webp"),
  WINDOW_CLEANER: mediaUrl("/art/characters/window-cleaner-3d.webp"),
  DETECTIVE: mediaUrl("/art/characters/detective-3d.webp"),
  LAWYER: mediaUrl("/art/characters/lawyer-3d.webp"),
  FORMER_POLICE: mediaUrl("/art/characters/former-police-3d.webp"),
  RECEPTIONIST: mediaUrl("/art/avatars/irina-volkova.webp"),
  PHOTOGRAPHER: mediaUrl("/art/characters/photographer-3d.webp"),
  ACCOMPLICE: mediaUrl("/art/characters/accomplice-3d.webp"),
  KILLER: mediaUrl("/art/characters/killer-3d.webp"),
  WITNESS: mediaUrl("/art/characters/witness-3d.webp"),
};
