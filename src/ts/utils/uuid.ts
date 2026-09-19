/**
 * Generate a short unique ID (8 lowercase hex characters).
 *
 * Prefers `crypto.randomUUID()`, but that API only exists in secure contexts
 * (HTTPS, `localhost`, `127.0.0.1`). Dash apps are routinely served over plain
 * HTTP on an intranet host or container IP, where `crypto.randomUUID` is
 * undefined. In that case we fall back to `crypto.getRandomValues()`, which is
 * available in insecure contexts too, and finally to `Math.random()`.
 *
 * Never call this at module scope: a failure while the bundle is evaluating
 * would prevent the whole component from registering with Dash.
 *
 * @returns A unique ID like 'a1b2c3d4'
 */
export function generateShortId(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID().slice(0, 8); // '550e8400-e29b-...' -> '550e8400'
  }

  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(4));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  let id = '';
  for (let i = 0; i < 8; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}
