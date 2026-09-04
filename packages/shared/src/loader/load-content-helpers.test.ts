import type {
	GroupPptxElement,
	MediaPptxElement,
	Model3DPptxElement,
	PptxSlide,
	TablePptxElement,
} from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import {
	applyTableCellImagePatches,
	collectAnimationSoundPaths,
	collectImagePaths,
	collectTableCellImagePaths,
} from './load-content-helpers';
import { resolveMediaElementSource } from './media-element-source';
import type { MediaArrayBufferSource } from './media-element-source';

describe('collectAnimationSoundPaths', () => {
	function slide(overrides: Partial<PptxSlide> = {}): PptxSlide {
		return { id: 's1', elements: [], ...overrides } as PptxSlide;
	}

	it('collects a slide transition sound path (p:sndAc/p:stSnd)', () => {
		const slides = [
			slide({ transition: { type: 'fade', soundPath: 'ppt/media/media3.wav' } } as never),
		];
		expect(collectAnimationSoundPaths(slides)).toStrictEqual(['ppt/media/media3.wav']);
	});

	it('collects both a native-animation sound and a transition sound, deduped', () => {
		const slides = [
			slide({
				nativeAnimations: [{ soundPath: 'ppt/media/media1.wav' }] as never,
				transition: { type: 'fade', soundPath: 'ppt/media/media1.wav' } as never,
			}),
			slide({ transition: { type: 'wipe', soundPath: 'ppt/media/media2.wav' } as never }),
		];
		expect(collectAnimationSoundPaths(slides).sort()).toStrictEqual([
			'ppt/media/media1.wav',
			'ppt/media/media2.wav',
		]);
	});

	it('ignores a transition with no sound path', () => {
		expect(
			collectAnimationSoundPaths([slide({ transition: { type: 'fade' } as never })]),
		).toStrictEqual([]);
	});

	it('does not collect an external (http) transition sound URL', () => {
		const slides = [
			slide({
				transition: { type: 'fade', soundPath: 'https://example.com/a.wav' } as never,
			}),
		];
		expect(collectAnimationSoundPaths(slides)).toStrictEqual([]);
	});
});

describe('collectImagePaths model3d assets', () => {
	it('collects the model payload and poster for lazy resolution', () => {
		const model: Model3DPptxElement = {
			id: 'model-1',
			type: 'model3d',
			x: 10,
			y: 20,
			width: 300,
			height: 200,
			modelPath: 'ppt/media/model1.glb',
			modelMimeType: 'model/gltf-binary',
			imagePath: 'ppt/media/model1.png',
			posterImage: 'ppt/media/model1.png',
		};
		const slides = [{ id: 'slide-1', elements: [model] }] as PptxSlide[];

		const result = collectImagePaths(slides);

		expect([...result.paths]).toStrictEqual(['ppt/media/model1.glb', 'ppt/media/model1.png']);
		expect(result.refs.map(({ field, path }) => ({ field, path }))).toStrictEqual([
			{ field: 'modelData', path: 'ppt/media/model1.glb' },
			{ field: 'posterImage', path: 'ppt/media/model1.png' },
		]);
	});

	it('does not collect already resolved or external model assets', () => {
		const model = {
			id: 'model-2',
			type: 'model3d',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			modelPath: 'https://example.test/model.glb',
			modelData: 'data:model/gltf-binary;base64,AAAA',
			imagePath: 'ppt/media/model2.png',
			imageData: 'blob:poster',
		} as Model3DPptxElement;
		const slides = [{ id: 'slide-2', elements: [model] }] as PptxSlide[];

		expect(collectImagePaths(slides)).toStrictEqual({ paths: new Set(), refs: [] });
	});
});

function makeTable(
	id: string,
	backgroundImageFillPath?: string,
	hasData = false,
): TablePptxElement {
	return {
		id,
		type: 'table',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		tableData: {
			rows: [
				{
					cells: [
						{
							text: 'a',
							style: backgroundImageFillPath
								? {
										fillMode: 'image',
										backgroundImageFillPath,
										...(hasData ? { backgroundImageFillData: 'blob:already-resolved' } : {}),
									}
								: undefined,
						},
						{ text: 'b' },
					],
				},
			],
			columnWidths: [0.5, 0.5],
		},
	};
}

describe('collectTableCellImagePaths', () => {
	it('collects an unresolved cell image-fill path', () => {
		const table = makeTable('table-1', 'ppt/media/cell1.png');
		const slides = [{ id: 'slide-1', elements: [table] }] as PptxSlide[];

		const result = collectTableCellImagePaths(slides);

		expect([...result.paths]).toStrictEqual(['ppt/media/cell1.png']);
		expect(result.refs).toStrictEqual([
			{ element: table, rowIndex: 0, cellIndex: 0, path: 'ppt/media/cell1.png' },
		]);
	});

	it('skips a cell whose image fill already resolved to data', () => {
		const table = makeTable('table-2', 'ppt/media/cell1.png', true);
		const slides = [{ id: 'slide-2', elements: [table] }] as PptxSlide[];

		expect(collectTableCellImagePaths(slides)).toStrictEqual({ paths: new Set(), refs: [] });
	});

	it('skips an already-external URL', () => {
		const table = makeTable('table-3', 'https://example.test/cell.png');
		const slides = [{ id: 'slide-3', elements: [table] }] as PptxSlide[];

		expect(collectTableCellImagePaths(slides)).toStrictEqual({ paths: new Set(), refs: [] });
	});

	it('recurses into group children', () => {
		const table = makeTable('table-4', 'ppt/media/cell4.png');
		const group: GroupPptxElement = {
			id: 'group-1',
			type: 'group',
			x: 0,
			y: 0,
			width: 400,
			height: 200,
			children: [table],
		};
		const slides = [{ id: 'slide-4', elements: [group] }] as PptxSlide[];

		const result = collectTableCellImagePaths(slides);
		expect([...result.paths]).toStrictEqual(['ppt/media/cell4.png']);
	});
});

