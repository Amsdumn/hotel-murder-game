export function acceptNewerGameState<T extends { version: number }>(current: T | null, incoming: T): T {
  return current && current.version > incoming.version ? current : incoming;
}
