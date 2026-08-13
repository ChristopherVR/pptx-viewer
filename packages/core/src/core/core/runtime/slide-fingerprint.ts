/**
 * @fileoverview Content fingerprint of a slide, used to decide whether the
 * save pipeline has to re-serialize it at all.
 *
 * ## Why a fingerprint rather than a dirty flag
 *
 * `PptxSlide.isDirty` was designed as an announcement: a mutation path sets it
 * and {@link processSlideForSave} skips everything else. Repo-wide it was set
 * in two places and never to `false`, so the guard was dead and every save
 * re-serialized every slide, flattening inheritance on slides the user never
 * touched.
 *
 * Announcing does not work here. There are >100 slide-mutation sites across
 * five bindings plus the SDK, the AI tool runner and the collaboration
 * reconciler, and every one of them would have to remember. One that forgot
 * would silently DISCARD the user's edit, which is far worse than a redundant
 * write. Worse still, the bindings hand `save()` fresh slide objects on every
 * call (immutable state updates), so nothing identity-based can work either.
 *
 * Observing the value works instead: hash the slide model at load, hash it
 * again at save, and re-serialize when the two differ. A mutation path cannot
 * forget to announce something it does not have to announce, and any field
 * added to `PptxSlide` in future is covered the moment it exists, in the safe
 * direction (unknown change -> looks dirty -> full re-serialization).
 *
 * ## Guarantees
 *
 * - Key order is irrelevant (`{a,b}` and `{b,a}` hash the same), because
 *   immutable spreads reorder keys freely.
 * - An absent key and a key set to `undefined` hash the same, for the same
 *   reason.
 * - `isDirty` is excluded: it is the flag under discussion, not content.
 * - Cycles terminate.
 *
 * @module core/core/runtime/slide-fingerprint
 */
import type { PptxSlide } from '../../types';

/**
 * Above this length a string is sampled rather than hashed whole. Data URLs
 * for embedded video can be tens of megabytes and a full walk of every one of
 * them on every save would cost more than the re-serialization this exists to
 * avoid. The sample covers the head, the tail and a strided sweep of the
 * middle, so any real content swap (which changes bytes densely, or at least
 * changes the length) is caught.
 */
const FULL_HASH_LIMIT = 1 << 20;

/** Characters sampled from the middle of an over-long string. */
const SAMPLE_BUDGET = 1 << 15;

/**
 * Slide-level keys deliberately left out of the hash.
 *
 * - `isDirty` is the flag this whole mechanism replaces, not content.
 * - `slideNumber` is the slide's POSITION in the deck. Nothing in a
 *   `ppt/slides/slideN.xml` part depends on it (deck order lives in
 *   `p:sldIdLst`), and the save pipeline renumbers it itself on every save
 *   (`PptxPresentationSlidesReconciler`). Hashing it would mark every slide
 *   after a deleted or reordered one dirty, which is precisely the 99-slide
 *   rewrite this exists to prevent.
 *
 * Nothing else may join this list without the same two-part argument: the
 * save pipeline must not read it, and something outside the user's control
 * must be changing it.
 */
const POSITION_ONLY_SLIDE_KEYS: readonly string[] = ['isDirty', 'slideNumber'];

/**
 * Streaming 64-bit string hash (two decorrelated 32-bit lanes, cyrb-style).
 * Not cryptographic: it only has to make an accidental collision between two
 * different slide states implausible.
 */
class SlideHasher {
	private h1 = 0xdeadbeef;

	private h2 = 0x41c6ce57;

	public update(text: string): void {
		let h1 = this.h1;
		let h2 = this.h2;
		for (let index = 0; index < text.length; index += 1) {
			const code = text.charCodeAt(index);
			h1 = Math.imul(h1 ^ code, 2654435761);
			h2 = Math.imul(h2 ^ code, 1597334677);
		}
		this.h1 = h1;
		this.h2 = h2;
	}

	public digest(): string {
		let h1 = Math.imul(this.h1 ^ (this.h1 >>> 16), 2246822507);
		h1 ^= Math.imul(this.h2 ^ (this.h2 >>> 13), 3266489909);
		let h2 = Math.imul(this.h2 ^ (this.h2 >>> 16), 2246822507);
		h2 ^= Math.imul(this.h1 ^ (this.h1 >>> 13), 3266489909);
		return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
	}
}

