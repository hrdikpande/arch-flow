/**
 * Browser-safe helpers for the Autodesk upload (no Node-only APIs, so the client bundle can import them).
 */

export function splitParts(size: number, partCount: number): { start: number; end: number }[] {
  const count = Math.max(1, partCount);
  const partSize = Math.ceil(size / count);
  return Array.from({ length: count }, (_, i) => ({ start: i * partSize, end: Math.min(size, (i + 1) * partSize) }));
}

type Fetch = typeof fetch;

/** Uploads the bytes to the signed part URLs, in order. Works in the browser or on the server. */
export async function uploadParts(file: Blob, urls: string[], fetchImpl: Fetch = fetch): Promise<void> {
  const parts = splitParts(file.size, urls.length);
  for (let i = 0; i < urls.length; i += 1) {
    const part = parts[i];
    const url = urls[i];
    if (!part || !url) throw new Error('Upload plan does not match the file size.');
    const response = await fetchImpl(url, { method: 'PUT', body: file.slice(part.start, part.end) });
    if (!response.ok) throw new Error(`Upload part ${i + 1} failed with HTTP ${response.status}`);
  }
}
