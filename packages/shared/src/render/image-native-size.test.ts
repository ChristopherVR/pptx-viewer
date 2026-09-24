import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	_resetNativeImageSizeCacheForTests,
	getCachedNativeImageSize,
	probeNativeImageSize,
} from './image-native-size';

/** A minimal `Image`-like stub whose `onload`/`onerror` fire on the next microtask. */
class FakeImage {
	naturalWidth = 0;
	naturalHeight = 0;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	#src = '';
	get src(): string {
		return this.#src;
	}
	set src(value: string) {
		this.#src = value;
		queueMicrotask(() => {
			if (value.includes('bad')) {
				this.onerror?.();
				return;
			}
			this.naturalWidth = 800;
			this.naturalHeight = 400;
			this.onload?.();
		});
	}
}

afterEach(() => {
	_resetNativeImageSizeCacheForTests();
	vi.unstubAllGlobals();
});

describe('probeNativeImageSize', () => {
	it('resolves the decoded natural size and caches it', async () => {
		vi.stubGlobal('Image', FakeImage);
		const size = await probeNativeImageSize('data:image/png;base64,ok');
		expect(size).toStrictEqual({ width: 800, height: 400 });
		expect(getCachedNativeImageSize('data:image/png;base64,ok')).toStrictEqual({
			width: 800,
			height: 400,
		});
	});

	it('resolves undefined on a decode error, without caching', async () => {
		vi.stubGlobal('Image', FakeImage);
		const size = await probeNativeImageSize('data:image/png;base64,bad');
		expect(size).toBeUndefined();
		expect(getCachedNativeImageSize('data:image/png;base64,bad')).toBeUndefined();
	});

	it('resolves undefined outside a browser (no `Image` global)', async () => {
		vi.stubGlobal('Image', undefined);
		const size = await probeNativeImageSize('data:image/png;base64,ok');
		expect(size).toBeUndefined();
	});

	it('de-dupes concurrent probes for the same source', async () => {
		let constructed = 0;
		class CountingFakeImage extends FakeImage {
			constructor() {
				super();
				constructed++;
			}
		}
		vi.stubGlobal('Image', CountingFakeImage);
		const [a, b] = await Promise.all([
			probeNativeImageSize('data:image/png;base64,dedupe'),
			probeNativeImageSize('data:image/png;base64,dedupe'),
		]);
		expect(a).toStrictEqual({ width: 800, height: 400 });
		expect(b).toStrictEqual({ width: 800, height: 400 });
		expect(constructed).toBe(1);
	});

	it('returns the cached size synchronously without a new decode', async () => {
		let constructed = 0;
		class CountingFakeImage extends FakeImage {
			constructor() {
				super();
				constructed++;
			}
		}
		vi.stubGlobal('Image', CountingFakeImage);
		await probeNativeImageSize('data:image/png;base64,cached');
		expect(constructed).toBe(1);
		const size = await probeNativeImageSize('data:image/png;base64,cached');
		expect(size).toStrictEqual({ width: 800, height: 400 });
		expect(constructed).toBe(1);
	});
});