describe('applyTableCellImagePatches', () => {
	it('patches the resolved URL onto the matching cell only', () => {
		const table = makeTable('table-5', 'ppt/media/cell5.png');
		const { refs } = collectTableCellImagePaths([
			{ id: 'slide-5', elements: [table] },
		] as PptxSlide[]);
		const resolvedMap = new Map([['ppt/media/cell5.png', 'blob:resolved-5']]);

		const patched = applyTableCellImagePatches([table], resolvedMap, refs);

		expect(patched).not.toBe([table]);
		const patchedTable = patched[0] as TablePptxElement;
		expect(patchedTable.tableData?.rows[0].cells[0].style?.backgroundImageFillData).toBe(
			'blob:resolved-5',
		);
		// The second cell (no image fill) is untouched.
		expect(patchedTable.tableData?.rows[0].cells[1].style).toBeUndefined();
		// The original table element is not mutated in place.
		expect(table.tableData?.rows[0].cells[0].style?.backgroundImageFillData).toBeUndefined();
	});

	it('returns the same array reference when nothing resolved', () => {
		const table = makeTable('table-6', 'ppt/media/cell6.png');
		const elements = [table];
		const { refs } = collectTableCellImagePaths([{ id: 'slide-6', elements }] as PptxSlide[]);

		const patched = applyTableCellImagePatches(elements, new Map(), refs);

		expect(patched).toBe(elements);
	});
});

// ---------------------------------------------------------------------------
// resolveMediaElementSource (G17: linked/external media source resolution)
// ---------------------------------------------------------------------------
describe('resolveMediaElementSource', () => {
	function media(overrides: Partial<MediaPptxElement> = {}): MediaPptxElement {
		return {
			id: 'm1',
			type: 'media',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
			mediaType: 'video',
			...overrides,
		} as MediaPptxElement;
	}

	function fakeHandler(overrides: Partial<MediaArrayBufferSource> = {}): MediaArrayBufferSource {
		return {
			getMediaArrayBuffer: vi.fn(async () => undefined),
			getImageData: vi.fn(async () => undefined),
			...overrides,
		};
	}

	it('marks an element with no mediaPath as missing without touching the handler', async () => {
		const handler = fakeHandler();
		const result = await resolveMediaElementSource(media({ mediaPath: undefined }), handler);
		expect(result).toStrictEqual({
			mediaPath: undefined,
			url: undefined,
			isBlobUrl: false,
			missing: true,
		});
		expect(handler.getMediaArrayBuffer).not.toHaveBeenCalled();
	});

	// G17: a LINKED (TargetMode="External") element's mediaPath is already the
	// verbatim URL by the time it reaches here (core no longer corrupts it via
	// resolvePath); it must be handed back as-is, never routed through the
	// archive lookup, which can only ever find an embedded part.
	it('hands back an external mediaPath verbatim without calling getMediaArrayBuffer', async () => {
		const handler = fakeHandler();
		const result = await resolveMediaElementSource(
			media({ mediaPath: 'https://cdn.example.com/demo.mp4' }),
			handler,
		);
		expect(result).toStrictEqual({
			mediaPath: 'https://cdn.example.com/demo.mp4',
			url: 'https://cdn.example.com/demo.mp4',
			isBlobUrl: false,
			missing: false,
		});
		expect(handler.getMediaArrayBuffer).not.toHaveBeenCalled();
	});

	it('resolves an embedded video/audio path to a Blob URL', async () => {
		const bytes = new Uint8Array([1, 2, 3]).buffer;
		const handler = fakeHandler({ getMediaArrayBuffer: vi.fn(async () => bytes) });
		const result = await resolveMediaElementSource(
			media({ mediaPath: 'ppt/media/media1.mp4', mediaMimeType: 'video/mp4' }),
			handler,
		);
		expect(result.mediaPath).toBe('ppt/media/media1.mp4');
		expect(result.isBlobUrl).toBeTruthy();
		expect(result.missing).toBeFalsy();
		expect(result.url?.startsWith('blob:')).toBeTruthy();
	});

	it('marks an embedded path missing when the archive has no matching part', async () => {
		const handler = fakeHandler({ getMediaArrayBuffer: vi.fn(async () => undefined) });
		const result = await resolveMediaElementSource(
			media({ mediaPath: 'ppt/media/missing.mp4' }),
			handler,
		);
		expect(result.missing).toBeTruthy();
		expect(result.url).toBeUndefined();
	});

	it('resolves a non audio/video media path (e.g. an audioCd placeholder) via getImageData', async () => {
		const handler = fakeHandler({ getImageData: vi.fn(async () => 'data:image/png;base64,abc') });
		const result = await resolveMediaElementSource(
			media({ mediaType: 'unknown', mediaPath: 'ppt/media/thumb.png' }),
			handler,
		);
		expect(result.missing).toBeFalsy();
		expect(result.isBlobUrl).toBeFalsy();
		expect(result.url).toBe('data:image/png;base64,abc');
	});

	it('marks the element missing when the handler throws', async () => {
		const handler = fakeHandler({
			getMediaArrayBuffer: vi.fn(async () => {
				throw new Error('zip read failed');
			}),
		});
		const result = await resolveMediaElementSource(
			media({ mediaPath: 'ppt/media/media2.mp4' }),
			handler,
		);
		expect(result.missing).toBeTruthy();
	});
});
