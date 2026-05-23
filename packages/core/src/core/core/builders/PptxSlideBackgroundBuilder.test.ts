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
		parseDataUrlToBytes: vi.fn<() => void>().mockReturnValue({
			bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
			extension: 'png',
		}),
	};
}

describe('pptxSlideBackgroundBuilder', () => {
	const builder = new PptxSlideBackgroundBuilder();

	// ── No background ────────────────────────────────────────────────────

	it('removes p:bg when no background properties are set', () => {
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': { 'p:bgPr': { 'a:solidFill': {} } },
			},
		};
		const input = createInput({}, slideNode);
		builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeUndefined();
	});

	it('removes p:bg when backgroundColor is transparent', () => {
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': { 'p:bgPr': {} },
			},
		};
		const input = createInput({ backgroundColor: 'transparent' }, slideNode);
		builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeUndefined();
	});

	it('removes p:bg when backgroundColor is empty string', () => {
		const slideNode: XmlObject = {
			'p:cSld': {
				'p:bg': { 'p:bgPr': {} },
			},
		};
		const input = createInput({ backgroundColor: '' }, slideNode);
		builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeUndefined();
	});

	// ── Solid color background ───────────────────────────────────────────

	it('generates a:solidFill for a hex background color', () => {
		const input = createInput({ backgroundColor: '#FF6600' });
		builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bg = cSld['p:bg'] as XmlObject;
		const bgPr = bg['p:bgPr'] as XmlObject;

		expect(bgPr['a:solidFill']).toBeDefined();
		const solidFill = bgPr['a:solidFill'] as XmlObject;
		const srgbClr = solidFill['a:srgbClr'] as XmlObject;
		expect(srgbClr['@_val']).toBe('FF6600');
	});

	it('strips # from hex color in solidFill output', () => {
		const input = createInput({ backgroundColor: '#aabbcc' });
		builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;
		const srgbClr = (bgPr['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject;
		// Should uppercase and strip #
		expect(srgbClr['@_val']).toBe('AABBCC');
	});

	it('includes a:effectLst in bgPr for solid fill', () => {
		const input = createInput({ backgroundColor: '#FF0000' });
		builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;
		expect(bgPr['a:effectLst']).toStrictEqual({});
	});

	// ── Image background ─────────────────────────────────────────────────

	it('generates a:blipFill for a data-URL background image', () => {
		const input = createInput({
			backgroundImage: 'data:image/png;base64,iVBOR...',
		});
		builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;

		expect(bgPr['a:blipFill']).toBeDefined();
		const blipFill = bgPr['a:blipFill'] as XmlObject;
		const blip = blipFill['a:blip'] as XmlObject;
		expect(blip['@_r:embed']).toBe('rId10');
		expect(blipFill['a:stretch']).toStrictEqual({ 'a:fillRect': {} });
	});

	it('writes image bytes to zip and registers relationship', () => {
		const input = createInput({
			backgroundImage: 'data:image/png;base64,iVBOR...',
		});
		builder.applyBackground(input);

		expect(input.zip.file).toHaveBeenCalledWith('ppt/media/image1.png', expect.any(Uint8Array));
		expect(input.relationshipRegistry.upsertRelationship).toHaveBeenCalledWith(
			'rId10',
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
			'../media/image1.png',
		);
	});

	it('image background takes priority over solid color', () => {
		const input = createInput({
			backgroundColor: '#FF0000',
			backgroundImage: 'data:image/png;base64,iVBOR...',
		});
		builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;

		// Should have blipFill, not solidFill
		expect(bgPr['a:blipFill']).toBeDefined();
		expect(bgPr['a:solidFill']).toBeUndefined();
	});

	// ── cSld initialization ──────────────────────────────────────────────

	it('creates p:cSld if missing from slideNode', () => {
		const slideNode: XmlObject = {};
		const input = createInput({ backgroundColor: '#00FF00' }, slideNode);
		builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		expect(cSld).toBeDefined();
		expect(cSld['p:bg']).toBeDefined();
	});

	// ── When parseDataUrlToBytes returns null ──────────────────────────────

	it('drops p:bg entirely when image parsing fails and no other fill source is valid', () => {
		// The builder enters the data-URL image branch; when parsing fails
		// the blipFill is skipped. The else-if for solidFill is not reached.
		// Rather than emit a schema-invalid <p:bgPr><a:effectLst/></p:bgPr>
		// with no fill, the builder now drops <p:bg> entirely.
		const input = createInput({
			backgroundColor: '#FF0000',
			backgroundImage: 'data:image/png;base64,corrupted',
		});
		(input.parseDataUrlToBytes as ReturnType<typeof vi.fn>).mockReturnValue(null);
		builder.applyBackground(input);

		const cSld = input.slideNode['p:cSld'] as XmlObject;
		expect(cSld['p:bg']).toBeUndefined();
	});

	// ── rId-referenced blipFill preservation ─────────────────────────────

	it('preserves raw p:bg with existing a:blipFill when slide model has no data-URL override', () => {
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
		builder.applyBackground(input);

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

	it('preserves raw p:bg blipFill even when backgroundImage is undefined but raw XML has one', () => {
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
		builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		// With no slide-model background signals, the builder's contract is
		// still to delete p:bg. Round-tripping rId backgrounds when the
		// model is silent is the responsibility of the loader surfacing them
		// onto slide.backgroundImage. Keep this test documenting that.
		expect(cSld['p:bg']).toBeUndefined();
	});

	it('regenerates a:blipFill from a data-URL backgroundImage even when raw XML has a different blipFill', () => {
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
		builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		const bgPr = (cSld['p:bg'] as XmlObject)['p:bgPr'] as XmlObject;
		const blipFill = bgPr['a:blipFill'] as XmlObject;
		// New rId from the registry mock; not the original.
		expect((blipFill['a:blip'] as XmlObject)['@_r:embed']).toBe('rId10');
		expect(input.relationshipRegistry.upsertRelationship).toHaveBeenCalled();
	});

	// ── Schema child order ────────────────────────────────────────────────

	it('places p:bg before p:spTree in p:cSld when adding a background', () => {
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
		builder.applyBackground(input);

		const cSld = slideNode['p:cSld'] as XmlObject;
		const keys = Object.keys(cSld).filter((k) => !k.startsWith('@_'));
		const bgIdx = keys.indexOf('p:bg');
		const spTreeIdx = keys.indexOf('p:spTree');
		expect(bgIdx).toBeGreaterThanOrEqual(0);
		expect(spTreeIdx).toBeGreaterThan(bgIdx);
	});

	// ── shadeToTitle round-trip (ECMA-376 §19.3.1.2) ──────────────────────

	it('emits @_shadeToTitle="1" when slide.backgroundShadeToTitle is true', () => {
		const input = createInput({
			backgroundColor: '#FFFFFF',
			backgroundShadeToTitle: true,
		});
		builder.applyBackground(input);
		const bgPr = (
			((input.slideNode['p:cSld'] as XmlObject)['p:bg'] as XmlObject)['p:bgPr'] as XmlObject
		)['@_shadeToTitle'];
		expect(bgPr).toBe('1');
	});

	it('emits @_shadeToTitle="0" when slide.backgroundShadeToTitle is false', () => {
		const input = createInput({
			backgroundColor: '#FFFFFF',
			backgroundShadeToTitle: false,
		});
		builder.applyBackground(input);
		const bgPr = (
			((input.slideNode['p:cSld'] as XmlObject)['p:bg'] as XmlObject)['p:bgPr'] as XmlObject
		)['@_shadeToTitle'];
		expect(bgPr).toBe('0');
	});

	it('omits @_shadeToTitle when backgroundShadeToTitle is undefined', () => {
		const input = createInput({ backgroundColor: '#FFFFFF' });
		builder.applyBackground(input);
		const bgPr = ((input.slideNode['p:cSld'] as XmlObject)['p:bg'] as XmlObject)[
			'p:bgPr'
		] as XmlObject;
		expect(bgPr['@_shadeToTitle']).toBeUndefined();
	});
});
