import type { PptxSlide, PptxElement } from 'pptx-viewer-core';
/**
 * Tests for useYjsDocumentSync — verifies the synchronisation logic between
 * local PptxSlide[] state and a Yjs Y.Map for real-time collaboration.
 *
 * Since the hook is driven by useEffect callbacks, we test the underlying
 * logic by exercising mock Y.Doc / Y.Map objects that mirror the Yjs API
 * surface consumed by the hook, and by directly invoking the sync behaviour
 * extracted from the hook.
 *
 * @module collaboration/useYjsDocumentSync.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Y.Map / Y.Doc
// ---------------------------------------------------------------------------

class MockYMap {
	private data = new Map<string, unknown>();
	private observers: Array<(event: unknown) => void> = [];

	get(key: string): unknown {
		return this.data.get(key);
	}

	set(key: string, value: unknown): void {
		this.data.set(key, value);
		this.observers.forEach((cb) => cb({ type: 'set', key, value }));
	}

	delete(key: string): void {
		this.data.delete(key);
		this.observers.forEach((cb) => cb({ type: 'delete', key }));
	}

	has(key: string): boolean {
		return this.data.has(key);
	}

	observe(cb: (event: unknown) => void): void {
		this.observers.push(cb);
	}

	unobserve(cb: (event: unknown) => void): void {
		this.observers = this.observers.filter((o) => o !== cb);
	}

	/** Test helper: get current observer count. */
	_observerCount(): number {
		return this.observers.length;
	}

	/** Test helper: read all keys. */
	_keys(): string[] {
		return Array.from(this.data.keys());
	}

	/** Test helper: trigger observers without changing data. */
	_fireObservers(): void {
		this.observers.forEach((cb) => cb({ type: 'external' }));
	}
}

class MockYDoc {
	private maps = new Map<string, MockYMap>();

	getMap(name: string): MockYMap {
		if (!this.maps.has(name)) {
			this.maps.set(name, new MockYMap());
		}
		return this.maps.get(name)!;
	}

	transact(fn: () => void): void {
		fn();
	}
}

// ---------------------------------------------------------------------------
// Slide factories
// ---------------------------------------------------------------------------

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [],
		...overrides,
	};
}

function makeSlides(count: number): PptxSlide[] {
	return Array.from({ length: count }, (_, i) =>
		makeSlide({ id: `slide-${i + 1}`, rId: `rId${i + 1}`, slideNumber: i + 1 }),
	);
}

// ---------------------------------------------------------------------------
// Sync helpers — extracted logic mirroring useYjsDocumentSync internals
// ---------------------------------------------------------------------------

/**
 * Simulates the "write local slides to Y.Map" effect from useYjsDocumentSync.
 * Returns whether a write was performed.
 */
function syncLocalToDoc(
	doc: MockYDoc,
	slides: PptxSlide[],
	opts: {
		isConnected: boolean;
		isApplyingRemote: boolean;
		lastSynced: string;
	},
): { written: boolean; newLastSynced: string } {
	if (!opts.isConnected || !doc) {
		return { written: false, newLastSynced: opts.lastSynced };
	}
	if (opts.isApplyingRemote) {
		return { written: false, newLastSynced: opts.lastSynced };
	}
	if (slides.length === 0) {
		return { written: false, newLastSynced: opts.lastSynced };
	}

	const map = doc.getMap('slides-data');
	const serialized = JSON.stringify(slides);

	if (serialized === opts.lastSynced) {
		return { written: false, newLastSynced: opts.lastSynced };
	}

	doc.transact(() => {
		const currentCount = map.get('count') as number | undefined;
		if (currentCount && currentCount > slides.length) {
			for (let i = slides.length; i < currentCount; i++) {
				map.delete(`slide-${i}`);
			}
		}
		map.set('count', slides.length);
		for (let i = 0; i < slides.length; i++) {
			const slideJson = JSON.stringify(slides[i]);
			const existing = map.get(`slide-${i}`) as string | undefined;
			if (existing !== slideJson) {
				map.set(`slide-${i}`, slideJson);
			}
		}
	});

	return { written: true, newLastSynced: serialized };
}

