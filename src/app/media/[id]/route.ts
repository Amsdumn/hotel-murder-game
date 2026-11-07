import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cookies } from "next/headers";
import mediaMap from "@/lib/media-map.json";
import { accessCookieName, isAccessGranted } from "@/server/access-gate";

export const dynamic = "force-dynamic";

const pathsById = new Map(Object.entries(mediaMap).map(([path, id]) => [id, path]));
const unavailable = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!isAccessGranted(cookieStore.get(accessCookieName)?.value)) return unavailable();
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id)) return unavailable();
  const path = pathsById.get(id);
  if (!path) return unavailable();

  try {
    const bytes = await readFile(join(process.cwd(), "private-media", path.slice(1)));
    const contentType = path.endsWith(".webp") ? "image/webp" : path.endsWith(".gif") ? "image/gif" : "audio/mpeg";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return unavailable();
  }
}
