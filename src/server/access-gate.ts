import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const accessCookieName = "hotel-home-access";

type AccessEnvironment = Record<string, string | undefined>;

function accessConfig(source: AccessEnvironment = process.env) {
  const password = source.HOTEL_ACCESS_PASSWORD;
  const secret = source.HOTEL_ACCESS_COOKIE_SECRET;
  if (!password || password.length < 12 || !secret || secret.length < 32) {
    throw new Error("Set HOTEL_ACCESS_PASSWORD (12+ characters) and HOTEL_ACCESS_COOKIE_SECRET (32+ characters)");
  }
  return { password, secret };
}

export function assertAccessGateConfigured(source: AccessEnvironment = process.env): void {
  accessConfig(source);
}

export function prepareAccessGateEnvironment(source: AccessEnvironment = process.env, production = process.env.NODE_ENV === "production"): string | null {
  if (production) {
    assertAccessGateConfigured(source);
    return null;
  }
  let generatedPassword: string | null = null;
  if (!source.HOTEL_ACCESS_PASSWORD) {
    generatedPassword = randomBytes(18).toString("base64url");
    source.HOTEL_ACCESS_PASSWORD = generatedPassword;
  }
  if (!source.HOTEL_ACCESS_COOKIE_SECRET) source.HOTEL_ACCESS_COOKIE_SECRET = randomBytes(32).toString("hex");
  assertAccessGateConfigured(source);
  return generatedPassword;
}

function equalDigest(value: string, expected: string): boolean {
  const actual = createHash("sha256").update(value).digest();
  const target = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actual, target);
}

export function isValidAccessPassword(value: unknown, source: AccessEnvironment = process.env): boolean {
  const { password } = accessConfig(source);
  return typeof value === "string" && value.length <= 256 && equalDigest(value, password);
}

export function getAccessCookieValue(source: AccessEnvironment = process.env): string {
  const { password, secret } = accessConfig(source);
  return createHmac("sha256", secret).update(`hotel-home-access-v2:${password}`).digest("hex");
}

export function isAccessGranted(cookieValue: string | undefined, source: AccessEnvironment = process.env): boolean {
  const expected = getAccessCookieValue(source);
  return typeof cookieValue === "string" && /^[a-f0-9]{64}$/.test(cookieValue) && timingSafeEqual(Buffer.from(cookieValue, "hex"), Buffer.from(expected, "hex"));
}

export function isAccessGrantedFromCookieHeader(header: string | undefined, source: AccessEnvironment = process.env): boolean {
  const cookie = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${accessCookieName}=`));
  return isAccessGranted(cookie?.slice(accessCookieName.length + 1), source);
}

export function isAllowedSocketOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && url.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}
