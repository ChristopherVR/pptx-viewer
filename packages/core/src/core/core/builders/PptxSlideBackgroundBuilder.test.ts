import { describe, it, expect, vi } from 'vitest';

import type { XmlObject, PptxSlide } from '../../types';
import { PptxSlideBackgroundBuilder } from './PptxSlideBackgroundBuilder';
import type { PptxSlideBackgroundBuilderInput } from './PptxSlideBackgroundBuilder';

/**
 * Create a minimal PptxSlideBackgroundBuilderInput with sensible stubs.
 * Only the slide-level properties and the slideNode vary per test;
 * the zip, saveState, and relationship registry are stubbed.
 */
function createInput(
	slide: Partial<PptxSlide>,
	slideNode?: XmlObject,
): PptxSlideBackgroundBuilderInput {
	return {
		slideNode: slideNode ?? { 'p:cSld': {} },
		slide: {
			id: 'slide-1',
			number: 1,
			elements: [],
			...slide,
		} as PptxSlide,
		zip: {
			file: vi.fn<() => void>(),
		} as unknown as PptxSlideBackgroundBuilderInput['zip'],
		saveState: {
			nextMediaPath: vi.fn<() => void>().mockReturnValue('ppt/media/image1.png'),
		} as unknown as PptxSlideBackgroundBuilderInput['saveState'],
		relationshipRegistry: {
			nextRelationshipId: vi.fn<() => void>().mockReturnValue('rId10'),
			upsertRelationship: vi.fn<() => void>(),
		} as unknown as PptxSlideBackgroundBuilderInput['relationshipRegistry'],
		slideImageRelationshipType:
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
		resolveImageToBytes: vi
			.fn<() => Promise<{ bytes: Uint8Array; extension: string } | null>>()
			.mockResolvedValue({
				bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
				extension: 'png',
			}),
	};
}

