import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createImageElementFromFile } from './image-file-insertion';

const PNG_DATA =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP4sAAAAASUVORK5CYII=';
const canvas = { width: 960, height: 540 };

class Reader {
	static instances: Reader[] = [];
	result: string | ArrayBuffer | null = null;
	readyState = 0;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onabort: (() => void) | null = null;
	readAsDataURL = vi.fn(() => {
		this.readyState = 1;
	});
	abort = vi.fn(() => {
		this.readyState = 2;
		this.onabort?.();
	});
	constructor() {
		Reader.instances.push(this);
	}
	complete(result: string | ArrayBuffer | null = PNG_DATA): void {
		this.result = result;
		this.readyState = 2;
		this.onload?.();
	}
}

class ImageProbe {
	static instances: ImageProbe[] = [];
	naturalWidth = 0;
	naturalHeight = 0;
	src = '';
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	removeAttribute = vi.fn();
	constructor() {
		ImageProbe.instances.push(this);
	}
	complete(width = 400, height = 300): void {
		this.naturalWidth = width;
		this.naturalHeight = height;
		this.onload?.();
	}
}

const file = (): File => new File(['image bytes'], 'image.png', { type: 'image/png' });

beforeEach(() => {
	Reader.instances = [];
	ImageProbe.instances = [];
	vi.stubGlobal('FileReader', Reader);
	vi.stubGlobal('Image', ImageProbe);
});
afterEach(() => vi.unstubAllGlobals());

