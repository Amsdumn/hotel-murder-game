export function requiredInnocentRoleCount(playerCount: number): number {
  return playerCount - (playerCount === 5 ? 1 : 2);
}

export function hasAccomplice(playerCount: number): boolean {
  return playerCount > 5;
}
