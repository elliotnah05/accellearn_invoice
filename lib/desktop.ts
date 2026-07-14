// Helpers for the Electron desktop bridge exposed by electron/preload.js.
// In a plain browser (e.g. `npm run dev`) `window.accel` is undefined, so these
// degrade gracefully — isDesktop() is false and openFolder() is a no-op.

interface AccelBridge {
  openPath: (p: string) => Promise<{ ok: boolean; error?: string }>;
  isDesktop: boolean;
}

function bridge(): AccelBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { accel?: AccelBridge }).accel;
}

export function isDesktop(): boolean {
  return !!bridge()?.isDesktop;
}

export async function openFolder(path: string): Promise<void> {
  const b = bridge();
  if (b && path) await b.openPath(path);
}
