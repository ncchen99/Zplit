/**
 * Module-level in-memory image cache.
 * Maps original URL → object URL (blob) so images don't re-fetch
 * after the first load within a session.
 */
const imageCache = new Map<string, string>();

/**
 * Returns the cached object URL for the given src, or the original src
 * if not yet cached. Automatically fetches + caches on first use.
 *
 * Usage: pass the returned `cachedSrc` to <img src={...} />.
 * The cache is populated after the first network fetch; on subsequent
 * mounts the object URL is returned immediately.
 */
export function prefetchImage(src: string): void {
  if (!src || imageCache.has(src)) return;
  fetch(src)
    .then((res) => res.blob())
    .then((blob) => {
      if (!imageCache.has(src)) {
        imageCache.set(src, URL.createObjectURL(blob));
      }
    })
    .catch(() => {
      // Silently ignore — fallback to original src
    });
}

export function getCachedImageSrc(src: string | null | undefined): string | null | undefined {
  if (!src) return src;
  return imageCache.get(src) ?? src;
}
