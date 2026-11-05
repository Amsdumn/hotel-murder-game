export class LobbyJoinRateLimiter {
  private readonly attempts = new Map<string, number[]>();
  private calls = 0;

  allow(address: string, action: "create" | "join", now = Date.now()): boolean {
    const windowMs = action === "create" ? 10 * 60_000 : 60_000;
    const maximum = action === "create" ? 5 : 20;
    const key = `${action}:${address}`;
    const recent = (this.attempts.get(key) ?? []).filter((time) => time > now - windowMs);
    const allowed = recent.length < maximum;
    if (allowed) recent.push(now);
    this.attempts.set(key, recent);
    this.calls += 1;
    if (this.calls % 100 === 0) {
      for (const [entryKey, times] of this.attempts) {
        const age = entryKey.startsWith("create:") ? 10 * 60_000 : 60_000;
        if (times.every((time) => time <= now - age)) this.attempts.delete(entryKey);
      }
    }
    return allowed;
  }
}