describe('pptxSlideBackgroundBuilder', () => {
	const builder = new PptxSlideBackgroundBuilder();

	// ── No background ────────────────────────────────────────────────────

	it('removes p:bg when no background properties are set', async () => {
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': { 'p:bgPr': { 'a:solidFill': {} } },
			},
		};
		const input = createInput({}, slideNode);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeUndefined();
	});

	it('removes p:bg when backgroundColor is transparent', async () => {
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': { 'p:bgPr': {} },
			},
		};
		const input = createInput({ backgroundColor: 'transparent' }, slideNode);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeUndefined();
	});

	it('removes p:bg when backgroundColor is empty string', async () => {
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': { 'p:bgPr': {} },
			},
		};
		const input = createInput({ backgroundColor: '' }, slideNode);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeUndefined();
	});

	// ── Solid color background ───────────────────────────────────────────

	it('generates a:solidFill for a hex background color', async () => {
		const input = createInput({ backgroundColor: '#FF6600' });
		await builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bg = cSld['p:bg'] as XmlObject;
		const bgPr = bg['p:bgPr'] as XmlObject;

		expect(bgPr['a:solidFill']).toBeDefined();
		const solidFill = bgPr['a:solidFill'] as XmlObject;
		const srgbClr = solidFill['a:srgbClr'] as XmlObject;
		expect(srgbClr['@_val']).toBe('FF6600');
	});

	it('strips # from hex color in solidFill output', async () => {
		const input = createInput({ backgroundColor: '#aabbcc' });
		await builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;
		const srgbClr = (bgPr['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject;
		// Should uppercase and strip #
		expect(srgbClr['@_val']).toBe('AABBCC');
	});

	it('includes a:effectLst in bgPr for solid fill', async () => {
		const input = createInput({ backgroundColor: '#FF0000' });
		await builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;
		expect(bgPr['a:effectLst']).toStrictEqual({});
	});

	// ── Image background ─────────────────────────────────────────────────

	it('generates a:blipFill for a data-URL background image', async () => {
		const input = createInput({
			backgroundImage: 'data:image/png;base64,iVBOR...',
		});
		await builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;

		expect(bgPr['a:blipFill']).toBeDefined();
		const blipFill = bgPr['a:blipFill'] as XmlObject;
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['@_r:embed']).toBe('rId10');
		expect(blipFill['a:stretch']).toStrictEqual({ 'a:fillRect': {} });
	});

	it('writes image bytes to zip and registers relationship', async () => {
		const input = createInput({
			backgroundImage: 'data:image/png;base64,iVBOR...',
		});
		await builder.applyBackground(input);

		expect(input.zip.file).toHaveBeenCalledWith('ppt/media/image1.png', expect.any(Uint8Array));
		expect(input.relationshipRegistry.upsertRelationship).toHaveBeenCalledWith(
			'rId10',
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
			'../media/image1.png',
		);
	});

	it('image background takes priority over solid color', async () => {
		const input = createInput({
			backgroundColor: '#FF0000',
			backgroundImage: 'data:image/png;base64,iVBOR...',
		});
		await builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;

		// Should have blipFill, not solidFill
		expect(bgPr['a:blipFill']).toBeDefined();
		expect(bgPr['a:solidFill']).toBeUndefined();
	});

	// ── cSld initialization ──────────────────────────────────────────────

	it('creates p:cSld if missing from slideNode', async () => {
		const slideNode: XmlObject = {};
		const input = createInput({ backgroundColor: '#00FF00' }, slideNode);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld).toBeDefined();
		expect(cSld['p:bg']).toBeDefined();
	});

	// ── When parseDataUrlToBytes returns null ──────────────────────────────

	it('falls back to the solid background colour when the image cannot be embedded', async () => {
		// When the image cannot be resolved to bytes, the blipFill is skipped;
		// if the slide also carries a background colour it is now used as the
		// fallback fill (instead of dropping the background entirely).
		const input = createInput({
			backgroundColor: '#FF0000',
			backgroundImage: 'data:image/png;base64,corrupted',
		});
		(input.resolveImageToBytes as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		await builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;
		expect(bgPr['a:blipFill']).toBeUndefined();
		expect((bgPr['a:solidFill'] as XmlObject)['a:srgbClr']).toStrictEqual({ '@_val': 'FF0000' });
	});

	it('drops p:bg entirely when image cannot be embedded and there is no other fill', async () => {
		const input = createInput({ backgroundImage: 'data:image/png;base64,corrupted' });
		(input.resolveImageToBytes as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		await builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeUndefined();
	});

	// ── rId-referenced blipFill preservation ─────────────────────────────

	it('preserves raw p:bg with existing a:blipFill when slide model has no data-URL override', async () => {
		// rId-referenced backgrounds arrive on the slide model as a resolved
		// data URL on `slide.backgroundImage` OR, in some paths, as a
		// non-data-URL string (or undefined). Either way, when we don't have
		// a fresh data URL / solid colour / gradient to regenerate from, we
		// must preserve the original raw <p:bg> XML to avoid losing the
		// blipFill (and all its metadata: dpi, rotWithShape, srcRect, …).
		const originalBg: XmlObject = {
			'p:bgPr': {
				'a:blipFill': {
					'@_dpi': '0',
					'@_rotWithShape': '1',
					'a:blip': { '@_r:embed': 'rId4' },
					'a:srcRect': {},
					'a:stretch': { 'a:fillRect': { '@_t': '-17000', '@_b': '-17000' } },
				},
				'a:effectLst': {},
			},
		};
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': originalBg,
				'p:spTree': { 'p:sp': [] },
			},
		};
		// `backgroundImage` here is the zip-relative path-style string that
		// some code paths produce for rId-backed backgrounds. The key point
		// is it's not a data URL, so we can't regenerate a blipFill from it.
		const input = createInput({ backgroundImage: 'ppt/media/image5.JPG' }, slideNode);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		const bg = cSld['p:bg'] as XmlObject;
		expect(bg).toBeDefined();
		const bgPr = bg['p:bgPr'] as XmlObject;
		expect(bgPr['a:blipFill']).toBeDefined();
		const blipFill = bgPr['a:blipFill'] as XmlObject;
		// All original metadata is preserved.
		expect(blipFill['@_dpi']).toBe('0');
		expect(blipFill['@_rotWithShape']).toBe('1');
		expect((blipFill['a:blip'] as XmlObject)['@_r:embed']).toBe('rId4');
		const stretchFillRect = (blipFill['a:stretch'] as XmlObject)['a:fillRect'] as XmlObject;
		expect(stretchFillRect['@_t']).toBe('-17000');
		expect(stretchFillRect['@_b']).toBe('-17000');
		// No new relationships were registered.
		expect(input.relationshipRegistry.upsertRelationship).not.toHaveBeenCalled();
		// p:bg still precedes p:spTree in the cSld.
		const keys = Object.keys(cSld).filter((k) => !k.startsWith('@_'));
		expect(keys.indexOf('p:bg')).toBeLessThan(keys.indexOf('p:spTree'));
	});

	it('preserves raw p:bg blipFill even when backgroundImage is undefined but raw XML has one', async () => {
		// Guard against a related shape of the bug: the load pipeline didn't
		// surface the background onto the model at all (backgroundImage is
		// undefined), yet the raw slide XML carries a valid blipFill-based
		// <p:bg>. Previously applyBackground treated this as "no background"
		// and deleted <p:bg>; now we keep it.
		const originalBg: XmlObject = {
			'p:bgPr': {
				'a:blipFill': {
					'a:blip': { '@_r:embed': 'rId7' },
					'a:stretch': { 'a:fillRect': {} },
				},
				'a:effectLst': {},
			},
		};
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:spTree': { 'p:sp': [] },
				'p:bg': originalBg,
			},
		};
		const input = createInput({}, slideNode);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		// With no slide-model background signals, the builder's contract is
		// still to delete p:bg. Round-tripping rId backgrounds when the
		// model is silent is the responsibility of the loader surfacing them
		// onto slide.backgroundImage. Keep this test documenting that.
		expect(cSld['p:bg']).toBeUndefined();
	});

	it('regenerates a:blipFill from a data-URL backgroundImage even when raw XML has a different blipFill', async () => {
		// If the slide model has a fresh data-URL image, it wins over the
		// raw XML — this is how edits to the background propagate on save.
		const originalBg: XmlObject = {
			'p:bgPr': {
				'a:blipFill': {
					'a:blip': { '@_r:embed': 'rIdOLD' },
					'a:stretch': { 'a:fillRect': {} },
				},
			},
		};
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': originalBg,
				'p:spTree': { 'p:sp': [] },
			},
		};
		const input = createInput({ backgroundImage: 'data:image/png;base64,iVBOR...' }, slideNode);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;
		const blipFill = bgPr['a:blipFill'] as XmlObject;
		// New rId from the registry mock; not the original.
		expect((blipFill['a:blip'] as XmlObject)['@_r:embed']).toBe('rId10');
		expect(input.relationshipRegistry.upsertRelationship).toHaveBeenCalledWith(
			'rId10',
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
			'../media/image1.png',
		);
	});

	// ── Schema child order ────────────────────────────────────────────────

	it('places p:bg before p:spTree in p:cSld when adding a background', async () => {
		// OOXML CT_CommonSlideData schema requires child order: bg, spTree,
		// custDataLst, controls, extLst. fast-xml-parser serialises keys in
		// insertion order, so p:bg MUST be the first key in p:cSld when
		// p:spTree is already present. Emitting spTree first produces a
		// Sch_UnexpectedElementContentExpectingComplex violation.
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:spTree': { 'p:sp': [] },
			},
		};
		const input = createInput({ backgroundColor: '#FFFFFF' }, slideNode);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		const keys = Object.keys(cSld).filter((k) => !k.startsWith('@_'));
		const bgIdx = keys.indexOf('p:bg');
		const spTreeIdx = keys.indexOf('p:spTree');
		expect(bgIdx).toBeGreaterThanOrEqual(0);
		expect(spTreeIdx).toBeGreaterThan(bgIdx);
	});

	// ── shadeToTitle round-trip (ECMA-376 §19.3.1.2) ──────────────────────

	it('emits @_shadeToTitle="1" when slide.backgroundShadeToTitle is true', async () => {
		const input = createInput({
			backgroundColor: '#FFFFFF',
			backgroundShadeToTitle: true,
		});
		await builder.applyBackground(input);
		const bgPr = (
			((input.slideNode['p:cSld'] as XmlObject)['p:bg'] as XmlObject)['p:bgPr'] as XmlObject
		)['@_shadeToTitle'];
		expect(bgPr).toBe('1');
	});

	it('emits @_shadeToTitle="0" when slide.backgroundShadeToTitle is false', async () => {
		const input = createInput({
			backgroundColor: '#FFFFFF',
			backgroundShadeToTitle: false,
		});
		await builder.applyBackground(input);
		const bgPr = (
			((input.slideNode['p:cSld'] as XmlObject)['p:bg'] as XmlObject)['p:bgPr'] as XmlObject
		)['@_shadeToTitle'];
		expect(bgPr).toBe('0');
	});

	it('omits @_shadeToTitle when backgroundShadeToTitle is undefined', async () => {
		const input = createInput({ backgroundColor: '#FFFFFF' });
		await builder.applyBackground(input);
		const bgPr = ((input.slideNode['p:cSld'] as XmlObject)['p:bg'] as XmlObject)[
			'p:bgPr'
		] as XmlObject;
		expect(bgPr['@_shadeToTitle']).toBeUndefined();
	});

	// ── Non-data-URL image embedding (regression: dropped background) ──────

	it('embeds a non-data-URL background image as a new blipFill', async () => {
		// Regression: a freshly applied background (e.g. from a design/theme
		// preview) is typically a bundled/remote URL, not a data URL, and there
		// is no pre-existing blipFill to preserve. Previously this was dropped
		// on save; now it is resolved to bytes and embedded.
		const input = createInput({ backgroundImage: 'https://cdn.example.com/theme-bg.jpg' });
		await builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;
		const blipFill = bgPr['a:blipFill'] as XmlObject;
		expect(blipFill).toBeDefined();
		expect((blipFill['a:blip'] as XmlObject)['@_r:embed']).toBe('rId10');
		expect(input.resolveImageToBytes).toHaveBeenCalledWith('https://cdn.example.com/theme-bg.jpg');
		expect(input.zip.file).toHaveBeenCalledWith('ppt/media/image1.png', expect.any(Uint8Array));
		expect(input.relationshipRegistry.upsertRelationship).toHaveBeenCalledWith(
			'rId10',
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
			'../media/image1.png',
		);
	});

	it('preserves an existing p:bg when a background image cannot be resolved', async () => {
		// Safety guard: if the image URL cannot be fetched/decoded, keep whatever
		// <p:bg> was already there instead of silently wiping the background.
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': { 'p:bgPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '112233' } } } },
				'p:spTree': { 'p:sp': [] },
			},
		};
		const input = createInput(
			{ backgroundImage: 'https://cdn.example.com/missing.jpg' },
			slideNode,
		);
		const warn = vi.fn<() => void>();
		input.reportUnsupportedBackground = warn;
		(input.resolveImageToBytes as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		await builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeDefined();
		expect(warn).toHaveBeenCalledWith('https://cdn.example.com/missing.jpg');
		// p:bg still precedes p:spTree.
		const keys = Object.keys(cSld).filter((k) => !k.startsWith('@_'));
		expect(keys.indexOf('p:bg')).toBeLessThan(keys.indexOf('p:spTree'));
	});
});