function hashString(hasher: SlideHasher, text: string): void {
	hasher.update(`s${text.length}:`);
	if (text.length <= FULL_HASH_LIMIT) {
		hasher.update(text);
		return;
	}
	const window = SAMPLE_BUDGET >> 2;
	hasher.update(text.slice(0, window));
	hasher.update(text.slice(text.length - window));
	const stride = Math.ceil(text.length / (SAMPLE_BUDGET >> 1));
	let sampled = '';
	for (let index = 0; index < text.length; index += stride) {
		sampled += text[index];
	}
	hasher.update(sampled);
}

function hashValue(hasher: SlideHasher, value: unknown, path: Set<object>): void {
	if (value === undefined) {
		hasher.update('u');
		return;
	}
	if (value === null) {
		hasher.update('n');
		return;
	}
	switch (typeof value) {
		case 'string':
			hashString(hasher, value);
			return;
		case 'number':
			hasher.update(`d${value}`);
			return;
		case 'boolean':
			hasher.update(value ? 'b1' : 'b0');
			return;
		case 'bigint':
			hasher.update(`g${value}`);
			return;
		case 'function':
			// A callback on the model is not file content; its identity changes
			// on every render in every binding, so hashing it would make every
			// slide look dirty forever.
			hasher.update('f');
			return;
		case 'symbol':
			hasher.update('y');
			return;
		default:
			break;
	}

	const object = value as object;
	if (path.has(object)) {
		hasher.update('c');
		return;
	}
	path.add(object);
	if (Array.isArray(object)) {
		hasher.update(`a${object.length}[`);
		for (const item of object) {
			hashValue(hasher, item, path);
			hasher.update(',');
		}
		hasher.update(']');
	} else if (ArrayBuffer.isView(object)) {
		const bytes = new Uint8Array(
			(object as ArrayBufferView).buffer,
			(object as ArrayBufferView).byteOffset,
			(object as ArrayBufferView).byteLength,
		);
		hasher.update(`v${bytes.length}:`);
		const stride = bytes.length > FULL_HASH_LIMIT ? Math.ceil(bytes.length / SAMPLE_BUDGET) : 1;
		let chunk = '';
		for (let index = 0; index < bytes.length; index += stride) {
			chunk += String.fromCharCode(bytes[index]);
			if (chunk.length >= 4096) {
				hasher.update(chunk);
				chunk = '';
			}
		}
		hasher.update(chunk);
	} else {
		const record = object as Record<string, unknown>;
		const keys = Object.keys(record).sort();
		hasher.update('o{');
		for (const key of keys) {
			const entry = record[key];
			// An absent key and an explicitly-undefined key are the same slide.
			if (entry === undefined) {
				continue;
			}
			hasher.update(`${key}=`);
			hashValue(hasher, entry, path);
			hasher.update(';');
		}
		hasher.update('}');
	}
	path.delete(object);
}

/**
 * Stable content hash of everything the save pipeline can read off a slide.
 *
 * Two slides with the same fingerprint serialize to the same slide part; two
 * slides that differ anywhere at all, including in a field this module has
 * never heard of, get different fingerprints.
 */
export function fingerprintSlide(slide: PptxSlide): string {
	const hasher = new SlideHasher();
	try {
		const content: Record<string, unknown> = { ...slide };
		for (const key of POSITION_ONLY_SLIDE_KEYS) {
			delete content[key];
		}
		hashValue(hasher, content, new Set<object>());
	} catch {
		// The walk is recursive, so pathologically deep attacker-supplied XML can
		// exhaust the stack, and a hostile getter on the model can throw. Either
		// way the answer is "cannot prove this slide is unchanged": return a value
		// nothing will ever match, so the slide is re-serialized in full.
		return `unhashable:${UNHASHABLE_COUNTER++}`;
	}
	return hasher.digest();
}

/** Makes every failed fingerprint distinct, so it can never match a baseline. */
let UNHASHABLE_COUNTER = 0;

/** Record `slides` as the state now sitting in the archive. */
export function recordSlideFingerprints(
	fingerprints: Map<string, string>,
	slides: readonly PptxSlide[],
): void {
	for (const slide of slides) {
		fingerprints.set(slide.id, fingerprintSlide(slide));
	}
}

/**
 * True when this slide is byte-for-byte already in the archive.
 *
 * A slide with no recorded baseline (created this session, or arriving after a
 * `dispose()`) is never treated as unchanged: there is nothing in the archive
 * to fall back on, so it must be written.
 */
export function slideMatchesFingerprint(
	fingerprints: Map<string, string>,
	slide: PptxSlide,
): boolean {
	const baseline = fingerprints.get(slide.id);
	return baseline !== undefined && baseline === fingerprintSlide(slide);
}
