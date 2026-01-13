/**
 * Generate a short unique ID using the last 8 hex characters of a UUID.
 * Uses crypto.randomUUID() for proper randomness.
 *
 * @param prefix - Optional prefix (e.g., 'tab', 'panel')
 * @returns A unique ID like 'a1b2c3d4'
 */
export function generateShortId(): string {
  const uuid = crypto.randomUUID(); // e.g., '550e8400-e29b-41d4-a716-446655440000'
  const shortId = uuid.slice(0, 8); // First 8 hex chars: '550e8400'
  return shortId;
}
