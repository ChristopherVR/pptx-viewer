import { describe, expect, it, vi } from 'vitest';

import type { PptxElement, TextSegment } from '../../types';
import type { BulletPictureImageResolver } from './bullet-picture-image-enrichment';
import { enrichBulletPictureImages } from './bullet-picture-image-enrichment';

const SLIDE_PATH = 'ppt/slides/slide1.xml';

function textElement(id: string, segments: TextSegment[]): PptxElement {
	return {
		id,
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		textSegments: segments,
	} as unknown as PptxElement;
}

function groupElement(id: string, children: PptxElement[]): PptxElement {
	return {
		id,
		type: 'group',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		children,
	} as unknown as PptxElement;
}

function segmentWithBulletImage(
	text: string,
	imageRelId?: string,
	imageDataUrl?: string,
): TextSegment {
	return {
		text,
		style: {},
		bulletInfo: imageRelId ? { imageRelId, imageDataUrl } : undefined,
	} as unknown as TextSegment;
}

/** A resolver whose relationship map and image loader are fully in the caller's control. */
function fakeResolver(
	rels: Record<string, string>,
	overrides: Partial<BulletPictureImageResolver> = {},
): BulletPictureImageResolver {
	return {
		slideRelsMap: new Map([[SLIDE_PATH, new Map(Object.entries(rels))]]),
		resolveImagePath: (slidePath, target) => `${slidePath.replace(/[^/]*$/u, '')}${target}`,
		getImageData: vi.fn(async (imagePath: string) => `data:image/png;base64,${imagePath}`),
		...overrides,
	};
}

describe('enrichBulletPictureImages', () => {
	it('resolves imageDataUrl for a segment whose bullet only has an imageRelId', async () => {
		const resolver = fakeResolver({ rId5: 'media/image5.png' });
		const segment = segmentWithBulletImage('Item', 'rId5');
		const elements = [textElement('t1', [segment])];

		await enrichBulletPictureImages(elements, SLIDE_PATH, resolver);

		expect(segment.bulletInfo?.imageDataUrl).toBe(
			'data:image/png;base64,ppt/slides/media/image5.png',
		);
	});

	it('leaves a segment with no bulletInfo, or no imageRelId, untouched', async () => {
		const resolver = fakeResolver({});
		const plain = { text: 'x', style: {} } as unknown as TextSegment;
		const noRel = { text: 'y', style: {}, bulletInfo: { char: '*' } } as unknown as TextSegment;
		const elements = [textElement('t1', [plain, noRel])];

		await expect(
			enrichBulletPictureImages(elements, SLIDE_PATH, resolver),
		).resolves.toBeUndefined();
		expect(plain).toStrictEqual({ text: 'x', style: {} });
		expect(noRel.bulletInfo).toStrictEqual({ char: '*' });
	});

	it('does not re-resolve a bullet that already has imageDataUrl (cached at parse time)', async () => {
		const getImageData = vi.fn(async () => 'should-not-be-called');
		const resolver = fakeResolver({ rId5: 'media/image5.png' }, { getImageData });
		const segment = segmentWithBulletImage('Item', 'rId5', 'data:image/png;base64,already-cached');

		await enrichBulletPictureImages([textElement('t1', [segment])], SLIDE_PATH, resolver);

		expect(getImageData).not.toHaveBeenCalled();
		expect(segment.bulletInfo?.imageDataUrl).toBe('data:image/png;base64,already-cached');
	});

	it('recurses into group children', async () => {
		const resolver = fakeResolver({ rId5: 'media/image5.png' });
		const segment = segmentWithBulletImage('Item', 'rId5');
		const elements = [groupElement('g1', [textElement('t1', [segment])])];

		await enrichBulletPictureImages(elements, SLIDE_PATH, resolver);

		expect(segment.bulletInfo?.imageDataUrl).toBe(
			'data:image/png;base64,ppt/slides/media/image5.png',
		);
	});

	it('leaves imageDataUrl unset when the relationship id is not on the slide', async () => {
		const resolver = fakeResolver({}); // no rels at all
		const segment = segmentWithBulletImage('Item', 'rIdMissing');

		await enrichBulletPictureImages([textElement('t1', [segment])], SLIDE_PATH, resolver);

		expect(segment.bulletInfo?.imageDataUrl).toBeUndefined();
	});

	it('passes through an already-absolute (http/https/data) relationship target verbatim', async () => {
		const getImageData = vi.fn(async () => 'unused');
		const resolver = fakeResolver({ rId9: 'https://example.com/icon.png' }, { getImageData });
		const segment = segmentWithBulletImage('Item', 'rId9');

		await enrichBulletPictureImages([textElement('t1', [segment])], SLIDE_PATH, resolver);

		expect(segment.bulletInfo?.imageDataUrl).toBe('https://example.com/icon.png');
		expect(getImageData).not.toHaveBeenCalled();
	});

	it('swallows a getImageData failure and leaves the accessible dot fallback', async () => {
		const resolver = fakeResolver(
			{ rId5: 'media/image5.png' },
			{
				getImageData: vi.fn(async () => {
					throw new Error('archive read failed');
				}),
			},
		);
		const segment = segmentWithBulletImage('Item', 'rId5');

		await expect(
			enrichBulletPictureImages([textElement('t1', [segment])], SLIDE_PATH, resolver),
		).resolves.toBeUndefined();
		expect(segment.bulletInfo?.imageDataUrl).toBeUndefined();
	});
});