describe('createImageElementFromFile', () => {
	it.each([
		[400, 300, 280, 120, 400, 300],
		[1920, 1080, 0, 0, 960, 540],
		[1000, 1000, 210, 0, 540, 540],
		[2000, 100, 0, 246, 960, 48],
		[100, 2000, 466.5, 0, 27, 540],
		[1, 1, 479.5, 269.5, 1, 1],
	])(
		'fits %sx%s without upscaling or changing its aspect ratio',
		async (w, h, x, y, width, height) => {
			const input = file();
			const result = createImageElementFromFile(input, canvas);
			expect(Reader.instances[0].readAsDataURL).toHaveBeenCalledWith(input);
			Reader.instances[0].complete();
			expect(ImageProbe.instances[0].src).toBe(PNG_DATA);
			ImageProbe.instances[0].complete(w, h);
			const image = await result;
			expect(image).toMatchObject({ type: 'image', imageData: PNG_DATA, x, y, width, height });
			expect(image?.id).toBeTruthy();
			expect(image?.imagePath).toBeUndefined();
		},
	);

	it('accepts a Blob and snapshots the caller-owned bounds before decoding', async () => {
		const bounds = { ...canvas };
		const result = createImageElementFromFile(new Blob(['bytes'], { type: 'image/jpeg' }), bounds);
		bounds.width = 100;
		Reader.instances[0].complete('data:image/jpeg;base64,Ynl0ZXM=');
		ImageProbe.instances[0].complete(400, 300);
		await expect(result).resolves.toMatchObject({ x: 280, y: 120, width: 400, height: 300 });
		expect(bounds).toStrictEqual({ width: 100, height: 540 });
	});

	it.each(['text/plain', 'application/octet-stream', ''])(
		'does not read a non-image MIME type %s',
		async (type) => {
			await expect(
				createImageElementFromFile(new Blob(['bytes'], { type }), canvas),
			).resolves.toBeNull();
			expect(Reader.instances).toHaveLength(0);
		},
	);

	it('does not read an empty image', async () => {
		await expect(
			createImageElementFromFile(new Blob([], { type: 'image/png' }), canvas),
		).resolves.toBeNull();
		expect(Reader.instances).toHaveLength(0);
	});

	it.each([0, -1, NaN, Infinity, -Infinity])(
		'rejects invalid canvas dimensions %s',
		async (value) => {
			await expect(
				createImageElementFromFile(file(), { ...canvas, width: value }),
			).resolves.toBeNull();
			await expect(
				createImageElementFromFile(file(), { ...canvas, height: value }),
			).resolves.toBeNull();
			expect(Reader.instances).toHaveLength(0);
		},
	);

	it.each([0, -1, NaN, Infinity])('rejects invalid decoded dimensions %s', async (value) => {
		for (const size of [
			[value, 20],
			[20, value],
		]) {
			const result = createImageElementFromFile(file(), canvas);
			Reader.instances.at(-1)!.complete();
			ImageProbe.instances.at(-1)!.complete(size[0], size[1]);
			await expect(result).resolves.toBeNull();
		}
	});

	it('rejects underflowed fitted geometry', async () => {
		const result = createImageElementFromFile(file(), { width: Number.MIN_VALUE, height: 540 });
		Reader.instances[0].complete();
		ImageProbe.instances[0].complete(Number.MAX_VALUE, 1);
		await expect(result).resolves.toBeNull();
	});

	it.each([
		null,
		'',
		new ArrayBuffer(0),
		'https://example.invalid/image.png',
		'data:text/html;base64,YQ==',
	])('rejects invalid read result %s', async (value) => {
		const result = createImageElementFromFile(file(), canvas);
		Reader.instances[0].complete(value);
		await expect(result).resolves.toBeNull();
		expect(ImageProbe.instances).toHaveLength(0);
	});

	it.each(['onerror', 'onabort'] as const)('does not decode after FileReader %s', async (event) => {
		const result = createImageElementFromFile(file(), canvas);
		Reader.instances[0][event]?.();
		await expect(result).resolves.toBeNull();
		expect(ImageProbe.instances).toHaveLength(0);
	});

	it('does not fabricate an element when image decoding fails', async () => {
		const result = createImageElementFromFile(file(), canvas);
		Reader.instances[0].complete();
		ImageProbe.instances[0].onerror?.();
		await expect(result).resolves.toBeNull();
	});

	it('resolves read setup failures without an unhandled rejection', async () => {
		vi.stubGlobal(
			'FileReader',
			class extends Reader {
				readAsDataURL = vi.fn(() => {
					throw new Error('Read failed');
				});
			},
		);
		await expect(createImageElementFromFile(file(), canvas)).resolves.toBeNull();
	});

	it('resolves decode setup failures without an unhandled rejection', async () => {
		vi.stubGlobal(
			'Image',
			class extends ImageProbe {
				constructor() {
					super();
					Object.defineProperty(this, 'src', {
						get: () => '',
						set: () => {
							throw new Error('Decode failed');
						},
					});
				}
			},
		);
		const result = createImageElementFromFile(file(), canvas);
		Reader.instances[0].complete();
		await expect(result).resolves.toBeNull();
		expect(ImageProbe.instances[0].onload).toBeNull();
	});

	it('does not start reading an already-aborted request', async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(createImageElementFromFile(file(), canvas, controller.signal)).resolves.toBeNull();
		expect(Reader.instances).toHaveLength(0);
	});

	it('aborts a pending read and removes listeners', async () => {
		const controller = new AbortController();
		const remove = vi.spyOn(controller.signal, 'removeEventListener');
		const result = createImageElementFromFile(file(), canvas, controller.signal);
		const reader = Reader.instances[0];
		controller.abort();
		await expect(result).resolves.toBeNull();
		expect(reader.abort).toHaveBeenCalledOnce();
		expect(reader.onload).toBeNull();
		expect(reader.onerror).toBeNull();
		expect(reader.onabort).toBeNull();
		expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
		expect(ImageProbe.instances).toHaveLength(0);
	});

	it('aborts a pending image decode without constructing an element', async () => {
		const controller = new AbortController();
		const result = createImageElementFromFile(file(), canvas, controller.signal);
		Reader.instances[0].complete();
		const image = ImageProbe.instances[0];
		controller.abort();
		await expect(result).resolves.toBeNull();
		expect(image.onload).toBeNull();
		expect(image.onerror).toBeNull();
		expect(image.removeAttribute).toHaveBeenCalledWith('src');
		expect(Reader.instances[0].abort).not.toHaveBeenCalled();
	});

	it('cleans up a successful decode and ignores later cancellation', async () => {
		const controller = new AbortController();
		const remove = vi.spyOn(controller.signal, 'removeEventListener');
		const result = createImageElementFromFile(file(), canvas, controller.signal);
		Reader.instances[0].complete();
		ImageProbe.instances[0].complete();
		const image = await result;
		controller.abort();
		await expect(result).resolves.toBe(image);
		expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
		expect(ImageProbe.instances[0].onload).toBeNull();
		expect(ImageProbe.instances[0].onerror).toBeNull();
	});

	it('keeps concurrent requests independent and constructs fresh element IDs', async () => {
		const controller = new AbortController();
		const cancelled = createImageElementFromFile(file(), canvas, controller.signal);
		const first = createImageElementFromFile(file(), canvas);
		const second = createImageElementFromFile(file(), canvas);
		Reader.instances[0].complete();
		Reader.instances[1].complete();
		Reader.instances[2].complete();
		controller.abort();
		ImageProbe.instances[2].complete(100, 200);
		ImageProbe.instances[1].complete(300, 100);
		await expect(cancelled).resolves.toBeNull();
		await expect(first).resolves.toMatchObject({ width: 300, height: 100 });
		await expect(second).resolves.toMatchObject({ width: 100, height: 200 });
		expect((await first)?.id).not.toBe((await second)?.id);
	});

	it('can be imported and called without browser globals', async () => {
		vi.stubGlobal('FileReader', undefined);
		vi.stubGlobal('Image', undefined);
		vi.resetModules();
		const module = await import('./image-file-insertion');
		await expect(module.createImageElementFromFile(file(), canvas)).resolves.toBeNull();
	});
});
