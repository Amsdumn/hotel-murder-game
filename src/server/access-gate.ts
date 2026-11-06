import { createHash, timingSafeEqual } from "node:crypto";

const accessPassword = "PostUlone";
const cookieSalt = "hotel-murder-home-access-v1";

export const accessCookieName = "hotel-home-access";
export const accessCookieValue = createHash("sha256")
  .update(`${cookieSalt}:${accessPassword}`)
  .digest("hex");

function equalDigest(value: string, expected: string): boolean {
  const actual = createHash("sha256").update(value).digest();
  const target = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actual, target);
}

export function isValidAccessPassword(value: unknown): boolean {
  return typeof value === "string" && equalDigest(value, accessPassword);
}

export function isAccessGranted(cookieValue: string | undefined): boolean {
  return typeof cookieValue === "string" && equalDigest(cookieValue, accessCookieValue);
}
