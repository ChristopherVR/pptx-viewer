/**
 * secure-random.ts: cryptographically strong random-id helpers shared by
 * every binding.
 *
 * `crypto.randomUUID()` is used whenever it is available (all modern
 * browsers, Node, and Bun in a secure context). The fallback path never
 * touches `Math.random()`, a predictable PRNG unsuitable for session
 * nonces, room codes, or field GUIDs; it sources its randomness from
 * `crypto.getRandomValues`, which has near-universal support (older than
 * `randomUUID` itself), so it is a safe baseline even on older runtimes.
 */

/** Fill `length` bytes from the Web Crypto CSPRNG. */
function secureRandomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		crypto.getRandomValues(bytes);
		return bytes;
	}
	// crypto.getRandomValues is available in every browser and server runtime
	// this project targets; if it is truly missing there is no cryptographically
	// strong randomness source on this platform, so fail loudly rather than
	// silently downgrading to a predictable generator.
	throw new Error('secure-random: no cryptographic RNG available (crypto.getRandomValues missing)');
}

/**
 * Generate a v4 UUID (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`). Prefers
 * `crypto.randomUUID()`; falls back to a `crypto.getRandomValues`-backed v4
 * UUID when it is unavailable.
 */
export function secureRandomUuid(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	const bytes = secureRandomBytes(16);
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate a cryptographically strong base-36 token of `length` characters,
 * a drop-in replacement for the common (insecure) `Math.random().toString(36).
 * slice(2, 2 + length)` idiom used for short ids / room codes.
 */
export function secureRandomToken(length = 8): string {
	const bytes = secureRandomBytes(length);
	let out = '';
	for (const b of bytes) {
		out += (b % 36).toString(36);
	}
	return out;
}
