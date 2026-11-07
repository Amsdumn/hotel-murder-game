import mediaMap from "./media-map.json";

const mediaPaths: Record<string, string> = mediaMap;

export function mediaUrl(path: string): string {
  const id = mediaPaths[path];
  if (!id) throw new Error(`Unknown media asset: ${path}`);
  return `/media/${id}`;
}