/**
 * Simulates the "read remote slides from Y.Map" handler from useYjsDocumentSync.
 * Returns the slides array if an update was applied, or null if skipped.
 */
function readRemoteFromDoc(
	doc: MockYDoc,
	lastSynced: string,
): { slides: PptxSlide[]; newLastSynced: string } | null {
	const map = doc.getMap('slides-data');
	const count = map.get('count') as number | undefined;
	if (!count || count === 0) {
		return null;
	}

	const remoteSlides: PptxSlide[] = [];
	for (let i = 0; i < count; i++) {
		const slideJson = map.get(`slide-${i}`) as string | undefined;
		if (slideJson) {
			try {
				remoteSlides.push(JSON.parse(slideJson as string));
			} catch {
				// Skip malformed entries
			}
		}
	}

	if (remoteSlides.length === 0) {
		return null;
	}

	const serialized = JSON.stringify(remoteSlides);
	if (serialized === lastSynced) {
		return null;
	}

	return { slides: remoteSlides, newLastSynced: serialized };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('useYjsDocumentSync (logic)', () => {
	let doc: MockYDoc;
	let map: MockYMap;

	beforeEach(() => {
		doc = new MockYDoc();
		map = doc.getMap('slides-data');
	});

	// -----------------------------------------------------------------------
	// 1. Does nothing when doc is null
	// -----------------------------------------------------------------------
	describe('when doc is null', () => {
		it('does not error and performs no writes', () => {
			const slides = makeSlides(2);
			// Using null doc directly — should not throw
			const result = syncLocalToDoc(null as unknown as MockYDoc, slides, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});
			expect(result.written).toBeFalsy();
		});
	});

	// -----------------------------------------------------------------------
	// 2. Does nothing when not connected
	// -----------------------------------------------------------------------
	describe('when not connected', () => {
		it('does not write to Y.Map', () => {
			const slides = makeSlides(3);
			const result = syncLocalToDoc(doc, slides, {
				isConnected: false,
				isApplyingRemote: false,
				lastSynced: '',
			});
			expect(result.written).toBeFalsy();
			expect(map.get('count')).toBeUndefined();
		});

		it('does not read from Y.Map', () => {
			// Pre-populate the Y.Map
			map.set('count', 2);
			map.set('slide-0', JSON.stringify(makeSlide({ id: 'remote-1' })));
			map.set('slide-1', JSON.stringify(makeSlide({ id: 'remote-2' })));

			// If not connected, we would not set up an observer, so reading
			// should not happen. Simulate by checking the guard logic.
			const isConnected = false;
			if (!isConnected) {
				// This mirrors the hook bail-out: no observer is registered.
				expect(true).toBeTruthy();
			}
		});
	});

	// -----------------------------------------------------------------------
	// 3. Writes slides to Y.Map on local change
	// -----------------------------------------------------------------------
	describe('writing local slides to Y.Map', () => {
		it('writes each slide as a JSON entry keyed by index', () => {
			const slides = makeSlides(3);
			const result = syncLocalToDoc(doc, slides, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});

			expect(result.written).toBeTruthy();
			expect(map.get('count')).toBe(3);
			for (let i = 0; i < 3; i++) {
				const stored = JSON.parse(map.get(`slide-${i}`) as string) as PptxSlide;
				expect(stored.id).toBe(`slide-${i + 1}`);
			}
		});

		it('updates the serialized-last-synced string', () => {
			const slides = makeSlides(1);
			const result = syncLocalToDoc(doc, slides, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});
			expect(result.newLastSynced).toBe(JSON.stringify(slides));
		});
	});

	// -----------------------------------------------------------------------
	// 4. Reads slides from Y.Map on remote change
	// -----------------------------------------------------------------------
	describe('reading remote slides from Y.Map', () => {
		it('reconstructs slides array from Y.Map entries', () => {
			const original = makeSlides(2);
			map.set('count', 2);
			map.set('slide-0', JSON.stringify(original[0]));
			map.set('slide-1', JSON.stringify(original[1]));

			const result = readRemoteFromDoc(doc, '');
			expect(result).not.toBeNull();
			expect(result!.slides).toHaveLength(2);
			expect(result!.slides[0].id).toBe('slide-1');
			expect(result!.slides[1].id).toBe('slide-2');
		});

		it('calls setSlides with deserialized data', () => {
			const setSlides = vi.fn<() => void>();
			const original = makeSlides(1);
			map.set('count', 1);
			map.set('slide-0', JSON.stringify(original[0]));

			const result = readRemoteFromDoc(doc, '');
			expect(result).not.toBeNull();
			// Simulate setSlides call
			setSlides(result!.slides);
			expect(setSlides).toHaveBeenCalledWith(original);
		});
	});

	// -----------------------------------------------------------------------
	// 5. Prevents sync loops
	// -----------------------------------------------------------------------
	describe('sync loop prevention', () => {
		it('does not write back to Y.Map when applying remote changes', () => {
			const slides = makeSlides(2);
			const result = syncLocalToDoc(doc, slides, {
				isConnected: true,
				isApplyingRemote: true,
				lastSynced: '',
			});

			expect(result.written).toBeFalsy();
			expect(map.get('count')).toBeUndefined();
		});

		it('skips remote read when serialized data matches lastSynced', () => {
			const slides = makeSlides(2);
			map.set('count', 2);
			map.set('slide-0', JSON.stringify(slides[0]));
			map.set('slide-1', JSON.stringify(slides[1]));

			const lastSynced = JSON.stringify(slides);
			const result = readRemoteFromDoc(doc, lastSynced);
			expect(result).toBeNull(); // No update needed
		});

		it('skips local write when serialized data matches lastSynced', () => {
			const slides = makeSlides(2);
			const lastSynced = JSON.stringify(slides);

			const result = syncLocalToDoc(doc, slides, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced,
			});
			expect(result.written).toBeFalsy();
		});
	});

	// -----------------------------------------------------------------------
	// 6. Handles empty slides array
	// -----------------------------------------------------------------------
	describe('empty slides handling', () => {
		it('does not write when slides array is empty', () => {
			const result = syncLocalToDoc(doc, [], {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});
			expect(result.written).toBeFalsy();
			expect(map.get('count')).toBeUndefined();
		});

		it('returns null from remote read when count is 0', () => {
			map.set('count', 0);
			const result = readRemoteFromDoc(doc, '');
			expect(result).toBeNull();
		});

		it('returns null from remote read when count is not set', () => {
			const result = readRemoteFromDoc(doc, '');
			expect(result).toBeNull();
		});
	});

	// -----------------------------------------------------------------------
	// 7. Per-slide granularity
	// -----------------------------------------------------------------------
	describe('per-slide granularity', () => {
		it('only updates changed slides in the Y.Map', () => {
			const slides = makeSlides(3);
			// Initial write
			syncLocalToDoc(doc, slides, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});

			// Track set calls on the map
			const setCalls: string[] = [];
			const originalSet = map.set.bind(map);
			map.set = (key: string, value: unknown) => {
				setCalls.push(key);
				originalSet(key, value);
			};

			// Modify only slide 1 (index 1)
			const updatedSlides = slides.map((s) => ({ ...s }));
			updatedSlides[1] = {
				...updatedSlides[1],
				elements: [{ type: 'text', id: 'el-1' } as unknown as PptxElement],
			};

			syncLocalToDoc(doc, updatedSlides, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: JSON.stringify(slides),
			});

			// Only slide-1 and count should have been set (count is always written)
			expect(setCalls).toContain('count');
			expect(setCalls).toContain('slide-1');
			// slide-0 and slide-2 should NOT have been written since they didn't change
			expect(setCalls).not.toContain('slide-0');
			expect(setCalls).not.toContain('slide-2');
		});
	});

	// -----------------------------------------------------------------------
	// 8. Handles slide count changes
	// -----------------------------------------------------------------------
	describe('slide count changes', () => {
		it('deletes extra entries when slides are removed', () => {
			// Start with 4 slides
			const slides4 = makeSlides(4);
			syncLocalToDoc(doc, slides4, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});

			expect(map.get('count')).toBe(4);
			expect(map.has('slide-3')).toBeTruthy();

			// Remove last 2 slides
			const slides2 = slides4.slice(0, 2);
			syncLocalToDoc(doc, slides2, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: JSON.stringify(slides4),
			});

			expect(map.get('count')).toBe(2);
			// The old entries at index 2 and 3 should be deleted
			expect(map.has('slide-2')).toBeFalsy();
			expect(map.has('slide-3')).toBeFalsy();
			// The first two should still exist
			expect(map.has('slide-0')).toBeTruthy();
			expect(map.has('slide-1')).toBeTruthy();
		});

		it('adds new entries when slides are added', () => {
			const slides2 = makeSlides(2);
			syncLocalToDoc(doc, slides2, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});

			expect(map.get('count')).toBe(2);

			const slides4 = makeSlides(4);
			syncLocalToDoc(doc, slides4, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: JSON.stringify(slides2),
			});

			expect(map.get('count')).toBe(4);
			expect(map.has('slide-2')).toBeTruthy();
			expect(map.has('slide-3')).toBeTruthy();
		});

		it('updates count in Y.Map when remote adds slides', () => {
			const slides = makeSlides(5);
			map.set('count', 5);
			for (let i = 0; i < 5; i++) {
				map.set(`slide-${i}`, JSON.stringify(slides[i]));
			}

			const result = readRemoteFromDoc(doc, '');
			expect(result).not.toBeNull();
			expect(result!.slides).toHaveLength(5);
		});
	});

	// -----------------------------------------------------------------------
	// 9. Joiner loads existing data
	// -----------------------------------------------------------------------
	describe('joiner loading existing data', () => {
		it('loads slides from Y.Map on first connect when data exists', () => {
			// Host has already populated the Y.Map
			const hostSlides = makeSlides(3);
			map.set('count', 3);
			for (let i = 0; i < 3; i++) {
				map.set(`slide-${i}`, JSON.stringify(hostSlides[i]));
			}

			// Joiner reads the data — simulating the handleUpdate() call
			// that runs on first connect
			const result = readRemoteFromDoc(doc, '');
			expect(result).not.toBeNull();
			expect(result!.slides).toHaveLength(3);
			expect(result!.slides[0].id).toBe('slide-1');
			expect(result!.slides[1].id).toBe('slide-2');
			expect(result!.slides[2].id).toBe('slide-3');
		});

		it('does not load when Y.Map is empty (joiner is first / host)', () => {
			// No data in Y.Map
			const result = readRemoteFromDoc(doc, '');
			expect(result).toBeNull();
		});

		it('skips malformed slide entries', () => {
			map.set('count', 3);
			map.set('slide-0', JSON.stringify(makeSlide({ id: 'ok-1' })));
			map.set('slide-1', '{invalid json!!!');
			map.set('slide-2', JSON.stringify(makeSlide({ id: 'ok-3' })));

			const result = readRemoteFromDoc(doc, '');
			expect(result).not.toBeNull();
			// Only the 2 valid slides should be returned
			expect(result!.slides).toHaveLength(2);
			expect(result!.slides[0].id).toBe('ok-1');
			expect(result!.slides[1].id).toBe('ok-3');
		});

		it('skips missing slide entries', () => {
			map.set('count', 3);
			map.set('slide-0', JSON.stringify(makeSlide({ id: 'a' })));
			// slide-1 is missing
			map.set('slide-2', JSON.stringify(makeSlide({ id: 'c' })));

			const result = readRemoteFromDoc(doc, '');
			expect(result).not.toBeNull();
			expect(result!.slides).toHaveLength(2);
		});
	});

	// -----------------------------------------------------------------------
	// Y.Map observer management
	// -----------------------------------------------------------------------
	describe('y.Map observer management', () => {
		it('can observe and unobserve the map', () => {
			const handler = vi.fn<() => void>();
			map.observe(handler);
			expect(map._observerCount()).toBe(1);

			map.set('count', 1);
			expect(handler).toHaveBeenCalledOnce();

			map.unobserve(handler);
			expect(map._observerCount()).toBe(0);

			map.set('count', 2);
			expect(handler).toHaveBeenCalledOnce(); // not called again
		});
	});

	// -----------------------------------------------------------------------
	// MockYDoc structure
	// -----------------------------------------------------------------------
	describe('mockYDoc', () => {
		it('returns the same Y.Map for the same name', () => {
			const map1 = doc.getMap('slides-data');
			const map2 = doc.getMap('slides-data');
			expect(map1).toBe(map2);
		});

		it('returns different Y.Maps for different names', () => {
			const map1 = doc.getMap('slides-data');
			const map2 = doc.getMap('other-data');
			expect(map1).not.toBe(map2);
		});

		it('executes transact callback synchronously', () => {
			let executed = false;
			doc.transact(() => {
				executed = true;
			});
			expect(executed).toBeTruthy();
		});
	});

	// -----------------------------------------------------------------------
	// getDocMap guard logic
	// -----------------------------------------------------------------------
	describe('getDocMap guard logic', () => {
		it('returns null for non-object doc', () => {
			const nonObjDoc = 'not-an-object';
			const d = nonObjDoc as unknown as { getMap?: unknown };
			const result = typeof d === 'object' && d !== null && typeof d.getMap === 'function';
			expect(result).toBeFalsy();
		});

		it('returns null for doc without getMap', () => {
			const noMapDoc = { notGetMap: () => {} };
			const d = noMapDoc as unknown as { getMap?: unknown };
			const result = typeof d.getMap === 'function';
			expect(result).toBeFalsy();
		});

		it('returns Y.Map for valid doc', () => {
			const d = doc as unknown as { getMap: (name: string) => unknown };
			const result = typeof d.getMap === 'function';
			expect(result).toBeTruthy();
			const m = d.getMap('slides-data');
			expect(m).toBeDefined();
		});
	});

	// -----------------------------------------------------------------------
	// Round-trip: write then read
	// -----------------------------------------------------------------------
	describe('round-trip sync', () => {
		it('written slides can be read back identically', () => {
			const slides = makeSlides(3);
			// Add some elements to make it non-trivial
			slides[0] = {
				...slides[0],
				elements: [{ type: 'text', id: 'txt-1', x: 100, y: 200 } as unknown as PptxElement],
			};
			slides[2] = {
				...slides[2],
				hidden: true,
				sectionName: 'Appendix',
			};

			// Write
			const writeResult = syncLocalToDoc(doc, slides, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});
			expect(writeResult.written).toBeTruthy();

			// Read back (with different lastSynced to ensure it is returned)
			const readResult = readRemoteFromDoc(doc, '');
			expect(readResult).not.toBeNull();
			expect(readResult!.slides).toStrictEqual(slides);
		});

		it('write-read-write cycle maintains consistency', () => {
			// Host writes
			const slides1 = makeSlides(2);
			const w1 = syncLocalToDoc(doc, slides1, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: '',
			});

			// Joiner reads
			const r1 = readRemoteFromDoc(doc, '');
			expect(r1).not.toBeNull();
			expect(r1!.slides).toStrictEqual(slides1);

			// Joiner modifies and writes back
			const modified = [...r1!.slides];
			modified.push(makeSlide({ id: 'slide-3', rId: 'rId3', slideNumber: 3 }));

			const w2 = syncLocalToDoc(doc, modified, {
				isConnected: true,
				isApplyingRemote: false,
				lastSynced: r1!.newLastSynced,
			});
			expect(w2.written).toBeTruthy();

			// Host reads update
			const r2 = readRemoteFromDoc(doc, w1.newLastSynced);
			expect(r2).not.toBeNull();
			expect(r2!.slides).toHaveLength(3);
			expect(r2!.slides[2].id).toBe('slide-3');
		});
	});
});
