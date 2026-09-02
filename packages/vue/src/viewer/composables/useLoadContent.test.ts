// @vitest-environment happy-dom
import type {
	GroupPptxElement,
	PicturePptxElement,
	PptxData,
	TablePptxElement,
} from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

/**
 * useLoadContent tests: pin the repointed lazy-image resolution through the
 * Vue composable (not the shared helpers directly). `useLoadContent` used to
 * hand-roll the "recurse into groups and splice a resolved Blob URL back onto
 * the matching element" walk for pictures; that is now the shared
 * `applyImagePathPatches`. Table-cell and table-STYLE image-fill resolution
 * are now the shared `resolveTableCellImageUrls` / `resolveTableStyleImageUrls`
 * orchestrators instead of a hand-rolled collect/resolve/patch sequence.
 * `PptxHandler` is mocked so the test drives real deck data through the
 * composable's own load pipeline end-to-end.
 */
const loadMock = vi.fn();
const getImageDataMock = vi.fn(async (path: string) => {
	const urls: Record<string, string> = {
		'ppt/media/image1.png': 'blob:pic-url',
		'ppt/media/image2.png': 'blob:cell-url',
		'ppt/media/image3.png': 'blob:style-url',
	};
	return urls[path];
});
const disposeMock = vi.fn();

/** Mock `PptxHandler`: constructed with `new` by `useLoadContent`, so a plain
 * `vi.fn().mockReturnValue(...)` cannot stand in for it. */
class MockPptxHandler {
	load = loadMock;
	dispose = disposeMock;
	getImageData = getImageDataMock;
	getMediaArrayBuffer = vi.fn();
	getCompatibilityWarnings = vi.fn(() => []);
}

vi.mock(import('pptx-viewer-core'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		PptxHandler: MockPptxHandler,
	};
});

const { useLoadContent } = await import('./useLoadContent');

/** A group whose only child is a picture with an unresolved lazy image path. */
function groupedPicture(): GroupPptxElement {
	const picture: PicturePptxElement = {
		id: 'pic-1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 50,
		height: 50,
		imagePath: 'ppt/media/image1.png',
	} as unknown as PicturePptxElement;
	return {
		id: 'group-1',
		type: 'group',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		children: [picture],
	} as unknown as GroupPptxElement;
}

/** A table with one cell whose background image fill needs resolution. */
function tableWithCellImage(): TablePptxElement {
	return {
		id: 'table-1',
		type: 'table',
		x: 0,
		y: 60,
		width: 100,
		height: 40,
		tableData: {
			rows: [
				{
					cells: [{ style: { backgroundImageFillPath: 'ppt/media/image2.png' } }],
				},
			],
		},
	} as unknown as TablePptxElement;
}

function parsedDeck(): PptxData {
	return {
		slides: [
			{
				id: 'slide-1',
				slideNumber: 1,
				elements: [groupedPicture(), tableWithCellImage()],
			},
		],
		width: 960,
		height: 540,
		tableStyleMap: {
			'style-1': {
				wholeTblFill: { image: { path: 'ppt/media/image3.png' } },
			},
		},
	} as unknown as PptxData;
}

describe('useLoadContent (lazy image resolution repoint)', () => {
	it('resolves a picture nested inside a group, a table-cell fill, and a table-style fill', async () => {
		loadMock.mockResolvedValueOnce(parsedDeck());
		const content = ref<Uint8Array | null>(new Uint8Array([1, 2, 3]));
		const result = useLoadContent(content);

		// The watcher's load() runs asynchronously; flush the microtask queue.
		await vi.waitFor(() => expect(result.loading.value).toBeFalsy());

		const group = result.slides.value[0].elements[0] as unknown as {
			children: { imageData?: string }[];
		};
		expect(group.children[0].imageData).toBe('blob:pic-url');

		const table = result.slides.value[0].elements[1] as unknown as {
			tableData: { rows: { cells: { style?: { backgroundImageFillData?: string } } }[] }[];
		};
		expect(table.tableData.rows[0].cells[0].style?.backgroundImageFillData).toBe('blob:cell-url');

		const styleMap = result.tableStyleMap.value as unknown as {
			'style-1': { wholeTblFill: { image: { data?: string } } };
		};
		expect(styleMap['style-1'].wholeTblFill.image.data).toBe('blob:style-url');
	});
});
